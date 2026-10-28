// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../test/setup";
import type { Game } from "@mult/shared";
import { applyOp, computeRewardSeconds, matchingMagicRules } from "@mult/shared";
import { useAuthStore } from "../../stores/auth-store";
import { createApiStub, renderApp, resetSession } from "../../test/harness";
import { CountdownBar } from "./components/CountdownBar";
import { OPTIONS_MS, PAUSE1_MS, ROLL1_MS, ROLL2_MS } from "./lib/constants";
import { buildOptions, generateQuestion, shuffle } from "./lib/question";
import { createSeededRng, setRng } from "./lib/random";

const GAME: Game = {
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
  hints: [{ factor: 10, text: "Just add a 0 at the end!" }],
};

const TEN_GAME: Game = { ...GAME, id: "g-ten", rangeA: { min: 10, max: 10 } };

const LONG_GAME: Game = { ...GAME, id: "g-long", name: "Long", questionSeconds: 20 };

const ALL_GAMES: Game[] = [GAME, TEN_GAME, LONG_GAME];

let bank = 0;
/** When true, POST /answers fails with 500 (T27 case 5). Reset per test. */
let failPosts = false;

/** Advance the fake clock; every timer due in the window fires deterministically. */
async function tick(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Flush the games load and stop the moment the slots mount. Never use `waitFor`
 * for phase synchronization: its polling would advance the fake clock by an
 * unknown amount, and chained phase timers only fire when every link was
 * scheduled before the clock passes it — so advance in small steps and let
 * each step's assertions observe the phase deterministically.
 */
async function waitForLoad(): Promise<void> {
  for (let i = 0; i < 40 && !screen.queryByTestId("question"); i += 1) {
    await tick(50);
  }
  expect(screen.queryByTestId("question")).not.toBeNull();
}

/** Step until the answer buttons fade in (the options phase). */
async function stepToOptions(): Promise<void> {
  await waitForLoad();
  for (let i = 0; i < 30 && !screen.queryByTestId("answers"); i += 1) {
    await tick(100);
  }
  expect(screen.queryByTestId("answers")).not.toBeNull();
}

/** Run the whole pre-question sequence deterministically. */
async function startQuestion(): Promise<void> {
  await stepToOptions();
  for (
    let i = 0;
    i < 40 &&
    (screen.getAllByTestId(/^answer-/)[0] as HTMLButtonElement | undefined)?.disabled !== false;
    i += 1
  ) {
    await tick(100);
  }
  expect(screen.getAllByTestId(/^answer-/)[0]).not.toBeDisabled();
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
      if (failPosts) {
        return { status: 500, data: { error: { code: "UNKNOWN", message: "boom" } } };
      }
      const body = call.body as {
        gameId: string;
        operation?: "add" | "sub" | "mul" | "div";
        factorA: number;
        factorB: number;
        chosen: number | null;
        elapsedMs: number;
      };
      const played = ALL_GAMES.find((game) => game.id === body.gameId) ?? GAME;
      const rightAnswer = applyOp(body.factorA, body.factorB, body.operation ?? "mul");
      const correct = body.chosen !== null && body.chosen === rightAnswer;
      const reward = computeRewardSeconds({
        baseTimeReward: played.baseTimeReward,
        questionSeconds: played.questionSeconds,
        elapsedMs: body.elapsedMs,
        timePenalty: played.timePenalty,
      });
      const timeDelta = correct ? reward : -played.timePenalty;
      bank = Math.min(played.maxDailyTime, Math.max(0, bank + timeDelta));
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
  failPosts = false;
  setRng(createSeededRng(7));
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
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
    expect(screen.getByTestId("bank")).toHaveTextContent("0:10");
    const firstCall = stub.calls.find((call) => call.url === "/api/answers");
    expect(firstCall?.body).toMatchObject({ factorA: a, factorB: b, chosen: rightAnswer });

    await user.click(screen.getByRole("button", { name: "Next question" }));
    await startQuestion();
    const second = readFactors();
    const secondRight = second.a * second.b;
    const wrongButton = screen
      .getAllByTestId(/^answer-/)
      .find((button) => button.textContent !== String(secondRight)) as HTMLElement;
    const wrong = Number(wrongButton.textContent);
    await user.click(wrongButton);

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
    const options = buildOptions(3, 4, 4, random);
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
    expect(screen.getByTestId("summary-bank")).toHaveTextContent("+0:10 earned");

    await user.click(screen.getByRole("button", { name: "Play more" }));
    await startQuestion();
    expect(screen.queryByTestId("summary")).toBeNull();
    expect(screen.getByTestId("tries")).toHaveTextContent("0 answered");
  });

  it("case 8: answering invalidates the dashboard caches (heatmap + daily refetch)", async () => {
    const stub = apiStub({
      "GET /stats/heatmap": () => ({
        data: {
          cells: [{ op: "mul", a: 2, b: 5, tries: 1, correct: 1, accuracy: 1, color: "green" }],
        },
      }),
      "GET /stats/daily": () => ({
        data: {
          date: "2026-10-22",
          totalTries: 1,
          correctTries: 1,
          timeEarnedSeconds: 10,
          timeLostSeconds: 0,
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
    await tick(20_000);

    expect(stub.calls.some((call) => call.url === "/api/answers")).toBe(false);
  });
});

describe("T22 — play HUD bank line", () => {
  it("case 1: a game with cap 3600 and bank 45 renders 'Bank 0:45 / 1:00:00'", async () => {
    bank = 45;
    apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    expect(screen.getByTestId("bank")).toHaveTextContent("Bank 0:45");
    expect(screen.getByTestId("bank-max")).toHaveTextContent("/ 1:00:00");
  });

  it("case 2: a correct answer updates the bank and the session earned on the same line", async () => {
    bank = 0;
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    expect(screen.getByTestId("session-earned")).toHaveTextContent("session +0:00 earned");

    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));
    await screen.findByTestId("feedback");

    expect(screen.getByTestId("bank")).toHaveTextContent("Bank 0:10");
    expect(screen.getByTestId("session-earned")).toHaveTextContent("session +0:10 earned");
  });

  it("case 3: a wrong answer reduces the bank but never below '0:00 / <max>'", async () => {
    bank = 3;
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    expect(screen.getByTestId("bank")).toHaveTextContent("Bank 0:03");

    const { a, b } = readFactors();
    const rightAnswer = a * b;
    const wrongButton = screen
      .getAllByTestId(/^answer-/)
      .find((button) => button.textContent !== String(rightAnswer)) as HTMLElement;
    await user.click(wrongButton);
    await screen.findByTestId("feedback");

    expect(screen.getByTestId("bank")).toHaveTextContent("Bank 0:00");
    expect(screen.getByTestId("bank-max")).toHaveTextContent("/ 1:00:00");
  });

  it("case 4: the earned label is present so the left number is not mistaken for the cap", async () => {
    bank = 0;
    apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    expect(screen.getByTestId("session-earned")).toHaveTextContent("earned");
  });
});

describe("T23 — time-decayed reward", () => {
  it("case 6: the countdown for a 20-second game runs 20 s, not the old 15 s", async () => {
    const stub = apiStub({
      "GET /games": () => ({ data: [GAME, TEN_GAME, LONG_GAME] }),
    });
    renderApp("/play/g-long");
    await startQuestion();

    // after 16 s the question is still open (the old 15 s countdown would have fired)
    act(() => {
      vi.advanceTimersByTime(16_000);
    });
    expect(stub.calls.some((call) => call.url === "/api/answers")).toBe(false);
    expect(screen.queryByTestId("feedback")).toBeNull();

    // past 20 s the timeout submits with the full duration
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    await waitFor(() => {
      expect(screen.getByTestId("feedback")).toBeInTheDocument();
    });
    const call = stub.calls.find((entry) => entry.url === "/api/answers");
    expect(call?.body).toMatchObject({ chosen: null });
  });

  it("case 7: waiting ~9 s then answering correctly shows the reduced time added", async () => {
    bank = 0;
    const stub = apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));
    await screen.findByTestId("feedback");

    const call = stub.calls.find((entry) => entry.url === "/api/answers");
    expect(call?.body).toMatchObject({ chosen: a * b });
    const elapsedMs = (call?.body as { elapsedMs: number }).elapsedMs;
    expect(elapsedMs).toBeGreaterThanOrEqual(9000);
    expect(elapsedMs).toBeLessThan(10_000);
    // decayed reward 5, not the max 10
    expect(screen.getByTestId("bank")).toHaveTextContent("Bank 0:05");
    expect(screen.getByTestId("session-earned")).toHaveTextContent("session +0:05 earned");
  });
});

describe("T24 — earning progress bar", () => {
  const bar = { total: 15000, baseTimeReward: 10, questionSeconds: 15, timePenalty: 5 };

  it("case 1: at remaining = total the current value equals the max at the right edge", () => {
    render(<CountdownBar remaining={15000} {...bar} />);
    expect(screen.getByTestId("earning-current")).toHaveTextContent("+0:10");
    expect(screen.getByTestId("earning-current").style.left).toBe("100%");
  });

  it("case 2: halfway through, the current value follows the T23 formula between min and max", () => {
    render(<CountdownBar remaining={7500} {...bar} />);
    // round(10 * (15000 − 7500) / (15000 − 3000)) = 6
    expect(screen.getByTestId("earning-current")).toHaveTextContent("+0:06");
    expect(screen.getByTestId("earning-current").style.left).toBe("60%");
  });

  it("case 3: at remaining = 0 the current value is the penalty floor at partial position", () => {
    render(<CountdownBar remaining={0} {...bar} />);
    expect(screen.getByTestId("earning-current")).toHaveTextContent("+0:05");
    expect(screen.getByTestId("earning-current").style.left).toBe("50%");
  });

  it("case 4: the labels render as clock values with an accessible summary", () => {
    render(<CountdownBar remaining={7500} {...bar} />);
    expect(screen.getByTestId("earning-min")).toHaveTextContent("min +0:05");
    expect(screen.getByTestId("earning-max")).toHaveTextContent("max +0:10");
    const label = screen.getByTestId("countdown").getAttribute("aria-label") ?? "";
    expect(label).toContain("+0:06");
    expect(label).toContain("+0:10");
    expect(label).toContain("+0:05");
  });

  it("case 5: the bar still shrinks with the countdown", () => {
    const { unmount } = render(<CountdownBar remaining={15000} {...bar} />);
    expect(screen.getByTestId("countdown-fill").style.width).toBe("100%");
    unmount();
    render(<CountdownBar remaining={0} {...bar} />);
    expect(screen.getByTestId("countdown-fill").style.width).toBe("0%");
  });

  it("the live bar starts at the max earning when the question opens", async () => {
    bank = 0;
    apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    expect(screen.getByTestId("earning-current")).toHaveTextContent("+0:10");
    expect(screen.getByTestId("earning-max")).toHaveTextContent("max +0:10");
  });
});

describe("T25 — roll sequence with deliberate pauses", () => {
  it("case 4: the named phase durations total at least 2 s with pauses of 300 ms+", () => {
    expect(ROLL1_MS + PAUSE1_MS + OPTIONS_MS + ROLL2_MS).toBeGreaterThanOrEqual(2000);
    expect(PAUSE1_MS).toBeGreaterThanOrEqual(300);
    expect(OPTIONS_MS).toBeGreaterThanOrEqual(300);
  });

  it("case 1: the first number locks before the options become visible", async () => {
    bank = 0;
    apiStub();
    renderApp("/play/g-easy");
    await waitForLoad();

    // Sample every 100 ms: the spin changes Num 1 about every 60 ms, so two
    // equal reads in a row mean it locked. Stop at the options phase.
    let prevA: string | null = null;
    let stablePreOptions = 0;
    let sawSpin = false;
    let optionsA: string | null = null;
    for (let i = 0; i < 30; i += 1) {
      await tick(100);
      const a = screen.queryByTestId("factor-a")?.textContent ?? null;
      const answers = screen.queryByTestId("answers") !== null;
      if (!answers && a !== null) {
        if (a === prevA) stablePreOptions += 1;
        else if (prevA !== null) sawSpin = true;
      }
      if (answers) {
        optionsA = a;
        break;
      }
      prevA = a;
    }

    expect(optionsA).not.toBeNull();
    expect(screen.queryByTestId("answers")).not.toBeNull();
    // Num 1 moved at least once (the roll) and then sat still with no options
    expect(sawSpin).toBe(true);
    expect(stablePreOptions).toBeGreaterThanOrEqual(2);
    expect(optionsA).toBe(prevA);
  });

  it("case 2: the options are visible (disabled) before the second number locks", async () => {
    bank = 0;
    const stub = apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await stepToOptions();

    const buttons = screen.getAllByTestId(/^answer-/);
    expect(buttons).toHaveLength(GAME.variantCount);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(screen.getByTestId("factor-b")).toHaveTextContent("?");

    // a tap on a disabled option does nothing: no submission
    await user.click(buttons[0] as HTMLElement);
    expect(stub.calls.some((call) => call.url === "/api/answers")).toBe(false);
  });

  it("case 3: no timeout can fire during the pauses", async () => {
    bank = 0;
    const stub = apiStub();
    renderApp("/play/g-easy");
    await stepToOptions();

    expect(stub.calls.some((call) => call.url === "/api/answers")).toBe(false);
    expect(screen.queryByTestId("feedback")).toBeNull();
  });

  it("case 5: unmounting mid-pause cancels pending timers — no stray submissions", async () => {
    bank = 0;
    const stub = apiStub();
    const view = renderApp("/play/g-easy");
    await stepToOptions();
    expect(screen.getByTestId("answers")).toBeInTheDocument();

    view.unmount();
    await tick(20_000);

    expect(stub.calls.some((call) => call.url === "/api/answers")).toBe(false);
  });

  it("case 6: after the second number locks the options enable and the countdown starts", async () => {
    bank = 0;
    apiStub();
    renderApp("/play/g-easy");
    await stepToOptions();
    expect(screen.getAllByTestId(/^answer-/)[0]).toBeDisabled();

    // roll2: step until Num 2 spins (no longer hidden)
    for (let i = 0; i < 20 && screen.getByTestId("factor-b").textContent === "?"; i += 1) {
      await tick(100);
    }
    expect(screen.getByTestId("factor-b").textContent).toMatch(/^\d+$/);
    // question: step until the options enable on the same tick the countdown starts
    for (
      let i = 0;
      i < 30 && (screen.getAllByTestId(/^answer-/)[0] as HTMLButtonElement).disabled;
      i += 1
    ) {
      await tick(100);
    }
    expect(screen.getAllByTestId(/^answer-/)[0]).not.toBeDisabled();
    expect(screen.getByTestId("factor-b").textContent).toMatch(/^\d+$/);
    expect(screen.getByTestId("earning-current")).toHaveTextContent("+0:10");
  });
});

describe("T27 — single submission and honest feedback", () => {
  it("case 1: a correct tap then a long wait submits once and says Correct!", async () => {
    bank = 0;
    const stub = apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));
    expect(await screen.findByTestId("feedback")).toHaveTextContent("Correct!");

    await tick(20_000);
    expect(stub.calls.filter((call) => call.url === "/api/answers")).toHaveLength(1);
    expect(screen.getByTestId("feedback")).toHaveTextContent("Correct!");
  });

  it("case 2: double-tapping an option in the same question submits only once", async () => {
    bank = 0;
    const stub = apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    const button = screen.getByTestId(`answer-${a * b}`);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByTestId("feedback")).toHaveTextContent("Correct!");
    expect(stub.calls.filter((call) => call.url === "/api/answers")).toHaveLength(1);
  });

  it("case 3: a wrong option shows the server right answer and the bar stops", async () => {
    bank = 0;
    const stub = apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    const rightAnswer = a * b;
    const wrongButton = screen
      .getAllByTestId(/^answer-/)
      .find((button) => button.textContent !== String(rightAnswer)) as HTMLElement;
    await user.click(wrongButton);
    expect(await screen.findByTestId("feedback")).toHaveTextContent(
      `The answer was ${rightAnswer}`,
    );

    const width = screen.getByTestId("countdown-fill").style.width;
    await tick(10_000);
    expect(screen.getByTestId("countdown-fill").style.width).toBe(width);
    expect(stub.calls.filter((call) => call.url === "/api/answers")).toHaveLength(1);
  });

  it("case 4: a timeout with no tap submits chosen:null once with wrong-answer feedback", async () => {
    bank = 0;
    const stub = apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    await tick(16_000);
    expect(await screen.findByTestId("feedback")).toHaveTextContent("The answer was");
    const posts = stub.calls.filter((call) => call.url === "/api/answers");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toMatchObject({ chosen: null });
  });

  it("case 5: an API failure shows the error, updates nothing, and retry works", async () => {
    bank = 0;
    failPosts = true;
    const stub = apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));
    expect(await screen.findByTestId("save-error")).toHaveTextContent("Couldn't save your answer");
    // no fabricated verdict, no bank/attempt update
    expect(screen.queryByTestId("feedback")).toBeNull();
    expect(screen.getByTestId("bank")).toHaveTextContent("Bank 0:00");
    expect(screen.getByTestId("tries")).toHaveTextContent("0 answered");

    // retry allowed: the queued tap goes through once the API is back
    failPosts = false;
    await user.click(screen.getByTestId("try-again"));
    expect(await screen.findByTestId("feedback")).toHaveTextContent("Correct!");
    expect(screen.getByTestId("tries")).toHaveTextContent("1 answered");
    expect(stub.calls.filter((call) => call.url === "/api/answers")).toHaveLength(2);
  });
});

describe("T31 — feedback shows the seconds won or lost", () => {
  it("case 1: a fast correct answer shows the credited seconds", async () => {
    bank = 0;
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));

    const feedback = await screen.findByTestId("feedback");
    expect(feedback).toHaveTextContent("Correct!");
    expect(screen.getByTestId("feedback-delta")).toHaveTextContent("⏰ +0:10 👍");
  });

  it("case 2: a wrong answer shows the taken seconds", async () => {
    bank = 45;
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    const { a, b } = readFactors();
    const rightAnswer = a * b;
    const wrongButton = screen
      .getAllByTestId(/^answer-/)
      .find((button) => button.textContent !== String(rightAnswer)) as HTMLElement;
    await user.click(wrongButton);

    const feedback = await screen.findByTestId("feedback");
    expect(feedback).toHaveTextContent(`The answer was ${rightAnswer}`);
    expect(screen.getByTestId("feedback-delta")).toHaveTextContent("⏰ −0:05 😒");
  });

  it("case 3: a timeout shows the penalty seconds", async () => {
    bank = 45;
    apiStub();
    renderApp("/play/g-easy");
    await startQuestion();

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    const feedback = await screen.findByTestId("feedback");
    expect(feedback).toHaveTextContent("The answer was");
    expect(screen.getByTestId("feedback-delta")).toHaveTextContent("⏰ −0:05 😒");
  });

  it("case 4: a late correct answer shows the decayed reward", async () => {
    bank = 0;
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));

    const feedback = await screen.findByTestId("feedback");
    expect(feedback).toHaveTextContent("Correct!");
    expect(screen.getByTestId("feedback-delta")).toHaveTextContent("⏰ +0:05 👍");
  });
});

describe("T32 — common shared magic rules plus per-game rules", () => {
  it("case 1: a ×10 question shows the shared rule on a correct answer", async () => {
    bank = 0;
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-ten");
    await startQuestion();

    const { a, b } = readFactors();
    expect(a).toBe(10);
    await user.click(screen.getByTestId(`answer-${a * b}`));
    await screen.findByTestId("feedback");

    const card = await screen.findByTestId("magic-rule");
    const candidates = matchingMagicRules(a, b, GAME.hints);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((rule) => card.textContent?.includes(rule.text))).toBe(true);
  });

  it("case 2: the game's own rule shows for its factor on a wrong answer", async () => {
    const hintGame: Game = {
      ...GAME,
      id: "g-hint",
      name: "Hint",
      rangeA: { min: 3, max: 3 },
      rangeB: { min: 7, max: 7 },
      hints: [{ factor: 3, text: "Triple trick" }],
    };
    apiStub({ "GET /games": () => ({ data: [hintGame] }) });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-hint");
    await startQuestion();

    const { a, b } = readFactors();
    expect([a, b]).toContain(3);
    const wrongButton = screen
      .getAllByTestId(/^answer-/)
      .find((button) => button.textContent !== String(a * b)) as HTMLElement;
    await user.click(wrongButton);
    await screen.findByTestId("feedback");

    expect(await screen.findByTestId("magic-rule")).toHaveTextContent("Triple trick");
  });

  it("case 4: a question matching no rule renders no card", async () => {
    const plainGame: Game = {
      ...GAME,
      id: "g-plain",
      name: "Plain",
      rangeA: { min: 3, max: 3 },
      rangeB: { min: 7, max: 7 },
      hints: [],
    };
    apiStub({ "GET /games": () => ({ data: [plainGame] }) });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-plain");
    await startQuestion();

    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));
    await screen.findByTestId("feedback");

    expect(screen.queryByTestId("magic-rule")).toBeNull();
  });

  it("case 5: a timeout on a matching question still shows the rule card", async () => {
    bank = 45;
    apiStub();
    renderApp("/play/g-ten");
    await startQuestion();

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    await screen.findByTestId("feedback");
    const card = await screen.findByTestId("magic-rule");
    const { b } = readFactors();
    const candidates = matchingMagicRules(10, b, GAME.hints);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((rule) => card.textContent?.includes(rule.text))).toBe(true);
  });
});

describe("T41 — correct answers never pay +0:00", () => {
  it("case 4: a correct answer at the last moment pays the penalty floor", async () => {
    bank = 0;
    apiStub();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-easy");
    await startQuestion();

    act(() => {
      vi.advanceTimersByTime(14_900);
    });
    const { a, b } = readFactors();
    await user.click(screen.getByTestId(`answer-${a * b}`));

    const feedback = await screen.findByTestId("feedback");
    expect(feedback).toHaveTextContent("Correct!");
    expect(screen.getByTestId("feedback-delta")).toHaveTextContent("⏰ +0:05 👍");
  });
});

describe("T46 — magic rules per operation", () => {
  it("a ÷1 question shows the shared divide-by-1 rule on a correct answer", async () => {
    const divOne: Game = {
      ...GAME,
      id: "g-div-one",
      name: "Divide by One",
      operations: ["div"],
      rangeA: { min: 5, max: 5 },
      rangeB: { min: 1, max: 1 },
      hints: [],
    };
    bank = 0;
    apiStub({ "GET /games": () => ({ data: [divOne] }) });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-div-one");
    await startQuestion();

    const { a, b } = readFactors();
    expect([a, b]).toEqual([5, 1]);
    await user.click(screen.getByTestId(`answer-${a / b}`));
    await screen.findByTestId("feedback");
    expect(await screen.findByTestId("magic-rule")).toHaveTextContent(
      "Divide by 1 — the number stays the same.",
    );
  });

  it("a 9 ÷ 3 question shows the game's own ÷ rule on a correct answer", async () => {
    const divGame: Game = {
      ...GAME,
      id: "g-div-own",
      name: "Own Div Rule",
      operations: ["div"],
      rangeA: { min: 9, max: 9 },
      rangeB: { min: 3, max: 3 },
      hints: [{ factor: 3, operation: "div", text: "Three thrice trick" }],
    };
    bank = 0;
    apiStub({ "GET /games": () => ({ data: [divGame] }) });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-div-own");
    await startQuestion();

    const { a, b } = readFactors();
    expect([a, b]).toEqual([9, 3]);
    await user.click(screen.getByTestId(`answer-${a / b}`));
    await screen.findByTestId("feedback");
    expect(await screen.findByTestId("magic-rule")).toHaveTextContent("Three thrice trick");
  });
});

describe("T49 — play HUD labeling per operation", () => {
  function opGame(id: string, operation: "add" | "sub" | "mul" | "div"): Game {
    return {
      ...GAME,
      id,
      name: `Op ${operation}`,
      operations: [operation],
      rangeA: { min: 8, max: 8 },
      rangeB: { min: 2, max: 2 },
      hints: [],
    };
  }

  it("case 1: one round of each operation shows its own symbol", async () => {
    const games = [
      { ...opGame("g-add", "add"), rangeA: { min: 7, max: 7 }, rangeB: { min: 5, max: 5 } },
      { ...opGame("g-sub", "sub"), rangeA: { min: 9, max: 9 }, rangeB: { min: 4, max: 4 } },
      opGame("g-mul", "mul"),
      opGame("g-div", "div"),
    ];
    const expected: Record<string, string> = {
      "g-add": "+",
      "g-sub": "−",
      "g-mul": "×",
      "g-div": "÷",
    };
    for (const game of games) {
      bank = 0;
      apiStub({ "GET /games": () => ({ data: [game] }) });
      const view = renderApp(`/play/${game.id}`);
      await startQuestion();
      expect(screen.getByTestId("equation-op")).toHaveTextContent(expected[game.id] as string);
      view.unmount();
    }
  });

  it("case 2: a wrong − answer shows the right answer with framed seconds", async () => {
    const game = {
      ...opGame("g-sub", "sub"),
      rangeA: { min: 9, max: 9 },
      rangeB: { min: 4, max: 4 },
    };
    bank = 0;
    apiStub({ "GET /games": () => ({ data: [game] }) });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/play/g-sub");
    await startQuestion();

    const { a, b } = readFactors();
    expect([a, b]).toEqual([9, 4]);
    const wrongButton = screen
      .getAllByTestId(/^answer-/)
      .find((button) => button.textContent !== String(a - b)) as HTMLElement;
    await user.click(wrongButton);

    expect(await screen.findByTestId("feedback")).toHaveTextContent("The answer was 5");
    expect(screen.getByTestId("feedback-delta")).toHaveTextContent("⏰ −0:05 😒");
  });

  it("case 3: a timeout on a ÷ question submits chosen:null with wrong-answer feedback", async () => {
    const game = opGame("g-div", "div");
    bank = 0;
    const stub = apiStub({ "GET /games": () => ({ data: [game] }) });
    renderApp("/play/g-div");
    await startQuestion();

    await tick(16_000);
    expect(await screen.findByTestId("feedback")).toHaveTextContent("The answer was 4");
    const posts = stub.calls.filter((call) => call.url === "/api/answers");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toMatchObject({ chosen: null, operation: "div" });
  });
});
