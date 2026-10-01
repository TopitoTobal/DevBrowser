import { useCallback, useEffect, useRef, useState } from "react";
import { evalJson, evalScript } from "../lib/browser";
import {
  HIGHLIGHT,
  INSTALL_PROBE,
  READ_TARGET,
  type Inspection,
} from "../lib/inspector";

/** Fast enough to feel live, slow enough not to flood the IPC bridge. */
const POLL_MS = 90;

export function useInspector(tabId: string | null, hasWebview: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const enabledRef = useRef(false);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      if (!tabId) return prev;
      // The probe only exists for pages that already loaded.
      evalScript(tabId, INSTALL_PROBE)
        .then(() => evalJson<boolean>(tabId, INSTALL_PROBE))
        .catch(() => {});
      if (!next) setInspection(null);
      return next;
    });
  }, [tabId]);

  // Installing on an already loaded page needs the enable flag carried over.
  useEffect(() => {
    if (!enabledRef.current || !tabId || !hasWebview) return;
    evalScript(tabId, INSTALL_PROBE).catch(() => {});
  }, [tabId, hasWebview]);

  // Leaving a tab tears the probe down so it stops tracking that page.
  useEffect(() => {
    return () => {
      if (!enabledRef.current || !tabId) return;
      evalScript(tabId, INSTALL_PROBE)
        .then(() => evalScript(tabId, INSTALL_PROBE))
        .catch(() => {});
    };
  }, [tabId]);

  useEffect(() => {
    if (!enabled || !tabId || !hasWebview) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const data = await evalJson<Inspection | null>(tabId, READ_TARGET);
        if (cancelled) return;
        setInspection(data);
        if (data) {
          evalScript(tabId, HIGHLIGHT).catch(() => {});
        }
      } catch {
        // A page that navigated mid-poll simply has no target this frame.
      }
    };

    const id = setInterval(tick, POLL_MS);
    tick();

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, tabId, hasWebview]);

  return { enabled, inspection, toggle };
}