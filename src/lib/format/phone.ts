const NON_DIGITS = /\D/g;
const DIGIT_TEST = /\d/;

export function sanitizePhoneBR(text: string): string {
  return text.replace(NON_DIGITS, "").slice(0, 11);
}

export function formatPhoneBR(value: string): string {
  const d = value.replace(NON_DIGITS, "").slice(0, 11);
  if (d.length === 0) {
    return "";
  }
  const ddd = d.slice(0, 2);
  const number = d.slice(2);
  if (number.length === 0) {
    return ddd;
  }
  if (number.length >= 9) {
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5, 9)}`;
  }
  if (number.length === 8) {
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4, 8)}`;
  }
  if (number.length >= 6) {
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }
  return `(${ddd}) ${number}`;
}

export function applyPhoneInputChange(prev: string, next: string): string {
  const prevDigits = prev.replace(NON_DIGITS, "");
  const nextDigits = next.replace(NON_DIGITS, "");

  if (nextDigits.length !== prevDigits.length) {
    return sanitizePhoneBR(next);
  }
  if (next.length >= prev.length) {
    return sanitizePhoneBR(next);
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
    11
  );
}
