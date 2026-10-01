// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};

use serde::Serialize;
use tauri::webview::{PageLoadEvent, WebviewBuilder};
use tauri::WebviewUrl;
use tauri::window::Color;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url};

const MAIN_WINDOW: &str = "main";

/// Injected into every content webview. Collects resource level failures so the
/// shell can report basic network problems back to the UI.
const INIT_SCRIPT: &str = r#"
window.__devbrowser = { resourceErrors: [] };
window.addEventListener('error', function (e) {
  if (e && e.target && e.target !== window && e.target.href) {
    window.__devbrowser.resourceErrors.push(String(e.target.href));
  }
}, true);
"#;

/// Runs once a page finished loading to read state the Rust side cannot get
/// natively. `eval_with_callback` serializes the return value as JSON.
const PROBE_JS: &str = r#"
(function () {
  var errs = (window.__devbrowser && window.__devbrowser.resourceErrors) || [];
  var body = document.body;
  return JSON.stringify({
    href: String(location.href),
    title: String(document.title || ''),
    textLen: body ? String(body.innerText || '').trim().length : 0,
    resourceErrors: errs.slice(0, 5)
  });
})()
"#;

/// Per tab navigation history. Tauri exposes no go_back/go_forward, so the
/// browser keeps its own stack and navigates explicitly.
#[derive(Default)]
struct TabHistory {
    entries: Vec<String>,
    index: Option<usize>,
    /// Set while a programmatic back/forward step is in flight, so the
    /// resulting `on_navigation` callback does not push a duplicate entry.
    programmatic: bool,
}

type Tabs = Arc<Mutex<HashMap<String, TabHistory>>>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NewWindowPayload {
    url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TabPayload {
    tab_id: String,
    url: String,
    title: String,
    load_error: Option<String>,
    can_go_back: bool,
    can_go_forward: bool,
}

fn lock(tabs: &Tabs) -> MutexGuard<'_, HashMap<String, TabHistory>> {
    // Recover from a poisoned lock: a panic inside one page callback must not
    // permanently break navigation for every tab.
    tabs.lock().unwrap_or_else(|e| e.into_inner())
}

/// Only real web schemes may be loaded inside the browser shell. This blocks
/// `javascript:`, `data:` and `file:` navigations.
fn is_navigable(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "about")
}

fn parse_target(input: &str) -> Result<Url, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("La dirección está vacía".into());
    }
    let url =
        Url::parse(trimmed).map_err(|_| format!("No se pudo interpretar la dirección: {trimmed}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(format!("Esquema no permitido: {}", url.scheme()));
    }
    Ok(url)
}

fn record_navigation(tabs: &Tabs, tab_id: &str, url: &str) {
    let mut map = lock(tabs);
    let entry = map.entry(tab_id.to_string()).or_default();

    if entry.programmatic {
        entry.programmatic = false;
        return;
    }

    // A brand new blank tab should not gain a back entry for about:blank.
    if entry.entries.is_empty() && url == "about:blank" {
        return;
    }

    // Drop forward entries: the user branched off from the current page.
    if let Some(index) = entry.index {
        if index + 1 < entry.entries.len() {
            entry.entries.truncate(index + 1);
        }
    }

    if entry.entries.last().map(String::as_str) != Some(url) {
        entry.entries.push(url.to_string());
    }
    entry.index = Some(entry.entries.len().saturating_sub(1));
}

/// Resolves the target URL for a back/forward step and marks the move as
/// programmatic. Deliberately returns before `navigate` is called so the lock
/// is never held across the `on_navigation` callback.
fn step_history(tabs: &Tabs, tab_id: &str, delta: i64) -> Option<String> {
    let mut map = lock(tabs);
    let entry = map.get_mut(tab_id)?;
    let index = entry.index?;

    let target = if delta < 0 {
        index.checked_sub(1)?
    } else {
        index.checked_add(usize::try_from(delta).ok()?)?
    };

    let url = entry.entries.get(target).cloned()?;
    entry.index = Some(target);
    entry.programmatic = true;
    Some(url)
}

fn history_flags(tabs: &Tabs, tab_id: &str) -> (bool, bool) {
    let map = lock(tabs);
    let Some(entry) = map.get(tab_id) else {
        return (false, false);
    };
    let Some(index) = entry.index else {
        return (false, false);
    };
    (index > 0, index + 1 < entry.entries.len())
}

/// Detects a basic network failure: the engine renders an internal error
/// document with no title and no text for unreachable hosts or refused
/// connections. Real pages virtually always carry at least one of the two.
fn classify_load(url: &str, title: &str, text_len: u64) -> Option<String> {
    if url == "about:blank" || url.is_empty() {
        return None;
    }
    if title.trim().is_empty() && text_len == 0 {
        return Some("No se pudo cargar la página (error de red o servidor)".into());
    }
    None
}

fn emit_tab(app: &AppHandle, event: &str, tab_id: &str, url: String, title: String, error: Option<String>) {
    let tabs: Tabs = app.state::<Tabs>().inner().clone();
    let (can_go_back, can_go_forward) = history_flags(&tabs, tab_id);

    let _ = app.emit_to(
        MAIN_WINDOW,
        event,
        TabPayload {
            tab_id: tab_id.to_string(),
            url,
            title,
            load_error: error,
            can_go_back,
            can_go_forward,
        },
    );
}

#[tauri::command]
async fn create_tab(
    app: AppHandle,
    tab_id: String,
    url: Option<String>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let parsed = match url.as_deref() {
        Some(raw) => parse_target(raw)?,
        None => Url::parse("about:blank").map_err(|e| e.to_string())?,
    };

    // Reusing an existing label means the tab already owns a webview.
    if let Some(existing) = app.get_webview(&tab_id) {
        existing.navigate(parsed).map_err(|e| e.to_string())?;
        return Ok(());
    }

    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "No se encontró la ventana principal".to_string())?;

    let tabs: Tabs = app.state::<Tabs>().inner().clone();

    let nav_app = app.clone();
    let nav_tabs = tabs.clone();
    let title_app = app.clone();
    let load_app = app.clone();
    let popup_app = app.clone();

    let builder = WebviewBuilder::new(&tab_id, WebviewUrl::External(parsed))
        .background_color(Color(17, 17, 17, 255))
        .enable_clipboard_access()
        .initialization_script(INIT_SCRIPT)
        .on_navigation(move |url| {
            if !is_navigable(url) {
                emit_tab(
                    &nav_app,
                    "tab://load-finish",
                    &tab_id,
                    url.to_string(),
                    String::new(),
                    Some(format!("Esquema bloqueado: {}", url.scheme())),
                );
                return false;
            }

            record_navigation(&nav_tabs, &tab_id, url.as_str());
            true
        })
        .on_document_title_changed(move |webview, title| {
            emit_tab(
                &title_app,
                "tab://title-changed",
                webview.label(),
                String::new(),
                title,
                None,
            );
        })
        .on_page_load(move |webview, payload| {
            let tab_id = webview.label().to_string();

            if matches!(payload.event(), PageLoadEvent::Started) {
                emit_tab(
                    &load_app,
                    "tab://load-start",
                    &tab_id,
                    payload.url().to_string(),
                    String::new(),
                    None,
                );
                return;
            }

            let app_for_probe = load_app.clone();
            let id_for_probe = tab_id.clone();

            let app_on_error = app_for_probe.clone();
            let id_on_error = id_for_probe.clone();

            if let Err(err) = webview.eval_with_callback(PROBE_JS, move |raw| {
                let parsed: serde_json::Value =
                    serde_json::from_str(&raw).unwrap_or(serde_json::Value::Null);

                let href = parsed
                    .get("href")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();
                let title = parsed
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();
                let text_len = parsed.get("textLen").and_then(|v| v.as_u64()).unwrap_or(0);

                let error = classify_load(&href, &title, text_len);

                emit_tab(
                    &app_for_probe,
                    "tab://load-finish",
                    &id_for_probe,
                    href,
                    title,
                    error,
                );
            }) {
                // The probe is best effort: without it the shell just keeps the
                // last known title, so surface the failure instead of ignoring it.
                emit_tab(
                    &app_on_error,
                    "tab://load-finish",
                    &id_on_error,
                    payload.url().to_string(),
                    String::new(),
                    Some(format!("No se pudo inspeccionar la página: {err}")),
                );
            }
        })
        .on_new_window(move |url, _features| {
            // `target="_blank"` becomes a new tab instead of a new window.
            let _ = popup_app.emit_to(
                MAIN_WINDOW,
                "tab://new-window",
                NewWindowPayload {
                    url: url.to_string(),
                },
            );
            tauri::webview::NewWindowResponse::Deny
        });

    let webview = window
        .as_ref()
        .window()
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;

    // The native widget is laid out over the whole window by GTK, so re-apply
    // the bounds after creation to keep the shell chrome visible.
    let _ = webview.set_position(LogicalPosition::new(x, y));
    let _ = webview.set_size(LogicalSize::new(width, height));

    Ok(())
}

#[tauri::command]
fn navigate(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let parsed = parse_target(&url)?;
    let webview = app
        .get_webview(&tab_id)
        .ok_or_else(|| format!("La pestaña {tab_id} no tiene webview"))?;
    webview.navigate(parsed).map_err(|e| e.to_string())
}

#[tauri::command]
fn go_back(app: AppHandle, tab_id: String) -> Result<bool, String> {
    let tabs: Tabs = app.state::<Tabs>().inner().clone();
    let Some(url) = step_history(&tabs, &tab_id, -1) else {
        return Ok(false);
    };
    let Ok(parsed) = Url::parse(&url) else {
        return Ok(false);
    };
    if let Some(webview) = app.get_webview(&tab_id) {
        webview.navigate(parsed).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn go_forward(app: AppHandle, tab_id: String) -> Result<bool, String> {
    let tabs: Tabs = app.state::<Tabs>().inner().clone();
    let Some(url) = step_history(&tabs, &tab_id, 1) else {
        return Ok(false);
    };
    let Ok(parsed) = Url::parse(&url) else {
        return Ok(false);
    };
    if let Some(webview) = app.get_webview(&tab_id) {
        webview.navigate(parsed).map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    let webview = app
        .get_webview(&tab_id)
        .ok_or_else(|| format!("La pestaña {tab_id} no tiene webview"))?;
    webview.reload().map_err(|e| e.to_string())
}

#[tauri::command]
fn close_tab(app: AppHandle, tab_id: String) -> Result<(), String> {
    {
        let tabs: Tabs = app.state::<Tabs>().inner().clone();
        lock(&tabs).remove(&tab_id);
    }
    if let Some(webview) = app.get_webview(&tab_id) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hides every content webview and shows only `tab_id`. Passing `None` hides
/// them all, which is how the shell draws its own empty or error state on top
/// of a tab that is not currently rendering.
#[tauri::command]
fn activate_tab(app: AppHandle, tab_id: Option<String>) -> Result<(), String> {
    let target = tab_id.as_deref();
    for (label, webview) in app.webviews() {
        if label == MAIN_WINDOW {
            continue;
        }
        if target == Some(label.as_str()) {
            let _ = webview.show();
            let _ = webview.set_focus();
        } else {
            let _ = webview.hide();
        }
    }
    Ok(())
}

/// Keeps the content webviews aligned with the shell layout. They are native
/// siblings, so React has to push its own measured bounds.
#[tauri::command]
fn sync_layout(app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    for (label, webview) in app.webviews() {
        if label == MAIN_WINDOW {
            continue;
        }
        let _ = webview.set_position(LogicalPosition::new(x, y));
        let _ = webview.set_size(LogicalSize::new(width, height));
    }
    Ok(())
}

/// Injects JavaScript into a tab's webview. Used by the layout inspector to
/// install its hover probe, and to toggle it back off.
#[tauri::command]
fn eval_script(app: AppHandle, tab_id: String, script: String) -> Result<(), String> {
    let webview = app
        .get_webview(&tab_id)
        .ok_or_else(|| format!("La pestaña {tab_id} no tiene webview"))?;
    webview.eval(script).map_err(|e| e.to_string())
}

/// Evaluates a script in the tab and resolves with its JSON result. This backs
/// the inspector's request/response probes, which cannot use events because the
/// inspected page runs on a different webview than the shell.
#[tauri::command]
async fn eval_json(app: AppHandle, tab_id: String, script: String) -> Result<String, String> {
    let webview = app
        .get_webview(&tab_id)
        .ok_or_else(|| format!("La pestaña {tab_id} no tiene webview"))?;

    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    // eval_with_callback takes an Fn closure, so the sender needs interior
    // mutability. The Mutex lets the first callback claim it and ignore repeats.
    let sender = std::sync::Mutex::new(Some(tx));

    webview
        .eval_with_callback(script, move |result| {
            if let Ok(mut guard) = sender.lock() {
                if let Some(tx) = guard.take() {
                    let _ = tx.send(result);
                }
            }
        })
        .map_err(|e| e.to_string())?;

    tokio::time::timeout(std::time::Duration::from_millis(1500), rx)
        .await
        .map_err(|_| "El script de inspección no respondió a tiempo".to_string())
        .and_then(|res| res.map_err(|_| "El script de inspección fue cancelado".to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Tabs::default())
        .invoke_handler(tauri::generate_handler![
            create_tab,
            navigate,
            go_back,
            go_forward,
            reload,
            close_tab,
            activate_tab,
            sync_layout,
            eval_script,
            eval_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}