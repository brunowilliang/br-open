import { describe, expect, it } from "bun:test";

import { hasOrderChanged, shouldKeepLocalOrder } from "./reorder-order";

const items = [{ id: "one" }, { id: "two" }, { id: "three" }];

describe("shouldKeepLocalOrder", () => {
  it("does not keep the local order when there is no drag or pending reorder", () => {
    expect(
      shouldKeepLocalOrder({
        activeItemId: null,
        items,
        pendingOrderIds: null,
      })
    ).toBe(false);
  });

  it("keeps the local drag order while the server still has the previous order", () => {
    expect(
      shouldKeepLocalOrder({
        activeItemId: null,
        items,
        pendingOrderIds: ["two", "one", "three"],
      })
    ).toBe(true);
  });

  it("drops the local order when the server order matches the pending reorder", () => {
    expect(
      shouldKeepLocalOrder({
        activeItemId: null,
        items: [{ id: "two" }, { id: "one" }, { id: "three" }],
        pendingOrderIds: ["two", "one", "three"],
      })
    ).toBe(false);
  });

  it("keeps the local order while an item is actively being dragged", () => {
    expect(
      shouldKeepLocalOrder({
        activeItemId: "one",
        items,
        pendingOrderIds: null,
      })
    ).toBe(true);
  });
});

describe("hasOrderChanged", () => {
  it("does not treat a drag dropped in the same order as a change", () => {
    expect(
      hasOrderChanged({
        currentOrderIds: ["one", "two", "three"],
        nextOrderIds: ["one", "two", "three"],
      })
    ).toBe(false);
  });

  it("detects when the drag changes the order", () => {
    expect(
      hasOrderChanged({
        currentOrderIds: ["one", "two", "three"],
        nextOrderIds: ["two", "one", "three"],
      })
    ).toBe(true);
  });
});
