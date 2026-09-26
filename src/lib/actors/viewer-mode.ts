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
