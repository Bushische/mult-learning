// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import "../test/setup";
import { useAuthStore } from "../stores/auth-store";
import { createApiStub, renderApp, resetSession } from "../test/harness";
import { PwaUpdater } from "./PwaUpdater";
import { apiRuntimeCaching } from "./runtime-caching";

beforeEach(() => {
  resetSession();
  useAuthStore.setState({
    accessToken: "token-child",
    user: { id: "u-child", username: "child1", role: "user" },
  });
});

describe("T15 — PWA", () => {
  it("case 3: a component using virtual:pwa-register/react runs without the plugin", () => {
    createApiStub({});
    render(<PwaUpdater />);
    // the stub reports "offline ready" — the component renders without errors
    expect(screen.getByTestId("pwa-offline-ready")).toBeInTheDocument();
  });

  it("case 4a: /api is never served from the service worker cache", () => {
    const apiRule = apiRuntimeCaching.find((rule) => rule.urlPattern.test("/api/stats/heatmap"));
    expect(apiRule).toBeTruthy();
    expect(apiRule?.handler).toBe("NetworkOnly");
  });

  it("case 4b: an offline api call shows an error state instead of stale data", async () => {
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({
        status: 503,
        data: { error: { code: "VALIDATION_ERROR", message: "offline" } },
      }),
      "GET /stats/daily": () => ({
        status: 503,
        data: { error: { code: "VALIDATION_ERROR", message: "offline" } },
      }),
      "GET /games": () => ({
        status: 503,
        data: { error: { code: "VALIDATION_ERROR", message: "offline" } },
      }),
    });
    renderApp("/");
    expect(await screen.findByTestId("offline-banner")).toHaveTextContent("You are offline");
    // no stale cells are rendered
    expect(screen.queryByTestId("heatmap")).toBeNull();
  });
});
