mod commands;
mod rdp;
mod renderer;
mod store;
mod utils;

use std::sync::Arc;
use tauri::{Manager, RunEvent, WindowEvent};

use rdp::session::SessionManager;
use renderer::gpu::GpuRenderer;
use renderer::shared_frame::SharedFrame;
use store::connections::ConnectionStore;
use store::credentials::CredentialStore;
use store::settings::SettingsStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install the ring crypto provider for rustls (required for TLS in spawned tasks)
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            // Resolve the app data directory for persistent storage
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            // Ensure the data directory exists
            std::fs::create_dir_all(&data_dir).expect("Failed to create app data directory");

            log::info!("App data directory: {:?}", data_dir);

            // Initialize stores
            let connection_store = ConnectionStore::new(data_dir.clone());
            let settings_store = SettingsStore::new(data_dir);
            let session_manager = SessionManager::new();
            let credential_store = CredentialStore::new();
            let shared_frame = SharedFrame::new(1920, 1080);

            // Register managed state
            app.manage(connection_store);
            app.manage(settings_store);
            app.manage(session_manager);
            app.manage(credential_store);
            app.manage(shared_frame.clone());

            // Create GPU renderer from the main window
            let window = app.get_webview_window("main").unwrap();
            let sf = shared_frame.clone();

            match tauri::async_runtime::block_on(GpuRenderer::new(window, sf)) {
                Ok(renderer) => {
                    let renderer = Arc::new(renderer);
                    app.manage(renderer.clone());

                    // Spawn render loop on a DEDICATED OS thread (not tokio)
                    // GPU present() blocks for vsync — must not starve the async runtime
                    let r = renderer.clone();
                    let sf_render = shared_frame.clone();
                    std::thread::Builder::new()
                        .name("gpu-render".into())
                        .spawn(move || {
                            log::info!("GPU render thread started");
                            loop {
                                // Sleep until session actor signals a new frame (via condvar)
                                // Times out at 100ms to handle resize/surface-lost recovery
                                sf_render.wait_for_frame(std::time::Duration::from_millis(100));

                                match r.render() {
                                    Ok(()) => {}
                                    Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                                        log::warn!("Surface lost/outdated, waiting for reconfigure");
                                        std::thread::sleep(std::time::Duration::from_millis(16));
                                    }
                                    Err(wgpu::SurfaceError::OutOfMemory) => {
                                        log::error!("GPU out of memory, stopping render thread");
                                        break;
                                    }
                                    Err(e) => {
                                        log::warn!("Render error: {}", e);
                                    }
                                }
                            }
                        })
                        .expect("Failed to spawn GPU render thread");

                    log::info!("GPU renderer initialized successfully");
                }
                Err(e) => {
                    log::warn!(
                        "GPU renderer failed to initialize, falling back to IPC frames: {}",
                        e
                    );
                    // No GPU renderer — the webview Canvas fallback handles frames via IPC
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Connection commands
            commands::connection::list_connections,
            commands::connection::get_connection,
            commands::connection::create_connection,
            commands::connection::update_connection,
            commands::connection::delete_connection,
            commands::connection::import_rdp_file,
            commands::connection::test_connection,
            commands::connection::get_connection_password,
            commands::connection::measure_latency,
            commands::connection::import_ssh_config,
            // Clipboard commands
            commands::clipboard::clipboard_write,
            commands::clipboard::clipboard_read,
            // Session commands
            commands::session::connect,
            commands::session::disconnect,
            commands::session::list_sessions,
            commands::session::get_session_info,
            commands::session::send_key_event,
            commands::session::send_mouse_event,
            commands::session::resize_session,
            commands::session::get_frame,
            commands::session::cancel_reconnect,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        match event {
            RunEvent::WindowEvent {
                label: _,
                event: WindowEvent::Resized(size),
                ..
            } => {
                // Resize the GPU surface if renderer exists
                if let Some(renderer) = app_handle.try_state::<Arc<GpuRenderer>>() {
                    renderer.resize(size.width, size.height);
                }
            }
            _ => {}
        }
    });
}
