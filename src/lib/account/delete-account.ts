import type { ApiOutputs } from "@convex/shared/api";

import { getSecurityErrorMessage } from "@/lib/account/security-errors";

export type AccountDeletionBlocker =
  ApiOutputs["account"]["deletion"]["status"]["blockers"][number];
export type AccountDeletionConfirmResult =
  ApiOutputs["account"]["deletion"]["confirm"];

/** Espelho de DELETION_CODE_RESEND_COOLDOWN_MS no backend (deletion-code-rules). */
export const ACCOUNT_DELETION_CODE_COOLDOWN_SECONDS = 60;

export type DeletionBlockerHref =
  | "/competitions"
  | "/withdraw"
  | `/tournaments/${string}`;

export type DeletionBlockerAction = {
  href: DeletionBlockerHref;
  label: string;
  /** Org dona (`organizationIds[0]` do blocker) que o CTA precisa ativa;
   * vazio derruba no fallback do primeiro ator de organização. */
  organizationId?: string;
  /** CTA que só entrega o conteúdo no modo organizador (troca o ator antes). */
  requiresOrganizerActor?: boolean;
};

/** Título e destino fixo por bloqueio; o de torneio calcula o destino pelos
 * ids (vazio nos demais). Sem destino quando a casa ainda não tem tela para
 * resolver (membros e dinheiro em processamento). */
const DELETION_BLOCKER_PRESENTATION: Record<
  AccountDeletionBlocker["code"],
  { action?: DeletionBlockerAction; title: string }
> = {
  organization_active_tournament: {
    title: "Torneios em andamento ou por começar",
  },
  organization_locked_balance: {
    action: { href: "/withdraw", label: "Sacar" },
    title: "Saldo na organização",
  },
  organization_money_in_flight: { title: "Dinheiro em processamento" },
  organization_other_members: { title: "Outras pessoas na gestão" },
};

export function presentDeletionBlocker(blocker: AccountDeletionBlocker) {
  const presentation = DELETION_BLOCKER_PRESENTATION[blocker.code];

  return {
    action:
      blocker.code === "organization_active_tournament"
        ? buildActiveTournamentAction(
            blocker.tournamentIds,
            blocker.organizationIds
          )
        : presentation.action,
    summary: blocker.summary,
    title: presentation.title,
  };
}

/** Um torneio vai direto pra casa dele; vários caem na lista (Minhas
 * Competições), que mostra tudo da organização. Sem ids, sem CTA. */
function buildActiveTournamentAction(
  tournamentIds: string[],
  organizationIds: string[]
): DeletionBlockerAction | undefined {
  const [firstTournamentId] = tournamentIds;

  if (!firstTournamentId) {
    return undefined;
  }

  // organizationIds[i] é a org dona de tournamentIds[i]: o switch vai nela.
  const [organizationId] = organizationIds;

  if (tournamentIds.length === 1) {
    return {
      href: `/tournaments/${firstTournamentId}`,
      label: "Ver torneios",
      organizationId,
      requiresOrganizerActor: true,
    };
  }

  return {
    href: "/competitions",
    label: "Ver torneios",
    organizationId,
    requiresOrganizerActor: true,
  };
}

export type DeletionCodeOutcome =
  | { blockers: AccountDeletionBlocker[]; kind: "blocked" }
  | { kind: "deleted" }
  | { kind: "retry"; message: string };

/** Traduz o union do confirm; a copy de código reusa o mapa de segurança. */
export function readDeletionCodeOutcome(
  result: AccountDeletionConfirmResult
): DeletionCodeOutcome {
  switch (result.status) {
    case "blocked":
      return { blockers: result.blockers, kind: "blocked" };
    case "code_expired":
      return { kind: "retry", message: securityCodeMessage("OTP_EXPIRED") };
    case "deleted":
      return { kind: "deleted" };
    case "invalid_code":
      return {
        kind: "retry",
        message: invalidCodeMessage(result.attemptsLeft),
      };
    case "too_many_attempts":
      return {
        kind: "retry",
        message: securityCodeMessage("TOO_MANY_ATTEMPTS"),
      };
    default:
      return {
        kind: "retry",
        message: "Não foi possível confirmar. Tente novamente.",
      };
  }
}

function invalidCodeMessage(attemptsLeft: number): string {
  const base = securityCodeMessage("INVALID_OTP");

  if (attemptsLeft <= 0) {
    return base;
  }

  return `${base} ${
    attemptsLeft === 1
      ? "Resta 1 tentativa."
      : `Restam ${attemptsLeft} tentativas.`
  }`;
}

function securityCodeMessage(
  code: "INVALID_OTP" | "OTP_EXPIRED" | "TOO_MANY_ATTEMPTS"
): string {
  return getSecurityErrorMessage(
    { code },
    "Não foi possível confirmar. Tente novamente."
  );
}
