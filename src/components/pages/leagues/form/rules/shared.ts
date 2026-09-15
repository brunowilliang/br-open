import { getSelectedOption } from "@/lib/collections";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import type { InfoContent } from "@/components/ui/info-dialog";

type RuleConfig = LeagueScreenValues["ruleConfig"];

type RuleSectionProps = {
  isDisabled?: boolean;
};

const validationModeOptions = [
  {
    label: "Automática",
    value: "automatic" as const,
  },
  {
    label: "Manual",
    value: "manual" as const,
  },
] as const;

const CHALLENGE_RULE_INFO: Record<string, InfoContent> = {
  maxActiveChallengesPerPlayer: {
    description:
      "Limita quantos desafios cada jogador pode manter em aberto ao mesmo tempo. Com valor 1, ele precisa concluir um desafio antes de abrir o próximo.",
    title: "Máx. desafios ativos por jogador?",
  },
  maxChallengeDistance: {
    description:
      "Define o alcance no ranking que um jogador pode desafiar. Com valor 2, por exemplo, ele só pode desafiar jogadores até 2 posições acima da sua. Quanto menor o número, mais difícil subir.",
    title: "Pode desafiar quantas posições acima?",
  },
  maxChallengesPerMonth: {
    description:
      "Limita o total de desafios que cada jogador pode abrir durante o mês. Ao atingir o limite, ele precisa esperar o próximo mês para desafiar de novo.",
    title: "Máx. desafios por mês?",
  },
  responseDeadlineHours: {
    description:
      "Tempo que o adversário tem para aceitar ou recusar um desafio. Se não responder dentro do prazo, o desafio vence automaticamente.",
    title: "Prazo para responder desafio",
  },
};

const RULE_INFO = {
  challengeValidation: {
    description:
      "Define quem precisa confirmar o desafio para ele valer. Em Automático, basta os dois jogadores combinarem. Em modo manual, o organizador da liga precisa aprovar antes de o desafio ser válido.",
    title: "Validação do desafio",
  },
  inactivityPenalty: {
    description:
      "Pune jogadores que ficam muito tempo sem jogar. Ao ativar, defina o tipo de punição (ex.: cair posições) e após quantos dias sem partidas ela passa a valer.",
    title: "Penalidade por inatividade",
  },
  lossBehavior: {
    description:
      "Define o que acontece com o desafiante quando ele perde. Continua na mesma posição mantém o ranking intacto. Cai 1 posição faz o desafiante descer uma casa.",
    title: "Derrota no desafio",
  },
  newPlayerPlacement: {
    description:
      "Define em qual posição do ranking um novo jogador entra na liga. Final da fila coloca o jogador na última posição, fazendo ele subir desafio a desafio.",
    title: "Entrada de novo jogador",
  },
  resultValidation: {
    description:
      "Define quem precisa confirmar o resultado para ele valer. Em Automático, basta os dois jogadores marcarem o resultado. Em modo manual, o organizador precisa aprovar antes de atualizar o ranking.",
    title: "Validação do resultado",
  },
  walkoverBehavior: {
    description:
      "Define a consequência quando um jogador não comparece ao desafio marcado. Pode ser derrota automática, derrota e ida para o final do ranking, ou cancelamento do desafio.",
    title: "W.O",
  },
  winBehavior: {
    description:
      "Define o que acontece com as posições quando o desafiante vence. Assume a posição do adversário faz os dois trocarem de lugar. Sobe 1 posição faz o desafiante subir apenas uma casa.",
    title: "Vitória no desafio",
  },
} satisfies Record<string, InfoContent>;

export {
  CHALLENGE_RULE_INFO,
  RULE_INFO,
  getSelectedOption,
  validationModeOptions,
};
export type { RuleConfig, RuleSectionProps };
