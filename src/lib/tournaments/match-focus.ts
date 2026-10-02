/**
 * Alvo do confronto que a url abriu (`matchId` do aviso): a tela rola até o
 * card dele. Sem o parâmetro, tudo segue como sempre foi.
 *
 * O PRIMEIRO card da fila ("Próximos jogos") é o alvo quando é ele o confronto
 * aberto; o resto da fila só recebe o alvo que o primeiro não cobriu, para a
 * tela não rolar duas vezes até o mesmo confronto.
 */
export function resolveMatchFocus(input: {
  focusMatchId: null | string | undefined;
  nextMatchId: null | string | undefined;
}): { isNextMatchFocused: boolean; listFocusMatchId: null | string } {
  const isNextMatchFocused = Boolean(
    input.focusMatchId && input.nextMatchId === input.focusMatchId
  );

  return {
    isNextMatchFocused,
    listFocusMatchId: isNextMatchFocused ? null : (input.focusMatchId ?? null),
  };
}
