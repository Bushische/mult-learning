// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../test/setup";
import type { Game } from "@mult/shared";
import { useAuthStore } from "../../stores/auth-store";
import { createApiStub, renderApp, resetSession } from "../../test/harness";
import { buildOptions, generateQuestion, shuffle } from "./lib/question";
import { createSeededRng, setRng } from "./lib/random";

const GAME: Game = {
  id: "g-easy",
  name: "Easy Twos",
  rangeA: { min: 2, max: 4 },
  rangeB: { min: 1, max: 4 },
  allowedCombinations: null,
  variantCount: 3,
  baseTimeReward: 10,
  timePenalty: 5,
  maxDailyTime: 3600,
  hints: [{ factor: 10, text: "Just add a 0 at the end!" }],
};

const TEN_GAME: Game = { ...GAME, id: "g-ten", rangeA: { min: 10, max: 10 } };

let bank = 0;
let frames: FrameRequestCallback[] = [];
let frameId = 0;
let virtualNow = 0;

function installRaf(): void {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    frameId += 1;
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
}

function tickFrames(times: number, stepMs = 50): void {
  for (let i = 0; i < times; i += 1) {
    virtualNow += stepMs;
    const current = frames;
    frames = [];
    for (const cb of current) cb(virtualNow);
  }
}

/** Roll the slot machine to its end. */
function finishRoll(): void {
  act(() => {
    tickFrames(60);
  });
}

/** Wait for the question to exist, then roll it out and wait for the answer phase. */
async function startQuestion(): Promise<void> {
  await waitFor(() => {
    expect(screen.getAllByTestId(/^answer-/).length).toBe(GAME.variantCount);
  });
  finishRoll();
  await waitFor(() => {
    expect(screen.getAllByTestId(/^answer-/)[0]).not.toBeDisabled();
  });
}

function readFactors(): { a: number; b: number } {
  return {
    a: Number(screen.getByTestId("factor-a").textContent),
    b: Number(screen.getByTestId("factor-b").textContent),
  };
}

function apiStub(extra: Record<string, (call: { body: unknown }) => { data?: unknown }> = {}) {
  return createApiStub({
    "GET /me": () => ({
      data: { id: "u-child", username: "child1", role: "user", timeBankSeconds: bank },
    }),
    "GET /users": () => ({ data: [{ id: "u-child", username: "child1" }] }),
    "GET /games": () => ({ data: [GAME, TEN_GAME] }),
    "POST /answers": (call) => {
      const body = call.body as { factorA: number; factorB: number; chosen: number | null };
      const rightAnswer = body.factorA * body.factorB;
      const correct = body.chosen !== null && body.chosen === rightAnswer;
      const timeDelta = correct ? 10 : -5;
      bank = Math.max(0, bank + timeDelta);
      return {
        data: { correct, rightAnswer, timeBankSeconds: bank, timeDelta },
      };
    },
    ...extra,
  });
}

beforeEach(() => {
  resetSession();
  useAuthStore.setState({
    accessToken: "token-child",
    user: { id: "u-child", username: "child1", role: "user" },
  });
  bank = 0;
  frames = [];
  frameId = 0;
  virtualNow = 0;
  installRaf();
  setRng(createSeededRng(7));
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("T12 — play screen", () => {
  it("case 1: every rolled question stays inside the game's ranges", async () => {
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    for (let round = 0; round < 5; round += 1) {
      const { a, b } = readFactors();
      expect(a).toBeGreaterThanOrEqual(GAME.rangeA.min);
      expect(a).toBeLessThanOrEqual(GAME.rangeA.max);
      expect(b).toBeGreaterThanOrEqual(GAME.rangeB.min);
      expect(b).toBeLessThanOrEqual(GAME.rangeB.max);

      await user.click(screen.getByTestId(`answer-${a * b}`));
      await user.click(screen.getByRole("button", { name: "Next question" }));
      await startQuestion();
    }

    // the generator itself never leaves the range
    const random = createSeededRng(99);
    for (let i = 0; i < 200; i += 1) {
      const question = generateQuestion(GAME, random);
      expect(question.factorA).toBeGreaterThanOrEqual(GAME.rangeA.min);
      expect(question.factorA).toBeLessThanOrEqual(GAME.rangeA.max);
      expect(question.factorB).toBeGreaterThanOrEqual(GAME.rangeB.min);
      expect(question.factorB).toBeLessThanOrEqual(GAME.rangeB.max);
    }
  });

  it("case 2: the correct answer flashes green, a miss flashes red and reveals the answer", async () => {
    const stub = apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    const rightAnswer = a * b;
    await user.click(screen.getByTestId(`answer-${rightAnswer}`));

    expect(await screen.findByTestId("feedback")).toHaveTextContent("Correct!");
    expect(screen.getByTestId(`answer-${rightAnswer}`).className).toContain("bg-green-500");
    expect(screen.getByTestId("bank")).toHaveTextContent("10s");
    const firstCall = stub.calls.find((call) => call.url === "/api/answers");
    expect(firstCall?.body).toMatchObject({ factorA: a, factorB: b, chosen: rightAnswer });

    await user.click(screen.getByRole("button", { name: "Next question" }));
    await startQuestion();
    const second = readFactors();
    const secondRight = second.a * second.b;
    const wrong = secondRight + 1;
    await user.click(screen.getByTestId(`answer-${wrong}`));

    expect(await screen.findByTestId("feedback")).toHaveTextContent(
      `The answer was ${secondRight}`,
    );
    expect(screen.getByTestId(`answer-${secondRight}`).className).toContain("bg-green-500");
    expect(screen.getByTestId(`answer-${wrong}`).className).toContain("bg-red-500");
  });

  it("case 3: a timeout submits chosen:null, shows red and the next question starts cleanly", async () => {
    const stub = apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    await waitFor(() => {
      expect(screen.getByTestId("feedback")).toHaveTextContent("The answer was");
    });
    const call = stub.calls.find((entry) => entry.url === "/api/answers");
    expect(call?.body).toMatchObject({ chosen: null });
    expect(screen.getByTestId("feedback").className).toContain("text-red-600");

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("button", { name: "Next question" }));
    await startQuestion();
    expect(screen.queryByTestId("feedback")).toBeNull();
    expect(screen.getByTestId("factor-a")).toBeInTheDocument();
  });

  it("case 4: exactly variantCount options, exactly one correct, positions shuffle", async () => {
    apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    const buttons = screen.getAllByTestId(/^answer-/);
    expect(buttons).toHaveLength(GAME.variantCount);
    expect(buttons.filter((button) => button.getAttribute("data-right") === "true")).toHaveLength(
      0,
    );

    const random = createSeededRng(3);
    const slots: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const question = generateQuestion(GAME, random);
      slots.push(question.options.indexOf(question.rightAnswer));
    }
    expect(new Set(slots).size).toBeGreaterThan(1);

    // buildOptions never repeats the correct answer
    const options = buildOptions(12, 4, random);
    expect(options).toHaveLength(4);
    expect(options.filter((value) => value === 12)).toHaveLength(1);
    expect(shuffle([1, 2, 3], random)).toHaveLength(3);
  });

  it("case 5: the magic-rule hint shows only for a matching factor", async () => {
    apiStub();
    renderApp("/play/g-ten");
    await startQuestion();

    expect(await screen.findByTestId("hint")).toHaveTextContent("Just add a 0 at the end!");
    expect(screen.getByTestId("factor-a")).toHaveTextContent("10");
  });

  it("case 5b: a game without a matching hint shows no bubble", async () => {
    apiStub();
    renderApp("/play/g-easy");
    await startQuestion();
    expect(screen.queryByTestId("hint")).toBeNull();
  });

  it("case 6: Stop / Finish shows the summary and 'Play more' continues", async () => {
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));
    await screen.findByTestId("feedback");

    await user.click(screen.getByRole("button", { name: "Stop / Finish" }));
    expect(await screen.findByTestId("summary")).toBeInTheDocument();
    expect(screen.getByTestId("summary-tries")).toHaveTextContent("1 questions");
    expect(screen.getByTestId("summary-accuracy")).toHaveTextContent("100%");
    expect(screen.getByTestId("summary-bank")).toHaveTextContent("+10s earned");

    await user.click(screen.getByRole("button", { name: "Play more" }));
    await startQuestion();
    expect(screen.queryByTestId("summary")).toBeNull();
    expect(screen.getByTestId("tries")).toHaveTextContent("0 answered");
  });

  it("case 8: answering invalidates the dashboard caches (heatmap + daily refetch)", async () => {
    const stub = apiStub({
      "GET /stats/heatmap": () => ({
        data: { cells: [{ a: 2, b: 5, tries: 1, correct: 1, accuracy: 1, color: "green" }] },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 1,
          correctTries: 1,
          timeEarnedSeconds: 10,
          timeBankSeconds: 10,
        },
      }),
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/");
    await screen.findByTestId("heatmap");

    const dailyCallsBefore = stub.calls.filter((call) => call.url === "/api/stats/daily").length;
    const heatmapCallsBefore = stub.calls.filter(
      (call) => call.url === "/api/stats/heatmap",
    ).length;

    await user.click(
      (await screen.findAllByRole("button", { name: "Let's Play!" }))[0] as HTMLElement,
    );
    await startQuestion();
    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));
    await screen.findByTestId("feedback");

    await user.click(screen.getByRole("button", { name: "Stop / Finish" }));
    await user.click(await screen.findByRole("button", { name: "Back to dashboard" }));

    await waitFor(() => {
      const dailyCallsAfter = stub.calls.filter((call) => call.url === "/api/stats/daily").length;
      const heatmapCallsAfter = stub.calls.filter(
        (call) => call.url === "/api/stats/heatmap",
      ).length;
      expect(dailyCallsAfter).toBeGreaterThan(dailyCallsBefore);
      expect(heatmapCallsAfter).toBeGreaterThan(heatmapCallsBefore);
    });
  });

  it("case 7: leaving the screen cancels the roll — no stray submissions", async () => {
    const stub = apiStub();
    const { unmount } = renderApp("/play/g-easy");
    await screen.findByTestId("question");

    unmount();
    act(() => {
      tickFrames(60);
      vi.advanceTimersByTime(20_000);
    });

    expect(stub.calls.some((call) => call.url === "/api/answers")).toBe(false);
  });
});
