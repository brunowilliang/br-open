/** Rótulo do jogador que ainda não existe (lado sem inscrição na chave). É a
 * sentinela que o card lê para não repetir "A definir" nas duas linhas da
 * dupla: o lado vazio é UMA linha, a dupla é uma unidade. */
export const UNDEFINED_PLAYER_NAME = "A definir";

/** Nome curto do jogador no card: apelido, depois o nome completo e, sem os
 * dois, "Jogador". É a regra dos lados na chave, nas agendas e no "Próximo
 * jogo" (a home inclusive) — uma só, para os nomes não divergirem entre telas. */
export function formatPlayerCardName(
  player:
    | { fullName: null | string; nickname: null | string }
    | null
    | undefined
): string {
  return player?.nickname ?? player?.fullName ?? "Jogador";
}

export type MatchStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
};

const MATCH_STATUS_CHIPS: Record<string, null | MatchStatusChip> = {
  // "champion" não existe no wire: é a FINAL decidida, que a chave lê do
  // `winnerEntryId` e manda pelo mesmo vocabulário do chip.
  champion: { color: "success", label: "Campeão" },
  finished: { color: "accent", label: "Encerrado" },
  pending: { color: "default", label: "A definir" },
  scheduled: { color: "accent", label: "Agendado" },
  // Vaga podada do sorteio: é a moldura da chave, não um jogo — sem chip.
  vacant: null,
  walkover: { color: "warning", label: "W.O." },
};

/** `null` = estado SEM chip (a vaga vazia da chave); status fora do vocabulário
 * cai no rótulo cru, com a cor default. */
export function getMatchStatusChip(status: string): null | MatchStatusChip {
  return Object.hasOwn(MATCH_STATUS_CHIPS, status)
    ? MATCH_STATUS_CHIPS[status]
    : { color: "default", label: status };
}
