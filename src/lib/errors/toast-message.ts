import { isCRPCClientError } from "kitcn/crpc";

/**
 * Só throw intencional (`CRPCError`/`ConvexError`) vira toast; o resto cai no fallback.
 */
const BACKEND_ERROR_LABEL_PATTERN = /Uncaught[ \t]+(?:CRPC|Convex)Error:[ \t]*/;

/** Marca de que o texto é o envelope do Convex e não a mensagem do backend. */
const CONVEX_ENVELOPE_PATTERN =
  /\[CONVEX [^\]]*\]|\[Request ID: [^\]]*\]|Server Error/;

/**
 * O `message` do cliente é o envelope inteiro; o de `ConvexError` cru é o JSON do payload.
 */
const CONVEX_WRAPPED_MESSAGE_PATTERN = /^\s*\[CONVEX [^\]]*\]/;

/**
 * Devolve só a PRIMEIRA linha após o rótulo (o resto é stack); sem rótulo, `null`.
 */
function stripConvexEnvelope(message: string): null | string {
  const label = BACKEND_ERROR_LABEL_PATTERN.exec(message);

  if (!label) {
    return null;
  }

  // Corta ANTES de aparar: rótulo sozinho na linha daria primeira linha vazia.
  const [firstLine = ""] = message
    .slice(label.index + label[0].length)
    .split("\n");

  return firstLine.trim() || null;
}

/**
 * Texto do backend nas três formas do `message` (limpa, `code: função`, envelope) ou no payload.
 */
function readUserFacingMessage(input: {
  code?: null | string;
  message: string;
}): null | string {
  const fromEnvelope = stripConvexEnvelope(input.message);

  if (fromEnvelope) {
    return fromEnvelope;
  }

  // Envelope do Convex sem throw intencional: nada desse texto cru vira toast.
  if (
    BACKEND_ERROR_LABEL_PATTERN.test(input.message) ||
    CONVEX_ENVELOPE_PATTERN.test(input.message)
  ) {
    return null;
  }

  const trimmed = input.message.trim();

  if (!trimmed || (input.code && trimmed.startsWith(input.code))) {
    return null;
  }

  return trimmed;
}

/**
 * Payload `{ code, message }` em `error.data`; duck-typing (a classe pode vir de outro bundle).
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

  if (typeof code !== "string" || typeof message !== "string") {
    return null;
  }

  return readUserFacingMessage({ code, message });
}

/** Mensagem do backend quando houver; senão o fallback — nada de detalhe técnico no toast. */
export function getErrorMessage(error: unknown, fallback: string): string {
  const { message } =
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown })
      : { message: undefined };

  if (typeof message === "string" && message) {
    const isCrpc = isCRPCClientError(error);

    if (isCrpc || CONVEX_WRAPPED_MESSAGE_PATTERN.test(message)) {
      // O `message` pode vir EMBRULHADO no envelope; o JSON do payload lê no caminho de baixo.
      const userFacing = readUserFacingMessage({
        code: isCrpc ? error.code : null,
        message,
      });

      if (userFacing) {
        return userFacing;
      }
    }
  }

  const backendMessage = readBackendMessage(error);

  return backendMessage ?? fallback;
}

export function getToastErrorMessage(error: unknown, fallback: string): string {
  return getErrorMessage(error, fallback);
}
