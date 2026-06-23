import { z } from "zod";

export const actorKindOptions = ["player", "organization"] as const;
export const DEFAULT_ACTOR_KIND = "player";

export const actorKindSchema = z.enum(actorKindOptions);

export const viewerActorSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  displayName: z.string().min(1),
  id: z.string().min(1),
  kind: actorKindSchema,
  role: z.enum(["owner", "admin", "member"]).optional(),
});

export const MANAGER_ROLES = ["owner", "admin"] as const;
const MANAGER_ROLES_SET = new Set<string>(MANAGER_ROLES);

export const viewerCapabilitiesSchema = z.object({
  canBrowseLeagues: z.boolean(),
  canCreateLeague: z.boolean(),
  canJoinLeagues: z.boolean(),
  canManageLeagues: z.boolean(),
});

export const setActiveActorSchema = z
  .object({
    actorKind: actorKindSchema,
    organizationId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.actorKind !== "organization" || value.organizationId) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Organizacao invalida.",
      path: ["organizationId"],
    });
  });

export const activateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da organizacao."),
});

export const viewerContextSchema = z.object({
  activeActor: viewerActorSchema,
  availableActors: z.array(viewerActorSchema),
  capabilities: viewerCapabilitiesSchema,
});

export type ActorKind = z.infer<typeof actorKindSchema>;
export type ViewerActor = z.infer<typeof viewerActorSchema>;
export type ViewerCapabilities = z.infer<typeof viewerCapabilitiesSchema>;
export type ViewerContext = z.infer<typeof viewerContextSchema>;

export function resolveActorKind(value?: null | string): ActorKind {
  const parsedKind = actorKindSchema.safeParse(value);

  return parsedKind.success ? parsedKind.data : DEFAULT_ACTOR_KIND;
}

export function buildViewerCapabilities(input: {
  actorKind: ActorKind;
  role?: ViewerActor["role"];
}): ViewerCapabilities {
  const isOrganization = input.actorKind === "organization";
  const isManager =
    isOrganization &&
    input.role !== undefined &&
    MANAGER_ROLES_SET.has(input.role);

  return viewerCapabilitiesSchema.parse({
    canBrowseLeagues: true,
    canCreateLeague: isOrganization,
    canJoinLeagues: !isOrganization,
    canManageLeagues: isManager,
  });
}

/**
 * Whether a viewer actor is allowed to manage leagues on behalf of an
 * organization. Organization actors must also hold an owner/admin role — a
 * bare `member` is NOT a manager and must not pass league-management gates.
 */
export function isActiveActorManager(
  activeActor: Pick<ViewerActor, "kind" | "role">
) {
  return (
    activeActor.kind === "organization" &&
    activeActor.role !== undefined &&
    MANAGER_ROLES_SET.has(activeActor.role)
  );
}
