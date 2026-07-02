/**
 * PIX key formatting & validation.
 *
 * A PIX key has exactly one of these types (BACEN spec):
 *   - CPF       11 digits
 *   - CNPJ      14 digits
 *   - CELULAR   10 digits (DDD 2 + 8)        -> (18) 0000-0000
 *               11 digits (DDD 2 + 9 + 8)    -> (18) 00000-0000
 *   - EMAIL     user@domain.com
 *   - ALEATORIA UUID v4 (EVP)
 *
 * The type is chosen explicitly via a selector -- there's no auto-detection,
 * which avoids the CPF/celular ambiguity (both can have 11 digits). The raw
 * value is digits for CPF/CNPJ, E.164 "+55..." for phones. The mask here is
 * display-only.
 */

export type PixKeyType = "aleatoria" | "celular" | "cnpj" | "cpf" | "email";

/**
 * PIX key type as stored in the database (uppercase, provider-agnostic).
 * Persisted alongside `organization.pixKey` and mapped to/from the lowercase
 * `PixKeyType` used in the UI.
 */
export type ProviderPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

export const PIX_KEY_TYPES: { label: string; value: PixKeyType }[] = [
  { label: "CPF", value: "cpf" },
  { label: "CNPJ", value: "cnpj" },
  { label: "Celular", value: "celular" },
  { label: "E-mail", value: "email" },
  { label: "Aleatória", value: "aleatoria" },
];

/** Whether the key type stores digits only (vs free text). */
export function isNumericPixKey(type: PixKeyType): boolean {
  return type === "cpf" || type === "cnpj" || type === "celular";
}

// All regex literals hoisted to module scope (Biome: useTopLevelRegex).
const CPF_REGEX = /^\d{11}$/;
const CNPJ_REGEX = /^\d{14}$/;
// Celular accepts BOTH 10 digits (DDD + 8) and 11 digits (DDD + 9 + 8). We
// don't require the leading "9" -- any 10/11-digit BR phone is valid.
const CELULAR_11_REGEX = /^\d{11}$/; // DDD(2) + 9 digits
const CELULAR_10_REGEX = /^\d{10}$/; // DDD(2) + 8 digits
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RANDOM_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NON_DIGITS = /\D/g;
const DIGIT_TEST = /\d/;
// Matches the fixed "+55 " (or "+55") prefix rendered as part of the celular
// mask. Used to strip it before processing a change so the country code's
// digits aren't mistaken for the local key.
const LEADING_PLUS_55_SPACE = /^\+55\s?/;
const CPF_GROUP_1 = /(\d{3})(\d)/;
const CPF_GROUP_2 = /(\d{3})(\d{1,2})$/;
const CNPJ_GROUP_1 = /(\d{2})(\d)/;
const CNPJ_GROUP_2 = /(\d{3})(\d)/;
const CNPJ_GROUP_3 = /(\d{3})(\d{1})/;
const CNPJ_GROUP_4 = /(\d{4})(\d{1,2})$/;
const LETTER_OR_AT = /[a-zA-Z@]/;

/**
 * Returns the RAW value for the given type:
 *   cpf/cnpj/celular -> digits only
 *   celular          -> prefixed with "+55" (E.164)
 *   email/aleatoria  -> trimmed text
 */
export function rawPixKey(value: string, type: PixKeyType): string {
  switch (type) {
    case "cpf":
    case "cnpj":
      return value.replace(NON_DIGITS, "");
    case "celular": {
      const digits = value.replace(NON_DIGITS, "");
      // E.164 with the +55 country code.
      return `+55${digits}`;
    }
    case "email":
    case "aleatoria":
    default:
      return value.trim();
  }
}

/**
 * Applies a display mask for the given type. Expects the stored value to be
 * digits-only (for numeric types) or raw text (for email/aleatoria).
 *   cpf      -> 000.000.000-00
 *   cnpj     -> 00.000.000/0000-00
 *   celular  -> (18) 0000-0000   (10 digits, DDD + 8)
 *            -> (18) 00000-0000  (11 digits, DDD + 9 + 8)
 *   email/aleatoria -> returned as-is
 */
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
      // Empty -> let the placeholder show the full mask shape.
      if (d.length === 0) {
        return "";
      }
      const ddd = d.slice(0, 2);
      const number = d.slice(2);
      // Build the LOCAL mask progressively. Separators only ever appear
      // BETWEEN digits that already exist -- never dangling after the last
      // digit -- otherwise backspace removes the separator, sanitize
      // re-extracts the same digits, and the input gets stuck.
      let local: string;
      if (number.length === 0) {
        // "" / "1" / "22" -> raw digits, no "(" yet.
        local = ddd;
      } else if (number.length === 9) {
        // 9 digits (DDD + 9 + 8) -> 5-4:  (18) 00000-0000
        local = `(${ddd}) ${number.slice(0, 5)}-${number.slice(5, 9)}`;
      } else if (number.length === 8) {
        // 8 digits (DDD + 8) -> 4-4:  (18) 0000-0000
        local = `(${ddd}) ${number.slice(0, 4)}-${number.slice(4, 8)}`;
      } else if (number.length >= 6) {
        // 6-7 digits: first group (5) complete, second group started -> "5-n"
        local = `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
      } else if (number.length >= 5) {
        // 5 digits: first group complete, second not started -> "5"
        local = `(${ddd}) ${number}`;
      } else {
        // 1-4 digits: not enough to commit to a group shape yet.
        local = `(${ddd}) ${number}`;
      }
      // The "+55" country code is part of the mask itself -- always shown,
      // never editable. Storing it here (rather than as a separate prefix
      // element) keeps it inside the TextInput value, so React Native keeps
      // the controlled state in sync on every change.
      return `+55 ${local}`;
    }
    case "email":
    case "aleatoria":
    default:
      return value.trim();
  }
}

/**
 * Validates whether the raw value matches the chosen type.
 *   celular accepts BOTH 10 and 11 digits.
 */
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

/**
 * Normalizes incoming change text for the given type: numeric types keep only
 * digits; email/aleatoria keep their text. Use this in the input's
 * `onChangeText` so the raw store stays stable while the displayed value is
 * masked by `formatPixKey`.
 */
/**
 * Maximum number of digits a numeric key type accepts. Used to cap the stored
 * value so the raw input and the masked display never diverge (e.g. typing a
 * 12th digit on a CPF).
 */
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

/**
 * Translates a masked-input change into the next raw digit string, fixing the
 * "can't backspace a separator" bug.
 *
 * Problem: for numeric types the masked `value` is what's displayed (e.g.
 * `(18) 99666-0126`); when the user positions the cursor on a separator
 * (`-`, ` `, `(`, `)`) and presses backspace, React Native reports the text
 * WITHOUT the separator, but the underlying digits are unchanged. A naive
 * `sanitize -> format` loop then rebuilds the identical string, so the input
 * never changes and the user is stuck -- they can't delete anything.
 *
 * Fix: when the text shrank but the digit count stayed the same (backspace hit
 * a separator), we remove the DIGIT immediately before the deleted separator
 * -- that's the one the user is trying to erase. In all other cases (digit
 * added, real digit removed, paste, clear) we fall through to the standard
 * sanitize behaviour.
 *
 * Textual types (email/aleatoria) have no mask, so this is a pass-through.
 */
export function applyPixInputChange(
  prevMasked: string,
  nextMasked: string,
  type: PixKeyType
): string {
  if (!isNumericPixKey(type)) {
    return nextMasked.trim();
  }

  const max = maxPixKeyLength(type);
  // The celular mask renders a fixed "+55 " prefix as part of the displayed
  // value. Strip it before comparing so the digits we work with are the LOCAL
  // digits (the raw field value), not the country code.
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

  // Digit count changed (typed or deleted a real digit): standard path.
  if (nextDigits.length !== prevDigits.length) {
    return nextDigits.slice(0, max);
  }
  // Same digit count but text didn't shrink: not a backspace (paste/reformat).
  if (next.length >= prev.length) {
    return nextDigits.slice(0, max);
  }

  // Backspace deleted a separator (text shrank, digits unchanged). Find the
  // first index where prev and next diverge -- that's the removed char.
  let removedAt = 0;
  while (removedAt < next.length && prev[removedAt] === next[removedAt]) {
    removedAt++;
  }

  // Find the last DIGIT before `removedAt` in prev -- the one to remove.
  let digitIdx = -1;
  for (let k = 0; k < removedAt; k++) {
    if (DIGIT_TEST.test(prev[k] ?? "")) {
      digitIdx++;
    }
  }
  if (digitIdx < 0) {
    // No digit before the separator (e.g. backspace on the leading '('):
    // nothing to remove; the user has to press backspace again.
    return prevDigits.slice(0, max);
  }

  return (prevDigits.slice(0, digitIdx) + prevDigits.slice(digitIdx + 1)).slice(
    0,
    max
  );
}

/**
 * Returns true when a typed value looks like it should switch to a textual key
 * type (email/aleatoria) -- e.g. the user typed a letter or "@" while a
 * numeric type was selected.
 */
export function looksTextual(text: string): boolean {
  return LETTER_OR_AT.test(text);
}

// --- Provider <-> UI type mapping ---------------------------------------------
// The UI uses the lowercase PixKeyType; the DB column uses the uppercase
// ProviderPixKeyType. The only non-trivial mappings are celular <-> PHONE
// and aleatoria <-> RANDOM; the rest are plain upper/lower-case.

const TO_PROVIDER: Record<PixKeyType, ProviderPixKeyType> = {
  aleatoria: "RANDOM",
  celular: "PHONE",
  cnpj: "CNPJ",
  cpf: "CPF",
  email: "EMAIL",
};

const FROM_PROVIDER: Record<ProviderPixKeyType, PixKeyType> = {
  CPF: "cpf",
  CNPJ: "cnpj",
  EMAIL: "email",
  PHONE: "celular",
  RANDOM: "aleatoria",
};

/** Maps the UI type to the DB/provider type (celular -> PHONE, aleatoria -> RANDOM). */
export function toProviderPixKeyType(type: PixKeyType): ProviderPixKeyType {
  return TO_PROVIDER[type];
}

/**
 * Maps the DB/provider type back to the UI type. The type is always persisted
 * alongside the key, so this always resolves.
 */
export function fromProviderPixKeyType(type: ProviderPixKeyType): PixKeyType {
  return FROM_PROVIDER[type];
}
