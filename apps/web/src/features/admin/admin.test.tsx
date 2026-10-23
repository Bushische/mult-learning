// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../test/setup";
import type { AdminDailyRow, AdminUser, Game, LeaderboardResponse } from "@mult/shared";
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
    questionSeconds: 15,
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
    questionSeconds: 15,
    hints: [],
  },
];

interface StubUser extends AdminUser {
  pin: string;
}

interface ServerState {
  users: StubUser[];
  leaderboard: LeaderboardResponse;
  daily: AdminDailyRow[];
  /** token → username (the session of a logged-in user) */
  sessions: Record<string, string>;
  /** added to today's per-game earned seconds (live-refresh test mutates it) */
  perGameBump: number;
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
    leaderboard: {
      today: [
        { userId: "u-child2", username: "child2", timeEarnedSeconds: 120, accuracy: 1 },
        { userId: "u-child1", username: "child1", timeEarnedSeconds: 60, accuracy: 0.83 },
        { userId: "u-child3", username: "child3", timeEarnedSeconds: 0, accuracy: null },
      ],
      last7Days: [
        { userId: "u-child2", username: "child2", timeEarnedSeconds: 300, accuracy: 0.9 },
        { userId: "u-child1", username: "child1", timeEarnedSeconds: 45, accuracy: 0.83 },
      ],
    },
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
    perGameBump: 0,
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
    "GET /admin/users/:id/stats": (call) => {
      const id = call.url.split("/").slice(-2, -1)[0] as string;
      if (id !== "u-child1") {
        return { status: 404, data: { error: { code: "NOT_FOUND", message: "nope" } } };
      }
      return {
        data: {
          user: { id: "u-child1", username: "child1", timeBankSeconds: 45 },
          heatmap: [
            { a: 2, b: 5, tries: 1, correct: 1, accuracy: 1, color: "green" },
            { a: 2, b: 6, tries: 0, correct: 0, accuracy: null, color: "none" },
          ],
          last7Days: { attempts: 14, correct: 11, incorrect: 3, earnedSeconds: 70 },
        },
      };
    },
    "GET /admin/users/:id/per-game": (call) => {
      const id = call.url.split("/").slice(-2, -1)[0] as string;
      if (id !== "u-child1") {
        return { status: 404, data: { error: { code: "NOT_FOUND", message: "nope" } } };
      }
      const iso = (ago: number) =>
        new Date(Date.now() - ago * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const g = (
        gameId: string,
        totalTries: number,
        correctTries: number,
        timeEarnedSeconds: number,
      ) => ({
        gameId,
        totalTries,
        correctTries,
        timeEarnedSeconds,
      });
      const t = (totalTries: number, correctTries: number, timeEarnedSeconds: number) => ({
        totalTries,
        correctTries,
        timeEarnedSeconds,
      });
      return {
        data: {
          user: { id: "u-child1", username: "child1", timeBankSeconds: 45 },
          days: [
            { date: iso(6), totals: t(0, 0, 0), games: [] },
            { date: iso(5), totals: t(0, 0, 0), games: [] },
            // Legacy day: totals exist, no per-game breakdown (recorded before T28).
            { date: iso(4), totals: t(5, 4, 40), games: [] },
            { date: iso(3), totals: t(4, 3, 30), games: [g("g-easy", 4, 3, 30)] },
            { date: iso(2), totals: t(0, 0, 0), games: [] },
            {
              date: iso(1),
              totals: t(3, 2, 20),
              games: [g("g-easy", 2, 2, 20), g("g-mixed", 1, 0, 0)],
            },
            {
              date: iso(0),
              totals: t(3, 2, 20 + state.perGameBump),
              games: [g("g-easy", 2, 1, 10 + state.perGameBump), g("g-mixed", 1, 1, 10)],
            },
          ],
        },
      };
    },
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

  it("T18 case 1+4: today ranks first, both tables show clock values, null accuracy is 0%", async () => {
    installServer();
    renderApp("/admin");

    const today = await screen.findByTestId("leaderboard-today");
    const week = await screen.findByTestId("leaderboard-7days");
    // DOM order: the Today table appears before Last 7 days
    expect(today.compareDocumentPosition(week)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // independent rankings per window
    const todayRows = within(today).getAllByTestId(/^leaderboard-today-row-/);
    expect(todayRows[0]).toHaveTextContent("child2");
    expect(todayRows[1]).toHaveTextContent("child1");
    const weekRows = within(week).getAllByTestId(/^leaderboard-7days-row-/);
    expect(weekRows[0]).toHaveTextContent("child2");
    expect(weekRows[1]).toHaveTextContent("child1");

    // clock format, no bare seconds
    expect(screen.getByTestId("leaderboard-today-score-child2")).toHaveTextContent("2:00 · 100%");
    expect(screen.getByTestId("leaderboard-today-score-child1")).toHaveTextContent("1:00 · 83%");
    expect(screen.getByTestId("leaderboard-7days-score-child1")).toHaveTextContent("0:45 · 83%");
    // a child with no tries has accuracy null and renders 0%
    expect(screen.getByTestId("leaderboard-today-score-child3")).toHaveTextContent("0:00 · 0%");
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

  it("T17 case 4: the admin stats tab shows earned time as a clock value", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    await user.click(await screen.findByRole("button", { name: "Stats" }));
    const row = await screen.findByTestId("daily-row-child1");
    expect(row).toHaveTextContent("+0:45");
    expect(row).not.toHaveTextContent("+45s");
  });
});

describe("T19 — child stats page links", () => {
  it("case 1: clicking a name in the today table opens the child's stats page", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    const today = await screen.findByTestId("leaderboard-today");
    const link = await within(today).findByRole("link", { name: "child1" });
    await user.click(link);

    expect(await screen.findByTestId("user-stats-name")).toHaveTextContent("child1");
    expect(screen.getByTestId("back-to-admin")).toBeInTheDocument();
  });

  it("case 2: clicking a name in the 7-day table opens the same page", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    const week = await screen.findByTestId("leaderboard-7days");
    const link = await within(week).findByRole("link", { name: "child1" });
    await user.click(link);

    expect(await screen.findByTestId("user-stats-name")).toHaveTextContent("child1");
  });

  it("case 3: a deep link renders the name and bank, the back link returns to /admin", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin/users/u-child1/stats");

    expect(await screen.findByTestId("user-stats-name")).toHaveTextContent("child1");
    expect(screen.getByTestId("user-stats-bank")).toHaveTextContent("0:45 bank");

    await user.click(screen.getByTestId("back-to-admin"));
    expect(await screen.findByTestId("leaderboard-today")).toBeInTheDocument();
  });

  it("case 4: an unknown user id renders 'User not found'", async () => {
    installServer();
    renderApp("/admin/users/u-nope/stats");

    expect(await screen.findByTestId("user-not-found")).toHaveTextContent("User not found");
  });

  it("case 5: a logged-out visitor lands on login, a child is redirected out", async () => {
    installServer();

    resetSession();
    const first = renderApp("/admin/users/u-child1/stats");
    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();
    first.unmount();

    resetSession();
    useAuthStore.setState({
      accessToken: "token-child1",
      user: { id: "u-child1", username: "child1", role: "user" },
    });
    renderApp("/admin/users/u-child1/stats");
    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();
  });
});

describe("T20 — child stats heatmap + week summary", () => {
  it("case 6: the page renders the four totals and the heatmap from the endpoint", async () => {
    installServer();
    renderApp("/admin/users/u-child1/stats");

    expect(await screen.findByTestId("week-attempts")).toHaveTextContent("Attempts: 14");
    expect(screen.getByTestId("week-correct")).toHaveTextContent("Correct: 11");
    expect(screen.getByTestId("week-incorrect")).toHaveTextContent("Incorrect: 3");
    expect(screen.getByTestId("week-earned")).toHaveTextContent("Earned: 1:10");
    expect(screen.getByTestId("cell-2-5")).toHaveAttribute("data-color", "green");
    expect(screen.getByTestId("cell-2-6")).toHaveAttribute("data-color", "none");
  });
});

describe("T29 — jump to child stats from User management", () => {
  it("case 1: tapping Stats opens the child's stats page", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    await user.click(await screen.findByRole("button", { name: "Users" }));
    await user.click(await screen.findByTestId("stats-link-child1"));

    expect(await screen.findByTestId("user-stats-name")).toHaveTextContent("child1");
  });

  it("case 2: Back to admin returns to the panel", async () => {
    installServer();
    const user = userEvent.setup();
    renderApp("/admin");

    await user.click(await screen.findByRole("button", { name: "Users" }));
    await user.click(await screen.findByTestId("stats-link-child1"));
    await user.click(await screen.findByTestId("back-to-admin"));

    expect(await screen.findByTestId("admin-tabs")).toBeInTheDocument();
  });

  it("case 3: a non-admin opening /admin is redirected out", async () => {
    installServer();
    resetSession();
    useAuthStore.setState({
      accessToken: "token-child1",
      user: { id: "u-child1", username: "child1", role: "user" },
    });
    renderApp("/admin");

    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();
  });
});

describe("T28 — readable child stats with per-game results", () => {
  const isoDate = (ago: number): string =>
    new Date(Date.now() - ago * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  it("case 1: the header shows today's earned plus per-game results", async () => {
    const { state } = installServer();
    state.users.find((user) => user.username === "child1")!.games = ["g-easy", "g-mixed"];
    renderApp("/admin/users/u-child1/stats");

    expect(await screen.findByTestId("user-stats-today")).toHaveTextContent("+0:20");
    expect(screen.getByTestId("user-stats-today")).toHaveTextContent("today");
    expect(screen.getByTestId("today-game-g-easy")).toHaveTextContent("Easy Twos");
    expect(screen.getByTestId("today-game-g-easy")).toHaveTextContent("+0:10");
    expect(screen.getByTestId("today-game-g-easy")).toHaveTextContent("1/2");
    expect(screen.getByTestId("today-game-g-mixed")).toHaveTextContent("Mixed Table");
    expect(screen.getByTestId("today-game-g-mixed")).toHaveTextContent("1/1");
  });

  it("case 2: the 7-day table has a row per day and a column per game", async () => {
    const { state } = installServer();
    state.users.find((user) => user.username === "child1")!.games = ["g-easy", "g-mixed"];
    renderApp("/admin/users/u-child1/stats");

    const table = await screen.findByTestId("week-table");
    expect(within(table).getByText("Easy Twos")).toBeInTheDocument();
    expect(within(table).getByText("Mixed Table")).toBeInTheDocument();
    expect(within(table).getByText("Total")).toBeInTheDocument();
    expect(within(table).getAllByTestId(/^week-row-/)).toHaveLength(7);

    const played = screen.getByTestId(`week-cell-${isoDate(3)}-g-easy`);
    expect(played).toHaveTextContent("+0:30");
    expect(played).toHaveTextContent("3/4");
    const idle = screen.getByTestId(`week-cell-${isoDate(2)}-g-easy`);
    expect(idle).toHaveTextContent("—");
    // Legacy day: the Total column shows the day's numbers, game cells stay dashed.
    const legacyTotal = screen.getByTestId(`week-total-${isoDate(4)}`);
    expect(legacyTotal).toHaveTextContent("+0:40");
    expect(legacyTotal).toHaveTextContent("4/5");
    expect(screen.getByTestId(`week-cell-${isoDate(4)}-g-easy`)).toHaveTextContent("—");
  });

  it("case 3: no assigned games shows a message and no table", async () => {
    installServer();
    renderApp("/admin/users/u-child1/stats");

    expect(await screen.findByTestId("user-stats-games")).toHaveTextContent("No games assigned.");
    expect(screen.queryByTestId("week-table")).toBeNull();
  });
});

describe("T34 — stat pages refresh on their own", () => {
  it("case 2: the child-stats page updates in place after 15 seconds", async () => {
    const { state } = installServer();
    state.users.find((user) => user.username === "child1")!.games = ["g-easy", "g-mixed"];
    renderApp("/admin/users/u-child1/stats");

    vi.useFakeTimers();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId("today-game-g-easy")).toHaveTextContent("+0:10");

      state.perGameBump = 20;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(screen.getByTestId("today-game-g-easy")).toHaveTextContent("+0:30");
  });
});
