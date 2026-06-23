import { isCRPCClientError } from "kitcn/crpc";

/**
 * Extracts a user-facing message from a mutation/query error.
 *
 * Only messages intentionally thrown from the backend via `CRPCError` are
 * surfaced — everything else (Convex internals like `ArgumentValidationError`,
 * network errors, transport errors) falls back to a friendly default so we
 * never leak technical detail into a toast.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  // `CRPCClientError` builds its `message` from the backend `CRPCError`
  // options: when the backend supplied one it reads like "Jogador não
  // encontrado.", otherwise it falls back to `${code}: ${functionName}`
  // (e.g. "BAD_REQUEST: league/management:create"), which is not useful to
  // a user — drop those.
  if (
    isCRPCClientError(error) &&
    error.message &&
    !error.message.startsWith(error.code)
  ) {
    return error.message;
  }

  return fallback;
}

export function getToastErrorMessage(error: unknown, fallback: string): string {
  return getErrorMessage(error, fallback);
}
