import type {
  CreateTournamentInput,
  Tournament,
  UpdateTournamentInput,
} from "@convex/domains/tournament/contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Tabs as RouterTabs,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { useThemeColor, useToast } from "heroui-native";
import { useMemo, type ReactNode } from "react";

import { Text } from "@/components/core/text";
import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";
import { buildCreateTournamentDefaultValues } from "@/components/pages/tournaments/form-defaults";
import {
  epochMsToTournamentDate,
  tournamentDateToEpochMs,
  type TournamentScreenValues,
} from "@/components/pages/tournaments/form-schema";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Page } from "@/components/core/NewPage";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { normalizeRouteParam } from "@/lib/router/normalize-param";
import {
  TOURNAMENT_FORM_TAB_ITEMS,
  TOURNAMENT_FORM_TAB_ROUTE_NAMES,
  getCreateTournamentFormPathname,
  getEditTournamentFormPathname,
  resolveTournamentFormTabValueFromRouteName,
  type TournamentFormTabValue,
} from "@/lib/tournaments/tournament-form-navigation";
import {
  TournamentFormHost,
  useTournamentFormController,
} from "@/lib/tournaments/tournament-form-controller";
import {
  getCreateTournamentFormSessionKey,
  getEditTournamentFormSessionKey,
} from "@/lib/tournaments/tournament-form-store";

type FallbackColor = "danger" | "muted";
type TournamentFormTarget =
  | { mode: "create" }
  | { mode: "edit"; tournamentId: string }
  | { message: string; mode: "invalid"; title: string };

type ManagedTournament = {
  categories: Array<{
    entryFeeCents: number;
    gender: "female" | "male" | "mixed";
    maxEntries: null | number;
    modality: "doubles" | "singles";
  }>;
  tournament: Tournament;
};

function resolveTournamentFormTarget(input: {
  mode?: string | string[];
  tournamentId?: string | string[];
}): TournamentFormTarget {
  const mode = normalizeRouteParam(input.mode);

  if (mode === "new") {
    return { mode: "create" };
  }

  if (mode === "edit") {
    const tournamentId = normalizeRouteParam(input.tournamentId)?.trim();

    if (tournamentId) {
      return {
        mode: "edit",
        tournamentId,
      };
    }

    return {
      message: "Torneio inválido.",
      mode: "invalid",
      title: "Editar Torneio",
    };
  }

  return {
    message: "Não foi possível abrir este torneio.",
    mode: "invalid",
    title: "Torneio",
  };
}

function toCreateTournamentInput(
  values: TournamentScreenValues
): CreateTournamentInput {
  return {
    approvalMode: values.approvalMode,
    avatarStorageId: values.avatarStorageId,
    categories: values.categories,
    city: values.city,
    courts: values.courts,
    coverStorageId: values.coverStorageId,
    description: values.description,
    locationNotes: values.locationNotes,
    matchConfig: values.matchConfig,
    name: values.name,
    registrationDeadlineAt: tournamentDateToEpochMs(
      values.registrationDeadlineAt
    ),
    startDate: tournamentDateToEpochMs(values.startDate),
    state: values.state,
    visibility: values.visibility,
  };
}

function toTournamentScreenValues(
  managed: ManagedTournament
): TournamentScreenValues {
  const tournament = managed.tournament;

  return {
    approvalMode: tournament.approvalMode,
    avatarStorageId: tournament.avatarStorageId,
    categories: managed.categories.map((category) => ({
      entryFeeCents: category.entryFeeCents,
      gender: category.gender,
      maxEntries: category.maxEntries,
      modality: category.modality,
    })),
    city: tournament.city,
    courts: tournament.courts,
    coverStorageId: tournament.coverStorageId,
    description: tournament.description ?? "",
    locationNotes: tournament.locationNotes ?? "",
    matchConfig: tournament.matchConfig,
    name: tournament.name,
    registrationDeadlineAt: epochMsToTournamentDate(
      tournament.registrationDeadlineAt
    ),
    startDate: epochMsToTournamentDate(tournament.startDate),
    state: tournament.state,
    visibility: tournament.visibility,
  };
}

function toUpdateTournamentInput(
  tournamentId: string,
  values: TournamentScreenValues
): UpdateTournamentInput {
  return {
    ...toCreateTournamentInput(values),
    tournamentId,
  };
}

function TournamentFormFallback(props: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>{props.title ?? "Torneio"}</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
        {props.children}
      </Page.ScrollView>
    </Page>
  );
}

function TournamentFormMessage(props: {
  color: FallbackColor;
  message: string;
}) {
  return <Text color={props.color}>{props.message}</Text>;
}

function TournamentFormTabs(props: {
  controller: ReturnType<typeof useTournamentFormController>;
}) {
  const backgroundColor = useThemeColor("background");

  return (
    <TournamentFormHost controller={props.controller}>
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
            items={TOURNAMENT_FORM_TAB_ITEMS}
            resolveValueFromRouteName={
              resolveTournamentFormTabValueFromRouteName
            }
            routeNames={TOURNAMENT_FORM_TAB_ROUTE_NAMES}
            triggerClassName="w-11"
          />
        )}
      >
        {TOURNAMENT_FORM_TAB_ITEMS.map((item) => (
          <RouterTabs.Screen key={item.routeName} name={item.routeName} />
        ))}
      </RouterTabs>
    </TournamentFormHost>
  );
}

function CreateTournamentForm(props: {
  isPending: boolean;
  onSubmit: (input: TournamentScreenValues) => Promise<void>;
  onValidationTabRequest: (tab: TournamentFormTabValue) => void;
}) {
  const defaultValues = useMemo(() => buildCreateTournamentDefaultValues(), []);
  const controller = useTournamentFormController({
    defaultValues,
    isPending: props.isPending,
    mode: "create",
    onSubmit: props.onSubmit,
    onValidationTabRequest: props.onValidationTabRequest,
    sessionKey: getCreateTournamentFormSessionKey(),
    showDelete: false,
    title: "Criar Torneio",
  });

  return <TournamentFormTabs controller={controller} />;
}

function EditTournamentForm(props: {
  isPending: boolean;
  managed: ManagedTournament;
  onDelete: () => Promise<void>;
  onSubmit: (input: TournamentScreenValues) => Promise<void>;
  onValidationTabRequest: (tab: TournamentFormTabValue) => void;
  tournamentId: string;
}) {
  const defaultValues = useMemo(
    () => toTournamentScreenValues(props.managed),
    [props.managed]
  );
  const mediaUrls = useMemo(
    () => ({
      avatarUrl: props.managed.tournament.avatarUrl,
      coverUrl: props.managed.tournament.coverUrl,
    }),
    [props.managed.tournament.avatarUrl, props.managed.tournament.coverUrl]
  );
  const controller = useTournamentFormController({
    defaultValues,
    isPending: props.isPending,
    mediaUrls,
    mode: "edit",
    onDelete: props.onDelete,
    onSubmit: props.onSubmit,
    onValidationTabRequest: props.onValidationTabRequest,
    sessionKey: getEditTournamentFormSessionKey(props.tournamentId),
    showDelete: props.managed.tournament.status === "draft",
    title: "Editar Torneio",
  });

  return <TournamentFormTabs controller={controller} />;
}

export default function TournamentFormLayout() {
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mode: rawMode, tournamentId: rawTournamentId } =
    useLocalSearchParams<{
      mode?: string | string[];
      tournamentId?: string | string[];
    }>();
  const target = resolveTournamentFormTarget({
    mode: rawMode,
    tournamentId: rawTournamentId,
  });

  const viewerContext = useQuery({
    ...crpc.viewer.context.get.staticQueryOptions(),
    enabled: target.mode === "create",
  });
  const tournamentQuery = useQuery({
    ...crpc.tournament.management.getById.staticQueryOptions({
      tournamentId: target.mode === "edit" ? target.tournamentId : "",
    }),
    enabled: target.mode === "edit",
  });
  const createTournament = useMutation({
    mutationFn: crpcClient.tournament.management.create.mutate,
    mutationKey: crpc.tournament.management.create.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível criar o torneio. Tente novamente."
        ),
        id: "create-tournament-error",
        label: "Falha ao criar torneio",
        variant: "danger",
      });
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries(
        crpc.tournament.management.listMine.queryFilter()
      );
      toast.show({
        description: "Rascunho criado. Publique quando estiver tudo pronto.",
        id: "create-tournament-success",
        label: "Torneio criado",
        variant: "success",
      });
      router.replace(`/tournaments/${created.id}` as Href);
    },
  });
  const updateTournament = useMutation({
    mutationFn: crpcClient.tournament.management.update.mutate,
    mutationKey: crpc.tournament.management.update.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível atualizar o torneio. Tente novamente."
        ),
        id: "update-tournament-error",
        label: "Falha ao salvar alterações",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(
          crpc.tournament.management.listMine.queryFilter()
        ),
        queryClient.invalidateQueries(
          crpc.tournament.management.getById.queryFilter({
            tournamentId: target.mode === "edit" ? target.tournamentId : "",
          })
        ),
      ]);
      toast.show({
        description: "As informações do torneio foram atualizadas.",
        id: "update-tournament-success",
        label: "Alterações salvas",
        variant: "success",
      });
    },
  });
  const deleteTournament = useMutation({
    mutationFn: crpcClient.tournament.management.remove.mutate,
    mutationKey: crpc.tournament.management.remove.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível excluir o torneio. Tente novamente."
        ),
        id: "delete-tournament-error",
        label: "Falha ao remover torneio",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(
        crpc.tournament.management.listMine.queryFilter()
      );
      toast.show({
        description: "O torneio foi excluído permanentemente.",
        id: "delete-tournament-success",
        label: "Torneio removido",
        variant: "success",
      });
      router.back();
    },
  });

  async function handleCreate(input: TournamentScreenValues) {
    createTournament.reset();
    await createTournament.mutateAsync(toCreateTournamentInput(input));
  }

  async function handleUpdate(values: TournamentScreenValues) {
    if (!(target.mode === "edit" && tournamentQuery.data)) {
      return;
    }

    updateTournament.reset();
    await updateTournament.mutateAsync(
      toUpdateTournamentInput(target.tournamentId, values)
    );
  }

  async function handleDelete() {
    if (target.mode !== "edit") {
      return;
    }

    deleteTournament.reset();
    await deleteTournament.mutateAsync({ tournamentId: target.tournamentId });
  }

  function handleValidationTabRequest(tab: TournamentFormTabValue) {
    if (target.mode === "create") {
      router.navigate({
        params: { mode: "new" },
        pathname: getCreateTournamentFormPathname(tab),
      });
      return;
    }

    if (target.mode === "edit") {
      router.navigate({
        params: { mode: "edit", tournamentId: target.tournamentId },
        pathname: getEditTournamentFormPathname(tab),
      });
    }
  }

  if (target.mode === "invalid") {
    return (
      <TournamentFormFallback title={target.title}>
        <TournamentFormMessage color="danger" message={target.message} />
      </TournamentFormFallback>
    );
  }

  if (target.mode === "create") {
    const canManageTournaments =
      viewerContext.data?.capabilities?.canManageLeagues ?? false;

    if (viewerContext.isPending) {
      return (
        <TournamentFormFallback title="Criar Torneio">
          <LoadingState />
        </TournamentFormFallback>
      );
    }

    if (viewerContext.isError) {
      return (
        <TournamentFormFallback title="Criar Torneio">
          <ErrorState
            error={viewerContext.error}
            message="Não foi possível carregar seu modo de acesso."
          />
        </TournamentFormFallback>
      );
    }

    if (!canManageTournaments) {
      return (
        <TournamentFormFallback title="Criar Torneio">
          <EmptyState
            buttonLabel="Voltar"
            buttonOnPress={() => router.back()}
            description="Você está usando o app como jogador. Entre como organizador para criar torneios."
            title="Modo jogador"
          />
        </TournamentFormFallback>
      );
    }

    return (
      <CreateTournamentForm
        isPending={createTournament.isPending}
        onSubmit={handleCreate}
        onValidationTabRequest={handleValidationTabRequest}
      />
    );
  }

  if (tournamentQuery.isPending) {
    return (
      <TournamentFormFallback title="Editar Torneio">
        <LoadingState />
      </TournamentFormFallback>
    );
  }

  if (tournamentQuery.isError || !tournamentQuery.data) {
    return (
      <TournamentFormFallback title="Editar Torneio">
        <TournamentFormMessage
          color="danger"
          message={
            tournamentQuery.error?.message ||
            "Não foi possível carregar o torneio."
          }
        />
      </TournamentFormFallback>
    );
  }

  return (
    <EditTournamentForm
      isPending={updateTournament.isPending || deleteTournament.isPending}
      key={`${tournamentQuery.data.tournament.id}:${tournamentQuery.data.tournament.updatedAt}`}
      managed={tournamentQuery.data}
      onDelete={handleDelete}
      onSubmit={handleUpdate}
      onValidationTabRequest={handleValidationTabRequest}
      tournamentId={target.tournamentId}
    />
  );
}
