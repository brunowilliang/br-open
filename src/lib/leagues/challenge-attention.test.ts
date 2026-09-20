import { describe, expect, it } from "bun:test";

import type { LeagueChallengeStatus } from "@convex/domains/league/challenge-status";
import { LeagueChallengeStatusOptions } from "@convex/domains/league/contract";

import {
  isChallengeAttention,
  isChallengeViewerParticipant,
  type ChallengeAttentionItem,
} from "./challenge-attention";
import { buildChallengeRouteVisibleChallenges } from "./challenge-route-view";
import {
  buildChallengeTabCounts,
  type ChallengeTabCountItem,
} from "./challenge-tab-counts";

/**
 * BUG-0043: a aba "Atenção" e o alerta contavam números diferentes para o
 * mesmo dado, porque a regra de atenção existia duplicada (uma cópia na lista,
 * outra no badge). Estes testes travam as duas coisas:
 *
 * 1. a verdade da regra única (`isChallengeAttention`), status a status;
 * 2. o acoplamento badge ↔ lista: para qualquer fixture, a contagem da aba
 *    TEM que ser o tamanho da lista daquela aba. Se alguém reintroduzir uma
 *    cópia local da regra, este teste quebra.
 */

const CHALLENGER = {
  membershipId: "membership-challenger",
  playerProfileId: "profile-challenger",
};

const CHALLENGED = {
  membershipId: "membership-challenged",
  playerProfileId: "profile-challenged",
};

const OUTSIDER_PROFILE_ID = "profile-outsider";

type ChallengeOverrides = {
  cancellationBy?: "challenged" | "challenger";
  status: LeagueChallengeStatus;
  submittedBy?: "challenged" | "challenger";
};

function makeChallenge(overrides: ChallengeOverrides): ChallengeTabCountItem {
  const side = (target: "challenged" | "challenger") =>
    target === "challenger" ? CHALLENGER : CHALLENGED;

  return {
    cancellationRequestedByMembershipId: overrides.cancellationBy
      ? side(overrides.cancellationBy).membershipId
      : null,
    challenged: CHALLENGED,
    challenger: CHALLENGER,
    latestResultSubmission: overrides.submittedBy
      ? { submittedByMembershipId: side(overrides.submittedBy).membershipId }
      : null,
    status: overrides.status,
  };
}

describe("isChallengeAttention (viewer é o desafiante)", () => {
  const viewer = CHALLENGER.playerProfileId;
  const attention = (overrides: ChallengeOverrides) =>
    isChallengeAttention(makeChallenge(overrides), viewer);

  it("pede ação nos status de resultado do próprio viewer", () => {
    expect(attention({ status: "pending_result_submission" })).toBe(true);
    expect(attention({ status: "pending_result_correction" })).toBe(true);
    // Quem NÃO publicou o placar confirma o do adversário.
    expect(
      attention({
        status: "pending_result_confirmation",
        submittedBy: "challenged",
      })
    ).toBe(true);
  });

  it("não pede ação quando o placar publicado é o do próprio viewer", () => {
    expect(
      attention({
        status: "pending_result_confirmation",
        submittedBy: "challenger",
      })
    ).toBe(false);
    // Sem placar publicado não há o que confirmar.
    expect(attention({ status: "pending_result_confirmation" })).toBe(false);
  });

  it("pede ação nas propostas que dependem do papel do viewer", () => {
    // A proposta é do adversário: quem responde é o desafiado, não o viewer.
    expect(attention({ status: "pending_opponent_response" })).toBe(false);
    // A contraproposta é do adversário: o desafiante (viewer) reaprova.
    expect(attention({ status: "pending_creator_reapproval" })).toBe(true);
    // O cancelamento pedido pelo próprio viewer não exige ação dele.
    expect(
      attention({
        cancellationBy: "challenger",
        status: "pending_cancellation_acceptance",
      })
    ).toBe(false);
    // O cancelamento pedido pelo adversário precisa da resposta do viewer.
    expect(
      attention({
        cancellationBy: "challenged",
        status: "pending_cancellation_acceptance",
      })
    ).toBe(true);
    // Sem pedido de cancelamento registrado, não há resposta a dar.
    expect(attention({ status: "pending_cancellation_acceptance" })).toBe(
      false
    );
  });

  it("nunca pede ação em status de organizador ou fechados", () => {
    for (const status of LeagueChallengeStatusOptions) {
      if (
        status === "pending_opponent_response" ||
        status === "pending_creator_reapproval" ||
        status === "pending_cancellation_acceptance" ||
        status === "pending_result_submission" ||
        status === "pending_result_confirmation" ||
        status === "pending_result_correction"
      ) {
        continue;
      }

      expect(attention({ status })).toBe(false);
    }
  });

  it("nunca pede ação de quem não participa do desafio", () => {
    for (const status of LeagueChallengeStatusOptions) {
      expect(
        isChallengeAttention(makeChallenge({ status }), OUTSIDER_PROFILE_ID)
      ).toBe(false);
    }
  });
});

describe("atenção: badge e lista saem da mesma regra", () => {
  // Produto cartesiano do que muda a decisão: status × quem pediu o
  // cancelamento × quem publicou o placar.
  const challenges: readonly ChallengeAttentionItem[] =
    LeagueChallengeStatusOptions.flatMap((status) =>
      (["challenger", "challenged", undefined] as const).flatMap(
        (cancellationBy) =>
          (["challenger", "challenged", undefined] as const).map(
            (submittedBy) =>
              makeChallenge({ cancellationBy, status, submittedBy })
          )
      )
    );

  const viewers = [
    CHALLENGER.playerProfileId,
    CHALLENGED.playerProfileId,
    OUTSIDER_PROFILE_ID,
  ];

  const routeChallenges = challenges as unknown as Parameters<
    typeof buildChallengeRouteVisibleChallenges
  >[0]["challenges"];

  it("conta exatamente o tamanho da lista de cada aba (participante)", () => {
    for (const viewerPlayerProfileId of viewers) {
      const counts = buildChallengeTabCounts({
        challenges: [...challenges],
        viewerPlayerProfileId,
      });

      for (const tab of ["attention", "ongoing", "history"] as const) {
        const visible = buildChallengeRouteVisibleChallenges({
          activeTab: tab,
          canManage: false,
          challenges: routeChallenges,
          viewerPlayerProfileId,
        });

        expect(counts[tab]).toBe(visible.length);
      }

      // O badge do header é a aba de atenção.
      expect(counts.main).toBe(counts.attention);
    }
  });

  it("conta exatamente o tamanho da lista de cada aba (organizador)", () => {
    const counts = buildChallengeTabCounts({
      canManage: true,
      challenges: [...challenges],
    });

    for (const tab of ["attention", "ongoing", "history"] as const) {
      const visible = buildChallengeRouteVisibleChallenges({
        activeTab: tab,
        canManage: true,
        challenges: routeChallenges,
        viewerPlayerProfileId: null,
      });

      expect(counts[tab]).toBe(visible.length);
    }
  });

  it("só o participante do desafio pode ter atenção", () => {
    for (const challenge of challenges) {
      for (const viewerPlayerProfileId of viewers) {
        if (isChallengeAttention(challenge, viewerPlayerProfileId)) {
          expect(
            isChallengeViewerParticipant(challenge, viewerPlayerProfileId)
          ).toBe(true);
        }
      }
    }
  });

  it("a fixture cobre todos os status do contrato", () => {
    const covered = new Set(challenges.map((challenge) => challenge.status));

    expect(covered.size).toBe(LeagueChallengeStatusOptions.length);
  });
});
