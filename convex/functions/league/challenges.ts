import { CRPCError } from "kitcn/server";
import { z } from "zod";
import type { Id } from "../../functions/_generated/dataModel";

import {
  canPlayersCancelChallenge,
  isChallengeSlotBlocked,
  resolveAcceptedChallengeStatus,
  resolveResponseDeadline,
  resolveReopenedChallengeStatus,
  resolveScoreConfirmationStatus,
  validateChallengeScore,
  type LeagueChallengeStatus,
} from "../../domains/league/challenge-rules";
import {
  AdminManageLeagueChallengeSchema,
  AdminSubmitLeagueChallengeResultSchema,
  CounterProposeLeagueChallengeSchema,
  CreateLeagueChallengeSchema,
  LeagueByIdSchema,
  LeagueChallengeByIdSchema,
  leagueChallengeSchema,
  leagueChallengeScoreSchema,
  LeagueMatchConfigSchema,
  leagueScheduleItemSchema,
  RequestLeagueChallengeCancellationSchema,
  RespondLeagueChallengeCancellationSchema,
  ReviewLeagueChallengeResultSchema,
  ReviewLeagueChallengeSchema,
  SubmitLeagueChallengeResultSchema,
  type LeagueChallengeScore,
} from "../../domains/league/contract";
import {
  ADMIN_CANCELABLE_CHALLENGE_STATUSES,
  ADMIN_INVALIDATABLE_CHALLENGE_STATUSES,
  ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES,
  ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES,
  CLOSED_CHALLENGE_STATUSES,
  VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES,
} from "../../domains/league/challenge-status";
import { buildScheduledDate } from "../../domains/league/challenge-scheduling-rules";
import {
  leagueChallenge,
  leagueChallengeProposal,
  leagueChallengeResultSubmission,
} from "../../domains/league/tables";
import { authMutation, authQuery } from "../../lib/crpc";
import {
  applyChallengeRankingResult,
  recordAdminChallengeAction,
  restoreChallengeRankingSnapshot,
} from "./_challenges/ranking";
import {
  assertCanManageLeague,
  assertParticipantAccess,
  canManageLeague,
  getActiveMembershipByIdOrThrow,
  getActiveViewerMembership,
  getChallengeRecordOrThrow,
  getLeagueRecordOrThrow,
  getMembershipRecordByIdOrThrow,
  getViewerContextOrThrow,
} from "./_challenges/record_guards";
import {
  assertChallengeCreationRules,
  assertCourtAvailability,
  assertCourtSlotAvailable,
  getCourtNameOrThrow,
} from "./_challenges/scheduling_guards";
import {
  getCancellationResponseMembershipId,
  getCurrentProposalOrThrow,
  getLatestResultSubmission,
  getProposalReceiverMembershipId,
} from "./_challenges/proposals";
import {
  buildTodayUtcKey,
  retractChallengeNotifications,
  scheduleChallengeNotification,
} from "./_challenges/notifications";
import {
  getPlayerSummary,
  leagueChallengeOccupiedSlotSchema,
  serializeChallenge,
} from "./_challenges/serializers";
import { syncTimeDrivenChallengeStatus } from "./_challenges/status_helpers";

export const listForLeague = authQuery
  .input(LeagueByIdSchema)
  .output(z.array(leagueChallengeSchema))
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    const { activeMembership, currentLeague, isManagerOwner } =
      await getViewerContextOrThrow(ctx, leagueId);

    const challengeRecords = await ctx.orm.query.leagueChallenge.findMany({
      limit: 500,
      orderBy: { createdAt: "desc" },
      where: { leagueId },
    });

    const visibleChallenges = challengeRecords.filter((challenge) => {
      if (isManagerOwner) {
        return true;
      }

      return (
        challenge.challengerMembershipId === activeMembership?.id ||
        challenge.challengedMembershipId === activeMembership?.id
      );
    });

    return Promise.all(
      visibleChallenges.map((challenge) =>
        serializeChallenge(ctx, currentLeague, challenge)
      )
    );
  });

export const listScheduled = authQuery
  .input(LeagueByIdSchema)
  .output(z.array(leagueScheduleItemSchema))
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    const currentLeague = await getLeagueRecordOrThrow(ctx, leagueId);
    const scheduleVisibility =
      currentLeague.ruleConfig.scheduleVisibility ?? "public";

    // Acesso público (qualquer usuário autenticado) quando a agenda é pública.
    // Caso contrário, exige owner ou participante ativo.
    if (scheduleVisibility !== "public") {
      await getViewerContextOrThrow(ctx, leagueId);
    }

    const challengeRecords = await ctx.orm.query.leagueChallenge.findMany({
      limit: 500,
      where: { leagueId },
    });

    const todayUtc = buildTodayUtcKey();
    const scheduledItems = await Promise.all(
      challengeRecords.map(async (challenge) => {
        if (challenge.status !== "confirmed") {
          return null;
        }

        const currentProposal = await getCurrentProposalOrThrow(ctx, challenge);

        if (currentProposal.matchDate < todayUtc) {
          return null;
        }

        const [challengerMembership, challengedMembership] = await Promise.all([
          getMembershipRecordByIdOrThrow(
            ctx,
            challenge.challengerMembershipId as Id<"leagueMembership">
          ),
          getMembershipRecordByIdOrThrow(
            ctx,
            challenge.challengedMembershipId as Id<"leagueMembership">
          ),
        ]);

        const [challenger, challenged] = await Promise.all([
          getPlayerSummary(
            ctx,
            challengerMembership.playerProfileId as Id<"playerProfile">
          ),
          getPlayerSummary(
            ctx,
            challengedMembership.playerProfileId as Id<"playerProfile">
          ),
        ]);

        const courtName = getCourtNameOrThrow(
          currentLeague,
          currentProposal.courtId
        );

        return leagueScheduleItemSchema.parse({
          challenged: {
            avatarUrl: challenged.avatarUrl ?? null,
            fullName: challenged.fullName,
          },
          challenger: {
            avatarUrl: challenger.avatarUrl ?? null,
            fullName: challenger.fullName,
          },
          courtName,
          id: challenge.id,
          matchDate: currentProposal.matchDate,
          startMinute: currentProposal.startMinute,
        });
      })
    );

    return scheduledItems
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (a.matchDate !== b.matchDate) {
          return a.matchDate < b.matchDate ? -1 : 1;
        }
        return a.startMinute - b.startMinute;
      });
  });

export const listOccupiedSlots = authQuery
  .input(LeagueByIdSchema)
  .output(z.array(leagueChallengeOccupiedSlotSchema))
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    await getViewerContextOrThrow(ctx, leagueId);

    const challengeRecords = await ctx.orm.query.leagueChallenge.findMany({
      limit: 500,
      orderBy: { createdAt: "desc" },
      where: { leagueId },
    });

    const occupiedSlots = await Promise.all(
      challengeRecords.map(async (challenge) => {
        if (
          !(
            challenge.currentProposalId &&
            isChallengeSlotBlocked(challenge.status as LeagueChallengeStatus)
          )
        ) {
          return null;
        }

        if (!challenge.currentProposalId) {
          return null;
        }
        const proposalId =
          challenge.currentProposalId as Id<"leagueChallengeProposal">;
        const currentProposal =
          await ctx.orm.query.leagueChallengeProposal.findFirst({
            where: { id: proposalId },
          });
        if (!currentProposal || currentProposal.challengeId !== challenge.id) {
          return null;
        }

        return {
          challengeId: String(challenge.id),
          courtId: currentProposal.courtId,
          endMinute: currentProposal.endMinute,
          matchDate: currentProposal.matchDate,
          startMinute: currentProposal.startMinute,
        };
      })
    );

    return occupiedSlots.filter((slot) => slot !== null);
  });

export const getById = authQuery
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .query(async ({ ctx, input }) => {
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const { activeMembership, currentLeague, isManagerOwner } =
      await getViewerContextOrThrow(
        ctx,
        currentChallenge.leagueId as Id<"league">
      );

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner,
      viewerMembership: activeMembership,
    });

    return serializeChallenge(ctx, currentLeague, currentChallenge);
  });

export const create = authMutation
  .input(CreateLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const leagueId = input.leagueId as Id<"league">;
    const currentLeague = await getLeagueRecordOrThrow(ctx, leagueId);
    const challengerMembership = await getActiveViewerMembership(ctx, leagueId);

    if (!challengerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para abrir um desafio.",
      });
    }

    const challengedMembership = await getActiveMembershipByIdOrThrow(
      ctx,
      leagueId,
      input.challengedMembershipId as Id<"leagueMembership">
    );

    await assertChallengeCreationRules({
      challengedMembership,
      challengerMembership,
      ctx,
      league: currentLeague,
    });
    assertCourtAvailability({
      courtId: input.courtId,
      currentLeague,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });
    await assertCourtSlotAvailable({
      courtId: input.courtId,
      ctx,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });

    const [createdChallenge] = await ctx.orm
      .insert(leagueChallenge)
      .values({
        leagueId,
        challengerMembershipId:
          challengerMembership.id as Id<"leagueMembership">,
        challengedMembershipId:
          challengedMembership.id as Id<"leagueMembership">,
        status: "pending_opponent_response",
        challengeValidationMode:
          currentLeague.ruleConfig.challengeValidationMode,
        resultValidationMode: currentLeague.ruleConfig.resultValidationMode,
        matchConfigSnapshot: currentLeague.ruleConfig.matchConfig,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [createdProposal] = await ctx.orm
      .insert(leagueChallengeProposal)
      .values({
        challengeId: createdChallenge.id as Id<"leagueChallenge">,
        proposedByMembershipId:
          challengerMembership.id as Id<"leagueMembership">,
        courtId: input.courtId,
        matchDate: input.matchDate,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        responseDeadlineAt: resolveResponseDeadline({
          now,
          rule: currentLeague.ruleConfig.responseDeadlineHours,
        }),
        revisionNumber: 1,
        status: "active",
        createdAt: now,
      })
      .returning();

    await ctx.db.patch(createdChallenge.id as Id<"leagueChallenge">, {
      currentProposalId: createdProposal.id,
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: createdChallenge,
      ctx,
      eventType: "league.challenge.created",
      metadata: { proposalId: createdProposal.id },
      recipientMembershipIds: [
        challengedMembership.id as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...createdChallenge,
      currentProposalId: createdProposal.id,
      updatedAt: now,
    });
  });

export const acceptProposal = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para responder um desafio.",
      });
    }

    const receiverMembershipId =
      getProposalReceiverMembershipId(syncedChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES.has(
        syncedChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não pode mais ser aceito nessa etapa.",
      });
    }

    const nextStatus = resolveAcceptedChallengeStatus({
      challengeValidationMode: syncedChallenge.challengeValidationMode as
        | "automatic"
        | "manual",
    });

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "accepted",
      }),
      ctx.db.patch(syncedChallenge.id as Id<"leagueChallenge">, {
        status: nextStatus,
        lockedAt: now.getTime(),
        confirmedAt: nextStatus === "confirmed" ? now.getTime() : undefined,
        updatedAt: now.getTime(),
      }),
    ]);

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.proposal_accepted",
      metadata: { proposalId: currentProposal.id },
      recipientMembershipIds: [
        (viewerMembership.id === syncedChallenge.challengerMembershipId
          ? syncedChallenge.challengedMembershipId
          : syncedChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...syncedChallenge,
      status: nextStatus,
      lockedAt: now,
      confirmedAt:
        nextStatus === "confirmed" ? now : syncedChallenge.confirmedAt,
      updatedAt: now,
    });
  });

export const declineProposal = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para responder um desafio.",
      });
    }

    const receiverMembershipId =
      getProposalReceiverMembershipId(currentChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES.has(
        currentChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não pode mais ser recusado nessa etapa.",
      });
    }

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "declined",
      }),
      ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "declined",
        updatedAt: now.getTime(),
      }),
    ]);

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.proposal_declined",
      metadata: { proposalId: currentProposal.id },
      recipientMembershipIds: [
        (viewerMembership.id === currentChallenge.challengerMembershipId
          ? currentChallenge.challengedMembershipId
          : currentChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "declined",
      updatedAt: now,
    });
  });

export const counterPropose = authMutation
  .input(CounterProposeLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para negociar um desafio.",
      });
    }

    const receiverMembershipId =
      getProposalReceiverMembershipId(syncedChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES.has(
        syncedChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não pode receber uma contraproposta agora.",
      });
    }

    assertCourtAvailability({
      courtId: input.courtId,
      currentLeague,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });
    await assertCourtSlotAvailable({
      challengeIdToIgnore: syncedChallenge.id as Id<"leagueChallenge">,
      courtId: input.courtId,
      ctx,
      endMinute: input.endMinute,
      matchDate: input.matchDate,
      startMinute: input.startMinute,
    });

    const nextStatus =
      syncedChallenge.status === "pending_opponent_response"
        ? "pending_creator_reapproval"
        : "pending_opponent_response";

    const [createdProposal] = await ctx.orm
      .insert(leagueChallengeProposal)
      .values({
        challengeId: syncedChallenge.id as Id<"leagueChallenge">,
        proposedByMembershipId: viewerMembership.id as Id<"leagueMembership">,
        courtId: input.courtId,
        matchDate: input.matchDate,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        responseDeadlineAt: resolveResponseDeadline({
          now,
          rule: currentLeague.ruleConfig.responseDeadlineHours,
        }),
        revisionNumber: currentProposal.revisionNumber + 1,
        status: "active",
        createdAt: now,
      })
      .returning();

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "replaced",
      }),
      ctx.db.patch(syncedChallenge.id as Id<"leagueChallenge">, {
        currentProposalId: createdProposal.id,
        status: nextStatus,
        updatedAt: now.getTime(),
      }),
    ]);

    await retractChallengeNotifications(ctx, syncedChallenge.id);
    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.counter_proposed",
      metadata: { proposalId: createdProposal.id },
      recipientMembershipIds: [
        (nextStatus === "pending_creator_reapproval"
          ? syncedChallenge.challengerMembershipId
          : syncedChallenge.challengedMembershipId) as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...syncedChallenge,
      currentProposalId: createdProposal.id,
      status: nextStatus,
      updatedAt: now,
    });
  });

export const cancel = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const isManagerOwner = await canManageLeague(ctx, currentLeague);
    const viewerMembership = isManagerOwner
      ? null
      : await getActiveViewerMembership(
          ctx,
          currentChallenge.leagueId as Id<"league">
        );

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner,
      viewerMembership,
    });

    if (
      !(
        isManagerOwner ||
        canPlayersCancelChallenge({
          now,
          scheduledStartAt: buildScheduledDate(
            currentProposal.matchDate,
            currentProposal.startMinute
          ),
        })
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Depois do horário marcado, só o admin pode cancelar.",
      });
    }

    if (
      CLOSED_CHALLENGE_STATUSES.has(
        currentChallenge.status as LeagueChallengeStatus
      )
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio já está encerrado.",
      });
    }

    if (!isManagerOwner) {
      if (currentChallenge.status === "confirmed") {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message:
            "Depois da confirmação, solicite o cancelamento para o outro jogador.",
        });
      }

      if (currentChallenge.status === "pending_cancellation_acceptance") {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio já está aguardando resposta de cancelamento.",
        });
      }
    }

    await Promise.all([
      ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
        status: "cancelled",
      }),
      ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "cancelled",
        cancelledAt: now.getTime(),
        updatedAt: now.getTime(),
      }),
    ]);

    await retractChallengeNotifications(ctx, currentChallenge.id);
    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.cancelled",
      recipientMembershipIds: isManagerOwner
        ? [
            currentChallenge.challengerMembershipId as Id<"leagueMembership">,
            currentChallenge.challengedMembershipId as Id<"leagueMembership">,
          ]
        : [
            (viewerMembership?.id === currentChallenge.challengerMembershipId
              ? currentChallenge.challengedMembershipId
              : currentChallenge.challengerMembershipId) as Id<"leagueMembership">,
          ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
    });
  });

export const requestCancellation = authMutation
  .input(RequestLeagueChallengeCancellationSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "Você precisa estar ativo na liga para solicitar o cancelamento.",
      });
    }

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    if (currentChallenge.status !== "confirmed") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          "Só é possível solicitar cancelamento em partidas confirmadas.",
      });
    }

    if (
      !canPlayersCancelChallenge({
        now,
        scheduledStartAt: buildScheduledDate(
          currentProposal.matchDate,
          currentProposal.startMinute
        ),
      })
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Depois do horário marcado, só o admin pode cancelar.",
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "pending_cancellation_acceptance",
      cancellationRequestedAt: now.getTime(),
      cancellationRequestedByMembershipId:
        viewerMembership.id as Id<"leagueMembership">,
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.cancellation_requested",
      recipientMembershipIds: [
        (viewerMembership.id === currentChallenge.challengerMembershipId
          ? currentChallenge.challengedMembershipId
          : currentChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "pending_cancellation_acceptance",
      cancellationRequestedAt: now,
      cancellationRequestedByMembershipId:
        viewerMembership.id as Id<"leagueMembership">,
      updatedAt: now,
    });
  });

export const respondCancellationRequest = authMutation
  .input(RespondLeagueChallengeCancellationSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "Você precisa estar ativo na liga para responder ao cancelamento.",
      });
    }

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    if (currentChallenge.status !== "pending_cancellation_acceptance") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando resposta de cancelamento.",
      });
    }

    const receiverMembershipId =
      getCancellationResponseMembershipId(currentChallenge);

    if (
      !receiverMembershipId ||
      receiverMembershipId !== viewerMembership.id ||
      !currentChallenge.cancellationRequestedByMembershipId
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Você não pode responder essa solicitação de cancelamento.",
      });
    }

    if (input.action === "accept") {
      const currentProposal = await getCurrentProposalOrThrow(
        ctx,
        currentChallenge
      );

      await Promise.all([
        ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
          status: "cancelled",
        }),
        ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
          status: "cancelled",
          cancellationRequestedAt: null,
          cancellationRequestedByMembershipId: null,
          cancelledAt: now.getTime(),
          updatedAt: now.getTime(),
        }),
      ]);

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.cancellation_accepted",
        recipientMembershipIds: [
          currentChallenge.cancellationRequestedByMembershipId as Id<"leagueMembership">,
        ],
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "cancelled",
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        cancelledAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "confirmed",
      cancellationRequestedAt: null,
      cancellationRequestedByMembershipId: null,
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.cancellation_rejected",
      recipientMembershipIds: [
        currentChallenge.cancellationRequestedByMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "confirmed",
      cancellationRequestedAt: null,
      cancellationRequestedByMembershipId: null,
      updatedAt: now,
    });
  });

export const submitResult = authMutation
  .input(SubmitLeagueChallengeResultSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      syncedChallenge.leagueId as Id<"league">
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Você precisa estar ativo na liga para enviar um resultado.",
      });
    }

    assertParticipantAccess({
      challenge: syncedChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    if (
      ![
        "confirmed",
        "pending_result_submission",
        "pending_result_correction",
        "pending_result_confirmation",
      ].includes(syncedChallenge.status)
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio ainda não pode receber resultado.",
      });
    }

    const parsedScore = leagueChallengeScoreSchema.parse(input.score);
    const matchConfigSnapshot = LeagueMatchConfigSchema.parse(
      syncedChallenge.matchConfigSnapshot
    );
    const scoreValidationError = validateChallengeScore({
      challengedMembershipId: String(syncedChallenge.challengedMembershipId),
      challengerMembershipId: String(syncedChallenge.challengerMembershipId),
      matchConfig: matchConfigSnapshot,
      score: parsedScore,
    });

    if (scoreValidationError) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: scoreValidationError,
      });
    }

    await ctx.orm
      .insert(leagueChallengeResultSubmission)
      .values({
        challengeId: syncedChallenge.id as Id<"leagueChallenge">,
        submittedByMembershipId: viewerMembership.id as Id<"leagueMembership">,
        score: parsedScore,
        winnerMembershipId:
          parsedScore.winnerMembershipId as Id<"leagueMembership">,
        submittedAt: now,
      })
      .returning();

    await ctx.db.patch(syncedChallenge.id as Id<"leagueChallenge">, {
      status: "pending_result_confirmation",
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.result_submitted",
      recipientMembershipIds: [
        (viewerMembership.id === syncedChallenge.challengerMembershipId
          ? syncedChallenge.challengedMembershipId
          : syncedChallenge.challengerMembershipId) as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...syncedChallenge,
      status: "pending_result_confirmation",
      updatedAt: now,
    });
  });

export const confirmResult = authMutation
  .input(z.object({ challengeId: z.string().min(1) }))
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );
    const viewerMembership = await getActiveViewerMembership(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    if (!viewerMembership) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message:
          "Você precisa estar ativo na liga para confirmar um resultado.",
      });
    }

    assertParticipantAccess({
      challenge: currentChallenge,
      isManagerOwner: false,
      viewerMembership,
    });

    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );

    if (!latestResultSubmission) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Ainda não existe resultado enviado para esse desafio.",
      });
    }

    if (
      latestResultSubmission.submittedByMembershipId === viewerMembership.id
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Quem enviou o resultado não pode confirmá-lo.",
      });
    }

    if (latestResultSubmission.confirmedByMembershipId) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse resultado já foi confirmado.",
      });
    }

    const nextStatus = resolveScoreConfirmationStatus({
      resultValidationMode: currentChallenge.resultValidationMode as
        | "automatic"
        | "manual",
    });
    const rankingSnapshots =
      nextStatus === "finished"
        ? await applyChallengeRankingResult({
            challenge: currentChallenge,
            ctx,
            currentLeague,
            score: latestResultSubmission.score as LeagueChallengeScore,
          })
        : null;

    await ctx.db.patch(
      latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
      {
        confirmedAt: now.getTime(),
        confirmedByMembershipId: viewerMembership.id as Id<"leagueMembership">,
      }
    );

    await ctx.db.patch(
      currentChallenge.id as Id<"leagueChallenge">,
      {
        status: nextStatus,
        finishedAt: nextStatus === "finished" ? now.getTime() : undefined,
        rankingAppliedAt: nextStatus === "finished" ? now.getTime() : null,
        rankingSnapshotAfterResult:
          rankingSnapshots?.rankingSnapshotAfterResult ?? undefined,
        rankingSnapshotBeforeResult:
          rankingSnapshots?.rankingSnapshotBeforeResult ?? undefined,
        updatedAt: now.getTime(),
      } as never
    );

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_confirmed",
      recipientMembershipIds: [
        latestResultSubmission.submittedByMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: nextStatus,
      finishedAt: nextStatus === "finished" ? now : currentChallenge.finishedAt,
      updatedAt: now,
    });
  });

export const reviewChallenge = authMutation
  .input(ReviewLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode validar esse desafio."
    );

    if (currentChallenge.status !== "pending_admin_challenge_validation") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando validação manual.",
      });
    }

    if (input.action === "approve") {
      await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "confirmed",
        confirmedAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.admin_approved",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "confirmed",
        confirmedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "cancelled",
      cancelledAt: now.getTime(),
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.admin_rejected",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
    });
  });

export const reviewResult = authMutation
  .input(ReviewLeagueChallengeResultSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode validar resultados."
    );

    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );

    if (
      !latestResultSubmission ||
      latestResultSubmission.id !== input.resultSubmissionId
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "O resultado informado não corresponde ao desafio.",
      });
    }

    if (currentChallenge.status !== "pending_admin_result_validation") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando validação de resultado.",
      });
    }

    if (input.action === "approve") {
      const rankingSnapshots = await applyChallengeRankingResult({
        challenge: currentChallenge,
        ctx,
        currentLeague,
        score: latestResultSubmission.score as LeagueChallengeScore,
      });

      await ctx.db.patch(
        latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
        {
          adminReviewedByUserId: ctx.userId,
          reviewAction: "approved",
          reviewedAt: now.getTime(),
        }
      );

      await ctx.db.patch(
        currentChallenge.id as Id<"leagueChallenge">,
        {
          status: "finished",
          finishedAt: now.getTime(),
          rankingAppliedAt: now.getTime(),
          rankingSnapshotAfterResult:
            rankingSnapshots.rankingSnapshotAfterResult,
          rankingSnapshotBeforeResult:
            rankingSnapshots.rankingSnapshotBeforeResult,
          updatedAt: now.getTime(),
        } as never
      );

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.result_confirmed",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "finished",
        finishedAt: now,
        updatedAt: now,
      });
    }

    if (input.action === "request_correction") {
      await ctx.db.patch(
        latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
        {
          adminReviewedByUserId: ctx.userId,
          reviewAction: "correction_requested",
          reviewedAt: now.getTime(),
        }
      );

      await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
        status: "pending_result_correction",
        updatedAt: now.getTime(),
      });

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.result_correction_requested",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "pending_result_correction",
        updatedAt: now,
      });
    }

    await ctx.db.patch(
      latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
      {
        adminReviewedByUserId: ctx.userId,
        reviewAction: "invalidated",
        reviewedAt: now.getTime(),
      }
    );

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      status: "invalidated",
      invalidatedAt: now.getTime(),
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_invalidated",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "invalidated",
      invalidatedAt: now,
      updatedAt: now,
    });
  });

export const adminSubmitResult = authMutation
  .input(AdminSubmitLeagueChallengeResultSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode editar o placar."
    );

    // Sincroniza status derivados do tempo (ex.: proposta sem resposta após o
    // deadline vira pending_admin_decision) antes de validar, para que o
    // status refletido na UI (derivado) seja o mesmo usado aqui.
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );

    const currentStatus = syncedChallenge.status as LeagueChallengeStatus;

    if (!ADMIN_SCORE_EDITABLE_CHALLENGE_STATUSES.has(currentStatus)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio ainda não pode receber placar pelo admin.",
      });
    }

    const parsedScore = leagueChallengeScoreSchema.parse(input.score);
    const matchConfigSnapshot = LeagueMatchConfigSchema.parse(
      currentChallenge.matchConfigSnapshot
    );
    const scoreValidationError = validateChallengeScore({
      challengedMembershipId: String(currentChallenge.challengedMembershipId),
      challengerMembershipId: String(currentChallenge.challengerMembershipId),
      matchConfig: matchConfigSnapshot,
      score: parsedScore,
    });

    if (scoreValidationError) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: scoreValidationError,
      });
    }

    if (currentChallenge.rankingAppliedAt) {
      await restoreChallengeRankingSnapshot({
        challenge: currentChallenge,
        ctx,
      });
    }

    const rankingSnapshots = await applyChallengeRankingResult({
      challenge: currentChallenge,
      ctx,
      currentLeague,
      score: parsedScore,
    });

    await ctx.orm
      .insert(leagueChallengeResultSubmission)
      .values({
        adminReviewedByUserId: ctx.userId,
        challengeId: currentChallenge.id as Id<"leagueChallenge">,
        confirmedAt: now,
        confirmedByMembershipId:
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        reviewAction: "approved",
        reviewedAt: now,
        score: parsedScore,
        submittedAt: now,
        submittedByMembershipId:
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        winnerMembershipId:
          parsedScore.winnerMembershipId as Id<"leagueMembership">,
      })
      .returning();

    await ctx.db.patch(
      currentChallenge.id as Id<"leagueChallenge">,
      {
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        finishedAt: now.getTime(),
        invalidatedAt: null,
        rankingAppliedAt: now.getTime(),
        rankingSnapshotAfterResult: rankingSnapshots.rankingSnapshotAfterResult,
        rankingSnapshotBeforeResult:
          rankingSnapshots.rankingSnapshotBeforeResult,
        status: "finished",
        updatedAt: now.getTime(),
      } as never
    );

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_confirmed",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      cancellationRequestedAt: null,
      cancellationRequestedByMembershipId: null,
      finishedAt: now,
      invalidatedAt: null,
      rankingAppliedAt: now,
      rankingSnapshotAfterResult: rankingSnapshots.rankingSnapshotAfterResult,
      rankingSnapshotBeforeResult: rankingSnapshots.rankingSnapshotBeforeResult,
      status: "finished",
      updatedAt: now,
    });
  });

export const adminManage = authMutation
  .input(AdminManageLeagueChallengeSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode executar essa ação."
    );

    const currentStatus = currentChallenge.status as LeagueChallengeStatus;
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );

    if (input.action === "cancel") {
      if (!ADMIN_CANCELABLE_CHALLENGE_STATUSES.has(currentStatus)) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio não pode mais ser cancelado pelo admin.",
        });
      }

      const currentProposal = await getCurrentProposalOrThrow(
        ctx,
        currentChallenge
      );

      await Promise.all([
        ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
          status: "cancelled",
        }),
        ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
          status: "cancelled",
          cancellationRequestedAt: null,
          cancellationRequestedByMembershipId: null,
          cancelledAt: now.getTime(),
          updatedAt: now.getTime(),
        }),
      ]);

      await recordAdminChallengeAction({
        action: "cancel",
        challenge: currentChallenge,
        ctx,
        fromStatus: currentStatus,
        performedByUserId: ctx.userId,
        toStatus: "cancelled",
      });

      await retractChallengeNotifications(ctx, currentChallenge.id);
      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.cancelled",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "cancelled",
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        cancelledAt: now,
        updatedAt: now,
      });
    }

    if (input.action === "invalidate") {
      if (!ADMIN_INVALIDATABLE_CHALLENGE_STATUSES.has(currentStatus)) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio não pode ser invalidado nesse estado.",
        });
      }

      if (currentStatus === "finished") {
        await restoreChallengeRankingSnapshot({
          challenge: currentChallenge,
          ctx,
        });
      }

      if (latestResultSubmission) {
        await ctx.db.patch(
          latestResultSubmission.id as Id<"leagueChallengeResultSubmission">,
          {
            adminReviewedByUserId: ctx.userId,
            reviewAction: "invalidated",
            reviewedAt: now.getTime(),
          }
        );
      }

      await ctx.db.patch(
        currentChallenge.id as Id<"leagueChallenge">,
        {
          status: "invalidated",
          cancellationRequestedAt: null,
          cancellationRequestedByMembershipId: null,
          finishedAt: null,
          invalidatedAt: now.getTime(),
          rankingAppliedAt: null,
          updatedAt: now.getTime(),
        } as never
      );

      await recordAdminChallengeAction({
        action: "invalidate",
        challenge: currentChallenge,
        ctx,
        fromStatus: currentStatus,
        performedByUserId: ctx.userId,
        toStatus: "invalidated",
      });

      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.result_invalidated",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: "invalidated",
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        finishedAt: null,
        invalidatedAt: now,
        rankingAppliedAt: null,
        updatedAt: now,
      });
    }

    if (input.action === "reopen_challenge") {
      if (!["declined", "cancelled", "invalidated"].includes(currentStatus)) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Esse desafio não pode ser reaberto nesse estado.",
        });
      }

      if (latestResultSubmission) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message:
            "Esse desafio já possui placar. Use a ação de reabrir resultado.",
        });
      }

      const currentProposal = await getCurrentProposalOrThrow(
        ctx,
        currentChallenge
      );
      const nextStatus = resolveReopenedChallengeStatus({
        challengerMembershipId: String(currentChallenge.challengerMembershipId),
        proposedByMembershipId: String(currentProposal.proposedByMembershipId),
      });
      const responseDeadlineAt = resolveResponseDeadline({
        now,
        rule: currentLeague.ruleConfig.responseDeadlineHours,
      });

      await Promise.all([
        ctx.db.patch(currentProposal.id as Id<"leagueChallengeProposal">, {
          responseDeadlineAt: responseDeadlineAt.getTime(),
          status: "active",
        }),
        ctx.db.patch(
          currentChallenge.id as Id<"leagueChallenge">,
          {
            status: nextStatus,
            cancellationRequestedAt: null,
            cancellationRequestedByMembershipId: null,
            cancelledAt: null,
            confirmedAt: null,
            finishedAt: null,
            invalidatedAt: null,
            lockedAt: null,
            rankingAppliedAt: null,
            updatedAt: now.getTime(),
          } as never
        ),
      ]);

      await recordAdminChallengeAction({
        action: "reopen_challenge",
        challenge: currentChallenge,
        ctx,
        fromStatus: currentStatus,
        performedByUserId: ctx.userId,
        toStatus: nextStatus,
      });

      await retractChallengeNotifications(ctx, currentChallenge.id);
      await scheduleChallengeNotification({
        actorUserId: ctx.userId,
        challenge: currentChallenge,
        ctx,
        eventType: "league.challenge.admin_approved",
        recipientMembershipIds: [
          currentChallenge.challengerMembershipId as Id<"leagueMembership">,
          currentChallenge.challengedMembershipId as Id<"leagueMembership">,
        ],
      });

      return serializeChallenge(ctx, currentLeague, {
        ...currentChallenge,
        status: nextStatus,
        cancellationRequestedAt: null,
        cancellationRequestedByMembershipId: null,
        cancelledAt: null,
        confirmedAt: null,
        finishedAt: null,
        invalidatedAt: null,
        lockedAt: null,
        rankingAppliedAt: null,
        updatedAt: now,
      });
    }

    if (!["finished", "invalidated"].includes(currentStatus)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse resultado não pode ser reaberto nesse estado.",
      });
    }

    if (!latestResultSubmission) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio ainda não possui placar para reabrir.",
      });
    }

    if (currentChallenge.rankingAppliedAt) {
      await restoreChallengeRankingSnapshot({
        challenge: currentChallenge,
        ctx,
      });
    }

    await ctx.db.patch(
      currentChallenge.id as Id<"leagueChallenge">,
      {
        status: "pending_result_correction",
        finishedAt: null,
        invalidatedAt: null,
        rankingAppliedAt: null,
        updatedAt: now.getTime(),
      } as never
    );

    await recordAdminChallengeAction({
      action: "reopen_result",
      challenge: currentChallenge,
      ctx,
      fromStatus: currentStatus,
      performedByUserId: ctx.userId,
      toStatus: "pending_result_correction",
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: currentChallenge,
      ctx,
      eventType: "league.challenge.result_correction_requested",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: "pending_result_correction",
      finishedAt: null,
      invalidatedAt: null,
      rankingAppliedAt: null,
      updatedAt: now,
    });
  });

/**
 * Status em que o admin pode enviar um lembrete aos jogadores pedindo que
 * registrem o placar. São os status onde o placar ainda está pendente de
 * ação de um jogador e o desafio não está finalizado/cancelado.
 */
export const adminRequestResultReminder = authMutation
  .input(LeagueChallengeByIdSchema)
  .output(leagueChallengeSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const currentChallenge = await getChallengeRecordOrThrow(
      ctx,
      input.challengeId as Id<"leagueChallenge">
    );
    const currentLeague = await getLeagueRecordOrThrow(
      ctx,
      currentChallenge.leagueId as Id<"league">
    );

    await assertCanManageLeague(
      ctx,
      currentLeague,
      "Só o admin da liga pode enviar lembretes de placar."
    );

    // Sincroniza status derivados do tempo antes de validar, alinhando o
    // status usado aqui com o exibido na UI.
    const currentProposal = await getCurrentProposalOrThrow(
      ctx,
      currentChallenge
    );
    const latestResultSubmission = await getLatestResultSubmission(
      ctx,
      currentChallenge.id as Id<"leagueChallenge">
    );
    const syncedChallenge = await syncTimeDrivenChallengeStatus(
      ctx,
      currentChallenge,
      currentProposal,
      latestResultSubmission,
      now
    );

    const currentStatus = syncedChallenge.status as LeagueChallengeStatus;

    if (!ADMIN_RESULT_REMINDER_CHALLENGE_STATUSES.has(currentStatus)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Esse desafio não está aguardando placar dos jogadores.",
      });
    }

    await ctx.db.patch(currentChallenge.id as Id<"leagueChallenge">, {
      updatedAt: now.getTime(),
    });

    await scheduleChallengeNotification({
      actorUserId: ctx.userId,
      challenge: syncedChallenge,
      ctx,
      eventType: "league.challenge.result_reminder_requested",
      recipientMembershipIds: [
        currentChallenge.challengerMembershipId as Id<"leagueMembership">,
        currentChallenge.challengedMembershipId as Id<"leagueMembership">,
      ],
    });

    return serializeChallenge(ctx, currentLeague, {
      ...currentChallenge,
      status: currentStatus,
      updatedAt: now,
    });
  });
