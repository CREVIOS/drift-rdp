use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;

use ironrdp::connector::{self, ClientConnector, ConnectionResult, Credentials, ServerName};
use ironrdp_tokio::reqwest::ReqwestNetworkClient;
use ironrdp_tokio::TokioFramed;

use crate::rdp::clipboard::SessionClipboardBackend;
use crate::store::connections::ConnectionConfig;

/// Commands that can be sent to a running session actor.
#[derive(Debug)]
pub enum SessionCommand {
    SendKey {
        key_code: u32,
        is_down: bool,
    },
    SendMouse {
        x: i32,
        y: i32,
        button: Option<String>,
        event_type: String,
        scroll_delta: i32,
    },
    Resize {
        width: u32,
        height: u32,
    },
    ClipboardWrite {
        text: String,
    },
    Disconnect,
}

/// RDP connection error.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdpError(pub String);

impl std::fmt::Display for RdpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for RdpError {}

/// The framed TLS stream type used after TLS upgrade.
pub type TlsFramed = TokioFramed<ironrdp_tls::TlsStream<TcpStream>>;

/// Outcome of the RDP connection attempt.
pub enum ConnectionOutcome {
    /// Real IronRDP connection established.
    RealSession {
        connection_result: ConnectionResult,
        framed: TlsFramed,
    },
    /// Connection failed; reason provided.
    Failed(String),
}

/// Attempt a TCP connection to the RDP server.
pub async fn tcp_connect(host: &str, port: u16) -> Result<TcpStream, RdpError> {
    let addr = format!("{}:{}", host, port);
    let stream = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        TcpStream::connect(&addr),
    )
    .await
    .map_err(|_| RdpError(format!("TCP connection to {} timed out", addr)))?
    .map_err(|e| RdpError(format!("TCP connection to {} failed: {}", addr, e)))?;

    log::info!("TCP connected to {}", addr);
    Ok(stream)
}

/// Build the IronRDP connector Config.
fn build_connector_config(
    config: &ConnectionConfig,
    password: &str,
    width: u32,
    height: u32,
) -> connector::Config {
    use ironrdp::pdu::gcc::KeyboardType;
    use ironrdp::pdu::rdp::capability_sets::MajorPlatformType;
    use ironrdp::pdu::rdp::client_info::{PerformanceFlags, TimezoneInfo};

    let domain = if config.domain.is_empty() {
        None
    } else {
        Some(config.domain.clone())
    };

    let performance_flags = PerformanceFlags::DISABLE_WALLPAPER
        | PerformanceFlags::DISABLE_FULLWINDOWDRAG
        | PerformanceFlags::DISABLE_MENUANIMATIONS
        | PerformanceFlags::DISABLE_THEMING
        | PerformanceFlags::DISABLE_CURSOR_SHADOW;

    connector::Config {
        credentials: Credentials::UsernamePassword {
            username: config.username.clone(),
            password: password.to_string(),
        },
        domain,
        enable_tls: true,
        enable_credssp: true,
        keyboard_type: KeyboardType::IbmEnhanced,
        keyboard_subtype: 0,
        keyboard_layout: 0,
        keyboard_functional_keys_count: 12,
        ime_file_name: String::new(),
        dig_product_id: String::new(),
        desktop_size: connector::DesktopSize {
            width: width as u16,
            height: height as u16,
        },
        desktop_scale_factor: 0,
        bitmap: None,
        client_build: 0,
        client_name: "rdp-client".to_owned(),
        client_dir: "C:\\Windows\\System32\\mstscax.dll".to_owned(),
        #[cfg(target_os = "macos")]
        platform: MajorPlatformType::MACINTOSH,
        #[cfg(target_os = "linux")]
        platform: MajorPlatformType::UNIX,
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        platform: MajorPlatformType::UNSPECIFIED,
        enable_server_pointer: true,
        request_data: None,
        autologon: false,
        enable_audio_playback: false,
        pointer_software_rendering: true,
        performance_flags,
        hardware_id: None,
        license_cache: None,
        timezone_info: TimezoneInfo::default(),
    }
}

/// Attempt to establish an IronRDP session.
///
/// Follows the exact same pattern as the official IronRDP client:
/// 1. TCP connect
/// 2. connect_begin (X.224 negotiation)
/// 3. TLS upgrade via ironrdp_tls::upgrade (preserving leftover bytes)
/// 4. connect_finalize (CredSSP/NLA + MCS/licensing/capabilities)
pub async fn attempt_rdp_connection(
    config: &ConnectionConfig,
    password: Option<&str>,
    width: u32,
    height: u32,
) -> ConnectionOutcome {
    let password = password.unwrap_or_default();

    // Step 1: TCP connect
    let tcp_stream = match tcp_connect(&config.host, config.port).await {
        Ok(s) => s,
        Err(e) => {
            log::warn!("TCP connection failed: {}", e);
            return ConnectionOutcome::Failed(e.0);
        }
    };

    // Step 2: Create ClientConnector and begin negotiation
    let connector_config = build_connector_config(config, password, width, height);
    let client_addr = tcp_stream
        .local_addr()
        .unwrap_or_else(|_| std::net::SocketAddr::from(([0, 0, 0, 0], 0)));
    let mut connector = ClientConnector::new(connector_config, client_addr);
    connector.attach_static_channel(ironrdp::cliprdr::CliprdrClient::new(Box::new(
        SessionClipboardBackend::new(),
    )));

    let mut framed = TokioFramed::new(tcp_stream);

    let should_upgrade = match ironrdp_tokio::connect_begin(&mut framed, &mut connector).await {
        Ok(su) => su,
        Err(e) => {
            log::warn!("RDP negotiation begin failed: {:?}", e);
            return ConnectionOutcome::Failed(format!("RDP negotiation begin failed: {}", e));
        }
    };

    log::info!("RDP X.224 negotiation complete, upgrading to TLS...");

    // Step 3: TLS upgrade — following the official IronRDP client pattern exactly:
    // 1) Extract stream AND leftover bytes from framed
    // 2) Pass stream to ironrdp_tls::upgrade
    // 3) Reconstruct framed with leftover bytes preserved
    let (initial_stream, leftover_bytes) = framed.into_inner();
    log::info!(
        "Starting TLS handshake (leftover={} bytes, server_name='{}')...",
        leftover_bytes.len(),
        config.host
    );

    // Use a dummy DNS name for TLS SNI when connecting via IP address,
    // since rustls ServerName::try_from may fail or cause issues with raw IPs.
    // Certificate verification is disabled anyway (NoCertificateVerification).
    let tls_server_name = if config.host.parse::<std::net::IpAddr>().is_ok() {
        "rdp-server"
    } else {
        &config.host
    };
    log::info!(
        "Using TLS server name: '{}' (original host: '{}')",
        tls_server_name,
        config.host
    );

    // Run TLS in a separate spawned task so timeout can actually cancel it.
    // The TLS handshake can block the executor, preventing tokio::time::timeout from working.
    let tls_name = tls_server_name.to_string();
    let tls_handle = tokio::spawn(async move { do_tls_upgrade(initial_stream, &tls_name).await });

    let tls_result = tokio::time::timeout(std::time::Duration::from_secs(15), tls_handle).await;

    let (tls_stream, tls_cert) = match tls_result {
        Ok(Ok(Ok(result))) => {
            log::info!("TLS handshake completed successfully");
            result
        }
        Ok(Ok(Err(e))) => {
            log::warn!("TLS upgrade failed: {}", e);
            return ConnectionOutcome::Failed(format!("TLS upgrade failed: {}", e));
        }
        Ok(Err(e)) => {
            log::warn!("TLS task panicked: {}", e);
            return ConnectionOutcome::Failed(format!("TLS task panicked: {}", e));
        }
        Err(_) => {
            log::warn!("TLS upgrade timed out after 15 seconds");
            return ConnectionOutcome::Failed("TLS upgrade timed out".to_string());
        }
    };

    // Extract server public key from certificate (needed for CredSSP)
    let server_public_key = match ironrdp_tls::extract_tls_server_public_key(&tls_cert) {
        Some(key) => key.to_vec(),
        None => {
            log::warn!("Failed to extract server public key from TLS certificate");
            return ConnectionOutcome::Failed(
                "Failed to extract server public key from TLS certificate".to_string(),
            );
        }
    };

    log::info!(
        "Server public key extracted ({} bytes)",
        server_public_key.len()
    );

    // Step 4: Mark as upgraded, create type-erased framed with leftover bytes
    let upgraded = ironrdp_tokio::mark_as_upgraded(should_upgrade, &mut connector);

    // Create framed over TLS stream, preserving any leftover bytes
    let mut tls_framed = TokioFramed::new_with_leftover(tls_stream, leftover_bytes);

    let server_name = ServerName::new(config.host.clone());
    let mut network_client = ReqwestNetworkClient::new();

    log::info!("Starting CredSSP/NLA finalization...");

    // Step 5: Finalize connection (CredSSP/NLA + MCS + licensing + capabilities)
    let connection_result = match ironrdp_tokio::connect_finalize(
        upgraded,
        connector,
        &mut tls_framed,
        &mut network_client,
        server_name,
        server_public_key,
        None,
    )
    .await
    {
        Ok(result) => result,
        Err(e) => {
            log::warn!("RDP connection finalize failed: {:?}", e);
            return ConnectionOutcome::Failed(format!("RDP connection finalize failed: {}", e));
        }
    };

    log::info!(
        "RDP connection established! Desktop size: {}x{}",
        connection_result.desktop_size.width,
        connection_result.desktop_size.height
    );

    ConnectionOutcome::RealSession {
        connection_result,
        framed: tls_framed,
    }
}

/// Manual TLS upgrade with step-by-step logging to diagnose where it hangs.
async fn do_tls_upgrade<S>(
    stream: S,
    server_name: &str,
) -> std::io::Result<(ironrdp_tls::TlsStream<S>, x509_cert::Certificate)>
where
    S: Unpin + tokio::io::AsyncRead + tokio::io::AsyncWrite,
{
    use tokio::io::AsyncWriteExt;
    use tokio_rustls::rustls;
    use tokio_rustls::rustls::pki_types::ServerName as RustlsServerName;

    log::info!("[TLS] Step 1: Building rustls config...");
    let mut config = rustls::client::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(std::sync::Arc::new(NoCertVerifier))
        .with_no_client_auth();
    config.key_log = std::sync::Arc::new(rustls::KeyLogFile::new());
    config.resumption = rustls::client::Resumption::disabled();
    let config = std::sync::Arc::new(config);

    log::info!("[TLS] Step 2: Parsing server name '{}'...", server_name);
    let domain =
        RustlsServerName::try_from(server_name.to_owned()).map_err(std::io::Error::other)?;
    log::info!("[TLS] Step 3: ServerName parsed OK: {:?}", domain);

    log::info!("[TLS] Step 4: Starting TLS handshake (TlsConnector::connect)...");
    let mut tls_stream = tokio_rustls::TlsConnector::from(config)
        .connect(domain, stream)
        .await?;
    log::info!("[TLS] Step 5: TLS handshake COMPLETED! Flushing...");

    tls_stream.flush().await?;
    log::info!("[TLS] Step 6: Flush done. Extracting certificate...");

    let tls_cert = {
        use x509_cert::der::Decode as _;
        let cert = tls_stream
            .get_ref()
            .1
            .peer_certificates()
            .and_then(|certs| certs.first())
            .ok_or_else(|| std::io::Error::other("peer certificate is missing"))?;
        x509_cert::Certificate::from_der(cert).map_err(std::io::Error::other)?
    };
    log::info!("[TLS] Step 7: Certificate extracted OK");

    Ok((tls_stream, tls_cert))
}

/// NoCertificateVerification for RDP self-signed certs.
#[derive(Debug)]
struct NoCertVerifier;

impl tokio_rustls::rustls::client::danger::ServerCertVerifier for NoCertVerifier {
    fn verify_server_cert(
        &self,
        _: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _: &[tokio_rustls::rustls::pki_types::CertificateDer<'_>],
        _: &tokio_rustls::rustls::pki_types::ServerName<'_>,
        _: &[u8],
        _: tokio_rustls::rustls::pki_types::UnixTime,
    ) -> Result<tokio_rustls::rustls::client::danger::ServerCertVerified, tokio_rustls::rustls::Error>
    {
        Ok(tokio_rustls::rustls::client::danger::ServerCertVerified::assertion())
    }
    fn verify_tls12_signature(
        &self,
        _: &[u8],
        _: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _: &tokio_rustls::rustls::DigitallySignedStruct,
    ) -> Result<
        tokio_rustls::rustls::client::danger::HandshakeSignatureValid,
        tokio_rustls::rustls::Error,
    > {
        Ok(tokio_rustls::rustls::client::danger::HandshakeSignatureValid::assertion())
    }
    fn verify_tls13_signature(
        &self,
        _: &[u8],
        _: &tokio_rustls::rustls::pki_types::CertificateDer<'_>,
        _: &tokio_rustls::rustls::DigitallySignedStruct,
    ) -> Result<
        tokio_rustls::rustls::client::danger::HandshakeSignatureValid,
        tokio_rustls::rustls::Error,
    > {
        Ok(tokio_rustls::rustls::client::danger::HandshakeSignatureValid::assertion())
    }
    fn supported_verify_schemes(&self) -> Vec<tokio_rustls::rustls::SignatureScheme> {
        use tokio_rustls::rustls::SignatureScheme::*;
        vec![
            RSA_PKCS1_SHA1,
            ECDSA_SHA1_Legacy,
            RSA_PKCS1_SHA256,
            ECDSA_NISTP256_SHA256,
            RSA_PKCS1_SHA384,
            ECDSA_NISTP384_SHA384,
            RSA_PKCS1_SHA512,
            ECDSA_NISTP521_SHA512,
            RSA_PSS_SHA256,
            RSA_PSS_SHA384,
            RSA_PSS_SHA512,
            ED25519,
            ED448,
        ]
    }
}
