interface HintBubbleProps {
  text: string;
}

/** The "Magic Rules" hint bubble. */
export function HintBubble({ text }: HintBubbleProps) {
  return (
    <p
      className="mx-auto max-w-md rounded-2xl bg-amber-100 px-4 py-3 text-center text-lg font-semibold text-amber-900"
      data-testid="hint"
      role="note"
    >
      💡 {text}
    </p>
  );
}
