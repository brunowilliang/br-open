import { describe, expect, it } from "bun:test";

import {
  canLeagueAcceptMember,
  resolveApprovedMembershipRankingPosition,
  resolveRankingReorderError,
} from "../membership-rules";

describe("league membership rules", () => {
  it("places a newly approved member at the end of the ranking", () => {
    const rankingWithGap = {
      currentRankingPosition: null,
      highestRankingPosition: 3,
    };

    expect(resolveApprovedMembershipRankingPosition(rankingWithGap)).toBe(4);
  });

  it("keeps an existing active member ranking position", () => {
    expect(
      resolveApprovedMembershipRankingPosition({
        currentRankingPosition: 2,
        highestRankingPosition: 4,
      })
    ).toBe(2);
  });

  it("allows unlimited leagues to keep accepting members", () => {
    expect(
      canLeagueAcceptMember({
        activeMembershipCount: 200,
        maxPlayers: null,
      })
    ).toBe(true);
  });

  it("blocks new members when the league has no available spots", () => {
    expect(
      canLeagueAcceptMember({
        activeMembershipCount: 10,
        maxPlayers: 10,
      })
    ).toBe(false);
  });

  it("blocks ranking reorder payloads with duplicated memberships", () => {
    expect(
      resolveRankingReorderError({
        activeMembershipIds: ["membership-1", "membership-2", "membership-3"],
        requestedMembershipIds: [
          "membership-1",
          "membership-1",
          "membership-2",
        ],
      })
    ).toBe("O ranking enviado não corresponde aos jogadores ativos.");
  });
});
