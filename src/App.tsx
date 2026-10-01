import { useCallback, useEffect, useRef, useState } from "react";
import { Tab } from "./types";
import { TabBar } from "./components/TabBar";
import { AddressBar } from "./components/AddressBar";
import { ErrorPage } from "./components/ErrorPage";
import {
  activateTab,
  closeTab,
  createTab,
  goBack,
  goForward,
  navigateTab,
  onNewWindow,
  onTabEvent,
  reloadTab,
  syncLayout,
  type Bounds,
} from "./lib/browser";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function createTabState(url = ""): Tab {
  return {
    id: generateId(),
    title: url ? url.replace(/^https?:\/\//, "").split("/")[0] : "Nueva pestaña",
    url,
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    loadError: null,
  };
}

const HOME_URL = "https://developer.mozilla.org";

function App() {
  const [tabs, setTabs] = useState<Tab[]>([createTabState()]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const contentRef = useRef<HTMLDivElement>(null);
  /** Tracks which tabs already own a native webview, to avoid recreating one. */
  const webviews = useRef<Set<string>>(new Set());

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab))
    );
  }, []);

  /**
   * The content area is a native overlay: we measure it and push the bounds
   * down so the webviews line up with the React layout below the chrome.
   */
  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const bounds: Bounds = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
    if (bounds.width > 0 && bounds.height > 0) {
      syncLayout(bounds).catch(() => {});
    }
    return bounds;
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /** Creates the native webview for a tab if it does not have one yet. */
  const ensureWebview = useCallback(
    async (tabId: string, url: string | null) => {
      if (webviews.current.has(tabId)) return;
      const bounds = measure() ?? { x: 0, y: 0, width: 0, height: 0 };
      await createTab(tabId, url, bounds);
      webviews.current.add(tabId);
      // GTK lays the fresh widget out over the whole window, so the bounds
      // passed to add_child are not enough: re-apply them right after the
      // webview exists, otherwise it covers the tab bar and address bar.
      syncLayout(bounds).catch(() => {});
    },
    [measure]
  );

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    const register = async () => {
      const unsubs = await Promise.all([
        onTabEvent("tab://load-start", (p) =>
          updateTab(p.tabId, { isLoading: true, loadError: null })
        ),
        onTabEvent("tab://load-finish", (p) => {
          if (p.loadError) {
            updateTab(p.tabId, {
              isLoading: false,
              loadError: p.loadError,
              url: p.url,
            });
            return;
          }
          updateTab(p.tabId, {
            isLoading: false,
            loadError: null,
            url: p.url,
            // Keep a meaningful label even when the page has no <title>.
            title:
              p.title ||
              p.url.replace(/^https?:\/\//, "").split("/")[0] ||
              "Nueva pestaña",
          });
        }),
        onTabEvent("tab://title-changed", (p) => {
          if (!p.title) return;
          updateTab(p.tabId, { title: p.title });
        }),
        onNewWindow((url) => {
          setTabs((prev) => [...prev, createTabState(url)]);
        }),
      ]);

      if (cancelled) {
        unsubs.forEach((un) => un());
        return;
      }
      unlisteners.push(...unsubs);
    };

    register();

    return () => {
      cancelled = true;
      unlisteners.forEach((un) => un());
    };
  }, [updateTab]);

  /** Shows the requested tab's webview and hides the rest. */
  const selectTab = useCallback(
    (id: string) => {
      setActiveTabId(id);
      // A tab showing our own error or empty state must hide its webview.
      const tab = tabs.find((t) => t.id === id);
      const show = tab && !tab.loadError && webviews.current.has(id) ? id : null;
      activateTab(show).catch(() => {});
      // Showing a hidden webview can restore stale bounds, so re-align it.
      if (show) measure();
    },
    [measure, tabs]
  );

  const closeTabById = useCallback(
    (id: string) => {
      webviews.current.delete(id);
      closeTab(id).catch(() => {});

      setTabs((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        const remaining = prev.filter((t) => t.id !== id);

        if (remaining.length === 0) {
          const fresh = createTabState();
          setActiveTabId(fresh.id);
          activateTab(null).catch(() => {});
          return [fresh];
        }

        if (id === activeTabId) {
          const next = remaining[Math.min(index, remaining.length - 1)];
          setActiveTabId(next.id);
          const show =
            !next.loadError && webviews.current.has(next.id) ? next.id : null;
          activateTab(show).catch(() => {});
        }

        return remaining;
      });
    },
    [activeTabId]
  );

  const newTab = useCallback(() => {
    const fresh = createTabState();
    setTabs((prev) => [...prev, fresh]);
    setActiveTabId(fresh.id);
    activateTab(null).catch(() => {});
  }, []);

  const navigate = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      let finalUrl = trimmed;
      if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
        // Looks like a host? Load it directly, otherwise run a web search.
        finalUrl =
          trimmed.includes(".") && !trimmed.includes(" ")
            ? `https://${trimmed}`
            : `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
      }

      updateTab(activeTabId, {
        url: finalUrl,
        title: finalUrl.replace(/^https?:\/\//, "").split("/")[0],
        isLoading: true,
        loadError: null,
      });

      try {
        if (webviews.current.has(activeTabId)) {
          await navigateTab(activeTabId, finalUrl);
        } else {
          await ensureWebview(activeTabId, finalUrl);
        }
        const tab = tabs.find((t) => t.id === activeTabId);
        activateTab(tab?.loadError ? null : activeTabId).catch(() => {});
      } catch (err) {
        updateTab(activeTabId, {
          isLoading: false,
          loadError: String(err),
        });
      }
    },
    [activeTabId, ensureWebview, tabs, updateTab]
  );

  const handleGoBack = useCallback(() => {
    goBack(activeTabId).catch(() => {});
  }, [activeTabId]);

  const handleGoForward = useCallback(() => {
    goForward(activeTabId).catch(() => {});
  }, [activeTabId]);

  const handleReload = useCallback(() => {
    if (!webviews.current.has(activeTabId)) return;
    updateTab(activeTabId, { isLoading: true, loadError: null });
    reloadTab(activeTabId).catch(() => {});
  }, [activeTabId, updateTab]);

  /** Re-renders the native webview after an error by recreating it. */
  const retryTab = useCallback(
    (url: string) => {
      if (!url) {
        navigate(HOME_URL);
        return;
      }
      closeTabById(activeTabId);
      navigate(url);
    },
    [activeTabId, closeTabById, navigate]
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={selectTab}
        onCloseTab={closeTabById}
        onNewTab={newTab}
      />
      <AddressBar
        activeTab={activeTab}
        onNavigate={navigate}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
      />

      {/* Native webviews are positioned over this box via sync_layout. */}
      <div ref={contentRef} className="relative flex-1 bg-neutral-900">
        {!activeTab?.url && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-300">DevBrowser</h2>
            <p className="text-sm text-neutral-500">
              Escribe una dirección o un término de búsqueda para empezar
            </p>
          </div>
        )}

        {activeTab?.loadError && (
          <ErrorPage
            url={activeTab.url}
            message={activeTab.loadError}
            onRetry={() => retryTab(activeTab.url)}
          />
        )}
      </div>
    </div>
  );
}

export default App;