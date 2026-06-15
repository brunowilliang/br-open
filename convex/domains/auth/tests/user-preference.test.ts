import { describe, expect, it } from "bun:test";

import {
  DEFAULT_ACTOR_KIND,
  buildViewerCapabilities,
  resolveActorKind,
} from "../actor-context";

describe("actor context", () => {
  it("defaults viewers to player actor", () => {
    expect(DEFAULT_ACTOR_KIND).toBe("player");
    expect(resolveActorKind(null)).toBe("player");
    expect(resolveActorKind(undefined)).toBe("player");
    expect(resolveActorKind("invalid")).toBe("player");
  });

  it("allows player actors to browse and join leagues", () => {
    expect(buildViewerCapabilities({ actorKind: "player" })).toEqual({
      canBrowseLeagues: true,
      canCreateLeague: false,
      canJoinLeagues: true,
      canManageLeagues: false,
    });
  });

  it("allows organization actors to create and manage leagues", () => {
    expect(buildViewerCapabilities({ actorKind: "organization" })).toEqual({
      canBrowseLeagues: true,
      canCreateLeague: true,
      canJoinLeagues: false,
      canManageLeagues: true,
    });
  });
});
