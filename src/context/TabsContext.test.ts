import { describe, expect, it } from "vitest";
import { initialState, reducer, type TabsState } from "./TabsContext";

describe("TabsContext reducer", () => {
  it("initialState crea una única pestaña activa sin URL", () => {
    const state = initialState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(state.tabs[0].id);
    expect(state.tabs[0].url).toBe("");
  });

  it("new-tab añade una pestaña y la activa", () => {
    const state = initialState();
    const next = reducer(state, { type: "new-tab" });
    expect(next.tabs).toHaveLength(2);
    expect(next.activeTabId).toBe(next.tabs[1].id);
    expect(next.tabs[0].url).toBe("");
  });

  it("navigate actualiza solo la pestaña indicada", () => {
    const state = initialState();
    const withTab = reducer(state, { type: "new-tab" });
    const firstId = state.tabs[0].id;
    const next = reducer(withTab, {
      type: "navigate",
      id: firstId,
      url: "https://example.com/",
    });
    expect(next.tabs.find((t) => t.id === firstId)?.url).toBe(
      "https://example.com/",
    );
    expect(next.tabs[1].url).toBe("");
  });

  it("set-active-tab cambia la pestaña activa", () => {
    const state = initialState();
    const withTab = reducer(state, { type: "new-tab" });
    const next = reducer(withTab, {
      type: "set-active-tab",
      id: withTab.tabs[0].id,
    });
    expect(next.activeTabId).toBe(withTab.tabs[0].id);
  });

  it("close-tab elimina la pestaña cerrada", () => {
    const state = initialState();
    const withTab = reducer(state, { type: "new-tab" });
    const closedId = state.tabs[0].id;
    const next = reducer(withTab, { type: "close-tab", id: closedId });
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs.find((t) => t.id === closedId)).toBeUndefined();
  });

  it("close-tab de la pestaña activa activa al vecino", () => {
    let state = initialState();
    state = reducer(state, { type: "new-tab" });
    state = reducer(state, { type: "new-tab" });
    const closedId = state.activeTabId;
    const next = reducer(state, { type: "close-tab", id: closedId });
    expect(next.tabs.some((t) => t.id === closedId)).toBe(false);
    expect(next.activeTabId).toBeDefined();
  });

  it("close-tab de la última pestaña crea una pestaña nueva", () => {
    const state = initialState();
    const next = reducer(state, { type: "close-tab", id: state.activeTabId });
    expect(next.tabs).toHaveLength(1);
    expect(next.activeTabId).toBe(next.tabs[0].id);
    expect(next.tabs[0].url).toBe("");
  });

  it("close-tab con id desconocido no cambia el estado", () => {
    const state = initialState();
    const next = reducer(state, { type: "close-tab", id: "inexistente" });
    expect(next).toEqual(state);
  });

  it("close-tab de una pestaña inactiva mantiene la pestaña activa", () => {
    let state = initialState();
    const firstId = state.tabs[0].id;
    state = reducer(state, { type: "new-tab" });
    const next = reducer(state, { type: "close-tab", id: firstId });
    expect(next.activeTabId).toBe(state.activeTabId);
  });

  it("no muta el estado original (inmutabilidad)", () => {
    const state: TabsState = {
      tabs: [{ id: "a", url: "" }],
      activeTabId: "a",
    };
    reducer(state, { type: "new-tab" });
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe("a");
  });
});
