use tauri::{
    ipc::{Channel, InvokeResponseBody},
    AppHandle, State,
};

use crate::rdp::client::SessionCommand;
use crate::rdp::session::{SessionInfo, SessionManager, MAX_SESSIONS};
use crate::store::connections::ConnectionStore;
use crate::store::credentials::CredentialStore;
use crate::store::settings::SettingsStore;

#[tauri::command]
pub async fn connect(
    connection_id: String,
    frame_channel: Channel<InvokeResponseBody>,
    app: AppHandle,
    conn_store: State<'_, ConnectionStore>,
    cred_store: State<'_, CredentialStore>,
    session_mgr: State<'_, SessionManager>,
    settings_store: State<'_, SettingsStore>,
) -> Result<String, String> {
    // Check max session limit
    let count = session_mgr.session_count().await;
    if count >= MAX_SESSIONS {
        return Err(format!(
            "Maximum session limit ({}) reached. Disconnect an existing session first.",
            MAX_SESSIONS
        ));
    }

    // Look up the connection config
    let config = conn_store
        .get(&connection_id)
        .await
        .ok_or_else(|| format!("Connection '{}' not found", connection_id))?;

    // Look up the password from the credential store
    let password = match cred_store.get_password(&connection_id) {
        Ok(pw) => pw,
        Err(e) => {
            log::warn!(
                "Failed to retrieve password for connection {}: {}",
                connection_id,
                e
            );
            None
        }
    };

    // Read auto_reconnect setting
    let auto_reconnect = settings_store.get().await.auto_reconnect;

    log::info!(
        "Starting session for connection {} ({}:{})",
        connection_id,
        config.host,
        config.port
    );

    // Create and spawn the session actor (with password for CredSSP/NLA)
    let session_id = session_mgr
        .create_session(config, password, frame_channel, app, auto_reconnect)
        .await?;

    // Update last_connected_at on the connection
    conn_store.update_last_connected(&connection_id).await?;

    Ok(session_id)
}

#[tauri::command]
pub async fn disconnect(
    session_id: String,
    session_mgr: State<'_, SessionManager>,
) -> Result<(), String> {
    session_mgr.remove_session(&session_id).await
}

/// Cancel an ongoing reconnection attempt. This sends a Disconnect command
/// to the session actor, which will stop the reconnect loop.
#[tauri::command]
pub async fn cancel_reconnect(
    session_id: String,
    session_mgr: State<'_, SessionManager>,
) -> Result<(), String> {
    // Sending Disconnect to the actor will cause it to exit the reconnect loop
    let cmd_tx = session_mgr
        .get_cmd_sender(&session_id)
        .await
        .ok_or_else(|| format!("Session '{}' not found", session_id))?;

    cmd_tx
        .send(SessionCommand::Disconnect)
        .await
        .map_err(|_| format!("Session '{}' actor is no longer running", session_id))?;

    log::info!("Cancel reconnect requested for session {}", session_id);
    Ok(())
}

#[tauri::command]
pub async fn list_sessions(
    session_mgr: State<'_, SessionManager>,
) -> Result<Vec<SessionInfo>, String> {
    Ok(session_mgr.list_sessions().await)
}

#[tauri::command]
pub async fn get_session_info(
    session_id: String,
    session_mgr: State<'_, SessionManager>,
) -> Result<SessionInfo, String> {
    session_mgr
        .get_session_info(&session_id)
        .await
        .ok_or_else(|| format!("Session '{}' not found", session_id))
}

#[tauri::command]
pub async fn send_key_event(
    session_id: String,
    key_code: u32,
    is_down: bool,
    session_mgr: State<'_, SessionManager>,
) -> Result<(), String> {
    let cmd_tx = session_mgr
        .get_cmd_sender(&session_id)
        .await
        .ok_or_else(|| format!("Session '{}' not found", session_id))?;

    cmd_tx
        .send(SessionCommand::SendKey { key_code, is_down })
        .await
        .map_err(|_| format!("Session '{}' actor is no longer running", session_id))
}

#[tauri::command]
pub async fn send_mouse_event(
    session_id: String,
    x: i32,
    y: i32,
    button: Option<String>,
    event_type: String,
    scroll_delta: Option<i32>,
    session_mgr: State<'_, SessionManager>,
) -> Result<(), String> {
    let cmd_tx = session_mgr
        .get_cmd_sender(&session_id)
        .await
        .ok_or_else(|| format!("Session '{}' not found", session_id))?;

    cmd_tx
        .send(SessionCommand::SendMouse {
            x,
            y,
            button,
            event_type,
            scroll_delta: scroll_delta.unwrap_or(0),
        })
        .await
        .map_err(|_| format!("Session '{}' actor is no longer running", session_id))
}

#[tauri::command]
pub async fn resize_session(
    session_id: String,
    width: u32,
    height: u32,
    session_mgr: State<'_, SessionManager>,
) -> Result<(), String> {
    if width > 8192 || height > 8192 || width == 0 || height == 0 {
        return Err(format!(
            "Invalid resolution {}x{} (max 8192x8192)",
            width, height
        ));
    }

    let cmd_tx = session_mgr
        .get_cmd_sender(&session_id)
        .await
        .ok_or_else(|| format!("Session '{}' not found", session_id))?;

    cmd_tx
        .send(SessionCommand::Resize { width, height })
        .await
        .map_err(|_| format!("Session '{}' actor is no longer running", session_id))
}

#[tauri::command]
pub async fn get_frame(
    session_id: String,
    session_mgr: State<'_, SessionManager>,
) -> Result<String, String> {
    session_mgr
        .get_frame(&session_id)
        .await
        .ok_or_else(|| format!("Session '{}' not found", session_id))
}
