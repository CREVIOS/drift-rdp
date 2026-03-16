use tauri::State;

use crate::rdp::client::SessionCommand;
use crate::rdp::session::SessionManager;

#[tauri::command]
pub async fn clipboard_write(
    session_id: String,
    text: String,
    session_mgr: State<'_, SessionManager>,
) -> Result<(), String> {
    let cmd_tx = session_mgr
        .get_cmd_sender(&session_id)
        .await
        .ok_or_else(|| format!("Session '{}' not found", session_id))?;

    cmd_tx
        .send(SessionCommand::ClipboardWrite { text })
        .await
        .map_err(|_| format!("Session '{}' actor is no longer running", session_id))
}

#[tauri::command]
pub async fn clipboard_read(
    session_id: String,
    session_mgr: State<'_, SessionManager>,
) -> Result<String, String> {
    session_mgr
        .get_remote_clipboard(&session_id)
        .await
        .ok_or_else(|| {
            format!(
                "No remote clipboard text available for session '{}'",
                session_id
            )
        })
}
