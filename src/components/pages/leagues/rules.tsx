import {
  Checkbox,
  Description,
  FieldError,
  Label,
  PressableFeedback,
  Select,
  Tabs,
  TextField,
} from "heroui-native";
import { NumberStepper, Segment } from "heroui-native-pro";
import { useState } from "react";
import { View } from "react-native";

import { SelectOptionItem } from "@/components/ui/select-option-item";
import type { LeagueMatchConfig } from "@convex/domains/league/contract";
import type { ApiInputs } from "@convex/shared/api";

type CreateLeagueInput = ApiInputs["league"]["management"]["create"];
type RuleConfig = Omit<CreateLeagueInput["ruleConfig"], "matchConfig"> & {
  matchConfig: LeagueMatchConfig;
};
type MatchConfig = LeagueMatchConfig;

type MatchConfigErrors = Partial<Record<keyof MatchConfig, string | undefined>>;

type RuleErrors = Partial<
  Record<Exclude<keyof RuleConfig, "matchConfig">, string | undefined>
> & {
  matchConfig?: MatchConfigErrors;
};

type RulesProps = {
  errors?: RuleErrors;
  isDisabled?: boolean;
  isLocked?: boolean;
  onChange: (value: RuleConfig) => void;
  value: RuleConfig;
};

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

const scoringModeOptions = [
  {
    label: "Com vantagem",
    value: "advantage" as const,
  },
  {
    label: "No-ad",
    value: "no_ad" as const,
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

function getSelectedOption<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string | undefined
) {
  if (!value) {
    return;
  }

  return options.find((option) => option.value === value);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this form composes four dense rules sections in one screen component
export const Rules = ({ errors, isDisabled, onChange, value }: RulesProps) => {
  const [activeTab, setActiveTab] = useState("desafios");

  function updateRuleConfig(patch: Partial<RuleConfig>) {
    onChange({
      ...value,
      ...patch,
    });
  }

  function updateMatchConfig(patch: Partial<MatchConfig>) {
    updateRuleConfig({
      matchConfig: {
        ...value.matchConfig,
        ...patch,
      },
    });
  }

  function toggleInactivityPenalty() {
    if (value.hasInactivityPenalty) {
      onChange({
        ...value,
        hasInactivityPenalty: false,
        inactivityPenaltyType: undefined,
        inactivityPenaltyDays: undefined,
      });
      return;
    }

    onChange({
      ...value,
      hasInactivityPenalty: true,
      inactivityPenaltyType: value.inactivityPenaltyType ?? "drop_one_position",
      inactivityPenaltyDays: value.inactivityPenaltyDays ?? 30,
    });
  }

  return (
    <View className="gap-4">
      <Tabs onValueChange={setActiveTab} value={activeTab} variant="secondary">
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
        <Tabs.Content className="gap-4 pt-2" value="desafios">
          <TextField
            isInvalid={Boolean(errors?.maxChallengeDistance)}
            isRequired
          >
            <Label>Pode desafiar quantas posições acima?</Label>
            <Description className="-mt-1.5 mb-1">
              Define quantas posições acima um jogador pode desafiar.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={value.maxChallengeDistance}
              isDisabled={isDisabled}
              maxValue={100}
              minValue={1}
              onValueChange={(nextValue) => {
                updateRuleConfig({ maxChallengeDistance: nextValue });
              }}
              step={1}
              value={value.maxChallengeDistance}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>{errors?.maxChallengeDistance ?? ""}</FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(errors?.maxActiveChallengesPerPlayer)}
            isRequired
          >
            <Label>Máx. desafios ativos por jogador?</Label>
            <Description className="-mt-1.5 mb-1">
              Limite de desafios em aberto ao mesmo tempo para cada jogador.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={value.maxActiveChallengesPerPlayer}
              isDisabled={isDisabled}
              maxValue={100}
              minValue={1}
              onValueChange={(nextValue) => {
                updateRuleConfig({ maxActiveChallengesPerPlayer: nextValue });
              }}
              step={1}
              value={value.maxActiveChallengesPerPlayer}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors?.maxActiveChallengesPerPlayer ?? ""}
            </FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(errors?.maxChallengesPerMonth)}
            isRequired
          >
            <Label>Máx. desafios por mês?</Label>
            <Description className="-mt-1.5 mb-1">
              Quantidade máxima de desafios que cada jogador pode abrir no mês.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={value.maxChallengesPerMonth}
              isDisabled={isDisabled}
              maxValue={100}
              minValue={1}
              onValueChange={(nextValue) => {
                updateRuleConfig({ maxChallengesPerMonth: nextValue });
              }}
              step={1}
              value={value.maxChallengesPerMonth}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>{errors?.maxChallengesPerMonth ?? ""}</FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(errors?.responseDeadlineHours)}
            isRequired
          >
            <Label>Prazo para responder desafio</Label>
            <Description className="-mt-1.5 mb-1">
              Tempo que o adversário tem para aceitar ou recusar o desafio.
            </Description>
            <Segment
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                updateRuleConfig({
                  responseDeadlineHours: Number(nextValue),
                });
              }}
              value={String(value.responseDeadlineHours)}
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
            <FieldError>{errors?.responseDeadlineHours ?? ""}</FieldError>
          </TextField>
        </Tabs.Content>

        <Tabs.Content className="gap-4 pt-2" value="resultado">
          <TextField isInvalid={Boolean(errors?.winBehavior)} isRequired>
            <Label>Vitória no desafio</Label>
            <Description className="-mt-1.5 mb-1">
              Define como o ranking muda quando o desafiante vence.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  updateRuleConfig({
                    winBehavior: nextValue.value as RuleConfig["winBehavior"],
                  });
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(winBehaviorOptions, value.winBehavior)}
            >
              <Select.Trigger>
                <Select.Value
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
            <FieldError>{errors?.winBehavior ?? ""}</FieldError>
          </TextField>

          <TextField isInvalid={Boolean(errors?.lossBehavior)} isRequired>
            <Label>Derrota no desafio</Label>
            <Description className="-mt-1.5 mb-1">
              Define como o ranking muda quando o desafiante perde.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  updateRuleConfig({
                    lossBehavior: nextValue.value as RuleConfig["lossBehavior"],
                  });
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(lossBehaviorOptions, value.lossBehavior)}
            >
              <Select.Trigger>
                <Select.Value
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
            <FieldError>{errors?.lossBehavior ?? ""}</FieldError>
          </TextField>

          <TextField isInvalid={Boolean(errors?.walkoverBehavior)} isRequired>
            <Label>W.O</Label>
            <Description className="-mt-1.5 mb-1">
              Define o que acontece quando um jogador não comparece ao desafio.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  updateRuleConfig({
                    walkoverBehavior:
                      nextValue.value as RuleConfig["walkoverBehavior"],
                  });
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(
                walkoverBehaviorOptions,
                value.walkoverBehavior
              )}
            >
              <Select.Trigger>
                <Select.Value
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
            <FieldError>{errors?.walkoverBehavior ?? ""}</FieldError>
          </TextField>
        </Tabs.Content>

        <Tabs.Content className="gap-4 pt-2" value="ranking">
          <TextField isInvalid={Boolean(errors?.newPlayerPlacement)} isRequired>
            <Label>Entrada de novo jogador</Label>
            <Description className="-mt-1.5 mb-1">
              Define em que posição novos participantes entram no ranking.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  updateRuleConfig({
                    newPlayerPlacement:
                      nextValue.value as RuleConfig["newPlayerPlacement"],
                  });
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(
                newPlayerPlacementOptions,
                value.newPlayerPlacement
              )}
            >
              <Select.Trigger>
                <Select.Value
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
            <FieldError>{errors?.newPlayerPlacement ?? ""}</FieldError>
          </TextField>

          <View className="gap-4 rounded-2xl border border-border bg-background px-4 py-3">
            <PressableFeedback
              className="flex-row items-center gap-3"
              isDisabled={isDisabled}
              onPress={toggleInactivityPenalty}
            >
              <Checkbox
                className="mt-0.5"
                isDisabled={isDisabled}
                isSelected={value.hasInactivityPenalty}
                pointerEvents="none"
              />
              <View className="flex-1 gap-0" pointerEvents="none">
                <Label>Penalidade por inatividade</Label>
                <Description className="-mt-1.5 mb-1">
                  Ative para definir a punição e o período sem partidas.
                </Description>
              </View>
            </PressableFeedback>
            <FieldError>{errors?.hasInactivityPenalty ?? ""}</FieldError>

            {value.hasInactivityPenalty ? (
              <View className="gap-4">
                <TextField
                  isInvalid={Boolean(errors?.inactivityPenaltyType)}
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
                        updateRuleConfig({
                          inactivityPenaltyType:
                            nextValue.value as RuleConfig["inactivityPenaltyType"],
                        });
                      }
                    }}
                    selectionMode={"single"}
                    value={getSelectedOption(
                      inactivityPenaltyTypeOptions,
                      value.inactivityPenaltyType
                    )}
                  >
                    <Select.Trigger>
                      <Select.Value
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
                  <FieldError>{errors?.inactivityPenaltyType ?? ""}</FieldError>
                </TextField>

                <TextField
                  isInvalid={Boolean(errors?.inactivityPenaltyDays)}
                  isRequired
                >
                  <Label>Após quanto tempo sem jogar?</Label>
                  <Description className="-mt-1.5 mb-1">
                    Tempo sem partidas para a penalidade começar a valer.
                  </Description>
                  <Segment
                    isDisabled={isDisabled}
                    onValueChange={(nextValue) => {
                      updateRuleConfig({
                        inactivityPenaltyDays: Number(nextValue),
                      });
                    }}
                    value={String(value.inactivityPenaltyDays ?? 30)}
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
                  <FieldError>{errors?.inactivityPenaltyDays ?? ""}</FieldError>
                </TextField>
              </View>
            ) : null}
          </View>
        </Tabs.Content>

        <Tabs.Content className="gap-4 pt-2" value="partidas">
          <TextField
            isInvalid={Boolean(errors?.matchConfig?.bestOfSets)}
            isRequired
          >
            <Label>Quantos sets?</Label>
            <Description className="-mt-1.5 mb-1">
              Define o padrão inicial de sets para as partidas da liga.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={value.matchConfig.bestOfSets}
              isDisabled={isDisabled}
              maxValue={9}
              minValue={1}
              onValueChange={(nextValue) => {
                updateMatchConfig({ bestOfSets: nextValue });
              }}
              step={1}
              value={value.matchConfig.bestOfSets}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>{errors?.matchConfig?.bestOfSets ?? ""}</FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(errors?.matchConfig?.gamesPerSet)}
            isRequired
          >
            <Label>Quantos games por set?</Label>
            <Description className="-mt-1.5 mb-1">
              Quantidade padrão de games em cada set.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={value.matchConfig.gamesPerSet}
              isDisabled={isDisabled}
              maxValue={12}
              minValue={1}
              onValueChange={(nextValue) => {
                updateMatchConfig({
                  gamesPerSet: nextValue,
                  tieBreakAtGamesAll: nextValue,
                });
              }}
              step={1}
              value={value.matchConfig.gamesPerSet}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>{errors?.matchConfig?.gamesPerSet ?? ""}</FieldError>
          </TextField>

          <TextField
            isInvalid={Boolean(errors?.matchConfig?.defaultDurationMinutes)}
            isRequired
          >
            <Label>Duração padrão da partida</Label>
            <Description className="-mt-1.5 mb-1">
              Tempo inicial sugerido quando a partida for marcada.
            </Description>
            <NumberStepper
              className="self-start"
              defaultValue={value.matchConfig.defaultDurationMinutes}
              isDisabled={isDisabled}
              maxValue={360}
              minValue={15}
              onValueChange={(nextValue) => {
                updateMatchConfig({ defaultDurationMinutes: nextValue });
              }}
              step={15}
              value={value.matchConfig.defaultDurationMinutes}
            >
              <NumberStepper.DecrementButton />
              <NumberStepper.Value />
              <NumberStepper.IncrementButton />
            </NumberStepper>
            <FieldError>
              {errors?.matchConfig?.defaultDurationMinutes ?? ""}
            </FieldError>
          </TextField>

          <TextField isInvalid={Boolean(errors?.matchConfig?.scoringMode)}>
            <Label>Pontuação dos games</Label>
            <Description className="-mt-1.5 mb-1">
              Escolha se a partida usa vantagem tradicional ou no-ad.
            </Description>
            <Segment
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                updateMatchConfig({
                  scoringMode: nextValue as MatchConfig["scoringMode"],
                });
              }}
              value={value.matchConfig.scoringMode}
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
            <FieldError>{errors?.matchConfig?.scoringMode ?? ""}</FieldError>
          </TextField>

          <View className="gap-4 rounded-2xl border border-border bg-background px-4 py-3">
            <PressableFeedback
              className="flex-row items-center gap-3"
              isDisabled={isDisabled}
              onPress={() => {
                updateMatchConfig({
                  setMustWinByTwoGames: !value.matchConfig.setMustWinByTwoGames,
                });
              }}
            >
              <Checkbox
                className="mt-0.5"
                isDisabled={isDisabled}
                isSelected={value.matchConfig.setMustWinByTwoGames}
                pointerEvents="none"
              />
              <View className="flex-1 gap-0" pointerEvents="none">
                <Label>Vencer o set por 2 games</Label>
                <Description className="-mt-1.5 mb-1">
                  Ative para exigir dois games de diferença no fechamento do
                  set.
                </Description>
              </View>
            </PressableFeedback>
            <FieldError>
              {errors?.matchConfig?.setMustWinByTwoGames ?? ""}
            </FieldError>
          </View>

          <View className="gap-4 rounded-2xl border border-border bg-background px-4 py-3">
            <PressableFeedback
              className="flex-row items-center gap-3"
              isDisabled={isDisabled}
              onPress={() => {
                updateMatchConfig({
                  hasTieBreak: !value.matchConfig.hasTieBreak,
                });
              }}
            >
              <Checkbox
                className="mt-0.5"
                isDisabled={isDisabled}
                isSelected={value.matchConfig.hasTieBreak}
                pointerEvents="none"
              />
              <View className="flex-1 gap-0" pointerEvents="none">
                <Label>Tie-break</Label>
                <Description className="-mt-1.5 mb-1">
                  Ative para configurar o tie-break padrão dos sets.
                </Description>
              </View>
            </PressableFeedback>
            <FieldError>{errors?.matchConfig?.hasTieBreak ?? ""}</FieldError>

            {value.matchConfig.hasTieBreak ? (
              <View className="gap-4">
                <TextField
                  isInvalid={Boolean(errors?.matchConfig?.tieBreakAtGamesAll)}
                  isRequired
                >
                  <Label>Em qual placar entra o tie-break?</Label>
                  <Description className="-mt-1.5 mb-1">
                    Normalmente acompanha a quantidade de games do set, mas você
                    pode ajustar.
                  </Description>
                  <NumberStepper
                    className="self-start"
                    defaultValue={value.matchConfig.tieBreakAtGamesAll}
                    isDisabled={isDisabled}
                    maxValue={12}
                    minValue={1}
                    onValueChange={(nextValue) => {
                      updateMatchConfig({ tieBreakAtGamesAll: nextValue });
                    }}
                    step={1}
                    value={value.matchConfig.tieBreakAtGamesAll}
                  >
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper>
                  <FieldError>
                    {errors?.matchConfig?.tieBreakAtGamesAll ?? ""}
                  </FieldError>
                </TextField>

                <TextField
                  isInvalid={Boolean(errors?.matchConfig?.tieBreakPoints)}
                  isRequired
                >
                  <Label>Quantos pontos no tie-break?</Label>
                  <Description className="-mt-1.5 mb-1">
                    Quantidade padrão de pontos para vencer o tie-break.
                  </Description>
                  <NumberStepper
                    className="self-start"
                    defaultValue={value.matchConfig.tieBreakPoints}
                    isDisabled={isDisabled}
                    maxValue={30}
                    minValue={1}
                    onValueChange={(nextValue) => {
                      updateMatchConfig({ tieBreakPoints: nextValue });
                    }}
                    step={1}
                    value={value.matchConfig.tieBreakPoints}
                  >
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper>
                  <FieldError>
                    {errors?.matchConfig?.tieBreakPoints ?? ""}
                  </FieldError>
                </TextField>

                <PressableFeedback
                  className="flex-row items-center gap-3"
                  isDisabled={isDisabled}
                  onPress={() => {
                    updateMatchConfig({
                      tieBreakMustWinByTwo:
                        !value.matchConfig.tieBreakMustWinByTwo,
                    });
                  }}
                >
                  <Checkbox
                    className="mt-0.5"
                    isDisabled={isDisabled}
                    isSelected={value.matchConfig.tieBreakMustWinByTwo}
                    pointerEvents="none"
                  />
                  <View className="flex-1 gap-0" pointerEvents="none">
                    <Label>Vencer o tie-break por 2 pontos</Label>
                    <Description className="-mt-1.5 mb-1">
                      Ative para exigir dois pontos de diferença no tie-break.
                    </Description>
                  </View>
                </PressableFeedback>
                <FieldError>
                  {errors?.matchConfig?.tieBreakMustWinByTwo ?? ""}
                </FieldError>
              </View>
            ) : null}
          </View>

          <TextField isInvalid={Boolean(errors?.matchConfig?.finalSetMode)}>
            <Label>Formato do último set</Label>
            <Description className="-mt-1.5 mb-1">
              Escolha se o último set segue igual, vira um set próprio ou um
              super tie-break.
            </Description>
            <Select
              isDisabled={isDisabled}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  updateMatchConfig({
                    finalSetMode:
                      nextValue.value as MatchConfig["finalSetMode"],
                  });
                }
              }}
              selectionMode={"single"}
              value={getSelectedOption(
                finalSetModeOptions,
                value.matchConfig.finalSetMode
              )}
            >
              <Select.Trigger>
                <Select.Value
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
            <FieldError>{errors?.matchConfig?.finalSetMode ?? ""}</FieldError>
          </TextField>

          {value.matchConfig.finalSetMode === "custom_set" ? (
            <View className="gap-4 rounded-2xl border border-border bg-background px-4 py-3">
              <TextField
                isInvalid={Boolean(errors?.matchConfig?.finalSetGamesPerSet)}
                isRequired
              >
                <Label>Quantos games no último set?</Label>
                <Description className="-mt-1.5 mb-1">
                  Quantidade padrão de games para o último set.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={value.matchConfig.finalSetGamesPerSet}
                  isDisabled={isDisabled}
                  maxValue={12}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    updateMatchConfig({ finalSetGamesPerSet: nextValue });
                  }}
                  step={1}
                  value={value.matchConfig.finalSetGamesPerSet}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors?.matchConfig?.finalSetGamesPerSet ?? ""}
                </FieldError>
              </TextField>

              <TextField
                isInvalid={Boolean(errors?.matchConfig?.finalSetScoringMode)}
              >
                <Label>Pontuação do último set</Label>
                <Description className="-mt-1.5 mb-1">
                  Escolha se o último set usa vantagem ou no-ad.
                </Description>
                <Select
                  isDisabled={isDisabled}
                  onValueChange={(nextValue) => {
                    if (nextValue && !Array.isArray(nextValue)) {
                      updateMatchConfig({
                        finalSetScoringMode:
                          nextValue.value as MatchConfig["finalSetScoringMode"],
                      });
                    }
                  }}
                  selectionMode={"single"}
                  value={getSelectedOption(
                    scoringModeOptions,
                    value.matchConfig.finalSetScoringMode
                  )}
                >
                  <Select.Trigger>
                    <Select.Value
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
                  {errors?.matchConfig?.finalSetScoringMode ?? ""}
                </FieldError>
              </TextField>

              <PressableFeedback
                className="flex-row items-center gap-3"
                isDisabled={isDisabled}
                onPress={() => {
                  updateMatchConfig({
                    finalSetMustWinByTwoGames:
                      !value.matchConfig.finalSetMustWinByTwoGames,
                  });
                }}
              >
                <Checkbox
                  className="mt-0.5"
                  isDisabled={isDisabled}
                  isSelected={value.matchConfig.finalSetMustWinByTwoGames}
                  pointerEvents="none"
                />
                <View className="flex-1 gap-0" pointerEvents="none">
                  <Label>Vencer o último set por 2 games</Label>
                  <Description className="-mt-1.5 mb-1">
                    Ative para exigir dois games de diferença no último set.
                  </Description>
                </View>
              </PressableFeedback>
              <FieldError>
                {errors?.matchConfig?.finalSetMustWinByTwoGames ?? ""}
              </FieldError>

              <PressableFeedback
                className="flex-row items-center gap-3"
                isDisabled={isDisabled}
                onPress={() => {
                  updateMatchConfig({
                    finalSetHasTieBreak: !value.matchConfig.finalSetHasTieBreak,
                  });
                }}
              >
                <Checkbox
                  className="mt-0.5"
                  isDisabled={isDisabled}
                  isSelected={value.matchConfig.finalSetHasTieBreak}
                  pointerEvents="none"
                />
                <View className="flex-1 gap-0" pointerEvents="none">
                  <Label>Tie-break no último set</Label>
                  <Description className="-mt-1.5 mb-1">
                    Ative para configurar tie-break também no último set.
                  </Description>
                </View>
              </PressableFeedback>
              <FieldError>
                {errors?.matchConfig?.finalSetHasTieBreak ?? ""}
              </FieldError>

              {value.matchConfig.finalSetHasTieBreak ? (
                <View className="gap-4">
                  <TextField
                    isInvalid={Boolean(
                      errors?.matchConfig?.finalSetTieBreakAtGamesAll
                    )}
                    isRequired
                  >
                    <Label>Em qual placar entra o tie-break final?</Label>
                    <Description className="-mt-1.5 mb-1">
                      Exemplo: informe 6 para tie-break final em 6x6.
                    </Description>
                    <NumberStepper
                      className="self-start"
                      defaultValue={
                        value.matchConfig.finalSetTieBreakAtGamesAll
                      }
                      isDisabled={isDisabled}
                      maxValue={12}
                      minValue={1}
                      onValueChange={(nextValue) => {
                        updateMatchConfig({
                          finalSetTieBreakAtGamesAll: nextValue,
                        });
                      }}
                      step={1}
                      value={value.matchConfig.finalSetTieBreakAtGamesAll}
                    >
                      <NumberStepper.DecrementButton />
                      <NumberStepper.Value />
                      <NumberStepper.IncrementButton />
                    </NumberStepper>
                    <FieldError>
                      {errors?.matchConfig?.finalSetTieBreakAtGamesAll ?? ""}
                    </FieldError>
                  </TextField>

                  <TextField
                    isInvalid={Boolean(
                      errors?.matchConfig?.finalSetTieBreakPoints
                    )}
                    isRequired
                  >
                    <Label>Quantos pontos no tie-break final?</Label>
                    <Description className="-mt-1.5 mb-1">
                      Pontuação padrão do tie-break no último set.
                    </Description>
                    <NumberStepper
                      className="self-start"
                      defaultValue={value.matchConfig.finalSetTieBreakPoints}
                      isDisabled={isDisabled}
                      maxValue={30}
                      minValue={1}
                      onValueChange={(nextValue) => {
                        updateMatchConfig({
                          finalSetTieBreakPoints: nextValue,
                        });
                      }}
                      step={1}
                      value={value.matchConfig.finalSetTieBreakPoints}
                    >
                      <NumberStepper.DecrementButton />
                      <NumberStepper.Value />
                      <NumberStepper.IncrementButton />
                    </NumberStepper>
                    <FieldError>
                      {errors?.matchConfig?.finalSetTieBreakPoints ?? ""}
                    </FieldError>
                  </TextField>

                  <PressableFeedback
                    className="flex-row items-center gap-3"
                    isDisabled={isDisabled}
                    onPress={() => {
                      updateMatchConfig({
                        finalSetTieBreakMustWinByTwo:
                          !value.matchConfig.finalSetTieBreakMustWinByTwo,
                      });
                    }}
                  >
                    <Checkbox
                      className="mt-0.5"
                      isDisabled={isDisabled}
                      isSelected={
                        value.matchConfig.finalSetTieBreakMustWinByTwo
                      }
                      pointerEvents="none"
                    />
                    <View className="flex-1 gap-0" pointerEvents="none">
                      <Label>Vencer o tie-break final por 2 pontos</Label>
                      <Description className="-mt-1.5 mb-1">
                        Ative para exigir dois pontos de diferença no tie-break
                        do último set.
                      </Description>
                    </View>
                  </PressableFeedback>
                  <FieldError>
                    {errors?.matchConfig?.finalSetTieBreakMustWinByTwo ?? ""}
                  </FieldError>
                </View>
              ) : null}
            </View>
          ) : null}

          {value.matchConfig.finalSetMode === "super_tiebreak" ? (
            <View className="gap-4 rounded-2xl border border-border bg-background px-4 py-3">
              <TextField
                isInvalid={Boolean(
                  errors?.matchConfig?.finalSetSuperTieBreakPoints
                )}
                isRequired
              >
                <Label>Quantos pontos no super tie-break?</Label>
                <Description className="-mt-1.5 mb-1">
                  Pontuação padrão do super tie-break no lugar do último set.
                </Description>
                <NumberStepper
                  className="self-start"
                  defaultValue={value.matchConfig.finalSetSuperTieBreakPoints}
                  isDisabled={isDisabled}
                  maxValue={30}
                  minValue={1}
                  onValueChange={(nextValue) => {
                    updateMatchConfig({
                      finalSetSuperTieBreakPoints: nextValue,
                    });
                  }}
                  step={1}
                  value={value.matchConfig.finalSetSuperTieBreakPoints}
                >
                  <NumberStepper.DecrementButton />
                  <NumberStepper.Value />
                  <NumberStepper.IncrementButton />
                </NumberStepper>
                <FieldError>
                  {errors?.matchConfig?.finalSetSuperTieBreakPoints ?? ""}
                </FieldError>
              </TextField>

              <PressableFeedback
                className="flex-row items-center gap-3"
                isDisabled={isDisabled}
                onPress={() => {
                  updateMatchConfig({
                    finalSetSuperTieBreakMustWinByTwo:
                      !value.matchConfig.finalSetSuperTieBreakMustWinByTwo,
                  });
                }}
              >
                <Checkbox
                  className="mt-0.5"
                  isDisabled={isDisabled}
                  isSelected={
                    value.matchConfig.finalSetSuperTieBreakMustWinByTwo
                  }
                  pointerEvents="none"
                />
                <View className="flex-1 gap-0" pointerEvents="none">
                  <Label>Vencer o super tie-break por 2 pontos</Label>
                  <Description className="-mt-1.5 mb-1">
                    Ative para exigir dois pontos de diferença no super
                    tie-break.
                  </Description>
                </View>
              </PressableFeedback>
              <FieldError>
                {errors?.matchConfig?.finalSetSuperTieBreakMustWinByTwo ?? ""}
              </FieldError>
            </View>
          ) : null}
        </Tabs.Content>
      </Tabs>
    </View>
  );
};
