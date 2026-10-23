// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import "../../test/setup";
import { queryClient } from "../../lib/query-client";
import { useAuthStore } from "../../stores/auth-store";
import { createApiStub, renderApp, resetSession } from "../../test/harness";

const GAMES = [
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
  it("case 1: the header shows the username, the bank as M:SS and logs out", async () => {
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
          timeBankSeconds: 2700,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
      "POST /auth/logout": () => ({ data: { ok: true } }),
    });
    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByTestId("header-username")).toHaveTextContent("child1");
    });
    expect(screen.getByTestId("header-bank")).toHaveTextContent("45:00");

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
            { a: 2, b: 5, tries: 6, correct: 2, accuracy: 0.33, color },
            { a: 2, b: 6, tries: 0, correct: 0, accuracy: null, color: "none" },
          ],
        },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 6,
          correctTries: 2,
          timeEarnedSeconds: 20,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    });
    renderApp("/");

    const cell = await screen.findByTestId("cell-2-5");
    expect(cell).toHaveAttribute("data-color", "red");

    color = "green";
    await queryClient.invalidateQueries({ queryKey: ["heatmap"] });

    await waitFor(() => {
      expect(screen.getByTestId("cell-2-5")).toHaveAttribute("data-color", "green");
    });
  });

  it("case 3: cells without data are neutral gray and marked as 'no tries'", async () => {
    createApiStub({
      "GET /me": () => ({
        data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: 45 },
      }),
      "GET /stats/heatmap": () => ({
        data: {
          cells: [{ a: 2, b: 6, tries: 0, correct: 0, accuracy: null, color: "none" }],
        },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 0,
          correctTries: 0,
          timeEarnedSeconds: 0,
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    });
    renderApp("/");

    const cell = await screen.findByTestId("cell-2-6");
    expect(cell).toHaveAttribute("data-color", "none");
    expect(cell.className).toContain("bg-slate-200");
    expect(cell).toHaveAttribute("aria-label", expect.stringContaining("no tries"));
  });

  it("case 4: the daily card shows today's tries, correct answers and earned seconds", async () => {
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
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    });
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByTestId("daily-tries")).toHaveTextContent("6 tries");
    });
    expect(screen.getByTestId("daily-tries")).toHaveTextContent("2 correct");
    expect(screen.getByTestId("daily-earned")).toHaveTextContent("+0:20 today");
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
          timeBankSeconds: 45,
        },
      }),
      "GET /games": () => ({ data: GAMES }),
    });
    const user = userEvent.setup();
    renderApp("/");

    expect(await screen.findByText("Easy Twos")).toBeInTheDocument();
    expect(screen.getByTestId("game-economics-g-easy")).toHaveTextContent(
      "+10s correct / −5s wrong",
    );
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
