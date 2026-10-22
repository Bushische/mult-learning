import type { Game } from "@mult/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../dashboard/components/AppHeader";
import { useGames } from "../../dashboard/hooks/useGames";
import { useMe } from "../../dashboard/hooks/useMe";
import { formatDuration } from "../../dashboard/lib/format";
import { submitAnswer } from "../api";
import { AnswerButtons } from "../components/AnswerButtons";
import { CountdownBar } from "../components/CountdownBar";
import { HintBubble } from "../components/HintBubble";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { SlotDisplay } from "../components/SlotDisplay";
import { useCountdown } from "../hooks/useCountdown";
import {
  OPTIONS_MS,
  PAUSE1_MS,
  QUESTION_SECONDS,
  ROLL1_MS,
  ROLL2_MS,
  SPIN_TICK_MS,
} from "../lib/constants";
import { type Question, generateQuestion } from "../lib/question";
import { rng } from "../lib/random";
import { buildSummary } from "../lib/session";

type Phase = "roll1" | "pause1" | "options" | "roll2" | "question" | "feedback" | "summary";

interface PlayPageProps {
  /** Overrides the `:gameId` route parameter (tests). */
  gameId?: string;
  questionSeconds?: number;
}

/** The core loop: roll → answer → feedback → next question. */
export function PlayPage({ gameId, questionSeconds }: PlayPageProps) {
  const params = useParams();
  const navigate = useNavigate();
  const activeGameId = gameId ?? params.gameId ?? "";

  const { data: games } = useGames();
  const game: Game | undefined = useMemo(
    () => (games ?? []).find((entry) => entry.id === activeGameId),
    [games, activeGameId],
  );
  /** The countdown length comes from the game; the prop is a test override. */
  const seconds = questionSeconds ?? game?.questionSeconds ?? QUESTION_SECONDS;

  const [phase, setPhase] = useState<Phase>("roll1");
  const [question, setQuestion] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [bankAdded, setBankAdded] = useState(0);
  const [bank, setBank] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  /** The numbers on display: Num 1 shuffles during `roll1`, Num 2 (`null` = `?`)
   * shuffles during `roll2` and both lock before the question opens. */
  const [displayA, setDisplayA] = useState(1);
  const [displayB, setDisplayB] = useState<number | null>(null);
  const { data: me } = useMe();
  /** The countdown start of the current question (elapsedMs is measured from it). */
  const questionStartedAt = useRef(0);
  /** The authoritative bank comes from the answer responses; before the first
   * answer fall back to the profile value so the cap line is correct at once. */
  const displayedBank = bank ?? me?.timeBankSeconds ?? 0;

  const startQuestion = useCallback(() => {
    if (!game) return;
    const next = generateQuestion(game, rng);
    setQuestion(next);
    setChosen(null);
    setLastCorrect(null);
    setDisplayA(1 + Math.floor(rng() * 20));
    setDisplayB(null);
    setPhase("roll1");
  }, [game]);

  useEffect(() => {
    if (game && question === null) {
      startQuestion();
    }
  }, [game, question, startQuestion]);

  /**
   * The pre-question sequence: Num 1 spins fast and locks → a beat with Num 2
   * hidden → the options fade in (disabled) → Num 2 spins, decelerates and
   * locks → the countdown starts. Every timer is cancelled when the phase or
   * the question changes (unmount included), so no stray submission can fire.
   */
  useEffect(() => {
    if (!question) return;
    if (phase === "roll1") {
      const spin = setInterval(() => {
        setDisplayA(1 + Math.floor(rng() * 20));
      }, SPIN_TICK_MS);
      const lock = setTimeout(() => {
        clearInterval(spin);
        setDisplayA(question.factorA);
        setPhase("pause1");
      }, ROLL1_MS);
      return () => {
        clearInterval(spin);
        clearTimeout(lock);
      };
    }
    if (phase === "pause1") {
      const timer = setTimeout(() => setPhase("options"), PAUSE1_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "options") {
      const timer = setTimeout(() => setPhase("roll2"), OPTIONS_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "roll2") {
      let gap = SPIN_TICK_MS;
      let waited = 0;
      let timer: ReturnType<typeof setTimeout>;
      const tick = () => {
        waited += gap;
        if (waited >= ROLL2_MS) {
          setDisplayB(question.factorB);
          questionStartedAt.current = Date.now();
          setPhase("question");
          return;
        }
        setDisplayB(1 + Math.floor(rng() * 20));
        gap = Math.min(Math.round(gap * 1.4), 200);
        timer = setTimeout(tick, gap);
      };
      timer = setTimeout(tick, gap);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, question]);

  const record = useCallback(
    async (value: number | null) => {
      if (!question || !game) return;
      setChosen(value);
      const elapsedMs = Math.max(0, Date.now() - questionStartedAt.current);
      try {
        const result = await submitAnswer({
          gameId: game.id,
          factorA: question.factorA,
          factorB: question.factorB,
          chosen: value,
          elapsedMs,
        });
        setBank(result.timeBankSeconds);
        if (result.timeDelta > 0) setBankAdded((total) => total + result.timeDelta);
        setLastCorrect(result.correct);
      } catch {
        setLastCorrect(false);
      }
      setTries((total) => total + 1);
      setCorrectCount(
        (total) => total + (value !== null && value === question.rightAnswer ? 1 : 0),
      );
      setPhase("feedback");
    },
    [question, game],
  );

  const handleTimeout = useCallback(() => {
    void record(null);
  }, [record]);

  const countdown = useCountdown(seconds * 1000, phase === "question", handleTimeout);

  const hint = useMemo(() => {
    if (!game || !question) return null;
    if (phase !== "question" && phase !== "feedback") return null;
    const match = game.hints.find(
      (entry) => entry.factor === question.factorA || entry.factor === question.factorB,
    );
    return match?.text ?? null;
  }, [game, question, phase]);

  if (!game) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Playing" />
        <main className="p-6">
          <p className="text-lg text-slate-600" data-testid="no-game">
            This game is not assigned to you.
          </p>
        </main>
      </div>
    );
  }

  if (phase === "summary") {
    const summary = buildSummary(tries, correctCount, bankAdded);
    return (
      <div className="min-h-screen">
        <AppHeader title="Playing" />
        <main className="p-6">
          <SessionSummaryCard
            summary={summary}
            onPlayMore={() => {
              setTries(0);
              setCorrectCount(0);
              setBankAdded(0);
              startQuestion();
            }}
            onExit={() => navigate("/")}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader title={game.name} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
            <p className="text-sm text-slate-500">
              <span data-testid="bank">Bank {formatDuration(displayedBank)}</span>
              <span data-testid="bank-max"> / {formatDuration(game.maxDailyTime)}</span>
              {" · "}
              <span data-testid="session-earned">session +{formatDuration(bankAdded)} earned</span>
            </p>
            <span className="text-sm text-slate-500" data-testid="tries">
              {tries} answered
            </span>
          </div>
          <CountdownBar
            remaining={countdown.remaining}
            total={seconds * 1000}
            baseTimeReward={game.baseTimeReward}
            questionSeconds={game.questionSeconds}
          />
        </div>

        <SlotDisplay
          a={displayA}
          b={displayB}
          aLocked={phase !== "roll1"}
          bLocked={phase === "question" || phase === "feedback"}
        />

        {hint ? <HintBubble text={hint} /> : null}

        {question && phase !== "roll1" && phase !== "pause1" ? (
          <div style={{ animation: "play-options-in 0.3s ease-out" }}>
            <AnswerButtons
              options={question.options}
              disabled={phase !== "question"}
              chosen={chosen}
              rightAnswer={phase === "feedback" ? question.rightAnswer : null}
              onSelect={(value) => void record(value)}
            />
          </div>
        ) : null}

        {phase === "feedback" ? (
          <p
            className={`text-center text-2xl font-black ${
              lastCorrect ? "text-green-600" : "text-red-600"
            }`}
            data-testid="feedback"
          >
            {lastCorrect ? "Correct!" : `The answer was ${question?.rightAnswer ?? 0}`}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          {phase === "feedback" ? (
            <button
              type="button"
              onClick={startQuestion}
              className="min-h-[56px] rounded-2xl bg-sky-500 text-lg font-bold text-white"
            >
              Next question
            </button>
          ) : null}
          {phase === "feedback" ? (
            <button
              type="button"
              onClick={() => setPhase("summary")}
              className="min-h-[48px] rounded-2xl border border-slate-300 text-lg"
            >
              Stop / Finish
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
