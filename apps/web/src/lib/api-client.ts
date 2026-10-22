import { refreshResponseSchema } from "packages/shared";
import type { z } from "zod";
import { useAuthStore } from "../stores/auth-store";

/** Base path of the API (the web dev server proxies it to the api container). */
export const API_BASE = "/api";

export type Transport = (input: string, init?: RequestInit) => Promise<Response>;

let transport: Transport = (input, init) => globalThis.fetch(input, init);

/** Replace the transport (tests inject a fetch stub). */
export function setTransport(next: Transport): void {
  transport = next;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiRequestOptions<T = unknown> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send the Bearer token + try a silent refresh on 401 (default: true). */
  auth?: boolean;
  /** Validate the response with a zod schema. */
  schema?: z.ZodType<T>;
}

async function readError(response: Response): Promise<ApiError> {
  let code = "VALIDATION_ERROR";
  let message = response.statusText || "Request failed";
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // keep the defaults
  }
  return new ApiError(response.status, code, message);
}

async function send(
  path: string,
  method: string,
  body: unknown,
  token: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return transport(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Silent refresh — one request at a time (single flight), the rotated cookie
 * is sent by the browser automatically.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    const request = (async (): Promise<string | null> => {
      try {
        const response = await send("/auth/refresh", "POST", undefined, null);
        if (!response.ok) return null;
        const parsed = refreshResponseSchema.parse(await response.json());
        useAuthStore.getState().setSession(parsed.accessToken, parsed.user);
        return parsed.accessToken;
      } catch {
        return null;
      }
    })();
    refreshInFlight = request.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Perform an API call: Bearer token from memory, one silent refresh retry on 401. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions<T> = {}): Promise<T> {
  const { method = "GET", body, auth = true, schema } = options;
  const token = auth ? useAuthStore.getState().accessToken : null;

  let response = await send(path, method, body, token);
  if (response.status === 401 && auth) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      response = await send(path, method, body, fresh);
    }
  }
  if (!response.ok) {
    throw await readError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json();
  return schema ? schema.parse(data) : (data as T);
}

export const api = {
  get: <T>(path: string, schema?: z.ZodType<T>) => apiRequest<T>(path, { schema }),
  post: <T>(path: string, body?: unknown, schema?: z.ZodType<T>) =>
    apiRequest<T>(path, { method: "POST", body, schema }),
  put: <T>(path: string, body?: unknown, schema?: z.ZodType<T>) =>
    apiRequest<T>(path, { method: "PUT", body, schema }),
  patch: <T>(path: string, body?: unknown, schema?: z.ZodType<T>) =>
    apiRequest<T>(path, { method: "PATCH", body, schema }),
  delete: <T>(path: string, schema?: z.ZodType<T>) =>
    apiRequest<T>(path, { method: "DELETE", schema }),
};
