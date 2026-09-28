import { describe, expect, it } from "bun:test";

import { resolveScheduleProposalForm } from "./schedule-proposal-form";

describe("resolveScheduleProposalForm", () => {
  it("sends the court the organizer picked", () => {
    expect(
      resolveScheduleProposalForm({
        courtId: "court-1",
        defaultDurationMinutes: 90,
        isCourtRequired: true,
        matchDate: "2026-10-13",
        startMinute: "960",
      })
    ).toEqual({
      error: null,
      value: {
        courtId: "court-1",
        endMinute: 1050,
        matchDate: "2026-10-13",
        startMinute: 960,
      },
    });
  });

  it("sends without a court when the tournament has none", () => {
    expect(
      resolveScheduleProposalForm({
        courtId: null,
        defaultDurationMinutes: 90,
        isCourtRequired: false,
        matchDate: "2026-10-13",
        startMinute: "960",
      })
    ).toEqual({
      error: null,
      value: {
        courtId: null,
        endMinute: 1050,
        matchDate: "2026-10-13",
        startMinute: 960,
      },
    });
  });

  it("still asks for the date and the time without a court", () => {
    expect(
      resolveScheduleProposalForm({
        courtId: null,
        defaultDurationMinutes: 90,
        isCourtRequired: false,
        matchDate: "2026-10-13",
      })
    ).toEqual({ error: "Preencha data e horário.", value: null });

    expect(
      resolveScheduleProposalForm({
        courtId: null,
        defaultDurationMinutes: 90,
        isCourtRequired: false,
      })
    ).toEqual({ error: "Preencha data e horário.", value: null });
  });

  it("keeps the court in the message while the tournament has courts", () => {
    expect(
      resolveScheduleProposalForm({
        courtId: null,
        defaultDurationMinutes: 90,
        isCourtRequired: true,
        matchDate: "2026-10-13",
        startMinute: "960",
      })
    ).toEqual({ error: "Preencha data, quadra e horário.", value: null });
  });
});
