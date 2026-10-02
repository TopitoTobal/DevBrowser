use std::collections::BTreeSet;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;
use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, WebviewUrl, Window,
};

/// Puertos donde suelen correr dev servers (Vite, Next, Rails, Django, ...).
const COMMON_PORTS: &[u16] = &[
    3000, 3001, 3002, 4000, 4200, 4201, 5000, 5001, 5173, 5174, 8000, 8001, 8080, 8081, 8443, 8888,
    9000, 9001, 1420, 5175, 1080, 1234, 24678, 3306, 4567,
];

/// Handshake TCP sin enviar datos: basta con que el puerto acepte la conexión.
const PROBE_TIMEOUT: Duration = Duration::from_millis(150);

fn candidate_ports(known: &[u16]) -> BTreeSet<u16> {
    known
        .iter()
        .copied()
        .filter(|port| *port > 0)
        .chain(COMMON_PORTS.iter().copied())
        .collect()
}

#[tauri::command]
async fn scan_local_servers(known: Vec<u16>) -> Result<Vec<u16>, String> {
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0);
    let mut open = Vec::new();
    let mut set = tokio::task::JoinSet::new();

    for port in candidate_ports(&known) {
        set.spawn(async move {
            let target = SocketAddr::new(addr.ip(), port);
            tokio::time::timeout(PROBE_TIMEOUT, tokio::net::TcpStream::connect(target))
                .await
                .is_ok_and(|result| result.is_ok())
                .then_some(port)
        });
    }

    while let Some(joined) = set.join_next().await {
        if let Ok(Some(port)) = joined {
            open.push(port);
        }
    }

    open.sort_unstable();
    Ok(open)
}

fn label_for(tab_id: &str) -> String {
    format!("tab-{tab_id}")
}

fn parse_external_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|e| format!("URL inválida: {e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        other => Err(format!("Esquema no permitido: '{other}' (solo http/https)")),
    }
}

fn get_webview(app: &AppHandle, tab_id: &str) -> Result<tauri::Webview, String> {
    app.get_webview(&label_for(tab_id))
        .ok_or_else(|| format!("No existe un webview para la pestaña {tab_id}"))
}

fn eval_in_webview(app: &AppHandle, tab_id: &str, js: &str) -> Result<(), String> {
    get_webview(app, tab_id)?
        .eval(js)
        .map_err(|e| e.to_string())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn webview_create(
    window: Window,
    tab_id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = label_for(&tab_id);
    if window.get_webview(&label).is_some() {
        return Ok(());
    }
    let parsed = parse_external_url(&url)?;

    let app = window.app_handle().clone();
    let builder = WebviewBuilder::new(label, WebviewUrl::External(parsed))
        .on_navigation(|url| matches!(url.scheme(), "http" | "https"))
        .on_page_load(move |webview, payload| {
            let phase = match payload.event() {
                PageLoadEvent::Started => "started",
                PageLoadEvent::Finished => "finished",
            };
            let webview_label = webview.label();
            let tab_id = webview_label.strip_prefix("tab-").unwrap_or(webview_label);
            let _ = app.emit(
                "page-load",
                serde_json::json!({ "tabId": tab_id, "phase": phase }),
            );
        });

    window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| format!("No se pudo crear el webview: {e}"))?;
    Ok(())
}

#[tauri::command]
fn webview_navigate(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let parsed = parse_external_url(&url)?;
    get_webview(&app, &tab_id)?
        .navigate(parsed)
        .map_err(|e| format!("Error al navegar: {e}"))
}

#[tauri::command]
fn webview_set_bounds(
    app: AppHandle,
    tab_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview = get_webview(&app, &tab_id)?;
    webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn webview_show(app: AppHandle, tab_id: String) -> Result<(), String> {
    get_webview(&app, &tab_id)?
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn webview_hide(app: AppHandle, tab_id: String) -> Result<(), String> {
    get_webview(&app, &tab_id)?
        .hide()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn webview_remove(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label_for(&tab_id)) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn webview_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    eval_in_webview(&app, &tab_id, "location.reload()")
}

#[tauri::command]
fn webview_go_back(app: AppHandle, tab_id: String) -> Result<(), String> {
    eval_in_webview(&app, &tab_id, "history.back()")
}

#[tauri::command]
fn webview_go_forward(app: AppHandle, tab_id: String) -> Result<(), String> {
    eval_in_webview(&app, &tab_id, "history.forward()")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            webview_create,
            webview_navigate,
            webview_set_bounds,
            webview_show,
            webview_hide,
            webview_remove,
            webview_reload,
            webview_go_back,
            webview_go_forward,
            scan_local_servers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_merge_known_and_common_ports_without_duplicates() {
        let candidates = candidate_ports(&[5173, 9999]);
        assert!(candidates.contains(&5173));
        assert!(candidates.contains(&9999));
        assert!(candidates.contains(&3000));
        assert_eq!(
            candidates.len(),
            candidates
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len()
        );
    }

    #[test]
    fn candidates_drop_out_of_range_known_ports() {
        assert!(!candidate_ports(&[0]).contains(&0));
    }

    #[test]
    fn scan_detects_a_listening_port() {
        tauri::async_runtime::block_on(async {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
                .await
                .expect("bind");
            let port = listener.local_addr().expect("addr").port();
            let found = scan_local_servers(vec![port]).await.expect("scan");
            assert!(
                found.contains(&port),
                "no se detectó el puerto {port}: {found:?}"
            );
            assert!(
                found.windows(2).all(|w| w[0] < w[1]),
                "sin ordenar: {found:?}"
            );
        });
    }
}
