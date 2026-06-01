import { describe, expect, it } from "bun:test";

import { buildTrustedOrigins } from "./auth-trusted-origins";

describe("buildTrustedOrigins", () => {
  it("keeps the site url and trusts the mobile app scheme", () => {
    expect(
      buildTrustedOrigins({
        siteUrl: "https://kindred-yak-142.convex.site",
      })
    ).toEqual(["https://kindred-yak-142.convex.site", "bropen://"]);
  });
});
