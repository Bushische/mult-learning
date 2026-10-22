/** Tuning of the play loop (client side only — the API knows nothing about timing). */
/** Num 1 spins fast, then locks. */
export const ROLL1_MS = 350;
/** A beat with Num 2 hidden (`?`) after Num 1 locks. */
export const PAUSE1_MS = 450;
/** The answer buttons fade in (disabled) while Num 2 is still hidden. */
export const OPTIONS_MS = 550;
/** Num 2 spins and decelerates, then locks and the countdown starts. */
export const ROLL2_MS = 800;
/** The tick of the fast shuffle and the first Num 2 spin step. */
export const SPIN_TICK_MS = 60;
/** Comfortable seconds per question (fallback when the game has none). */
export const QUESTION_SECONDS = 15;
