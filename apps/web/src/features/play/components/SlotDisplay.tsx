interface SlotDisplayProps {
  a: number;
  b: number;
  done: boolean;
}

/** `[ Num 1 ] × [ Num 2 ] = ?` — the slot-machine display. */
export function SlotDisplay({ a, b, done }: SlotDisplayProps) {
  return (
    <div
      className="flex items-center justify-center gap-4 text-5xl font-black"
      data-testid="question"
    >
      <span
        data-testid="factor-a"
        className={`min-w-[72px] rounded-2xl border-4 px-4 py-2 text-center ${
          done ? "border-sky-500 bg-white" : "border-slate-300 bg-slate-50"
        }`}
      >
        {a}
      </span>
      <span className="text-slate-400">×</span>
      <span
        data-testid="factor-b"
        className={`min-w-[72px] rounded-2xl border-4 px-4 py-2 text-center ${
          done ? "border-sky-500 bg-white" : "border-slate-300 bg-slate-50"
        }`}
      >
        {b}
      </span>
      <span className="text-slate-400">=</span>
      <span className="text-slate-400">?</span>
    </div>
  );
}
