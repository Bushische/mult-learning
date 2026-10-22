import { useEffect, useRef, useState } from "react";

export interface RollDisplay {
  a: number;
  b: number;
  /** True once both numbers are locked. */
  done: boolean;
}

/** Share of the roll duration after which Num 1 locks. */
export const NUM1_LOCK_SHARE = 0.4;

function randomFactor(rng: () => number): number {
  return 1 + Math.floor(rng() * 20);
}

/**
 * Two-stage slot-machine roll: Num 1 locks fast, Num 2 decelerates.
 * Driven by `requestAnimationFrame`; cancelled on unmount.
 */
export function useSlotRoll(
  target: { a: number; b: number },
  durationMs: number,
  enabled: boolean,
  rng: () => number = Math.random,
): RollDisplay {
  const [display, setDisplay] = useState<RollDisplay>({ a: target.a, b: target.b, done: false });
  const [lastTarget, setLastTarget] = useState<{ a: number; b: number }>(target);
  const frameRef = useRef<number | null>(null);
  const rngRef = useRef(rng);
  rngRef.current = rng;

  // Reset the roll when a new question arrives (state adjusted during render so
  // the effect below never sees a stale "done" flag).
  if (target.a !== lastTarget.a || target.b !== lastTarget.b) {
    setLastTarget(target);
    setDisplay({ a: target.a, b: target.b, done: false });
  }

  useEffect(() => {
    if (!enabled) return;
    let start: number | null = null;

    const step = (time: number) => {
      if (start === null) start = time;
      const progress = Math.min(1, (time - start) / Math.max(1, durationMs));
      const lockAt = NUM1_LOCK_SHARE;
      const eased = 1 - (1 - progress) ** 3;

      let a: number;
      let b: number;
      if (progress < lockAt) {
        a = randomFactor(rngRef.current);
        b = randomFactor(rngRef.current);
      } else {
        a = target.a;
        b = Math.round(target.b + (randomFactor(rngRef.current) - target.b) * (1 - eased));
      }

      if (progress >= 1) {
        setDisplay({ a: target.a, b: target.b, done: true });
        frameRef.current = null;
        return;
      }
      setDisplay({ a, b, done: false });
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target.a, target.b, durationMs, enabled]);

  return display;
}
