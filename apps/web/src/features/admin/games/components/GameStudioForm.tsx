import { type Game, type GameConfig, gameConfigSchema } from "@mult/shared";
import { useState } from "react";
import { CombinationMatrix } from "./CombinationMatrix";
import { HintsEditor } from "./HintsEditor";

interface GameStudioFormProps {
  /** The game that is edited (null = create a new one). */
  editing: Game | null;
  onSubmit: (config: GameConfig) => void;
  onCancelEdit: () => void;
}

interface FormState {
  name: string;
  rangeAMin: number;
  rangeAMax: number;
  rangeBMin: number;
  rangeBMax: number;
  variantCount: number;
  baseTimeReward: number;
  timePenalty: number;
  maxDailyTime: number;
  questionSeconds: number;
  allowedCombinations: [number, number][];
  hints: { factor: number; text: string }[];
}

function emptyForm(): FormState {
  return {
    name: "",
    rangeAMin: 1,
    rangeAMax: 10,
    rangeBMin: 1,
    rangeBMax: 10,
    variantCount: 3,
    baseTimeReward: 10,
    timePenalty: 5,
    maxDailyTime: 3600,
    questionSeconds: 15,
    allowedCombinations: [],
    hints: [],
  };
}

function formOf(game: Game): FormState {
  return {
    name: game.name,
    rangeAMin: game.rangeA.min,
    rangeAMax: game.rangeA.max,
    rangeBMin: game.rangeB.min,
    rangeBMax: game.rangeB.max,
    variantCount: game.variantCount,
    baseTimeReward: game.baseTimeReward,
    timePenalty: game.timePenalty,
    maxDailyTime: game.maxDailyTime,
    questionSeconds: game.questionSeconds,
    allowedCombinations: game.allowedCombinations ? [...game.allowedCombinations] : [],
    hints: game.hints.map((hint) => ({ ...hint })),
  };
}

/** The game studio form — validated with the shared zod schema before saving. */
export function GameStudioForm({ editing, onSubmit, onCancelEdit }: GameStudioFormProps) {
  const [form, setForm] = useState<FormState>(editing ? formOf(editing) : emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedId, setLoadedId] = useState<string | null>(editing?.id ?? null);

  // Switch to another game (or back to "new") — adjust the state during render.
  if ((editing?.id ?? null) !== loadedId) {
    setLoadedId(editing?.id ?? null);
    setForm(editing ? formOf(editing) : emptyForm());
    setErrors({});
  }

  const patch = (changes: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...changes }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const config: GameConfig = {
      name: form.name,
      rangeA: { min: form.rangeAMin, max: form.rangeAMax },
      rangeB: { min: form.rangeBMin, max: form.rangeBMax },
      allowedCombinations: form.allowedCombinations.length > 0 ? form.allowedCombinations : null,
      variantCount: form.variantCount,
      baseTimeReward: form.baseTimeReward,
      timePenalty: form.timePenalty,
      maxDailyTime: form.maxDailyTime,
      questionSeconds: form.questionSeconds,
      hints: form.hints,
    };
    const parsed = gameConfigSchema.safeParse(config);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
    if (!editing) setForm(emptyForm());
  };

  const error = (key: string) =>
    errors[key] ? (
      <span
        role="alert"
        className="text-sm font-semibold text-red-600"
        data-testid={`error-${key}`}
      >
        {errors[key]}
      </span>
    ) : null;

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm"
      onSubmit={submit}
      data-testid="game-studio"
    >
      <h2 className="text-lg font-bold">{editing ? `Edit "${editing.name}"` : "New game"}</h2>

      <label className="flex flex-col text-sm">
        Name
        <input
          aria-label="Game name"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          className="min-h-[44px] rounded-xl border border-slate-300 px-3"
        />
      </label>
      {error("name")}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">
          Factor A min
          <input
            aria-label="Factor A min"
            type="number"
            value={form.rangeAMin}
            onChange={(event) => patch({ rangeAMin: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-col text-sm">
          Factor A max
          <input
            aria-label="Factor A max"
            type="number"
            value={form.rangeAMax}
            onChange={(event) => patch({ rangeAMax: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
      </div>
      {error("rangeA.min")}
      {error("rangeA.max")}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">
          Factor B min
          <input
            aria-label="Factor B min"
            type="number"
            value={form.rangeBMin}
            onChange={(event) => patch({ rangeBMin: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-col text-sm">
          Factor B max
          <input
            aria-label="Factor B max"
            type="number"
            value={form.rangeBMax}
            onChange={(event) => patch({ rangeBMax: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
      </div>
      {error("rangeB.min")}
      {error("rangeB.max")}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-600">Pinned combinations</legend>
        <CombinationMatrix
          rangeA={{ min: form.rangeAMin, max: form.rangeAMax }}
          rangeB={{ min: form.rangeBMin, max: form.rangeBMax }}
          selected={form.allowedCombinations}
          onChange={(next) => patch({ allowedCombinations: next })}
        />
      </fieldset>

      <fieldset className="flex flex-col text-sm">
        <legend className="text-sm font-semibold text-slate-600">Answer buttons</legend>
        <span className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Fewer variants"
            onClick={() => patch({ variantCount: Math.max(3, form.variantCount - 1) })}
            className="min-h-[44px] w-12 rounded-xl border border-slate-300"
          >
            −
          </button>
          <span data-testid="variant-count">{form.variantCount}</span>
          <button
            type="button"
            aria-label="More variants"
            onClick={() => patch({ variantCount: Math.min(6, form.variantCount + 1) })}
            className="min-h-[44px] w-12 rounded-xl border border-slate-300"
          >
            +
          </button>
        </span>
      </fieldset>
      {error("variantCount")}

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col text-sm">
          Reward (s)
          <input
            aria-label="Reward seconds"
            type="number"
            value={form.baseTimeReward}
            onChange={(event) => patch({ baseTimeReward: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-col text-sm">
          Penalty (s)
          <input
            aria-label="Penalty seconds"
            type="number"
            value={form.timePenalty}
            onChange={(event) => patch({ timePenalty: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-col text-sm">
          Cap (s)
          <input
            aria-label="Cap seconds"
            type="number"
            value={form.maxDailyTime}
            onChange={(event) => patch({ maxDailyTime: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-col text-sm">
          Seconds per question
          <input
            aria-label="Seconds per question"
            type="number"
            value={form.questionSeconds}
            onChange={(event) => patch({ questionSeconds: Number(event.target.value) })}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
      </div>
      {error("baseTimeReward")}
      {error("timePenalty")}
      {error("maxDailyTime")}
      {error("questionSeconds")}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-600">Magic rules</legend>
        <HintsEditor hints={form.hints} onChange={(next) => patch({ hints: next })} />
      </fieldset>
      {error("hints")}

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-[48px] rounded-xl bg-sky-500 px-4 text-lg font-bold text-white"
        >
          {editing ? "Save game" : "Create game"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="min-h-[48px] rounded-xl border border-slate-300 px-4"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
