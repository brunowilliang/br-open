import { CRPCError } from "kitcn/server";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";
import {
  activateOrganizationSchema,
  buildViewerCapabilities,
  resolveActorKind,
  setActiveActorSchema,
  viewerContextSchema,
  type ViewerActor,
  type ViewerContext,
} from "../../domains/auth/actor-context";
import {
  member,
  organization,
  userPreference,
} from "../../domains/auth/tables";
import { authMutation, authQuery, type AuthenticatedCtx } from "../../lib/crpc";

type ViewerCtx = AuthenticatedCtx<QueryCtx | MutationCtx>;
type ViewerMutationCtx = AuthenticatedCtx<MutationCtx>;

const ORGANIZATION_ROLE_OPTIONS = ["owner", "admin", "member"] as const;

function resolveOrganizationRole(role: string): ViewerActor["role"] {
  return ORGANIZATION_ROLE_OPTIONS.includes(
    role as (typeof ORGANIZATION_ROLE_OPTIONS)[number]
  )
    ? (role as ViewerActor["role"])
    : "member";
}

function createOrganizationSlug(input: { name: string; userId: Id<"user"> }) {
  const normalizedName = input.name
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  const baseSlug = normalizedName || "organizacao";

  return `${baseSlug}-${String(input.userId).slice(-8)}-${Date.now()}`;
}

async function getPlayerActor(
  ctx: ViewerCtx,
  userId: Id<"user">
): Promise<ViewerActor> {
  const [user, currentPlayerProfile] = await Promise.all([
    ctx.orm.query.user.findFirst({ where: { id: userId } }),
    ctx.orm.query.playerProfile.findFirst({ where: { userId } }),
  ]);

  if (!(user && currentPlayerProfile)) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Perfil de jogador nao encontrado.",
    });
  }

  const displayName =
    currentPlayerProfile.nickname?.trim() ||
    currentPlayerProfile.fullName?.trim() ||
    user.name;

  return viewerContextSchema.shape.activeActor.parse({
    avatarUrl: user.image ?? null,
    displayName,
    id: currentPlayerProfile.id,
    kind: "player",
  });
}

async function getOrganizationActors(
  ctx: ViewerCtx,
  userId: Id<"user">
): Promise<ViewerActor[]> {
  const memberships = await ctx.orm.query.member.findMany({
    limit: 100,
    where: { userId },
  });

  const organizationActors = await Promise.all(
    memberships.map(async (currentMember) => {
      const currentOrganization = await ctx.orm.query.organization.findFirst({
        where: {
          id: currentMember.organizationId as Id<"organization">,
        },
      });

      if (!currentOrganization) {
        return null;
      }

      return viewerContextSchema.shape.activeActor.parse({
        avatarUrl: currentOrganization.logo ?? null,
        displayName: currentOrganization.name,
        id: currentOrganization.id,
        kind: "organization",
        role: resolveOrganizationRole(currentMember.role),
      });
    })
  );

  return organizationActors.filter(
    (actor): actor is ViewerActor => actor !== null
  );
}

function getValidOrganizationActor(input: {
  activeOrganizationId?: Id<"organization"> | null;
  organizationActors: ViewerActor[];
}) {
  if (!input.activeOrganizationId) {
    return null;
  }

  return (
    input.organizationActors.find(
      (actor) => actor.id === input.activeOrganizationId
    ) ?? null
  );
}

function getViewerPreference(ctx: ViewerCtx, userId: Id<"user">) {
  return ctx.orm.query.userPreference.findFirst({
    where: { userId },
  });
}

async function upsertViewerPreference(
  ctx: ViewerMutationCtx,
  input: {
    activeActorKind: "player" | "organization";
    activeOrganizationId?: Id<"organization"> | null;
    userId: Id<"user">;
  }
) {
  const now = new Date();

  await ctx.orm
    .insert(userPreference)
    .values({
      activeActorKind: input.activeActorKind,
      activeOrganizationId: input.activeOrganizationId ?? null,
      createdAt: now,
      updatedAt: now,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        activeActorKind: input.activeActorKind,
        activeOrganizationId: input.activeOrganizationId ?? null,
        updatedAt: now,
      },
      target: userPreference.userId,
    });
}

async function assertOrganizationMember(input: {
  ctx: ViewerCtx;
  organizationId: Id<"organization">;
  userId: Id<"user">;
}) {
  const currentMember = await input.ctx.orm.query.member.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
    },
  });

  if (!currentMember) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Voce nao faz parte dessa organizacao.",
    });
  }
}

export async function getViewerContext(
  ctx: ViewerCtx,
  userId: Id<"user">
): Promise<ViewerContext> {
  const [preference, playerActor, organizationActors] = await Promise.all([
    getViewerPreference(ctx, userId),
    getPlayerActor(ctx, userId),
    getOrganizationActors(ctx, userId),
  ]);
  const requestedActorKind = resolveActorKind(preference?.activeActorKind);
  const activeOrganizationActor = getValidOrganizationActor({
    activeOrganizationId:
      preference?.activeOrganizationId as Id<"organization"> | null,
    organizationActors,
  });
  const activeActor =
    requestedActorKind === "organization" && activeOrganizationActor
      ? activeOrganizationActor
      : playerActor;

  return viewerContextSchema.parse({
    activeActor,
    availableActors: [playerActor, ...organizationActors],
    capabilities: buildViewerCapabilities({ actorKind: activeActor.kind }),
  });
}

export async function requireActivePlayerProfile(ctx: ViewerCtx) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);

  if (viewerContext.activeActor.kind !== "player") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Ative seu perfil de jogador para participar.",
    });
  }

  return viewerContext.activeActor.id as Id<"playerProfile">;
}

export async function requireActiveOrganization(ctx: ViewerCtx) {
  const viewerContext = await getViewerContext(ctx, ctx.userId);

  if (viewerContext.activeActor.kind !== "organization") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Ative uma organizacao para gerenciar ligas.",
    });
  }

  return viewerContext.activeActor.id as Id<"organization">;
}

export const get = authQuery
  .output(viewerContextSchema)
  .query(({ ctx }) => getViewerContext(ctx, ctx.userId));

export const setActiveActor = authMutation
  .input(setActiveActorSchema)
  .output(viewerContextSchema)
  .mutation(async ({ ctx, input }) => {
    if (input.actorKind === "organization") {
      await assertOrganizationMember({
        ctx,
        organizationId: input.organizationId as Id<"organization">,
        userId: ctx.userId,
      });
    }

    await upsertViewerPreference(ctx, {
      activeActorKind: input.actorKind,
      activeOrganizationId:
        input.actorKind === "organization"
          ? (input.organizationId as Id<"organization">)
          : null,
      userId: ctx.userId,
    });

    return getViewerContext(ctx, ctx.userId);
  });

export const activateOrganization = authMutation
  .input(activateOrganizationSchema)
  .output(viewerContextSchema)
  .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const organizationName = input.name.trim();
    const [createdOrganization] = await ctx.orm
      .insert(organization)
      .values({
        createdAt: now,
        metadata: {},
        name: organizationName,
        slug: createOrganizationSlug({
          name: organizationName,
          userId: ctx.userId,
        }),
        updatedAt: now,
      })
      .returning();

    await ctx.orm.insert(member).values({
      createdAt: now,
      organizationId: createdOrganization.id as Id<"organization">,
      role: "owner",
      userId: ctx.userId,
    });

    await upsertViewerPreference(ctx, {
      activeActorKind: "organization",
      activeOrganizationId: createdOrganization.id as Id<"organization">,
      userId: ctx.userId,
    });

    return getViewerContext(ctx, ctx.userId);
  });
