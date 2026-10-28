// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../test/setup";
import { queryClient } from "../../lib/query-client";
import { useAuthStore } from "../../stores/auth-store";
import { createApiStub, renderApp, resetSession } from "../../test/harness";

const GAMES = [
  {
    id: "g-easy",
    name: "Easy Twos",
    operations: ["mul"],
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
    operations: ["mul"],
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

function signedIn() {
  useAuthStore.setState({
    accessToken: "token-child",
    user: { id: "u-child", username: "child1", role: "user" },
  });
}

beforeEach(() => {
  resetSession();
  signedIn();
});

describe("T11 — dashboard", () => {
  it("case 1: the header shows the username, today's earned as clock value and logs out", async () => {
    const stub = createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 2700 },
      }),
      "GET /stats/heatmap": () => ({ data: { cells: [] } }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 0,
          correctTries: 0,
          timeEarnedSeconds: 0,
          timeLostSeconds: 0,
          timeBankSeconds: 2700,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
      "GET /stats/per-game": () => ({
        data: { user: { id: "u-child", username: "child1", timeBankSeconds: 2700 }, days: [] },
      }),
      "POST /auth/logout": () => ({ data: { ok: true } }),
    });
    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByTestId("header-username")).toHaveTextContent("child1");
    });
    expect(screen.getByTestId("header-today")).toHaveTextContent("+0:00");
    expect(screen.queryByTestId("header-bank")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByTestId("user-grid")).toBeInTheDocument();
    expect(stub.calls.some((call) => call.url === "/api/auth/logout")).toBe(true);
  });

  it("case 2: the heatmap renders exactly what the API returns (red → green)", async () => {
    let color = "red";
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({
        data: {
          cells: [
            { op: "mul", a: 2, b: 5, tries: 6, correct: 2, accuracy: 0.33, color },
            { op: "mul", a: 2, b: 6, tries: 0, correct: 0, accuracy: null, color: "none" },
          ],
        },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 6,
          correctTries: 2,
          timeEarnedSeconds: 20,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    });
    renderApp("/");

    const cell = await screen.findByTestId("cell-mul-2-5");
    expect(cell).toHaveAttribute("data-color", "red");

    color = "green";
    await queryClient.invalidateQueries({ queryKey: ["heatmap"] });

    await waitFor(() => {
      expect(screen.getByTestId("cell-mul-2-5")).toHaveAttribute("data-color", "green");
    });
  });

  it("case 3: cells without data are neutral gray and marked as 'no tries'", async () => {
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({
        data: {
          cells: [{ op: "mul", a: 2, b: 6, tries: 0, correct: 0, accuracy: null, color: "none" }],
        },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 0,
          correctTries: 0,
          timeEarnedSeconds: 0,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    });
    renderApp("/");

    const cell = await screen.findByTestId("cell-mul-2-6");
    expect(cell).toHaveAttribute("data-color", "none");
    expect(cell.className).toContain("bg-slate-200");
    expect(cell).toHaveAttribute("aria-label", expect.stringContaining("no tries"));
  });

  it("case 4: the today card shows earned time big and correct/attempts gray", async () => {
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({ data: { cells: [] } }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 6,
          correctTries: 2,
          timeEarnedSeconds: 20,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
      "GET /stats/per-game": () => ({
        data: { user: { id: "u-child", username: "child1", timeBankSeconds: 45 }, days: [] },
      }),
    });
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByTestId("daily-earned")).toHaveTextContent("+0:20");
    });
    expect(screen.getByTestId("daily-tries")).toHaveTextContent("2/6 correct today");
  });

  it("case 5: every assigned game shows its economics and opens the play screen", async () => {
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({ data: { cells: [] } }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 0,
          correctTries: 0,
          timeEarnedSeconds: 0,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    });
    const user = userEvent.setup();
    renderApp("/");

    expect(await screen.findByText("Easy Twos")).toBeInTheDocument();
    expect(screen.getByTestId("game-correct-g-easy")).toHaveTextContent("+0:10");
    expect(screen.getByTestId("game-wrong-g-easy")).toHaveTextContent("−0:05");
    expect(screen.getByText("Mixed Table")).toBeInTheDocument();
    // unassigned games never appear
    expect(screen.queryByText("Hard Sevens")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "Let's Play!" })[0] as HTMLElement);
    // the play screen opens with the chosen game
    expect(await screen.findByTestId("question")).toBeInTheDocument();
    expect(screen.getByTestId("header-username")).toHaveTextContent("child1");
  });

  it("case 6: an admin gets an Admin entry to /admin; a child does not", async () => {
    const dashboard = {
      "GET /stats/heatmap": () => ({ data: { cells: [] } }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 0,
          correctTries: 0,
          timeEarnedSeconds: 0,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    };
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      ...dashboard,
    });
    const childView = renderApp("/");
    await screen.findByTestId("header-username");
    expect(screen.queryByTestId("header-admin")).toBeNull();
    childView.unmount();

    resetSession();
    useAuthStore.setState({
      accessToken: "token-admin",
      user: { id: "u-admin", username: "admin", role: "admin" },
    });
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-admin", username: "admin", role: "admin", timeBankSeconds: 0 },
      }),
      ...dashboard,
      "GET /admin/users": () => ({ data: [] }),
      "GET /admin/games": () => ({ data: [] }),
      "GET /admin/leaderboard": () => ({ data: { today: [], last7Days: [] } }),
      "GET /admin/stats/daily": () => ({ data: [] }),
    });
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByTestId("header-admin");
    await user.click(screen.getByTestId("header-admin"));
    expect(await screen.findByTestId("admin-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("header-admin")).toHaveTextContent("Dashboard");
  });
});

describe("T30 — child home redesign", () => {
  const isoDate = (ago: number): string =>
    new Date(Date.now() - ago * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function perGamePayload() {
    const g = (
      gameId: string,
      totalTries: number,
      correctTries: number,
      timeEarnedSeconds: number,
      timeLostSeconds = 0,
    ) => ({ gameId, totalTries, correctTries, timeEarnedSeconds, timeLostSeconds });
    const t = (
      totalTries: number,
      correctTries: number,
      timeEarnedSeconds: number,
      timeLostSeconds = 0,
    ) => ({
      totalTries,
      correctTries,
      timeEarnedSeconds,
      timeLostSeconds,
    });
    return {
      user: { id: "u-child", username: "child1", timeBankSeconds: 45 },
      days: [
        { date: isoDate(6), totals: t(0, 0, 0), games: [] },
        { date: isoDate(5), totals: t(0, 0, 0), games: [] },
        { date: isoDate(4), totals: t(0, 0, 0), games: [] },
        { date: isoDate(3), totals: t(4, 3, 30, 5), games: [g("g-easy", 4, 3, 30, 5)] },
        { date: isoDate(2), totals: t(0, 0, 0), games: [] },
        {
          date: isoDate(1),
          totals: t(3, 2, 20, 5),
          games: [g("g-easy", 2, 2, 20), g("g-mixed", 1, 0, 0, 5)],
        },
        {
          date: isoDate(0),
          totals: t(3, 2, 20, 5),
          games: [g("g-easy", 2, 1, 10, 5), g("g-mixed", 1, 1, 10)],
        },
      ],
    };
  }

  function dashboardStub() {
    return createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({
        data: {
          cells: [{ op: "mul", a: 2, b: 5, tries: 1, correct: 1, accuracy: 1, color: "green" }],
        },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 3,
          correctTries: 2,
          timeEarnedSeconds: 20,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
      "GET /stats/per-game": () => ({ data: perGamePayload() }),
    });
  }

  it("case 1: the today card leads with big earned time and gray correct/attempts", async () => {
    dashboardStub();
    renderApp("/");

    expect(await screen.findByTestId("daily-card")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("daily-earned")).toHaveTextContent("+0:15");
    });
    expect(screen.getByTestId("daily-tries")).toHaveTextContent("2/3 correct today");
    expect(screen.getByTestId("daily-avg")).toHaveTextContent("avg +0:07 per turn");
    expect(screen.getByTestId("daily-gain")).toHaveTextContent("+0:20");
    expect(screen.getByTestId("daily-loss")).toHaveTextContent("−0:05");
  });

  it("case 2: every game row shows prices and the net today total", async () => {
    dashboardStub();
    renderApp("/");

    expect(await screen.findByTestId("game-g-easy")).toHaveTextContent("Easy Twos");
    expect(screen.getByTestId("game-correct-g-easy")).toHaveTextContent("Correct");
    expect(screen.getByTestId("game-correct-g-easy")).toHaveTextContent("+0:10");
    expect(screen.getByTestId("game-wrong-g-easy")).toHaveTextContent("Wrong");
    expect(screen.getByTestId("game-wrong-g-easy")).toHaveTextContent("−0:05");
    expect(screen.getByTestId("game-total-g-easy")).toHaveTextContent("Today: +0:05 (1/2)");
    expect(screen.getByTestId("game-total-g-mixed")).toHaveTextContent("Today: +0:10 (1/1)");
    expect(screen.getByTestId("game-wrong-g-mixed")).toHaveTextContent("−0:05");
  });

  it("case 3: the history lists active days with date, net gain and correct/attempts", async () => {
    dashboardStub();
    renderApp("/");

    const history = await screen.findByTestId("history-list");
    const rows = within(history).getAllByTestId(/^history-day-/);
    expect(rows).toHaveLength(3);
    // newest first: today on top
    expect(rows[0]?.getAttribute("data-testid")).toBe(`history-day-${isoDate(0)}`);
    expect(rows[1]?.getAttribute("data-testid")).toBe(`history-day-${isoDate(1)}`);
    expect(rows[2]?.getAttribute("data-testid")).toBe(`history-day-${isoDate(3)}`);
    const row = screen.getByTestId(`history-day-${isoDate(3)}`);
    expect(row).toHaveTextContent("+0:25");
    expect(row).toHaveTextContent("3/4");
    expect(row).toHaveTextContent("+0:30");
    expect(row).toHaveTextContent("−0:05");
    expect(screen.queryByTestId(`history-day-${isoDate(2)}`)).toBeNull();
  });

  it("case 4: the heatmap still renders below the history", async () => {
    dashboardStub();
    renderApp("/");

    await screen.findByTestId("history-list");
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    const main = screen.getByTestId("history-list").closest("main") as HTMLElement;
    expect(main.textContent?.indexOf("Last 7 days") ?? -1).toBeLessThan(
      main.textContent?.indexOf("Heatmap") ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("case 5: offline APIs show the banner and no section crashes", async () => {
    createApiStub({});
    renderApp("/");

    expect(await screen.findByTestId("offline-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("daily-earned")).toHaveTextContent("+0:00");
  });

  it("case 6: the today card refreshes on its own every 15 seconds", async () => {
    const live = { tries: 2, correct: 1, earned: 10, lost: 5 };
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({ data: { cells: [] } }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 0,
          correctTries: 0,
          timeEarnedSeconds: 0,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
      "GET /stats/per-game": () => ({
        data: {
          user: { id: "u-child", username: "child1", timeBankSeconds: 45 },
          days: [
            {
              date: "2026-10-22",
              totals: {
                totalTries: live.tries,
                correctTries: live.correct,
                timeEarnedSeconds: live.earned,
                timeLostSeconds: live.lost,
              },
              games: [
                {
                  gameId: "g-easy",
                  totalTries: live.tries,
                  correctTries: live.correct,
                  timeEarnedSeconds: live.earned,
                  timeLostSeconds: live.lost,
                },
              ],
            },
          ],
        },
      }),
    });
    renderApp("/");

    vi.useFakeTimers();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // net: 10 earned − 1 wrong × 5 penalty
      expect(screen.getByTestId("daily-earned")).toHaveTextContent("+0:05");

      live.earned = 30;
      live.tries = 4;
      live.correct = 3;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(screen.getByTestId("daily-earned")).toHaveTextContent("+0:25");
  });
});

describe("T35 — dashboard header shows today's gain", () => {
  function headerStub(earned: number, bank: number) {
    return createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: bank },
      }),
      "GET /stats/heatmap": () => ({ data: { cells: [] } }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 0,
          correctTries: 0,
          timeEarnedSeconds: earned,
          timeLostSeconds: 0,
          timeBankSeconds: bank,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
      "GET /stats/per-game": () => ({
        data: { user: { id: "u-child", username: "child1", timeBankSeconds: bank }, days: [] },
      }),
    });
  }

  it("case 1: today's earned leads, lifetime bank is gone from the header", async () => {
    headerStub(50, 453);
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByTestId("header-today")).toHaveTextContent("+0:50");
    });
    expect(screen.queryByTestId("header-bank")).toBeNull();
  });

  it("case 2: a fresh child sees +0:00", async () => {
    headerStub(0, 0);
    renderApp("/");

    expect(await screen.findByTestId("header-today")).toHaveTextContent("+0:00");
  });

  it("case 3: admin pages keep the bank pill", async () => {
    resetSession();
    useAuthStore.setState({
      accessToken: "token-admin",
      user: { id: "u-admin", username: "admin", role: "admin" },
    });
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-admin", username: "admin", role: "admin", timeBankSeconds: 0 },
      }),
      "GET /admin/users": () => ({ data: [] }),
      "GET /admin/games": () => ({ data: [] }),
      "GET /admin/leaderboard": () => ({ data: { today: [], last7Days: [] } }),
      "GET /admin/stats/daily": () => ({ data: [] }),
    });
    renderApp("/admin");

    expect(await screen.findByTestId("header-bank")).toBeInTheDocument();
    expect(screen.queryByTestId("header-today")).toBeNull();
  });
});

describe("T36 — per-game cards show correct / wrong / today total", () => {
  const isoDate = (ago: number): string =>
    new Date(Date.now() - ago * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const state = { tries: 3, correct: 2, earned: 20, lost: 5 };

  function t36Stub() {
    return createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({ data: { cells: [] } }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 3,
          correctTries: 2,
          timeEarnedSeconds: 20,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
      "GET /stats/per-game": () => ({
        data: {
          user: { id: "u-child", username: "child1", timeBankSeconds: 45 },
          days: [
            ...[6, 5, 4, 3, 2, 1].map((ago) => ({
              date: isoDate(ago),
              totals: { totalTries: 0, correctTries: 0, timeEarnedSeconds: 0, timeLostSeconds: 0 },
              games: [],
            })),
            {
              date: isoDate(0),
              totals: {
                totalTries: state.tries,
                correctTries: state.correct,
                timeEarnedSeconds: state.earned,
                timeLostSeconds: state.lost,
              },
              games: [
                {
                  gameId: "g-easy",
                  totalTries: state.tries,
                  correctTries: state.correct,
                  timeEarnedSeconds: state.earned,
                  timeLostSeconds: state.lost,
                },
              ],
            },
          ],
        },
      }),
    });
  }

  it("case 1: green Correct, red Wrong and the today total", async () => {
    t36Stub();
    renderApp("/");

    expect(await screen.findByTestId("game-correct-g-easy")).toHaveTextContent("Correct");
    expect(screen.getByTestId("game-correct-g-easy")).toHaveTextContent("+0:10");
    expect(screen.getByTestId("game-wrong-g-easy")).toHaveTextContent("Wrong");
    expect(screen.getByTestId("game-wrong-g-easy")).toHaveTextContent("−0:05");
    expect(screen.getByTestId("game-total-g-easy")).toHaveTextContent("Today: +0:15 (2/3)");
  });

  it("cases 2-3: zero wrong and unplayed games show zeros", async () => {
    t36Stub();
    renderApp("/");

    await screen.findByTestId("game-g-mixed");
    // Wrong always shows the per-mistake price, even with no misses yet.
    expect(screen.getByTestId("game-wrong-g-mixed")).toHaveTextContent("−0:05");
    expect(screen.getByTestId("game-total-g-mixed")).toHaveTextContent("Today: +0:00 (0/0)");
  });

  it("case 4: the rows refresh with the 15-second poll", async () => {
    state.tries = 3;
    state.correct = 2;
    state.earned = 20;
    t36Stub();
    renderApp("/");

    vi.useFakeTimers();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId("game-total-g-easy")).toHaveTextContent("(2/3)");

      state.tries = 4;
      state.correct = 3;
      state.earned = 30;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });
    } finally {
      vi.useRealTimers();
      state.tries = 3;
      state.correct = 2;
      state.earned = 20;
    }
    expect(screen.getByTestId("game-total-g-easy")).toHaveTextContent("Today: +0:25 (3/4)");
  });
});

describe("T48 — heatmap sections per operation", () => {
  it("case 3: played-only-+ shows data in + and all-neutral in ×", async () => {
    const mixedGames = [
      {
        id: "g-plus",
        name: "Plus Ones",
        operations: ["add"],
        rangeA: { min: 1, max: 2 },
        rangeB: { min: 1, max: 2 },
        allowedCombinations: null,
        variantCount: 3,
        baseTimeReward: 10,
        timePenalty: 5,
        maxDailyTime: 3600,
        questionSeconds: 15,
        hints: [],
      },
      {
        id: "g-times",
        name: "Times Ones",
        operations: ["mul"],
        rangeA: { min: 1, max: 2 },
        rangeB: { min: 1, max: 2 },
        allowedCombinations: null,
        variantCount: 3,
        baseTimeReward: 10,
        timePenalty: 5,
        maxDailyTime: 3600,
        questionSeconds: 15,
        hints: [],
      },
    ];
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({
        data: {
          cells: [
            { op: "add", a: 1, b: 1, tries: 4, correct: 3, accuracy: 0.75, color: "mixed" },
            { op: "add", a: 1, b: 2, tries: 0, correct: 0, accuracy: null, color: "none" },
            { op: "add", a: 2, b: 1, tries: 0, correct: 0, accuracy: null, color: "none" },
            { op: "add", a: 2, b: 2, tries: 0, correct: 0, accuracy: null, color: "none" },
            { op: "mul", a: 1, b: 1, tries: 0, correct: 0, accuracy: null, color: "none" },
            { op: "mul", a: 1, b: 2, tries: 0, correct: 0, accuracy: null, color: "none" },
            { op: "mul", a: 2, b: 1, tries: 0, correct: 0, accuracy: null, color: "none" },
            { op: "mul", a: 2, b: 2, tries: 0, correct: 0, accuracy: null, color: "none" },
          ],
        },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 4,
          correctTries: 3,
          timeEarnedSeconds: 30,
          timeLostSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: mixedGames }),
      "GET /stats/per-game": () => ({
        data: { user: { id: "u-child", username: "child1", timeBankSeconds: 45 }, days: [] },
      }),
    });
    renderApp("/");

    const plus = await screen.findByTestId("heatmap-section-add");
    expect(within(plus).getByTestId("cell-add-1-1")).toHaveAttribute("data-color", "mixed");
    const times = await screen.findByTestId("heatmap-section-mul");
    expect(within(times).getByTestId("cell-mul-1-1")).toHaveAttribute("data-color", "none");
    expect(within(times).getByTestId("cell-mul-2-2")).toHaveAttribute("data-color", "none");
  });
});
