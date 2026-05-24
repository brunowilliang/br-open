export type CreateChallengeToastPayload = {
  description: string;
  id: string;
  label: string;
  variant: "danger";
};

export function getCreateChallengeErrorToast(
  message?: string
): CreateChallengeToastPayload {
  if (message?.includes("O adversário já atingiu o limite")) {
    return {
      description:
        "Esse jogador já atingiu o limite de desafios em andamento nessa liga.",
      id: "create-challenge-opponent-limit-error",
      label: "Adversário indisponível",
      variant: "danger",
    };
  }

  if (message?.includes("limite mensal de desafios")) {
    return {
      description:
        "Você já atingiu o limite de desafios disponíveis para este mês.",
      id: "create-challenge-monthly-limit-error",
      label: "Limite mensal atingido",
      variant: "danger",
    };
  }

  if (message?.includes("limite de desafios ativos")) {
    return {
      description:
        "Você já está com o máximo de desafios ativos permitido nessa liga.",
      id: "create-challenge-active-limit-error",
      label: "Limite de desafios ativos",
      variant: "danger",
    };
  }

  return {
    description: message || "Não foi possível criar o desafio.",
    id: "create-challenge-error",
    label: "Erro ao criar desafio",
    variant: "danger",
  };
}
