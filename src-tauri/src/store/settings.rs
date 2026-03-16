use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_port")]
    pub default_port: u16,
    #[serde(default = "default_true")]
    pub auto_reconnect: bool,
    #[serde(default)]
    pub show_performance_hud: bool,
    #[serde(default)]
    pub sidebar_collapsed: bool,
    #[serde(default = "default_resolution")]
    pub default_resolution: String,
    #[serde(default = "default_color_depth")]
    pub color_depth: u32,
    #[serde(default = "default_quality")]
    pub quality: u32,
    #[serde(default = "default_reconnect_timeout")]
    pub reconnect_timeout: u64,
    #[serde(default = "default_connection_timeout")]
    pub connection_timeout: u64,
}

fn default_theme() -> String {
    "system".to_string()
}

fn default_port() -> u16 {
    3389
}

fn default_true() -> bool {
    true
}

fn default_resolution() -> String {
    "1920x1080".to_string()
}

fn default_color_depth() -> u32 {
    32
}

fn default_quality() -> u32 {
    80
}

fn default_reconnect_timeout() -> u64 {
    5000
}

fn default_connection_timeout() -> u64 {
    30000
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            default_port: default_port(),
            auto_reconnect: true,
            show_performance_hud: false,
            sidebar_collapsed: false,
            default_resolution: default_resolution(),
            color_depth: default_color_depth(),
            quality: default_quality(),
            reconnect_timeout: default_reconnect_timeout(),
            connection_timeout: default_connection_timeout(),
        }
    }
}

pub struct SettingsStore {
    settings: Arc<Mutex<AppSettings>>,
    file_path: PathBuf,
}

impl SettingsStore {
    pub fn new(data_dir: PathBuf) -> Self {
        let file_path = data_dir.join("settings.json");
        let settings = if file_path.exists() {
            match std::fs::read_to_string(&file_path) {
                Ok(data) => match serde_json::from_str::<AppSettings>(&data) {
                    Ok(s) => {
                        log::info!("Loaded settings from disk");
                        s
                    }
                    Err(e) => {
                        log::error!("Failed to parse settings file: {}", e);
                        AppSettings::default()
                    }
                },
                Err(e) => {
                    log::error!("Failed to read settings file: {}", e);
                    AppSettings::default()
                }
            }
        } else {
            AppSettings::default()
        };

        Self {
            settings: Arc::new(Mutex::new(settings)),
            file_path,
        }
    }

    pub async fn get(&self) -> AppSettings {
        self.settings.lock().await.clone()
    }

    pub async fn update(&self, new_settings: AppSettings) -> Result<AppSettings, String> {
        let mut settings = self.settings.lock().await;
        *settings = new_settings.clone();
        drop(settings);
        self.save(&new_settings).await?;
        Ok(new_settings)
    }

    async fn save(&self, settings: &AppSettings) -> Result<(), String> {
        let data = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;

        if let Some(parent) = self.file_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create data directory: {}", e))?;
        }
        tokio::fs::write(&self.file_path, data)
            .await
            .map_err(|e| format!("Failed to save settings: {}", e))?;
        Ok(())
    }
}
