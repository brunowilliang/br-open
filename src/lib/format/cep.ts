const NON_DIGITS = /\D/g;
const DIGIT_TEST = /\d/;

export function formatCep(value: string): string {
  const d = value.replace(NON_DIGITS, "").slice(0, 8);
  if (d.length === 0) {
    return "";
  }
  if (d.length <= 5) {
    return d;
  }
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Translates a masked-input change into the next digit string, fixing the
 * "can't backspace a separator" bug: when the cursor sits on the "-" and the
 * user presses backspace, React Native reports the text WITHOUT the separator
 * but with the same digits, so the digit before it must be dropped instead.
 */
export function applyCepInputChange(prev: string, next: string): string {
  const prevDigits = prev.replace(NON_DIGITS, "");
  const nextDigits = next.replace(NON_DIGITS, "");

  if (nextDigits.length !== prevDigits.length) {
    return next.replace(NON_DIGITS, "").slice(0, 8);
  }
  if (next.length >= prev.length) {
    return next.replace(NON_DIGITS, "").slice(0, 8);
  }

  let removedAt = 0;
  while (removedAt < next.length && prev[removedAt] === next[removedAt]) {
    removedAt++;
  }

  let digitIdx = -1;
  for (let k = 0; k < removedAt; k++) {
    if (DIGIT_TEST.test(prev[k] ?? "")) {
      digitIdx++;
    }
  }
  if (digitIdx < 0) {
    return prevDigits;
  }

  return (prevDigits.slice(0, digitIdx) + prevDigits.slice(digitIdx + 1)).slice(
    0,
    8
  );
}
