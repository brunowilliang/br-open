/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";
import { anyApi, componentsGeneric } from "convex/server";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: {
  league: {
    challenges: {
      acceptProposal: FunctionReference<
        "mutation",
        "public",
        { challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      adminManage: FunctionReference<
        "mutation",
        "public",
        {
          action:
            | "cancel"
            | "invalidate"
            | "reopen_challenge"
            | "reopen_result";
          challengeId: string;
          reason: string;
        },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      cancel: FunctionReference<
        "mutation",
        "public",
        { challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      confirmResult: FunctionReference<
        "mutation",
        "public",
        { challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      counterPropose: FunctionReference<
        "mutation",
        "public",
        {
          challengeId: string;
          courtId: string;
          endMinute: number;
          matchDate: string;
          startMinute: number;
        },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      create: FunctionReference<
        "mutation",
        "public",
        {
          challengedMembershipId: string;
          courtId: string;
          endMinute: number;
          leagueId: string;
          matchDate: string;
          startMinute: number;
        },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      declineProposal: FunctionReference<
        "mutation",
        "public",
        { challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      getById: FunctionReference<
        "query",
        "public",
        { challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      listForLeague: FunctionReference<
        "query",
        "public",
        { leagueId: string },
        Array<{
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }>
      >;
      listOccupiedSlots: FunctionReference<
        "query",
        "public",
        { leagueId: string },
        Array<{
          challengeId: string;
          courtId: string;
          endMinute: number;
          matchDate: string;
          startMinute: number;
        }>
      >;
      requestCancellation: FunctionReference<
        "mutation",
        "public",
        { challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      respondCancellationRequest: FunctionReference<
        "mutation",
        "public",
        { action: "accept" | "reject"; challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      reviewChallenge: FunctionReference<
        "mutation",
        "public",
        { action: "approve" | "reject"; challengeId: string },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      reviewResult: FunctionReference<
        "mutation",
        "public",
        {
          action: "approve" | "request_correction" | "invalidate";
          challengeId: string;
          resultSubmissionId: string;
        },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
      submitResult: FunctionReference<
        "mutation",
        "public",
        {
          challengeId: string;
          score: {
            sets: Array<{
              challengedGames: number;
              challengerGames: number;
              kind: "set" | "super_tiebreak";
            }>;
            winnerMembershipId: string;
          };
        },
        {
          cancellationRequestedAt?: number | null;
          cancellationRequestedByMembershipId?: string | null;
          cancelledAt?: number | null;
          challengeValidationMode: "automatic" | "manual";
          challenged: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          challenger: {
            membershipId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
          };
          confirmedAt?: number | null;
          createdAt: number;
          currentProposal: {
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          };
          finishedAt?: number | null;
          id: string;
          invalidatedAt?: number | null;
          latestResultSubmission?: {
            adminReviewedByUserId?: string | null;
            challengeId: string;
            confirmedAt?: number | null;
            confirmedByMembershipId?: string | null;
            id: string;
            reviewAction?:
              | "approved"
              | "correction_requested"
              | "invalidated"
              | null;
            reviewedAt?: number | null;
            score: {
              sets: Array<{
                challengedGames: number;
                challengerGames: number;
                kind: "set" | "super_tiebreak";
              }>;
              winnerMembershipId: string;
            };
            submittedAt: number;
            submittedByMembershipId: string;
            winnerMembershipId?: string | null;
          } | null;
          leagueId: string;
          lockedAt?: number | null;
          matchConfigSnapshot: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            finalSetGamesPerSet: number;
            finalSetHasTieBreak: boolean;
            finalSetMode: "same_as_previous" | "custom_set" | "super_tiebreak";
            finalSetMustWinByTwoGames: boolean;
            finalSetScoringMode: "advantage" | "no_ad";
            finalSetSuperTieBreakMustWinByTwo: boolean;
            finalSetSuperTieBreakPoints: number;
            finalSetTieBreakAtGamesAll: number;
            finalSetTieBreakMustWinByTwo: boolean;
            finalSetTieBreakPoints: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_ad";
            setMustWinByTwoGames: boolean;
            tieBreakAtGamesAll: number;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          proposals: Array<{
            challengeId: string;
            courtId: string;
            courtName: string;
            createdAt: number;
            endMinute: number;
            id: string;
            matchDate: string;
            proposedByMembershipId: string;
            responseDeadlineAt: number;
            revisionNumber: number;
            startMinute: number;
            status:
              | "active"
              | "accepted"
              | "replaced"
              | "declined"
              | "cancelled";
          }>;
          resultValidationMode: "automatic" | "manual";
          status:
            | "pending_opponent_response"
            | "pending_creator_reapproval"
            | "pending_admin_challenge_validation"
            | "confirmed"
            | "pending_cancellation_acceptance"
            | "pending_result_submission"
            | "pending_result_confirmation"
            | "pending_admin_result_validation"
            | "pending_result_correction"
            | "pending_admin_decision"
            | "finished"
            | "declined"
            | "cancelled"
            | "invalidated";
          updatedAt: number;
        }
      >;
    };
    discovery: {
      getById: FunctionReference<
        "query",
        "public",
        { leagueId: string },
        {
          activePlayerCount: number;
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          coverUrl?: string | null;
          createdAt: number;
          description?: string | null;
          id: string;
          isManagerOwner: boolean;
          locationNotes?: string | null;
          maxPlayers: number | null;
          mode: "challenges";
          monthlyPriceCents: number;
          name: string;
          organizationId: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          updatedAt: number;
          viewerMembershipStatus?:
            | "pending"
            | "active"
            | "rejected"
            | "removed"
            | "left"
            | "suspended"
            | null;
          visibility: "public" | "private";
        }
      >;
      listAvailable: FunctionReference<
        "query",
        "public",
        {},
        Array<{
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          coverUrl?: string | null;
          createdAt: number;
          description?: string | null;
          id: string;
          locationNotes?: string | null;
          maxPlayers: number | null;
          mode: "challenges";
          monthlyPriceCents: number;
          name: string;
          organizationId: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          updatedAt: number;
          visibility: "public" | "private";
        }>
      >;
      listParticipating: FunctionReference<
        "query",
        "public",
        {},
        Array<{
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          coverUrl?: string | null;
          createdAt: number;
          description?: string | null;
          id: string;
          locationNotes?: string | null;
          maxPlayers: number | null;
          mode: "challenges";
          monthlyPriceCents: number;
          name: string;
          organizationId: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          updatedAt: number;
          visibility: "public" | "private";
        }>
      >;
    };
    management: {
      create: FunctionReference<
        "mutation",
        "public",
        {
          avatarStorageId: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          description?: string;
          locationNotes?: string;
          maxPlayers: number | null;
          monthlyPriceCents: number;
          name: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig?: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          visibility: "public" | "private";
        },
        {
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          coverUrl?: string | null;
          createdAt: number;
          description?: string | null;
          id: string;
          locationNotes?: string | null;
          maxPlayers: number | null;
          mode: "challenges";
          monthlyPriceCents: number;
          name: string;
          organizationId: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          updatedAt: number;
          visibility: "public" | "private";
        }
      >;
      generateUploadUrl: FunctionReference<"mutation", "public", {}, string>;
      getById: FunctionReference<
        "query",
        "public",
        { leagueId: string },
        {
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          coverUrl?: string | null;
          createdAt: number;
          description?: string | null;
          id: string;
          locationNotes?: string | null;
          maxPlayers: number | null;
          mode: "challenges";
          monthlyPriceCents: number;
          name: string;
          organizationId: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          updatedAt: number;
          visibility: "public" | "private";
        }
      >;
      listMine: FunctionReference<
        "query",
        "public",
        {},
        Array<{
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          coverUrl?: string | null;
          createdAt: number;
          description?: string | null;
          id: string;
          locationNotes?: string | null;
          maxPlayers: number | null;
          mode: "challenges";
          monthlyPriceCents: number;
          name: string;
          organizationId: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          updatedAt: number;
          visibility: "public" | "private";
        }>
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { leagueId: string },
        { success: true }
      >;
      update: FunctionReference<
        "mutation",
        "public",
        {
          avatarStorageId: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          description?: string;
          leagueId: string;
          locationNotes?: string;
          maxPlayers: number | null;
          monthlyPriceCents: number;
          name: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig?: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          visibility: "public" | "private";
        },
        {
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<string>;
          city: string;
          courts: Array<{
            availability: {
              fri: Array<{ endMinute: number; startMinute: number }>;
              mon: Array<{ endMinute: number; startMinute: number }>;
              sat: Array<{ endMinute: number; startMinute: number }>;
              sun: Array<{ endMinute: number; startMinute: number }>;
              thu: Array<{ endMinute: number; startMinute: number }>;
              tue: Array<{ endMinute: number; startMinute: number }>;
              wed: Array<{ endMinute: number; startMinute: number }>;
            };
            id: string;
            name: string;
          }>;
          coverStorageId: string | null;
          coverUrl?: string | null;
          createdAt: number;
          description?: string | null;
          id: string;
          locationNotes?: string | null;
          maxPlayers: number | null;
          mode: "challenges";
          monthlyPriceCents: number;
          name: string;
          organizationId: string;
          priceBillingInterval: "week" | "month" | "quarter" | "year";
          ruleConfig: {
            challengeValidationMode: "automatic" | "manual";
            hasInactivityPenalty: boolean;
            inactivityPenaltyDays?: number;
            inactivityPenaltyType?: "drop_one_position" | "move_to_ranking_end";
            lossBehavior: "stay_put" | "drop_one_position";
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              finalSetGamesPerSet: number;
              finalSetHasTieBreak: boolean;
              finalSetMode:
                | "same_as_previous"
                | "custom_set"
                | "super_tiebreak";
              finalSetMustWinByTwoGames: boolean;
              finalSetScoringMode: "advantage" | "no_ad";
              finalSetSuperTieBreakMustWinByTwo: boolean;
              finalSetSuperTieBreakPoints: number;
              finalSetTieBreakAtGamesAll: number;
              finalSetTieBreakMustWinByTwo: boolean;
              finalSetTieBreakPoints: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_ad";
              setMustWinByTwoGames: boolean;
              tieBreakAtGamesAll: number;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            maxActiveChallengesPerPlayer: number;
            maxChallengeDistance: number;
            maxChallengesPerMonth: number;
            newPlayerPlacement: "end_of_ranking";
            responseDeadlineHours: number;
            resultValidationMode: "automatic" | "manual";
            walkoverBehavior:
              | "automatic_loss"
              | "automatic_loss_and_move_to_end"
              | "cancel_challenge";
            winBehavior: "take_opponent_position" | "climb_one_position";
          };
          state: string;
          updatedAt: number;
          visibility: "public" | "private";
        }
      >;
    };
    membership: {
      approve: FunctionReference<
        "mutation",
        "public",
        { leagueId: string; membershipId: string },
        {
          createdAt: number;
          id: string;
          leagueId: string;
          player: {
            avatarUrl?: string | null;
            fullName: string;
            nickname: string;
          };
          playerProfileId: string;
          rankingPosition?: number | null;
          reviewedAt?: number | null;
          status:
            | "pending"
            | "active"
            | "rejected"
            | "removed"
            | "left"
            | "suspended";
          updatedAt: number;
        }
      >;
      getOverview: FunctionReference<
        "query",
        "public",
        { leagueId: string },
        {
          pendingRequests: Array<{
            createdAt: number;
            id: string;
            leagueId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
            reviewedAt?: number | null;
            status:
              | "pending"
              | "active"
              | "rejected"
              | "removed"
              | "left"
              | "suspended";
            updatedAt: number;
          }>;
          ranking: Array<{
            createdAt: number;
            id: string;
            leagueId: string;
            player: {
              avatarUrl?: string | null;
              fullName: string;
              nickname: string;
            };
            playerProfileId: string;
            rankingPosition?: number | null;
            reviewedAt?: number | null;
            status:
              | "pending"
              | "active"
              | "rejected"
              | "removed"
              | "left"
              | "suspended";
            updatedAt: number;
          }>;
        }
      >;
      reject: FunctionReference<
        "mutation",
        "public",
        { leagueId: string; membershipId: string },
        {
          createdAt: number;
          id: string;
          leagueId: string;
          player: {
            avatarUrl?: string | null;
            fullName: string;
            nickname: string;
          };
          playerProfileId: string;
          rankingPosition?: number | null;
          reviewedAt?: number | null;
          status:
            | "pending"
            | "active"
            | "rejected"
            | "removed"
            | "left"
            | "suspended";
          updatedAt: number;
        }
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { leagueId: string; membershipId: string },
        {
          createdAt: number;
          id: string;
          leagueId: string;
          player: {
            avatarUrl?: string | null;
            fullName: string;
            nickname: string;
          };
          playerProfileId: string;
          rankingPosition?: number | null;
          reviewedAt?: number | null;
          status:
            | "pending"
            | "active"
            | "rejected"
            | "removed"
            | "left"
            | "suspended";
          updatedAt: number;
        }
      >;
      reorderRanking: FunctionReference<
        "mutation",
        "public",
        { leagueId: string; membershipIds: Array<string> },
        { success: true }
      >;
      requestJoin: FunctionReference<
        "mutation",
        "public",
        { leagueId: string },
        {
          createdAt: number;
          id: string;
          leagueId: string;
          player: {
            avatarUrl?: string | null;
            fullName: string;
            nickname: string;
          };
          playerProfileId: string;
          rankingPosition?: number | null;
          reviewedAt?: number | null;
          status:
            | "pending"
            | "active"
            | "rejected"
            | "removed"
            | "left"
            | "suspended";
          updatedAt: number;
        }
      >;
    };
  };
  notification: {
    feed: {
      list: FunctionReference<
        "query",
        "public",
        { limit?: number },
        Array<{
          actorUserId: string | null;
          body: string;
          data: Record<string, any>;
          eventType:
            | "league.membership.requested"
            | "league.membership.approved"
            | "league.membership.rejected"
            | "league.membership.removed"
            | "league.challenge.created"
            | "league.challenge.counter_proposed"
            | "league.challenge.proposal_accepted"
            | "league.challenge.proposal_declined"
            | "league.challenge.cancelled"
            | "league.challenge.cancellation_requested"
            | "league.challenge.cancellation_accepted"
            | "league.challenge.cancellation_rejected"
            | "league.challenge.result_submitted"
            | "league.challenge.result_confirmed"
            | "league.challenge.result_correction_requested"
            | "league.challenge.result_invalidated"
            | "league.challenge.admin_approved"
            | "league.challenge.admin_rejected";
          id: string;
          isRead: boolean;
          occurredAt: number;
          readAt: number | null;
          recipientActorKind: "player" | "organization";
          recipientOrganizationId: string | null;
          recipientPlayerProfileId: string | null;
          recipientUserId: string;
          title: string;
        }>
      >;
      markAllRead: FunctionReference<
        "mutation",
        "public",
        {},
        { success: true }
      >;
      markRead: FunctionReference<
        "mutation",
        "public",
        { notificationId: string },
        {
          actorUserId: string | null;
          body: string;
          data: Record<string, any>;
          eventType:
            | "league.membership.requested"
            | "league.membership.approved"
            | "league.membership.rejected"
            | "league.membership.removed"
            | "league.challenge.created"
            | "league.challenge.counter_proposed"
            | "league.challenge.proposal_accepted"
            | "league.challenge.proposal_declined"
            | "league.challenge.cancelled"
            | "league.challenge.cancellation_requested"
            | "league.challenge.cancellation_accepted"
            | "league.challenge.cancellation_rejected"
            | "league.challenge.result_submitted"
            | "league.challenge.result_confirmed"
            | "league.challenge.result_correction_requested"
            | "league.challenge.result_invalidated"
            | "league.challenge.admin_approved"
            | "league.challenge.admin_rejected";
          id: string;
          isRead: boolean;
          occurredAt: number;
          readAt: number | null;
          recipientActorKind: "player" | "organization";
          recipientOrganizationId: string | null;
          recipientPlayerProfileId: string | null;
          recipientUserId: string;
          title: string;
        }
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { notificationId: string },
        { success: true }
      >;
      removeAll: FunctionReference<"mutation", "public", {}, { success: true }>;
    };
    settings: {
      setPreference: FunctionReference<
        "mutation",
        "public",
        { pushEnabled: boolean },
        {
          canReceivePush: boolean;
          deviceCount: number;
          permissionStatus: "denied" | "granted" | "undetermined";
          pushEnabled: boolean;
          readinessReason:
            | "missing_device"
            | "permission_denied"
            | "permission_undetermined"
            | "preference_disabled"
            | "ready";
          unreadCount: number;
        }
      >;
      status: FunctionReference<
        "query",
        "public",
        {},
        {
          canReceivePush: boolean;
          deviceCount: number;
          permissionStatus: "denied" | "granted" | "undetermined";
          pushEnabled: boolean;
          readinessReason:
            | "missing_device"
            | "permission_denied"
            | "permission_undetermined"
            | "preference_disabled"
            | "ready";
          unreadCount: number;
        }
      >;
      upsertDevice: FunctionReference<
        "mutation",
        "public",
        {
          expoPushToken: string;
          permissionStatus: "denied" | "granted" | "undetermined";
          platform: "android" | "ios" | "web";
        },
        {
          canReceivePush: boolean;
          deviceCount: number;
          permissionStatus: "denied" | "granted" | "undetermined";
          pushEnabled: boolean;
          readinessReason:
            | "missing_device"
            | "permission_denied"
            | "permission_undetermined"
            | "preference_disabled"
            | "ready";
          unreadCount: number;
        }
      >;
    };
  };
  player: {
    profile: {
      generateUploadUrl: FunctionReference<"mutation", "public", {}, string>;
      get: FunctionReference<
        "query",
        "public",
        {},
        {
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          fullName: string;
          gender?: "Feminino" | "Masculino" | null;
          nickname: string;
          phone?: string | null;
        } | null
      >;
      upsert: FunctionReference<
        "mutation",
        "public",
        {
          avatarStorageId: string | null;
          fullName: string;
          gender: "Feminino" | "Masculino";
          nickname: string;
          phone?: string | null;
        },
        {
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          fullName: string;
          gender?: "Feminino" | "Masculino" | null;
          nickname: string;
          phone?: string | null;
        }
      >;
    };
  };
  viewer: {
    context: {
      activateOrganization: FunctionReference<
        "mutation",
        "public",
        { name: string },
        {
          activeActor: {
            avatarUrl?: string | null;
            displayName: string;
            id: string;
            kind: "player" | "organization";
            role?: "owner" | "admin" | "member";
          };
          availableActors: Array<{
            avatarUrl?: string | null;
            displayName: string;
            id: string;
            kind: "player" | "organization";
            role?: "owner" | "admin" | "member";
          }>;
          capabilities: {
            canBrowseLeagues: boolean;
            canCreateLeague: boolean;
            canJoinLeagues: boolean;
            canManageLeagues: boolean;
          };
        }
      >;
      get: FunctionReference<
        "query",
        "public",
        {},
        {
          activeActor: {
            avatarUrl?: string | null;
            displayName: string;
            id: string;
            kind: "player" | "organization";
            role?: "owner" | "admin" | "member";
          };
          availableActors: Array<{
            avatarUrl?: string | null;
            displayName: string;
            id: string;
            kind: "player" | "organization";
            role?: "owner" | "admin" | "member";
          }>;
          capabilities: {
            canBrowseLeagues: boolean;
            canCreateLeague: boolean;
            canJoinLeagues: boolean;
            canManageLeagues: boolean;
          };
        }
      >;
      setActiveActor: FunctionReference<
        "mutation",
        "public",
        { actorKind: "player" | "organization"; organizationId?: string },
        {
          activeActor: {
            avatarUrl?: string | null;
            displayName: string;
            id: string;
            kind: "player" | "organization";
            role?: "owner" | "admin" | "member";
          };
          availableActors: Array<{
            avatarUrl?: string | null;
            displayName: string;
            id: string;
            kind: "player" | "organization";
            role?: "owner" | "admin" | "member";
          }>;
          capabilities: {
            canBrowseLeagues: boolean;
            canCreateLeague: boolean;
            canJoinLeagues: boolean;
            canManageLeagues: boolean;
          };
        }
      >;
    };
  };
} = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: {
  generated: {
    auth: {
      create: FunctionReference<
        "mutation",
        "internal",
        { input: { data: any; model: string }; select?: Array<string> },
        any
      >;
      deleteMany: FunctionReference<
        "mutation",
        "internal",
        {
          input: { model: string; where?: Array<any> };
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      deleteOne: FunctionReference<
        "mutation",
        "internal",
        { input: { model: string; where?: Array<any> } },
        any
      >;
      findMany: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          limit?: number;
          model: string;
          offset?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          sortBy?: { direction: "asc" | "desc"; field: string };
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            mode?: "sensitive" | "insensitive";
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null;
          }>;
        },
        any
      >;
      findOne: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          model: string;
          select?: Array<string>;
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            mode?: "sensitive" | "insensitive";
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null;
          }>;
        },
        any
      >;
      getLatestJwks: FunctionReference<"action", "internal", {}, any>;
      rotateKeys: FunctionReference<"action", "internal", {}, any>;
      updateMany: FunctionReference<
        "mutation",
        "internal",
        {
          input: { model: string; update: any; where?: Array<any> };
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      updateOne: FunctionReference<
        "mutation",
        "internal",
        { input: { model: string; update: any; where?: Array<any> } },
        any
      >;
    };
    server: {
      aggregateBackfill: FunctionReference<"mutation", "internal", any, any>;
      aggregateBackfillChunk: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
      aggregateBackfillStatus: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
      migrationCancel: FunctionReference<"mutation", "internal", any, any>;
      migrationRun: FunctionReference<"mutation", "internal", any, any>;
      migrationRunChunk: FunctionReference<"mutation", "internal", any, any>;
      migrationStatus: FunctionReference<"mutation", "internal", any, any>;
      reset: FunctionReference<"action", "internal", any, any>;
      resetChunk: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null; tableName: string },
        any
      >;
      scheduledDelete: FunctionReference<"mutation", "internal", any, any>;
      scheduledMutationBatch: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
    };
  };
  notification: {
    orchestrator: {
      claimPendingDeliveries: FunctionReference<
        "mutation",
        "internal",
        { limit?: number },
        Array<{
          deliveryId: string;
          message: {
            body: string;
            categoryId?: string;
            channelId: string;
            data: Record<string, any>;
            sound: "default";
            title: string;
            to: string;
          };
        }>
      >;
      createForRecipients: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string | null;
          eventType:
            | "league.membership.requested"
            | "league.membership.approved"
            | "league.membership.rejected"
            | "league.membership.removed"
            | "league.challenge.created"
            | "league.challenge.counter_proposed"
            | "league.challenge.proposal_accepted"
            | "league.challenge.proposal_declined"
            | "league.challenge.cancelled"
            | "league.challenge.cancellation_requested"
            | "league.challenge.cancellation_accepted"
            | "league.challenge.cancellation_rejected"
            | "league.challenge.result_submitted"
            | "league.challenge.result_confirmed"
            | "league.challenge.result_correction_requested"
            | "league.challenge.result_invalidated"
            | "league.challenge.admin_approved"
            | "league.challenge.admin_rejected";
          leagueId: string;
          metadata?: Record<string, any>;
          recipientUserIds: Array<string>;
        },
        any
      >;
      markDeliveryResults: FunctionReference<
        "mutation",
        "internal",
        {
          results: Array<{
            deliveryId: string;
            errorMessage?: string;
            responseId?: string;
            state:
              | "awaiting_delivery"
              | "in_progress"
              | "delivered"
              | "needs_retry"
              | "failed"
              | "maybe_delivered"
              | "unable_to_deliver";
          }>;
        },
        any
      >;
      sendPending: FunctionReference<"action", "internal", {}, any>;
    };
  };
  seed: {
    preview: FunctionReference<
      "mutation",
      "internal",
      { primaryUserEmail?: string; reset?: boolean; targetLeagueId?: string },
      {
        leaguesCreated: number;
        membershipsCreated: number;
        playerProfilesCreated: number;
        primaryUserLinked: boolean;
        resetApplied: boolean;
        skipped: boolean;
        targetLeagueLinked: boolean;
        usersCreated: number;
      }
    >;
  };
} = anyApi as any;

export const components = componentsGeneric() as unknown as {};
