import { useCallback, useEffect, useRef, useState } from "react";
import { scanLocalServers } from "../lib/native";

const INTERVAL_MS = 5000;

function samePorts(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((port, i) => port === b[i]);
}

export function useLocalServers(enabled = true): number[] {
  const [ports, setPorts] = useState<number[]>([]);
  const knownRef = useRef<number[]>([]);
  const busyRef = useRef(false);

  const runScan = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const found = await scanLocalServers(knownRef.current);
      knownRef.current = found;
      setPorts((prev) => (samePorts(prev, found) ? prev : found));
    } catch {
      // Sin bridge de Tauri (modo navegador) o escaneo fallido: se conserva
      // el último resultado conocido en lugar de romper la página de inicio.
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (!document.hidden) void runScan();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) void runScan();
    };

    void runScan();
    const timer = setInterval(tick, INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, runScan]);

  return ports;
}
