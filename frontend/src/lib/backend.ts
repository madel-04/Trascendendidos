function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function formatHostname(hostname: string): string {
  return hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
}

function resolveRuntimeBackendUrl(): string {
  const configuredBase = import.meta.env.VITE_API_BASE?.trim();
  if (configuredBase) {
    return normalizeBaseUrl(configuredBase);
  }

  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = formatHostname(window.location.hostname || "localhost");
  return `${protocol}//${hostname}:3000`;
}

export const BACKEND_URL = resolveRuntimeBackendUrl();

export const BACKEND_WS_URL = (() => {
  const url = new URL(BACKEND_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return normalizeBaseUrl(url.toString());
})();

export function resolveBackendAssetUrl(assetPath?: string | null): string | null {
  if (!assetPath) return null;
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) return assetPath;
  return `${BACKEND_URL}${assetPath}`;
}
