import { describe, expect, it } from "bun:test";

import { collectReplacedLeagueStorageIds } from "../contract";

describe("league media storage cleanup", () => {
  it("collects previous storage ids that are no longer used by the league", () => {
    expect(
      collectReplacedLeagueStorageIds({
        next: {
          avatarStorageId: "new-avatar",
          coverStorageId: "same-cover",
        },
        previous: {
          avatarStorageId: "old-avatar",
          coverStorageId: "same-cover",
        },
      })
    ).toEqual(["old-avatar"]);
  });

  it("keeps null and legacy fallback ids out of storage cleanup", () => {
    expect(
      collectReplacedLeagueStorageIds({
        next: {
          avatarStorageId: null,
          coverStorageId: "new-cover",
        },
        previous: {
          avatarStorageId: "DEFAULT_AVATAR_STORAGE_ID",
          coverStorageId: null,
        },
      })
    ).toEqual([]);
  });
});
