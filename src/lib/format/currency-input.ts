const NON_DIGITS = /\D/g;
const LEADING_ZEROS = /^0+(?=\d)/;
const DIGIT_TEST = /\d/;

/** Teto de dígitos do input (R$ 9.999.999.999,99). */
const MAX_DIGITS = 12;

/**
 * Formata uma string de dígitos como moeda BR progressiva: cada dígito
 * digitado entra como centavos acumulados ("1" -> "0,01", "123" -> "1,23",
 * "123456" -> "1.234,56"). Idempotente sobre valores já mascarados;
 * normaliza zeros à esquerda ("00550" -> "5,50", não "005,50").
 */
export function formatCurrencyInput(value: string): string {
  const d = value
    .replace(NON_DIGITS, "")
    .replace(LEADING_ZEROS, "")
    .slice(0, MAX_DIGITS);
  if (d.length === 0) {
    return "";
  }
  const cents = d.slice(-2).padStart(2, "0");
  const reais = d.slice(0, -2);
  const reaisGrouped = reais
    ? reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : "0";
  return `${reaisGrouped},${cents}`;
}

/**
 * Translates a masked-input change into the next digit string, fixing the
 * "can't backspace a separator" bug: when the cursor sits on a separator
 * (`.` or `,`) and the user presses backspace, React Native reports the text
 * WITHOUT the separator but with the same digits, so the digit before it
 * must be dropped instead.
 */
export function applyCurrencyInputChange(prev: string, next: string): string {
  const prevDigits = prev.replace(NON_DIGITS, "");
  const nextDigits = next.replace(NON_DIGITS, "");

  if (nextDigits.length !== prevDigits.length) {
    return next.replace(NON_DIGITS, "").slice(0, MAX_DIGITS);
  }
  if (next.length >= prev.length) {
    return next.replace(NON_DIGITS, "").slice(0, MAX_DIGITS);
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
    MAX_DIGITS
  );
}

/** Converte o valor mascarado do input para centavos ("1.234,56" -> 123456). */
export function currencyInputToCents(value: string): number {
  const d = value.replace(NON_DIGITS, "");
  return d.length === 0 ? 0 : Number(d);
}

/** Converte centavos para o valor do input ("4,50"). Vazio para 0/negativo. */
export function centsToCurrencyInput(cents: number): string {
  if (!Number.isInteger(cents) || cents <= 0) {
    return "";
  }
  return formatCurrencyInput(String(cents));
}
