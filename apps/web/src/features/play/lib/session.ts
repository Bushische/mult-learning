export interface SessionSummary {
  /** Questions answered in this session. */
  tries: number;
  correct: number;
  /** Accuracy in percent (0..100, rounded). */
  accuracyPercent: number;
  /** Seconds actually added to the time bank (positive deltas only). */
  bankAdded: number;
}

/** Build the session summary from the collected answers. */
export function buildSummary(tries: number, correct: number, bankAdded: number): SessionSummary {
  return {
    tries,
    correct,
    accuracyPercent: tries === 0 ? 0 : Math.round((correct / tries) * 100),
    bankAdded,
  };
}
