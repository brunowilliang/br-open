/** Titulo e categoria do checkout lidos do source VIVO: o snapshot da charge
 * nasce no formato antigo (`Torneio — Categoria`) e nao serve para o titulo. */
import { SOURCE_TYPE_TOURNAMENT_ENTRY } from "./contract";

export type CheckoutSourceIdentity = {
  category: null | string;
  label: null | string;
};

/** Cadeia quebrada devolve `label` nulo em vez do snapshot: repetir o texto
 * antigo reintroduziria a categoria no titulo. */
export function resolveCheckoutSourceIdentity(args: {
  category: null | { displayName: string };
  snapshotLabel: null | string;
  sourceType: string;
  tournament: null | { name: string };
}): CheckoutSourceIdentity {
  if (args.sourceType !== SOURCE_TYPE_TOURNAMENT_ENTRY) {
    return { category: null, label: args.snapshotLabel };
  }
  if (!(args.category && args.tournament)) {
    return { category: null, label: null };
  }
  return { category: args.category.displayName, label: args.tournament.name };
}
