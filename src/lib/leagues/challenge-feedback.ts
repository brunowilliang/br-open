export type CreateChallengeToastPayload = {
  description: string;
  id: string;
  label: string;
  variant: "danger";
};

export type ManageChallengeAction =
  | "cancel"
  | "invalidate"
  | "reopen_challenge"
  | "reopen_result";

export type ManageChallengeToastPayload = {
  description: string;
  id: string;
  label: string;
  variant: "danger" | "success";
};

export function getCreateChallengeErrorToast(
  message?: string
): CreateChallengeToastPayload {
  if (message?.includes("O adversário já atingiu o limite")) {
    return {
      description:
        "Esse jogador já tem o máximo de desafios ativos nesta liga.",
      id: "create-challenge-opponent-limit-error",
      label: "Adversário indisponível",
      variant: "danger",
    };
  }

  if (message?.includes("limite mensal de desafios")) {
    return {
      description:
        "Você já usou todos os seus desafios neste mês. O contador renova no próximo ciclo.",
      id: "create-challenge-monthly-limit-error",
      label: "Limite mensal atingido",
      variant: "danger",
    };
  }

  if (message?.includes("limite de desafios ativos")) {
    return {
      description:
        "Você já tem o máximo de desafios em andamento. Conclua um para criar outro.",
      id: "create-challenge-active-limit-error",
      label: "Limite de desafios ativos",
      variant: "danger",
    };
  }

  return {
    description:
      message || "Não foi possível enviar o desafio. Tente novamente.",
    id: "create-challenge-error",
    label: "Falha ao criar desafio",
    variant: "danger",
  };
}

export function getAdminManageChallengeSuccessToast(input: {
  action: ManageChallengeAction;
}): ManageChallengeToastPayload {
  switch (input.action) {
    case "cancel":
      return {
        description: "O cancelamento foi aplicado pelo organizador.",
        id: "admin-manage-challenge-cancel-success",
        label: "Desafio cancelado",
        variant: "success",
      };
    case "invalidate":
      return {
        description: "A invalidação foi aplicada pelo organizador.",
        id: "admin-manage-challenge-invalidate-success",
        label: "Desafio invalidado",
        variant: "success",
      };
    case "reopen_challenge":
      return {
        description: "O desafio está disponível novamente.",
        id: "admin-manage-challenge-reopen-challenge-success",
        label: "Desafio reaberto",
        variant: "success",
      };
    default:
      return {
        description: "O resultado pode ser editado novamente.",
        id: "admin-manage-challenge-reopen-result-success",
        label: "Resultado reaberto",
        variant: "success",
      };
  }
}

export function getAdminManageChallengeErrorToast(input: {
  action: ManageChallengeAction;
  message?: string;
}): ManageChallengeToastPayload {
  switch (input.action) {
    case "cancel":
      return {
        description:
          input.message ||
          "Não foi possível cancelar o desafio. Tente novamente.",
        id: "admin-manage-challenge-cancel-error",
        label: "Falha ao cancelar desafio",
        variant: "danger",
      };
    case "invalidate":
      return {
        description:
          input.message ||
          "Não foi possível invalidar o desafio. Tente novamente.",
        id: "admin-manage-challenge-invalidate-error",
        label: "Falha ao invalidar desafio",
        variant: "danger",
      };
    case "reopen_challenge":
      return {
        description:
          input.message ||
          "Não foi possível reabrir o desafio. Tente novamente.",
        id: "admin-manage-challenge-reopen-challenge-error",
        label: "Falha ao reabrir desafio",
        variant: "danger",
      };
    default:
      return {
        description:
          input.message ||
          "Não foi possível reabrir o resultado. Tente novamente.",
        id: "admin-manage-challenge-reopen-result-error",
        label: "Falha ao reabrir resultado",
        variant: "danger",
      };
  }
}
