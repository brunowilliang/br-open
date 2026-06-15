import type { Id } from "../_generated/dataModel";
import { defineMigration } from "../generated/migrations.gen";

const DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS = 0;
const DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL = "month";

type LegacyLeagueDoc = {
  managerUserId?: Id<"user"> | null;
  maxPlayers?: null | number;
  monthlyPriceCents?: null | number;
  organizationId?: Id<"organization"> | null;
  priceBillingInterval?: null | string;
  visibility?: null | string;
};

function hasPatchValues(patch: Record<string, unknown>) {
  return Object.keys(patch).length > 0;
}

function buildLegacyOrganizationSlug(userId: Id<"user">) {
  return `legacy-org-${String(userId).replaceAll(/[^a-zA-Z0-9]/g, "-")}`;
}

export const migration = defineMigration({
  id: "20260615_083000_backfill_active_actor_league_fields",
  description: "backfill active actor league fields",
  up: {
    table: "league",
    migrateOne: async (ctx, doc) => {
      async function ensureLegacyOrganizationForUser(userId: Id<"user">) {
        const existingMember = await ctx.db
          .query("member")
          .withIndex("userId", (query) => query.eq("userId", userId))
          .first();

        if (existingMember?.organizationId) {
          return existingMember.organizationId as Id<"organization">;
        }

        const slug = buildLegacyOrganizationSlug(userId);
        const existingOrganization = await ctx.db
          .query("organization")
          .withIndex("organization_slug_unique", (query) =>
            query.eq("slug", slug)
          )
          .first();

        if (existingOrganization?._id) {
          await ctx.db.insert("member", {
            createdAt: Date.now(),
            organizationId: existingOrganization._id,
            role: "owner",
            userId,
          });

          return existingOrganization._id as Id<"organization">;
        }

        const user = await ctx.db.get(userId);

        if (!user) {
          return null;
        }

        const now = Date.now();
        const organizationId = await ctx.db.insert("organization", {
          createdAt: now,
          metadata: { migratedFromManagerUserId: userId },
          name: `Organizacao ${String(user.name ?? "BR Open")}`,
          slug,
          updatedAt: now,
        });

        await ctx.db.insert("member", {
          createdAt: now,
          organizationId,
          role: "owner",
          userId,
        });

        return organizationId;
      }

      const league = doc as LegacyLeagueDoc;
      const patch: Record<string, unknown> = {};

      if (!league.organizationId && league.managerUserId) {
        const organizationId = await ensureLegacyOrganizationForUser(
          league.managerUserId
        );

        if (organizationId) {
          patch.organizationId = organizationId;
        }
      }

      if (league.visibility === "invite_only") {
        patch.visibility = "public";
      }

      if (league.maxPlayers === undefined) {
        patch.maxPlayers = null;
      }

      if (
        league.monthlyPriceCents === undefined ||
        league.monthlyPriceCents === null
      ) {
        patch.monthlyPriceCents = DEFAULT_LEAGUE_MONTHLY_PRICE_CENTS;
      }

      if (!league.priceBillingInterval) {
        patch.priceBillingInterval = DEFAULT_LEAGUE_PRICE_BILLING_INTERVAL;
      }

      if ("managerUserId" in league) {
        patch.managerUserId = undefined;
      }

      return hasPatchValues(patch) ? patch : undefined;
    },
  },
});
