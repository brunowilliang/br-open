import { describe, expect, it } from "bun:test";

import { buildPageInsetStyle } from "./page-insets";

describe("buildPageInsetStyle", () => {
  it("does not override className padding when there is no measured header or footer", () => {
    expect(buildPageInsetStyle({ footerHeight: 0, headerHeight: 0 })).toEqual(
      {}
    );
  });

  it("adds measured header and footer padding when present", () => {
    expect(buildPageInsetStyle({ footerHeight: 32, headerHeight: 48 })).toEqual(
      {
        paddingBottom: 32,
        paddingTop: 48,
      }
    );
  });
});
