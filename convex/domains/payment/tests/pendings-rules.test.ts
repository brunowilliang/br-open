import { describe, expect, it } from "bun:test";

import { LEAGUE_MEMBERSHIP_STATUSES as S } from "../../league/contract";
import {
  buildLeaguePaymentAccountPending,
  buildMembershipPaymentPending,
} from "../pendings-rules";
import type { PendingDescription, PendingItem } from "../../pendings/contract";
import { canMembershipBeCharged } from "../rules";

/** Texto corrido da descricao, so para provar a copy aprovada nas partes. */
function itemText(item: PendingItem | null | undefined) {
  const description: PendingDescription = item?.description ?? "";

  if (typeof description === "string") {
    return description;
  }

  return description
    .map((line) => line.parts.map((part) => part.text).join(""))
    .join("; ");
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 20/09/2026 09:00 BRT — data fixa dos cenarios de vencimento. */
const NOW_MS = Date.parse("2026-09-20T12:00:00.000Z");

function membershipInput(input: {
  dueAtMs?: null | number;
  membershipStatus: string;
  monthlyPriceCents?: null | number;
  reminderDaysBefore?: number;
}) {
  return {
    dueAtMs: input.dueAtMs ?? null,
    membershipId: "membership-1",
    membershipStatus: input.membershipStatus,
    monthlyPriceCents:
      input.monthlyPriceCents === undefined ? 9000 : input.monthlyPriceCents,
    nowMs: NOW_MS,
    reminderDaysBefore: input.reminderDaysBefore ?? 3,
  };
}

describe("pendencia de mensalidade: atraso (cartao 1)", () => {
  it("vira warning com CTA Pagar, valor e vencimento que decide a ordem", () => {
    const item = buildMembershipPaymentPending(
      membershipInput({
        dueAtMs: NOW_MS - 2 * MS_PER_DAY,
        membershipStatus: S.PAYMENT_DUE,
      })
    );

    expect(item).not.toBeNull();
    expect(item?.kind).toBe("player_league_membership_payment_due");
    expect(item?.id).toBe("player_league_membership_payment_due:membership-1");
    expect(item?.severity).toBe("warning");
    expect(item?.title).toBe("Pagamento atrasado");
    expect(item?.description).toBe(
      "O pagamento da sua mensalidade venceu. Pague para não ser suspenso."
    );
    expect(item?.actionLabel).toBe("Pagar");
    expect(item?.secondaryAction).toBeNull();
    expect(item?.secondaryActionLabel).toBeNull();
    expect(item?.action).toEqual({
      params: null,
      type: "pay_league_membership",
    });
    expect(item?.moneyCents).toBe(9000);
    expect(item?.deadlineAt).toBe(NOW_MS - 2 * MS_PER_DAY);
    expect(item?.domain).toBe("payment");
    expect(item?.source).toEqual({
      id: "membership-1",
      type: "league_membership",
    });
  });
});

describe("pendencia de mensalidade: suspensa (cartao 3)", () => {
  it("vira danger com o CTA Renovar no PROPRIO item", () => {
    const item = buildMembershipPaymentPending(
      membershipInput({ membershipStatus: S.SUSPENDED })
    );

    expect(item?.kind).toBe("player_league_membership_suspended");
    expect(item?.id).toBe("player_league_membership_suspended:membership-1");
    expect(item?.severity).toBe("danger");
    expect(item?.title).toBe("Inscrição suspensa");
    expect(item?.description).toBe(
      "Sua inscrição foi suspensa por falta de pagamento. Renove para voltar a jogar."
    );
    // O CTA vive no PROPRIO item: a copy manda renovar e a pendencia aparece em
    // 6 superficies, mas so a casa da liga tem rodape — na home ficaria sem
    // afordancia. A acao e a MESMA dos kinds 1 e 2 (`pay_league_membership`) e o
    // alvo do runner e o `source` do item.
    expect(item?.actionLabel).toBe("Renovar");
    expect(item?.action).toEqual({
      params: null,
      type: "pay_league_membership",
    });
    expect(item?.source).toEqual({
      id: "membership-1",
      type: "league_membership",
    });
    expect(item?.secondaryAction).toBeNull();
    expect(item?.secondaryActionLabel).toBeNull();
    expect(item?.route).toBeNull();
    expect(item?.deadlineAt).toBeNull();
  });

  it("a acao prometida pelo alerta e executavel nesse estado", () => {
    const item = buildMembershipPaymentPending(
      membershipInput({ membershipStatus: S.SUSPENDED })
    );

    expect(item?.action?.type).toBe("pay_league_membership");
    // Prova negativa do par: se `suspended` sair de
    // CHARGEABLE_MEMBERSHIP_STATUSES, o `createCharge` recusa e o alerta passa
    // a oferecer botao morto — este pin quebra junto.
    expect(canMembershipBeCharged({ status: S.SUSPENDED })).toBe(true);
  });
});

describe("pendencia de mensalidade: a vencer (cartao 2)", () => {
  it("destaca a DATA do vencimento no calendario do Brasil", () => {
    const dueAtMs = NOW_MS + 3 * MS_PER_DAY;
    const item = buildMembershipPaymentPending(
      membershipInput({
        dueAtMs,
        membershipStatus: S.ACTIVE,
        reminderDaysBefore: 5,
      })
    );

    expect(item?.kind).toBe("player_league_membership_payment_due_soon");
    expect(item?.severity).toBe("warning");
    expect(item?.title).toBe("Mensalidade vence em 3 dias");
    expect(item?.actionLabel).toBe("Renovar");
    expect(item?.action).toEqual({
      params: null,
      type: "pay_league_membership",
    });
    expect(item?.deadlineAt).toBe(dueAtMs);
    expect(item?.moneyCents).toBe(9000);
    expect(itemText(item)).toBe(
      "Renove até 23 de set. de 2026 para continuar jogando sem interrupção."
    );
    expect(item?.description).toEqual([
      {
        parts: [
          { text: "Renove até " },
          { isHighlighted: true, text: "23 de set. de 2026" },
          { text: " para continuar jogando sem interrupção." },
        ],
      },
    ]);
  });

  it("membro ativo sem vencimento conhecido nao gera pendencia", () => {
    expect(
      buildMembershipPaymentPending(
        membershipInput({
          dueAtMs: null,
          membershipStatus: S.ACTIVE,
          reminderDaysBefore: 5,
        })
      )
    ).toBeNull();
  });

  it("membro ativo FORA da janela de lembrete nao gera pendencia", () => {
    expect(
      buildMembershipPaymentPending(
        membershipInput({
          dueAtMs: NOW_MS + 6 * MS_PER_DAY,
          membershipStatus: S.ACTIVE,
          reminderDaysBefore: 5,
        })
      )
    ).toBeNull();
  });

  it("vencimento ja passado com status active nao gera a pendencia de renovacao", () => {
    expect(
      buildMembershipPaymentPending(
        membershipInput({
          dueAtMs: NOW_MS - MS_PER_DAY,
          membershipStatus: S.ACTIVE,
          reminderDaysBefore: 5,
        })
      )
    ).toBeNull();
  });
});

describe("pendencia de mensalidade: status sem pendencia", () => {
  it("nao gera item para entrada aguardando pagamento", () => {
    expect(
      buildMembershipPaymentPending(
        membershipInput({
          dueAtMs: NOW_MS + 3 * MS_PER_DAY,
          membershipStatus: S.AWAITING_PAYMENT,
        })
      )
    ).toBeNull();
  });

  it("nao gera item para membership removida ou aprovacao pendente", () => {
    for (const status of [S.PENDING, S.REMOVED, S.LEFT, S.REJECTED]) {
      expect(
        buildMembershipPaymentPending(
          membershipInput({ membershipStatus: status })
        )
      ).toBeNull();
    }
  });
});

describe("pendencia de conta de pagamento da organizacao (cartao 10)", () => {
  it("leva aos ajustes da liga paga que nao consegue cobrar", () => {
    const item = buildLeaguePaymentAccountPending({
      leagueId: "league-9",
      monthlyPriceCents: 12_000,
    });

    expect(item.kind).toBe("organization_league_payment_account_missing");
    expect(item.id).toBe(
      "organization_league_payment_account_missing:league-9"
    );
    expect(item.severity).toBe("warning");
    expect(item.title).toBe("Conta de pagamento não conectada");
    expect(item.description).toBe(
      "Conecte a conta para os jogadores conseguirem pagar a mensalidade."
    );
    expect(item.actionLabel).toBe("Conectar");
    expect(item.action).toEqual({ params: null, type: "open_route" });
    expect(item.route).toBe("/settings/leagues/[mode]/settings");
    expect(item.params).toEqual({ leagueId: "league-9", mode: "edit" });
    expect(item.moneyCents).toBe(12_000);
    expect(item.source).toEqual({ id: "league-9", type: "league" });
  });
});

describe("pendencias de pagamento: CTA de uma palavra", () => {
  it("todo rótulo de acao sai com uma palavra so", () => {
    const items = [
      buildMembershipPaymentPending(
        membershipInput({
          dueAtMs: NOW_MS - MS_PER_DAY,
          membershipStatus: S.PAYMENT_DUE,
        })
      ),
      buildMembershipPaymentPending(
        membershipInput({ membershipStatus: S.SUSPENDED })
      ),
      buildMembershipPaymentPending(
        membershipInput({
          dueAtMs: NOW_MS + 2 * MS_PER_DAY,
          membershipStatus: S.ACTIVE,
          reminderDaysBefore: 5,
        })
      ),
      buildLeaguePaymentAccountPending({
        leagueId: "league-9",
        monthlyPriceCents: 12_000,
      }),
    ];

    for (const item of items) {
      for (const label of [item?.actionLabel, item?.secondaryActionLabel]) {
        if (label) {
          expect(label.split(" ")).toHaveLength(1);
        }
      }
    }
  });
});
