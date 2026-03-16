mod commands;
mod rdp;
mod store;
mod utils;

use tauri::Manager;

use rdp::session::SessionManager;
use store::connections::ConnectionStore;
use store::credentials::CredentialStore;
use store::settings::SettingsStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install the ring crypto provider for rustls (required for TLS in spawned tasks)
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    tauri::Builder::default()
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

            // Register managed state
            app.manage(connection_store);
            app.manage(settings_store);
            app.manage(session_manager);
            app.manage(credential_store);

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
