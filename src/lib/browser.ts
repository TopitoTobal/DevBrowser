import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Shape of the payload emitted by every `tab://*` event. */
export interface TabEvent {
  tabId: string;
  url: string;
  title: string;
  loadError: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createTab(tabId: string, url: string | null, bounds: Bounds) {
  return invoke<void>("create_tab", { tabId, url, ...bounds });
}

export function navigateTab(tabId: string, url: string) {
  return invoke<void>("navigate", { tabId, url });
}

export function goBack(tabId: string) {
  return invoke<boolean>("go_back", { tabId });
}

export function goForward(tabId: string) {
  return invoke<boolean>("go_forward", { tabId });
}

export function reloadTab(tabId: string) {
  return invoke<void>("reload", { tabId });
}

export function closeTab(tabId: string) {
  return invoke<void>("close_tab", { tabId });
}

export function activateTab(tabId: string | null) {
  return invoke<void>("activate_tab", { tabId });
}

export function syncLayout(bounds: Bounds) {
  return invoke<void>("sync_layout", { ...bounds });
}

/** Runs JavaScript inside a tab's page. */
export function evalScript(tabId: string, script: string) {
  return invoke<void>("eval_script", { tabId, script });
}

/** Runs JavaScript and resolves with its JSON result. */
export function evalJson<T>(tabId: string, script: string): Promise<T> {
  return invoke<string>("eval_json", { tabId, script }).then((raw) => {
    const trimmed = raw.trim();
    // eval_with_callback hands back a JSON string, so unwrap the quotes.
    if (!trimmed || trimmed === "null") return null as T;
    const parsed = trimmed.startsWith('"')
      ? JSON.parse(trimmed)
      : trimmed;
    return (typeof parsed === "string" ? JSON.parse(parsed) : parsed) as T;
  });
}

export function onTabEvent(
  event: string,
  handler: (payload: TabEvent) => void,
): Promise<UnlistenFn> {
  return listen<TabEvent>(event, (e) => handler(e.payload));
}

export function onNewWindow(handler: (url: string) => void): Promise<UnlistenFn> {
  return listen<{ url: string }>("tab://new-window", (e) => handler(e.payload.url));
}