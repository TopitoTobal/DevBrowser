import { Tab } from "../types";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}: TabBarProps) {
  return (
    <div className="flex items-end gap-1 bg-neutral-900 px-2 pt-2">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          className={`group flex max-w-48 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-t-lg px-3 py-2 text-sm transition-colors ${
            tab.id === activeTabId
              ? "bg-neutral-800 text-neutral-100"
              : "bg-neutral-850 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          }`}
        >
          {tab.isLoading && (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-500 border-t-blue-400" />
          )}
          <span className="truncate">{tab.title || "Nueva pestaña"}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
            className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-neutral-700 group-hover:opacity-100"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={onNewTab}
        className="mb-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        title="Nueva pestaña"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  );
}
