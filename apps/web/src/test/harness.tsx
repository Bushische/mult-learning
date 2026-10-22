import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { type Transport, setTransport } from "../lib/api-client";
import { useAuthStore } from "../stores/auth-store";

export interface StubCall {
  url: string;
  method: string;
  body: unknown;
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
    const call: StubCall = { url, method, body };
    calls.push(call);
    const key = `${method} ${url.replace("/api", "")}`;
    const handler = handlers[key] ?? handlers[`${method} ${url}`];
    if (!handler) {
      return fakeResponse(404, { error: { code: "NOT_FOUND", message: `no stub for ${key}` } });
    }
    const result = handler(call);
    return fakeResponse(result.status ?? 200, result.data ?? {});
  };
  setTransport(transport);
  return { calls, transport };
}

/** Reset the in-memory session between tests. */
export function resetSession(): void {
  useAuthStore.setState({ accessToken: null, user: null });
}

export function renderApp(initialPath = "/"): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
