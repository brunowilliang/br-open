/** Acordeão com um item aberto por vez: tocar no item aberto fecha, tocar em
 * outro troca. O grupo decide porque, no default (`isCollapsible`), o primitivo
 * manda `undefined` quando o item tocado é o aberto e o id quando é outro. */
export function toggleSingleExpandedId(
  currentId: string | undefined,
  toggledId: string | undefined
): string | undefined {
  return currentId === toggledId ? undefined : toggledId;
}

/** O item aberto saiu da lista: fecha em vez de guardar um id fantasma. */
export function closeRemovedExpandedId(
  currentId: string | undefined,
  removedId: string
): string | undefined {
  return currentId === removedId ? undefined : currentId;
}
