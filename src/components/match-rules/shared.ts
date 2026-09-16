import type { LeagueMatchConfig } from "@convex/domains/league/contract";
import { getSelectedOption } from "@/lib/collections";
import type { InfoContent } from "@/components/ui/info-dialog";

type MatchConfig = LeagueMatchConfig;

type RuleSectionProps = {
  isDisabled?: boolean;
  /** RHF path prefix of the matchConfig object (e.g. "matchConfig" or "ruleConfig.matchConfig"). */
  prefix: string;
};

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

const MATCH_RULE_INFO = {
  bestOfSets: {
    description:
      "Define o formato da partida. O vencedor é quem atingir a maioria dos sets. Melhor de 3 exige vencer 2 sets; Melhor de 5 exige vencer 3.",
    title: "Melhor de quantos sets?",
  },
  defaultDurationMinutes: {
    description:
      "Tempo sugerido automaticamente quando uma partida é marcada na agenda. Serve apenas como referência inicial e pode ser ajustado caso a caso.",
    title: "Duração padrão da partida",
  },
  gamesPerSet: {
    description:
      "Quantidade de games necessários para vencer cada set. O padrão do tênis é 6, com diferença mínima de 2.",
    title: "Quantos games por set?",
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
      "Define se os sets usam tie-break para desempate. Ao ativar, escolha quantos pontos valem a decisão e se exige diferença de 2. O tie-break entra quando o set chega em games-a-games.",
    title: "Tie-break",
  },
} satisfies Record<string, InfoContent>;

export { MATCH_RULE_INFO, getSelectedOption, scoringModeOptions };
export type { MatchConfig, RuleSectionProps };
