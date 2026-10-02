import { z } from "zod";

// ---------------------------------------------------------------------------
// Exclusao de conta — contrato do fluxo (status, codigo e confirmacao)
// ---------------------------------------------------------------------------
// A regua inteira (bloqueios + resolucoes) nasce no SERVIDOR: o status devolve
// os dois arrays prontos e o app so renderiza. `confirm` devolve um union
// ESTRUTURADO em vez de CRPCError: a checagem do codigo grava a tentativa, e
// mutation que lanca perde as escritas — o erro esperado precisa vir no retorno.

export const ACCOUNT_DELETION_SCOPE_OPTIONS = [
  "player",
  "organization",
] as const;

export const ACCOUNT_DELETION_BLOCKER_CODES = [
  "organization_active_tournament",
  "organization_money_in_flight",
  "organization_locked_balance",
  "organization_other_members",
] as const;

export const ACCOUNT_DELETION_RESOLUTION_CODES = [
  "entries_cancelled",
  "entries_refunded",
  "pix_cancelled",
  "matches_walkover",
  "drafts_deleted",
] as const;

export const accountDeletionBlockerSchema = z.object({
  code: z.enum(ACCOUNT_DELETION_BLOCKER_CODES),
  count: z.number().int().nonnegative(),
  // Ids so do bloqueio de torneio (vazio nos demais), alinhados POR INDICE:
  // `organizationIds[i]` e a org dona de `tournamentIds[i]` (o app troca o
  // ator pela org certa antes de abrir o torneio).
  organizationIds: z.array(z.string()),
  scope: z.enum(ACCOUNT_DELETION_SCOPE_OPTIONS),
  summary: z.string(),
  tournamentIds: z.array(z.string()),
});

export const accountDeletionResolutionSchema = z.object({
  code: z.enum(ACCOUNT_DELETION_RESOLUTION_CODES),
  count: z.number().int().nonnegative(),
  scope: z.enum(ACCOUNT_DELETION_SCOPE_OPTIONS),
  summary: z.string(),
});

export const accountDeletionStatusSchema = z.object({
  blockers: z.array(accountDeletionBlockerSchema),
  canDelete: z.boolean(),
  resolutions: z.array(accountDeletionResolutionSchema),
});

export const confirmAccountDeletionSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
});

export const accountDeletionConfirmResultSchema = z.discriminatedUnion(
  "status",
  [
    z.object({
      blockers: z.array(accountDeletionBlockerSchema),
      status: z.literal("blocked"),
    }),
    z.object({ status: z.literal("code_expired") }),
    z.object({ status: z.literal("deleted") }),
    z.object({
      attemptsLeft: z.number().int().nonnegative(),
      status: z.literal("invalid_code"),
    }),
    z.object({ status: z.literal("too_many_attempts") }),
  ]
);

export const requestAccountDeletionCodeResultSchema = z.object({
  sentAt: z.number(),
});

export type AccountDeletionBlocker = z.infer<
  typeof accountDeletionBlockerSchema
>;
export type AccountDeletionBlockerCode =
  (typeof ACCOUNT_DELETION_BLOCKER_CODES)[number];
export type AccountDeletionConfirmResult = z.infer<
  typeof accountDeletionConfirmResultSchema
>;
export type AccountDeletionResolution = z.infer<
  typeof accountDeletionResolutionSchema
>;
export type AccountDeletionScope =
  (typeof ACCOUNT_DELETION_SCOPE_OPTIONS)[number];
export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>;
export type RequestAccountDeletionCodeResult = z.infer<
  typeof requestAccountDeletionCodeResultSchema
>;
