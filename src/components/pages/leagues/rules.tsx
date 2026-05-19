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
import type { ApiInputs } from "@convex/shared/api";

type CreateLeagueInput = ApiInputs["league"]["management"]["create"];
type RuleConfig = CreateLeagueInput["ruleConfig"];

type RuleErrors = Partial<Record<keyof RuleConfig, string | undefined>>;

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

function getSelectedOption<T extends { label: string; value: string }>(
  options: readonly T[],
  value: string | undefined
) {
  if (!value) {
    return;
  }

  return options.find((option) => option.value === value);
}

export const Rules = ({ errors, isDisabled, onChange, value }: RulesProps) => {
  const [activeTab, setActiveTab] = useState("desafios");

  function updateRuleConfig(patch: Partial<RuleConfig>) {
    onChange({
      ...value,
      ...patch,
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
      </Tabs>
    </View>
  );
};
