import { isCRPCClientError } from "kitcn/crpc";

/**
 * Rótulo do erro INTENCIONAL do backend dentro do envelope do Convex. O
 * `CRPCError` do kitcn estende `ConvexError`, então o Convex entrega o throw
 * como `Uncaught CRPCError: <mensagem>` (e `ConvexError` quando sai por outro
 * caminho). Qualquer outro rótulo (`ArgumentValidationError`, `Error`, ...) é
 * interno e NUNCA vira toast.
 */
const BACKEND_ERROR_LABEL_PATTERN = /Uncaught[ \t]+(?:CRPC|Convex)Error:[ \t]*/;

/** Marca de que o texto é o envelope do Convex e não a mensagem do backend. */
const CONVEX_ENVELOPE_PATTERN =
  /\[CONVEX [^\]]*\]|\[Request ID: [^\]]*\]|Server Error/;

/**
 * O `message` do cliente É o envelope inteiro (começa em "[CONVEX M(...)]"),
 * diferente do `message` de um `ConvexError` cru, que é o JSON do payload
 * ("{\"code\":...}") — esse nunca é o envelope e não pode ser lido como um.
 */
const CONVEX_WRAPPED_MESSAGE_PATTERN = /^\s*\[CONVEX [^\]]*\]/;

/**
 * Envelope do Convex no `message` do erro do cliente (BUG-0054):
 *
 * ```
 * [CONVEX M(league/membership:approve)] [Request ID: 76269abf707e6ef7] Server Error
 * Uncaught CRPCError: Essa solicitação de entrada já foi resolvida.
 * ```
 *
 * Devolve só a MENSAGEM do backend: o envelope inteiro (inclusive o Request ID)
 * fica de fora e, do texto depois do rótulo, entra apenas a PRIMEIRA linha — o
 * que vem embaixo é o stack do dev (`at ...`, `Called by client`), que nunca
 * pode aparecer no toast. As mensagens do backend neste repo são de uma linha.
 * Rótulo SEM mensagem na mesma linha (throw anônimo, por exemplo) devolve
 * `null` em vez de pescar a linha do stack.
 *
 * `null` quando não há envelope de erro intencional (aí quem decide é o
 * caminho do payload/fallback).
 */
function stripConvexEnvelope(message: string): null | string {
  const label = BACKEND_ERROR_LABEL_PATTERN.exec(message);

  if (!label) {
    return null;
  }

  // Corta ANTES de aparar: com o rótulo sozinho na linha, a primeira linha é
  // vazia e o `null` cai no texto amigável.
  const [firstLine = ""] = message
    .slice(label.index + label[0].length)
    .split("\n");

  return firstLine.trim() || null;
}

/**
 * Texto que o backend escreveu para o usuário a partir de um `message` de
 * erro — tanto o do cliente (as três formas reais: limpa, o
 * `${code}: ${functionName}` do kitcn, ou o envelope do Convex) quanto o do
 * payload (`data.message`). Qualquer coisa que cheire a envelope sem uma
 * mensagem intencional é recusada. `null` = nada aproveitável.
 */
function readUserFacingMessage(input: {
  code?: null | string;
  message: string;
}): null | string {
  const fromEnvelope = stripConvexEnvelope(input.message);

  if (fromEnvelope) {
    return fromEnvelope;
  }

  // Envelope do Convex SEM rótulo de throw intencional (validação de
  // argumentos, erro interno, stack) ou rótulo SEM mensagem na linha: nada
  // desse texto cru pode virar toast.
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
 * Recusa do backend entregue pelo Convex: o `CRPCError` do kitcn estende
 * `ConvexError`, então o payload `{ code, message }` viaja em `error.data` e o
 * `message` do erro do cliente pode ficar só com o wrapper do Convex
 * ("[CONVEX M(...)] [Request ID: ...] Server Error", mais o stack no dev).
 * O `message` do payload é o texto que o backend escreveu para o usuário
 * ("Essa vaga vem de um confronto já decidido e não pode ser ajustada.").
 *
 * Duck-typing em `data.code`/`data.message` (e não `instanceof ConvexError`)
 * pelo mesmo motivo do `defaultIsUnauthorized` do kitcn: a classe pode vir de
 * outro bundle. Payload sem `message` próprio (o kitcn cai no `code` quando o
 * throw não passou mensagem) é descartado — nunca vale ecoar o código.
 *
 * Passa pelo MESMO crivo do `message` do erro: se um dia o envelope viajar só
 * no payload (ou o `message` do erro vier vazio/não-string), nada dele vaza.
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

/**
 * Extracts a user-facing message from a mutation/query error.
 *
 * Only messages intentionally thrown from the backend via `CRPCError` are
 * surfaced — everything else (Convex internals like `ArgumentValidationError`,
 * network errors, transport errors) falls back to a friendly default so we
 * never leak technical detail into a toast.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  const { message } =
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown })
      : { message: undefined };

  if (typeof message === "string" && message) {
    const isCrpc = isCRPCClientError(error);

    if (isCrpc || CONVEX_WRAPPED_MESSAGE_PATTERN.test(message)) {
      // `CRPCClientError` constrói o `message` a partir do backend, mas o
      // Convex pode entregá-lo EMBRULHADO no envelope (BUG-0054) — as três
      // formas (limpa, `${code}: ${functionName}`, envelope) passam pelo
      // mesmo crivo. O envelope lido aqui é só o do cliente (`[CONVEX ...`);
      // o `message` de um `ConvexError` cru é o JSON do payload, que quem lê é
      // o caminho de baixo.
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
