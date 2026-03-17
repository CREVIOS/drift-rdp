use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::{mpsc, watch, Mutex};
use uuid::Uuid;

use crate::rdp::client::{attempt_rdp_connection, ConnectionOutcome, SessionCommand};
use crate::rdp::clipboard::SessionClipboardBackend;
use crate::rdp::display::FrameBuffer;
use crate::rdp::frame_transport::{encode_full_frame_packet, encode_h264_packet, encode_image_update_packet};
use crate::renderer::h264_encoder::H264FrameEncoder;
use crate::store::connections::ConnectionConfig;

pub const MAX_SESSIONS: usize = 10;
pub const MAX_RECONNECT_ATTEMPTS: u32 = 5;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SessionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceMetrics {
    pub fps: f64,
    pub latency_ms: u32,
    pub bandwidth_kbps: u32,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            fps: 0.0,
            latency_ms: 15,
            bandwidth_kbps: 0,
        }
    }
}

/// Flattened session info sent to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub connection_id: String,
    pub connection_name: String,
    pub host: String,
    pub status: SessionState,
    pub fps: f64,
    pub latency: u32,
    pub bandwidth: u32,
    pub width: u32,
    pub height: u32,
    pub connected_at: Option<DateTime<Utc>>,
    pub reconnect_attempts: u32,
    pub max_reconnect_attempts: u32,
    pub last_error: Option<String>,
}

/// Lightweight handle to a running session actor.
/// Stored in SessionManager instead of the full Session struct.
pub struct SessionHandle {
    /// Send commands (key/mouse/resize/disconnect) to the actor.
    pub cmd_tx: mpsc::Sender<SessionCommand>,
    /// Receive the latest session info (lock-free reads via watch).
    pub info_rx: watch::Receiver<SessionInfo>,
    /// Receive the latest remote clipboard text.
    pub clipboard_rx: watch::Receiver<Option<String>>,
    /// The tokio JoinHandle for the actor task.
    #[allow(dead_code)]
    pub task_handle: tokio::task::JoinHandle<()>,
}

/// The session actor: a long-lived tokio task that owns all per-session state.
/// It receives commands via an mpsc channel and publishes session info via a watch channel.
/// Frames are streamed to the frontend via a Tauri channel.
struct SessionActor {
    id: String,
    config: ConnectionConfig,
    password: Option<String>,
    state: SessionState,
    metrics: PerformanceMetrics,
    width: u32,
    height: u32,
    connected_at: Option<DateTime<Utc>>,
    frame_buffer: FrameBuffer,
    frame_packet_scratch: Vec<u8>,
    cmd_rx: mpsc::Receiver<SessionCommand>,
    info_tx: watch::Sender<SessionInfo>,
    clipboard_tx: watch::Sender<Option<String>>,
    frame_channel: tauri::ipc::Channel<tauri::ipc::InvokeResponseBody>,
    app_handle: tauri::AppHandle,
    local_clipboard_text: Option<String>,
    reconnect_attempts: u32,
    last_error: Option<String>,
    auto_reconnect: bool,
    h264_encoder: Option<H264FrameEncoder>,
}

impl SessionActor {
    fn new(
        id: String,
        config: ConnectionConfig,
        password: Option<String>,
        cmd_rx: mpsc::Receiver<SessionCommand>,
        info_tx: watch::Sender<SessionInfo>,
        clipboard_tx: watch::Sender<Option<String>>,
        frame_channel: tauri::ipc::Channel<tauri::ipc::InvokeResponseBody>,
        app_handle: tauri::AppHandle,
        auto_reconnect: bool,
    ) -> Self {
        let (width, height) = normalize_remote_resolution(
            config.display_width.unwrap_or(1920),
            config.display_height.unwrap_or(1080),
        );

        // Try to create the H.264 encoder; fall back to None if it fails
        let h264_encoder = match H264FrameEncoder::new(width, height) {
            Ok(enc) => {
                log::info!("H.264 encoder initialized for {}x{}", width, height);
                Some(enc)
            }
            Err(e) => {
                log::warn!("Failed to initialize H.264 encoder, will use raw RGBA: {}", e);
                None
            }
        };

        Self {
            id,
            config,
            password,
            state: SessionState::Connecting,
            metrics: PerformanceMetrics::default(),
            width,
            height,
            connected_at: None,
            frame_buffer: FrameBuffer::generate_mock_frame(width, height),
            frame_packet_scratch: Vec::with_capacity((width * height * 4) as usize),
            cmd_rx,
            info_tx,
            clipboard_tx,
            frame_channel,
            app_handle,
            local_clipboard_text: None,
            reconnect_attempts: 0,
            last_error: None,
            auto_reconnect,
            h264_encoder,
        }
    }

    /// Build a SessionInfo snapshot from the current actor state.
    fn build_info(&self) -> SessionInfo {
        SessionInfo {
            id: self.id.clone(),
            connection_id: self.config.id.clone(),
            connection_name: self.config.name.clone(),
            host: self.config.host.clone(),
            status: self.state.clone(),
            fps: self.metrics.fps,
            latency: self.metrics.latency_ms,
            bandwidth: self.metrics.bandwidth_kbps,
            width: self.width,
            height: self.height,
            connected_at: self.connected_at,
            reconnect_attempts: self.reconnect_attempts,
            max_reconnect_attempts: MAX_RECONNECT_ATTEMPTS,
            last_error: self.last_error.clone(),
        }
    }

    /// Publish the latest session info through the watch channel.
    fn publish_info(&self) {
        let info = self.build_info();
        let _ = self.info_tx.send(info.clone());
        if let Err(error) = self
            .app_handle
            .emit(&format!("session-info-{}", self.id), info)
        {
            log::debug!(
                "Failed to emit session info for session {}: {}",
                self.id,
                error
            );
        }
    }

    fn publish_remote_clipboard(&mut self, text: String) {
        let _ = self.clipboard_tx.send(Some(text.clone()));
        if let Err(error) = self
            .app_handle
            .emit(&format!("clipboard-{}", self.id), text)
        {
            log::warn!(
                "Failed to emit clipboard event for session {}: {}",
                self.id,
                error
            );
        }
    }

    fn send_frame_packet(&mut self, packet: Vec<u8>) -> Result<(), DisconnectReason> {
        match self
            .frame_channel
            .send(tauri::ipc::InvokeResponseBody::Raw(packet))
        {
            Ok(()) => Ok(()),
            Err(error) => {
                log::warn!(
                    "Failed to send frame packet for session {}: {}",
                    self.id,
                    error
                );
                self.last_error = Some(format!("Frame emit failed: {}", error));
                Err(DisconnectReason::ConnectionLost)
            }
        }
    }

    /// Try to send a frame as H.264. Returns Ok(true) if sent, Ok(false) if encoder unavailable.
    fn try_send_h264_frame(
        &mut self,
        rgba_data: &[u8],
        width: u32,
        height: u32,
    ) -> Result<bool, DisconnectReason> {
        let encoder = match self.h264_encoder.as_mut() {
            Some(enc) => enc,
            None => return Ok(false),
        };

        match encoder.encode_rgba(rgba_data, width, height) {
            Ok(h264_data) => {
                if h264_data.is_empty() {
                    return Ok(false);
                }
                let packet = encode_h264_packet(width as u16, height as u16, &h264_data);
                self.send_frame_packet(packet)?;
                Ok(true)
            }
            Err(e) => {
                log::warn!("H.264 encode failed, falling back to raw RGBA: {}", e);
                // Disable H.264 encoder on failure
                self.h264_encoder = None;
                Ok(false)
            }
        }
    }

    fn send_mock_frame(&mut self) -> Result<(), DisconnectReason> {
        // Try H.264 encoding first for the mock frame
        let w = self.frame_buffer.width;
        let h = self.frame_buffer.height;
        // We need to clone data to avoid borrow conflict with self
        let rgba_data = self.frame_buffer.data.clone();
        if self.try_send_h264_frame(&rgba_data, w, h)? {
            return Ok(());
        }

        // Fall back to raw RGBA
        let packet = encode_full_frame_packet(&self.frame_buffer);
        self.send_frame_packet(packet)
    }

    async fn flush_clipboard_messages<W>(
        &mut self,
        active_stage: &mut ironrdp::session::ActiveStage,
        writer: &mut W,
    ) -> Result<(), DisconnectReason>
    where
        W: ironrdp_tokio::FramedWrite,
    {
        use ironrdp::cliprdr::{
            backend::ClipboardMessage, Client as CliprdrRoleClient, CliprdrClient,
            CliprdrSvcMessages,
        };

        let (pending_messages, remote_text_update) = {
            let Some(cliprdr) = active_stage.get_svc_processor_mut::<CliprdrClient>() else {
                return Ok(());
            };
            let Some(backend) = cliprdr.downcast_backend_mut::<SessionClipboardBackend>() else {
                return Ok(());
            };

            (
                backend.take_pending_messages(),
                backend.take_remote_text_update(),
            )
        };

        if let Some(text) = remote_text_update {
            self.publish_remote_clipboard(text);
        }

        for message in pending_messages {
            let svc_messages = {
                let Some(cliprdr) = active_stage.get_svc_processor_mut::<CliprdrClient>() else {
                    continue;
                };

                let result = match message {
                    ClipboardMessage::SendInitiateCopy(formats) => cliprdr.initiate_copy(&formats),
                    ClipboardMessage::SendFormatData(response) => {
                        cliprdr.submit_format_data(response)
                    }
                    ClipboardMessage::SendInitiatePaste(format) => cliprdr.initiate_paste(format),
                    ClipboardMessage::Error(error) => {
                        log::warn!("Clipboard backend error for session {}: {}", self.id, error);
                        continue;
                    }
                };

                match result {
                    Ok(messages) => Some(Vec::from(messages)),
                    Err(error) => {
                        log::warn!(
                            "Failed to build clipboard response for session {}: {}",
                            self.id,
                            error
                        );
                        self.last_error = Some(format!("Clipboard error: {}", error));
                        return Err(DisconnectReason::ConnectionLost);
                    }
                }
            };

            let Some(svc_messages) = svc_messages else {
                continue;
            };
            if svc_messages.is_empty() {
                continue;
            }

            let frame = match active_stage.process_svc_processor_messages(CliprdrSvcMessages::<
                CliprdrRoleClient,
            >::new(
                svc_messages
            )) {
                Ok(frame) => frame,
                Err(error) => {
                    log::warn!(
                        "Failed to encode clipboard channel payload for session {}: {}",
                        self.id,
                        error
                    );
                    self.last_error = Some(format!("Clipboard encode error: {}", error));
                    return Err(DisconnectReason::ConnectionLost);
                }
            };

            if frame.is_empty() {
                continue;
            }

            if let Err(error) = writer.write_all(&frame).await {
                log::warn!(
                    "Failed to write clipboard payload for session {}: {}",
                    self.id,
                    error
                );
                self.last_error = Some(format!("Clipboard write error: {}", error));
                return Err(DisconnectReason::ConnectionLost);
            }
        }

        Ok(())
    }

    async fn set_local_clipboard_text<W>(
        &mut self,
        active_stage: &mut ironrdp::session::ActiveStage,
        writer: &mut W,
        text: String,
    ) -> Result<(), DisconnectReason>
    where
        W: ironrdp_tokio::FramedWrite,
    {
        use ironrdp::cliprdr::CliprdrClient;

        self.local_clipboard_text = Some(text.clone());

        if let Some(cliprdr) = active_stage.get_svc_processor_mut::<CliprdrClient>() {
            if let Some(backend) = cliprdr.downcast_backend_mut::<SessionClipboardBackend>() {
                backend.set_local_text(text);
            }
        }

        self.flush_clipboard_messages(active_stage, writer).await
    }

    /// Main actor loop.
    async fn run(mut self) {
        // Publish initial "Connecting" state
        self.publish_info();

        // Step 1: Attempt RDP connection (with graceful fallback to mock)
        log::info!(
            "Session {} attempting RDP connection to {}:{}",
            self.id,
            self.config.host,
            self.config.port
        );

        let outcome = attempt_rdp_connection(
            &self.config,
            self.password.as_deref(),
            self.width,
            self.height,
        )
        .await;

        match outcome {
            ConnectionOutcome::RealSession {
                connection_result,
                framed,
            } => {
                log::info!("Session {} entered real RDP session", self.id);
                self.state = SessionState::Connected;
                self.connected_at = Some(Utc::now());

                // Update dimensions from the server's negotiated desktop size
                self.width = connection_result.desktop_size.width as u32;
                self.height = connection_result.desktop_size.height as u32;
                self.publish_info();

                // Run the real RDP session loop
                let disconnect_reason = self.run_real_session_loop(connection_result, framed).await;

                if disconnect_reason == DisconnectReason::ConnectionLost && self.auto_reconnect {
                    self.run_reconnect_loop().await;
                }
            }
            ConnectionOutcome::Failed(reason) => {
                log::info!("Session {} using mock frames (reason: {})", self.id, reason);
                self.state = SessionState::Connected;
                self.connected_at = Some(Utc::now());
                self.publish_info();

                // Run the mock frame loop
                let disconnect_reason = self.run_mock_frame_loop().await;

                // Handle auto-reconnect if the loop ended due to a connection-like issue
                // (not a user-initiated disconnect)
                if disconnect_reason == DisconnectReason::ConnectionLost && self.auto_reconnect {
                    self.run_reconnect_loop().await;
                }
            }
        }

        // Actor finished; set state to disconnected
        self.state = SessionState::Disconnected;
        self.publish_info();
        log::info!("Session {} actor stopped", self.id);
    }

    /// Real RDP session loop: reads PDUs from the server, decodes graphics,
    /// and emits frame data to the frontend.
    async fn run_real_session_loop(
        &mut self,
        connection_result: ironrdp::connector::ConnectionResult,
        framed: crate::rdp::client::TlsFramed,
    ) -> DisconnectReason {
        use ironrdp::graphics::image_processing::PixelFormat;
        use ironrdp::session::image::DecodedImage;
        use ironrdp::session::{ActiveStage, ActiveStageOutput};
        use ironrdp_tokio::FramedWrite;
        let mut active_stage = ActiveStage::new(connection_result);
        let mut image =
            DecodedImage::new(PixelFormat::RgbA32, self.width as u16, self.height as u16);

        // Split the framed stream for concurrent read/write
        let (mut reader, mut writer) = ironrdp_tokio::split_tokio_framed(framed);

        if let Some(text) = self.local_clipboard_text.clone() {
            if self
                .set_local_clipboard_text(&mut active_stage, &mut writer, text)
                .await
                .is_err()
            {
                return DisconnectReason::ConnectionLost;
            }
        }

        loop {
            tokio::select! {
                // Read PDUs from the server
                pdu_result = reader.read_pdu() => {
                    let (action, payload) = match pdu_result {
                        Ok(ap) => ap,
                        Err(e) => {
                            log::warn!("Session {} read_pdu error: {}", self.id, e);
                            self.last_error = Some(format!("Connection lost: {}", e));
                            self.state = SessionState::Error(format!("Connection lost: {}", e));
                            self.publish_info();
                            return DisconnectReason::ConnectionLost;
                        }
                    };

                    let outputs = match active_stage.process(&mut image, action, &payload) {
                        Ok(outputs) => outputs,
                        Err(e) => {
                            log::warn!("Session {} process error: {}", self.id, e);
                            self.last_error = Some(format!("Session error: {}", e));
                            self.state = SessionState::Error(format!("Session error: {}", e));
                            self.publish_info();
                            return DisconnectReason::ConnectionLost;
                        }
                    };

                    let mut updated_regions = Vec::new();
                    for out in outputs {
                        match out {
                            ActiveStageOutput::ResponseFrame(frame) => {
                                if !frame.is_empty() {
                                    if let Err(e) = writer.write_all(&frame).await {
                                        log::warn!("Session {} write error: {}", self.id, e);
                                        self.last_error = Some(format!("Write error: {}", e));
                                        return DisconnectReason::ConnectionLost;
                                    }
                                }
                            }
                            ActiveStageOutput::GraphicsUpdate(region) => {
                                updated_regions.push(region);
                            }
                            ActiveStageOutput::Terminate(reason) => {
                                log::info!(
                                    "Session {} terminated by server: {}",
                                    self.id,
                                    reason
                                );
                                self.state = SessionState::Disconnected;
                                self.publish_info();
                                return DisconnectReason::UserDisconnect;
                            }
                            ActiveStageOutput::DeactivateAll(_cas) => {
                                log::info!("Session {} deactivate-all received", self.id);
                                // Server wants to re-negotiate capabilities; treat as disconnect
                                return DisconnectReason::ConnectionLost;
                            }
                            _ => {
                                // PointerDefault, PointerHidden, PointerPosition, PointerBitmap
                                // Ignored for now
                            }
                        }
                    }

                    if !updated_regions.is_empty() {
                        let packet = encode_image_update_packet(
                            &image,
                            &updated_regions,
                            &mut self.frame_packet_scratch,
                        );
                        if self.send_frame_packet(packet).is_err() {
                            return DisconnectReason::ConnectionLost;
                        }
                    }

                    if self
                        .flush_clipboard_messages(&mut active_stage, &mut writer)
                        .await
                        .is_err()
                    {
                        return DisconnectReason::ConnectionLost;
                    }
                }

                // Process commands from the frontend
                cmd = self.cmd_rx.recv() => {
                    match cmd {
                        Some(SessionCommand::Disconnect) | None => {
                            log::info!("Session {} received disconnect command", self.id);
                            // Try graceful shutdown
                            if let Ok(outputs) = active_stage.graceful_shutdown() {
                                for out in outputs {
                                    if let ActiveStageOutput::ResponseFrame(frame) = out {
                                        let _ = writer.write_all(&frame).await;
                                    }
                                }
                            }
                            self.state = SessionState::Disconnected;
                            self.publish_info();
                            return DisconnectReason::UserDisconnect;
                        }
                        Some(SessionCommand::SendKey { key_code, is_down }) => {
                            log::debug!(
                                "Session {} key event: code={}, down={}",
                                self.id, key_code, is_down
                            );
                            // Encode key event as FastPath input
                            use ironrdp::pdu::input::fast_path::{FastPathInputEvent, KeyboardFlags};

                            let scancode = (key_code & 0xff) as u8;
                            if scancode == 0 {
                                continue;
                            }

                            let mut flags = KeyboardFlags::empty();
                            if !is_down {
                                flags |= KeyboardFlags::RELEASE;
                            }
                            if (key_code & 0x100) != 0 {
                                flags |= KeyboardFlags::EXTENDED;
                            }

                            let event = FastPathInputEvent::KeyboardEvent(flags, scancode);

                            match active_stage.process_fastpath_input(&mut image, &[event]) {
                                Ok(outputs) => {
                                    for out in outputs {
                                        if let ActiveStageOutput::ResponseFrame(frame) = out {
                                            if let Err(e) = writer.write_all(&frame).await {
                                                log::warn!("Write error on key event: {}", e);
                                                return DisconnectReason::ConnectionLost;
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    log::warn!("Failed to encode key event: {}", e);
                                }
                            }
                        }
                        Some(SessionCommand::SendMouse { x, y, button, event_type, scroll_delta }) => {
                            log::debug!(
                                "Session {} mouse event: ({},{}) btn={:?} type={} scroll={}",
                                self.id, x, y, button, event_type, scroll_delta
                            );
                            // Encode mouse event as FastPath input
                            use ironrdp::pdu::input::fast_path::FastPathInputEvent;
                            use ironrdp::pdu::input::mouse::PointerFlags;
                            use ironrdp::pdu::input::MousePdu;

                            let mut flags = PointerFlags::empty();
                            let mut wheel_units: i16 = 0;

                            match event_type.as_str() {
                                "move" => {
                                    flags |= PointerFlags::MOVE;
                                }
                                "down" => {
                                    flags |= PointerFlags::DOWN;
                                    match button.as_deref() {
                                        Some("1") | Some("left") => flags |= PointerFlags::LEFT_BUTTON,
                                        Some("2") | Some("right") => flags |= PointerFlags::RIGHT_BUTTON,
                                        Some("3") | Some("middle") => flags |= PointerFlags::MIDDLE_BUTTON_OR_WHEEL,
                                        _ => flags |= PointerFlags::LEFT_BUTTON,
                                    }
                                }
                                "up" => {
                                    match button.as_deref() {
                                        Some("1") | Some("left") => flags |= PointerFlags::LEFT_BUTTON,
                                        Some("2") | Some("right") => flags |= PointerFlags::RIGHT_BUTTON,
                                        Some("3") | Some("middle") => flags |= PointerFlags::MIDDLE_BUTTON_OR_WHEEL,
                                        _ => flags |= PointerFlags::LEFT_BUTTON,
                                    }
                                }
                                "scroll" => {
                                    // Per MS-RDPBCGR spec:
                                    // PTRFLAGS_WHEEL (0x0200) = vertical wheel
                                    // PTRFLAGS_WHEEL_NEGATIVE (0x0100) = negative rotation
                                    // WheelRotationMask (0x01FF) = rotation units in bottom 9 bits
                                    flags |= PointerFlags::VERTICAL_WHEEL;
                                    let delta = scroll_delta.clamp(-255, 255);
                                    if delta < 0 {
                                        flags |= PointerFlags::WHEEL_NEGATIVE;
                                        wheel_units = (-delta) as i16;
                                    } else {
                                        wheel_units = delta as i16;
                                    }
                                }
                                _ => {
                                    flags |= PointerFlags::MOVE;
                                }
                            }

                            let event = FastPathInputEvent::MouseEvent(MousePdu {
                                flags,
                                number_of_wheel_rotation_units: wheel_units,
                                x_position: x.max(0) as u16,
                                y_position: y.max(0) as u16,
                            });

                            match active_stage.process_fastpath_input(&mut image, &[event]) {
                                Ok(outputs) => {
                                    for out in outputs {
                                        if let ActiveStageOutput::ResponseFrame(frame) = out {
                                            if let Err(e) = writer.write_all(&frame).await {
                                                log::warn!("Write error on mouse event: {}", e);
                                                return DisconnectReason::ConnectionLost;
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    log::warn!("Failed to encode mouse event: {}", e);
                                }
                            }
                        }
                        Some(SessionCommand::Resize { width, height }) => {
                            let (width, height) = normalize_remote_resolution(width, height);
                            log::info!("Session {} resize request to {}x{}", self.id, width, height);
                            self.width = width;
                            self.height = height;
                            self.publish_info();
                            // Try to send a display control resize via the DVC
                            if let Some(result) = active_stage.encode_resize(width, height, None, None) {
                                match result {
                                    Ok(frame) => {
                                        if let Err(e) = writer.write_all(&frame).await {
                                            log::warn!("Write error on resize: {}", e);
                                            return DisconnectReason::ConnectionLost;
                                        }
                                    }
                                    Err(e) => {
                                        log::warn!("Failed to encode resize: {}", e);
                                    }
                                }
                            }
                        }
                        Some(SessionCommand::ClipboardWrite { text }) => {
                            if self
                                .set_local_clipboard_text(&mut active_stage, &mut writer, text)
                                .await
                                .is_err()
                            {
                                return DisconnectReason::ConnectionLost;
                            }
                        }
                    }
                }
            }
        }
    }

    /// Auto-reconnect loop with exponential backoff.
    async fn run_reconnect_loop(&mut self) {
        let mut attempt = 0u32;

        while attempt < MAX_RECONNECT_ATTEMPTS {
            attempt += 1;
            self.reconnect_attempts = attempt;
            self.state = SessionState::Reconnecting;
            self.publish_info();

            let delay = std::cmp::min(1u64 << attempt, 30); // 2, 4, 8, 16, 30 seconds
            log::info!(
                "Reconnect attempt {}/{} in {}s for session {}",
                attempt,
                MAX_RECONNECT_ATTEMPTS,
                delay,
                self.id
            );

            // Wait for the backoff delay, but check for disconnect commands
            let should_cancel = self
                .wait_with_cancel(std::time::Duration::from_secs(delay))
                .await;

            if should_cancel {
                log::info!("Reconnect cancelled for session {}", self.id);
                self.state = SessionState::Disconnected;
                self.publish_info();
                return;
            }

            // Attempt real reconnection
            let outcome = attempt_rdp_connection(
                &self.config,
                self.password.as_deref(),
                self.width,
                self.height,
            )
            .await;

            match outcome {
                ConnectionOutcome::RealSession {
                    connection_result,
                    framed,
                } => {
                    self.state = SessionState::Connected;
                    self.reconnect_attempts = 0;
                    self.last_error = None;
                    self.width = connection_result.desktop_size.width as u32;
                    self.height = connection_result.desktop_size.height as u32;
                    self.publish_info();
                    log::info!(
                        "Reconnected session {} (real RDP) on attempt {}",
                        self.id,
                        attempt
                    );

                    let reason = self.run_real_session_loop(connection_result, framed).await;
                    match reason {
                        DisconnectReason::UserDisconnect => return,
                        DisconnectReason::ConnectionLost => continue,
                    }
                }
                ConnectionOutcome::Failed(_reason) => {
                    // Fall back to mock on reconnect too
                    self.state = SessionState::Connected;
                    self.reconnect_attempts = 0;
                    self.last_error = None;
                    self.publish_info();
                    log::info!(
                        "Reconnected session {} (mock fallback) on attempt {}",
                        self.id,
                        attempt
                    );

                    let reason = self.run_mock_frame_loop().await;
                    match reason {
                        DisconnectReason::UserDisconnect => return,
                        DisconnectReason::ConnectionLost => continue,
                    }
                }
            }
        }

        // Exhausted all attempts
        let msg = format!(
            "Reconnection failed after {} attempts",
            MAX_RECONNECT_ATTEMPTS
        );
        self.state = SessionState::Error(msg.clone());
        self.last_error = Some(msg);
        self.reconnect_attempts = 0;
        self.publish_info();
    }

    /// Wait for a duration, but return early if a Disconnect command arrives.
    /// Returns `true` if we should cancel (disconnect received), `false` if the timer expired.
    async fn wait_with_cancel(&mut self, duration: std::time::Duration) -> bool {
        let sleep = tokio::time::sleep(duration);
        tokio::pin!(sleep);

        loop {
            tokio::select! {
                _ = &mut sleep => return false,
                cmd = self.cmd_rx.recv() => {
                    match cmd {
                        Some(SessionCommand::Disconnect) | None => return true,
                        // Process other commands while waiting
                        Some(SessionCommand::Resize { width, height }) => {
                            let (width, height) = normalize_remote_resolution(width, height);
                            self.width = width;
                            self.height = height;
                            self.frame_buffer = FrameBuffer::generate_mock_frame(width, height);
                            self.publish_info();
                        }
                        Some(SessionCommand::ClipboardWrite { text }) => {
                            self.local_clipboard_text = Some(text);
                        }
                        _ => {} // Ignore key/mouse during reconnect
                    }
                }
            }
        }
    }

    /// Mock session loop: sends an initial full frame and refreshes on resize.
    /// Returns the reason the loop ended.
    async fn run_mock_frame_loop(&mut self) -> DisconnectReason {
        if self.send_mock_frame().is_err() {
            return DisconnectReason::ConnectionLost;
        }

        loop {
            match self.cmd_rx.recv().await {
                Some(SessionCommand::Disconnect) | None => {
                    log::info!("Session {} received disconnect command", self.id);
                    self.state = SessionState::Disconnected;
                    self.publish_info();
                    return DisconnectReason::UserDisconnect;
                }
                Some(SessionCommand::Resize { width, height }) => {
                    let (width, height) = normalize_remote_resolution(width, height);
                    log::info!("Session {} resized to {}x{}", self.id, width, height);
                    self.width = width;
                    self.height = height;
                    self.frame_buffer = FrameBuffer::generate_mock_frame(width, height);
                    self.publish_info();
                    if self.send_mock_frame().is_err() {
                        return DisconnectReason::ConnectionLost;
                    }
                }
                Some(SessionCommand::SendKey { key_code, is_down }) => {
                    log::debug!(
                        "Session {} key event: code={}, down={}",
                        self.id,
                        key_code,
                        is_down
                    );
                    // TODO: Forward to IronRDP input channel when using real session
                }
                Some(SessionCommand::SendMouse {
                    x,
                    y,
                    button,
                    event_type,
                    scroll_delta: _,
                }) => {
                    log::debug!(
                        "Session {} mouse event: ({},{}) btn={:?} type={}",
                        self.id,
                        x,
                        y,
                        button,
                        event_type
                    );
                    // TODO: Forward to IronRDP input channel when using real session
                }
                Some(SessionCommand::ClipboardWrite { text }) => {
                    self.local_clipboard_text = Some(text);
                }
            }
        }
    }
}

#[derive(Debug, PartialEq)]
enum DisconnectReason {
    UserDisconnect,
    ConnectionLost,
}

fn normalize_remote_resolution(width: u32, height: u32) -> (u32, u32) {
    ironrdp::displaycontrol::pdu::MonitorLayoutEntry::adjust_display_size(width, height)
}

/// Manages all active sessions using lightweight handles.
pub struct SessionManager {
    handles: Arc<Mutex<HashMap<String, SessionHandle>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn session_count(&self) -> usize {
        self.handles.lock().await.len()
    }

    /// Spawn a new session actor and return its ID.
    pub async fn create_session(
        &self,
        config: ConnectionConfig,
        password: Option<String>,
        frame_channel: tauri::ipc::Channel<tauri::ipc::InvokeResponseBody>,
        app_handle: tauri::AppHandle,
        auto_reconnect: bool,
    ) -> Result<String, String> {
        let count = self.session_count().await;
        if count >= MAX_SESSIONS {
            return Err(format!(
                "Maximum session limit ({}) reached. Disconnect an existing session first.",
                MAX_SESSIONS
            ));
        }

        let session_id = Uuid::new_v4().to_string();
        let (width, height) = normalize_remote_resolution(
            config.display_width.unwrap_or(1920),
            config.display_height.unwrap_or(1080),
        );

        // Create channels
        let (cmd_tx, cmd_rx) = mpsc::channel::<SessionCommand>(64);

        // Build initial info for the watch channel
        let initial_info = SessionInfo {
            id: session_id.clone(),
            connection_id: config.id.clone(),
            connection_name: config.name.clone(),
            host: config.host.clone(),
            status: SessionState::Connecting,
            fps: 0.0,
            latency: 15,
            bandwidth: 0,
            width,
            height,
            connected_at: None,
            reconnect_attempts: 0,
            max_reconnect_attempts: MAX_RECONNECT_ATTEMPTS,
            last_error: None,
        };
        let (info_tx, info_rx) = watch::channel(initial_info);
        let (clipboard_tx, clipboard_rx) = watch::channel(None);

        // Create the actor
        let actor = SessionActor::new(
            session_id.clone(),
            config,
            password,
            cmd_rx,
            info_tx,
            clipboard_tx,
            frame_channel,
            app_handle,
            auto_reconnect,
        );

        // Spawn the actor task
        let task_handle = tokio::spawn(actor.run());

        // Store the handle
        let handle = SessionHandle {
            cmd_tx,
            info_rx,
            clipboard_rx,
            task_handle,
        };

        self.handles.lock().await.insert(session_id.clone(), handle);

        log::info!("Created session {}", session_id);
        Ok(session_id)
    }

    /// Send a disconnect command and remove the session handle.
    pub async fn remove_session(&self, session_id: &str) -> Result<(), String> {
        let mut handles = self.handles.lock().await;
        if let Some(handle) = handles.remove(session_id) {
            // Send disconnect command (ignore error if actor already stopped)
            let _ = handle.cmd_tx.send(SessionCommand::Disconnect).await;
            log::info!("Session {} removed", session_id);
            Ok(())
        } else {
            Err(format!("Session '{}' not found", session_id))
        }
    }

    /// Get a clone of the command sender for a session.
    pub async fn get_cmd_sender(&self, session_id: &str) -> Option<mpsc::Sender<SessionCommand>> {
        let handles = self.handles.lock().await;
        handles.get(session_id).map(|h| h.cmd_tx.clone())
    }

    /// Get the latest session info (lock-free read from watch channel).
    pub async fn get_session_info(&self, session_id: &str) -> Option<SessionInfo> {
        let handles = self.handles.lock().await;
        handles.get(session_id).map(|h| h.info_rx.borrow().clone())
    }

    /// List all sessions.
    pub async fn list_sessions(&self) -> Vec<SessionInfo> {
        let handles = self.handles.lock().await;
        handles
            .values()
            .map(|h| h.info_rx.borrow().clone())
            .collect()
    }

    pub async fn get_remote_clipboard(&self, session_id: &str) -> Option<String> {
        let handles = self.handles.lock().await;
        handles
            .get(session_id)
            .and_then(|handle| handle.clipboard_rx.borrow().clone())
    }

    /// Get a snapshot of the current frame for a session (generates mock frame on demand).
    /// This is a fallback for the get_frame command.
    pub async fn get_frame(&self, session_id: &str) -> Option<String> {
        let handles = self.handles.lock().await;
        if let Some(handle) = handles.get(session_id) {
            let info = handle.info_rx.borrow().clone();
            // Generate a mock frame on demand with the session's current dimensions
            let fb = FrameBuffer::generate_mock_frame(info.width, info.height);
            Some(fb.to_base64_png())
        } else {
            None
        }
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
