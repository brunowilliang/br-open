import { describe, expect, test } from "bun:test";
import {
  Calendar03Icon,
  Cancel01Icon,
  Edit02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import {
  canProposeMatchAgreementScore,
  listMatchAgreementActions,
  resolveMatchAgreementChannelRow,
  resolveMatchAgreementMenuActions,
  type MatchAgreementChannelFacts,
  type MatchAgreementChannelRow,
} from "./match-agreement-actions";

const ROWS: MatchAgreementChannelRow[] = ["agreed", "idle", "mine", "theirs"];

describe("resolveMatchAgreementChannelRow", () => {
  test("negotiating without a proposal on the table starts over", () => {
    expect(
      resolveMatchAgreementChannelRow({
        hasProposal: false,
        proposedByMe: false,
        proposedByMySide: false,
        state: "negotiating",
      })
    ).toBe("idle");
  });

  test("negotiating with a proposal follows the side that proposed", () => {
    expect(
      resolveMatchAgreementChannelRow({
        hasProposal: true,
        proposedByMe: true,
        proposedByMySide: true,
        state: "negotiating",
      })
    ).toBe("mine");
    expect(
      resolveMatchAgreementChannelRow({
        hasProposal: true,
        proposedByMe: false,
        proposedByMySide: false,
        state: "negotiating",
      })
    ).toBe("theirs");
  });

  test("a dupla do autor lê o canal como do PRÓPRIO lado", () => {
    // Autoria do lado, não do perfil: o parceiro de quem propôs não responde
    // (o servidor recusa por lado), então a linha dele é `mine`.
    expect(
      resolveMatchAgreementChannelRow({
        hasProposal: true,
        proposedByMe: false,
        proposedByMySide: true,
        state: "negotiating",
      })
    ).toBe("mine");
  });

  test("agreed channel is its own row, with or without a proposal", () => {
    expect(
      resolveMatchAgreementChannelRow({
        hasProposal: true,
        proposedByMe: false,
        proposedByMySide: false,
        state: "agreed",
      })
    ).toBe("agreed");
  });
});

describe("MATCH_AGREEMENT_ACTION_TABLE", () => {
  test("idle opens the channel, todo o resto coloca outra coisa na mesa", () => {
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "idle",
      }).map((action) => action.kind)
    ).toEqual(["propose_schedule"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "idle",
      }).map((action) => action.kind)
    ).toEqual(["send_score"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "mine",
      }).map((action) => action.kind)
    ).toEqual(["counter_schedule", "cancel_schedule"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "mine",
      }).map((action) => action.kind)
    ).toEqual(["counter_score", "cancel_score"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "agreed",
      }).map((action) => action.kind)
    ).toEqual(["counter_score"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "theirs",
      }).map((action) => action.kind)
    ).toEqual(["approve_schedule", "decline_schedule", "counter_schedule"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "theirs",
      }).map((action) => action.kind)
    ).toEqual(["approve_score", "decline_score", "counter_score"]);
  });

  test("approving or declining only shows where the server accepts it", () => {
    for (const row of ROWS) {
      for (const channel of ["schedule", "score"] as const) {
        const actions = listMatchAgreementActions({
          canWithdraw: true,
          channel,
          row,
        });
        const responds = actions.some(
          (action) => action.effect === "accept" || action.effect === "decline"
        );

        // Aceite e recusa só existem com proposta do OUTRO lado: em qualquer
        // outra linha o servidor devolveria "Você fez essa proposta" ou "Esse
        // acerto já está fechado".
        expect(responds).toBe(row === "theirs");
      }
    }
  });

  test("a retirada é da PRÓPRIA proposta: por último, em vermelho", () => {
    for (const row of ROWS) {
      for (const channel of ["schedule", "score"] as const) {
        const actions = listMatchAgreementActions({
          canWithdraw: true,
          channel,
          row,
        });
        const withdraws = actions.filter(
          (action) => action.effect === "withdraw"
        );

        // O servidor recusa a retirada de quem não propôs: por isso ela só
        // existe na linha do autor.
        expect(withdraws).toHaveLength(row === "mine" ? 1 : 0);

        if (row === "mine") {
          expect(actions.at(-1)).toBe(withdraws[0]);
          // Cancelar é verbo destrutivo: X vermelho, como recusar.
          expect(withdraws[0].isDanger).toBe(true);
          expect(withdraws[0].icon).toBe(Cancel01Icon);
        }
      }
    }
  });

  test("na linha do canal, a primeira proposta só existe com o canal vazio", () => {
    for (const channel of ["schedule", "score"] as const) {
      const first = channel === "schedule" ? "propose_schedule" : "send_score";

      expect(
        listMatchAgreementActions({
          canWithdraw: true,
          channel,
          row: "idle",
        }).map((action) => action.kind)
      ).toEqual([first]);

      for (const row of ["agreed", "mine", "theirs"] as const) {
        const kinds = listMatchAgreementActions({
          canWithdraw: true,
          channel,
          row,
        }).map((action) => action.kind);

        // Havia proposta na mesa (ou já combinado): o verbo é propor OUTRA.
        expect(kinds).toContain(`counter_${channel}`);
        expect(kinds).not.toContain(first);
      }
    }
  });

  test("a família dos rótulos por canal e por estado", () => {
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "idle",
      })[0].label
    ).toBe("Propor horário");
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "idle",
      })[0].label
    ).toBe("Enviar resultado");

    for (const row of ["agreed", "mine", "theirs"] as const) {
      expect(
        listMatchAgreementActions({
          canWithdraw: true,
          channel: "schedule",
          row,
        }).map((action) => action.label)
      ).toContain("Propor outro horário");
      expect(
        listMatchAgreementActions({
          canWithdraw: true,
          channel: "score",
          row,
        }).map((action) => action.label)
      ).toContain("Enviar outro resultado");
    }

    // A retirada nomeia o objeto na frente, como os outros verbos do canal.
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "mine",
      }).map((action) => action.label)
    ).toEqual(["Propor outro horário", "Cancelar proposta"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "mine",
      }).map((action) => action.label)
    ).toEqual(["Enviar outro resultado", "Cancelar resultado"]);

    // Aprovar e recusar sempre com o objeto do canal na frente.
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "theirs",
      })
        .slice(0, 2)
        .map((action) => action.label)
    ).toEqual(["Aprovar horário", "Recusar horário"]);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "theirs",
      })
        .slice(0, 2)
        .map((action) => action.label)
    ).toEqual(["Aprovar resultado", "Recusar resultado"]);
  });

  test("approve is a check and decline is a red X, one per channel", () => {
    const approve = [
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "theirs",
      })[0],
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "theirs",
      })[0],
    ];
    const decline = [
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "theirs",
      })[1],
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "theirs",
      })[1],
    ];

    for (const action of approve) {
      expect(action.icon).toBe(Tick02Icon);
      expect(action.isDanger).toBe(false);
    }
    for (const action of decline) {
      expect(action.icon).toBe(Cancel01Icon);
      expect(action.isDanger).toBe(true);
    }
  });

  test("the counter proposal follows its channel icon", () => {
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "mine",
      })[0].icon
    ).toBe(Calendar03Icon);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "mine",
      })[0].icon
    ).toBe(Edit02Icon);
  });

  test("time verbs carry the agenda icon and score verbs the result one", () => {
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "idle",
      })[0].icon
    ).toBe(Calendar03Icon);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "schedule",
        row: "mine",
      })[0].icon
    ).toBe(Calendar03Icon);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "idle",
      })[0].icon
    ).toBe(Edit02Icon);
    expect(
      listMatchAgreementActions({
        canWithdraw: true,
        channel: "score",
        row: "agreed",
      })[0].icon
    ).toBe(Edit02Icon);
  });
});

function buildFacts(
  overrides: Partial<MatchAgreementChannelFacts> = {}
): MatchAgreementChannelFacts {
  return {
    hasProposal: false,
    proposedByMe: false,
    proposedByMySide: false,
    state: "idle",
    ...overrides,
  };
}

const IDLE_FACTS = buildFacts();
const MINE_FACTS = buildFacts({
  hasProposal: true,
  proposedByMe: true,
  proposedByMySide: true,
  state: "negotiating",
});
const THEIRS_FACTS = buildFacts({
  hasProposal: true,
  proposedByMe: false,
  proposedByMySide: false,
  state: "negotiating",
});
/** Proposta do MEU lado que o parceiro de dupla vê: lado propôs, perfil não. */
const PARTNER_FACTS = buildFacts({
  hasProposal: true,
  proposedByMe: false,
  proposedByMySide: true,
  state: "negotiating",
});
const AGREED_FACTS = buildFacts({
  hasProposal: true,
  proposedByMe: false,
  proposedByMySide: false,
  state: "agreed",
});

function kindsOfSchedule(
  plan: ReturnType<typeof resolveMatchAgreementMenuActions>
) {
  return plan
    .map((action) => action.kind)
    .filter((kind) => kind.endsWith("_schedule"));
}

function kindsOfScore(
  plan: ReturnType<typeof resolveMatchAgreementMenuActions>
) {
  return plan
    .map((action) => action.kind)
    .filter((kind) => kind.endsWith("_score"));
}

describe("resolveMatchAgreementMenuActions", () => {
  test("horário ainda não combinado, sem placar na mesa: só horário", () => {
    for (const schedule of [IDLE_FACTS, MINE_FACTS, THEIRS_FACTS]) {
      const plan = resolveMatchAgreementMenuActions({
        canProposeScore: true,
        schedule,
        score: IDLE_FACTS,
      });

      expect(kindsOfScore(plan)).toEqual([]);
      expect(kindsOfSchedule(plan)).toEqual(
        listMatchAgreementActions({
          canWithdraw: true,
          channel: "schedule",
          row: resolveMatchAgreementChannelRow(schedule),
        }).map((action) => action.kind)
      );
    }
  });

  test("placar na mesa manda: só placar, mesmo com o horário aberto", () => {
    for (const score of [MINE_FACTS, THEIRS_FACTS]) {
      const plan = resolveMatchAgreementMenuActions({
        canProposeScore: true,
        schedule: IDLE_FACTS,
        score,
      });

      expect(kindsOfSchedule(plan)).toEqual([]);
      expect(kindsOfScore(plan)).toEqual(
        listMatchAgreementActions({
          canWithdraw: true,
          channel: "score",
          row: resolveMatchAgreementChannelRow(score),
        }).map((action) => action.kind)
      );
    }
  });

  test("horário combinado e sem placar na mesa: o único par dos dois canais", () => {
    expect(
      resolveMatchAgreementMenuActions({
        canProposeScore: true,
        schedule: AGREED_FACTS,
        score: IDLE_FACTS,
      }).map((action) => action.kind)
    ).toEqual(["send_score", "counter_schedule"]);
  });

  test("torneio só sorteado: o menu não oferece placar", () => {
    expect(
      resolveMatchAgreementMenuActions({
        canProposeScore: false,
        schedule: AGREED_FACTS,
        score: IDLE_FACTS,
      }).map((action) => action.kind)
    ).toEqual(["counter_schedule"]);
  });

  test("proposta de placar já na mesa responde mesmo fora do gate", () => {
    // O estado não nasce pelo menu novo (placar exige torneio em andamento),
    // mas se a proposta existe ela não pode ficar sem Aprovar/Recusar.
    expect(
      resolveMatchAgreementMenuActions({
        canProposeScore: false,
        schedule: AGREED_FACTS,
        score: THEIRS_FACTS,
      }).map((action) => action.kind)
    ).toEqual(["approve_score", "decline_score", "counter_score"]);
  });

  test("a dupla de quem propôs não recebe verbo de resposta", () => {
    // O parceiro divide o LADO: o servidor recusa a resposta dele, então o menu
    // só oferece colocar outra proposta na mesa — sem Aprovar/Recusar e sem a
    // retirada, que é do autor.
    const schedulePlan = resolveMatchAgreementMenuActions({
      canProposeScore: true,
      schedule: PARTNER_FACTS,
      score: IDLE_FACTS,
    });

    expect(schedulePlan.map((action) => action.kind)).toEqual([
      "counter_schedule",
    ]);
    expect(
      schedulePlan.some(
        (action) => action.effect === "accept" || action.effect === "decline"
      )
    ).toBe(false);

    expect(
      resolveMatchAgreementMenuActions({
        canProposeScore: true,
        schedule: AGREED_FACTS,
        score: PARTNER_FACTS,
      }).map((action) => action.kind)
    ).toEqual(["counter_score"]);
  });

  test("o autor da proposta retira; o lado oposto responde", () => {
    expect(
      resolveMatchAgreementMenuActions({
        canProposeScore: true,
        schedule: MINE_FACTS,
        score: IDLE_FACTS,
      }).map((action) => action.kind)
    ).toEqual(["counter_schedule", "cancel_schedule"]);

    expect(
      resolveMatchAgreementMenuActions({
        canProposeScore: true,
        schedule: THEIRS_FACTS,
        score: IDLE_FACTS,
      }).map((action) => action.kind)
    ).toEqual(["approve_schedule", "decline_schedule", "counter_schedule"]);
  });

  test("nenhum estado mistura os dois canais, fora o horário combinado", () => {
    for (const schedule of [
      IDLE_FACTS,
      MINE_FACTS,
      THEIRS_FACTS,
      AGREED_FACTS,
    ]) {
      for (const score of [
        IDLE_FACTS,
        MINE_FACTS,
        THEIRS_FACTS,
        AGREED_FACTS,
      ]) {
        for (const canProposeScore of [true, false]) {
          const plan = resolveMatchAgreementMenuActions({
            canProposeScore,
            schedule,
            score,
          });
          const hasSchedule = kindsOfSchedule(plan).length > 0;
          const hasScore = kindsOfScore(plan).length > 0;

          if (hasSchedule && hasScore) {
            expect(plan.map((action) => action.kind)).toEqual([
              "send_score",
              "counter_schedule",
            ]);
          }
        }
      }
    }
  });
});

describe("canProposeMatchAgreementScore", () => {
  test("só o torneio em andamento libera o verbo; status desconhecido deixa passar", () => {
    expect(canProposeMatchAgreementScore("ongoing")).toBe(true);
    expect(canProposeMatchAgreementScore(null)).toBe(true);
    expect(canProposeMatchAgreementScore("drawn")).toBe(false);
    expect(canProposeMatchAgreementScore("finished")).toBe(false);
  });
});
