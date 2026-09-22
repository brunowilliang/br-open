import type { ApiOutputs } from "@convex/shared/api";
import { useValue } from "@legendapp/state/react";
import { Text } from "@/components/core/text";
import { PendingAlerts } from "@/components/ui/pending-alerts";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import { View } from "react-native";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

/** Visão do visitante: só a descrição em texto simples. O aviso de inscrição
 * suspensa é o item do SERVIDOR (`pendings.list`, kind
 * `player_league_membership_suspended`) recortado para esta liga, com o `Renovar`
 * do próprio alerta. O rodapé de entrada NÃO monta para o suspenso
 * (`buildLeagueDetailsShowJoinFooter`): evita dois botões de pagamento da MESMA
 * membership na tela. */
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
