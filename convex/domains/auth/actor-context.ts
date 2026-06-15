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
}): ViewerCapabilities {
  const isOrganization = input.actorKind === "organization";

  return viewerCapabilitiesSchema.parse({
    canBrowseLeagues: true,
    canCreateLeague: isOrganization,
    canJoinLeagues: !isOrganization,
    canManageLeagues: isOrganization,
  });
}
