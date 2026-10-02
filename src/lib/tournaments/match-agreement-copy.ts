/** Copy do COMBINAR JOGO: o chip do card, o menu e os dois diálogos. O
 * vocabulário é o das ligas (chip de estado + menu de verbo direto), sem
 * travessão e sem frase de estado no card. */
export const MATCH_AGREEMENT_COPY = {
  approveResult: "Aprovar resultado",
  approveSchedule: "Aprovar horário",
  cancelResult: "Cancelar resultado",
  cancelSchedule: "Cancelar proposta",
  chipConfirmResult: "Confirmar resultado",
  chipConfirmSchedule: "Confirmar horário",
  chipPendingResult: "Pendente de resultado",
  chipProposalSent: "Proposta enviada",
  chipReapproval: "Aguardando reaprovação",
  chipResultSent: "Resultado enviado",
  counterResult: "Enviar outro resultado",
  counterSchedule: "Propor outro horário",
  declineResult: "Recusar resultado",
  declineSchedule: "Recusar horário",
  proposeSchedule: "Propor horário",
  sendResult: "Enviar resultado",
  toastAcceptScheduleDescription:
    "O confronto está agendado no horário combinado.",
  toastAcceptScheduleLabel: "Horário aprovado",
  toastAcceptScoreDescription: "O resultado foi publicado para os dois lados.",
  toastAcceptScoreLabel: "Resultado aprovado",
  toastCancelScheduleDescription:
    "A proposta saiu da mesa: dá para enviar outro horário quando quiser.",
  toastCancelScheduleLabel: "Proposta retirada",
  toastCancelScoreDescription:
    "A proposta saiu da mesa: dá para enviar outro placar quando quiser.",
  toastCancelScoreLabel: "Resultado retirado",
  toastDeclineScheduleDescription:
    "A proposta saiu da mesa: dá para enviar outro horário quando quiser.",
  toastDeclineScheduleLabel: "Horário recusado",
  toastDeclineScoreDescription:
    "A proposta saiu da mesa: dá para enviar outro placar quando quiser.",
  toastDeclineScoreLabel: "Resultado recusado",
  toastProposeScheduleDescription:
    "O outro lado precisa aprovar para o confronto ficar agendado.",
  toastProposeScheduleLabel: "Horário enviado",
  toastProposeScoreDescription:
    "O outro lado precisa aprovar para o resultado ser publicado.",
  toastProposeScoreLabel: "Resultado enviado",
} as const;

/** Frases com dado dentro (nomes, data, placar). */
export const MATCH_AGREEMENT_MESSAGE = {
  /** Propor outro verbo exige mudar algo: repetir o que está na mesa não volta
   * para aprovação (o servidor recusa a mesma coisa). */
  sameScheduleProposal:
    "Essa proposta está igual à atual. Mude a data, a quadra ou o horário.",
  sameScoreProposal: "Esse placar está igual ao atual. Mude o resultado.",
  sameWalkoverProposal: "Esse W.O. está igual ao atual. Mude o vencedor.",
  scheduleDialogDescription: ({ sides }: { sides: string }) =>
    `${sides}. Escolha data, quadra e horário: o outro lado precisa aprovar.`,
} as const;
