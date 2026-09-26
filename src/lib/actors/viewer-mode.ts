import type { ViewerActor } from "@convex/domains/auth/actor-context";

export type ViewerMode = "organization" | "player";

/**
 * O MODO da casa vem do ATOR ATIVO (`viewer.context.get`), nunca de capability:
 * `canManageOrganization` decide PERMISSÃO (dono/admin), `kind` decide a
 * SUPERFÍCIE — a tab bar e as listas de competições leem daqui.
 */
export function getViewerMode(
  actor?: null | Pick<ViewerActor, "kind">
): ViewerMode {
  return actor?.kind === "organization" ? "organization" : "player";
}

/**
 * Identidade do ator ATIVO, pra amarrar dado ao MODO: payload hidratado sob
 * outra chave é do outro ator e não pode ser pintado. `null` = contexto pendente.
 */
export function getViewerActorKey(
  actor?: null | Pick<ViewerActor, "id" | "kind">
): null | string {
  return actor ? `${actor.kind}:${actor.id}` : null;
}
