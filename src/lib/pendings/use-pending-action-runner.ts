import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useToast } from "heroui-native";

import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import type { PendingActionResolution } from "@/lib/pendings/pendings-view";

type UsePendingActionRunnerInput = {
  /** O runner invalida só a lista de pendências; o contexto da tela entra aqui. */
  onPerformed?: () => Promise<void> | void;
};

export function usePendingActionRunner(input?: UsePendingActionRunnerInput) {
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
      // O callback da superfície é AGUARDADO antes de seguir (a navegação para
      // o checkout vem depois da invalidação de quem passou o callback).
      await input?.onPerformed?.();
      router.navigate({
        params: { chargeId: result.chargeId },
        pathname: "/checkout/[chargeId]",
      });
    },
  });

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
      await queryClient.invalidateQueries(
        crpc.pendings.list.list.queryFilter()
      );
      await input?.onPerformed?.();
      toast.show({
        description: variables.accept
          ? "Convite aceito, a dupla está fechada."
          : "Convite recusado, as vagas voltaram para a categoria.",
        id: "pending-respond-invite-success",
        label: variables.accept ? "Convite aceito" : "Convite recusado",
        variant: "success",
      });
    },
  });

  const approveMembership = useMutation({
    mutationFn: crpcClient.league.membership.approve.mutate,
    mutationKey: crpc.league.membership.approve.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível aprovar a solicitação. Tente novamente."
        ),
        id: "approve-membership-error",
        label: "Falha ao aprovar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await input?.onPerformed?.();
      toast.show({
        description: "O jogador já aparece no ranking da liga.",
        id: "approve-membership-success",
        label: "Participante aprovado",
        variant: "success",
      });
    },
  });

  const rejectMembership = useMutation({
    mutationFn: crpcClient.league.membership.reject.mutate,
    mutationKey: crpc.league.membership.reject.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível recusar a solicitação. Tente novamente."
        ),
        id: "reject-membership-error",
        label: "Falha ao recusar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await input?.onPerformed?.();
      toast.show({
        description: "A solicitação foi recusada.",
        id: "reject-membership-success",
        label: "Solicitação recusada",
        variant: "success",
      });
    },
  });

  const approveEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.approve.mutate,
    mutationKey: crpc.tournament.entries.approve.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível aprovar a inscrição. Tente novamente."
        ),
        id: "approve-entry-error",
        label: "Falha ao aprovar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await input?.onPerformed?.();
      toast.show({
        description: "Inscrição aprovada.",
        id: "approve-entry-success",
        label: "Inscrição aprovada",
        variant: "success",
      });
    },
  });

  const rejectEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.reject.mutate,
    mutationKey: crpc.tournament.entries.reject.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível recusar a inscrição. Tente novamente."
        ),
        id: "reject-entry-error",
        label: "Falha ao recusar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await input?.onPerformed?.();
      toast.show({
        description: "Inscrição recusada.",
        id: "reject-entry-success",
        label: "Inscrição recusada",
        variant: "success",
      });
    },
  });

  const acceptChallengeProposal = useMutation({
    mutationFn: crpcClient.league.challenges.acceptProposal.mutate,
    mutationKey: crpc.league.challenges.acceptProposal.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível aceitar o desafio. Tente novamente."
        ),
        id: "accept-challenge-proposal-error",
        label: "Falha ao aceitar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await input?.onPerformed?.();
      toast.show({
        description: "A partida está confirmada.",
        id: "accept-challenge-proposal-success",
        label: "Desafio aceito",
        variant: "success",
      });
    },
  });

  const declineChallengeProposal = useMutation({
    mutationFn: crpcClient.league.challenges.declineProposal.mutate,
    mutationKey: crpc.league.challenges.declineProposal.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível recusar o desafio. Tente novamente."
        ),
        id: "decline-challenge-proposal-error",
        label: "Falha ao recusar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await input?.onPerformed?.();
      toast.show({
        description: "A proposta foi recusada.",
        id: "decline-challenge-proposal-success",
        label: "Desafio recusado",
        variant: "success",
      });
    },
  });

  const respondCancellation = useMutation({
    mutationFn: crpcClient.league.challenges.respondCancellationRequest.mutate,
    mutationKey:
      crpc.league.challenges.respondCancellationRequest.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível responder à solicitação. Tente novamente."
        ),
        id: "respond-challenge-cancellation-error",
        label: "Falha ao responder",
        variant: "danger",
      });
    },
    onSuccess: async (_, variables) => {
      await input?.onPerformed?.();
      toast.show({
        description:
          variables.action === "accept"
            ? "A partida foi cancelada."
            : "A partida segue no estado anterior.",
        id:
          variables.action === "accept"
            ? "accept-challenge-cancellation-success"
            : "reject-challenge-cancellation-success",
        label:
          variables.action === "accept"
            ? "Cancelamento aceito"
            : "Cancelamento recusado",
        variant: "success",
      });
    },
  });

  const confirmResult = useMutation({
    mutationFn: crpcClient.league.challenges.confirmResult.mutate,
    mutationKey: crpc.league.challenges.confirmResult.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível confirmar o resultado. Tente novamente."
        ),
        id: "confirm-challenge-result-error",
        label: "Falha ao confirmar resultado",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await input?.onPerformed?.();
      toast.show({
        description: "O resultado foi registrado no ranking.",
        id: "confirm-challenge-result-success",
        label: "Resultado confirmado",
        variant: "success",
      });
    },
  });

  // Não é otimista: quem tira o item da tela é a releitura (falha não esconde nada).
  const dismissPendingItem = useMutation({
    mutationFn: crpcClient.pendings.dismiss.dismiss.mutate,
    mutationKey: crpc.pendings.dismiss.dismiss.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível esconder a pendência. Tente novamente."
        ),
        id: "pending-dismiss-error",
        label: "Falha ao esconder",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        crpc.pendings.list.list.queryFilter()
      );
    },
  });

  const runAction = (resolution: PendingActionResolution | null) => {
    if (!resolution) {
      return;
    }

    switch (resolution.kind) {
      case "navigate":
        // O deep-link é do SERVIDOR: o cliente só repassa `route` + `params`.
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
      case "approve_membership":
        approveMembership.mutate({
          leagueId: resolution.leagueId,
          membershipId: resolution.membershipId,
        });
        return;
      case "reject_membership":
        rejectMembership.mutate({
          leagueId: resolution.leagueId,
          membershipId: resolution.membershipId,
        });
        return;
      case "approve_entry":
        approveEntry.mutate({ entryId: resolution.entryId });
        return;
      case "reject_entry":
        rejectEntry.mutate({ entryId: resolution.entryId });
        return;
      case "accept_challenge_proposal":
        acceptChallengeProposal.mutate({
          challengeId: resolution.challengeId,
        });
        return;
      case "decline_challenge_proposal":
        declineChallengeProposal.mutate({
          challengeId: resolution.challengeId,
        });
        return;
      case "accept_challenge_cancellation":
        respondCancellation.mutate({
          action: "accept",
          challengeId: resolution.challengeId,
        });
        return;
      case "decline_challenge_cancellation":
        respondCancellation.mutate({
          action: "reject",
          challengeId: resolution.challengeId,
        });
        return;
      case "confirm_challenge_result":
        confirmResult.mutate({ challengeId: resolution.challengeId });
        return;
      default:
        return;
    }
  };

  const isActionPending = (
    resolution: PendingActionResolution | null
  ): boolean => {
    switch (resolution?.kind) {
      case "pay_entry":
      case "pay_membership":
        return createCharge.isPending;
      case "respond_invite":
        return respondPartnerInvite.isPending;
      case "approve_membership":
        return approveMembership.isPending;
      case "reject_membership":
        return rejectMembership.isPending;
      case "approve_entry":
        return approveEntry.isPending;
      case "reject_entry":
        return rejectEntry.isPending;
      case "accept_challenge_proposal":
        return acceptChallengeProposal.isPending;
      case "decline_challenge_proposal":
        return declineChallengeProposal.isPending;
      case "accept_challenge_cancellation":
      case "decline_challenge_cancellation":
        return respondCancellation.isPending;
      case "confirm_challenge_result":
        return confirmResult.isPending;
      default:
        return false;
    }
  };

  return {
    dismissPendingItem,
    isActionPending,
    runAction,
  };
}
