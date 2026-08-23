use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Window,
    WebviewUrl,
};

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
    get_webview(app, tab_id)?.eval(js).map_err(|e| e.to_string())
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
    get_webview(&app, &tab_id)?.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn webview_hide(app: AppHandle, tab_id: String) -> Result<(), String> {
    get_webview(&app, &tab_id)?.hide().map_err(|e| e.to_string())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
