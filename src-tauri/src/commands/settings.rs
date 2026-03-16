use tauri::State;

use crate::store::settings::{AppSettings, SettingsStore};

#[tauri::command]
pub async fn get_settings(store: State<'_, SettingsStore>) -> Result<AppSettings, String> {
    Ok(store.get().await)
}

#[tauri::command]
pub async fn update_settings(
    settings: AppSettings,
    store: State<'_, SettingsStore>,
) -> Result<AppSettings, String> {
    let updated = store.update(settings).await?;
    log::info!("Settings updated");
    Ok(updated)
}
