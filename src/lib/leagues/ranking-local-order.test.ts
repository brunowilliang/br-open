import { describe, expect, it } from "bun:test";

import {
  hasRankingOrderChanged,
  shouldSyncRankingLocalItems,
} from "./ranking-local-order";

const rankingItems = [{ id: "one" }, { id: "two" }, { id: "three" }];

describe("shouldSyncRankingLocalItems", () => {
  it("syncs local ranking when there is no drag or pending reorder", () => {
    expect(
      shouldSyncRankingLocalItems({
        activeItemId: null,
        pendingOrderIds: null,
        rankingItems,
      })
    ).toBe(true);
  });

  it("keeps the local drag order while the server still has the previous order", () => {
    expect(
      shouldSyncRankingLocalItems({
        activeItemId: null,
        pendingOrderIds: ["two", "one", "three"],
        rankingItems,
      })
    ).toBe(false);
  });

  it("syncs again when the server order matches the pending reorder", () => {
    expect(
      shouldSyncRankingLocalItems({
        activeItemId: null,
        pendingOrderIds: ["two", "one", "three"],
        rankingItems: [{ id: "two" }, { id: "one" }, { id: "three" }],
      })
    ).toBe(true);
  });

  it("does not sync while an item is actively being dragged", () => {
    expect(
      shouldSyncRankingLocalItems({
        activeItemId: "one",
        pendingOrderIds: null,
        rankingItems,
      })
    ).toBe(false);
  });
});

describe("hasRankingOrderChanged", () => {
  it("does not treat a drag dropped in the same order as a ranking change", () => {
    expect(
      hasRankingOrderChanged({
        currentOrderIds: ["one", "two", "three"],
        nextOrderIds: ["one", "two", "three"],
      })
    ).toBe(false);
  });

  it("detects when the drag changes the ranking order", () => {
    expect(
      hasRankingOrderChanged({
        currentOrderIds: ["one", "two", "three"],
        nextOrderIds: ["two", "one", "three"],
      })
    ).toBe(true);
  });
});
