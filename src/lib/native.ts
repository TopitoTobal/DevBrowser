import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function measureBounds(element: HTMLElement): Bounds {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

export function createWebview(
  tabId: string,
  url: string,
  bounds: Bounds,
): Promise<void> {
  return invoke("webview_create", { tabId, url, ...bounds });
}

export function navigateWebview(tabId: string, url: string): Promise<void> {
  return invoke("webview_navigate", { tabId, url });
}

export function setWebviewBounds(tabId: string, bounds: Bounds): Promise<void> {
  return invoke("webview_set_bounds", { tabId, ...bounds });
}

export function showWebview(tabId: string): Promise<void> {
  return invoke("webview_show", { tabId });
}

export function hideWebview(tabId: string): Promise<void> {
  return invoke("webview_hide", { tabId });
}

export function removeWebview(tabId: string): Promise<void> {
  return invoke("webview_remove", { tabId });
}

export function reloadWebview(tabId: string): Promise<void> {
  return invoke("webview_reload", { tabId });
}

export function goBackWebview(tabId: string): Promise<void> {
  return invoke("webview_go_back", { tabId });
}

export function goForwardWebview(tabId: string): Promise<void> {
  return invoke("webview_go_forward", { tabId });
}

export function scanLocalServers(known: number[]): Promise<number[]> {
  return invoke("scan_local_servers", { known });
}

export interface PageLoadPayloadData {
  tabId: string;
  phase: "started" | "finished";
}

export function onPageLoad(
  handler: (payload: PageLoadPayloadData) => void,
): Promise<() => void> {
  return listen<PageLoadPayloadData>("page-load", (event) =>
    handler(event.payload),
  );
}
