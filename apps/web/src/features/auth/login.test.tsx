// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import "../../test/setup";
import { createApiStub, renderApp, resetSession } from "../../test/harness";

const USERS = [
  { id: "u-admin", username: "admin" },
  { id: "u-child", username: "child1" },
];

function baseHandlers() {
  return {
    "GET /users": () => ({ data: USERS }),
    "POST /auth/login": (call: { body: unknown }) => {
      const body = call.body as { username: string; pin: string };
      if (body.username === "child1" && body.pin === "2468") {
        return {
          data: {
            accessToken: "token-child",
            user: { id: "u-child", username: "child1", role: "user" },
          },
        };
      }
      return {
        status: 401,
        data: { error: { code: "UNAUTHORIZED", message: "Invalid username or PIN" } },
      };
    },
    "GET /me": () => ({
      data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
    }),
    "POST /auth/logout": () => ({ data: { ok: true } }),
  };
}

beforeEach(() => {
  resetSession();
});

describe("T10 — login flow", () => {
  it("case 1: the login page lists the users as tappable tiles", async () => {
    createApiStub(baseHandlers());
    renderApp("/login");

    const admin = await screen.findByRole("button", { name: "admin" });
    const child = await screen.findByRole("button", { name: "child1" });
    expect(admin).toBeInTheDocument();
    expect(child).toBeInTheDocument();
    // touch targets are bigger than 40 px
    expect(child.className).toMatch(/min-h-\[/);
  });

  it("case 2: a wrong PIN shows an inline error, the right one lands on the dashboard", async () => {
    createApiStub(baseHandlers());
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "child1" }));
    expect(await screen.findByTestId("pin-pad")).toBeInTheDocument();

    for (const key of ["1", "1", "1", "1"]) {
      await user.click(screen.getByRole("button", { name: key }));
    }
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong PIN");
    expect(screen.getByTestId("pin-pad")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "C" }));
    for (const key of ["2", "4", "6", "8"]) {
      await user.click(screen.getByRole("button", { name: key }));
    }

    expect(await screen.findByTestId("header-username")).toHaveTextContent("child1");
    await waitFor(() => {
      expect(screen.getByTestId("header-today")).toHaveTextContent("+0:00");
    });
  });

  it("case 3: a fresh session is restored silently via /auth/refresh", async () => {
    const stub = createApiStub({
      ...baseHandlers(),
      "POST /auth/refresh": () => ({
        data: {
          accessToken: "token-child",
          user: { id: "u-child", username: "child1", role: "user" },
        },
      }),
    });
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByTestId("header-username")).toHaveTextContent("child1");
    });
    expect(stub.calls.some((call) => call.url === "/api/auth/refresh")).toBe(true);
    expect(screen.queryByTestId("pin-pad")).toBeNull();
  });

  it("case 4: /admin redirects to the login screen when there is no session", async () => {
    createApiStub({
      ...baseHandlers(),
      "POST /auth/refresh": () => ({
        status: 401,
        data: { error: { code: "UNAUTHORIZED", message: "Missing refresh token" } },
      }),
    });
    renderApp("/admin");

    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("header-username")).toBeNull();
  });

  it("case 5: logout clears the session and returns to the login screen", async () => {
    const stub = createApiStub(baseHandlers());
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "child1" }));
    for (const key of ["2", "4", "6", "8"]) {
      await user.click(screen.getByRole("button", { name: key }));
    }
    await waitFor(() => {
      expect(screen.getByTestId("header-username")).toHaveTextContent("child1");
    });

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();
    expect(stub.calls.some((call) => call.url === "/api/auth/logout")).toBe(true);
  });
});
