import type { PendingItem } from "@convex/domains/pendings/contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useToast } from "heroui-native";
import { View } from "react-native";

import { cn } from "better-styled";

import { ErrorMessage } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { WidgetAlert } from "@/components/ui/widget-alert";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  PENDING_ALERT_STATUS,
  type PendingActionResolution,
  resolvePendingAction,
} from "@/lib/pendings/pendings-view";

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
 * - ação → a mutation/rota viva do app, no ÚNICO ponto de resolução
 *   (`resolvePendingAction`): pagar a mensalidade/inscrição é o MESMO
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
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const createCharge = useMutation({
    mutationFn: crpcClient.payment.charge.createCharge.mutate,
    mutationKey: crpc.payment.charge.createCharge.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível gerar o código de pagamento. Tente novamente."
        ),
        id: "pending-create-charge-error",
        label: "Falha ao gerar PIX",
        variant: "danger",
      });
    },
    onSuccess: async (result) => {
      // Mesmo padrão do caminho do convite: o callback da página é AGUARDADO
      // antes de seguir (a navegação para o checkout vem depois da invalidação
      // do contexto de quem passou o callback).
      await props.onActionPerformed?.();
      router.navigate({
        params: { chargeId: result.chargeId },
        pathname: "/checkout/[chargeId]",
      });
    },
  });

  // Mesma mutation (e mesmos toasts) do wiring do convite na casa do torneio
  // (`tournaments/[tournamentId]/index.tsx`).
  const respondPartnerInvite = useMutation({
    mutationFn: crpcClient.tournament.entries.respondPartnerInvite.mutate,
    mutationKey: crpc.tournament.entries.respondPartnerInvite.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível responder ao convite. Tente novamente."
        ),
        id: "pending-respond-invite-error",
        label: "Falha ao responder convite",
        variant: "danger",
      });
    },
    onSuccess: async (_entry, variables) => {
      // O item some da lista depois da resposta: invalida a query de
      // pendências inteira (o escopo é do contrato, não uma decisão da tela).
      await queryClient.invalidateQueries(
        crpc.pendings.list.list.queryFilter()
      );
      // E a tela que sabe o próprio contexto invalida o dela (card da
      // inscrição/KPIs da casa do torneio, abas da liga).
      await props.onActionPerformed?.();
      toast.show({
        description: variables.accept
          ? "Convite aceito, a dupla está fechada."
          : "Convite recusado.",
        id: "pending-respond-invite-success",
        label: variables.accept ? "Convite aceito" : "Convite recusado",
        variant: "success",
      });
    },
  });

  /**
   * Dispara UMA ação resolvida (o principal e o secundário passam por aqui com
   * a SUA resolução — nunca a mesma).
   */
  const runAction = (resolution: PendingActionResolution | null) => {
    if (!resolution) {
      return;
    }

    switch (resolution.kind) {
      case "navigate":
        // O deep-link é do SERVIDOR: o cliente só repassa `route` + `params`,
        // como a notificação faz com `intent.url as Href`.
        router.navigate({
          params: resolution.params,
          pathname: resolution.route,
        } as unknown as Href);
        return;
      case "pay_membership":
        createCharge.mutate({
          sourceId: resolution.sourceId,
          sourceType: "league_membership",
        });
        return;
      case "pay_entry":
        createCharge.mutate({
          sourceId: resolution.entryId,
          sourceType: "tournament_entry",
        });
        return;
      case "respond_invite":
        respondPartnerInvite.mutate({
          accept: resolution.accept,
          entryId: resolution.entryId,
        });
        return;
      default:
        return;
    }
  };

  /** Cada botão desabilita pela SUA mutation em voo (o secundário também). */
  const isInFlight = (resolution: PendingActionResolution | null) => {
    switch (resolution?.kind) {
      case "pay_entry":
      case "pay_membership":
        return createCharge.isPending;
      case "respond_invite":
        return respondPartnerInvite.isPending;
      default:
        return false;
    }
  };

  if (props.isLoading) {
    return <LoadingState />;
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
                    isDisabled: isInFlight(primary),
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
                    isDisabled: isInFlight(secondary),
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
