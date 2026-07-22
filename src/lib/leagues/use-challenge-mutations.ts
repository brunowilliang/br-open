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
      onError: (error) => {
        toast.show(
          getCreateChallengeErrorToast(
            getToastErrorMessage(error, "Não foi possível criar o desafio.")
          )
        );
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        bucket$.actions.setChallengeCreateTarget(null);
        toast.show({
          description:
            "Seu adversário foi notificado e pode responder a qualquer momento.",
          id: "create-challenge-success",
          label: "Desafio enviado",
          variant: "success",
        });
      },
    })
  );
  const acceptChallengeProposal = useMutation(
    crpc.league.challenges.acceptProposal.mutationOptions({
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
        await invalidateLeagueContext();
        toast.show({
          description: "A partida está confirmada.",
          id: "accept-challenge-proposal-success",
          label: "Desafio aceito",
          variant: "success",
        });
      },
    })
  );
  const declineChallengeProposal = useMutation(
    crpc.league.challenges.declineProposal.mutationOptions({
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
        await invalidateLeagueContext();
        toast.show({
          description: "A proposta foi recusada.",
          id: "decline-challenge-proposal-success",
          label: "Desafio recusado",
          variant: "success",
        });
      },
    })
  );
  const counterProposeChallenge = useMutation(
    crpc.league.challenges.counterPropose.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível enviar a contraproposta. Tente novamente."
          ),
          id: "counter-propose-challenge-error",
          label: "Falha ao enviar contraproposta",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description:
            "Seu adversário pode aceitar ou recusar a nova proposta.",
          id: "counter-propose-challenge-success",
          label: "Contraproposta enviada",
          variant: "success",
        });
      },
    })
  );
  const cancelChallenge = useMutation(
    crpc.league.challenges.cancel.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível cancelar o desafio. Tente novamente."
          ),
          id: "cancel-challenge-error",
          label: "Falha ao cancelar",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "A partida foi cancelada.",
          id: "cancel-challenge-success",
          label: "Desafio cancelado",
          variant: "success",
        });
      },
    })
  );
  const requestChallengeCancellation = useMutation(
    crpc.league.challenges.requestCancellation.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível solicitar o cancelamento. Tente novamente."
          ),
          id: "request-challenge-cancellation-error",
          label: "Falha ao solicitar cancelamento",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description:
            "Seu adversário será notificado para aceitar ou recusar.",
          id: "request-challenge-cancellation-success",
          label: "Cancelamento solicitado",
          variant: "success",
        });
      },
    })
  );
  const respondChallengeCancellation = useMutation(
    crpc.league.challenges.respondCancellationRequest.mutationOptions({
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
        await invalidateLeagueContext();
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
    })
  );
  const submitChallengeResult = useMutation(
    crpc.league.challenges.submitResult.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível registrar o placar. Tente novamente."
          ),
          id: "submit-challenge-result-error",
          label: "Falha ao enviar placar",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "Aguardando confirmação do adversário.",
          id: "submit-challenge-result-success",
          label: "Placar enviado",
          variant: "success",
        });
      },
    })
  );
  const confirmChallengeResult = useMutation(
    crpc.league.challenges.confirmResult.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível confirmar o placar. Tente novamente."
          ),
          id: "confirm-challenge-result-error",
          label: "Falha ao confirmar placar",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "O resultado foi registrado no ranking.",
          id: "confirm-challenge-result-success",
          label: "Placar confirmado",
          variant: "success",
        });
      },
    })
  );
  const reviewChallenge = useMutation(
    crpc.league.challenges.reviewChallenge.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar a validação. Tente novamente."
          ),
          id: "review-challenge-error",
          label: "Falha ao validar desafio",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "O status do desafio foi atualizado.",
          id: "review-challenge-success",
          label: "Validação atualizada",
          variant: "success",
        });
      },
    })
  );
  const reviewChallengeResult = useMutation(
    crpc.league.challenges.reviewResult.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível atualizar a validação. Tente novamente."
          ),
          id: "review-challenge-result-error",
          label: "Falha ao validar resultado",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "O status do resultado foi atualizado.",
          id: "review-challenge-result-success",
          label: "Resultado validado",
          variant: "success",
        });
      },
    })
  );
  const organizerManageChallenge = useMutation(
    crpc.league.challenges.organizerManage.mutationOptions({
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
      onSuccess: async (_, variables) => {
        await invalidateLeagueContext();
        toast.show(getAdminManageChallengeSuccessToast(variables));
      },
    })
  );
  const organizerSubmitChallengeResult = useMutation(
    crpc.league.challenges.organizerSubmitResult.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível registrar o placar. Tente novamente."
          ),
          id: "organizer-submit-challenge-result-error",
          label: "Falha ao salvar placar",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description: "O placar foi salvo e o ranking foi atualizado.",
          id: "organizer-submit-challenge-result-success",
          label: "Placar registrado",
          variant: "success",
        });
      },
    })
  );

  const organizerRequestResultReminder = useMutation(
    crpc.league.challenges.organizerRequestResultReminder.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível enviar o lembrete. Tente novamente."
          ),
          id: "admin-request-result-reminder-error",
          label: "Falha ao enviar lembrete",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        await invalidateLeagueContext();
        toast.show({
          description:
            "Os jogadores receberam a notificação para registrar o placar.",
          id: "admin-request-result-reminder-success",
          label: "Lembrete enviado",
          variant: "success",
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
    acceptChallengeProposal,
    cancelChallenge,
    confirmChallengeResult,
    counterProposeChallenge,
    createChallenge,
    declineChallengeProposal,
    invalidateLeagueContext,
    isPending,
    organizerManageChallenge,
    organizerRequestResultReminder,
    organizerSubmitChallengeResult,
    requestChallengeCancellation,
    respondChallengeCancellation,
    reviewChallenge,
    reviewChallengeResult,
    submitChallengeResult,
  };
}
