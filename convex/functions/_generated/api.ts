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
            | "tournament.partner.invited"
            | "tournament.partner.responded"
            | "tournament.partner.awaiting_reply"
            | "tournament.entry.created"
            | "tournament.entry.confirmed"
            | "tournament.entry.rejected"
            | "tournament.entry.refund_requested"
            | "tournament.bracket.published"
            | "tournament.bracket.placement_failed"
            | "tournament.match.reassigned"
            | "tournament.match.scheduled"
            | "tournament.match.rescheduled"
            | "tournament.match.result"
            | "tournament.match.result_edited"
            | "tournament.finished"
            | "tournament.cancelled";
          id: string;
          isRead: boolean;
          occurredAt: number;
          presentation: {
            action: {
              params: Record<string, string> | null;
              type:
                | "open_route"
                | "pay_tournament_entry"
                | "accept_partner_invite"
                | "decline_partner_invite"
                | "approve_tournament_entry"
                | "reject_tournament_entry";
            } | null;
            actionLabel: string | null;
            bodyHighlights: Array<string>;
            secondaryAction: {
              params: Record<string, string> | null;
              type:
                | "open_route"
                | "pay_tournament_entry"
                | "accept_partner_invite"
                | "decline_partner_invite"
                | "approve_tournament_entry"
                | "reject_tournament_entry";
            } | null;
            secondaryActionLabel: string | null;
          } | null;
          readAt: number | null;
          recipientActorKind: "player" | "organization";
          recipientOrganizationId: string | null;
          recipientPlayerProfileId: string | null;
          recipientUserId: string;
          retractedAt: number | null;
          sourceEntityId: string | null;
          sourceEntityType: string | null;
          status: "active" | "retracted";
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
            | "tournament.partner.invited"
            | "tournament.partner.responded"
            | "tournament.partner.awaiting_reply"
            | "tournament.entry.created"
            | "tournament.entry.confirmed"
            | "tournament.entry.rejected"
            | "tournament.entry.refund_requested"
            | "tournament.bracket.published"
            | "tournament.bracket.placement_failed"
            | "tournament.match.reassigned"
            | "tournament.match.scheduled"
            | "tournament.match.rescheduled"
            | "tournament.match.result"
            | "tournament.match.result_edited"
            | "tournament.finished"
            | "tournament.cancelled";
          id: string;
          isRead: boolean;
          occurredAt: number;
          presentation: {
            action: {
              params: Record<string, string> | null;
              type:
                | "open_route"
                | "pay_tournament_entry"
                | "accept_partner_invite"
                | "decline_partner_invite"
                | "approve_tournament_entry"
                | "reject_tournament_entry";
            } | null;
            actionLabel: string | null;
            bodyHighlights: Array<string>;
            secondaryAction: {
              params: Record<string, string> | null;
              type:
                | "open_route"
                | "pay_tournament_entry"
                | "accept_partner_invite"
                | "decline_partner_invite"
                | "approve_tournament_entry"
                | "reject_tournament_entry";
            } | null;
            secondaryActionLabel: string | null;
          } | null;
          readAt: number | null;
          recipientActorKind: "player" | "organization";
          recipientOrganizationId: string | null;
          recipientPlayerProfileId: string | null;
          recipientUserId: string;
          retractedAt: number | null;
          sourceEntityId: string | null;
          sourceEntityType: string | null;
          status: "active" | "retracted";
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
  organization: {
    profile: {
      generateUploadUrl: FunctionReference<"mutation", "public", {}, string>;
      get: FunctionReference<
        "query",
        "public",
        {},
        {
          acceptedTerms?: {
            acceptedAt: string;
            userId: string;
            version: string;
          } | null;
          address?: {
            cep: string;
            city: string;
            complement?: string;
            district?: string;
            number: string;
            state: string;
            street: string;
          } | null;
          contactEmail?: string | null;
          description?: string | null;
          id: string;
          logoStorageId: string | null;
          logoUrl?: string | null;
          name: string;
          organizerType?:
            | "academia"
            | "clube"
            | "condominio"
            | "confederacao"
            | "centro_de_treinamento"
            | "escola"
            | "federacao"
            | "liga"
            | "particular"
            | "outro"
            | null;
          organizerTypeLabel?: string | null;
          paymentAccount?: {
            accountName: string | null;
            name: string;
            onboardedAt: string | null;
            pixKey: string;
            status: "pending" | "active" | "rejected";
          } | null;
          phone?: string | null;
          slug: string;
          sports?: Array<
            | "tenis"
            | "beach_tennis"
            | "futevolei"
            | "volei_de_praia"
            | "padel"
            | "squash"
            | "futebol_society"
            | "pickleball"
            | "tenis_de_mesa"
            | "raquetinha"
            | "badminton"
            | "volei_de_quadra"
            | "outro"
          > | null;
          sportsLabel?: string | null;
          website?: string | null;
        } | null
      >;
      upsert: FunctionReference<
        "mutation",
        "public",
        {
          address?: {
            cep: string;
            city: string;
            complement?: string;
            district?: string;
            number: string;
            state: string;
            street: string;
          } | null;
          contactEmail: string;
          description?: string;
          logoStorageId?: string | null;
          name: string;
          organizerType:
            | "academia"
            | "clube"
            | "condominio"
            | "confederacao"
            | "centro_de_treinamento"
            | "escola"
            | "federacao"
            | "liga"
            | "particular"
            | "outro";
          organizerTypeLabel?: string;
          phone: string;
          sports?: Array<
            | "tenis"
            | "beach_tennis"
            | "futevolei"
            | "volei_de_praia"
            | "padel"
            | "squash"
            | "futebol_society"
            | "pickleball"
            | "tenis_de_mesa"
            | "raquetinha"
            | "badminton"
            | "volei_de_quadra"
            | "outro"
          >;
          sportsLabel?: string;
          website?: string;
        },
        {
          acceptedTerms?: {
            acceptedAt: string;
            userId: string;
            version: string;
          } | null;
          address?: {
            cep: string;
            city: string;
            complement?: string;
            district?: string;
            number: string;
            state: string;
            street: string;
          } | null;
          contactEmail?: string | null;
          description?: string | null;
          id: string;
          logoStorageId: string | null;
          logoUrl?: string | null;
          name: string;
          organizerType?:
            | "academia"
            | "clube"
            | "condominio"
            | "confederacao"
            | "centro_de_treinamento"
            | "escola"
            | "federacao"
            | "liga"
            | "particular"
            | "outro"
            | null;
          organizerTypeLabel?: string | null;
          paymentAccount?: {
            accountName: string | null;
            name: string;
            onboardedAt: string | null;
            pixKey: string;
            status: "pending" | "active" | "rejected";
          } | null;
          phone?: string | null;
          slug: string;
          sports?: Array<
            | "tenis"
            | "beach_tennis"
            | "futevolei"
            | "volei_de_praia"
            | "padel"
            | "squash"
            | "futebol_society"
            | "pickleball"
            | "tenis_de_mesa"
            | "raquetinha"
            | "badminton"
            | "volei_de_quadra"
            | "outro"
          > | null;
          sportsLabel?: string | null;
          website?: string | null;
        }
      >;
    };
  };
  payment: {
    charge: {
      createCharge: FunctionReference<
        "action",
        "public",
        { sourceId: string; sourceType: string },
        {
          brCode: string;
          chargeId: string;
          expiresAt: string | null;
          qrCodeUrl: string;
          status:
            "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CANCELED" | "FAILED";
        }
      >;
      getCheckoutContext: FunctionReference<
        "query",
        "public",
        { chargeId: string },
        {
          amountCents: number;
          brCode: string;
          chargeId: string;
          expiresAt: string | null;
          pendingCharge: {
            amountCents: number;
            brCode: string;
            chargeId: string;
            expiresAt: string | null;
            qrCodeUrl: string;
            status:
              | "PENDING"
              | "PAID"
              | "EXPIRED"
              | "REFUNDED"
              | "CANCELED"
              | "FAILED";
          } | null;
          qrCodeUrl: string;
          sourceCategory: string | null;
          sourceId: string;
          sourceLabel: string | null;
          sourceType: string;
          status:
            "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CANCELED" | "FAILED";
        }
      >;
      getPendingCharge: FunctionReference<
        "query",
        "public",
        { sourceId: string; sourceType: string },
        { chargeId: string } | null
      >;
      listMine: FunctionReference<
        "query",
        "public",
        {},
        {
          items: Array<{
            amountCents: number;
            chargeId: string;
            expiresAt: string | null;
            paidAt: string | null;
            sourceId: string;
            sourceLabel: string | null;
            sourceType: string;
            status:
              | "PENDING"
              | "PAID"
              | "EXPIRED"
              | "REFUNDED"
              | "CANCELED"
              | "FAILED";
          }>;
        }
      >;
      simulatePayment: FunctionReference<
        "mutation",
        "public",
        { chargeId: string },
        { activated: boolean }
      >;
    };
    dashboard: {
      getOverview: FunctionReference<
        "query",
        "public",
        {},
        {
          account: {
            name: string | null;
            pixKey: string | null;
            status: "pending" | "active" | "rejected" | null;
          };
          metrics: {
            paymentsThisMonth: number;
            receivedLastMonthCents: number;
            receivedThisMonthCents: number;
          };
          recentCharges: Array<{
            amountCents: number;
            chargeId: string;
            createdAt: string;
            organizerCents: number;
            paidAt: string | null;
            playerName: string | null;
            sourceLabel: string | null;
            status:
              | "PENDING"
              | "PAID"
              | "EXPIRED"
              | "REFUNDED"
              | "CANCELED"
              | "FAILED";
          }>;
        }
      >;
      getRevenueSeries: FunctionReference<
        "query",
        "public",
        { months?: number },
        {
          bySource: Array<{
            sourceId: string;
            sourceLabel: string | null;
            sourceType: string;
            totalCents: number;
          }>;
          series: Array<{ month: string; receivedCents: number }>;
          totalCents: number;
        }
      >;
    };
    onboarding: {
      getStatus: FunctionReference<
        "query",
        "public",
        {},
        {
          accountName: string | null;
          name: string | null;
          pixKey: string | null;
          status: "pending" | "active" | "rejected" | null;
        }
      >;
      start: FunctionReference<
        "action",
        "public",
        { accountName?: string; pixKey: string },
        {
          accountName: string | null;
          name: string;
          pixKey: string;
          status: "pending" | "active" | "rejected";
        }
      >;
    };
    withdraw: {
      getBalance: FunctionReference<
        "query",
        "public",
        {},
        {
          accountName: string | null;
          balanceCents: number;
          feeTiers: Array<{ feeCents: number; upToCents: number }>;
          freeFromCents: number;
          minWithdrawCents: number;
          pixKey: string;
        }
      >;
      requestWithdraw: FunctionReference<
        "action",
        "public",
        { amountCents: number; idempotencyKey?: string },
        {
          feeCents: number;
          liquidAmountCents: number;
          status: "pending" | "failed" | "completed";
        }
      >;
    };
  };
  pendings: {
    dismiss: {
      dismiss: FunctionReference<
        "mutation",
        "public",
        { itemId: string; surface: "home" | "house" },
        any
      >;
    };
    list: {
      list: FunctionReference<
        "query",
        "public",
        { scope: "organization" | "player"; surface?: "home" | "house" },
        {
          counts: {
            byDomain: { payment: number; player: number; tournament: number };
            bySeverity: { danger: number; info: number; warning: number };
            total: number;
          };
          items: Array<{
            action: {
              params: Record<string, string> | null;
              type:
                | "open_route"
                | "pay_tournament_entry"
                | "accept_partner_invite"
                | "decline_partner_invite"
                | "approve_tournament_entry"
                | "reject_tournament_entry";
            } | null;
            actionLabel: string | null;
            count: number | null;
            deadlineAt: number | null;
            description:
              | string
              | Array<{
                  parts: Array<{ isHighlighted?: boolean; text: string }>;
                }>;
            domain: "payment" | "player" | "tournament";
            id: string;
            kind:
              | "organization_tournament_entries_awaiting_approval"
              | "organization_tournament_entries_awaiting_payment"
              | "player_tournament_entries_awaiting_payment"
              | "player_tournament_entry_awaiting_approval"
              | "player_tournament_partner_invite_received"
              | "player_tournament_partner_invite_sent";
            moneyCents: number | null;
            params: Record<string, string> | null;
            route: string | null;
            secondaryAction: {
              params: Record<string, string> | null;
              type:
                | "open_route"
                | "pay_tournament_entry"
                | "accept_partner_invite"
                | "decline_partner_invite"
                | "approve_tournament_entry"
                | "reject_tournament_entry";
            } | null;
            secondaryActionLabel: string | null;
            severity: "danger" | "info" | "warning";
            source: {
              id: string;
              type: "organization" | "tournament" | "tournament_entry";
            };
            title: string;
          }>;
          saturation: Array<{
            kind:
              | "organization_tournament_entries_awaiting_approval"
              | "organization_tournament_entries_awaiting_payment"
              | "player_tournament_entries_awaiting_payment"
              | "player_tournament_entry_awaiting_approval"
              | "player_tournament_partner_invite_received"
              | "player_tournament_partner_invite_sent";
            limit: number;
          }>;
          scope: "organization" | "player";
          truncated: boolean;
        }
      >;
    };
  };
  player: {
    dashboard: {
      getOverview: FunctionReference<
        "query",
        "public",
        { months?: number },
        {
          entryCategories: Array<{
            categoryId: string;
            displayName: string;
            entryCount: number;
          }>;
          frequentPartner: {
            count: number;
            player: {
              avatarUrl: string | null;
              fullName: string;
              playerProfileId: string;
            };
          } | null;
          performance: {
            byMonth: Array<{ losses: number; month: string; wins: number }>;
            losses: number;
            winRate: number;
            wins: number;
          };
          upcomingMatches: Array<{
            categoryDisplayName: string | null;
            categoryId: string | null;
            competitionId: string;
            competitionName: string;
            courtName: string | null;
            endMinute: number | null;
            id: string;
            matchDate: string;
            opponents: Array<{
              avatarUrl: string | null;
              fullName: string;
              playerProfileId: string;
            }>;
            partner: {
              avatarUrl: string | null;
              fullName: string;
              playerProfileId: string;
            } | null;
            startMinute: number;
          }>;
        }
      >;
    };
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
  tournament: {
    bracket: {
      draw: FunctionReference<
        "mutation",
        "public",
        { tournamentId: string },
        { success: true }
      >;
      listBracket: FunctionReference<
        "query",
        "public",
        { tournamentId: string },
        Array<{
          categoryId: string;
          courtId: string | null;
          createdAt: number;
          endMinute: number | null;
          entryAId: string | null;
          entryBId: string | null;
          id: string;
          matchDate: string | null;
          round: number;
          rowVersion: number;
          scheduledById: string | null;
          score: {
            sets: Array<{
              aGames: number;
              bGames: number;
              kind: "set" | "tiebreak" | "super_tiebreak";
              tieBreak?: { aPoints: number; bPoints: number } | null;
            }>;
            winnerEntryId?: string | null;
          } | null;
          slotInRound: number;
          startMinute: number | null;
          status: "pending" | "scheduled" | "finished" | "vacant" | "walkover";
          updatedAt: number;
          walkover: boolean;
          winnerEntryId: string | null;
        }>
      >;
      start: FunctionReference<
        "mutation",
        "public",
        { tournamentId: string },
        { success: true }
      >;
      swapSlots: FunctionReference<
        "mutation",
        "public",
        {
          categoryId: string;
          roundA: number;
          roundB: number;
          sideA: "a" | "b";
          sideB: "a" | "b";
          slotA: number;
          slotB: number;
          tournamentId: string;
        },
        { success: true }
      >;
    };
    discovery: {
      getById: FunctionReference<
        "query",
        "public",
        { tournamentId: string },
        {
          activeEntryCount: number;
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          avatarUrl?: string | null;
          categories: Array<{
            displayName: string;
            entryFeeCents: number;
            gender: "male" | "female" | "mixed";
            id: string;
            maxEntries: number | null;
            modality: "singles" | "doubles";
            tournamentId: string;
            viewerEligible: boolean | null;
            viewerIneligibleReason: string | null;
          }>;
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
          isTournamentOrganizer: boolean;
          locationNotes?: string | null;
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          status:
            | "draft"
            | "published"
            | "drawn"
            | "ongoing"
            | "finished"
            | "cancelled";
          updatedAt: number;
          viewerEntryIds: Array<string>;
          visibility: "public" | "private";
        }
      >;
      listAvailable: FunctionReference<
        "query",
        "public",
        {},
        Array<{
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          avatarUrl?: string | null;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          status:
            | "draft"
            | "published"
            | "drawn"
            | "ongoing"
            | "finished"
            | "cancelled";
          updatedAt: number;
          visibility: "public" | "private";
        }>
      >;
      listParticipating: FunctionReference<
        "query",
        "public",
        {},
        Array<{
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          avatarUrl?: string | null;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          status:
            | "draft"
            | "published"
            | "drawn"
            | "ongoing"
            | "finished"
            | "cancelled";
          updatedAt: number;
          visibility: "public" | "private";
        }>
      >;
    };
    entries: {
      approve: FunctionReference<
        "mutation",
        "public",
        { entryId: string },
        {
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerAId: string;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }
      >;
      cancel: FunctionReference<
        "mutation",
        "public",
        { entryId: string },
        {
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerAId: string;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }
      >;
      create: FunctionReference<
        "mutation",
        "public",
        { categoryId: string; partnerUsername?: string },
        {
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerAId: string;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }
      >;
      listForTournament: FunctionReference<
        "query",
        "public",
        { tournamentId: string },
        Array<{
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerA: {
            avatarUrl: string | null;
            fullName: string | null;
            nickname: string | null;
            playerProfileId: string;
            username: string | null;
          } | null;
          playerAId: string;
          playerB: {
            avatarUrl: string | null;
            fullName: string | null;
            nickname: string | null;
            playerProfileId: string;
            username: string | null;
          } | null;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }>
      >;
      reject: FunctionReference<
        "mutation",
        "public",
        { entryId: string },
        {
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerAId: string;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }
      >;
      respondPartnerInvite: FunctionReference<
        "mutation",
        "public",
        { accept: boolean; entryId: string },
        {
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerAId: string;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }
      >;
      setEntryRound: FunctionReference<
        "mutation",
        "public",
        { entryId: string; entryRound: number | null },
        {
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerAId: string;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }
      >;
      setSeed: FunctionReference<
        "mutation",
        "public",
        { entryId: string; seedRank: number | null },
        {
          categoryId: string;
          createdAt: number;
          createdByUserId: string | null;
          entryRound: number | null;
          id: string;
          partnerUserId: string | null;
          playerAId: string;
          playerBId: string | null;
          seedRank: number | null;
          status:
            | "pending_partner"
            | "pending_approval"
            | "awaiting_payment"
            | "active"
            | "rejected"
            | "cancelled";
          updatedAt: number;
        }
      >;
    };
    lifecycle: {
      cancel: FunctionReference<
        "mutation",
        "public",
        { tournamentId: string },
        { success: true }
      >;
    };
    management: {
      create: FunctionReference<
        "mutation",
        "public",
        {
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          categories: Array<{
            entryFeeCents: number;
            gender: "male" | "female" | "mixed";
            maxEntries: number | null;
            modality: "singles" | "doubles";
          }>;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          visibility: "public" | "private";
        },
        {
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          avatarUrl?: string | null;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          status:
            | "draft"
            | "published"
            | "drawn"
            | "ongoing"
            | "finished"
            | "cancelled";
          updatedAt: number;
          visibility: "public" | "private";
        }
      >;
      generateUploadUrl: FunctionReference<"mutation", "public", {}, string>;
      getById: FunctionReference<
        "query",
        "public",
        { tournamentId: string },
        {
          categories: Array<{
            displayName: string;
            entryFeeCents: number;
            gender: "male" | "female" | "mixed";
            id: string;
            maxEntries: number | null;
            modality: "singles" | "doubles";
            tournamentId: string;
          }>;
          tournament: {
            approvalMode: "auto" | "manual";
            avatarStorageId: string | null;
            avatarUrl?: string | null;
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
            matchConfig: {
              bestOfSets: number;
              defaultDurationMinutes: number;
              gamesPerSet: number;
              hasTieBreak: boolean;
              scoringMode: "advantage" | "no_advantage";
              setMustWinByTwoGames: boolean;
              tieBreakMustWinByTwo: boolean;
              tieBreakPoints: number;
            };
            name: string;
            registrationDeadlineAt: number;
            startDate: number;
            state: string;
            status:
              | "draft"
              | "published"
              | "drawn"
              | "ongoing"
              | "finished"
              | "cancelled";
            updatedAt: number;
            visibility: "public" | "private";
          };
        }
      >;
      listMine: FunctionReference<
        "query",
        "public",
        {},
        Array<{
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          avatarUrl?: string | null;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          status:
            | "draft"
            | "published"
            | "drawn"
            | "ongoing"
            | "finished"
            | "cancelled";
          updatedAt: number;
          visibility: "public" | "private";
        }>
      >;
      publish: FunctionReference<
        "mutation",
        "public",
        { tournamentId: string },
        {
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          avatarUrl?: string | null;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          status:
            | "draft"
            | "published"
            | "drawn"
            | "ongoing"
            | "finished"
            | "cancelled";
          updatedAt: number;
          visibility: "public" | "private";
        }
      >;
      remove: FunctionReference<
        "mutation",
        "public",
        { tournamentId: string },
        { success: true }
      >;
      update: FunctionReference<
        "mutation",
        "public",
        {
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          categories: Array<{
            entryFeeCents: number;
            gender: "male" | "female" | "mixed";
            maxEntries: number | null;
            modality: "singles" | "doubles";
          }>;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          tournamentId: string;
          visibility: "public" | "private";
        },
        {
          approvalMode: "auto" | "manual";
          avatarStorageId: string | null;
          avatarUrl?: string | null;
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
          matchConfig: {
            bestOfSets: number;
            defaultDurationMinutes: number;
            gamesPerSet: number;
            hasTieBreak: boolean;
            scoringMode: "advantage" | "no_advantage";
            setMustWinByTwoGames: boolean;
            tieBreakMustWinByTwo: boolean;
            tieBreakPoints: number;
          };
          name: string;
          registrationDeadlineAt: number;
          startDate: number;
          state: string;
          status:
            | "draft"
            | "published"
            | "drawn"
            | "ongoing"
            | "finished"
            | "cancelled";
          updatedAt: number;
          visibility: "public" | "private";
        }
      >;
    };
    matches: {
      editResult: FunctionReference<
        "mutation",
        "public",
        {
          matchId: string;
          score: {
            sets: Array<{
              aGames: number;
              bGames: number;
              kind: "set" | "tiebreak" | "super_tiebreak";
              tieBreak?: { aPoints: number; bPoints: number } | null;
            }>;
            winnerEntryId?: string | null;
          };
          walkover?: boolean;
        },
        {
          categoryId: string;
          courtId: string | null;
          createdAt: number;
          endMinute: number | null;
          entryAId: string | null;
          entryBId: string | null;
          id: string;
          matchDate: string | null;
          round: number;
          rowVersion: number;
          scheduledById: string | null;
          score: {
            sets: Array<{
              aGames: number;
              bGames: number;
              kind: "set" | "tiebreak" | "super_tiebreak";
              tieBreak?: { aPoints: number; bPoints: number } | null;
            }>;
            winnerEntryId?: string | null;
          } | null;
          slotInRound: number;
          startMinute: number | null;
          status: "pending" | "scheduled" | "finished" | "vacant" | "walkover";
          updatedAt: number;
          walkover: boolean;
          winnerEntryId: string | null;
        }
      >;
      listForTournament: FunctionReference<
        "query",
        "public",
        { tournamentId: string },
        Array<{
          categoryId: string;
          courtId: string | null;
          createdAt: number;
          endMinute: number | null;
          entryAId: string | null;
          entryBId: string | null;
          id: string;
          matchDate: string | null;
          round: number;
          rowVersion: number;
          scheduledById: string | null;
          score: {
            sets: Array<{
              aGames: number;
              bGames: number;
              kind: "set" | "tiebreak" | "super_tiebreak";
              tieBreak?: { aPoints: number; bPoints: number } | null;
            }>;
            winnerEntryId?: string | null;
          } | null;
          slotInRound: number;
          startMinute: number | null;
          status: "pending" | "scheduled" | "finished" | "vacant" | "walkover";
          updatedAt: number;
          walkover: boolean;
          winnerEntryId: string | null;
        }>
      >;
      listOccupiedSlots: FunctionReference<
        "query",
        "public",
        { tournamentId: string },
        Array<{
          courtId: string;
          endMinute: number;
          matchDate: string;
          matchId: string;
          startMinute: number;
        }>
      >;
      publishResult: FunctionReference<
        "mutation",
        "public",
        {
          matchId: string;
          score: {
            sets: Array<{
              aGames: number;
              bGames: number;
              kind: "set" | "tiebreak" | "super_tiebreak";
              tieBreak?: { aPoints: number; bPoints: number } | null;
            }>;
            winnerEntryId?: string | null;
          };
          walkover?: boolean;
        },
        {
          categoryId: string;
          courtId: string | null;
          createdAt: number;
          endMinute: number | null;
          entryAId: string | null;
          entryBId: string | null;
          id: string;
          matchDate: string | null;
          round: number;
          rowVersion: number;
          scheduledById: string | null;
          score: {
            sets: Array<{
              aGames: number;
              bGames: number;
              kind: "set" | "tiebreak" | "super_tiebreak";
              tieBreak?: { aPoints: number; bPoints: number } | null;
            }>;
            winnerEntryId?: string | null;
          } | null;
          slotInRound: number;
          startMinute: number | null;
          status: "pending" | "scheduled" | "finished" | "vacant" | "walkover";
          updatedAt: number;
          walkover: boolean;
          winnerEntryId: string | null;
        }
      >;
      scheduleMatch: FunctionReference<
        "mutation",
        "public",
        {
          courtId: string;
          endMinute: number;
          matchDate: string;
          matchId: string;
          startMinute: number;
        },
        {
          categoryId: string;
          courtId: string | null;
          createdAt: number;
          endMinute: number | null;
          entryAId: string | null;
          entryBId: string | null;
          id: string;
          matchDate: string | null;
          round: number;
          rowVersion: number;
          scheduledById: string | null;
          score: {
            sets: Array<{
              aGames: number;
              bGames: number;
              kind: "set" | "tiebreak" | "super_tiebreak";
              tieBreak?: { aPoints: number; bPoints: number } | null;
            }>;
            winnerEntryId?: string | null;
          } | null;
          slotInRound: number;
          startMinute: number | null;
          status: "pending" | "scheduled" | "finished" | "vacant" | "walkover";
          updatedAt: number;
          walkover: boolean;
          winnerEntryId: string | null;
        }
      >;
    };
    players: {
      searchByUsername: FunctionReference<
        "query",
        "public",
        { categoryId: string; username: string },
        Array<{
          avatarUrl: string | null;
          fullName: string | null;
          nickname: string | null;
          playerProfileId: string;
          username: string | null;
        }>
      >;
    };
  };
  viewer: {
    context: {
      activateOrganization: FunctionReference<
        "mutation",
        "public",
        {
          acceptedTerms: {
            acceptedAt: string;
            userId: string;
            version: string;
          };
          address?: {
            cep: string;
            city: string;
            complement?: string;
            district?: string;
            number: string;
            state: string;
            street: string;
          } | null;
          contactEmail: string;
          description?: string;
          logoStorageId?: string | null;
          name: string;
          organizerType:
            | "academia"
            | "clube"
            | "condominio"
            | "confederacao"
            | "centro_de_treinamento"
            | "escola"
            | "federacao"
            | "liga"
            | "particular"
            | "outro";
          organizerTypeLabel?: string;
          phone: string;
          sports?: Array<
            | "tenis"
            | "beach_tennis"
            | "futevolei"
            | "volei_de_praia"
            | "padel"
            | "squash"
            | "futebol_society"
            | "pickleball"
            | "tenis_de_mesa"
            | "raquetinha"
            | "badminton"
            | "volei_de_quadra"
            | "outro"
          >;
          sportsLabel?: string;
          website?: string;
        },
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
          capabilities: { canManageOrganization: boolean };
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
          capabilities: { canManageOrganization: boolean };
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
          capabilities: { canManageOrganization: boolean };
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
    aggregate: {
      aggregateBackfill: FunctionReference<"mutation", "internal", any, any>;
      aggregateBackfillChunk: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
      aggregateBackfillStatus: FunctionReference<"query", "internal", any, any>;
    };
    auth: {
      count: FunctionReference<
        "query",
        "internal",
        {
          model: string;
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
              string | number | boolean | Array<string> | Array<number> | null;
          }>;
        },
        any
      >;
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
              string | number | boolean | Array<string> | Array<number> | null;
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
              string | number | boolean | Array<string> | Array<number> | null;
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
      migrationCancel: FunctionReference<"mutation", "internal", any, any>;
      migrationRun: FunctionReference<"mutation", "internal", any, any>;
      migrationRunChunk: FunctionReference<"mutation", "internal", any, any>;
      migrationStatus: FunctionReference<"query", "internal", any, any>;
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
            | "tournament.partner.invited"
            | "tournament.partner.responded"
            | "tournament.partner.awaiting_reply"
            | "tournament.entry.created"
            | "tournament.entry.confirmed"
            | "tournament.entry.rejected"
            | "tournament.entry.refund_requested"
            | "tournament.bracket.published"
            | "tournament.bracket.placement_failed"
            | "tournament.match.reassigned"
            | "tournament.match.scheduled"
            | "tournament.match.rescheduled"
            | "tournament.match.result"
            | "tournament.match.result_edited"
            | "tournament.finished"
            | "tournament.cancelled";
          metadata?: Record<string, any>;
          recipientUserIds: Array<string>;
          sourceEntityId?: string;
          sourceEntityType?: string;
          tournamentId: string;
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
      releaseLock: FunctionReference<"mutation", "internal", {}, any>;
      retractNotifications: FunctionReference<
        "mutation",
        "internal",
        {
          eventTypes?: Array<string>;
          exceptEventTypes?: Array<string>;
          sourceEntityId: string;
          sourceEntityType: string;
        },
        { retractedCount: number }
      >;
      sendPending: FunctionReference<"action", "internal", {}, any>;
      sweepStaleInProgressDeliveries: FunctionReference<
        "mutation",
        "internal",
        {},
        any
      >;
    };
  };
  payment: {
    charge: {
      applyChargeCancelOutcome: FunctionReference<
        "mutation",
        "internal",
        { chargeId: string; outcome: "canceled" | "failed" },
        { cancelStatus: string }
      >;
      applyPaidCharge: FunctionReference<
        "mutation",
        "internal",
        { correlationId: string; providerTransactionId?: string },
        { activated: boolean }
      >;
      cancelPendingChargesForSource: FunctionReference<
        "mutation",
        "internal",
        { sourceIds: Array<string>; sourceType: string },
        { canceledCount: number }
      >;
      expireStaleCharges: FunctionReference<"mutation", "internal", {}, any>;
      findPendingChargeForSource: FunctionReference<
        "mutation",
        "internal",
        { sourceId: string; sourceType: string; userId: string },
        {
          brCode: string;
          chargeId: string;
          expiresAt: string | null;
          qrCodeUrl: string;
          status:
            "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CANCELED" | "FAILED";
        } | null
      >;
      findStaleChargesForReconciliation: FunctionReference<
        "mutation",
        "internal",
        {},
        any
      >;
      getChargeForProviderCommand: FunctionReference<
        "query",
        "internal",
        { chargeId: string },
        {
          amountCents: number;
          correlationId: string;
          refundStatus: string | null;
          status: string;
        } | null
      >;
      markChargeExpired: FunctionReference<
        "mutation",
        "internal",
        { correlationId: string },
        any
      >;
      markChargeRefunded: FunctionReference<
        "mutation",
        "internal",
        { correlationId: string },
        any
      >;
      processChargeCancellation: FunctionReference<
        "action",
        "internal",
        { chargeId: string },
        { outcome: "canceled" | "failed" | "late_payment" | "skipped" }
      >;
      reconcileCharges: FunctionReference<"action", "internal", {}, any>;
      resolveActiveManagerOrg: FunctionReference<
        "mutation",
        "internal",
        { userId: string },
        { organizationId: string }
      >;
      resolveOrganizationForOnboarding: FunctionReference<
        "mutation",
        "internal",
        { organizationId: string },
        { name: string | null }
      >;
      resolvePaymentAccount: FunctionReference<
        "mutation",
        "internal",
        { organizationId: string },
        any
      >;
      resolveSourceForCharge: FunctionReference<
        "mutation",
        "internal",
        { sourceId: string; sourceType: string; userId: string },
        any
      >;
      saveCharge: FunctionReference<
        "mutation",
        "internal",
        {
          amountCents: number;
          brCode: string;
          correlationId: string;
          expiresAt: string | null;
          organizationId: string;
          playerProfileId: string;
          providerChargeId: string;
          qrCodeImage: string;
          sourceId: string;
          sourceLabel: string;
          sourceType: string;
          splitConfig: any;
          status: string;
        },
        {
          charge: {
            brCode: string;
            chargeId: string;
            expiresAt: string | null;
            qrCodeUrl: string;
            status:
              | "PENDING"
              | "PAID"
              | "EXPIRED"
              | "REFUNDED"
              | "CANCELED"
              | "FAILED";
          };
          reused: boolean;
        }
      >;
      sweepPendingChargeCancellations: FunctionReference<
        "mutation",
        "internal",
        {},
        any
      >;
    };
    onboarding: {
      upsertAccount: FunctionReference<
        "mutation",
        "internal",
        {
          accountName?: string | null;
          name: string;
          organizationId: string;
          pixKey: string;
        },
        any
      >;
    };
    providerNode: {
      createChargeWithSplitAction: FunctionReference<
        "action",
        "internal",
        {
          amountCents: number;
          comment: string;
          correlationId: string;
          expiresInSeconds: number;
          organizerCents: number;
          recipientPixKey: string;
        },
        {
          brCode: string;
          correlationId: string;
          expiresDate: string | null;
          paymentLinkUrl: string;
          qrCodeImage: string;
          status: string;
          transactionID: string;
          value: number;
        }
      >;
      createSubaccountAction: FunctionReference<
        "action",
        "internal",
        { name: string; pixKey: string },
        { name: string; pixKey: string }
      >;
      debitSubaccountAction: FunctionReference<
        "action",
        "internal",
        { pixKey: string; valueCents: number },
        { value: number }
      >;
      deleteChargeAction: FunctionReference<
        "action",
        "internal",
        { correlationId: string },
        { deleted: boolean; message: string | null }
      >;
      getChargeStatusAction: FunctionReference<
        "action",
        "internal",
        { correlationId: string },
        { status: string | null }
      >;
      getSubaccountBalanceAction: FunctionReference<
        "action",
        "internal",
        { pixKey: string },
        { balanceCents: number; withdrawBlocked: boolean }
      >;
      refundChargeAction: FunctionReference<
        "action",
        "internal",
        { chargeCorrelationId: string; valueCents: number },
        { status: string }
      >;
      withdrawSubaccountAction: FunctionReference<
        "action",
        "internal",
        { pixKey: string; valueCents: number },
        { status: string; transactionId: string | null }
      >;
    };
    withdraw: {
      completeWithdrawal: FunctionReference<
        "mutation",
        "internal",
        {
          balanceAfterCents: number;
          failureReason: string | null;
          feeCollected: boolean;
          idempotencyKey: string;
          wooviWithdrawId: string | null;
        },
        any
      >;
      failWithdrawal: FunctionReference<
        "mutation",
        "internal",
        { failureReason: string; idempotencyKey: string },
        any
      >;
      isWithdrawFeeStillDue: FunctionReference<
        "query",
        "internal",
        { id: string },
        boolean
      >;
      listActivePaymentOrgs: FunctionReference<
        "query",
        "internal",
        {},
        Array<{ organizationId: string; pixKey: string }>
      >;
      listUncollectedFees: FunctionReference<
        "query",
        "internal",
        {},
        Array<{ feeCents: number; id: string; pixKey: string }>
      >;
      markWithdrawFailedByProviderId: FunctionReference<
        "mutation",
        "internal",
        { providerId: string; reason: string },
        any
      >;
      markWithdrawFeeCollected: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        any
      >;
      refreshSubaccountBalances: FunctionReference<
        "action",
        "internal",
        {},
        any
      >;
      reserveWithdrawal: FunctionReference<
        "mutation",
        "internal",
        {
          amountCents: number;
          feeCents: number;
          idempotencyKey: string;
          liquidAmountCents: number;
          organizationId: string;
        },
        {
          created: boolean;
          failureReason: string | null;
          feeCents: number;
          liquidAmountCents: number;
          status: "pending" | "failed" | "completed";
        }
      >;
      sweepPendingWithdrawFees: FunctionReference<
        "action",
        "internal",
        {},
        any
      >;
      upsertBalanceCache: FunctionReference<
        "mutation",
        "internal",
        { balanceCents: number; organizationId: string },
        any
      >;
    };
  };
  seed: {
    doublesAgendaScenario: FunctionReference<
      "mutation",
      "internal",
      { primaryUserEmail: string },
      {
        acceptedInvites: number;
        categories: Array<{
          activeEntries: number;
          displayName: string;
          gender: string;
          round1Matches: number;
          scheduledMatches: number;
        }>;
        courtsAdded: number;
        matchesRescheduled: number;
        matchesScheduled: number;
        nextStep: "assemble_bracket" | "start_tournament" | null;
        pairsPlanted: number;
        scheduled: Array<{
          category: string;
          courtName: string;
          matchDate: string;
          round: number;
          sideA: string;
          sideB: string;
          startMinute: number;
        }>;
        status: string;
        totalMatches: number;
        tournamentId: string;
        tournamentName: string;
      }
    >;
    doublesScenario: FunctionReference<
      "mutation",
      "internal",
      { primaryUserEmail: string },
      {
        activePairsCreated: number;
        categories: Array<{
          activePairs: number;
          displayName: string;
          gender: string;
          invitePairs: number;
        }>;
        categoriesCreated: number;
        invitePairsCreated: number;
        organizationId: string;
        organizationName: string;
        organizationsTouched: number;
        playerProfilesCreated: number;
        tournamentId: string;
        tournamentName: string;
        tournamentsCreated: number;
        usersCreated: number;
      }
    >;
    pendencyScenario: FunctionReference<
      "mutation",
      "internal",
      { primaryUserEmail: string },
      {
        categoriesCreated: number;
        entriesCreated: number;
        organizationId: string;
        playerProfileId: string;
        playerProfilesCreated: number;
        primaryEntriesCreated: number;
        primaryOrganizationsTouched: number;
        tournamentsCreated: number;
        userId: string;
        usersCreated: number;
      }
    >;
    preview: FunctionReference<
      "mutation",
      "internal",
      { primaryUserEmail?: string; reset?: boolean },
      {
        playerProfilesCreated: number;
        primaryUserLinked: boolean;
        resetApplied: boolean;
        skipped: boolean;
        usersCreated: number;
      }
    >;
  };
  tournament: {
    bracket: {
      autoStartTournaments: FunctionReference<
        "mutation",
        "internal",
        {},
        { drawn: number; started: number }
      >;
      performDraw: FunctionReference<
        "mutation",
        "internal",
        { expectedStatus?: "drawn" | "published"; tournamentId: string },
        { ok: true } | { error: string; ok: false }
      >;
      performStart: FunctionReference<
        "mutation",
        "internal",
        { tournamentId: string },
        { ok: true } | { error: string; ok: false }
      >;
    };
    lifecycle: {
      applyRefundOutcome: FunctionReference<
        "mutation",
        "internal",
        { chargeId: string; outcome: "pending" | "refunded" | "failed" },
        any
      >;
      findRefundableCharge: FunctionReference<
        "query",
        "internal",
        { chargeId: string },
        { amountCents: number; chargeId: string; correlationId: string } | null
      >;
      listRefundableCharges: FunctionReference<
        "query",
        "internal",
        { tournamentId: string },
        Array<{ amountCents: number; chargeId: string; correlationId: string }>
      >;
      processRefunds: FunctionReference<
        "action",
        "internal",
        { tournamentId: string },
        any
      >;
      refundLatePaymentForCharge: FunctionReference<
        "action",
        "internal",
        { chargeId: string },
        any
      >;
      sweepPendingRefunds: FunctionReference<"mutation", "internal", {}, any>;
    };
    placement: {
      placeActiveEntry: FunctionReference<
        "mutation",
        "internal",
        { categoryId: string; entryId: string },
        { placed: boolean }
      >;
      removeCancelledEntry: FunctionReference<
        "mutation",
        "internal",
        { categoryId: string; entryId: string },
        { removed: boolean }
      >;
    };
  };
} = anyApi as any;

export const components = componentsGeneric() as unknown as {};
