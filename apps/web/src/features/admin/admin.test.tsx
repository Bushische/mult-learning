// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import "../../test/setup";
import type { AdminDailyRow, AdminUser, Game, LeaderboardRow } from "packages/shared";
import { ApiError, api } from "../../lib/api-client";
import { useAuthStore } from "../../stores/auth-store";
import { type ApiStub, createApiStub, renderApp, resetSession } from "../../test/harness";

const GAMES: Game[] = [
  {
    id: "g-easy",
    name: "Easy Twos",
    rangeA: { min: 2, max: 4 },
    rangeB: { min: 1, max: 4 },
    allowedCombinations: null,
    variantCount: 3,
    baseTimeReward: 10,
    timePenalty: 5,
    maxDailyTime: 3600,
    hints: [],
  },
  {
    id: "g-mixed",
    name: "Mixed Table",
    rangeA: { min: 1, max: 10 },
    rangeB: { min: 1, max: 10 },
    allowedCombinations: null,
    variantCount: 3,
    baseTimeReward: 10,
    timePenalty: 5,
    maxDailyTime: 3600,
    hints: [],
  },
];

interface StubUser extends AdminUser {
  pin: string;
}

interface ServerState {
  users: StubUser[];
  leaderboard: LeaderboardRow[];
  daily: AdminDailyRow[];
  /** token → username (the session of a logged-in user) */
  sessions: Record<string, string>;
}

function adminUser(username: string, role: "admin" | "user", bank = 0): StubUser {
  return {
    id: `u-${username}`,
    username,
    role,
    timeBankSeconds: bank,
    games: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    pin: role === "admin" ? "1289" : "2468",
  };
}

function installServer(): { state: ServerState; stub: ApiStub } {
  const state: ServerState = {
    users: [adminUser("admin", "admin"), adminUser("child1", "user", 45)],
    leaderboard: [
      { userId: "u-child1", username: "child1", timeEarnedSeconds: 45, accuracy: 0.83 },
      { userId: "u-child2", username: "child2", timeEarnedSeconds: 10, accuracy: 0.5 },
    ],
    daily: [
      {
        userId: "u-child1",
        username: "child1",
        totalTries: 6,
        correctTries: 5,
        timeEarnedSeconds: 45,
        timeBankSeconds: 45,
      },
    ],
    sessions: { "token-admin": "admin" },
  };

  const publicUser = (user: StubUser) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    timeBankSeconds: user.timeBankSeconds,
    games: user.games,
    createdAt: user.createdAt,
  });

  const stub = createApiStub({
    "GET /users": () => ({
      data: state.users.map((user) => ({ id: user.id, username: user.username })),
    }),
    "GET /me": (call) => {
      const token = tokenOf(call);
      const username = token ? state.sessions[token] : undefined;
      const user = state.users.find((entry) => entry.username === username);
      if (!user) {
        return { status: 401, data: { error: { code: "UNAUTHORIZED", message: "nope" } } };
      }
      return {
        data: {
          id: user.id,
          username: user.username,
          role: user.role,
          timeBankSeconds: user.timeBankSeconds,
        },
      };
    },
    "POST /auth/login": (call) => {
      const body = call.body as { username: string; pin: string };
      const user = state.users.find((entry) => entry.username === body.username);
      if (!user || user.pin !== body.pin) {
        return { status: 401, data: { error: { code: "UNAUTHORIZED", message: "nope" } } };
      }
      const token = `token-${user.username}-${user.pin}`;
      state.sessions[token] = user.username;
      return {
        data: {
          accessToken: token,
          user: { id: user.id, username: user.username, role: user.role },
        },
      };
    },
    "POST /auth/refresh": () => ({
      status: 401,
      data: { error: { code: "UNAUTHORIZED", message: "nope" } },
    }),
    "GET /admin/users": () => ({ data: state.users.map(publicUser) }),
    "GET /admin/games": () => ({ data: GAMES }),
    "GET /admin/leaderboard": () => ({ data: state.leaderboard }),
    "GET /admin/stats/daily": () => ({ data: state.daily }),
    "POST /admin/users": (call) => {
      const body = call.body as { username: string; pin: string; role?: "admin" | "user" };
      if (state.users.some((user) => user.username === body.username)) {
        return { status: 409, data: { error: { code: "CONFLICT", message: "taken" } } };
      }
      const created: StubUser = {
        ...adminUser(body.username, body.role ?? "user"),
        pin: body.pin,
      };
      state.users.push(created);
      return { status: 201, data: publicUser(created) };
    },
    "PATCH /admin/users/:id": (call) => {
      const id = call.url.split("/").pop() as string;
      const user = state.users.find((entry) => entry.id === id);
      if (!user) {
        return { status: 404, data: { error: { code: "NOT_FOUND", message: "nope" } } };
      }
      const body = call.body as { username?: string; pin?: string; role?: "admin" | "user" };
      if (body.username) user.username = body.username;
      if (body.role) user.role = body.role;
      if (body.pin) {
        user.pin = body.pin;
        // a new PIN invalidates the sessions of that user
        for (const [token, username] of Object.entries(state.sessions)) {
          if (username === user.username) delete state.sessions[token];
        }
      }
      return { data: publicUser(user) };
    },
    "DELETE /admin/users/:id": (call) => {
      const id = call.url.split("/").pop() as string;
      state.users = state.users.filter((entry) => entry.id !== id);
      return { status: 204 };
    },
    "PUT /admin/users/:id/games": (call) => {
      const id = call.url.split("/").slice(-2, -1)[0] as string;
      const body = call.body as { gameIds: string[] };
      const user = state.users.find((entry) => entry.id === id);
      if (!user) {
        return { status: 404, data: { error: { code: "NOT_FOUND", message: "nope" } } };
      }
      user.games = body.gameIds;
      return { data: body.gameIds };
    },
    "POST /admin/users/:id/reset": (call) => {
      const id = call.url.split("/").slice(-2, -1)[0] as string;
      const user = state.users.find((entry) => entry.id === id);
      if (!user) {
        return { status: 404, data: { error: { code: "NOT_FOUND", message: "nope" } } };
      }
      user.timeBankSeconds = 0;
      const row = state.daily.find((entry) => entry.userId === id);
      if (row) {
        row.totalTries = 0;
        row.correctTries = 0;
        row.timeEarnedSeconds = 0;
        row.timeBankSeconds = 0;
      }
      return { status: 204 };
    },
  });

  return { state, stub };
}

function tokenOf(call: { headers: Record<string, string> }): string | null {
  const header = call.headers.Authorization ?? call.headers.authorization;
  if (!header) return null;
  return header.replace("Bearer ", "");
}

beforeEach(() => {
  resetSession();
  useAuthStore.setState({
    accessToken: "token-admin",
    user: { id: "u-admin", username: "admin", role: "admin" },
  });
});

describe("T13 — admin panel", () => {
  it("case 1: a child (or a logged-out visitor) is sent to the login screen", async () => {
    installServer();
    useAuthStore.setState({
      accessToken: "token-child1",
      user: { id: "u-child1", username: "child1", role: "user" },
    });
    renderApp("/admin");
    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();

    resetSession();
    renderApp("/admin");
    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();
  });

  it("case 2: the admin creates child2 and it shows up on the login grid", async () => {
    installServer();
    const user = userEvent.setup();
    const view = renderApp("/admin");

    await user.click(await screen.findByRole("button", { name: "Users" }));
    await user.type(screen.getByLabelText("New username"), "child2");
    await user.type(screen.getByLabelText("New PIN"), "1357");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByTestId("user-child2")).toBeInTheDocument();

    view.unmount();
    resetSession();
    renderApp("/login");
    expect(await screen.findByRole("button", { name: "child2" })).toBeInTheDocument();
  });

  it("case 3: assigning two games is stored with PUT and shows up for the child", async () => {
    const { stub } = installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    await user.click(await screen.findByRole("button", { name: "Users" }));
    const games = await screen.findByTestId("games-child1");
    const boxes = games.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    await user.click(boxes[0] as HTMLInputElement);
    await user.click(boxes[1] as HTMLInputElement);
    await user.click(within(games).getByRole("button", { name: "Save games" }));

    await waitFor(() => {
      const put = stub.calls.find((call) => call.method === "PUT");
      expect(put?.body).toMatchObject({ gameIds: ["g-easy", "g-mixed"] });
    });
  });

  it("case 4: changing the PIN invalidates the old session, the new PIN works", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    await user.click(await screen.findByRole("button", { name: "Users" }));
    const childRow = screen.getByTestId("user-child1");
    await user.click(within(childRow).getByRole("button", { name: "Edit" }));
    const pinField = within(childRow).getByLabelText("New PIN (4 digits)");
    await user.clear(pinField);
    await user.type(pinField, "9999");
    await user.click(within(childRow).getByRole("button", { name: "Save" }));

    // the old session of child1 is dead
    useAuthStore.setState({ accessToken: "token-child1" });
    let caught: unknown;
    try {
      await api.get("/me");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(401);

    // the new PIN logs in
    const response = await api.post("/auth/login", { username: "child1", pin: "9999" });
    expect(response).toMatchObject({ user: { username: "child1" } });
  });

  it("case 5: the leaderboard shows the API order and formats the numbers", async () => {
    installServer();
    renderApp("/admin");

    const rows = await screen.findAllByTestId(/^row-/);
    expect(rows[0]).toHaveTextContent("child1");
    expect(rows[1]).toHaveTextContent("child2");
    expect(screen.getByTestId("score-child1")).toHaveTextContent("+45s · 83%");
    expect(screen.getByTestId("score-child2")).toHaveTextContent("+10s · 50%");
  });

  it("case 6: the reset needs a confirmation and then zeroes the bank", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    await user.click(await screen.findByRole("button", { name: "Users" }));
    const row = await screen.findByTestId("user-child1");
    expect(row).toHaveTextContent("0:45 bank");

    await user.click(
      within(screen.getByTestId("user-child1")).getByRole("button", {
        name: "Reset Progress / Heatmap",
      }),
    );
    expect(await screen.findByTestId("confirm-child1")).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId("confirm-child1")).getByRole("button", { name: "Yes, reset" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-child1")).toHaveTextContent("0:00 bank");
    });
  });
});
