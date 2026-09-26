type OrderItem = {
  id: string;
};

export function getOrderIds(items: OrderItem[]) {
  return items.map((item) => item.id);
}

function hasSameOrder(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

export function hasOrderChanged(input: {
  currentOrderIds: string[];
  nextOrderIds: string[];
}) {
  return !hasSameOrder(input.currentOrderIds, input.nextOrderIds);
}

// Arrasto em andamento ou reordenação ainda não confirmada pelo servidor: a
// lista precisa ficar com a ordem local, senão o item "volta" no meio do gesto.
export function shouldKeepLocalOrder(input: {
  activeItemId: null | string;
  items: OrderItem[];
  pendingOrderIds: null | string[];
}) {
  if (input.activeItemId) {
    return true;
  }

  if (!input.pendingOrderIds) {
    return false;
  }

  return !hasSameOrder(getOrderIds(input.items), input.pendingOrderIds);
}
