import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Menu, Tabs } from "heroui-native";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { View } from "react-native";

import { Categories } from "@/components/pages/leagues/categories";
import { Courts } from "@/components/pages/leagues/courts";
import { Details } from "@/components/pages/leagues/details";
import {
  LeagueSchema,
  type LeagueScreenValues,
} from "@/components/pages/leagues/form-schema";
import { Location } from "@/components/pages/leagues/location";
import { Rules } from "@/components/pages/leagues/rules";
import { Settings } from "@/components/pages/leagues/settings";
import { HugeIcons } from "@/components/ui/huge-icons";
import { Page } from "@/components/ui/page";
import {
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";

type LeagueScreenProps = {
  defaultValues: LeagueScreenValues;
  isPending?: boolean;
  isRulesLocked?: boolean;
  mode: "create" | "edit";
  onDelete?: () => Promise<void>;
  onSubmit: (values: LeagueScreenValues) => Promise<void>;
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

  const isSubmitPending = isPending || form.formState.isSubmitting;

  const submitForm = form.handleSubmit(async (input) => {
    await onSubmit(input);
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  return (
    <FormProvider {...form}>
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
                  <Tabs.Trigger value="courts">
                    <Tabs.Label>Quadras</Tabs.Label>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="settings">
                    <Tabs.Label>Configurações</Tabs.Label>
                  </Tabs.Trigger>
                </Tabs.ScrollView>
              </Tabs.List>
            </View>
          </Page.Header>

          <Page.KeyboardAwareScrollView contentContainerClassName="px-4 pb-safe-offset-4">
            <Tabs.Content className="gap-4" value="details">
              <Details isDisabled={isSubmitPending} />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="location">
              <Location isDisabled={isSubmitPending} />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="categories">
              <Categories isDisabled={isSubmitPending} />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="rules">
              <Rules
                isDisabled={isSubmitPending || isRulesLocked}
                isLocked={isRulesLocked}
              />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="courts">
              <Courts isDisabled={isSubmitPending} />
            </Tabs.Content>

            <Tabs.Content className="gap-4" value="settings">
              <Settings
                isDisabled={isSubmitPending}
                onDelete={onDelete}
                showDelete={mode === "edit" && (showDelete ?? true)}
              />
            </Tabs.Content>
          </Page.KeyboardAwareScrollView>
        </Page>
      </Tabs>
    </FormProvider>
  );
}
