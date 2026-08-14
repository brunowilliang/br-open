import { useCallback, useMemo, useState } from "react";

import { formatCurrencyInput } from "@/lib/format/currency-input";

export type Digit = {
  id: string;
  type: "digit" | "separator";
  value: string;
};

export type AmountParts = {
  integer: Digit[];
  decimal: Digit[];
};

/** Teto: R$ 999.999.999,99. */
const MAX_CENTS = 99_999_999_999;

/**
 * Centavos -> partes BRL (centavos acumulado, estilo Revolut):
 * 2 -> "0","02" · 25 -> "0","25" · 250 -> "2","50" · 2500 -> "25","00".
 * A parte inteira cresce sempre no final (append) — permite animar cada
 * casa entrando/saindo e a vírgula deslizando.
 */
export function centsToParts(cents: number): AmountParts {
  const formatted = formatCurrencyInput(cents === 0 ? "0" : String(cents));
  const [intStr = "0", decStr = "00"] = formatted.split(",");
  const mapDigits = (str: string, prefix: string): Digit[] =>
    str.split("").map((value, index) => ({
      id: `${prefix}-${index}`,
      type: value === "." || value === "," ? "separator" : "digit",
      value,
    }));
  return { decimal: mapDigits(decStr, "c"), integer: mapDigits(intStr, "r") };
}

/** Aplica uma tecla do teclado numérico sobre os centavos atuais. */
export function applyKey(cents: number, key: string): number {
  if (key === "backspace") {
    return Math.floor(cents / 10);
  }
  const digit = Number(key);
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    return cents;
  }
  const next = cents * 10 + digit;
  return next > MAX_CENTS ? cents : next;
}

/**
 * Controller do teclado numérico de saque. Trabalha em CENTAVOS (inteiro),
 * acumulando cada dígito (estilo Revolut). A validação (mínimo/saldo) fica
 * na tela, que tem acesso ao `balance`.
 */
export const useAmountInputController = () => {
  const [cents, setCents] = useState(0);

  const parts = useMemo(() => centsToParts(cents), [cents]);
  const isEmpty = cents === 0;

  const handleKeyPress = useCallback((key: string) => {
    setCents((current) => applyKey(current, key));
  }, []);

  const setAmountCents = useCallback(
    (value: number) => setCents(Math.max(0, Math.floor(value))),
    []
  );
  const clear = useCallback(() => setCents(0), []);

  return {
    amountInCents: cents,
    clear,
    handleKeyPress,
    isEmpty,
    parts,
    setAmountCents,
  };
};
