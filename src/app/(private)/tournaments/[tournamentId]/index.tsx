import { useValue } from "@legendapp/state/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { useToast } from "heroui-native";
import { useCallback, useRef, useState } from "react";
import type { View } from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Page } from "@/components/core/page";
import { CancelTournamentDialog } from "@/components/pages/tournaments/cancel-tournament-dialog";
import { GuestOverview } from "@/components/pages/tournaments/guest-overview";
import { JoinBlock } from "@/components/pages/tournaments/join-block";
import { OrganizerMenu } from "@/components/pages/tournaments/organizer-menu";
import { OrganizerOverview } from "@/components/pages/tournaments/organizer-overview";
import { PlayerOverview } from "@/components/pages/tournaments/player-overview";
import { TournamentBanner } from "@/components/pages/tournaments/tournament-banner";
import { TournamentScreensMenu } from "@/components/pages/tournaments/tournament-screens-menu";
import { ErrorState } from "@/components/ui/error-state";
import type { JoinFooterCategory } from "@/components/ui/join-footer";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildCategoryTypeLabel } from "@/lib/tournaments/category-editor-derived";
import {
  buildRegistrationWindowState,
  buildTournamentActiveEntriesCountByCategory,
  buildTournamentCategoryVacancy,
  buildTournamentJoinOptions,
} from "@/lib/tournaments/tournament-details-derived";
import { getTournamentDetailsBucket$ } from "@/lib/tournaments/tournament-details-store";

/** Espaço do header flutuante acima do card em foco (respiro + botão + respiro):
 * o card para logo abaixo dele, sem ficar atrás. */
const FOCUS_HEADER_OFFSET = 72;

export default function TournamentOverviewRoute() {
  const { matchId: rawMatchId, tournamentId } = useLocalSearchParams<{
    matchId?: string | string[];
    tournamentId: string;
  }>();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bucket$ = getTournamentDetailsBucket$(tournamentId);
  // O aviso (e o "Combinar" da pendência) trazem o matchId na url: a tela rola
  // até o card do confronto, logo abaixo do header flutuante. Query repetida
  // chega como array (mesmo molde do `_layout`): vale o primeiro.
  const focusMatchParam = Array.isArray(rawMatchId)
    ? rawMatchId[0]
    : rawMatchId;
  const focusMatchId = focusMatchParam || null;
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const insets = useSafeAreaInsets();
  const focusScrollInset = insets.top + FOCUS_HEADER_OFFSET;
  const screenState = useValue(bucket$.derived.screenState);
  const access = useValue(bucket$.derived.access);
  const role = useValue(bucket$.derived.role);
  const tournament = useValue(bucket$.data.tournament);
  const entries = useValue(bucket$.data.entries);
  async function invalidateTournamentContext() {
    await queryClient.invalidateQueries(
      crpc.tournament.discovery.getById.queryFilter({ tournamentId })
    );
  }

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // O card em foco se registra aqui na montagem; a medida é relativa ao scroll,
  // então rolar até o y devolvido põe o card no lugar (um frame para o layout
  // do card existir antes da medida).
  const focusCardRef = useCallback(
    (node: View | null) => {
      const scroll = scrollRef.current;

      if (!(node && scroll)) {
        return;
      }

      requestAnimationFrame(() => {
        node.measureLayout(
          scroll as unknown as Parameters<typeof node.measureLayout>[0],
          (_x, y) => {
            scroll.scrollTo({
              animated: true,
              y: Math.max(0, y - focusScrollInset),
            });
          },
          () => undefined
        );
      });
    },
    [focusScrollInset]
  );

  const publishTournament = useMutation({
    mutationFn: crpcClient.tournament.management.publish.mutate,
    mutationKey: crpc.tournament.management.publish.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível publicar o torneio. Tente novamente."
        ),
        id: "publish-tournament-error",
        label: "Falha ao publicar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      toast.show({
        description: "O torneio está aberto para inscrições.",
        id: "publish-tournament-success",
        label: "Torneio publicado",
        variant: "success",
      });
    },
  });

  const cancelTournament = useMutation({
    mutationFn: crpcClient.tournament.lifecycle.cancel.mutate,
    mutationKey: crpc.tournament.lifecycle.cancel.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível cancelar o torneio. Tente novamente."
        ),
        id: "cancel-tournament-error",
        label: "Falha ao cancelar",
        variant: "danger",
      });
    },
    onSuccess: async () => {
      await invalidateTournamentContext();
      setIsCancelDialogOpen(false);
      toast.show({
        description:
          "Torneio cancelado. Inscrições pagas serão estornadas automaticamente.",
        id: "cancel-tournament-success",
        label: "Torneio cancelado",
        variant: "success",
      });
    },
  });

  // O papel só existe com a tela `ready`: nada de rodapé, menu ou overview do
  // papel pintado antes do MODO (ator ativo) resolver e o payload ser do ator.
  const showStatusState = screenState !== "ready";
  const isOrganizer = access?.canManage ?? false;
  const categories = tournament?.categories ?? [];
  const joinOptions = buildTournamentJoinOptions({
    categoryIds: categories.map((category) => category.id),
    entries,
    viewerEntryIds: tournament?.viewerEntryIds ?? [],
  });
  const activeEntriesCountByCategory =
    buildTournamentActiveEntriesCountByCategory(entries);
  // Categorias escolhíveis e com vaga — base do bloco de inscrição.
  const joinableCategories = tournament
    ? categories
        .filter((category) =>
          joinOptions.joinableCategoryIds.includes(category.id)
        )
        .map((category) => {
          const vacancy = buildTournamentCategoryVacancy({
            activeEntriesCount: activeEntriesCountByCategory[category.id] ?? 0,
            maxEntries: category.maxEntries,
          });

          return {
            entryFeeCents: category.entryFeeCents,
            gender: category.gender,
            id: category.id,
            ineligibleReason: category.viewerIneligibleReason,
            isFull: vacancy.isFull,
            isIneligible: category.viewerEligible === false,
            modality: category.modality,
            name: category.name,
            vacancyLabel: vacancy.label,
          };
        })
    : [];
  const registrationState = tournament
    ? buildRegistrationWindowState({
        nowMs: Date.now(),
        registrationDeadlineMs: tournament.registrationDeadlineAt,
        status: tournament.status,
      })
    : null;
  const minFeeCents =
    joinableCategories.length > 0
      ? Math.min(
          ...joinableCategories.map((category) => category.entryFeeCents)
        )
      : 0;
  const hasActiveEntry =
    role === "player" && (tournament?.viewerEntryIds.length ?? 0) > 0;

  // A elegibilidade do ator desce do servidor como veio: viewerEligible ===
  // false vira linha DESABILITADA com o viewerIneligibleReason; nenhuma regra
  // de gênero é recalculada nem categoria escondida aqui.
  const joinFooterCategories: JoinFooterCategory[] = joinableCategories.map(
    (category) => ({
      displayName: category.name,
      id: category.id,
      ineligibleReason: category.ineligibleReason,
      isFull: category.isFull,
      isIneligible: category.isIneligible,
      modality: category.modality,
      priceLabel:
        category.entryFeeCents > 0
          ? formatCurrencyCents(category.entryFeeCents)
          : "Grátis",
      typeLabel: buildCategoryTypeLabel(category.modality, category.gender),
      vacancyLabel: category.vacancyLabel,
    })
  );
  const joinConfirmLabel = joinableCategories.every(
    (category) => category.entryFeeCents === 0
  )
    ? "Confirmar inscrição"
    : joinableCategories.every((category) => category.entryFeeCents > 0)
      ? "Inscrever e pagar"
      : "Inscrever-se";

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton variant="secondary" />
        </Page.Header.Left>
        <Page.Header.Center />
        <Page.Header.Right>
          {!showStatusState && tournament ? (
            isOrganizer ? (
              <OrganizerMenu
                canOpenBracket={access?.canOpenBracket ?? false}
                canOpenSchedule={access?.canOpenSchedule ?? false}
                onCancelPress={() => {
                  setIsCancelDialogOpen(true);
                }}
                onPublish={() => {
                  publishTournament.mutate({ tournamentId });
                }}
                status={tournament.status}
                tournamentId={tournamentId}
              />
            ) : (
              <TournamentScreensMenu
                canOpenBracket={access?.canOpenBracket ?? false}
                canOpenSchedule={access?.canOpenSchedule ?? false}
                tournamentId={tournamentId}
              />
            )
          ) : null}
        </Page.Header.Right>
      </Page.Header>

      <Page.ScrollView
        contentContainerClassName={cn(
          "grow pb-safe-offset-4",
          showStatusState && "centered gap-4 px-4"
        )}
        ref={scrollRef}
      >
        {showStatusState ? (
          screenState === "error" ? (
            <ErrorState message="Não foi possível carregar o torneio." />
          ) : (
            <LoadingState />
          )
        ) : (
          tournament && (
            <>
              <TournamentBanner tournament={tournament} />
              {role === "organizer" && (
                <OrganizerOverview
                  onPendingActionPerformed={invalidateTournamentContext}
                  tournamentId={tournamentId}
                />
              )}
              {role === "player" && (
                <PlayerOverview
                  focusCardRef={focusMatchId ? focusCardRef : undefined}
                  focusMatchId={focusMatchId}
                  onPendingActionPerformed={invalidateTournamentContext}
                  tournament={tournament}
                />
              )}
              {role === "guest" && <GuestOverview tournament={tournament} />}
            </>
          )
        )}
      </Page.ScrollView>

      {/* Rodapé fixo de inscrição = JoinFooter: só existe com a janela aberta
          e categoria com vaga; o bloco leva o fluxo de inscrição
          (create → charge → checkout). */}
      {!showStatusState &&
      role !== "organizer" &&
      registrationState?.open &&
      joinableCategories.length > 0 ? (
        <JoinBlock
          categories={joinFooterCategories}
          confirmLabel={joinConfirmLabel}
          hasActiveEntry={hasActiveEntry}
          minFeeCents={minFeeCents}
        />
      ) : null}

      <CancelTournamentDialog
        isOpen={isCancelDialogOpen}
        isPending={cancelTournament.isPending}
        onConfirm={() => {
          cancelTournament.mutate({ tournamentId });
        }}
        onOpenChange={setIsCancelDialogOpen}
      />
    </Page>
  );
}
