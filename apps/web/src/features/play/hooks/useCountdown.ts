import { useEffect, useRef, useState } from "react";

export interface CountdownState {
  /** Milliseconds left. */
  remaining: number;
  running: boolean;
}

/**
 * Countdown for one question. Calls `onTimeout` exactly once when the time is
 * up. The timer is cleared on unmount (no stray submissions).
 */
export function useCountdown(
  totalMs: number,
  active: boolean,
  onTimeout: () => void,
): CountdownState {
  const [remaining, setRemaining] = useState(totalMs);
  const [running, setRunning] = useState(false);
  const firedRef = useRef(false);
  const timeoutRef = useRef<(() => void) | null>(null);
  timeoutRef.current = onTimeout;

  useEffect(() => {
    if (!active) return;
    firedRef.current = false;
    setRemaining(totalMs);
    setRunning(true);

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const left = totalMs - (Date.now() - startedAt);
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        clearInterval(interval);
        if (!firedRef.current) {
          firedRef.current = true;
          timeoutRef.current?.();
        }
        return;
      }
      setRemaining(left);
    }, 100);

    return () => {
      clearInterval(interval);
      setRunning(false);
    };
  }, [active, totalMs]);

  return { remaining, running };
}
