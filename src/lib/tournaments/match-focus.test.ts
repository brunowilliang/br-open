import { describe, expect, it } from "bun:test";

import { resolveMatchFocus } from "./match-focus";

describe("resolveMatchFocus", () => {
  it("sem matchId nada sai em foco (a tela abre como sempre)", () => {
    expect(
      resolveMatchFocus({ focusMatchId: null, nextMatchId: "rh7arkpw" })
    ).toEqual({ isNextMatchFocused: false, panelFocusMatchId: null });
    expect(
      resolveMatchFocus({ focusMatchId: undefined, nextMatchId: undefined })
    ).toEqual({ isNextMatchFocused: false, panelFocusMatchId: null });
  });

  it("foca o Próximo jogo quando o matchId é dele e não repete no painel", () => {
    expect(
      resolveMatchFocus({ focusMatchId: "rh7arkpw", nextMatchId: "rh7arkpw" })
    ).toEqual({ isNextMatchFocused: true, panelFocusMatchId: null });
  });

  it("entrega o foco ao painel quando o matchId não é o do Próximo jogo", () => {
    expect(
      resolveMatchFocus({ focusMatchId: "rh700m50", nextMatchId: "rh7arkpw" })
    ).toEqual({ isNextMatchFocused: false, panelFocusMatchId: "rh700m50" });
    // Sem "Próximo jogo" (chave privada) o painel é o único alvo possível.
    expect(
      resolveMatchFocus({ focusMatchId: "rh700m50", nextMatchId: undefined })
    ).toEqual({ isNextMatchFocused: false, panelFocusMatchId: "rh700m50" });
  });
});
