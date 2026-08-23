import { useTabs } from "../context/TabsContext";
import { urlLabel } from "../lib/url";

function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, newTab } = useTabs();

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-900 px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex h-7 w-44 shrink-0 cursor-pointer select-none items-center rounded-md text-xs ${
                active
                  ? "bg-neutral-700 text-neutral-50"
                  : "text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              <span className="min-w-0 flex-1 truncate px-2">
                {urlLabel(tab.url)}
              </span>
              <button
                type="button"
                aria-label="Cerrar pestaña"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-neutral-600"
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          aria-label="Nueva pestaña"
          onClick={newTab}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default TabBar;
