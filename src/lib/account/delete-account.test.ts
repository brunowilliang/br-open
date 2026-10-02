import { describe, expect, test } from "bun:test";

import {
  presentDeletionBlocker,
  readDeletionCodeOutcome,
  type AccountDeletionBlocker,
} from "./delete-account";

function blocker(
  code: AccountDeletionBlocker["code"],
  summary = "Resumo do bloqueio.",
  tournamentIds: string[] = [],
  organizationIds: string[] = []
): AccountDeletionBlocker {
  return {
    code,
    count: 1,
    organizationIds,
    scope: "organization",
    summary,
    tournamentIds,
  };
}

describe("presentDeletionBlocker", () => {
  test("um torneio em andamento vai direto pra casa dele", () => {
    const presented = presentDeletionBlocker(
      blocker(
        "organization_active_tournament",
        "Você tem 1 torneio.",
        ["t-1"],
        ["org-1"]
      )
    );

    expect(presented).toEqual({
      action: {
        href: "/tournaments/t-1",
        label: "Ver torneios",
        organizationId: "org-1",
        requiresOrganizerActor: true,
      },
      summary: "Você tem 1 torneio.",
      title: "Torneios em andamento ou por começar",
    });
  });

  test("vários torneios caem na lista de competições", () => {
    expect(
      presentDeletionBlocker(
        blocker(
          "organization_active_tournament",
          "Você tem 2 torneios.",
          ["t-1", "t-2"],
          ["org-1", "org-2"]
        )
      ).action
    ).toEqual({
      href: "/competitions",
      label: "Ver torneios",
      organizationId: "org-1",
      requiresOrganizerActor: true,
    });
  });

  test("sem organizationIds o destino fica sem org alvo (fallback)", () => {
    expect(
      presentDeletionBlocker(
        blocker("organization_active_tournament", "Você tem 1 torneio.", [
          "t-1",
        ])
      ).action?.organizationId
    ).toBeUndefined();
  });

  test("bloqueio de torneio sem ids fica sem ação", () => {
    expect(
      presentDeletionBlocker(blocker("organization_active_tournament")).action
    ).toBeUndefined();
  });

  test("saldo travado leva para o saque", () => {
    expect(
      presentDeletionBlocker(blocker("organization_locked_balance"))
    ).toEqual({
      action: { href: "/withdraw", label: "Sacar" },
      summary: "Resumo do bloqueio.",
      title: "Saldo na organização",
    });
  });

  test("dinheiro em processamento e outros membros ficam sem ação", () => {
    expect(
      presentDeletionBlocker(blocker("organization_money_in_flight")).action
    ).toBeUndefined();
    expect(
      presentDeletionBlocker(blocker("organization_other_members")).action
    ).toBeUndefined();
  });
});

describe("readDeletionCodeOutcome", () => {
  test("deleted vira desfecho de exclusão", () => {
    expect(readDeletionCodeOutcome({ status: "deleted" })).toEqual({
      kind: "deleted",
    });
  });

  test("blocked devolve os bloqueios rechecados", () => {
    const rechecked = [blocker("organization_locked_balance")];

    expect(
      readDeletionCodeOutcome({ blockers: rechecked, status: "blocked" })
    ).toEqual({
      blockers: rechecked,
      kind: "blocked",
    });
  });

  test("invalid_code informa as tentativas restantes", () => {
    expect(
      readDeletionCodeOutcome({ attemptsLeft: 4, status: "invalid_code" })
    ).toEqual({
      kind: "retry",
      message:
        "Código inválido. Confira os dígitos e tente novamente. Restam 4 tentativas.",
    });
  });

  test("invalid_code no singular e sem tentativas", () => {
    expect(
      readDeletionCodeOutcome({ attemptsLeft: 1, status: "invalid_code" })
    ).toEqual({
      kind: "retry",
      message:
        "Código inválido. Confira os dígitos e tente novamente. Resta 1 tentativa.",
    });
    expect(
      readDeletionCodeOutcome({ attemptsLeft: 0, status: "invalid_code" })
    ).toEqual({
      kind: "retry",
      message: "Código inválido. Confira os dígitos e tente novamente.",
    });
  });

  test("code_expired e too_many_attempts usam a copy de segurança", () => {
    expect(readDeletionCodeOutcome({ status: "code_expired" })).toEqual({
      kind: "retry",
      message: "O código expirou. Solicite um novo.",
    });
    expect(readDeletionCodeOutcome({ status: "too_many_attempts" })).toEqual({
      kind: "retry",
      message:
        "Muitas tentativas com o código. Aguarde um pouco e tente de novo.",
    });
  });
});
