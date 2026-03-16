use tauri::State;

use crate::store::connections::{ConnectionConfig, ConnectionInput, ConnectionStore};
use crate::store::credentials::CredentialStore;

#[tauri::command]
pub async fn list_connections(
    store: State<'_, ConnectionStore>,
) -> Result<Vec<ConnectionConfig>, String> {
    Ok(store.list().await)
}

#[tauri::command]
pub async fn get_connection(
    id: String,
    store: State<'_, ConnectionStore>,
) -> Result<ConnectionConfig, String> {
    store
        .get(&id)
        .await
        .ok_or_else(|| format!("Connection '{}' not found", id))
}

#[tauri::command]
pub async fn create_connection(
    config: ConnectionInput,
    store: State<'_, ConnectionStore>,
    cred_store: State<'_, CredentialStore>,
) -> Result<ConnectionConfig, String> {
    // Validate host
    if config.host.trim().is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    if config.host.len() > 253 {
        return Err("Host exceeds maximum length of 253 characters".to_string());
    }
    // Validate port
    if config.port == 0 {
        return Err("Port must be in range 1-65535".to_string());
    }

    let password = config.password.clone();
    let conn = store.create(config).await?;

    // Store password in keychain if provided
    if let Some(ref pw) = password {
        if !pw.is_empty() {
            cred_store.store_password(&conn.id, pw)?;
        }
    }

    log::info!("Created connection: {} ({})", conn.name, conn.id);
    Ok(conn)
}

#[tauri::command]
pub async fn update_connection(
    id: String,
    config: ConnectionInput,
    store: State<'_, ConnectionStore>,
) -> Result<ConnectionConfig, String> {
    store
        .update(&id, config)
        .await?
        .ok_or_else(|| format!("Connection '{}' not found", id))
}

#[tauri::command]
pub async fn delete_connection(
    id: String,
    store: State<'_, ConnectionStore>,
    cred_store: State<'_, CredentialStore>,
) -> Result<bool, String> {
    let removed = store.delete(&id).await?;
    if removed {
        // Best-effort delete password from keychain
        let _ = cred_store.delete_password(&id);
        log::info!("Deleted connection: {}", id);
    }
    Ok(removed)
}

#[tauri::command]
pub async fn import_rdp_file(
    path: String,
    store: State<'_, ConnectionStore>,
) -> Result<ConnectionConfig, String> {
    let input = crate::store::connections::parse_rdp_file(&path)?;
    let conn = store.create(input).await?;
    log::info!("Imported connection from RDP file: {} ({})", conn.name, conn.id);
    Ok(conn)
}

#[tauri::command]
pub async fn import_ssh_config(
    store: State<'_, ConnectionStore>,
) -> Result<usize, String> {
    let hosts = crate::utils::ssh_config::parse_ssh_config()?;
    let mut count = 0;
    for host in hosts {
        let input = ConnectionInput {
            name: host.name.clone(),
            host: host.hostname,
            port: 3389,
            username: host.user.unwrap_or_default(),
            domain: String::new(),
            color_accent: None,
            tags: vec!["ssh-import".to_string()],
            display_width: None,
            display_height: None,
            password: None,
        };
        store.create(input).await?;
        count += 1;
    }
    log::info!("Imported {} connections from SSH config", count);
    Ok(count)
}

#[tauri::command]
pub async fn test_connection(host: String, port: u16) -> Result<bool, String> {
    crate::utils::network::test_tcp_connection(&host, port, 5000).await
}

#[tauri::command]
pub async fn measure_latency(host: String, port: u16) -> Result<Option<u64>, String> {
    crate::utils::network::measure_tcp_latency(&host, port, 5000).await
}

#[tauri::command]
pub async fn get_connection_password(
    id: String,
    cred_store: State<'_, CredentialStore>,
) -> Result<Option<String>, String> {
    cred_store.get_password(&id)
}
