import { useState } from "react";

interface PinPadProps {
  username: string;
  error: string | null;
  disabled: boolean;
  onSubmit: (pin: string) => void;
  onBack: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

/** The 4-digit PIN entry (numeric pad, big touch targets). */
export function PinPad({ username, error, disabled, onSubmit, onBack }: PinPadProps) {
  const [pin, setPin] = useState("");

  const press = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (key === "clear") {
      setPin("");
      return;
    }
    if (key === "back") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = `${pin}${key}`;
    setPin(next);
    if (next.length === 4) onSubmit(next);
  };

  return (
    <section className="flex flex-col items-center gap-4" data-testid="pin-pad">
      <h2 className="text-2xl font-bold">{username}</h2>
      <p className="text-sm text-slate-500">Enter your 4-digit PIN</p>

      <div className="flex gap-3" aria-label="PIN entry">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            data-testid="pin-dot"
            data-filled={index < pin.length ? "true" : "false"}
            className={`h-6 w-6 rounded-full border-2 ${
              index < pin.length ? "border-sky-500 bg-sky-500" : "border-slate-400"
            }`}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-lg font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            className="min-h-[56px] rounded-2xl bg-white text-2xl font-semibold shadow-sm disabled:opacity-50"
          >
            {key === "clear" ? "C" : key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="min-h-[44px] px-4 text-lg text-slate-600 underline"
      >
        Back
      </button>
    </section>
  );
}
