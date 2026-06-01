import { describe, expect, it } from "bun:test";

import { getHomePlayerDisplayName } from "./home-identity";

const PLAYER_FALLBACK_NAME_PATTERN = /^Jogador#\d{4}$/;

describe("getHomePlayerDisplayName", () => {
  it("prefers the player profile full name when it exists", () => {
    const result = getHomePlayerDisplayName({
      playerFullName: "Bruno Garcia",
      userId: "user_1234abcd",
    });

    expect(result).toBe("Bruno Garcia");
  });

  it("builds a stable Jogador fallback from the user id when the profile name is missing", () => {
    const result = getHomePlayerDisplayName({
      playerFullName: "   ",
      userId: "user_1234abcd",
    });
    const repeatedResult = getHomePlayerDisplayName({
      playerFullName: "   ",
      userId: "user_1234abcd",
    });

    expect(result).toMatch(PLAYER_FALLBACK_NAME_PATTERN);
    expect(repeatedResult).toBe(result);
  });

  it("falls back to a generic label when there is no profile name or user id", () => {
    const result = getHomePlayerDisplayName({});

    expect(result).toBe("Jogador");
  });
});
