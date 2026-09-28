import { describe, expect, test } from "bun:test";

import {
  FLOATING_TAB_BAR_BOTTOM_GAP,
  getFloatingTabBarSpacing,
} from "./floating-tab-bar-layout";

describe("getFloatingTabBarSpacing", () => {
  test("soma altura, folga e safe area", () => {
    expect(getFloatingTabBarSpacing({ bottomInset: 34, height: 64 })).toBe(
      64 + FLOATING_TAB_BAR_BOTTOM_GAP + 34
    );
  });

  test("sem a barra medida vale só a safe area e a folga", () => {
    expect(getFloatingTabBarSpacing({ bottomInset: 34, height: 0 })).toBe(
      FLOATING_TAB_BAR_BOTTOM_GAP + 34
    );
  });

  test("valores quebrados ou negativos não viram espaço negativo", () => {
    expect(getFloatingTabBarSpacing({ bottomInset: -10, height: 63.2 })).toBe(
      64 + FLOATING_TAB_BAR_BOTTOM_GAP
    );
  });
});
