import { buildChallengeCardScoreSummary } from "@/lib/leagues/challenge-card-score-summary";
import type { ManageChallengeAction } from "@/lib/leagues/challenge-feedback";
import type { ChallengeItem } from "@/lib/leagues/challenge-menu-actions";

export const CHALLENGE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export type ChallengeStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
  variant: "primary" | "secondary" | "soft" | "tertiary";
};

export function formatMatchDate(matchDate: string) {
  const [year, month, day] = matchDate.split("-").map(Number);

  if (!(year && month && day)) {
    return matchDate;
  }

  return CHALLENGE_DATE_FORMATTER.format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

export function formatMinute(minute: number) {
  const hour = Math.floor(minute / 60);
  const currentMinute = minute % 60;

  return `${String(hour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
}

export function formatProposalSummary(challenge: ChallengeItem) {
  return `${formatMatchDate(challenge.currentProposal.matchDate)} às ${formatMinute(
    challenge.currentProposal.startMinute
  )} · ${challenge.currentProposal.courtName}`;
}

export function formatStatus(status: ChallengeItem["status"]) {
  switch (status) {
    case "pending_opponent_response":
      return {
        color: "warning",
        label: "Aguardando resposta",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_creator_reapproval":
      return {
        color: "warning",
        label: "Aguardando reaprovação",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_admin_challenge_validation":
      return {
        color: "accent",
        label: "Validação do admin",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "confirmed":
      return {
        color: "success",
        label: "Confirmado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_cancellation_acceptance":
      return {
        color: "warning",
        label: "Cancelamento pendente",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_result_submission":
      return {
        color: "warning",
        label: "Pendente de placar",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_result_confirmation":
      return {
        color: "accent",
        label: "Confirmar placar",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_admin_result_validation":
      return {
        color: "accent",
        label: "Validar resultado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_result_correction":
      return {
        color: "warning",
        label: "Corrigir placar",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "pending_admin_decision":
      return {
        color: "warning",
        label: "Decisão do admin",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "finished":
      return {
        color: "default",
        label: "Finalizado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "declined":
      return {
        color: "danger",
        label: "Recusado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "cancelled":
      return {
        color: "danger",
        label: "Cancelado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    case "invalidated":
      return {
        color: "danger",
        label: "Invalidado",
        variant: "soft",
      } satisfies ChallengeStatusChip;
    default:
      return {
        color: "default",
        label: status,
        variant: "soft",
      } satisfies ChallengeStatusChip;
  }
}

export function formatScoreSummary(challenge: ChallengeItem) {
  const scoreSets = challenge.latestResultSubmission?.score.sets;

  if (!(scoreSets && scoreSets.length > 0)) {
    return null;
  }

  return buildChallengeCardScoreSummary({
    matchConfig: challenge.matchConfigSnapshot,
    sets: scoreSets,
  });
}

export function getScoreValueClassName(input: {
  hasScoreSummary: boolean;
  isWinner: boolean;
}) {
  if (input.isWinner) {
    return "font-semibold text-accent";
  }

  return input.hasScoreSummary ? "text-foreground" : "text-muted";
}

export function getAdminActionCopy(action: ManageChallengeAction) {
  switch (action) {
    case "cancel":
      return {
        description: "Tem certeza que deseja cancelar este desafio?",
        isDanger: true,
        submitLabel: "Sim",
        title: "Cancelar desafio",
      };
    case "invalidate":
      return {
        description: "Tem certeza que deseja invalidar este desafio?",
        isDanger: true,
        submitLabel: "Sim",
        title: "Invalidar desafio",
      };
    case "reopen_challenge":
      return {
        description: "Tem certeza que deseja reabrir este desafio?",
        isDanger: false,
        submitLabel: "Sim",
        title: "Reabrir desafio",
      };
    case "reopen_result":
      return {
        description: "Tem certeza que deseja reabrir o resultado?",
        isDanger: false,
        submitLabel: "Sim",
        title: "Reabrir resultado",
      };
    default:
      return {
        description: "",
        isDanger: false,
        submitLabel: "Salvar",
        title: "Ação administrativa",
      };
  }
}

export function resolveChallengesError(input: {
  challengesError: unknown;
  isChallengesError: boolean;
  isOccupiedSlotsError: boolean;
  occupiedSlotsError: unknown;
}) {
  if (input.isChallengesError) {
    return input.challengesError;
  }

  if (input.isOccupiedSlotsError) {
    return input.occupiedSlotsError;
  }

  return null;
}
