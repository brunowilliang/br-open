import { describe, expect, it } from "bun:test";

import { AdminManageLeagueChallengeSchema } from "../contract";

describe("league contract", () => {
  it("allows admin challenge actions without requiring a reason", () => {
    const result = AdminManageLeagueChallengeSchema.safeParse({
      action: "cancel",
      challengeId: "challenge-1",
    });

    expect(result.success).toBe(true);
  });
});
