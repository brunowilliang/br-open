import { describe, expect, it } from "bun:test";

import { resolveMatchFocus } from "./match-focus";

describe("resolveMatchFocus", () => {
  it("sem matchId nada sai em foco (a tela abre como sempre)", () => {
    expect(
      resolveMatchFocus({ focusMatchId: null, nextMatchId: "rh7arkpw" })
    ).toEqual({ isNextMatchFocused: false, listFocusMatchId: null });
    expect(
      resolveMatchFocus({ focusMatchId: undefined, nextMatchId: undefined })
    ).toEqual({ isNextMatchFocused: false, listFocusMatchId: null });
  });

  it("foca o primeiro jogo da fila quando o matchId é dele e não repete no resto", () => {
    expect(
      resolveMatchFocus({ focusMatchId: "rh7arkpw", nextMatchId: "rh7arkpw" })
    ).toEqual({ isNextMatchFocused: true, listFocusMatchId: null });
  });

  it("entrega o foco ao resto da fila quando o matchId não é o do primeiro", () => {
    expect(
      resolveMatchFocus({ focusMatchId: "rh700m50", nextMatchId: "rh7arkpw" })
    ).toEqual({ isNextMatchFocused: false, listFocusMatchId: "rh700m50" });
    // Sem "Próximo jogo" (chave privada) o resto da fila é o único alvo.
    expect(
      resolveMatchFocus({ focusMatchId: "rh700m50", nextMatchId: undefined })
    ).toEqual({ isNextMatchFocused: false, listFocusMatchId: "rh700m50" });
  });
});
