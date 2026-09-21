import type { PendingItem } from "@convex/domains/pendings/contract";
import { View } from "react-native";

import { cn } from "better-styled";

import { ErrorMessage } from "@/components/ui/error-state";
import { WidgetAlert } from "@/components/ui/widget-alert";
import {
  PENDING_ALERT_STATUS,
  resolvePendingAction,
} from "@/lib/pendings/pendings-view";
import { usePendingActionRunner } from "@/lib/pendings/use-pending-action-runner";

type PendingAlertsProps = {
  className?: string;
  isError?: boolean;
  isLoading?: boolean;
  items: PendingItem[];
  /**
   * Chamado depois de CADA ação concluída com sucesso. O renderer é genérico:
   * ele invalida só a lista de pendências (que é dele); quem conhece a entidade
   * da tela (a casa do torneio, a casa da liga) passa aqui a invalidação do
   * próprio contexto — sem isso, responder ao convite de dentro do alerta
   * deixaria o card da inscrição e os KPIs velhos até o próximo refetch.
   */
  onActionPerformed?: () => Promise<void> | void;
};

/**
 * Renderer ÚNICO de pendências/alertas (IBX-0076 / PLN-0008): o item do
 * servidor já vem com kind, severidade, título, descrição (string ou LINHAS de
 * partes, com o destaque do servidor), os dois rótulos de ação, a AÇÃO, a rota
 * e os params. Aqui só se mapeia:
 *
 * - severidade → status do `WidgetAlert` (`info` não existe no alerta →
 *   `accent`, como na galeria aprovada);
 * - ação → a resolução viva do app, no ÚNICO ponto de tradução
 *   (`resolvePendingAction`, `lib/pendings/pendings-view.ts`) — quem EXECUTA é
 *   o runner compartilhado (`usePendingActionRunner`), o mesmo do cartão de
 *   notificação (IBX-0077): pagar a mensalidade/inscrição é o MESMO
 *   `payment.charge.createCharge` das telas (com o checkout no sucesso),
 *   responder ao convite é a MESMA `tournament.entries.respondPartnerInvite` da
 *   casa do torneio e a navegação pura abre o `route` do item;
 * - ordem: a do array do servidor (severidade → prazo → valor), nunca
 *   reordenada aqui.
 *
 * Com `secondaryActionLabel`, as duas ações saem no rodapé do alerta na ordem
 * secundária → principal, que é a ordem que o `WidgetAlert` já renderiza. CADA
 * botão resolve a SUA ação pelo SEU `action` (o principal por `item.action`, o
 * secundário por `item.secondaryAction`) e dispara o SEU comando: era o bug de
 * o `Recusar` (secundária do convite) reusar o `onPress` do `Aceitar` e ACEITAR
 * o convite. Botão cuja ação não resolve não é desenhado (mesma regra
 * defensiva do principal).
 */
export function PendingAlerts(props: PendingAlertsProps) {
  const { isActionPending, runAction } = usePendingActionRunner({
    onPerformed: props.onActionPerformed,
  });

  if (props.isLoading) {
    return null;
  }

  if (props.isError) {
    return (
      <ErrorMessage message="Não foi possível carregar suas pendências." />
    );
  }

  if (props.items.length === 0) {
    return null;
  }

  return (
    <View className={cn("gap-3", props.className)}>
      {props.items.map((item) => {
        // CADA CTA tem a SUA ação: o principal resolve por `item.action` e o
        // secundário por `item.secondaryAction` (era o bug de o Recusar do
        // convite reusar o onPress do Aceitar e aceitar).
        const primary = resolvePendingAction(item);
        const secondary = item.secondaryAction
          ? resolvePendingAction({ ...item, action: item.secondaryAction })
          : null;

        return (
          <WidgetAlert
            action={
              item.actionLabel && primary
                ? {
                    isDisabled: isActionPending(primary),
                    label: item.actionLabel,
                    onPress: () => {
                      runAction(primary);
                    },
                  }
                : undefined
            }
            description={item.description}
            key={item.id}
            secondaryAction={
              item.secondaryActionLabel && secondary
                ? {
                    isDisabled: isActionPending(secondary),
                    label: item.secondaryActionLabel,
                    onPress: () => {
                      runAction(secondary);
                    },
                  }
                : undefined
            }
            status={PENDING_ALERT_STATUS[item.severity]}
            title={item.title}
          />
        );
      })}
    </View>
  );
}
