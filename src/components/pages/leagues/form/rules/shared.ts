import { getSelectedOption } from "@/lib/collections";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import type { RuleInfo } from "@/components/pages/leagues/rule-card";

type RuleConfig = LeagueScreenValues["ruleConfig"];
type MatchConfig = RuleConfig["matchConfig"];

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

const scoringModeOptions = [
  {
    label: "Com vantagem",
    value: "advantage" as const,
  },
  {
    label: "Sem vantagem",
    value: "no_advantage" as const,
  },
];

const CHALLENGE_RULE_INFO: Record<string, RuleInfo> = {
  maxChallengeDistance: {
    description:
      "Define o alcance no ranking que um jogador pode desafiar. Com valor 2, por exemplo, ele só pode desafiar jogadores até 2 posições acima da sua. Quanto menor o número, mais difícil subir.",
    title: "Pode desafiar quantas posições acima?",
  },
  maxActiveChallengesPerPlayer: {
    description:
      "Limita quantos desafios cada jogador pode manter em aberto ao mesmo tempo. Com valor 1, ele precisa concluir um desafio antes de abrir o próximo.",
    title: "Máx. desafios ativos por jogador?",
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
  winBehavior: {
    description:
      "Define o que acontece com as posições quando o desafiante vence. Assume a posição do adversário faz os dois trocarem de lugar. Sobe 1 posição faz o desafiante subir apenas uma casa.",
    title: "Vitória no desafio",
  },
  lossBehavior: {
    description:
      "Define o que acontece com o desafiante quando ele perde. Continua na mesma posição mantém o ranking intacto. Cai 1 posição faz o desafiante descer uma casa.",
    title: "Derrota no desafio",
  },
  walkoverBehavior: {
    description:
      "Define a consequência quando um jogador não comparece ao desafio marcado. Pode ser derrota automática, derrota e ida para o final do ranking, ou cancelamento do desafio.",
    title: "W.O",
  },
  resultValidation: {
    description:
      "Define quem precisa confirmar o resultado para ele valer. Em Automático, basta os dois jogadores marcarem o placar. Em modo manual, o organizador precisa aprovar antes de atualizar o ranking.",
    title: "Validação do resultado",
  },
  newPlayerPlacement: {
    description:
      "Define em qual posição do ranking um novo jogador entra na liga. Final da fila coloca o jogador na última posição, fazendo ele subir desafio a desafio.",
    title: "Entrada de novo jogador",
  },
  inactivityPenalty: {
    description:
      "Pune jogadores que ficam muito tempo sem jogar. Ao ativar, defina o tipo de punição (ex.: cair posições) e após quantos dias sem partidas ela passa a valer.",
    title: "Penalidade por inatividade",
  },
  bestOfSets: {
    description:
      "Define o formato da partida. O vencedor é quem atingir a maioria dos sets. Melhor de 3 exige vencer 2 sets; Melhor de 5 exige vencer 3.",
    title: "Melhor de quantos sets?",
  },
  gamesPerSet: {
    description:
      "Quantidade de games necessários para vencer cada set. O padrão do tênis é 6, com diferença mínima de 2.",
    title: "Quantos games por set?",
  },
  defaultDurationMinutes: {
    description:
      "Tempo sugerido automaticamente quando uma partida é marcada na agenda. Serve apenas como referência inicial e pode ser ajustado caso a caso.",
    title: "Duração padrão da partida",
  },
  scoringMode: {
    description:
      "Define a regra de pontuação dentro de cada game. Vantagem é a regra tradicional do tênis. Sem vantagem (no-ad) acelera: no 40-40 o próximo ponto decide o game.",
    title: "Pontuação dos games",
  },
  setMustWinByTwoGames: {
    description:
      "Exige diferença mínima de 2 games para fechar o set. No 5-5, por exemplo, o set continua até alguém abrir 2 games ou entrar o tie-break.",
    title: "Vencer o set por 2 games",
  },
  tieBreak: {
    description:
      "Define se os sets usam tie-break para desempate. Ao ativar, configure em qual placar o tie-break entra, quantos pontos e se exige diferença de 2.",
    title: "Tie-break",
  },
  finalSetMode: {
    description:
      "Define como o último set é disputado. Pode seguir as mesmas regras dos demais, ter regras próprias, ou ser decidido por um super tie-break.",
    title: "Formato do último set",
  },
} satisfies Record<string, RuleInfo>;

export {
  CHALLENGE_RULE_INFO,
  RULE_INFO,
  getSelectedOption,
  scoringModeOptions,
  validationModeOptions,
};
export type { MatchConfig, RuleConfig, RuleSectionProps };
