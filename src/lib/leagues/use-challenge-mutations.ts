import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { useToast } from "heroui-native";

import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  getAdminManageChallengeErrorToast,
  getAdminManageChallengeSuccessToast,
  getCreateChallengeErrorToast,
} from "@/lib/leagues/challenge-feedback";
import type { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";

type UseChallengeMutationsInput = {
  leagueId: string;
  bucket$: ReturnType<typeof getLeagueDetailsBucket$>;
  toast: ReturnType<typeof useToast>["toast"];
};

export function useChallengeMutations(input: UseChallengeMutationsInput) {
  const { leagueId, bucket$, toast } = input;
  const queryClient = useQueryClient();
  const crpc = useCRPC();

  async function invalidateLeagueContext() {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.league.discovery.getById.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.membership.getOverview.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listForLeague.queryFilter({ leagueId })
      ),
      queryClient.invalidateQueries(
        crpc.league.challenges.listOccupiedSlots.queryFilter({ leagueId })
      ),
    ]);
  }

  const createChallenge = useMutation(
    crpc.league.challenges.create.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        bucket$.actions.setChallengeCreateTarget(null);
        toast.show({
          description: "Desafio enviado com sucesso.",
          id: "create-challenge-success",
          label: "Desafio criado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show(
          getCreateChallengeErrorToast(
            getToastErrorMessage(error, "Não foi possível criar o desafio.")
          )
        );
      },
    })
  );
  const acceptChallengeProposal = useMutation(
    crpc.league.challenges.acceptProposal.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Proposta aceita com sucesso.",
          id: "accept-challenge-proposal-success",
          label: "Desafio aceito",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível aceitar a proposta."
          ),
          id: "accept-challenge-proposal-error",
          label: "Erro ao aceitar desafio",
          variant: "danger",
        });
      },
    })
  );
  const declineChallengeProposal = useMutation(
    crpc.league.challenges.declineProposal.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Proposta recusada com sucesso.",
          id: "decline-challenge-proposal-success",
          label: "Desafio recusado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível recusar a proposta."
          ),
          id: "decline-challenge-proposal-error",
          label: "Erro ao recusar desafio",
          variant: "danger",
        });
      },
    })
  );
  const counterProposeChallenge = useMutation(
    crpc.league.challenges.counterPropose.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Contraproposta enviada com sucesso.",
          id: "counter-propose-challenge-success",
          label: "Contraproposta enviada",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível reenviar a proposta."
          ),
          id: "counter-propose-challenge-error",
          label: "Erro ao reenviar proposta",
          variant: "danger",
        });
      },
    })
  );
  const cancelChallenge = useMutation(
    crpc.league.challenges.cancel.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Desafio cancelado com sucesso.",
          id: "cancel-challenge-success",
          label: "Desafio cancelado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível cancelar o desafio."
          ),
          id: "cancel-challenge-error",
          label: "Erro ao cancelar desafio",
          variant: "danger",
        });
      },
    })
  );
  const requestChallengeCancellation = useMutation(
    crpc.league.challenges.requestCancellation.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Solicitação de cancelamento enviada com sucesso.",
          id: "request-challenge-cancellation-success",
          label: "Cancelamento solicitado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível solicitar o cancelamento da partida."
          ),
          id: "request-challenge-cancellation-error",
          label: "Erro ao solicitar cancelamento",
          variant: "danger",
        });
      },
    })
  );
  const respondChallengeCancellation = useMutation(
    crpc.league.challenges.respondCancellationRequest.mutationOptions({
      onSuccess: async (_, variables) => {
        await invalidateLeagueContext();
        toast.show({
          description:
            variables.action === "accept"
              ? "Cancelamento aceito com sucesso."
              : "Cancelamento recusado com sucesso.",
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
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível responder à solicitação de cancelamento."
          ),
          id: "respond-challenge-cancellation-error",
          label: "Erro ao responder cancelamento",
          variant: "danger",
        });
      },
    })
  );
  const submitChallengeResult = useMutation(
    crpc.league.challenges.submitResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Placar enviado com sucesso.",
          id: "submit-challenge-result-success",
          label: "Placar enviado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível enviar o placar."
          ),
          id: "submit-challenge-result-error",
          label: "Erro ao enviar placar",
          variant: "danger",
        });
      },
    })
  );
  const confirmChallengeResult = useMutation(
    crpc.league.challenges.confirmResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Placar confirmado com sucesso.",
          id: "confirm-challenge-result-success",
          label: "Placar confirmado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível confirmar o placar."
          ),
          id: "confirm-challenge-result-error",
          label: "Erro ao confirmar placar",
          variant: "danger",
        });
      },
    })
  );
  const reviewChallenge = useMutation(
    crpc.league.challenges.reviewChallenge.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Validação do desafio atualizada com sucesso.",
          id: "review-challenge-success",
          label: "Desafio validado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível validar o desafio."
          ),
          id: "review-challenge-error",
          label: "Erro ao validar desafio",
          variant: "danger",
        });
      },
    })
  );
  const reviewChallengeResult = useMutation(
    crpc.league.challenges.reviewResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Validação do resultado atualizada com sucesso.",
          id: "review-challenge-result-success",
          label: "Resultado validado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível validar o resultado."
          ),
          id: "review-challenge-result-error",
          label: "Erro ao validar resultado",
          variant: "danger",
        });
      },
    })
  );
  const organizerManageChallenge = useMutation(
    crpc.league.challenges.organizerManage.mutationOptions({
      onSuccess: async (_, variables) => {
        await invalidateLeagueContext();
        toast.show(getAdminManageChallengeSuccessToast(variables));
      },
      onError: (error, variables) => {
        toast.show(
          getAdminManageChallengeErrorToast({
            action: variables.action,
            message: getToastErrorMessage(
              error,
              "Não foi possível aplicar a ação."
            ),
          })
        );
      },
    })
  );
  const organizerSubmitChallengeResult = useMutation(
    crpc.league.challenges.organizerSubmitResult.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Placar salvo e ranking atualizado.",
          id: "organizer-submit-challenge-result-success",
          label: "Placar atualizado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível salvar o placar pelo organizador."
          ),
          id: "organizer-submit-challenge-result-error",
          label: "Erro ao salvar placar",
          variant: "danger",
        });
      },
    })
  );

  const organizerRequestResultReminder = useMutation(
    crpc.league.challenges.organizerRequestResultReminder.mutationOptions({
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description:
            "Os jogadores foram notificados para registrar o placar.",
          id: "admin-request-result-reminder-success",
          label: "Lembrete enviado",
          variant: "success",
        });
      },
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível enviar o lembrete."
          ),
          id: "admin-request-result-reminder-error",
          label: "Erro ao enviar lembrete",
          variant: "danger",
        });
      },
    })
  );

  const isPending =
    createChallenge.isPending ||
    acceptChallengeProposal.isPending ||
    declineChallengeProposal.isPending ||
    counterProposeChallenge.isPending ||
    cancelChallenge.isPending ||
    requestChallengeCancellation.isPending ||
    respondChallengeCancellation.isPending ||
    submitChallengeResult.isPending ||
    confirmChallengeResult.isPending ||
    reviewChallenge.isPending ||
    reviewChallengeResult.isPending ||
    organizerManageChallenge.isPending ||
    organizerSubmitChallengeResult.isPending ||
    organizerRequestResultReminder.isPending;

  return {
    createChallenge,
    acceptChallengeProposal,
    declineChallengeProposal,
    counterProposeChallenge,
    cancelChallenge,
    requestChallengeCancellation,
    respondChallengeCancellation,
    submitChallengeResult,
    confirmChallengeResult,
    reviewChallenge,
    reviewChallengeResult,
    organizerManageChallenge,
    organizerSubmitChallengeResult,
    organizerRequestResultReminder,
    isPending,
    invalidateLeagueContext,
  };
}
