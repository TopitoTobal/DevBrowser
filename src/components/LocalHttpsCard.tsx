import { useCallback, useEffect, useState } from "react";
import {
  installLocalCa,
  localCaStatus,
  removeLocalCa,
  type LocalCaStatus,
} from "../lib/native";

type Action = "install" | "remove" | null;

export default function LocalHttpsCard() {
  const [status, setStatus] = useState<LocalCaStatus | null>(null);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState<Action>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await localCaStatus());
      setAvailable(true);
    } catch {
      // Sin bridge de Tauri (modo navegador): la tarjeta no aplica.
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: Exclude<Action, null>) {
    setBusy(action);
    setError(null);
    try {
      const next =
        action === "install" ? await installLocalCa() : await removeLocalCa();
      setStatus(next);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function copyConfig() {
    if (!status) return;
    const snippet = [
      "// vite.config.js",
      "export default {",
      "  server: {",
      `    https: { key: "${status.leafKeyPath.replace(/\\/g, "\\\\")}",`,
      `              cert: "${status.leafCertPath.replace(/\\/g, "\\\\")}" },`,
      "  },",
      "};",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles");
    }
  }

  if (!available || !status) return null;

  const ready = status.installed && status.trusted;

  return (
    <div className="w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          HTTPS local
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            ready
              ? "bg-emerald-950 text-emerald-300"
              : status.installed
                ? "bg-amber-950 text-amber-300"
                : "bg-neutral-800 text-neutral-400"
          }`}
        >
          {ready ? "Confiable" : status.installed ? "Sin confiar" : "Sin CA"}
        </span>
      </div>

      <p className="mt-2 text-sm text-neutral-400">
        {ready
          ? `Los certificados de ${status.leafHosts.join(", ")} se aceptan sin avisos.`
          : "Genera una CA local y confía en ella (solo en tu usuario de Windows, sin permisos de administrador) para abrir tus dev servers en https sin avisos de conexión insegura."}
      </p>

      {ready && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={copyConfig}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 hover:text-white"
          >
            {copied ? "Copiado" : "Copiar config de Vite"}
          </button>
          <p className="break-all font-mono text-xs text-neutral-600">
            {status.leafCertPath}
          </p>
          <p className="text-xs text-neutral-600">
            Thumbprint SHA-1: {status.thumbprint}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ready ? (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("install")}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 disabled:opacity-50"
            >
              {busy === "install" ? "Regenerando…" : "Renovar certificado"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("remove")}
              className="rounded-md border border-red-900 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950 disabled:opacity-50"
            >
              {busy === "remove" ? "Desinstalando…" : "Desinstalar CA"}
            </button>
          </>
        ) : confirming ? (
          <>
            <span className="text-xs text-amber-300">
              Se añadirá una CA de confianza a tu usuario de Windows.
            </span>
            <button
              type="button"
              disabled={busy !== null || !status.supported}
              onClick={() => run("install")}
              className="rounded-md bg-amber-900 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-800 disabled:opacity-50"
            >
              {busy === "install" ? "Instalando…" : "Instalar de todas formas"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!status.supported}
            onClick={() => setConfirming(true)}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
          >
            {status.supported
              ? "Generar e instalar CA"
              : "Solo disponible en Windows"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
