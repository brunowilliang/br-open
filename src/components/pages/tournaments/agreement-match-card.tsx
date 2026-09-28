import { useMatchAgreementCard } from "@/components/pages/tournaments/match-agreement-provider";
import { MatchCard, type MatchCardProps } from "@/components/ui/match-card";
import type { MatchAgreementSideOrder } from "@/lib/tournaments/match-agreement-view";

type AgreementMatchCardProps = Omit<MatchCardProps, "agreement"> & {
  matchId: null | string;
  /** Lado desenhado primeiro neste card: `match` para as telas na ordem do
   * confronto (agenda) e `viewer` quando o jogador vem na frente (home). */
  sideOrder: MatchAgreementSideOrder;
  /** O torneio do confronto: é ele que diz se o jogo é do viewer e o que está
   * combinado. */
  tournamentId: string;
};

/**
 * `MatchCard` do confronto do PRÓPRIO jogador, em qualquer tela: o card
 * segue burro e o combinado (chip + menu) entra por aqui. Cada item de lista
 * precisa do próprio hook (hook dentro de map é proibido): daí este hospedeiro,
 * que devolve o MESMO card de partida.
 */
export function AgreementMatchCard(props: AgreementMatchCardProps) {
  const { matchId, sideOrder, tournamentId, ...cardProps } = props;
  const agreement = useMatchAgreementCard({ matchId, sideOrder, tournamentId });

  return <MatchCard agreement={agreement} {...cardProps} />;
}
