import type { FieldErrors, FieldValues } from "react-hook-form";

/** Resultado normalizado de uma submissão de formulário inválida. */
export type FormInvalidSubmission<Tab extends string> = {
  description: string;
  label: string;
  tab: Tab;
};

/**
 * Agrupa campos de uma mesma aba/seção do wizard para a mensagem de erro —
 * os grupos ficam por domínio; o algoritmo de varredura é compartilhado.
 */
export type FormErrorGroup<TFields extends FieldValues, Tab extends string> = {
  fallbackDescription: string;
  fields: ReadonlyArray<keyof TFields & string>;
  label: string;
  tab: Tab;
};

/** Primeira mensagem legível dentro de um nó de erros do RHF (recursivo). */
export function getFirstErrorMessage(error: unknown): null | string {
  if (!error || typeof error !== "object") {
    return null;
  }

  if (
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  const values = Array.isArray(error)
    ? error
    : Object.values(error as Record<string, unknown>);

  for (const value of values) {
    const message = getFirstErrorMessage(value);

    if (message) {
      return message;
    }
  }

  return null;
}

/**
 * Varre os grupos na ordem e retorna a primeira submissão inválida
 * descriptografável. `stopOnSilentError` resolve a diferença entre os
 * domínios: a liga para no `fallbackDescription` do grupo quando o campo
 * tem erro sem mensagem; o torneio continua procurando nos campos seguintes.
 */
export function resolveFormInvalidSubmission<
  TFields extends FieldValues,
  Tab extends string,
>(input: {
  errors: FieldErrors<TFields>;
  fallback: FormInvalidSubmission<Tab>;
  groups: readonly FormErrorGroup<TFields, Tab>[];
  stopOnSilentError: boolean;
}): FormInvalidSubmission<Tab> {
  for (const group of input.groups) {
    for (const field of group.fields) {
      const fieldError = input.errors[field];

      if (!fieldError) {
        continue;
      }

      const message = getFirstErrorMessage(fieldError);

      if (message) {
        return {
          description: message,
          label: group.label,
          tab: group.tab,
        };
      }

      if (input.stopOnSilentError) {
        return {
          description: group.fallbackDescription,
          label: group.label,
          tab: group.tab,
        };
      }
    }
  }

  return input.fallback;
}
