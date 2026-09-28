import {
  Calendar03Icon,
  Cancel01Icon,
  Edit02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import type { HugeIconGlyph } from "@/components/ui/huge-icons";

import { MATCH_AGREEMENT_COPY } from "./match-agreement-copy";

// Fonte única do menu do acerto: verbo, ícone e efeito por estado do canal.

export type MatchAgreementChannel = "schedule" | "score";

export type MatchAgreementActionKind =
  | "approve_schedule"
  | "approve_score"
  | "cancel_schedule"
  | "cancel_score"
  | "counter_schedule"
  | "counter_score"
  | "decline_schedule"
  | "decline_score"
  | "propose_schedule"
  | "send_score";

/** O que o verbo faz no servidor: aceitar fecha o canal, recusar derruba a
 * proposta vigente (dá para propor de novo), retirar tira a PRÓPRIA proposta
 * (só o autor retira) e propor (enviar/editar) abre a proposta nova por cima
 * da vigente. */
export type MatchAgreementActionEffect =
  | "accept"
  | "decline"
  | "propose"
  | "withdraw";

export type MatchAgreementAction = {
  effect: MatchAgreementActionEffect;
  icon: HugeIconGlyph;
  isDanger: boolean;
  kind: MatchAgreementActionKind;
  label: string;
};

/**
 * APROVAR é check; RECUSAR e CANCELAR (retirada da própria proposta) são o X
 * vermelho, o `variant="danger"` de todo menu do app para verbo destrutivo.
 * Verbo de HORÁRIO usa a agenda e verbo de PLACAR, o ícone do resultado do
 * próprio card.
 */
const MATCH_AGREEMENT_ACTION_CATALOG = {
  approve_schedule: {
    effect: "accept",
    icon: Tick02Icon,
    isDanger: false,
    kind: "approve_schedule",
    label: MATCH_AGREEMENT_COPY.approveSchedule,
  },
  approve_score: {
    effect: "accept",
    icon: Tick02Icon,
    isDanger: false,
    kind: "approve_score",
    label: MATCH_AGREEMENT_COPY.approveResult,
  },
  cancel_schedule: {
    effect: "withdraw",
    icon: Cancel01Icon,
    isDanger: true,
    kind: "cancel_schedule",
    label: MATCH_AGREEMENT_COPY.cancelSchedule,
  },
  cancel_score: {
    effect: "withdraw",
    icon: Cancel01Icon,
    isDanger: true,
    kind: "cancel_score",
    label: MATCH_AGREEMENT_COPY.cancelResult,
  },
  counter_schedule: {
    effect: "propose",
    icon: Calendar03Icon,
    isDanger: false,
    kind: "counter_schedule",
    label: MATCH_AGREEMENT_COPY.counterSchedule,
  },
  counter_score: {
    effect: "propose",
    icon: Edit02Icon,
    isDanger: false,
    kind: "counter_score",
    label: MATCH_AGREEMENT_COPY.counterResult,
  },
  decline_schedule: {
    effect: "decline",
    icon: Cancel01Icon,
    isDanger: true,
    kind: "decline_schedule",
    label: MATCH_AGREEMENT_COPY.declineSchedule,
  },
  decline_score: {
    effect: "decline",
    icon: Cancel01Icon,
    isDanger: true,
    kind: "decline_score",
    label: MATCH_AGREEMENT_COPY.declineResult,
  },
  propose_schedule: {
    effect: "propose",
    icon: Calendar03Icon,
    isDanger: false,
    kind: "propose_schedule",
    label: MATCH_AGREEMENT_COPY.proposeSchedule,
  },
  send_score: {
    effect: "propose",
    icon: Edit02Icon,
    isDanger: false,
    kind: "send_score",
    label: MATCH_AGREEMENT_COPY.sendResult,
  },
} as const satisfies Record<MatchAgreementActionKind, MatchAgreementAction>;

/**
 * Linha do canal: `idle` = nada na mesa, `mine` = proposta do MEU LADO, `theirs`
 * = proposta do outro lado e `agreed` = já combinado. A autoria é do LADO, não
 * do perfil: numa dupla o parceiro de quem propôs cai na MESMA linha `mine`
 * (quem responde é o lado oposto). Fora do `idle` o canal tem UMA coisa na mesa
 * e os dois lados usam o MESMO verbo de colocar outra no lugar (`counter`): o
 * servidor aceita proposta por cima sem olhar a autoria.
 */
export type MatchAgreementChannelRow = "agreed" | "idle" | "mine" | "theirs";

/**
 * Estado do canal -> verbos: aceite e recusa só com proposta do OUTRO lado em
 * canal negociando (o resto devolve "Você fez essa proposta" ou "Esse acerto já
 * está fechado"); propor (de novo) é a MESMA proposta por cima e a retirada
 * (`withdraw`) é do AUTOR — o parceiro de dupla divide o lado, não a autoria
 * (`listMatchAgreementActions` filtra pelo `canWithdraw`).
 */
const MATCH_AGREEMENT_ACTION_TABLE = {
  agreed: {
    schedule: ["counter_schedule"],
    score: ["counter_score"],
  },
  idle: {
    schedule: ["propose_schedule"],
    score: ["send_score"],
  },
  mine: {
    schedule: ["counter_schedule", "cancel_schedule"],
    score: ["counter_score", "cancel_score"],
  },
  theirs: {
    schedule: ["approve_schedule", "decline_schedule", "counter_schedule"],
    score: ["approve_score", "decline_score", "counter_score"],
  },
} satisfies Record<
  MatchAgreementChannelRow,
  Record<MatchAgreementChannel, readonly MatchAgreementActionKind[]>
>;

/** O que o payload diz de UM canal: estado, se há proposta e de quem ela é. */
export type MatchAgreementChannelFacts = {
  hasProposal: boolean;
  /** Proposta do meu PERFIL: só o autor retira (o parceiro de dupla não). */
  proposedByMe: boolean;
  /** Proposta do MEU LADO: o verbo de resposta é do lado OPOSTO a ela. */
  proposedByMySide: boolean;
  state: string;
};

/** A proposta vigente saiu do MEU LADO (`proposedBySide` + `mySide` do payload). */
export function isProposalFromMySide(input: {
  mySide: "a" | "b";
  proposedBySide: null | "a" | "b";
}): boolean {
  return input.proposedBySide !== null && input.proposedBySide === input.mySide;
}

/** Linha do canal a partir do que o payload diz (`state`, proposta e o lado). */
export function resolveMatchAgreementChannelRow(
  input: MatchAgreementChannelFacts
): MatchAgreementChannelRow {
  if (input.state === "agreed") {
    return "agreed";
  }

  if (input.state === "negotiating" && input.hasProposal) {
    return input.proposedByMySide ? "mine" : "theirs";
  }

  return "idle";
}

function isWithdrawAction(kind: MatchAgreementActionKind): boolean {
  return MATCH_AGREEMENT_ACTION_CATALOG[kind].effect === "withdraw";
}

/** Verbos de UM canal no estado dele, na ordem da tabela. A retirada só entra
 * para o AUTOR da proposta (`canWithdraw`): o parceiro de dupla vê o canal do
 * próprio lado e propõe outro horário, mas não cancela a proposta do colega. */
export function listMatchAgreementActions(input: {
  canWithdraw: boolean;
  channel: MatchAgreementChannel;
  row: MatchAgreementChannelRow;
}): MatchAgreementAction[] {
  return MATCH_AGREEMENT_ACTION_TABLE[input.row][input.channel]
    .filter((kind) => input.canWithdraw || !isWithdrawAction(kind))
    .map((kind) => MATCH_AGREEMENT_ACTION_CATALOG[kind]);
}

/** A proposta do canal está na mesa sem resposta (é o que pede Aprovar/Recusar). */
function isChannelPending(facts: MatchAgreementChannelFacts): boolean {
  return facts.state === "negotiating" && facts.hasProposal;
}

/**
 * Propor (ou aceitar) placar exige torneio em andamento: o servidor recusa
 * "Resultados só podem ser combinados com o torneio em andamento"
 * (`agreement-rules.ts:249`) e o caminho de escrita repeite o mesmo gate
 * (`match_writes.ts:335`). Com o status desconhecido no cliente o verbo fica e
 * quem avisa é o toast do erro do servidor.
 */
export function canProposeMatchAgreementScore(
  tournamentStatus: null | string
): boolean {
  return tournamentStatus === null || tournamentStatus === "ongoing";
}

/**
 * UMA coisa por vez: o menu fala do canal ATIVO. Placar na mesa manda (espera
 * resposta); sem placar, manda o horário enquanto ele não estiver combinado;
 * combinado o horário e sem placar na mesa, aí os dois convivem. Fora desse
 * último caso os canais nunca se misturam.
 */
export function resolveMatchAgreementMenuActions(input: {
  canProposeScore: boolean;
  schedule: MatchAgreementChannelFacts;
  score: MatchAgreementChannelFacts;
}): MatchAgreementAction[] {
  if (isChannelPending(input.score)) {
    // Proposta de placar já na mesa: os verbos de resposta ficam mesmo com o
    // gate de torneio fechado, senão a proposta do outro lado ficaria sem saída.
    return listMatchAgreementActions({
      canWithdraw: input.score.proposedByMe,
      channel: "score",
      row: resolveMatchAgreementChannelRow(input.score),
    });
  }

  if (input.schedule.state !== "agreed") {
    return listMatchAgreementActions({
      canWithdraw: input.schedule.proposedByMe,
      channel: "schedule",
      row: resolveMatchAgreementChannelRow(input.schedule),
    });
  }

  return [
    ...(input.canProposeScore
      ? [MATCH_AGREEMENT_ACTION_CATALOG.send_score]
      : []),
    MATCH_AGREEMENT_ACTION_CATALOG.counter_schedule,
  ];
}

/** Rótulo de UM verbo: o diálogo do acerto usa o mesmo do item que o abriu. */
export function readMatchAgreementActionLabel(
  kind: MatchAgreementActionKind
): string {
  return MATCH_AGREEMENT_ACTION_CATALOG[kind].label;
}
