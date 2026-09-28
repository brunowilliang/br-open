import { describe, expect, it } from "bun:test";

import { isSameScheduleSlot } from "./slot-equality";

const SLOT = {
  courtId: "court-1",
  matchDate: "2026-05-26",
  startMinute: 1080,
};

describe("isSameScheduleSlot", () => {
  it("recognizes the same slot field by field", () => {
    expect(isSameScheduleSlot(SLOT, { ...SLOT })).toBe(true);
  });

  it("treats any changed field as another slot", () => {
    expect(isSameScheduleSlot(SLOT, { ...SLOT, matchDate: "2026-05-27" })).toBe(
      false
    );
    expect(isSameScheduleSlot(SLOT, { ...SLOT, startMinute: 1140 })).toBe(
      false
    );
    expect(isSameScheduleSlot(SLOT, { ...SLOT, courtId: "court-2" })).toBe(
      false
    );
  });

  it("reads an empty court on the table as no court", () => {
    // O confronto sem quadra chega ao diálogo como "" (nada a comparar com a
    // quadra escolhida: qualquer uma é proposta nova).
    expect(isSameScheduleSlot({ ...SLOT, courtId: null }, SLOT)).toBe(false);
    expect(
      isSameScheduleSlot({ ...SLOT, courtId: null }, { ...SLOT, courtId: "" })
    ).toBe(true);
  });
});
