import type { GameHint } from "@mult/shared";
import { useState } from "react";

interface HintsEditorProps {
  hints: GameHint[];
  onChange: (next: GameHint[]) => void;
}

/** The "Magic Rules" editor: factor + text, add / remove. */
export function HintsEditor({ hints, onChange }: HintsEditorProps) {
  const [factor, setFactor] = useState(10);
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-2" data-testid="hints-editor">
      <ul className="flex flex-col gap-1">
        {hints.map((hint) => (
          <li
            key={`${hint.factor}-${hint.text}`}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>
              ×{hint.factor}: {hint.text}
            </span>
            <button
              type="button"
              onClick={() => onChange(hints.filter((entry) => entry !== hint))}
              className="min-h-[36px] rounded-lg border border-slate-300 px-3"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm">
          Factor
          <input
            aria-label="Hint factor"
            type="number"
            min={1}
            max={20}
            value={factor}
            onChange={(event) => setFactor(Number(event.target.value))}
            className="min-h-[44px] w-24 rounded-xl border border-slate-300 px-3"
          />
        </label>
        <label className="flex flex-1 flex-col text-sm">
          Hint text
          <input
            aria-label="Hint text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (text.trim().length === 0) return;
            onChange([...hints, { factor, text: text.trim() }]);
            setText("");
          }}
          className="min-h-[44px] rounded-xl border border-slate-300 px-4"
        >
          Add hint
        </button>
      </div>
    </div>
  );
}
