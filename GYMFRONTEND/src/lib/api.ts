"use client";

/**
 * The one place the browser talks to the API.
 *
 * The session lives in httpOnly cookies, so every request goes out with
 * `credentials: "include"` and nothing here ever handles a token. Writes carry
 * the CSRF cookie back as a header, which is the half of the double-submit
 * pair that a cross-site request cannot forge.
 */

/**
 * Same-origin by default: `/api/*` is rewritten to the real API in
 * `next.config.ts`, which keeps the session cookies first-party. Only set
 * `NEXT_PUBLIC_API_URL` to call an API origin directly, and expect to deal
 * with CORS and cross-site cookies if you do.
 */
const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "/api";

const CSRF_COOKIE = "ic_csrf";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function csrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));

  return match?.slice(CSRF_COOKIE.length + 1);
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Set on the retry after a refresh, so one 401 cannot loop. */
  retried?: boolean;
};

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  if (method !== "GET") {
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  // Access tokens are short-lived by design; rotate once and try again.
  if (response.status === 401 && !options.retried && path !== "/auth/refresh") {
    const refreshed = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: csrfToken() ? { "X-CSRF-Token": csrfToken()! } : {},
    });

    if (refreshed.ok) {
      return request<T>(path, { ...options, retried: true });
    }
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { message?: string | string[]; statusCode?: number }
    | null;

  if (!response.ok) {
    const raw = payload?.message;
    const message = Array.isArray(raw) ? (raw[0] ?? "Request failed") : raw;
    throw new ApiError(
      response.status,
      message ?? "Something went wrong",
      Array.isArray(raw) ? raw : undefined,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Turns any thrown value into something worth showing a person. */
export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.includes("fetch")) {
    return "Cannot reach the server. Is the API running?";
  }
  return "Something went wrong. Try again.";
}
