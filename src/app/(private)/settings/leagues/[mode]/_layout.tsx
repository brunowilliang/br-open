import type {
  CreateLeagueInput,
  League,
  UpdateLeagueInput,
} from "@convex/domains/league/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Tabs as RouterTabs,
  useLocalSearchParams,
  useRouter,
  useSegments,
} from "expo-router";
import { useThemeColor, useToast } from "heroui-native";
import { useMemo } from "react";

import { Text } from "@/components/core/text";
import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import { buildCreateLeagueDefaultValues } from "@/components/pages/leagues/form-defaults";
import type { LeagueScreenValues } from "@/components/pages/leagues/form-schema";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormFallback } from "@/components/ui/form-fallback";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  LeagueFormHost,
  useLeagueFormController,
} from "@/lib/leagues/league-form-controller";
import {
  LEAGUE_FORM_TAB_ITEMS,
  LEAGUE_FORM_TAB_ROUTE_NAMES,
  getCreateLeagueFormPathname,
  getEditLeagueFormPathname,
  resolveLeagueFormTabValueFromRouteName,
  type LeagueFormTabValue,
} from "@/lib/leagues/league-form-navigation";
import {
  getCreateLeagueFormSessionKey,
  getEditLeagueFormSessionKey,
} from "@/lib/leagues/league-form-store";

type FallbackColor = "danger" | "muted";
type LeagueFormTarget =
  | {
      mode: "create";
    }
  | {
      leagueId: string;
      mode: "edit";
    }
  | {
      message: string;
      mode: "invalid";
      title: string;
    };

import { normalizeRouteParam } from "@/lib/router/normalize-param";

function resolveLeagueFormTarget(input: {
  leagueId?: string | string[];
  mode?: string | string[];
}): LeagueFormTarget {
  const mode = normalizeRouteParam(input.mode);

  if (mode === "new") {
    return { mode: "create" };
  }

  if (mode === "edit") {
    const leagueId = normalizeRouteParam(input.leagueId)?.trim();

    if (leagueId) {
      return {
        leagueId,
        mode: "edit",
      };
    }

    return {
      message: "Liga inválida.",
      mode: "invalid",
      title: "Editar Liga",
    };
  }

  return {
    message: "Fluxo de liga inválido.",
    mode: "invalid",
    title: "Liga",
  };
}

function toCreateLeagueInput(values: LeagueScreenValues): CreateLeagueInput {
  return {
    approvalMode: values.approvalMode,
    avatarStorageId: values.avatarStorageId,
    categories: values.categories,
    city: values.city,
    courts: values.courts,
    coverStorageId: values.coverStorageId,
    description: values.description,
    gracePeriodDays: values.gracePeriodDays,
    locationNotes: values.locationNotes,
    maxPlayers: values.maxPlayers,
    monthlyPriceCents: values.monthlyPriceCents,
    name: values.name,
    priceBillingInterval: values.priceBillingInterval,
    reminderDaysBefore: values.reminderDaysBefore,
    ruleConfig: values.ruleConfig,
    state: values.state,
    visibility: values.visibility,
  };
}

function toLeagueScreenValues(league: League): LeagueScreenValues {
  return {
    approvalMode: league.approvalMode,
    avatarStorageId: league.avatarStorageId,
    categories: league.categories,
    city: league.city,
    courts: league.courts,
    coverStorageId: league.coverStorageId,
    description: league.description ?? "",
    gracePeriodDays: league.gracePeriodDays,
    locationNotes: league.locationNotes ?? "",
    maxPlayers: league.maxPlayers,
    monthlyPriceCents: league.monthlyPriceCents,
    name: league.name,
    priceBillingInterval: league.priceBillingInterval,
    reminderDaysBefore: league.reminderDaysBefore,
    ruleConfig: league.ruleConfig,
    state: league.state,
    visibility: league.visibility,
  };
}

function toUpdateLeagueInput(
  leagueId: string,
  values: LeagueScreenValues
): UpdateLeagueInput {
  return {
    approvalMode: values.approvalMode,
    avatarStorageId: values.avatarStorageId,
    categories: values.categories,
    city: values.city,
    courts: values.courts,
    coverStorageId: values.coverStorageId,
    description: values.description,
    gracePeriodDays: values.gracePeriodDays,
    leagueId,
    locationNotes: values.locationNotes,
    maxPlayers: values.maxPlayers,
    monthlyPriceCents: values.monthlyPriceCents,
    name: values.name,
    priceBillingInterval: values.priceBillingInterval,
    reminderDaysBefore: values.reminderDaysBefore,
    ruleConfig: values.ruleConfig,
    state: values.state,
    visibility: values.visibility,
  };
}

function LeagueFormMessage(props: { color: FallbackColor; message: string }) {
  return <Text color={props.color}>{props.message}</Text>;
}

function LeagueFormTabs(props: {
  controller: ReturnType<typeof useLeagueFormController>;
}) {
  const backgroundColor = useThemeColor("background");

  return (
    <LeagueFormHost controller={props.controller}>
      <RouterTabs
        detachInactiveScreens={false}
        screenOptions={{
          animation: "fade",
          headerShown: false,
          sceneStyle: { backgroundColor },
        }}
        tabBar={(tabBarProps) => (
          <FloatingTabBar
            {...tabBarProps}
            items={LEAGUE_FORM_TAB_ITEMS}
            resolveValueFromRouteName={resolveLeagueFormTabValueFromRouteName}
            routeNames={LEAGUE_FORM_TAB_ROUTE_NAMES}
            triggerClassName="w-11"
          />
        )}
      >
        {LEAGUE_FORM_TAB_ITEMS.map((item) => (
          <RouterTabs.Screen key={item.routeName} name={item.routeName} />
        ))}
      </RouterTabs>
    </LeagueFormHost>
  );
}

function CreateLeagueForm(props: {
  isPending: boolean;
  onSubmit: (input: LeagueScreenValues) => Promise<void>;
  onValidationTabRequest: (tab: LeagueFormTabValue) => void;
}) {
  const defaultValues = useMemo(() => buildCreateLeagueDefaultValues(), []);
  const controller = useLeagueFormController({
    defaultValues,
    isPending: props.isPending,
    isRulesLocked: false,
    mode: "create",
    onSubmit: props.onSubmit,
    onValidationTabRequest: props.onValidationTabRequest,
    sessionKey: getCreateLeagueFormSessionKey(),
    showDelete: false,
    title: "Criar Liga",
  });

  return <LeagueFormTabs controller={controller} />;
}

function EditLeagueForm(props: {
  isPending: boolean;
  league: League;
  leagueId: string;
  onDelete: () => Promise<void>;
  onSubmit: (input: LeagueScreenValues) => Promise<void>;
  onValidationTabRequest: (tab: LeagueFormTabValue) => void;
}) {
  const defaultValues = useMemo(
    () => toLeagueScreenValues(props.league),
    [props.league]
  );
  const mediaUrls = useMemo(
    () => ({
      avatarUrl: props.league.avatarUrl,
      coverUrl: props.league.coverUrl,
    }),
    [props.league.avatarUrl, props.league.coverUrl]
  );
  const controller = useLeagueFormController({
    defaultValues,
    isPending: props.isPending,
    mediaUrls,
    mode: "edit",
    onDelete: props.onDelete,
    onSubmit: props.onSubmit,
    onValidationTabRequest: props.onValidationTabRequest,
    sessionKey: getEditLeagueFormSessionKey(props.leagueId),
    title: "Editar Liga",
  });

  return <LeagueFormTabs controller={controller} />;
}

export default function LeagueFormLayout() {
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { leagueId: rawLeagueId, mode: rawMode } = useLocalSearchParams<{
    leagueId?: string | string[];
    mode?: string | string[];
  }>();
  const segments = useSegments();
  const target = resolveLeagueFormTarget({
    leagueId: rawLeagueId,
    mode: rawMode,
  });
  const activeTabLabel =
    LEAGUE_FORM_TAB_ITEMS.find((item) => item.routeName === segments.at(-1))
      ?.label ?? LEAGUE_FORM_TAB_ITEMS[0].label;

  const viewerContext = useQuery({
    ...crpc.viewer.context.get.staticQueryOptions(),
    enabled: target.mode === "create",
  });
  const leagueQuery = useQuery({
    ...crpc.league.management.getById.staticQueryOptions({
      leagueId: target.mode === "edit" ? target.leagueId : "",
    }),
    enabled: target.mode === "edit",
  });
  const createLeague = useMutation({
    mutationFn: crpcClient.league.management.create.mutate,
    mutationKey: crpc.league.management.create.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível criar a liga. Tente novamente."
        ),
        id: "create-league-error",
        label: "Falha ao criar liga",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        crpc.league.management.listMine.queryFilter()
      );
      toast.show({
        description: "Sua liga já está disponível para os jogadores.",
        id: "create-league-success",
        label: "Liga criada",
        variant: "success",
      });
      router.replace("/settings/leagues");
    },
  });
  const updateLeague = useMutation({
    mutationFn: crpcClient.league.management.update.mutate,
    mutationKey: crpc.league.management.update.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível atualizar a liga. Tente novamente."
        ),
        id: "update-league-error",
        label: "Falha ao salvar alterações",
        variant: "danger",
      });
    },
    onSuccess: async (updatedLeague) => {
      await Promise.all([
        queryClient.invalidateQueries(
          crpc.league.management.listMine.queryFilter()
        ),
        queryClient.invalidateQueries(
          crpc.league.management.getById.queryFilter({
            leagueId: updatedLeague.id,
          })
        ),
      ]);
      toast.show({
        description: "As informações da liga foram atualizadas.",
        id: "update-league-success",
        label: "Alterações salvas",
        variant: "success",
      });
    },
  });
  const deleteLeague = useMutation({
    mutationFn: crpcClient.league.management.remove.mutate,
    mutationKey: crpc.league.management.remove.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível excluir a liga. Tente novamente."
        ),
        id: "delete-league-error",
        label: "Falha ao remover liga",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        crpc.league.management.listMine.queryFilter()
      );
      toast.show({
        description: "A liga foi excluída permanentemente.",
        id: "delete-league-success",
        label: "Liga removida",
        variant: "success",
      });
      router.replace("/settings/leagues");
    },
  });

  async function handleCreate(input: LeagueScreenValues) {
    createLeague.reset();
    await createLeague.mutateAsync(toCreateLeagueInput(input));
  }

  async function handleUpdate(values: LeagueScreenValues) {
    if (!(target.mode === "edit" && leagueQuery.data)) {
      return;
    }

    updateLeague.reset();
    await updateLeague.mutateAsync(
      toUpdateLeagueInput(target.leagueId, values)
    );
  }

  async function handleDelete() {
    if (target.mode !== "edit") {
      return;
    }

    deleteLeague.reset();
    await deleteLeague.mutateAsync({ leagueId: target.leagueId });
  }

  function handleValidationTabRequest(tab: LeagueFormTabValue) {
    if (target.mode === "create") {
      router.navigate({
        params: { mode: "new" },
        pathname: getCreateLeagueFormPathname(tab),
      });
      return;
    }

    if (target.mode === "edit") {
      router.navigate({
        params: { leagueId: target.leagueId, mode: "edit" },
        pathname: getEditLeagueFormPathname(tab),
      });
    }
  }

  if (target.mode === "invalid") {
    return (
      <FormFallback title={target.title}>
        <LeagueFormMessage color="danger" message={target.message} />
      </FormFallback>
    );
  }

  if (target.mode === "create") {
    const canManageLeagues =
      viewerContext.data?.capabilities?.canCreateLeague ?? false;

    if (viewerContext.isPending) {
      return (
        <FormFallback description="Criar Liga" title={activeTabLabel}>
          <LoadingState />
        </FormFallback>
      );
    }

    if (viewerContext.isError) {
      return (
        <FormFallback title="Criar Liga">
          <ErrorState
            error={viewerContext.error}
            message="Não foi possível carregar seu modo de acesso."
          />
        </FormFallback>
      );
    }

    if (!canManageLeagues) {
      return (
        <FormFallback title="Criar Liga">
          <EmptyState
            buttonLabel="Voltar"
            buttonOnPress={() => router.back()}
            description="Você está usando o app como jogador. Entre como organizador para criar ligas."
            title="Modo jogador"
          />
        </FormFallback>
      );
    }

    return (
      <CreateLeagueForm
        isPending={createLeague.isPending}
        onSubmit={handleCreate}
        onValidationTabRequest={handleValidationTabRequest}
      />
    );
  }

  if (leagueQuery.isPending) {
    return (
      <FormFallback description="Editar Liga" title={activeTabLabel}>
        <LoadingState />
      </FormFallback>
    );
  }

  if (leagueQuery.isError || !leagueQuery.data) {
    return (
      <FormFallback title="Editar Liga">
        <LeagueFormMessage
          color="danger"
          message={
            leagueQuery.error?.message || "Não foi possível carregar a liga."
          }
        />
      </FormFallback>
    );
  }

  return (
    <EditLeagueForm
      isPending={updateLeague.isPending || deleteLeague.isPending}
      key={`${leagueQuery.data.id}:${leagueQuery.data.updatedAt}`}
      league={leagueQuery.data}
      leagueId={target.leagueId}
      onDelete={handleDelete}
      onSubmit={handleUpdate}
      onValidationTabRequest={handleValidationTabRequest}
    />
  );
}
