use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub color_accent: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub display_width: Option<u32>,
    #[serde(default)]
    pub display_height: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub last_connected_at: Option<DateTime<Utc>>,
}

/// Input type for creating/updating connections (no id or timestamps).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInput {
    pub name: String,
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub color_accent: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub display_width: Option<u32>,
    #[serde(default)]
    pub display_height: Option<u32>,
    #[serde(default)]
    pub password: Option<String>,
}

fn default_port() -> u16 {
    3389
}

pub struct ConnectionStore {
    connections: Arc<Mutex<HashMap<String, ConnectionConfig>>>,
    file_path: PathBuf,
}

impl ConnectionStore {
    pub fn new(data_dir: PathBuf) -> Self {
        let file_path = data_dir.join("connections.json");
        let connections = if file_path.exists() {
            match std::fs::read_to_string(&file_path) {
                Ok(data) => match serde_json::from_str::<Vec<ConnectionConfig>>(&data) {
                    Ok(list) => {
                        let map: HashMap<String, ConnectionConfig> =
                            list.into_iter().map(|c| (c.id.clone(), c)).collect();
                        log::info!("Loaded {} connections from disk", map.len());
                        map
                    }
                    Err(e) => {
                        log::error!("Failed to parse connections file: {}", e);
                        HashMap::new()
                    }
                },
                Err(e) => {
                    log::error!("Failed to read connections file: {}", e);
                    HashMap::new()
                }
            }
        } else {
            HashMap::new()
        };

        Self {
            connections: Arc::new(Mutex::new(connections)),
            file_path,
        }
    }

    pub async fn list(&self) -> Vec<ConnectionConfig> {
        let conns = self.connections.lock().await;
        let mut list: Vec<ConnectionConfig> = conns.values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }

    pub async fn get(&self, id: &str) -> Option<ConnectionConfig> {
        let conns = self.connections.lock().await;
        conns.get(id).cloned()
    }

    pub async fn create(&self, input: ConnectionInput) -> Result<ConnectionConfig, String> {
        let now = Utc::now();
        let config = ConnectionConfig {
            id: Uuid::new_v4().to_string(),
            name: input.name,
            host: input.host,
            port: input.port,
            username: input.username,
            domain: input.domain,
            color_accent: input.color_accent,
            tags: input.tags,
            display_width: input.display_width,
            display_height: input.display_height,
            created_at: now,
            updated_at: now,
            last_connected_at: None,
        };

        let mut conns = self.connections.lock().await;
        conns.insert(config.id.clone(), config.clone());
        drop(conns);
        self.save().await?;
        Ok(config)
    }

    pub async fn update(
        &self,
        id: &str,
        input: ConnectionInput,
    ) -> Result<Option<ConnectionConfig>, String> {
        let mut conns = self.connections.lock().await;
        if let Some(existing) = conns.get_mut(id) {
            existing.name = input.name;
            existing.host = input.host;
            existing.port = input.port;
            existing.username = input.username;
            existing.domain = input.domain;
            existing.color_accent = input.color_accent;
            existing.tags = input.tags;
            existing.display_width = input.display_width;
            existing.display_height = input.display_height;
            existing.updated_at = Utc::now();
            let updated = existing.clone();
            drop(conns);
            self.save().await?;
            Ok(Some(updated))
        } else {
            Ok(None)
        }
    }

    pub async fn delete(&self, id: &str) -> Result<bool, String> {
        let mut conns = self.connections.lock().await;
        let removed = conns.remove(id).is_some();
        drop(conns);
        if removed {
            self.save().await?;
        }
        Ok(removed)
    }

    pub async fn update_last_connected(&self, id: &str) -> Result<(), String> {
        let mut conns = self.connections.lock().await;
        if let Some(conn) = conns.get_mut(id) {
            conn.last_connected_at = Some(Utc::now());
            drop(conns);
            self.save().await?;
        }
        Ok(())
    }

    async fn save(&self) -> Result<(), String> {
        let conns = self.connections.lock().await;
        let list: Vec<&ConnectionConfig> = conns.values().collect();
        let data = serde_json::to_string_pretty(&list)
            .map_err(|e| format!("Failed to serialize connections: {}", e))?;
        drop(conns);

        if let Some(parent) = self.file_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create data directory: {}", e))?;
        }
        tokio::fs::write(&self.file_path, data)
            .await
            .map_err(|e| format!("Failed to save connections: {}", e))?;
        Ok(())
    }
}

/// Parse a .rdp file and extract connection info.
pub fn parse_rdp_file(path: &str) -> Result<ConnectionInput, String> {
    // File size check (max 1MB)
    let metadata =
        std::fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    if metadata.len() > 1_048_576 {
        return Err("RDP file exceeds maximum size of 1MB".to_string());
    }

    let content =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let mut host = String::new();
    let mut port: u16 = 3389;
    let mut username = String::new();
    let mut domain = String::new();
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // RDP file format: "key:type:value"
        let parts: Vec<&str> = line.splitn(3, ':').collect();
        if parts.len() < 3 {
            continue;
        }

        let key = parts[0].trim();
        let value = parts[2].trim();

        match key {
            "full address" => {
                // May contain host:port
                if let Some((h, p)) = value.rsplit_once(':') {
                    host = h.to_string();
                    port = p.parse().unwrap_or(3389);
                } else {
                    host = value.to_string();
                }
            }
            "username" => username = value.to_string(),
            "domain" => domain = value.to_string(),
            "desktopwidth" => width = value.parse().ok(),
            "desktopheight" => height = value.parse().ok(),
            _ => {}
        }
    }

    if host.is_empty() {
        return Err("No host found in .rdp file".to_string());
    }

    let name = format!("{} (imported)", host);

    Ok(ConnectionInput {
        name,
        host,
        port,
        username,
        domain,
        color_accent: None,
        tags: vec!["imported".to_string()],
        display_width: width,
        display_height: height,
        password: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_temp_rdp(content: &str) -> tempfile::NamedTempFile {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(content.as_bytes()).unwrap();
        f.flush().unwrap();
        f
    }

    #[test]
    fn test_parse_valid_rdp_file() {
        let f = write_temp_rdp(
            "full address:s:server.example.com\n\
             username:s:admin\n\
             domain:s:CORP\n",
        );
        let result = parse_rdp_file(f.path().to_str().unwrap()).unwrap();
        assert_eq!(result.host, "server.example.com");
        assert_eq!(result.port, 3389);
        assert_eq!(result.username, "admin");
        assert_eq!(result.domain, "CORP");
    }

    #[test]
    fn test_parse_rdp_file_with_port_in_address() {
        let f = write_temp_rdp("full address:s:myhost:3390\n");
        let result = parse_rdp_file(f.path().to_str().unwrap()).unwrap();
        assert_eq!(result.host, "myhost");
        assert_eq!(result.port, 3390);
    }

    #[test]
    fn test_parse_rdp_file_missing_host() {
        let f = write_temp_rdp("username:s:admin\n");
        let result = parse_rdp_file(f.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No host"));
    }

    #[test]
    fn test_parse_rdp_file_empty() {
        let f = write_temp_rdp("");
        let result = parse_rdp_file(f.path().to_str().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_rdp_file_with_resolution() {
        let f = write_temp_rdp(
            "full address:s:host.local\n\
             desktopwidth:i:1920\n\
             desktopheight:i:1080\n",
        );
        let result = parse_rdp_file(f.path().to_str().unwrap()).unwrap();
        assert_eq!(result.display_width, Some(1920));
        assert_eq!(result.display_height, Some(1080));
    }

    #[tokio::test]
    async fn test_create_and_list() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConnectionStore::new(dir.path().to_path_buf());
        let input = ConnectionInput {
            name: "Test".into(),
            host: "host1".into(),
            port: 3389,
            username: "user".into(),
            domain: String::new(),
            color_accent: None,
            tags: vec![],
            display_width: None,
            display_height: None,
            password: None,
        };
        store.create(input).await.unwrap();
        let list = store.list().await;
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Test");
    }

    #[tokio::test]
    async fn test_create_and_get() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConnectionStore::new(dir.path().to_path_buf());
        let input = ConnectionInput {
            name: "MyConn".into(),
            host: "myhost".into(),
            port: 3390,
            username: "admin".into(),
            domain: "DOM".into(),
            color_accent: None,
            tags: vec!["tag1".into()],
            display_width: Some(1920),
            display_height: Some(1080),
            password: None,
        };
        let created = store.create(input).await.unwrap();
        let fetched = store.get(&created.id).await.unwrap();
        assert_eq!(fetched.name, "MyConn");
        assert_eq!(fetched.host, "myhost");
        assert_eq!(fetched.port, 3390);
        assert_eq!(fetched.username, "admin");
        assert_eq!(fetched.domain, "DOM");
        assert_eq!(fetched.display_width, Some(1920));
    }

    #[tokio::test]
    async fn test_update_connection() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConnectionStore::new(dir.path().to_path_buf());
        let input = ConnectionInput {
            name: "Old".into(),
            host: "old-host".into(),
            port: 3389,
            username: String::new(),
            domain: String::new(),
            color_accent: None,
            tags: vec![],
            display_width: None,
            display_height: None,
            password: None,
        };
        let created = store.create(input).await.unwrap();
        let update_input = ConnectionInput {
            name: "New".into(),
            host: "new-host".into(),
            port: 3390,
            username: "newuser".into(),
            domain: String::new(),
            color_accent: None,
            tags: vec![],
            display_width: None,
            display_height: None,
            password: None,
        };
        let updated = store
            .update(&created.id, update_input)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(updated.name, "New");
        assert_eq!(updated.host, "new-host");
        assert_eq!(updated.port, 3390);
        assert_eq!(updated.username, "newuser");
    }

    #[tokio::test]
    async fn test_delete_connection() {
        let dir = tempfile::tempdir().unwrap();
        let store = ConnectionStore::new(dir.path().to_path_buf());
        let input = ConnectionInput {
            name: "ToDelete".into(),
            host: "host".into(),
            port: 3389,
            username: String::new(),
            domain: String::new(),
            color_accent: None,
            tags: vec![],
            display_width: None,
            display_height: None,
            password: None,
        };
        let created = store.create(input).await.unwrap();
        let deleted = store.delete(&created.id).await.unwrap();
        assert!(deleted);
        let list = store.list().await;
        assert!(list.is_empty());
    }
}
