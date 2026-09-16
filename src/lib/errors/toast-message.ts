import { isCRPCClientError } from "kitcn/crpc";

/**
 * Recusa do backend entregue pelo Convex: o `CRPCError` do kitcn estende
 * `ConvexError`, então o payload `{ code, message }` viaja em `error.data` e o
 * `message` do erro do cliente fica só com o wrapper do Convex
 * ("[CONVEX M(...)] [Request ID: ...] Server Error", mais o stack no dev).
 * O `message` do payload é o texto que o backend escreveu para o usuário
 * ("Essa vaga vem de um confronto já decidido e não pode ser ajustada.").
 *
 * Duck-typing em `data.code`/`data.message` (e não `instanceof ConvexError`)
 * pelo mesmo motivo do `defaultIsUnauthorized` do kitcn: a classe pode vir de
 * outro bundle. Payload sem `message` próprio (o kitcn cai no `code` quando o
 * throw não passou mensagem) é descartado — nunca vale ecoar o código.
 */
function readBackendMessage(error: unknown): null | string {
  if (!(error && typeof error === "object" && "data" in error)) {
    return null;
  }
  const { data } = error as { data?: unknown };

  if (!(data && typeof data === "object")) {
    return null;
  }

  const { code, message } = data as { code?: unknown; message?: unknown };

  if (
    typeof code !== "string" ||
    typeof message !== "string" ||
    !message ||
    message.startsWith(code)
  ) {
    return null;
  }

  return message;
}

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

  const backendMessage = readBackendMessage(error);

  return backendMessage ?? fallback;
}

export function getToastErrorMessage(error: unknown, fallback: string): string {
  return getErrorMessage(error, fallback);
}
