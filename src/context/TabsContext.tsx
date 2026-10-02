import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { Tab } from "../types";

export interface TabsState {
  tabs: Tab[];
  activeTabId: string;
}

export type TabsAction =
  | { type: "new-tab" }
  | { type: "close-tab"; id: string }
  | { type: "set-active-tab"; id: string }
  | { type: "navigate"; id: string; url: string };

function createTab(): Tab {
  return { id: crypto.randomUUID(), url: "" };
}

export function initialState(): TabsState {
  const tab = createTab();
  return { tabs: [tab], activeTabId: tab.id };
}

export function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "new-tab": {
      const tab = createTab();
      return { tabs: [...state.tabs, tab], activeTabId: tab.id };
    }
    case "close-tab": {
      const index = state.tabs.findIndex((t) => t.id === action.id);
      if (index === -1) return state;
      const tabs = state.tabs.filter((t) => t.id !== action.id);
      if (tabs.length === 0) {
        const fresh = createTab();
        return { tabs: [fresh], activeTabId: fresh.id };
      }
      const next = tabs[Math.min(index, tabs.length - 1)];
      return {
        tabs,
        activeTabId:
          action.id === state.activeTabId ? next.id : state.activeTabId,
      };
    }
    case "set-active-tab":
      return { ...state, activeTabId: action.id };
    case "navigate":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, url: action.url } : t,
        ),
      };
  }
}

interface TabsContextValue extends TabsState {
  activeTab: Tab | undefined;
  newTab: () => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  navigate: (id: string, url: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const value = useMemo<TabsContextValue>(
    () => ({
      ...state,
      activeTab: state.tabs.find((t) => t.id === state.activeTabId),
      newTab: () => dispatch({ type: "new-tab" }),
      closeTab: (id) => dispatch({ type: "close-tab", id }),
      setActiveTab: (id) => dispatch({ type: "set-active-tab", id }),
      navigate: (id, url) => dispatch({ type: "navigate", id, url }),
    }),
    [state],
  );

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used within TabsProvider");
  return ctx;
}
