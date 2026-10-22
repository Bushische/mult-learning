import type { Game } from "packages/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../dashboard/components/AppHeader";
import { useGames } from "../../dashboard/hooks/useGames";
import { submitAnswer } from "../api";
import { AnswerButtons } from "../components/AnswerButtons";
import { CountdownBar } from "../components/CountdownBar";
import { HintBubble } from "../components/HintBubble";
import { SessionSummaryCard } from "../components/SessionSummaryCard";
import { SlotDisplay } from "../components/SlotDisplay";
import { useCountdown } from "../hooks/useCountdown";
import { useSlotRoll } from "../hooks/useSlotRoll";
import { QUESTION_SECONDS, ROLL_DURATION_MS } from "../lib/constants";
import { type Question, generateQuestion } from "../lib/question";
import { rng } from "../lib/random";
import { buildSummary } from "../lib/session";

type Phase = "rolling" | "question" | "feedback" | "summary";

interface PlayPageProps {
  /** Overrides the `:gameId` route parameter (tests). */
  gameId?: string;
  rollDurationMs?: number;
  questionSeconds?: number;
}

/** The core loop: roll → answer → feedback → next question. */
export function PlayPage({ gameId, rollDurationMs, questionSeconds }: PlayPageProps) {
  const params = useParams();
  const navigate = useNavigate();
  const activeGameId = gameId ?? params.gameId ?? "";
  const rollMs = rollDurationMs ?? ROLL_DURATION_MS;
  const seconds = questionSeconds ?? QUESTION_SECONDS;

  const { data: games } = useGames();
  const game: Game | undefined = useMemo(
    () => (games ?? []).find((entry) => entry.id === activeGameId),
    [games, activeGameId],
  );

  const [phase, setPhase] = useState<Phase>("rolling");
  const [question, setQuestion] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [bankAdded, setBankAdded] = useState(0);
  const [bank, setBank] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  const startQuestion = useCallback(() => {
    if (!game) return;
    setQuestion(generateQuestion(game, rng));
    setChosen(null);
    setLastCorrect(null);
    setPhase("rolling");
  }, [game]);

  useEffect(() => {
    if (game && question === null) {
      startQuestion();
    }
  }, [game, question, startQuestion]);

  const roll = useSlotRoll(
    { a: question?.factorA ?? 1, b: question?.factorB ?? 1 },
    rollMs,
    phase === "rolling" && question !== null,
    rng,
  );

  useEffect(() => {
    if (phase === "rolling" && roll.done && question) {
      setPhase("question");
    }
  }, [phase, roll.done, question]);

  const record = useCallback(
    async (value: number | null) => {
      if (!question || !game) return;
      setChosen(value);
      try {
        const result = await submitAnswer({
          gameId: game.id,
          factorA: question.factorA,
          factorB: question.factorB,
          chosen: value,
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
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500" data-testid="bank">
              Bank: {bank}s
            </span>
            <span className="text-sm text-slate-500" data-testid="tries">
              {tries} answered
            </span>
          </div>
          <CountdownBar remaining={countdown.remaining} total={seconds * 1000} />
        </div>

        <SlotDisplay a={roll.a} b={roll.b} done={phase === "question" || phase === "feedback"} />

        {hint ? <HintBubble text={hint} /> : null}

        {question ? (
          <AnswerButtons
            options={question.options}
            disabled={phase !== "question"}
            chosen={chosen}
            rightAnswer={phase === "feedback" ? question.rightAnswer : null}
            onSelect={(value) => void record(value)}
          />
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
