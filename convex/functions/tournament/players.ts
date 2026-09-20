import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import {
  normalizeUsernameLookup,
  resolvePartnerSearchGender,
  selectUsernameMatches,
} from "../../domains/tournament/entry-rules";
import {
  tournamentPlayerCardSchema,
  type TournamentGender,
  type TournamentModality,
} from "../../domains/tournament/contract";
import type { TournamentPlayerCard } from "../../domains/tournament/contract";
import { authQuery } from "../../lib/crpc";
import {
  getCategoryRecordOrThrow,
  serializePlayerCard,
} from "./_shared/guards";
import { requireActivePlayerProfile } from "../viewer/context";

const SEARCH_LIMIT = 10;
// Over-fetch (fix L1 r25): popular prefixes can fill the first 10
// alphabetical matches with the wrong gender — fetch more, then cap AFTER
// the gender/caller filters.
const PREFETCH_LIMIT = 25;

/**
 * Prefix search that feeds the doubles partner autocomplete (IBX-0074
 * r18-A; gender-filtered since r25; caller-gated since the r27 review).
 * The term is normalized the same way invites store it (lowercase, trim;
 * see `normalizeUsernameLookup`), so typing "Bru" finds "brunowilliang".
 * The gender the partner must have is resolved SERVER-SIDE from the
 * category and the authed caller's profile — never trusted from the client:
 * male/female categories fix it, mixed takes the opposite of the caller.
 * `resolvePartnerSearchGender` also applies the CALLER gate, so a viewer the
 * category refuses gets `[]` instead of suggestions `create` would reject.
 * Callers (or candidates) with the gender undefined on the profile are not
 * matched. Returns matches alphabetical by username, capped at 10,
 * excluding the caller — an empty array means "nobody to suggest", not an
 * error.
 */
export const searchByUsername = authQuery
  .input(
    z.object({
      categoryId: z.string().min(1),
      username: z.string().min(1, "Informe o usuário."),
    })
  )
  .output(z.array(tournamentPlayerCardSchema))
  .query(async ({ ctx, input }) => {
    const prefix = normalizeUsernameLookup(input.username);
    if (prefix.length === 0) {
      return [];
    }

    const category = await getCategoryRecordOrThrow(
      ctx,
      input.categoryId as Id<"tournamentCategory">
    );
    const viewerProfileId = await requireActivePlayerProfile(ctx);
    const viewerProfile = await ctx.orm.query.playerProfile.findFirst({
      where: { id: viewerProfileId },
    });
    const partnerGender = resolvePartnerSearchGender({
      categoryGender: category.gender as TournamentGender,
      modality: category.modality as TournamentModality,
      playerAGender: viewerProfile?.gender ?? null,
    });
    // `null` = nothing to suggest: the category refuses this caller (r27
    // review MEDIUM) or it is mixed and the caller's gender is undefined,
    // so there is no opposite to invite (r25). The create gate explains
    // what is missing.
    if (partnerGender === null) {
      return [];
    }

    const users = await ctx.orm.query.user.findMany({
      limit: PREFETCH_LIMIT,
      where: { username: { startsWith: prefix } },
    });
    const matches = selectUsernameMatches({
      limit: PREFETCH_LIMIT,
      prefix,
      users,
    });
    if (matches.length === 0) {
      return [];
    }

    const profiles = await ctx.orm.query.playerProfile.findMany({
      limit: PREFETCH_LIMIT,
      where: { userId: { in: matches.map((match) => match.id as Id<"user">) } },
    });
    const profileByUserId = new Map(
      profiles.map((profile) => [profile.userId as string, profile])
    );

    const cards: TournamentPlayerCard[] = [];
    for (const match of matches) {
      const profile = profileByUserId.get(match.id);
      // A user without a player profile is not a searchable player; a
      // profile without the required gender is not a valid partner here.
      if (!profile || profile.id === viewerProfileId) {
        continue;
      }
      if (profile.gender !== partnerGender) {
        continue;
      }
      cards.push(
        await serializePlayerCard(ctx, {
          avatarStorageId: profile.avatarStorageId,
          fullName: profile.fullName,
          nickname: profile.nickname,
          playerProfileId: profile.id as string,
          username: match.username,
        })
      );
      // LOW r25: the page is capped at SEARCH_LIMIT — stop before the
      // per-card storage lookup instead of serializing the whole over-fetch
      // and discarding it at the end (popular prefixes burned up to 15
      // lookups for nothing).
      if (cards.length === SEARCH_LIMIT) {
        break;
      }
    }
    return cards;
  });
