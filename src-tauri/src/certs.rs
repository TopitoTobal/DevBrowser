use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

use rcgen::{
    BasicConstraints, Certificate, CertificateParams, DistinguishedName, DnType, IsCa, Issuer,
    KeyPair, KeyUsagePurpose,
};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use time::{Duration as TimeDuration, OffsetDateTime};

const CA_COMMON_NAME: &str = "DevBrowser Local Development CA";
const CA_CERT_DER_FILE: &str = "devbrowser-ca.cer";
const CA_CERT_PEM_FILE: &str = "devbrowser-ca.pem";
const CA_KEY_FILE: &str = "devbrowser-ca.key";
const LEAF_CERT_FILE: &str = "localhost.crt";
const LEAF_KEY_FILE: &str = "localhost.key";
const CA_VALIDITY_DAYS: i64 = 3650;
const LEAF_VALIDITY_DAYS: i64 = 825;

/// Hosts cubiertos por el certificado hoja. No incluye IPs de LAN: para eso
/// haría falta emitir un certificado por host, como hace mkcert.
const LEAF_HOSTS: &[&str] = &["localhost", "*.localhost", "127.0.0.1", "::1"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalCaStatus {
    pub supported: bool,
    pub installed: bool,
    pub trusted: bool,
    pub common_name: String,
    pub thumbprint: String,
    pub ca_cert_path: String,
    pub ca_cert_pem_path: String,
    pub leaf_cert_path: String,
    pub leaf_key_path: String,
    pub leaf_hosts: Vec<String>,
}

/// CA en memoria: el DER alimenta el almacén de Windows y el PEM se usa para
/// reemitir certificados hoja en instalaciones posteriores.
struct LocalCa {
    der: Vec<u8>,
    pem: String,
    key: KeyPair,
}

fn cert_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo resolver el directorio de datos: {e}"))?;
    Ok(base.join("certs"))
}

fn sha1_hex(der: &[u8]) -> String {
    use sha1::{Digest, Sha1};

    let mut hasher = Sha1::new();
    hasher.update(der);
    hasher
        .finalize()
        .iter()
        .fold(String::with_capacity(40), |mut acc, b| {
            let _ = write!(acc, "{b:02X}");
            acc
        })
}

/// El almacén se consulta por SHA-1 (preciso) y, si no hay thumbprint, por CN
/// para poder limpiar una CA de la que solo conservamos el nombre.
fn store_filter(thumbprint: Option<&str>) -> String {
    thumbprint
        .map(str::to_owned)
        .unwrap_or_else(|| CA_COMMON_NAME.to_owned())
}

#[cfg(target_os = "windows")]
fn store_contains(filter: &str) -> bool {
    Command::new("certutil")
        .args(["-user", "-store", "ROOT", filter])
        .output()
        .is_ok_and(|out| out.status.success())
}

#[cfg(target_os = "windows")]
fn store_add(cert_path: &Path) -> Result<(), String> {
    let out = Command::new("certutil")
        .args(["-user", "-addstore", "-f", "ROOT"])
        .arg(cert_path)
        .output()
        .map_err(|e| format!("No se pudo ejecutar certutil: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "certutil -addstore falló: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ))
    }
}

#[cfg(target_os = "windows")]
fn store_delete(filter: &str) -> Result<(), String> {
    let out = Command::new("certutil")
        .args(["-user", "-delstore", "ROOT", filter])
        .output()
        .map_err(|e| format!("No se pudo ejecutar certutil: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "certutil -delstore falló: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ))
    }
}

#[cfg(not(target_os = "windows"))]
fn store_contains(_filter: &str) -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
fn store_add(_cert_path: &Path) -> Result<(), String> {
    Err("Instalar la CA solo está implementado en Windows".to_owned())
}

#[cfg(not(target_os = "windows"))]
fn store_delete(_filter: &str) -> Result<(), String> {
    Err("Desinstalar la CA solo está implementado en Windows".to_owned())
}

fn distinguished_name(common_name: &str) -> DistinguishedName {
    let mut dn = DistinguishedName::new();
    dn.push(DnType::CommonName, common_name);
    dn.push(DnType::OrganizationName, "DevBrowser");
    dn
}

fn validity(days: i64) -> (OffsetDateTime, OffsetDateTime) {
    let now = OffsetDateTime::now_utc();
    (
        now.saturating_sub(TimeDuration::days(1)),
        now.saturating_add(TimeDuration::days(days)),
    )
}

fn generate_ca() -> Result<LocalCa, String> {
    let mut params = CertificateParams::default();
    params.is_ca = IsCa::Ca(BasicConstraints::Constrained(0));
    params.distinguished_name = distinguished_name(CA_COMMON_NAME);
    params.key_usages = vec![
        KeyUsagePurpose::KeyCertSign,
        KeyUsagePurpose::CrlSign,
        KeyUsagePurpose::DigitalSignature,
    ];
    let (not_before, not_after) = validity(CA_VALIDITY_DAYS);
    params.not_before = not_before;
    params.not_after = not_after;

    let key = KeyPair::generate().map_err(|e| format!("No se pudo generar la clave: {e}"))?;
    let cert = params
        .self_signed(&key)
        .map_err(|e| format!("No se pudo autofirmar la CA: {e}"))?;

    Ok(LocalCa {
        der: cert.der().to_vec(),
        pem: cert.pem(),
        key,
    })
}

fn load_ca(dir: &Path) -> Result<LocalCa, String> {
    let der_path = dir.join(CA_CERT_DER_FILE);
    let pem_path = dir.join(CA_CERT_PEM_FILE);
    let key_path = dir.join(CA_KEY_FILE);

    let der =
        fs::read(&der_path).map_err(|e| format!("No se pudo leer {}: {e}", der_path.display()))?;
    let pem = fs::read_to_string(&pem_path)
        .map_err(|e| format!("No se pudo leer {}: {e}", pem_path.display()))?;
    let key_pem = fs::read_to_string(&key_path)
        .map_err(|e| format!("No se pudo leer {}: {e}", key_path.display()))?;
    let key = KeyPair::from_pem(&key_pem)
        .map_err(|e| format!("La clave privada de la CA no es válida: {e}"))?;

    Ok(LocalCa { der, pem, key })
}

fn generate_leaf(ca: &LocalCa) -> Result<(Certificate, KeyPair), String> {
    let issuer = Issuer::from_ca_cert_pem(&ca.pem, &ca.key)
        .map_err(|e| format!("No se pudo cargar la CA existente: {e}"))?;

    let hosts: Vec<String> = LEAF_HOSTS.iter().map(|h| h.to_string()).collect();
    let mut params = CertificateParams::new(hosts)
        .map_err(|e| format!("No se pudieron preparar los SAN: {e}"))?;
    params.distinguished_name = distinguished_name("localhost");
    params.is_ca = IsCa::NoCa;
    params.key_usages = vec![
        KeyUsagePurpose::DigitalSignature,
        KeyUsagePurpose::KeyEncipherment,
    ];
    params.extended_key_usages = vec![rcgen::ExtendedKeyUsagePurpose::ServerAuth];
    let (not_before, not_after) = validity(LEAF_VALIDITY_DAYS);
    params.not_before = not_before;
    params.not_after = not_after;

    let key = KeyPair::generate().map_err(|e| format!("No se pudo generar la clave: {e}"))?;
    let cert = params
        .signed_by(&key, &issuer)
        .map_err(|e| format!("No se pudo firmar el certificado: {e}"))?;

    Ok((cert, key))
}

/// Escribe el material que consume el dev server: PEM para el cert y la key,
/// que es lo que espera `server.https` de Vite o `SSL_CERT_FILE` de Node.
fn write_leaf(dir: &Path, leaf: &Certificate, leaf_key: &KeyPair) -> Result<(), String> {
    write_file(&dir.join(LEAF_CERT_FILE), leaf.pem().as_bytes())?;
    write_file(
        &dir.join(LEAF_KEY_FILE),
        leaf_key.serialize_pem().as_bytes(),
    )
}

fn write_file(path: &Path, contents: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("No se pudo crear {}: {e}", parent.display()))?;
    }
    fs::write(path, contents).map_err(|e| format!("No se pudo escribir {}: {e}", path.display()))
}

fn thumbprint_of(path: &Path) -> Option<String> {
    let der = fs::read(path).ok()?;
    (!der.is_empty()).then(|| sha1_hex(&der))
}

fn status_from(dir: &Path) -> LocalCaStatus {
    let ca_der = dir.join(CA_CERT_DER_FILE);
    let thumbprint = thumbprint_of(&ca_der);
    LocalCaStatus {
        supported: cfg!(target_os = "windows"),
        installed: ca_der.is_file(),
        trusted: thumbprint.as_deref().is_some_and(store_contains),
        common_name: CA_COMMON_NAME.to_owned(),
        thumbprint: thumbprint.unwrap_or_default(),
        ca_cert_path: ca_der.to_string_lossy().into_owned(),
        ca_cert_pem_path: dir.join(CA_CERT_PEM_FILE).to_string_lossy().into_owned(),
        leaf_cert_path: dir.join(LEAF_CERT_FILE).to_string_lossy().into_owned(),
        leaf_key_path: dir.join(LEAF_KEY_FILE).to_string_lossy().into_owned(),
        leaf_hosts: LEAF_HOSTS.iter().map(|h| h.to_string()).collect(),
    }
}

#[tauri::command]
pub fn local_ca_status(app: AppHandle) -> Result<LocalCaStatus, String> {
    let dir = cert_dir(&app)?;
    Ok(status_from(&dir))
}

/// Genera la CA si no existe, la instala en el almacén ROOT del usuario actual
/// (sin privilegios de administrador) y emite el certificado hoja para
/// localhost. Es idempotente: si la CA ya está en disco se reutiliza y solo se
/// regenera el certificado hoja.
#[tauri::command]
pub fn local_ca_install(app: AppHandle) -> Result<LocalCaStatus, String> {
    let dir = cert_dir(&app)?;
    let ca = match load_ca(&dir) {
        Ok(ca) => ca,
        Err(_) => generate_ca()?,
    };

    let ca_der_path = dir.join(CA_CERT_DER_FILE);
    write_file(&ca_der_path, &ca.der)?;
    write_file(&dir.join(CA_CERT_PEM_FILE), ca.pem.as_bytes())?;
    write_file(&dir.join(CA_KEY_FILE), ca.key.serialize_pem().as_bytes())?;

    let thumbprint = sha1_hex(&ca.der);
    // Una CA anterior con el mismo CN puede seguir en el store (p. ej. si se
    // borraron los archivos sin desinstalar). Windows encadenaría el leaf
    // contra ella y el handshake fallaría, así que se limpia antes de instalar.
    if store_contains(CA_COMMON_NAME) && !store_contains(&thumbprint) {
        store_delete(CA_COMMON_NAME)?;
    }
    if !store_contains(&thumbprint) {
        store_add(&ca_der_path)?;
    }

    let (leaf, leaf_key) = generate_leaf(&ca)?;
    write_leaf(&dir, &leaf, &leaf_key)?;

    Ok(status_from(&dir))
}

#[tauri::command]
pub fn local_ca_remove(app: AppHandle) -> Result<LocalCaStatus, String> {
    let dir = cert_dir(&app)?;

    // Primero fuera del almacén: si luego fallara el borrado de archivos, la CA
    // ya no es confiable y solo quedan archivos huérfanos.
    let thumbprint = thumbprint_of(&dir.join(CA_CERT_DER_FILE));
    if thumbprint.as_deref().is_some_and(store_contains) {
        store_delete(&store_filter(thumbprint.as_deref()))?;
    }

    for file in [
        CA_CERT_DER_FILE,
        CA_CERT_PEM_FILE,
        CA_KEY_FILE,
        LEAF_CERT_FILE,
        LEAF_KEY_FILE,
    ] {
        let path = dir.join(file);
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("No se pudo borrar {}: {e}", path.display()))?;
        }
    }

    Ok(status_from(&dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "devbrowser-certs-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn sha1_matches_the_standard_test_vector() {
        assert_eq!(sha1_hex(b"abc"), "A9993E364706816ABA3E25717850C26C9CD0D89D");
    }

    #[test]
    fn store_filter_prefers_thumbprint_and_falls_back_to_common_name() {
        assert_eq!(store_filter(Some("AABBCC")), "AABBCC");
        assert_eq!(store_filter(None), CA_COMMON_NAME);
    }

    #[test]
    fn a_missing_or_empty_ca_has_no_thumbprint() {
        let dir = temp_dir();
        assert_eq!(thumbprint_of(&dir.join(CA_CERT_DER_FILE)), None);
        let empty = dir.join(CA_CERT_DER_FILE);
        write_file(&empty, b"").expect("escribir archivo vacío");
        assert_eq!(thumbprint_of(&empty), None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ca_survives_a_write_read_cycle() {
        let dir = temp_dir();
        let ca = generate_ca().expect("generar CA");

        write_file(&dir.join(CA_CERT_DER_FILE), &ca.der).expect("escribir DER");
        write_file(&dir.join(CA_CERT_PEM_FILE), ca.pem.as_bytes()).expect("escribir PEM");
        write_file(&dir.join(CA_KEY_FILE), ca.key.serialize_pem().as_bytes())
            .expect("escribir clave");

        // El thumbprint del archivo coincide con el del DER en memoria.
        assert_eq!(
            thumbprint_of(&dir.join(CA_CERT_DER_FILE)).as_deref(),
            Some(sha1_hex(&ca.der).as_str())
        );
        // load_ca reconstruye una CA utilizable a partir de los archivos.
        let reloaded = load_ca(&dir).expect("recargar CA");
        assert_eq!(reloaded.der, ca.der);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn leaf_uses_its_own_key_and_is_issued_by_the_ca() {
        let ca = generate_ca().expect("generar CA");
        let (leaf, leaf_key) = generate_leaf(&ca).expect("generar hoja");
        let leaf_der = leaf.der().to_vec();

        assert_ne!(
            leaf_key.public_key_pem(),
            ca.key.public_key_pem(),
            "el leaf no debe reutilizar la clave de la CA"
        );
        // El CN de la CA queda embebido en el campo issuer del leaf.
        assert!(
            leaf_der
                .windows(CA_COMMON_NAME.len())
                .any(|w| w == CA_COMMON_NAME.as_bytes()),
            "el issuer del leaf debe ser la CA generada"
        );
        // Los SAN del leaf cubren todos los hosts declarados: los nombres van
        // como ASCII y las IP en binario.
        for host in LEAF_HOSTS {
            let expected: Vec<u8> = match host.parse::<std::net::IpAddr>() {
                Ok(std::net::IpAddr::V4(ip)) => ip.octets().to_vec(),
                Ok(std::net::IpAddr::V6(ip)) => ip.octets().to_vec(),
                Err(_) => host.replace('*', "").into_bytes(),
            };
            assert!(contains(&leaf_der, &expected), "falta el SAN {host}");
        }
    }

    fn contains(haystack: &[u8], needle: &[u8]) -> bool {
        !needle.is_empty()
            && haystack
                .windows(needle.len())
                .any(|window| window == needle)
    }

    #[test]
    fn leaf_can_be_reissued_from_a_ca_loaded_from_disk() {
        let dir = temp_dir();
        let ca = generate_ca().expect("generar CA");
        write_file(&dir.join(CA_CERT_DER_FILE), &ca.der).expect("escribir DER");
        write_file(&dir.join(CA_CERT_PEM_FILE), ca.pem.as_bytes()).expect("escribir PEM");
        write_file(&dir.join(CA_KEY_FILE), ca.key.serialize_pem().as_bytes())
            .expect("escribir clave");

        let reloaded = load_ca(&dir).expect("recargar CA");
        assert!(
            generate_leaf(&reloaded).is_ok(),
            "una CA recargada debe poder emitir leafs"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    /// Ruta de humo manual: genera la CA, la instala en el almacén ROOT del
    /// usuario y deja los archivos en `target/certs-smoke` para levantar un
    /// servidor https y comprobar el handshake. Es `#[ignore]` porque muta el
    /// almacén de certificados: ejecutar con `cargo test -- --ignored` y
    /// limpiar después con `local_ca_remove_smoke`.
    #[test]
    #[ignore = "modifica el almacén ROOT del usuario; ejecución manual"]
    fn local_ca_install_smoke() {
        let dir = std::path::Path::new("target")
            .join("certs-smoke")
            .to_path_buf();
        let _ = fs::remove_dir_all(&dir);
        // Limpia cualquier CA de pruebas anteriores: dos CAs con el mismo CN en
        // el store hacen que Windows encadene el leaf contra la equivocada.
        if store_contains(CA_COMMON_NAME) {
            store_delete(CA_COMMON_NAME).expect("limpiar CA previa");
        }
        let ca = generate_ca().expect("generar CA");

        write_file(&dir.join(CA_CERT_DER_FILE), &ca.der).expect("escribir DER");
        write_file(&dir.join(CA_CERT_PEM_FILE), ca.pem.as_bytes()).expect("escribir PEM");
        write_file(&dir.join(CA_KEY_FILE), ca.key.serialize_pem().as_bytes())
            .expect("escribir clave");

        let (leaf, leaf_key) = generate_leaf(&ca).expect("generar hoja");
        write_leaf(&dir, &leaf, &leaf_key).expect("escribir material del leaf");

        store_add(&dir.join(CA_CERT_DER_FILE)).expect("instalar CA");
        let thumbprint = sha1_hex(&ca.der);
        assert!(
            store_contains(&thumbprint),
            "la CA no aparece en el almacén después de instalarla"
        );
        println!("thumbprint: {thumbprint}");
    }

    /// Limpia lo que dejó `local_ca_install_smoke`.
    #[test]
    #[ignore = "modifica el almacén ROOT del usuario; ejecución manual"]
    fn local_ca_remove_smoke() {
        let dir = std::path::Path::new("target").join("certs-smoke");
        let thumbprint = thumbprint_of(&dir.join(CA_CERT_DER_FILE));
        if let Some(thumbprint) = thumbprint.as_deref() {
            if store_contains(thumbprint) {
                store_delete(thumbprint).expect("desinstalar CA");
            }
        }
        // Cualquier resto con el mismo CN también se va.
        if store_contains(CA_COMMON_NAME) {
            store_delete(CA_COMMON_NAME).expect("limpiar restos");
        }
        assert!(!store_contains(CA_COMMON_NAME), "la CA sigue en el almacén");
        let _ = fs::remove_dir_all(&dir);
    }
}
