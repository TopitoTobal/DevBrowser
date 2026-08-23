function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "::1" ||
    h.startsWith("127.") ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith(".local") ||
    (!h.includes(".") && h !== "")
  );
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/s);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    const rest = schemeMatch[2];
    if (scheme === "http" || scheme === "https") {
      try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.toString();
      } catch {
        return null;
      }
    }
    // "host:puerto" disfrazado de esquema (p. ej. "localhost:3000"):
    // se deja pasar solo si lo que sigue al ":" es un puerto válido;
    // esquemas reales distintos (file:, mailto:, ...) se rechazan
    if (!/^(\d{1,5})(\/|\?|#|$)/.test(rest)) return null;
  }

  const portOnly = trimmed.match(/^:?(\d{1,5})$/);
  if (portOnly) {
    const port = Number(portOnly[1]);
    if (port < 1 || port > 65535) return null;
    return `http://localhost:${port}/`;
  }

  try {
    const parsed = new URL(`http://${trimmed}`);
    const hasExplicitPort = parsed.port !== "";
    if (hasExplicitPort || isLocalHostname(parsed.hostname)) {
      return parsed.toString();
    }
    return new URL(`https://${trimmed}`).toString();
  } catch {
    return null;
  }
}

export function urlLabel(url: string): string {
  if (!url) return "Nueva pestaña";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${
      parsed.port ? `:${parsed.port}` : ""
    }`;
  } catch {
    return url;
  }
}
