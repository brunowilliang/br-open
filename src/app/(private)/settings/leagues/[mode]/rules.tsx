import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Description,
  FieldError,
  Label,
  Menu,
  Select,
  Tabs,
  TextField,
} from "heroui-native";
import { NumberStepper, Segment } from "heroui-native-pro";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import {
  type RuleInfo,
  RuleCard,
  RuleExpandableContent,
  RuleToggleRow,
  ToggleableRuleCard,
  fieldUpdateOptions,
} from "@/components/pages/leagues/rule-card";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { useLeagueFormRoute } from "@/lib/leagues/league-form-store";

type RuleConfig = LeagueScreenValues["ruleConfig"];
type MatchConfig = RuleConfig["matchConfig"];

const winBehaviorOptions = [
  {
    label: "Assume a posição do adversário",
    value: "take_opponent_position" as const,
  },
  {
    label: "Sobe 1 posição",
    value: "climb_one_position" as const,
  },
];

const lossBehaviorOptions = [
  {
    label: "Continua na mesma posição",
    value: "stay_put" as const,
  },
  {
    label: "Cai 1 posição",
    value: "drop_one_position" as const,
  },
];

const walkoverBehaviorOptions = [
  {
    label: "Derrota automática",
    value: "automatic_loss" as const,
  },
  {
    label: "Derrota automática e vai para o final do ranking",
    value: "automatic_loss_and_move_to_end" as const,
  },
  {
    label: "Desafio cancelado",
    value: "cancel_challenge" as const,
  },
];

const newPlayerPlacementOptions = [
  {
    label: "Final da fila",
    value: "end_of_ranking" as const,
  },
];

const inactivityPenaltyTypeOptions = [
  {
    label: "Cai 1 posição",
    value: "drop_one_position" as const,
  },
  {
    label: "Vai para o final do ranking",
    value: "move_to_ranking_end" as const,
  },
];

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

const finalSetModeOptions = [
  {
    label: "Igual aos anteriores",
    value: "same_as_previous" as const,
  },
  {
    label: "Set personalizado",
    value: "custom_set" as const,
  },
  {
    label: "Super tie-break",
    value: "super_tiebreak" as const,
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
      "Define quem precisa confirmar o desafio para ele valer. Em Automático, basta os dois jogadores combinarem. Em Admin, o administrador da liga precisa aprovar antes de o desafio ser válido.",
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
      "Define quem precisa confirmar o resultado para ele valer. Em Automático, basta os dois jogadores marcarem o placar. Em Admin, o administrador precisa aprovar antes de atualizar o ranking.",
    title: "Validação do resultado",
  },
  newPlayerPlacement: {
    description:
      "Define em qual posição do ranking um novo participante entra na liga. Final da fila coloca o jogador na última posição, fazendo ele subir desafio a desafio.",
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

function getSelectedOption<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string | undefined
) {
  if (!value) {
    return;
  }

  return options.find((option) => option.value === value);
}

type RuleSectionProps = {
  isDisabled?: boolean;
};

const ChallengeRulesSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.maxChallengeDistance",
      "ruleConfig.maxActiveChallengesPerPlayer",
      "ruleConfig.maxChallengesPerMonth",
      "ruleConfig.responseDeadlineHours",
      "ruleConfig.challengeValidationMode",
    ],
  });
  const [
    maxChallengeDistance,
    maxActiveChallengesPerPlayer,
    maxChallengesPerMonth,
    responseDeadlineHours,
    challengeValidationMode,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.maxChallengeDistance",
      "ruleConfig.maxActiveChallengesPerPlayer",
      "ruleConfig.maxChallengesPerMonth",
      "ruleConfig.responseDeadlineHours",
      "ruleConfig.challengeValidationMode",
    ],
  });

  return (
    <>
      <ToggleableRuleCard
        description="Ative para definir quantas posições acima um jogador pode desafiar."
        enabled={maxChallengeDistance.enabled}
        info={CHALLENGE_RULE_INFO.maxChallengeDistance}
        isDisabled={isDisabled}
        label="Pode desafiar quantas posições acima?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxChallengeDistance.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.maxChallengeDistance?.value)}
          isRequired
        >
          <NumberStepper
            className="self-start"
            defaultValue={maxChallengeDistance.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxChallengeDistance.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxChallengeDistance.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxChallengeDistance?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <ToggleableRuleCard
        description="Ative para limitar quantos desafios em aberto cada jogador pode ter."
        enabled={maxActiveChallengesPerPlayer.enabled}
        info={CHALLENGE_RULE_INFO.maxActiveChallengesPerPlayer}
        isDisabled={isDisabled}
        label="Máx. desafios ativos por jogador?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxActiveChallengesPerPlayer.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(
            errors.ruleConfig?.maxActiveChallengesPerPlayer?.value
          )}
          isRequired
        >
          <NumberStepper
            className="self-start"
            defaultValue={maxActiveChallengesPerPlayer.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxActiveChallengesPerPlayer.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxActiveChallengesPerPlayer.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxActiveChallengesPerPlayer?.value?.message ??
              ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <ToggleableRuleCard
        description="Ative para limitar quantos desafios cada jogador pode abrir por mês."
        enabled={maxChallengesPerMonth.enabled}
        info={CHALLENGE_RULE_INFO.maxChallengesPerMonth}
        isDisabled={isDisabled}
        label="Máx. desafios por mês?"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.maxChallengesPerMonth.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.maxChallengesPerMonth?.value)}
          isRequired
        >
          <NumberStepper
            className="self-start"
            defaultValue={maxChallengesPerMonth.value}
            isDisabled={isDisabled}
            maxValue={100}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.maxChallengesPerMonth.value",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={maxChallengesPerMonth.value}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.maxChallengesPerMonth?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <ToggleableRuleCard
        description="Ative para definir um prazo para o adversário responder o desafio."
        enabled={responseDeadlineHours.enabled}
        info={CHALLENGE_RULE_INFO.responseDeadlineHours}
        isDisabled={isDisabled}
        label="Prazo para responder desafio"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.responseDeadlineHours.enabled",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      >
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.responseDeadlineHours?.value)}
          isRequired
        >
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.responseDeadlineHours.value",
                Number(nextValue),
                fieldUpdateOptions
              );
            }}
            value={String(responseDeadlineHours.value)}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                <Segment.Item value="12">
                  <Segment.Label>12 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="24">
                  <Segment.Label>24 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="48">
                  <Segment.Label>48 horas</Segment.Label>
                </Segment.Item>
                <Segment.Item value="72">
                  <Segment.Label>3 dias</Segment.Label>
                </Segment.Item>
                <Segment.Item value="120">
                  <Segment.Label>5 dias</Segment.Label>
                </Segment.Item>
                <Segment.Item value="168">
                  <Segment.Label>7 dias</Segment.Label>
                </Segment.Item>
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.responseDeadlineHours?.value?.message ?? ""}
          </FieldError>
        </TextField>
      </ToggleableRuleCard>

      <RuleCard info={RULE_INFO.challengeValidation}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.challengeValidationMode)}
          isRequired
        >
          <Label>Validação do desafio</Label>
          <Description className="-mt-1.5 mb-1">
            Define se o desafio confirmado entre os jogadores já vale ou precisa
            da aprovação do admin.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.challengeValidationMode",
                nextValue as RuleConfig["challengeValidationMode"],
                fieldUpdateOptions
              );
            }}
            value={challengeValidationMode}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                {validationModeOptions.map((option) => (
                  <Segment.Item key={option.value} value={option.value}>
                    <Segment.Label>{option.label}</Segment.Label>
                  </Segment.Item>
                ))}
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.challengeValidationMode?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>
    </>
  );
};

const ResultRulesSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.winBehavior",
      "ruleConfig.lossBehavior",
      "ruleConfig.walkoverBehavior",
      "ruleConfig.resultValidationMode",
    ],
  });
  const [winBehavior, lossBehavior, walkoverBehavior, resultValidationMode] =
    useWatch({
      control,
      name: [
        "ruleConfig.winBehavior",
        "ruleConfig.lossBehavior",
        "ruleConfig.walkoverBehavior",
        "ruleConfig.resultValidationMode",
      ],
    });

  return (
    <>
      <RuleCard info={RULE_INFO.winBehavior}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.winBehavior)}
          isRequired
        >
          <Label>Vitória no desafio</Label>
          <Description className="-mt-1.5 mb-1">
            Define como o ranking muda quando o desafiante vence.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.winBehavior",
                  nextValue.value as RuleConfig["winBehavior"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(winBehaviorOptions, winBehavior)}
          >
            <Select.Trigger className="bg-surface-secondary">
              <Select.Value
                className="font-normal"
                numberOfLines={1}
                placeholder="Escolha uma opção"
              />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {winBehaviorOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <FieldError>
            {errors.ruleConfig?.winBehavior?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.lossBehavior}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.lossBehavior)}
          isRequired
        >
          <Label>Derrota no desafio</Label>
          <Description className="-mt-1.5 mb-1">
            Define como o ranking muda quando o desafiante perde.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.lossBehavior",
                  nextValue.value as RuleConfig["lossBehavior"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(lossBehaviorOptions, lossBehavior)}
          >
            <Select.Trigger className="bg-surface-secondary">
              <Select.Value
                className="font-normal"
                numberOfLines={1}
                placeholder="Escolha uma opção"
              />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {lossBehaviorOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <FieldError>
            {errors.ruleConfig?.lossBehavior?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.walkoverBehavior}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.walkoverBehavior)}
          isRequired
        >
          <Label>W.O</Label>
          <Description className="-mt-1.5 mb-1">
            Define o que acontece quando um jogador não comparece ao desafio.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.walkoverBehavior",
                  nextValue.value as RuleConfig["walkoverBehavior"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(walkoverBehaviorOptions, walkoverBehavior)}
          >
            <Select.Trigger className="bg-surface-secondary">
              <Select.Value
                className="font-normal"
                numberOfLines={1}
                placeholder="Escolha uma opção"
              />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {walkoverBehaviorOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <FieldError>
            {errors.ruleConfig?.walkoverBehavior?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.resultValidation}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.resultValidationMode)}
          isRequired
        >
          <Label>Validação do resultado</Label>
          <Description className="-mt-1.5 mb-1">
            Define se o resultado confirmado entre os jogadores já vale ou
            precisa da aprovação do admin.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.resultValidationMode",
                nextValue as RuleConfig["resultValidationMode"],
                fieldUpdateOptions
              );
            }}
            value={resultValidationMode}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                {validationModeOptions.map((option) => (
                  <Segment.Item key={option.value} value={option.value}>
                    <Segment.Label>{option.label}</Segment.Label>
                  </Segment.Item>
                ))}
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.resultValidationMode?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>
    </>
  );
};

const RankingRulesSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: "ruleConfig.newPlayerPlacement",
  });
  const newPlayerPlacement = useWatch({
    control,
    name: "ruleConfig.newPlayerPlacement",
  });

  return (
    <>
      <RuleCard info={RULE_INFO.newPlayerPlacement}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.newPlayerPlacement)}
          isRequired
        >
          <Label>Entrada de novo jogador</Label>
          <Description className="-mt-1.5 mb-1">
            Define em que posição novos participantes entram no ranking.
          </Description>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.newPlayerPlacement",
                  nextValue.value as RuleConfig["newPlayerPlacement"],
                  fieldUpdateOptions
                );
              }
            }}
            selectionMode={"single"}
            value={getSelectedOption(
              newPlayerPlacementOptions,
              newPlayerPlacement
            )}
          >
            <Select.Trigger className="bg-surface-secondary">
              <Select.Value
                className="font-normal"
                numberOfLines={1}
                placeholder="Escolha uma opção"
              />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {newPlayerPlacementOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <FieldError>
            {errors.ruleConfig?.newPlayerPlacement?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <InactivityPenaltySection isDisabled={isDisabled} />
    </>
  );
};

const InactivityPenaltySection = ({ isDisabled }: RuleSectionProps) => {
  const { control, getValues, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.hasInactivityPenalty",
      "ruleConfig.inactivityPenaltyType",
      "ruleConfig.inactivityPenaltyDays",
    ],
  });
  const [hasInactivityPenalty, inactivityPenaltyType, inactivityPenaltyDays] =
    useWatch({
      control,
      name: [
        "ruleConfig.hasInactivityPenalty",
        "ruleConfig.inactivityPenaltyType",
        "ruleConfig.inactivityPenaltyDays",
      ],
    });

  function toggleInactivityPenalty(nextEnabled: boolean) {
    const ruleConfig = getValues("ruleConfig");

    if (!nextEnabled) {
      setValue(
        "ruleConfig",
        {
          ...ruleConfig,
          hasInactivityPenalty: false,
          inactivityPenaltyType: undefined,
          inactivityPenaltyDays: undefined,
        },
        fieldUpdateOptions
      );
      return;
    }

    setValue(
      "ruleConfig",
      {
        ...ruleConfig,
        hasInactivityPenalty: true,
        inactivityPenaltyType: inactivityPenaltyType ?? "drop_one_position",
        inactivityPenaltyDays: inactivityPenaltyDays ?? 30,
      },
      fieldUpdateOptions
    );
  }

  return (
    <ToggleableRuleCard
      description="Ative para definir a punição e o período sem partidas."
      enabled={hasInactivityPenalty}
      error={
        <FieldError>
          {errors.ruleConfig?.hasInactivityPenalty?.message ?? ""}
        </FieldError>
      }
      info={RULE_INFO.inactivityPenalty}
      isDisabled={isDisabled}
      label="Penalidade por inatividade"
      onToggle={toggleInactivityPenalty}
    >
      <TextField
        isInvalid={Boolean(errors.ruleConfig?.inactivityPenaltyType)}
        isRequired
      >
        <Label>Qual penalidade aplicar?</Label>
        <Description className="-mt-1.5 mb-1">
          Escolha o impacto da inatividade no ranking do jogador.
        </Description>
        <Select
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            if (nextValue && !Array.isArray(nextValue)) {
              setValue(
                "ruleConfig.inactivityPenaltyType",
                nextValue.value as RuleConfig["inactivityPenaltyType"],
                fieldUpdateOptions
              );
            }
          }}
          selectionMode={"single"}
          value={getSelectedOption(
            inactivityPenaltyTypeOptions,
            inactivityPenaltyType
          )}
        >
          <Select.Trigger className="bg-surface-secondary">
            <Select.Value
              className="font-normal"
              numberOfLines={1}
              placeholder="Escolha uma opção"
            />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              <Select.ListLabel className="mb-2">
                Escolha uma opção
              </Select.ListLabel>
              {inactivityPenaltyTypeOptions.map((option) => (
                <SelectOptionItem
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Select.Content>
          </Select.Portal>
        </Select>
        <FieldError>
          {errors.ruleConfig?.inactivityPenaltyType?.message ?? ""}
        </FieldError>
      </TextField>

      <TextField
        isInvalid={Boolean(errors.ruleConfig?.inactivityPenaltyDays)}
        isRequired
      >
        <Label>Após quanto tempo sem jogar?</Label>
        <Description className="-mt-1.5 mb-1">
          Tempo sem partidas para a penalidade começar a valer.
        </Description>
        <Segment
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            setValue(
              "ruleConfig.inactivityPenaltyDays",
              Number(nextValue),
              fieldUpdateOptions
            );
          }}
          value={String(inactivityPenaltyDays ?? 30)}
        >
          <Segment.Group>
            <Segment.ScrollView>
              <Segment.Indicator />
              <Segment.Item value="15">
                <Segment.Label>15 dias</Segment.Label>
              </Segment.Item>
              <Segment.Item value="30">
                <Segment.Label>30 dias</Segment.Label>
              </Segment.Item>
              <Segment.Item value="45">
                <Segment.Label>45 dias</Segment.Label>
              </Segment.Item>
              <Segment.Item value="60">
                <Segment.Label>60 dias</Segment.Label>
              </Segment.Item>
            </Segment.ScrollView>
          </Segment.Group>
        </Segment>
        <FieldError>
          {errors.ruleConfig?.inactivityPenaltyDays?.message ?? ""}
        </FieldError>
      </TextField>
    </ToggleableRuleCard>
  );
};

const MatchRulesSection = ({ isDisabled }: RuleSectionProps) => (
  <>
    <MatchBasicsSection isDisabled={isDisabled} />
    <TieBreakSection isDisabled={isDisabled} />
    <FinalSetSection isDisabled={isDisabled} />
  </>
);

const MatchBasicsSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.matchConfig.bestOfSets",
      "ruleConfig.matchConfig.gamesPerSet",
      "ruleConfig.matchConfig.defaultDurationMinutes",
      "ruleConfig.matchConfig.scoringMode",
      "ruleConfig.matchConfig.setMustWinByTwoGames",
    ],
  });
  const [
    bestOfSets,
    gamesPerSet,
    defaultDurationMinutes,
    scoringMode,
    setMustWinByTwoGames,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.matchConfig.bestOfSets",
      "ruleConfig.matchConfig.gamesPerSet",
      "ruleConfig.matchConfig.defaultDurationMinutes",
      "ruleConfig.matchConfig.scoringMode",
      "ruleConfig.matchConfig.setMustWinByTwoGames",
    ],
  });

  return (
    <>
      <RuleCard info={RULE_INFO.bestOfSets}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.matchConfig?.bestOfSets)}
          isRequired
        >
          <Label>Melhor de quantos sets?</Label>
          <Description className="-mt-1.5 mb-1">
            Escolha o formato da partida. Quem atingir a maioria dos sets vence.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.bestOfSets",
                Number(nextValue),
                fieldUpdateOptions
              );
            }}
            value={String(bestOfSets)}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                <Segment.Item value="1">
                  <Segment.Label>Melhor de 1</Segment.Label>
                </Segment.Item>
                <Segment.Item value="3">
                  <Segment.Label>Melhor de 3</Segment.Label>
                </Segment.Item>
                <Segment.Item value="5">
                  <Segment.Label>Melhor de 5</Segment.Label>
                </Segment.Item>
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.bestOfSets?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.gamesPerSet}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.matchConfig?.gamesPerSet)}
          isRequired
        >
          <Label>Quantos games por set?</Label>
          <Description className="-mt-1.5 mb-1">
            Quantidade padrão de games em cada set.
          </Description>
          <NumberStepper
            className="self-start"
            defaultValue={gamesPerSet}
            isDisabled={isDisabled}
            maxValue={12}
            minValue={1}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.gamesPerSet",
                nextValue,
                fieldUpdateOptions
              );
              setValue(
                "ruleConfig.matchConfig.tieBreakAtGamesAll",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={1}
            value={gamesPerSet}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.gamesPerSet?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.defaultDurationMinutes}>
        <TextField
          isInvalid={Boolean(
            errors.ruleConfig?.matchConfig?.defaultDurationMinutes
          )}
          isRequired
        >
          <Label>Duração padrão da partida</Label>
          <Description className="-mt-1.5 mb-1">
            Tempo inicial sugerido quando a partida for marcada.
          </Description>
          <NumberStepper
            className="self-start"
            defaultValue={defaultDurationMinutes}
            isDisabled={isDisabled}
            maxValue={360}
            minValue={15}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.defaultDurationMinutes",
                nextValue,
                fieldUpdateOptions
              );
            }}
            step={15}
            value={defaultDurationMinutes}
          >
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.defaultDurationMinutes?.message ??
              ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <RuleCard info={RULE_INFO.scoringMode}>
        <TextField
          isInvalid={Boolean(errors.ruleConfig?.matchConfig?.scoringMode)}
        >
          <Label>Pontuação dos games</Label>
          <Description className="-mt-1.5 mb-1">
            Escolha se a partida usa vantagem tradicional ou no-ad.
          </Description>
          <Segment
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              setValue(
                "ruleConfig.matchConfig.scoringMode",
                nextValue as MatchConfig["scoringMode"],
                fieldUpdateOptions
              );
            }}
            value={scoringMode}
          >
            <Segment.Group>
              <Segment.ScrollView>
                <Segment.Indicator />
                {scoringModeOptions.map((option) => (
                  <Segment.Item key={option.value} value={option.value}>
                    <Segment.Label>{option.label}</Segment.Label>
                  </Segment.Item>
                ))}
              </Segment.ScrollView>
            </Segment.Group>
          </Segment>
          <FieldError>
            {errors.ruleConfig?.matchConfig?.scoringMode?.message ?? ""}
          </FieldError>
        </TextField>
      </RuleCard>

      <ToggleableRuleCard
        description="Ative para exigir dois games de diferença no fechamento do set."
        enabled={setMustWinByTwoGames}
        error={
          <FieldError>
            {errors.ruleConfig?.matchConfig?.setMustWinByTwoGames?.message ??
              ""}
          </FieldError>
        }
        info={RULE_INFO.setMustWinByTwoGames}
        isDisabled={isDisabled}
        label="Vencer o set por 2 games"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.matchConfig.setMustWinByTwoGames",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      />
    </>
  );
};

const TieBreakSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.matchConfig.hasTieBreak",
      "ruleConfig.matchConfig.tieBreakAtGamesAll",
      "ruleConfig.matchConfig.tieBreakPoints",
      "ruleConfig.matchConfig.tieBreakMustWinByTwo",
    ],
  });
  const [
    hasTieBreak,
    tieBreakAtGamesAll,
    tieBreakPoints,
    tieBreakMustWinByTwo,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.matchConfig.hasTieBreak",
      "ruleConfig.matchConfig.tieBreakAtGamesAll",
      "ruleConfig.matchConfig.tieBreakPoints",
      "ruleConfig.matchConfig.tieBreakMustWinByTwo",
    ],
  });

  return (
    <ToggleableRuleCard
      description="Ative para configurar o tie-break padrão dos sets."
      enabled={hasTieBreak}
      error={
        <FieldError>
          {errors.ruleConfig?.matchConfig?.hasTieBreak?.message ?? ""}
        </FieldError>
      }
      info={RULE_INFO.tieBreak}
      isDisabled={isDisabled}
      label="Tie-break"
      onToggle={(nextEnabled) => {
        setValue(
          "ruleConfig.matchConfig.hasTieBreak",
          nextEnabled,
          fieldUpdateOptions
        );
      }}
    >
      <TextField
        isInvalid={Boolean(errors.ruleConfig?.matchConfig?.tieBreakAtGamesAll)}
        isRequired
      >
        <Label>Em qual placar entra o tie-break?</Label>
        <Description className="-mt-1.5 mb-1">
          Normalmente acompanha a quantidade de games do set, mas você pode
          ajustar.
        </Description>
        <NumberStepper
          className="self-start"
          defaultValue={tieBreakAtGamesAll}
          isDisabled={isDisabled}
          maxValue={12}
          minValue={1}
          onValueChange={(nextValue) => {
            setValue(
              "ruleConfig.matchConfig.tieBreakAtGamesAll",
              nextValue,
              fieldUpdateOptions
            );
          }}
          step={1}
          value={tieBreakAtGamesAll}
        >
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper>
        <FieldError>
          {errors.ruleConfig?.matchConfig?.tieBreakAtGamesAll?.message ?? ""}
        </FieldError>
      </TextField>

      <TextField
        isInvalid={Boolean(errors.ruleConfig?.matchConfig?.tieBreakPoints)}
        isRequired
      >
        <Label>Quantos pontos no tie-break?</Label>
        <Description className="-mt-1.5 mb-1">
          Quantidade padrão de pontos para vencer o tie-break.
        </Description>
        <NumberStepper
          className="self-start"
          defaultValue={tieBreakPoints}
          isDisabled={isDisabled}
          maxValue={30}
          minValue={1}
          onValueChange={(nextValue) => {
            setValue(
              "ruleConfig.matchConfig.tieBreakPoints",
              nextValue,
              fieldUpdateOptions
            );
          }}
          step={1}
          value={tieBreakPoints}
        >
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper>
        <FieldError>
          {errors.ruleConfig?.matchConfig?.tieBreakPoints?.message ?? ""}
        </FieldError>
      </TextField>

      <RuleToggleRow
        description="Ative para exigir dois pontos de diferença no tie-break."
        enabled={tieBreakMustWinByTwo}
        label="Vencer o tie-break por 2 pontos"
        onToggle={(nextEnabled) => {
          setValue(
            "ruleConfig.matchConfig.tieBreakMustWinByTwo",
            nextEnabled,
            fieldUpdateOptions
          );
        }}
      />
      <FieldError>
        {errors.ruleConfig?.matchConfig?.tieBreakMustWinByTwo?.message ?? ""}
      </FieldError>
    </ToggleableRuleCard>
  );
};

const FinalSetSection = ({ isDisabled }: RuleSectionProps) => {
  const { control, setValue } = useFormContext<LeagueScreenValues>();
  const { errors } = useFormState({
    control,
    name: [
      "ruleConfig.matchConfig.finalSetMode",
      "ruleConfig.matchConfig.finalSetGamesPerSet",
      "ruleConfig.matchConfig.finalSetScoringMode",
      "ruleConfig.matchConfig.finalSetMustWinByTwoGames",
      "ruleConfig.matchConfig.finalSetHasTieBreak",
      "ruleConfig.matchConfig.finalSetTieBreakAtGamesAll",
      "ruleConfig.matchConfig.finalSetTieBreakPoints",
      "ruleConfig.matchConfig.finalSetTieBreakMustWinByTwo",
      "ruleConfig.matchConfig.finalSetSuperTieBreakPoints",
      "ruleConfig.matchConfig.finalSetSuperTieBreakMustWinByTwo",
    ],
  });
  const [
    finalSetMode,
    finalSetGamesPerSet,
    finalSetScoringMode,
    finalSetMustWinByTwoGames,
    finalSetHasTieBreak,
    finalSetTieBreakAtGamesAll,
    finalSetTieBreakPoints,
    finalSetTieBreakMustWinByTwo,
    finalSetSuperTieBreakPoints,
    finalSetSuperTieBreakMustWinByTwo,
  ] = useWatch({
    control,
    name: [
      "ruleConfig.matchConfig.finalSetMode",
      "ruleConfig.matchConfig.finalSetGamesPerSet",
      "ruleConfig.matchConfig.finalSetScoringMode",
      "ruleConfig.matchConfig.finalSetMustWinByTwoGames",
      "ruleConfig.matchConfig.finalSetHasTieBreak",
      "ruleConfig.matchConfig.finalSetTieBreakAtGamesAll",
      "ruleConfig.matchConfig.finalSetTieBreakPoints",
      "ruleConfig.matchConfig.finalSetTieBreakMustWinByTwo",
      "ruleConfig.matchConfig.finalSetSuperTieBreakPoints",
      "ruleConfig.matchConfig.finalSetSuperTieBreakMustWinByTwo",
    ],
  });

  return (
    <RuleCard info={RULE_INFO.finalSetMode}>
      <TextField
        isInvalid={Boolean(errors.ruleConfig?.matchConfig?.finalSetMode)}
      >
        <Label>Formato do último set</Label>
        <Description className="-mt-1.5 mb-1">
          Escolha se o último set segue igual, vira um set próprio ou um super
          tie-break.
        </Description>
        <Select
          isDisabled={isDisabled}
          onValueChange={(nextValue) => {
            if (nextValue && !Array.isArray(nextValue)) {
              setValue(
                "ruleConfig.matchConfig.finalSetMode",
                nextValue.value as MatchConfig["finalSetMode"],
                fieldUpdateOptions
              );
            }
          }}
          selectionMode={"single"}
          value={getSelectedOption(finalSetModeOptions, finalSetMode)}
        >
          <Select.Trigger className="bg-surface-secondary">
            <Select.Value
              className="font-normal"
              numberOfLines={1}
              placeholder="Escolha uma opção"
            />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              <Select.ListLabel className="mb-2">
                Escolha uma opção
              </Select.ListLabel>
              {finalSetModeOptions.map((option) => (
                <SelectOptionItem
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Select.Content>
          </Select.Portal>
        </Select>
        <FieldError>
          {errors.ruleConfig?.matchConfig?.finalSetMode?.message ?? ""}
        </FieldError>
      </TextField>

      {finalSetMode === "custom_set" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetGamesPerSet
            )}
            isRequired
          >
            <Label>Quantos games no último set?</Label>
            <Description className="-mt-1.5 mb-1">
              Quantidade padrão de games para o último set.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={finalSetGamesPerSet}
              isDisabled={isDisabled}
              maxValue={12}
              minValue={1}
              onValueChange={(nextValue) => {
                setValue(
                  "ruleConfig.matchConfig.finalSetGamesPerSet",
                  nextValue,
                  fieldUpdateOptions
                );
              }}
              step={1}
              value={finalSetGamesPerSet}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetGamesPerSet?.message ??
                ""}
            </FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetScoringMode
            )}
          >
            <Label>Pontuação do último set</Label>
            <Description className="-mt-1.5 mb-1">
              Escolha se o último set usa vantagem ou no-ad.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  setValue(
                    "ruleConfig.matchConfig.finalSetScoringMode",
                    nextValue.value as MatchConfig["finalSetScoringMode"],
                    fieldUpdateOptions
                  );
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(scoringModeOptions, finalSetScoringMode)}
            >
              <Select.Trigger className="bg-surface-secondary">
                <Select.Value
                  className="font-normal"
                  numberOfLines={1}
                  placeholder="Escolha uma opção"
                />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover" width="trigger">
                  <Select.ListLabel className="mb-2">
                    Escolha uma opção
                  </Select.ListLabel>
                  {scoringModeOptions.map((option) => (
                    <SelectOptionItem
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetScoringMode?.message ??
                ""}
            </FieldError>
          </TextField>

          <RuleToggleRow
            description="Ative para exigir dois games de diferença no último set."
            enabled={finalSetMustWinByTwoGames}
            label="Vencer o último set por 2 games"
            onToggle={(nextEnabled) => {
              setValue(
                "ruleConfig.matchConfig.finalSetMustWinByTwoGames",
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetMustWinByTwoGames
              ?.message ?? ""}
          </FieldError>

          <RuleToggleRow
            description="Ative para configurar tie-break também no último set."
            enabled={finalSetHasTieBreak}
            label="Tie-break no último set"
            onToggle={(nextEnabled) => {
              setValue(
                "ruleConfig.matchConfig.finalSetHasTieBreak",
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetHasTieBreak?.message ?? ""}
          </FieldError>

          {finalSetHasTieBreak ? (
            <RuleExpandableContent>
              <TextField
                isInvalid={Boolean(
                  errors.ruleConfig?.matchConfig?.finalSetTieBreakAtGamesAll
                )}
                isRequired
              >
                <Label>Em qual placar entra o tie-break final?</Label>
                <Description className="-mt-1.5 mb-1">
                  Exemplo: informe 6 para tie-break final em 6x6.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={finalSetTieBreakAtGamesAll}
                  isDisabled={isDisabled}
                  maxValue={12}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    setValue(
                      "ruleConfig.matchConfig.finalSetTieBreakAtGamesAll",
                      nextValue,
                      fieldUpdateOptions
                    );
                  }}
                  step={1}
                  value={finalSetTieBreakAtGamesAll}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors.ruleConfig?.matchConfig?.finalSetTieBreakAtGamesAll
                    ?.message ?? ""}
                </FieldError>
              </TextField>

              <TextField
                isInvalid={Boolean(
                  errors.ruleConfig?.matchConfig?.finalSetTieBreakPoints
                )}
                isRequired
              >
                <Label>Quantos pontos no tie-break final?</Label>
                <Description className="-mt-1.5 mb-1">
                  Pontuação padrão do tie-break no último set.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={finalSetTieBreakPoints}
                  isDisabled={isDisabled}
                  maxValue={30}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    setValue(
                      "ruleConfig.matchConfig.finalSetTieBreakPoints",
                      nextValue,
                      fieldUpdateOptions
                    );
                  }}
                  step={1}
                  value={finalSetTieBreakPoints}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors.ruleConfig?.matchConfig?.finalSetTieBreakPoints
                    ?.message ?? ""}
                </FieldError>
              </TextField>

              <RuleToggleRow
                description="Ative para exigir dois pontos de diferença no tie-break do último set."
                enabled={finalSetTieBreakMustWinByTwo}
                label="Vencer o tie-break final por 2 pontos"
                onToggle={(nextEnabled) => {
                  setValue(
                    "ruleConfig.matchConfig.finalSetTieBreakMustWinByTwo",
                    nextEnabled,
                    fieldUpdateOptions
                  );
                }}
              />
              <FieldError>
                {errors.ruleConfig?.matchConfig?.finalSetTieBreakMustWinByTwo
                  ?.message ?? ""}
              </FieldError>
            </RuleExpandableContent>
          ) : null}
        </RuleExpandableContent>
      ) : null}

      {finalSetMode === "super_tiebreak" ? (
        <RuleExpandableContent>
          <TextField
            isInvalid={Boolean(
              errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakPoints
            )}
            isRequired
          >
            <Label>Quantos pontos no super tie-break?</Label>
            <Description className="-mt-1.5 mb-1">
              Pontuação padrão do super tie-break no lugar do último set.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={finalSetSuperTieBreakPoints}
              isDisabled={isDisabled}
              maxValue={30}
              minValue={1}
              onValueChange={(nextValue) => {
                setValue(
                  "ruleConfig.matchConfig.finalSetSuperTieBreakPoints",
                  nextValue,
                  fieldUpdateOptions
                );
              }}
              step={1}
              value={finalSetSuperTieBreakPoints}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakPoints
                ?.message ?? ""}
            </FieldError>
          </TextField>

          <RuleToggleRow
            description="Ative para exigir dois pontos de diferença no super tie-break."
            enabled={finalSetSuperTieBreakMustWinByTwo}
            label="Vencer o super tie-break por 2 pontos"
            onToggle={(nextEnabled) => {
              setValue(
                "ruleConfig.matchConfig.finalSetSuperTieBreakMustWinByTwo",
                nextEnabled,
                fieldUpdateOptions
              );
            }}
          />
          <FieldError>
            {errors.ruleConfig?.matchConfig?.finalSetSuperTieBreakMustWinByTwo
              ?.message ?? ""}
          </FieldError>
        </RuleExpandableContent>
      ) : null}
    </RuleCard>
  );
};

export default function LeagueRulesRoute() {
  const { isRulesLocked, isSubmitPending, mode, onSubmitPress } =
    useLeagueFormRoute();
  const [activeTab, setActiveTab] = useState("desafios");
  const isDisabled = isSubmitPending || isRulesLocked;
  const subtitle = mode === "create" ? "Criar Liga" : "Editar Liga";

  function handleSubmitPress() {
    if (isSubmitPending) {
      return;
    }

    onSubmitPress();
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.SubTitle>{subtitle}</Page.Header.SubTitle>
          <Page.Header.Title>Regras</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <Menu>
            <Menu.Trigger asChild>
              <Button isIconOnly size="sm" variant="ghost">
                <HugeIcons icon={MoreVerticalIcon} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay />
              <Menu.Content presentation="popover">
                <Menu.Item onPress={handleSubmitPress}>
                  <Menu.ItemTitle className="flex-none">Salvar</Menu.ItemTitle>
                  <HugeIcons icon={CheckmarkCircle02Icon} />
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-offset-4">
        <View className="gap-4">
          <Tabs
            onValueChange={setActiveTab}
            value={activeTab}
            // variant="secondary"
          >
            <Tabs.List className="w-full">
              <Tabs.ScrollView>
                <Tabs.Indicator />
                <Tabs.Trigger className="flex-1" value="desafios">
                  <Tabs.Label>Desafios</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger className="flex-1" value="resultado">
                  <Tabs.Label>Resultado</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger className="flex-1" value="ranking">
                  <Tabs.Label>Ranking</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger className="flex-1" value="partidas">
                  <Tabs.Label>Partidas</Tabs.Label>
                </Tabs.Trigger>
              </Tabs.ScrollView>
            </Tabs.List>
            <Tabs.Content className="gap-2 pt-2" value="desafios">
              <ChallengeRulesSection isDisabled={isDisabled} />
            </Tabs.Content>

            <Tabs.Content className="gap-2 pt-2" value="resultado">
              <ResultRulesSection isDisabled={isDisabled} />
            </Tabs.Content>

            <Tabs.Content className="gap-2 pt-2" value="ranking">
              <RankingRulesSection isDisabled={isDisabled} />
            </Tabs.Content>

            <Tabs.Content className="gap-2 pt-2" value="partidas">
              <MatchRulesSection isDisabled={isDisabled} />
            </Tabs.Content>
          </Tabs>
        </View>
      </Page.ScrollView>
    </Page>
  );
}
