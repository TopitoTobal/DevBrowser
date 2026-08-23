import { useEffect, useState, type FormEvent } from "react";
import { useTabs } from "../context/TabsContext";
import { normalizeUrl } from "../lib/url";
import { goBackWebview, goForwardWebview, reloadWebview } from "../lib/native";

const navButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 enabled:hover:bg-neutral-800 enabled:hover:text-neutral-100 disabled:opacity-40";

function AddressBar() {
  const { activeTab, navigate } = useTabs();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const tabId = activeTab?.id;
  const hasPage = activeTab !== undefined && activeTab.url !== "";

  useEffect(() => {
    setValue(activeTab?.url ?? "");
    setInvalid(false);
  }, [tabId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!activeTab) return;
    const url = normalizeUrl(value);
    if (!url) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setValue(url);
    navigate(activeTab.id, url);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-11 shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-900 px-2"
    >
      <button
        type="button"
        aria-label="Atrás"
        disabled={!hasPage}
        onClick={() => tabId && void goBackWebview(tabId).catch(() => {})}
        className={navButton}
      >
        ←
      </button>
      <button
        type="button"
        aria-label="Adelante"
        disabled={!hasPage}
        onClick={() => tabId && void goForwardWebview(tabId).catch(() => {})}
        className={navButton}
      >
        →
      </button>
      <button
        type="button"
        aria-label="Recargar"
        disabled={!hasPage}
        onClick={() => tabId && void reloadWebview(tabId).catch(() => {})}
        className={navButton}
      >
        ↻
      </button>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        placeholder="URL, dominio o puerto local (ej. :3000)"
        spellCheck={false}
        className={`h-8 min-w-0 flex-1 rounded-md bg-neutral-800 px-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:ring-2 ${
          invalid ? "ring-2 ring-red-500" : "focus:ring-blue-500"
        }`}
      />
    </form>
  );
}

export default AddressBar;
