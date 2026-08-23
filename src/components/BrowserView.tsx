import { useEffect, useRef, useState } from "react";
import { useTabs } from "../context/TabsContext";
import {
  createWebview,
  hideWebview,
  measureBounds,
  navigateWebview,
  onPageLoad,
  removeWebview,
  setWebviewBounds,
  showWebview,
} from "../lib/native";

function BrowserView() {
  const { tabs, activeTab } = useTabs();
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(new Map<string, string>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeId = activeTab?.id;
  const activeUrl = activeTab?.url;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onPageLoad(({ tabId, phase }) => {
      if (tabId === activeId) {
        setLoading(phase === "started");
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [activeId]);

  useEffect(() => {
    setLoading(false);
    setError(null);
    const element = containerRef.current;
    if (!element || !activeId) return;

    async function sync() {
      if (!element || !activeId || !activeUrl) return;
      try {
        const bounds = measureBounds(element);
        if (!loadedRef.current.has(activeId)) {
          await createWebview(activeId, activeUrl, bounds);
        } else if (loadedRef.current.get(activeId) !== activeUrl) {
          await navigateWebview(activeId, activeUrl);
        }
        loadedRef.current.set(activeId, activeUrl);
        await setWebviewBounds(activeId, bounds);
        await showWebview(activeId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void sync();
  }, [activeId, activeUrl]);

  useEffect(() => {
    for (const id of loadedRef.current.keys()) {
      if (id !== activeId) void hideWebview(id).catch(() => {});
    }
  }, [activeId, tabs.length]);

  useEffect(() => {
    const ids = new Set(tabs.map((t) => t.id));
    for (const id of [...loadedRef.current.keys()]) {
      if (!ids.has(id)) {
        loadedRef.current.delete(id);
        void removeWebview(id).catch(() => {});
      }
    }
  }, [tabs]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !activeId || !activeUrl) return;
    const observer = new ResizeObserver(() => {
      if (loadedRef.current.has(activeId)) {
        void setWebviewBounds(activeId, measureBounds(element)).catch(
          () => {},
        );
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeId, activeUrl]);

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 bg-white">
      {!activeUrl && (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-500">
          <h1 className="text-4xl font-bold tracking-tight">DevBrowser</h1>
          <p className="text-sm">
            Escribe una URL en la barra de direcciones para navegar
          </p>
        </div>
      )}
      {loading && (
        <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-blue-500" />
      )}
      {error && (
        <div className="absolute inset-x-4 bottom-4 rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

export default BrowserView;
