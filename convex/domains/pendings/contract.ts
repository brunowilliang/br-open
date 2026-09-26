import { z } from "zod";

// ---------------------------------------------------------------------------
// Pendencias/alertas centralizados — contrato do item
// ---------------------------------------------------------------------------
// Fonte unica: o item nasce no SERVIDOR (kind + copy + destaque + ordem + rota)
// e a tela so renderiza. `description` carrega LINHAS de PARTES porque quem
// decide o destaque e a quebra por linha e o servidor, nao a tela.
// Severidade `info` nao existe no componente do app: o cliente a mapeia para `accent`.
// Nomes: primeiro segmento = QUEM DEVE A ACAO (`player`|`organization`), depois
// dominio + pendencia. O enum e FECHADO e cresce por ADICAO (aqui +
// `PENDING_KINDS_BY_SCOPE` + registro + spec). Pendencia sem cartao aprovado
// pelo usuario NAO entra.

export const PENDING_SCOPE_OPTIONS = ["organization", "player"] as const;

export const PENDING_KINDS_BY_SCOPE = {
  organization: [
    "organization_tournament_entries_awaiting_approval",
    "organization_tournament_entries_awaiting_payment",
    "organization_tournament_awaiting_conclusion",
  ],
  player: [
    "player_tournament_entries_awaiting_payment",
    "player_tournament_entry_awaiting_approval",
    "player_tournament_partner_invite_received",
    "player_tournament_partner_invite_sent",
  ],
} as const satisfies Record<
  (typeof PENDING_SCOPE_OPTIONS)[number],
  readonly string[]
>;

export const PENDING_KIND_OPTIONS = [
  ...PENDING_KINDS_BY_SCOPE.organization,
  ...PENDING_KINDS_BY_SCOPE.player,
] as const;

export const PENDING_DOMAIN_OPTIONS = [
  "payment",
  "player",
  "tournament",
] as const;

export const PENDING_SEVERITY_OPTIONS = ["danger", "info", "warning"] as const;

export const PENDING_SOURCE_TYPE_OPTIONS = [
  "organization",
  "tournament",
  "tournament_entry",
] as const;

/**
 * TIPO da acao do CTA — enum FECHADO que cresce por ADICAO. O rotulo diz o que a
 * tela MOSTRA; este campo diz o que o cliente EXECUTA, sem adivinhar por kind.
 * Pares de ida e volta sao tipos SEPARADOS, nunca booleano em `params`; so
 * `open_route` navega — acao de mutacao nunca depende de `route`.
 */
export const PENDING_ACTION_TYPE_OPTIONS = [
  "open_route",
  "pay_tournament_entry",
  "accept_partner_invite",
  "decline_partner_invite",
  "approve_tournament_entry",
  "reject_tournament_entry",
  "conclude_tournament",
] as const;

export type PendingDomain = (typeof PENDING_DOMAIN_OPTIONS)[number];
export type PendingActionType = (typeof PENDING_ACTION_TYPE_OPTIONS)[number];
export type PendingKind = (typeof PENDING_KIND_OPTIONS)[number];
export type PendingScope = (typeof PENDING_SCOPE_OPTIONS)[number];
export type PendingSeverity = (typeof PENDING_SEVERITY_OPTIONS)[number];
export type PendingSourceType = (typeof PENDING_SOURCE_TYPE_OPTIONS)[number];

export const PENDING_KIND_SCOPES = Object.fromEntries(
  PENDING_SCOPE_OPTIONS.flatMap((scope) =>
    PENDING_KINDS_BY_SCOPE[scope].map((kind) => [kind, scope])
  )
) as Record<PendingKind, PendingScope>;

/**
 * Kinds SEM dispensa: o item e ESTADO (sai quando o problema acaba), nao
 * lembrete. A home nunca esconde e `pendings.dismiss` recusa.
 */
export const PENDING_NON_DISMISSIBLE_KINDS = {
  organization_tournament_awaiting_conclusion: true,
} as const satisfies Partial<Record<PendingKind, true>>;

export const pendingDescriptionPartSchema = z.object({
  isHighlighted: z.boolean().optional(),
  text: z.string().min(1),
});

export const pendingDescriptionLineSchema = z.object({
  parts: z.array(pendingDescriptionPartSchema).min(1),
});

/**
 * UMA frase, ou LINHAS de partes: alerta que agrega mais de um tipo de pendencia
 * usa uma LINHA por tipo, nunca um separador no meio da frase.
 */
export const pendingDescriptionSchema = z.union([
  z.string().min(1),
  z.array(pendingDescriptionLineSchema).min(1),
]);

export const pendingSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(PENDING_SOURCE_TYPE_OPTIONS),
});

export const pendingActionSchema = z.object({
  params: z.record(z.string(), z.string()).nullable(),
  type: z.enum(PENDING_ACTION_TYPE_OPTIONS),
});

export const pendingItemSchema = z.object({
  action: pendingActionSchema.nullable(),
  actionLabel: z.string().min(1).nullable(),
  count: z.number().int().positive().nullable(),
  deadlineAt: z.number().int().nullable(),
  description: pendingDescriptionSchema,
  domain: z.enum(PENDING_DOMAIN_OPTIONS),
  id: z.string().min(1),
  kind: z.enum(PENDING_KIND_OPTIONS),
  moneyCents: z.number().int().nonnegative().nullable(),
  params: z.record(z.string(), z.string()).nullable(),
  route: z.string().min(1).nullable(),
  secondaryAction: pendingActionSchema.nullable(),
  secondaryActionLabel: z.string().min(1).nullable(),
  severity: z.enum(PENDING_SEVERITY_OPTIONS),
  source: pendingSourceSchema,
  title: z.string().min(1),
});

export const pendingsCountsSchema = z.object({
  byDomain: z.record(
    z.enum(PENDING_DOMAIN_OPTIONS),
    z.number().int().nonnegative()
  ),
  bySeverity: z.record(
    z.enum(PENDING_SEVERITY_OPTIONS),
    z.number().int().nonnegative()
  ),
  total: z.number().int().nonnegative(),
});

/**
 * Sinal de SATURACAO: a fonte bateu no cap da varredura, entao item/contagem
 * daquele kind pode estar SUBESTIMADO — nao confundir com `truncated`, que e o
 * corte da LISTA. Lista vazia = leitura completa.
 */
export const pendingSaturationSchema = z.object({
  kind: z.enum(PENDING_KIND_OPTIONS),
  limit: z.number().int().positive(),
});

/**
 * `counts` sao derivados do MESMO array devolvido (o badge nunca mente sobre a
 * lista); `truncated` avisa do cap de itens e `saturation` da leitura.
 */
export const pendingsListResultSchema = z.object({
  counts: pendingsCountsSchema,
  items: z.array(pendingItemSchema),
  saturation: z.array(pendingSaturationSchema),
  scope: z.enum(PENDING_SCOPE_OPTIONS),
  truncated: z.boolean(),
});

/**
 * A dispensa vale por superficie: `home` esconde enquanto o item nao piorar;
 * `house` (casa do torneio) mostra sempre — o gesto so existe na home.
 */
export const PENDING_SURFACE_OPTIONS = ["home", "house"] as const;

export type PendingSurface = (typeof PENDING_SURFACE_OPTIONS)[number];

export const listPendingsSchema = z.object({
  scope: z.enum(PENDING_SCOPE_OPTIONS),
  /** Sem ela vale a CASA (a que NUNCA esconde): quem esquece o parametro perde a dispensa, nunca uma pendencia. */
  surface: z.enum(PENDING_SURFACE_OPTIONS).optional(),
});

/** Dispensa de UM item na superficie. O ator dono vem da sessao, nunca daqui. */
export const dismissPendingItemSchema = z.object({
  itemId: z.string().min(1),
  surface: z.enum(PENDING_SURFACE_OPTIONS),
});

export type PendingDescription = z.infer<typeof pendingDescriptionSchema>;
export type PendingDescriptionLine = z.infer<
  typeof pendingDescriptionLineSchema
>;
export type PendingDescriptionPart = z.infer<
  typeof pendingDescriptionPartSchema
>;
export type PendingAction = z.infer<typeof pendingActionSchema>;
export type PendingItem = z.infer<typeof pendingItemSchema>;
export type PendingsCounts = z.infer<typeof pendingsCountsSchema>;
export type PendingsListResult = z.infer<typeof pendingsListResultSchema>;
export type PendingSaturation = z.infer<typeof pendingSaturationSchema>;
export type PendingSource = z.infer<typeof pendingSourceSchema>;
