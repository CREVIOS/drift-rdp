use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshHost {
    pub name: String,
    pub hostname: String,
    pub port: Option<u16>,
    pub user: Option<String>,
}

/// Locate the user's SSH config file (~/.ssh/config).
fn ssh_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    Ok(home.join(".ssh").join("config"))
}

/// Parse ~/.ssh/config and return a list of SSH hosts.
pub fn parse_ssh_config() -> Result<Vec<SshHost>, String> {
    let path = ssh_config_path()?;
    if !path.exists() {
        return Err(format!("SSH config not found at {:?}", path));
    }

    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read SSH config: {}", e))?;

    let mut hosts: Vec<SshHost> = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_hostname: Option<String> = None;
    let mut current_port: Option<u16> = None;
    let mut current_user: Option<String> = None;

    for line in content.lines() {
        let line = line.trim();

        // Skip comments and empty lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Split on first whitespace or '='
        let (key, value) = match line.split_once(|c: char| c.is_whitespace() || c == '=') {
            Some((k, v)) => (k.trim().to_lowercase(), v.trim().to_string()),
            None => continue,
        };

        if key == "host" {
            // Flush previous host if it has a hostname
            if let (Some(name), Some(hostname)) = (&current_name, &current_hostname) {
                hosts.push(SshHost {
                    name: name.clone(),
                    hostname: hostname.clone(),
                    port: current_port,
                    user: current_user.clone(),
                });
            }

            // Skip wildcard hosts
            if value.contains('*') || value.contains('?') {
                current_name = None;
                current_hostname = None;
                current_port = None;
                current_user = None;
            } else {
                current_name = Some(value);
                current_hostname = None;
                current_port = None;
                current_user = None;
            }
        } else if current_name.is_some() {
            match key.as_str() {
                "hostname" => current_hostname = Some(value),
                "port" => current_port = value.parse().ok(),
                "user" => current_user = Some(value),
                _ => {}
            }
        }
    }

    // Flush the last host
    if let (Some(name), Some(hostname)) = (&current_name, &current_hostname) {
        hosts.push(SshHost {
            name: name.clone(),
            hostname: hostname.clone(),
            port: current_port,
            user: current_user.clone(),
        });
    }

    Ok(hosts)
}
