import { describe, expect, test } from "bun:test";

import {
  buildAutoBracketReleaseDate,
  buildAutoRegistrationDeadline,
  resolveTournamentEndDate,
  shouldDateFollowStartDate,
} from "./tournament-window-defaults";

describe("resolveTournamentEndDate", () => {
  test("fim depois do início fica como está", () => {
    expect(
      resolveTournamentEndDate({
        endDate: "2026-10-20",
        startDate: "2026-10-13",
      })
    ).toBe("2026-10-20");
  });

  test("fim no MESMO dia do início vira o dia seguinte", () => {
    expect(
      resolveTournamentEndDate({
        endDate: "2026-10-14",
        startDate: "2026-10-14",
      })
    ).toBe("2026-10-15");
  });

  test("fim anterior ao início vira o dia seguinte", () => {
    expect(
      resolveTournamentEndDate({
        endDate: "2026-10-10",
        startDate: "2026-10-14",
      })
    ).toBe("2026-10-15");
  });

  test("fim em branco (legado sem teto) segue em branco", () => {
    expect(
      resolveTournamentEndDate({ endDate: "", startDate: "2026-10-14" })
    ).toBe("");
  });

  test("vira o mês e o ano", () => {
    expect(
      resolveTournamentEndDate({
        endDate: "2026-09-30",
        startDate: "2026-09-30",
      })
    ).toBe("2026-10-01");
    expect(
      resolveTournamentEndDate({
        endDate: "2026-12-31",
        startDate: "2026-12-31",
      })
    ).toBe("2027-01-01");
  });
});

describe("buildAutoRegistrationDeadline", () => {
  test("3 dias antes do início", () => {
    expect(
      buildAutoRegistrationDeadline({
        startDate: "2027-10-07",
        todayDayKey: "2027-09-01",
      })
    ).toBe("2027-10-04");
  });

  test("início - 3 no passado usa o limite permitido (hoje)", () => {
    expect(
      buildAutoRegistrationDeadline({
        startDate: "2027-09-03",
        todayDayKey: "2027-09-01",
      })
    ).toBe("2027-09-01");
  });

  test("início amanhã cai no hoje, que ainda é anterior ao início", () => {
    expect(
      buildAutoRegistrationDeadline({
        startDate: "2027-09-02",
        todayDayKey: "2027-09-01",
      })
    ).toBe("2027-09-01");
  });

  test("início hoje não tem dia válido e fica em branco", () => {
    expect(
      buildAutoRegistrationDeadline({
        startDate: "2027-09-01",
        todayDayKey: "2027-09-01",
      })
    ).toBe("");
  });

  test("virada de mês", () => {
    expect(
      buildAutoRegistrationDeadline({
        startDate: "2027-11-01",
        todayDayKey: "2027-09-01",
      })
    ).toBe("2027-10-29");
  });
});

describe("buildAutoBracketReleaseDate", () => {
  test("2 dias antes do início", () => {
    expect(
      buildAutoBracketReleaseDate({
        startDate: "2027-10-07",
        todayDayKey: "2027-09-01",
      })
    ).toBe("2027-10-05");
  });

  test("início - 2 no passado usa o limite permitido (hoje)", () => {
    expect(
      buildAutoBracketReleaseDate({
        startDate: "2027-09-03",
        todayDayKey: "2027-09-01",
      })
    ).toBe("2027-09-01");
  });

  test("no dia do início a divulgação vale (a chave abre no mesmo dia)", () => {
    expect(
      buildAutoBracketReleaseDate({
        startDate: "2027-09-01",
        todayDayKey: "2027-09-01",
      })
    ).toBe("2027-09-01");
  });

  test("início já passado (torneio legado na edição) fica em branco", () => {
    expect(
      buildAutoBracketReleaseDate({
        startDate: "2027-08-20",
        todayDayKey: "2027-09-01",
      })
    ).toBe("");
  });

  test("virada de mês e ano", () => {
    expect(
      buildAutoBracketReleaseDate({
        startDate: "2027-01-01",
        todayDayKey: "2026-12-01",
      })
    ).toBe("2026-12-30");
  });
});

describe("shouldDateFollowStartDate", () => {
  test("campo vazio (create) acompanha", () => {
    expect(
      shouldDateFollowStartDate({ lastAutoValue: "", value: "" })
    ).toBeTrue();
  });

  test("ainda igual ao último automático acompanha", () => {
    expect(
      shouldDateFollowStartDate({
        lastAutoValue: "2027-10-05",
        value: "2027-10-05",
      })
    ).toBeTrue();
  });

  test("data editada à mão não acompanha (inclusive a do torneio na edição)", () => {
    expect(
      shouldDateFollowStartDate({
        lastAutoValue: "2027-10-05",
        value: "2027-10-06",
      })
    ).toBeFalse();
    expect(
      shouldDateFollowStartDate({
        lastAutoValue: "",
        value: "2027-10-05",
      })
    ).toBeFalse();
  });
});
