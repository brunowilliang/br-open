import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { Text } from "@/components/core/text";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { View } from "react-native";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

/**
 * Visão do visitante na casa da liga (plano de conteúdo IBX-0071: só a
 * descrição em texto simples; o card de features saiu). O aviso de inscrição
 * suspensa (BUG-0042) agora é o item do SERVIDOR (`pendings.list` do escopo
 * player, kind `player_league_membership_suspended`), recortado para esta liga
 * pela membership do viewer — o builder do cliente morreu no cutover do
 * PLN-0008. O CTA de renovar continua no rodapé fixo de entrada (JoinFooter,
 * modo liga), que a página monta para o papel guest: o item do suspenso tem
 * `route: null` e o `Pagar`/`Renovar` de mensalidade gera o PIX na própria tela
 * pelo renderer. Aqui, sem membership com pendência, não se desenha nada.
 */
export function GuestOverview(props: {
  league: LeagueOverview;
  onPendingActionPerformed?: () => void;
}) {
  const { league } = props;
  const bucket$ = getLeagueDetailsBucket$(league.id);
  const pendings = useValue(bucket$.derived.pendings);
  const pendingsStatus = useValue(bucket$.identity.pendingsStatus);

  return (
    <View className="gap-4">
      <PendingAlerts
        isError={pendingsStatus === "error"}
        isLoading={pendingsStatus === "loading"}
        items={pendings}
        onActionPerformed={props.onPendingActionPerformed}
      />

      {league.description ? <Text>{league.description}</Text> : null}
    </View>
  );
}
