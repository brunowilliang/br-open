import { describe, expect, test } from "bun:test";

import {
  closeRemovedExpandedId,
  toggleSingleExpandedId,
} from "@/lib/tournaments/accordion-selection";

/**
 * Ramo single do Accordion (heroui-native, `isCollapsible` default): o item
 * tocado é o aberto -> manda `undefined`; senão, manda o id tocado. É o que o
 * grupo recebe no `onValueChange`.
 */
function pressedIdFromAccordion(
  expandedId: string | undefined,
  pressedId: string
): string | undefined {
  return pressedId === expandedId ? undefined : pressedId;
}

function pressItem(expandedId: string | undefined, pressedId: string) {
  return toggleSingleExpandedId(
    expandedId,
    pressedIdFromAccordion(expandedId, pressedId)
  );
}

describe("toggleSingleExpandedId", () => {
  test("sem item aberto, o tocado abre", () => {
    expect(toggleSingleExpandedId(undefined, "quadra-a")).toBe("quadra-a");
  });

  test("abrir outro fecha o anterior", () => {
    expect(toggleSingleExpandedId("quadra-a", "quadra-b")).toBe("quadra-b");
  });

  test("tocar no item já aberto fecha", () => {
    expect(toggleSingleExpandedId("quadra-a", undefined)).toBeUndefined();
    expect(toggleSingleExpandedId("quadra-a", "quadra-a")).toBeUndefined();
  });

  test("sem item tocado nada abre", () => {
    expect(toggleSingleExpandedId(undefined, undefined)).toBeUndefined();
    expect(toggleSingleExpandedId("quadra-a", undefined)).toBeUndefined();
  });

  test("a sequência de toques nunca deixa mais de um id aberto", () => {
    let expandedId: string | undefined;
    const openedIds: (string | undefined)[] = [];

    for (const toggledId of ["a", "b", "b", "c", "a"]) {
      expandedId = toggleSingleExpandedId(expandedId, toggledId);
      openedIds.push(expandedId);
    }

    expect(openedIds).toEqual(["a", "b", undefined, "c", "a"]);
  });
});

describe("toque no card (ramo do primitivo)", () => {
  test("tocar no card aberto fecha, sem deixar ninguém aberto", () => {
    expect(pressItem("quadra-a", "quadra-a")).toBeUndefined();
  });

  test("tocar em outro card troca o aberto", () => {
    expect(pressItem("quadra-a", "quadra-b")).toBe("quadra-b");
  });

  test("com tudo fechado, tocar num card o abre", () => {
    expect(pressItem(undefined, "quadra-a")).toBe("quadra-a");
  });

  test("sequência de toques no primitivo nunca deixa dois abertos", () => {
    let expandedId: string | undefined;
    const openedIds: (string | undefined)[] = [];

    for (const pressedId of ["a", "b", "b", "c", "a", "a"]) {
      expandedId = pressItem(expandedId, pressedId);
      openedIds.push(expandedId);
    }

    expect(openedIds).toEqual(["a", "b", undefined, "c", "a", undefined]);
  });
});

describe("closeRemovedExpandedId", () => {
  test("remover o item aberto fecha o grupo", () => {
    expect(closeRemovedExpandedId("quadra-a", "quadra-a")).toBeUndefined();
  });

  test("remover outro item mantém o aberto", () => {
    expect(closeRemovedExpandedId("quadra-a", "quadra-b")).toBe("quadra-a");
    expect(closeRemovedExpandedId(undefined, "quadra-b")).toBeUndefined();
  });
});
