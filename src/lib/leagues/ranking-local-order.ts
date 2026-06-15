type RankingOrderItem = {
  id: string;
};

export function getRankingOrderIds(items: RankingOrderItem[]) {
  return items.map((item) => item.id);
}

function hasSameRankingOrder(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

export function hasRankingOrderChanged(input: {
  currentOrderIds: string[];
  nextOrderIds: string[];
}) {
  return !hasSameRankingOrder(input.currentOrderIds, input.nextOrderIds);
}

export function shouldSyncRankingLocalItems(input: {
  activeItemId: string | null;
  pendingOrderIds: string[] | null;
  rankingItems: RankingOrderItem[];
}) {
  if (input.activeItemId) {
    return false;
  }

  if (!input.pendingOrderIds) {
    return true;
  }

  return hasSameRankingOrder(
    getRankingOrderIds(input.rankingItems),
    input.pendingOrderIds
  );
}
