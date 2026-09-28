/**
 * Alvo do confronto que a url abriu (`matchId` do aviso): a tela rola até o
 * card dele. Sem o parâmetro, tudo segue como sempre foi.
 *
 * O "Próximo jogo" é o alvo quando é ele o confronto aberto; o painel dos
 * próprios jogos só recebe o alvo que o card de cima não cobriu, para a tela não
 * rolar duas vezes até o mesmo confronto.
 */
export function resolveMatchFocus(input: {
  focusMatchId: null | string | undefined;
  nextMatchId: null | string | undefined;
}): { isNextMatchFocused: boolean; panelFocusMatchId: null | string } {
  const isNextMatchFocused = Boolean(
    input.focusMatchId && input.nextMatchId === input.focusMatchId
  );

  return {
    isNextMatchFocused,
    panelFocusMatchId: isNextMatchFocused ? null : (input.focusMatchId ?? null),
  };
}
