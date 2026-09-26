import type { ViewerMode } from "@/lib/actors/viewer-mode";

/**
 * A superfície de "Minhas Competições" por modo: o jogador vê o que participa
 * (sem criar nem editar), o organizador vê o que criou (com criar e editar).
 * Deriva do MODO, não de capability, para o botão de organizador não vazar no
 * modo jogador.
 */
export type CompetitionListSurface = {
  list: "mine" | "participating";
  showsCreateCard: boolean;
  showsEditAction: boolean;
};

export function getCompetitionListSurface(
  mode: ViewerMode
): CompetitionListSurface {
  if (mode === "organization") {
    return { list: "mine", showsCreateCard: true, showsEditAction: true };
  }

  return {
    list: "participating",
    showsCreateCard: false,
    showsEditAction: false,
  };
}
