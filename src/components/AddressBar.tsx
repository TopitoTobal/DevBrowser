import { useState, useEffect } from "react";
import { Tab } from "../types";

interface AddressBarProps {
  activeTab: Tab | undefined;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onToggleInspector: () => void;
  inspectorEnabled: boolean;
  /** Only tabs with a live webview can be inspected. */
  inspectorAvailable: boolean;
}

export function AddressBar({
  activeTab,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onToggleInspector,
  inspectorEnabled,
  inspectorAvailable,
}: AddressBarProps) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (activeTab) {
      setInputValue(activeTab.url);
    }
  }, [activeTab?.url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onNavigate(inputValue.trim());
    }
  };

  return (
    <div className="flex items-center gap-2 bg-neutral-800 px-3 py-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onGoBack}
          disabled={!activeTab?.canGoBack}
          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Atrás"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onGoForward}
          disabled={!activeTab?.canGoForward}
          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Adelante"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onReload}
          disabled={!activeTab}
          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Recargar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1">
        <div className="flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-1.5">
          <svg className="h-3.5 w-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe una URL o busca en Google..."
            className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none"
          />
        </div>
      </form>

      <button
        onClick={onToggleInspector}
        disabled={!inspectorAvailable}
        title={
          inspectorAvailable
            ? "Inspector de layout (medir, CSS, contraste)"
            : "Abre una página para usar el inspector"
        }
        className={`rounded-lg p-1.5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${
          inspectorEnabled
            ? "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
            : "text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"
          />
        </svg>
      </button>
    </div>
  );
}
