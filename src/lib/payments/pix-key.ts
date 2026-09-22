// PIX key masks (BACEN): CPF 000.000.000-00, CNPJ 00.000.000/0000-00, celular
// (18) 00000-0000 with 10 or 11 digits, aleatoria UUID v4. The type is always
// picked explicitly -- auto-detection can't tell CPF from an 11-digit celular.

export type PixKeyType = "aleatoria" | "celular" | "cnpj" | "cpf" | "email";

/** Uppercase DB form; PHONE/RANDOM stand for celular/aleatoria. */
export type ProviderPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

export const PIX_KEY_TYPES: { label: string; value: PixKeyType }[] = [
  { label: "CPF", value: "cpf" },
  { label: "CNPJ", value: "cnpj" },
  { label: "Celular", value: "celular" },
  { label: "E-mail", value: "email" },
  { label: "Aleatória", value: "aleatoria" },
];

export function isNumericPixKey(type: PixKeyType): boolean {
  return type === "cpf" || type === "cnpj" || type === "celular";
}

const CPF_REGEX = /^\d{11}$/;
const CNPJ_REGEX = /^\d{14}$/;
// Celular: 10 or 11 digits; the leading "9" is NOT required.
const CELULAR_11_REGEX = /^\d{11}$/;
const CELULAR_10_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RANDOM_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NON_DIGITS = /\D/g;
const DIGIT_TEST = /\d/;
// The celular mask always renders "+55 " -- strip it so the country code isn't read as local digits.
const LEADING_PLUS_55_SPACE = /^\+55\s?/;
const CPF_GROUP_1 = /(\d{3})(\d)/;
const CPF_GROUP_2 = /(\d{3})(\d{1,2})$/;
const CNPJ_GROUP_1 = /(\d{2})(\d)/;
const CNPJ_GROUP_2 = /(\d{3})(\d)/;
const CNPJ_GROUP_3 = /(\d{3})(\d{1})/;
const CNPJ_GROUP_4 = /(\d{4})(\d{1,2})$/;
const LETTER_OR_AT = /[a-zA-Z@]/;

/** Raw stored value: digits only, celular prefixed with "+55" (E.164), text trimmed. */
export function rawPixKey(value: string, type: PixKeyType): string {
  switch (type) {
    case "cpf":
    case "cnpj":
      return value.replace(NON_DIGITS, "");
    case "celular": {
      const digits = value.replace(NON_DIGITS, "");
      return `+55${digits}`;
    }
    case "email":
    case "aleatoria":
    default:
      return value.trim();
  }
}

/** Display-only mask; expects digits-only input for numeric types. */
export function formatPixKey(value: string, type: PixKeyType): string {
  switch (type) {
    case "cpf": {
      const d = value.replace(NON_DIGITS, "").slice(0, 11);
      return d
        .replace(CPF_GROUP_1, "$1.$2")
        .replace(CPF_GROUP_1, "$1.$2")
        .replace(CPF_GROUP_2, "$1-$2");
    }
    case "cnpj": {
      const d = value.replace(NON_DIGITS, "").slice(0, 14);
      return d
        .replace(CNPJ_GROUP_1, "$1.$2")
        .replace(CNPJ_GROUP_2, "$1.$2")
        .replace(CNPJ_GROUP_3, "$1/$2")
        .replace(CNPJ_GROUP_4, "$1-$2");
    }
    case "celular": {
      const d = value.replace(NON_DIGITS, "").slice(0, 11);
      // Empty -> "" so the placeholder shows the full mask shape.
      if (d.length === 0) {
        return "";
      }
      const ddd = d.slice(0, 2);
      const number = d.slice(2);
      // Separators only ever appear BETWEEN existing digits -- a dangling separator
      // breaks backspace, since sanitize+format would rebuild the same string.
      let local: string;
      if (number.length === 0) {
        local = ddd;
      } else if (number.length === 9) {
        local = `(${ddd}) ${number.slice(0, 5)}-${number.slice(5, 9)}`;
      } else if (number.length === 8) {
        local = `(${ddd}) ${number.slice(0, 4)}-${number.slice(4, 8)}`;
      } else if (number.length >= 6) {
        local = `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
      } else if (number.length >= 5) {
        local = `(${ddd}) ${number}`;
      } else {
        local = `(${ddd}) ${number}`;
      }
      // "+55" lives inside the TextInput value (not as a separate prefix element) so
      // React Native keeps the controlled state in sync on every change.
      return `+55 ${local}`;
    }
    case "email":
    case "aleatoria":
    default:
      return value.trim();
  }
}

export function isValidPixKey(value: string, type: PixKeyType): boolean {
  switch (type) {
    case "cpf":
      return CPF_REGEX.test(value.replace(NON_DIGITS, ""));
    case "cnpj":
      return CNPJ_REGEX.test(value.replace(NON_DIGITS, ""));
    case "celular": {
      const digits = value.replace(NON_DIGITS, "");
      return CELULAR_11_REGEX.test(digits) || CELULAR_10_REGEX.test(digits);
    }
    case "email":
      return EMAIL_REGEX.test(value.trim());
    case "aleatoria":
      return RANDOM_REGEX.test(value.trim());
    default:
      return false;
  }
}

export function maxPixKeyLength(type: PixKeyType): number {
  switch (type) {
    case "cpf":
      return 11;
    case "cnpj":
      return 14;
    case "celular":
      return 11;
    case "email":
    case "aleatoria":
    default:
      return Number.POSITIVE_INFINITY;
  }
}

export function sanitizePixInput(text: string, type: PixKeyType): string {
  if (isNumericPixKey(type)) {
    return text.replace(NON_DIGITS, "").slice(0, maxPixKeyLength(type));
  }
  return text.trim();
}

// Backspacing on a separator shrinks the text without dropping a digit, so a plain
// sanitize+format rebuilds the identical string and the input sticks. Detect that
// case (text shrank, digit count unchanged) and drop the digit before the deleted char.
export function applyPixInputChange(
  prevMasked: string,
  nextMasked: string,
  type: PixKeyType
): string {
  if (!isNumericPixKey(type)) {
    return nextMasked.trim();
  }

  const max = maxPixKeyLength(type);
  // Strip celular's fixed "+55 " so comparisons use local digits only.
  const prev =
    type === "celular"
      ? prevMasked.replace(LEADING_PLUS_55_SPACE, "")
      : prevMasked;
  const next =
    type === "celular"
      ? nextMasked.replace(LEADING_PLUS_55_SPACE, "")
      : nextMasked;
  const prevDigits = prev.replace(NON_DIGITS, "");
  const nextDigits = next.replace(NON_DIGITS, "");

  if (nextDigits.length !== prevDigits.length) {
    return nextDigits.slice(0, max);
  }
  if (next.length >= prev.length) {
    return nextDigits.slice(0, max);
  }

  // First index where prev and next diverge = the removed char.
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
    // Nothing before the separator to delete (e.g. the leading "(").
    return prevDigits.slice(0, max);
  }

  return (prevDigits.slice(0, digitIdx) + prevDigits.slice(digitIdx + 1)).slice(
    0,
    max
  );
}

export function looksTextual(text: string): boolean {
  return LETTER_OR_AT.test(text);
}

// UI keeps the lowercase PixKeyType; the DB column keeps the uppercase one.

const TO_PROVIDER: Record<PixKeyType, ProviderPixKeyType> = {
  aleatoria: "RANDOM",
  celular: "PHONE",
  cnpj: "CNPJ",
  cpf: "CPF",
  email: "EMAIL",
};

const FROM_PROVIDER: Record<ProviderPixKeyType, PixKeyType> = {
  CNPJ: "cnpj",
  CPF: "cpf",
  EMAIL: "email",
  PHONE: "celular",
  RANDOM: "aleatoria",
};

export function toProviderPixKeyType(type: PixKeyType): ProviderPixKeyType {
  return TO_PROVIDER[type];
}

/** The type is always persisted alongside the key, so this never falls back. */
export function fromProviderPixKeyType(type: ProviderPixKeyType): PixKeyType {
  return FROM_PROVIDER[type];
}
