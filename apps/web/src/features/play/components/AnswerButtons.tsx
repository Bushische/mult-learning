interface AnswerButtonsProps {
  options: number[];
  disabled: boolean;
  /** The chosen option (feedback state). */
  chosen: number | null;
  /** The correct answer (revealed after a miss). */
  rightAnswer: number | null;
  onSelect: (value: number) => void;
}

/** The answer buttons — randomized positions, one correct answer. */
export function AnswerButtons({
  options,
  disabled,
  chosen,
  rightAnswer,
  onSelect,
}: AnswerButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="answers">
      {options.map((option) => {
        const isChosen = chosen === option;
        const isRight = rightAnswer !== null && option === rightAnswer;
        const classes = [
          "min-h-[64px] rounded-2xl text-2xl font-bold shadow-sm transition",
          isRight ? "bg-green-500 text-white" : "",
          isChosen && !isRight ? "bg-red-500 text-white" : "",
          !isRight && !(isChosen && !isRight) ? "bg-white text-slate-800" : "",
          rightAnswer === null ? "" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            data-testid={`answer-${option}`}
            data-right={isRight ? "true" : "false"}
            onClick={() => onSelect(option)}
            className={classes}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
