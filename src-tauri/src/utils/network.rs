use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::timeout;

/// Test TCP connectivity to a host:port with a timeout.
/// Returns Ok(true) if connection succeeds, Ok(false) if refused, Err on other failures.
pub async fn test_tcp_connection(host: &str, port: u16, timeout_ms: u64) -> Result<bool, String> {
    // Validate host
    if host.trim().is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    if host.len() > 253 {
        return Err("Host exceeds maximum length of 253 characters".to_string());
    }

    let addr = format!("{}:{}", host, port);
    let duration = Duration::from_millis(timeout_ms);

    match timeout(duration, TcpStream::connect(&addr)).await {
        Ok(Ok(_stream)) => Ok(true),
        Ok(Err(e)) => {
            log::warn!("TCP connection to {} failed: {}", addr, e);
            Ok(false)
        }
        Err(_) => {
            log::warn!(
                "TCP connection to {} timed out after {}ms",
                addr,
                timeout_ms
            );
            Ok(false)
        }
    }
}

/// Measure TCP connection latency to a host:port.
/// Returns Some(latency_ms) on success, None on failure/timeout.
pub async fn measure_tcp_latency(
    host: &str,
    port: u16,
    timeout_ms: u64,
) -> Result<Option<u64>, String> {
    if host.trim().is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    if host.len() > 253 {
        return Err("Host exceeds maximum length of 253 characters".to_string());
    }

    let addr = format!("{}:{}", host, port);
    let duration = Duration::from_millis(timeout_ms);
    let start = std::time::Instant::now();

    match timeout(duration, TcpStream::connect(&addr)).await {
        Ok(Ok(_stream)) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Ok(Some(elapsed))
        }
        Ok(Err(_)) => Ok(None),
        Err(_) => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_empty_host() {
        let result = test_tcp_connection("", 3389, 1000).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    #[tokio::test]
    async fn test_long_host() {
        let long_host = "a".repeat(254);
        let result = test_tcp_connection(&long_host, 3389, 1000).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("253"));
    }

    #[tokio::test]
    async fn test_connection_refused() {
        // Port 19876 is unlikely to have anything listening
        let result = test_tcp_connection("127.0.0.1", 19876, 1000).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), false);
    }

    #[tokio::test]
    async fn test_measure_latency_empty_host() {
        let result = measure_tcp_latency("", 3389, 1000).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_measure_latency_refused() {
        let result = measure_tcp_latency("127.0.0.1", 19876, 1000).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }
}
