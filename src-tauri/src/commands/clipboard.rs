#[tauri::command]
pub async fn clipboard_write(session_id: String, text: String) -> Result<(), String> {
    log::info!(
        "Clipboard write stub: session={}, text_len={}",
        session_id,
        text.len()
    );
    Ok(())
}

#[tauri::command]
pub async fn clipboard_read(session_id: String) -> Result<String, String> {
    log::info!("Clipboard read stub: session={}", session_id);
    Err("Clipboard sync requires an active RDP connection".to_string())
}
