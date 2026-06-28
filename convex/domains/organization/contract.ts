import { z } from "zod";
import { requiredString } from "../../utils/contract.zod";

export const ORGANIZER_TYPES = [
  "academia",
  "clube",
  "condominio",
  "confederacao",
  "centro_de_treinamento",
  "escola",
  "federacao",
  "liga",
  "particular",
  "outro",
] as const;

export type OrganizerType = (typeof ORGANIZER_TYPES)[number];

const PHYSICAL_ORGANIZER_TYPES = [
  "academia",
  "clube",
  "centro_de_treinamento",
  "escola",
  "condominio",
] as const;

const PHYSICAL_ORGANIZER_TYPE_SET = new Set<string>(PHYSICAL_ORGANIZER_TYPES);

export function isPhysicalOrganizationType(type?: null | string) {
  return (
    type !== undefined && type !== null && PHYSICAL_ORGANIZER_TYPE_SET.has(type)
  );
}

export const SPORTS = [
  "tenis",
  "beach_tennis",
  "futevolei",
  "volei_de_praia",
  "padel",
  "squash",
  "futebol_society",
  "pickleball",
  "tenis_de_mesa",
  "raquetinha",
  "badminton",
  "volei_de_quadra",
  "outro",
] as const;

export type OrganizationSport = (typeof SPORTS)[number];

const organizerTypeEnum = z.enum(ORGANIZER_TYPES, {
  error: (issue) =>
    issue.input === undefined ? "Selecione o tipo." : undefined,
});

const sportsEnum = z.enum(SPORTS);

export const addressSchema = z.object({
  cep: requiredString("Informe o CEP.").pipe(
    z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(z.string().length(8, "CEP inválido (8 dígitos)."))
  ),
  street: z.string(),
  district: z.string().optional(),
  city: z.string(),
  state: requiredString("Informe o estado (UF).").pipe(
    z.string().trim().toUpperCase().length(2, "Use a sigla do estado (ex: SP).")
  ),
  number: requiredString("Informe o número."),
  complement: z.string().optional(),
});

export type OrganizationAddress = z.infer<typeof addressSchema>;

const acceptedTermsSchema = z.object({
  version: z.string().min(1),
  acceptedAt: z.string().min(1),
  userId: z.string().min(1),
});

export type AcceptedTerms = z.infer<typeof acceptedTermsSchema>;

/**
 * Input shape for accepted terms coming from the client. The client cannot know
 * the authenticated userId, so it sends an empty string and the server's
 * `activateOrganization` mutation injects `ctx.userId` before persisting. The
 * full {@link acceptedTermsSchema} (which requires userId) is only enforced on
 * the persisted/output schema.
 */
const acceptedTermsInputSchema = z.object({
  version: z.string().min(1),
  acceptedAt: z.string().min(1),
  userId: z.string(),
});

const logoStorageIdSchema = z.string().min(1, "Imagem inválida.").nullable();

export const organizationMetadataSchema = z
  .object({
    organizerType: organizerTypeEnum.nullable().optional(),
    organizerTypeLabel: z.string().trim().nullable().optional(),
    address: addressSchema.nullable().optional(),
    sports: z.array(sportsEnum).nullable().optional(),
    sportsLabel: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    website: z.string().trim().nullable().optional(),
    contactEmail: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    acceptedTerms: acceptedTermsSchema.nullable().optional(),
  })
  .nullish()
  .transform((value) => value ?? {})
  .pipe(
    z.object({
      organizerType: organizerTypeEnum.nullable().optional(),
      organizerTypeLabel: z.string().trim().nullable().optional(),
      address: addressSchema.nullable().optional(),
      sports: z.array(sportsEnum).nullable().optional(),
      sportsLabel: z.string().trim().nullable().optional(),
      description: z.string().trim().nullable().optional(),
      website: z.string().trim().nullable().optional(),
      contactEmail: z.string().trim().nullable().optional(),
      phone: z.string().trim().nullable().optional(),
      acceptedTerms: acceptedTermsSchema.nullable().optional(),
    })
  );

export type OrganizationMetadata = z.infer<typeof organizationMetadataSchema>;

const baseOrganizationFields = {
  name: requiredString("Informe o nome da organização."),
  logoStorageId: logoStorageIdSchema.optional(),
  description: z.string().trim().optional(),
  website: z.string().trim().optional(),
  contactEmail: requiredString("Informe o e-mail de contato.").pipe(
    z.string().trim().email("E-mail inválido.")
  ),
  phone: requiredString("Informe o telefone/WhatsApp.").pipe(
    z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(
        z
          .string()
          .min(10, "Telefone inválido (DD + número).")
          .max(11, "Telefone inválido (máx. 11 dígitos).")
      )
  ),
  sports: z.array(sportsEnum).optional(),
  organizerTypeLabel: z.string().trim().optional(),
  sportsLabel: z.string().trim().optional(),
};

function refineOrganizerAddress(
  input: { address?: unknown; organizerType?: null | string },
  ctx: z.RefinementCtx
) {
  const isPhysical = isPhysicalOrganizationType(input.organizerType);
  const hasAddress =
    input.address !== undefined &&
    input.address !== null &&
    !(
      typeof input.address === "object" &&
      input.address !== null &&
      Object.keys(input.address).length === 0
    );

  if (isPhysical && !hasAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o endereço da sede.",
      path: ["address"],
    });
  }

  if (!isPhysical && hasAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Este tipo de organização não possui endereço físico.",
      path: ["address"],
    });
  }
}

function refineOutroLabels(
  input: {
    organizerType?: null | string;
    organizerTypeLabel?: string;
    sports?: readonly string[];
    sportsLabel?: string;
  },
  ctx: z.RefinementCtx
) {
  if (input.organizerType === "outro" && !input.organizerTypeLabel?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Especifique o tipo da organização.",
      path: ["organizerTypeLabel"],
    });
  }

  if (input.sports?.includes("outro") && !input.sportsLabel?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Especifique a modalidade.",
      path: ["sportsLabel"],
    });
  }
}

export const activateOrganizationSchema = z
  .object({
    ...baseOrganizationFields,
    organizerType: organizerTypeEnum,
    address: addressSchema.nullable().optional(),
    acceptedTerms: acceptedTermsInputSchema,
  })
  .superRefine((value, ctx) => {
    refineOrganizerAddress(value, ctx);
    refineOutroLabels(value, ctx);
  });

export type ActivateOrganizationInput = z.infer<
  typeof activateOrganizationSchema
>;

export const upsertOrganizationSchema = z
  .object({
    ...baseOrganizationFields,
    organizerType: organizerTypeEnum,
    address: addressSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    refineOrganizerAddress(value, ctx);
    refineOutroLabels(value, ctx);
  });

export type UpsertOrganizationInput = z.infer<typeof upsertOrganizationSchema>;

export const organizationOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logoStorageId: logoStorageIdSchema,
  logoUrl: z.string().nullable().optional(),
  organizerType: organizerTypeEnum.nullable().optional(),
  organizerTypeLabel: z.string().nullable().optional(),
  address: addressSchema.nullable().optional(),
  sports: z.array(sportsEnum).nullable().optional(),
  sportsLabel: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  acceptedTerms: acceptedTermsSchema.nullable().optional(),
});

export type OrganizationOutput = z.infer<typeof organizationOutputSchema>;

export function collectReplacedLogoStorageIds(input: {
  next: { logoStorageId?: null | string };
  previous?: { logoStorageId?: null | string } | null;
}) {
  const previousLogo = input.previous?.logoStorageId ?? null;
  const nextLogo = input.next.logoStorageId ?? null;

  if (!previousLogo || previousLogo === nextLogo) {
    return [];
  }

  return [previousLogo];
}

export const CURRENT_TERMS_VERSION = "1.0.0";
