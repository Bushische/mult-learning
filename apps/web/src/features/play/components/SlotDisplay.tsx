import { OPERATION_SYMBOLS, type Operation } from "@mult/shared";

interface SlotDisplayProps {
  a: number;
  /** `null` renders as `?` — the number is still hidden. */
  b: number | null;
  aLocked: boolean;
  bLocked: boolean;
  /** Equation symbol (`+ − × ÷`), defaults to `×` for legacy callers. */
  operation?: Operation;
}

/** `[ Num 1 ] ⟨op⟩ [ Num 2 ] = ?` — the slot-machine display. */
export function SlotDisplay({ a, b, aLocked, bLocked, operation = "mul" }: SlotDisplayProps) {
  return (
    <div
      className="flex items-center justify-center gap-4 text-5xl font-black"
      data-testid="question"
    >
      <span
        data-testid="factor-a"
        className={`min-w-[72px] rounded-2xl border-4 px-4 py-2 text-center ${
          aLocked ? "border-sky-500 bg-white" : "border-slate-300 bg-slate-50"
        }`}
      >
        {a}
      </span>
      <span className="text-slate-400" data-testid="equation-op">
        {OPERATION_SYMBOLS[operation]}
      </span>
      <span
        data-testid="factor-b"
        className={`min-w-[72px] rounded-2xl border-4 px-4 py-2 text-center ${
          bLocked ? "border-sky-500 bg-white" : "border-slate-300 bg-slate-50"
        }`}
      >
        {b ?? "?"}
      </span>
      <span className="text-slate-400">=</span>
      <span className="text-slate-400">?</span>
    </div>
  );
}
