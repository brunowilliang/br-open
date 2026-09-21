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
 * PLN-0008. Desde o IBX-0084 o `Renovar` é o BOTÃO do próprio alerta
 * (`actionLabel` + `action: pay_league_membership` do servidor, sem handler
 * novo: é o runner compartilhado que gera o PIX da membership e abre o
 * checkout) e o rodapé fixo de entrada NÃO monta para o suspenso
 * (`buildLeagueDetailsShowJoinFooter`) para não ficar com dois botões de
 * pagamento da MESMA membership na mesma tela (BUG-0042). Aqui, sem membership
 * com pendência, não se desenha nada.
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
