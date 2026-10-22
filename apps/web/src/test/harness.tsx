import { QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { type Transport, setTransport } from "../lib/api-client";
import { queryClient } from "../lib/query-client";
import { useAuthStore } from "../stores/auth-store";

export interface StubCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface StubResponse {
  status?: number;
  data?: unknown;
}

export type StubHandler = (call: StubCall) => StubResponse;

export interface ApiStub {
  calls: StubCall[];
  transport: Transport;
}

/** Build a fake `Response` (only the bits the api client uses). */
export function fakeResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
  } as Response;
}

/**
 * Install a fetch stub. The handlers are keyed by `"<METHOD> <path>"`,
 * e.g. `"GET /api/users"`.
 */
export function createApiStub(handlers: Record<string, StubHandler>): ApiStub {
  const calls: StubCall[] = [];
  const transport: Transport = async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers;
    if (rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)) {
      Object.assign(headers, rawHeaders as Record<string, string>);
    }
    const call: StubCall = { url, method, body, headers };
    calls.push(call);
    const key = `${method} ${url.replace("/api", "")}`;
    const handler =
      handlers[key] ?? handlers[`${method} ${url}`] ?? findPatternHandler(handlers, key);
    if (!handler) {
      return fakeResponse(404, { error: { code: "NOT_FOUND", message: `no stub for ${key}` } });
    }
    const result = handler(call);
    return fakeResponse(result.status ?? 200, result.data ?? {});
  };
  setTransport(transport);
  return { calls, transport };
}

/** Match a pattern key like `"POST /admin/users/:id/reset"` against a concrete key. */
function findPatternHandler(
  handlers: Record<string, StubHandler>,
  key: string,
): StubHandler | undefined {
  for (const [pattern, handler] of Object.entries(handlers)) {
    if (!pattern.includes(":")) continue;
    const parts = pattern.split(/(:[^/]+)/);
    const source = parts
      .map((part) => (part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("");
    if (new RegExp(`^${source}$`).test(key)) return handler;
  }
  return undefined;
}

/** Reset the in-memory session + query cache between tests. */
export function resetSession(): void {
  useAuthStore.setState({ accessToken: null, user: null });
  queryClient.clear();
}

export function renderApp(initialPath = "/"): RenderResult {
  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
