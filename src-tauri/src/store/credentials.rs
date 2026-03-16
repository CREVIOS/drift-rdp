use keyring::Entry;

const SERVICE_NAME: &str = "com.rdpclient.app";

pub struct CredentialStore;

impl CredentialStore {
    pub fn new() -> Self {
        Self
    }

    pub fn store_password(&self, connection_id: &str, password: &str) -> Result<(), String> {
        let entry = Entry::new(SERVICE_NAME, connection_id)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        entry
            .set_password(password)
            .map_err(|e| format!("Failed to store password in keychain: {}", e))?;
        Ok(())
    }

    pub fn get_password(&self, connection_id: &str) -> Result<Option<String>, String> {
        let entry = Entry::new(SERVICE_NAME, connection_id)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to retrieve password from keychain: {}", e)),
        }
    }

    pub fn delete_password(&self, connection_id: &str) -> Result<(), String> {
        let entry = Entry::new(SERVICE_NAME, connection_id)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already gone, that's fine
            Err(e) => Err(format!("Failed to delete password from keychain: {}", e)),
        }
    }
}

impl Default for CredentialStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires a keyring daemon; run with: cargo test -- --ignored
    fn test_store_and_retrieve_password() {
        let store = CredentialStore::new();
        let id = "test-conn-store-retrieve";
        store.store_password(id, "s3cret!").unwrap();
        let pw = store.get_password(id).unwrap();
        assert_eq!(pw, Some("s3cret!".to_string()));
        // cleanup
        let _ = store.delete_password(id);
    }

    #[test]
    #[ignore] // Requires a keyring daemon; run with: cargo test -- --ignored
    fn test_delete_password() {
        let store = CredentialStore::new();
        let id = "test-conn-delete";
        store.store_password(id, "temp").unwrap();
        store.delete_password(id).unwrap();
        let pw = store.get_password(id).unwrap();
        assert_eq!(pw, None);
    }
}
