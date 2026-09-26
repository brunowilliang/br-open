import { describe, expect, it } from "bun:test";

import {
  DEFAULT_ACTOR_KIND,
  buildViewerCapabilities,
  isActiveActorManager,
  resolveActorKind,
} from "../actor-context";

describe("actor context", () => {
  it("defaults viewers to player actor", () => {
    expect(DEFAULT_ACTOR_KIND).toBe("player");
    expect(resolveActorKind(null)).toBe("player");
    expect(resolveActorKind(undefined)).toBe("player");
    expect(resolveActorKind("invalid")).toBe("player");
  });

  it("denies organization management to players and bare members", () => {
    expect(buildViewerCapabilities({ actorKind: "player" })).toEqual({
      canManageOrganization: false,
    });
    expect(
      buildViewerCapabilities({ actorKind: "organization", role: "member" })
    ).toEqual({ canManageOrganization: false });
  });

  it("allows owners and admins to manage the organization", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(
        buildViewerCapabilities({ actorKind: "organization", role })
      ).toEqual({ canManageOrganization: true });
    }
  });

  describe("isActiveActorManager", () => {
    it("rejects player actors", () => {
      expect(isActiveActorManager({ kind: "player" })).toBe(false);
    });

    it("rejects organization members without a manager role", () => {
      expect(
        isActiveActorManager({ kind: "organization", role: "member" })
      ).toBe(false);
      expect(isActiveActorManager({ kind: "organization" })).toBe(false);
    });

    it("accepts organization owners and admins", () => {
      expect(
        isActiveActorManager({ kind: "organization", role: "owner" })
      ).toBe(true);
      expect(
        isActiveActorManager({ kind: "organization", role: "admin" })
      ).toBe(true);
    });
  });
});
