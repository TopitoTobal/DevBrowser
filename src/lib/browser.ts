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

export function onTabEvent(
  event: string,
  handler: (payload: TabEvent) => void,
): Promise<UnlistenFn> {
  return listen<TabEvent>(event, (e) => handler(e.payload));
}

export function onNewWindow(handler: (url: string) => void): Promise<UnlistenFn> {
  return listen<{ url: string }>("tab://new-window", (e) => handler(e.payload.url));
}