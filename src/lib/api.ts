/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function normalizeApiBase(raw?: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed.replace(/\/+$/, "").replace(/\/api$/i, "");
  }
  return "";
}

function normalizeAppBase(raw?: string): string {
  const trimmed = String(raw || "/").trim();
  if (!trimmed || trimmed === "/") return "/";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export const API_BASE_URL: string = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
export const APP_BASE_URL: string = normalizeAppBase(import.meta.env.BASE_URL);

export function getRouterBasename(): string | undefined {
  if (APP_BASE_URL === "/") return undefined;
  return APP_BASE_URL.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL || "/";
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export function assetUrl(path: string): string {
  if (!path) return "";
  if (
    /^(https?:)?\/\//i.test(path) ||
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("#")
  ) {
    return path;
  }
  if (path.startsWith("/api/") || path.startsWith("api/")) {
    return apiUrl(path.startsWith("/") ? path : `/${path}`);
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (APP_BASE_URL === "/") return normalized;
  if (normalized.startsWith(APP_BASE_URL)) return normalized;
  return `${APP_BASE_URL}${normalized.slice(1)}`;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    /^(https?:)?\/\//i.test(trimmed) ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/api/") || trimmed.startsWith("api/")) {
    return apiUrl(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
  }
  if (trimmed.startsWith("/")) {
    return assetUrl(trimmed);
  }
  if (trimmed.startsWith("assets/")) {
    return assetUrl(`/${trimmed}`);
  }
  return trimmed;
}

export function appRouteUrl(routePath: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const cleanRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const fullPath =
    APP_BASE_URL === "/"
      ? cleanRoute
      : `${APP_BASE_URL.replace(/\/+$/, "")}${cleanRoute}`;
  return `${origin}${fullPath}`;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const isAbsoluteExternal =
    /^(https?:)?\/\//i.test(input) && (!API_BASE_URL || !input.startsWith(API_BASE_URL));
  const target = isAbsoluteExternal ? input : apiUrl(input);

  const headers = new Headers(init.headers || {});
  if (!isAbsoluteExternal && !headers.has("X-Requested-With")) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }

  return fetch(target, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}
