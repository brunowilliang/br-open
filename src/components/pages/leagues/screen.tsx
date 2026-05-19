import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Menu, Tabs } from "heroui-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { Categories } from "@/components/pages/leagues/categories";
import { Details } from "@/components/pages/leagues/details";
import { Location } from "@/components/pages/leagues/location";
import { Rules } from "@/components/pages/leagues/rules";
import { Settings } from "@/components/pages/leagues/settings";
import { HugeIcons } from "@/components/ui/huge-icons";
import { Page } from "@/components/ui/page";
import { CreateLeagueSchema } from "@convex/domains/league/contract";
import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";

type CategoryItem = {
  id: string;
  name: string;
};

const LeagueSchema = z.object({
  name: CreateLeagueSchema.shape.name,
  description: CreateLeagueSchema.shape.description,
  regulation: CreateLeagueSchema.shape.regulation,
  city: CreateLeagueSchema.shape.city,
  state: CreateLeagueSchema.shape.state,
  locationNotes: CreateLeagueSchema.shape.locationNotes,
  visibility: CreateLeagueSchema.shape.visibility,
  categories: CreateLeagueSchema.shape.categories,
  ruleConfig: CreateLeagueSchema.shape.ruleConfig,
});

export type LeagueScreenValues = z.infer<typeof LeagueSchema>;

type LeagueScreenProps = {
  defaultValues: LeagueScreenValues;
  isPending?: boolean;
  isRulesLocked?: boolean;
  mode: "create" | "edit";
  onDelete?: () => Promise<void>;
  onSubmit: (values: LeagueScreenValues) => Promise<void>;
  rankingContent?: ReactNode;
  requestsContent?: ReactNode;
  showDelete?: boolean;
  title: string;
};

export function LeagueScreen(props: LeagueScreenProps) {
  const {
    defaultValues,
    isPending,
    isRulesLocked,
    mode,
    onDelete,
    onSubmit,
    rankingContent,
    requestsContent,
    showDelete,
    title,
  } = props;
  const [activeTab, setActiveTab] = useState("details");

  const form = useForm<LeagueScreenValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(LeagueSchema),
  });

  const values = form.watch();
  const errors = form.formState.errors;
  const isSubmitPending = isPending || form.formState.isSubmitting;
  const categoryItems: CategoryItem[] = values.categories.map(
    (categoryName, index) => ({
      id: String(index + 1),
      name: categoryName,
    })
  );

  const submitForm = form.handleSubmit(async (input) => {
    await onSubmit(input);
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  return (
    <Tabs
      className="flex-1"
      onValueChange={setActiveTab}
      value={activeTab}
      variant="primary"
    >
      <Page>
        <Page.Header>
          <View className="flex-1 flex-col gap-2">
            <View className="flex-1 flex-row">
              <Page.Header.Left>
                <Page.Header.BackButton />
              </Page.Header.Left>
              <Page.Header.Center>
                <Page.Header.Title>{title}</Page.Header.Title>
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
                        <Menu.ItemTitle className="flex-none">
                          Salvar
                        </Menu.ItemTitle>
                        <HugeIcons icon={CheckmarkCircle02Icon} />
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu>
              </Page.Header.Right>
            </View>
            <Tabs.List>
              <Tabs.ScrollView>
                <Tabs.Indicator />
                <Tabs.Trigger value="details">
                  <Tabs.Label>Detalhes</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger value="location">
                  <Tabs.Label>Localização</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger value="categories">
                  <Tabs.Label>Categorias</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger value="rules">
                  <Tabs.Label>Regras</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger value="settings">
                  <Tabs.Label>Configurações</Tabs.Label>
                </Tabs.Trigger>
                {mode === "edit" ? (
                  <Tabs.Trigger value="requests">
                    <Tabs.Label>Solicitações</Tabs.Label>
                  </Tabs.Trigger>
                ) : null}
                {mode === "edit" ? (
                  <Tabs.Trigger value="ranking">
                    <Tabs.Label>Ranking</Tabs.Label>
                  </Tabs.Trigger>
                ) : null}
              </Tabs.ScrollView>
            </Tabs.List>
          </View>
        </Page.Header>

        <Page.KeyboardAwareScrollView contentContainerClassName="px-4 pb-safe-offset-4">
          <Tabs.Content className="gap-4" value="details">
            <Details
              description={values.description ?? ""}
              descriptionError={errors.description?.message}
              isDisabled={isSubmitPending}
              name={values.name}
              nameError={errors.name?.message}
              onDescriptionBlur={() => {
                form.trigger("description").catch(() => undefined);
              }}
              onDescriptionChange={(value) => {
                form.setValue("description", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onNameBlur={() => {
                form.trigger("name").catch(() => undefined);
              }}
              onNameChange={(value) => {
                form.setValue("name", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onRegulationBlur={() => {
                form.trigger("regulation").catch(() => undefined);
              }}
              onRegulationChange={(value) => {
                form.setValue("regulation", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              regulation={values.regulation ?? ""}
              regulationError={errors.regulation?.message}
            />
          </Tabs.Content>

          <Tabs.Content className="gap-4" value="location">
            <Location
              city={values.city}
              cityError={errors.city?.message}
              isDisabled={isSubmitPending}
              locationNotes={values.locationNotes ?? ""}
              locationNotesError={errors.locationNotes?.message}
              onCityBlur={() => {
                form.trigger("city").catch(() => undefined);
              }}
              onCityChange={(value) => {
                form.setValue("city", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onLocationNotesBlur={() => {
                form.trigger("locationNotes").catch(() => undefined);
              }}
              onLocationNotesChange={(value) => {
                form.setValue("locationNotes", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onStateBlur={() => {
                form.trigger("state").catch(() => undefined);
              }}
              onStateChange={(value) => {
                form.setValue("state", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              state={values.state}
              stateError={errors.state?.message}
            />
          </Tabs.Content>

          <Tabs.Content className="gap-4" value="categories">
            <Categories
              categories={categoryItems}
              error={errors.categories?.message}
              isDisabled={isSubmitPending}
              onChange={(nextCategories) => {
                form.setValue(
                  "categories",
                  nextCategories.map((category) => category.name),
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  }
                );
              }}
            />
          </Tabs.Content>

          <Tabs.Content className="gap-4" value="rules">
            <Rules
              errors={{
                hasInactivityPenalty:
                  errors.ruleConfig?.hasInactivityPenalty?.message,
                inactivityPenaltyDays:
                  errors.ruleConfig?.inactivityPenaltyDays?.message,
                inactivityPenaltyType:
                  errors.ruleConfig?.inactivityPenaltyType?.message,
                lossBehavior: errors.ruleConfig?.lossBehavior?.message,
                maxActiveChallengesPerPlayer:
                  errors.ruleConfig?.maxActiveChallengesPerPlayer?.message,
                maxChallengeDistance:
                  errors.ruleConfig?.maxChallengeDistance?.message,
                maxChallengesPerMonth:
                  errors.ruleConfig?.maxChallengesPerMonth?.message,
                newPlayerPlacement:
                  errors.ruleConfig?.newPlayerPlacement?.message,
                responseDeadlineHours:
                  errors.ruleConfig?.responseDeadlineHours?.message,
                walkoverBehavior: errors.ruleConfig?.walkoverBehavior?.message,
                winBehavior: errors.ruleConfig?.winBehavior?.message,
              }}
              isDisabled={isSubmitPending || isRulesLocked}
              isLocked={isRulesLocked}
              onChange={(nextRuleConfig) => {
                form.setValue("ruleConfig", nextRuleConfig, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              value={values.ruleConfig}
            />
          </Tabs.Content>

          <Tabs.Content className="gap-4" value="settings">
            <Settings
              isDisabled={isSubmitPending}
              onChange={(value) => {
                form.setValue("visibility", value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              onDelete={onDelete}
              showDelete={mode === "edit" && (showDelete ?? true)}
              value={values.visibility}
              visibilityError={errors.visibility?.message}
            />
          </Tabs.Content>

          {mode === "edit" ? (
            <Tabs.Content className="gap-4" value="requests">
              {requestsContent}
            </Tabs.Content>
          ) : null}

          {mode === "edit" ? (
            <Tabs.Content className="gap-4" value="ranking">
              {rankingContent}
            </Tabs.Content>
          ) : null}
        </Page.KeyboardAwareScrollView>
      </Page>
    </Tabs>
  );
}
