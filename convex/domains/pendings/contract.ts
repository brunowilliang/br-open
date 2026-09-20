import { z } from "zod";

// ---------------------------------------------------------------------------
// Pendencias/alertas centralizados (IBX-0076 / PLN-0008) — contrato do item
// ---------------------------------------------------------------------------
//
// Fonte unica: o item nasce no SERVIDOR (kind + copy + destaque + ordem + rota)
// e a tela so renderiza. O shape bate 1:1 com o `WidgetAlert` do app
// (`src/components/ui/widget-alert.tsx`) e com a galeria visual aprovada pelo
// usuario — os 16 cartoes de `AlertsVariantsSection`
// (`src/app/(private)/settings/components/[component].tsx`), sem adaptador:
// `description` carrega LINHAS de PARTES (`{ text, isHighlighted? }`) porque
// quem decide o destaque E a quebra por linha e o servidor, nao a tela.
//
// Severidade: `danger|warning|info`. O componente do app nao tem `info` (o
// vocabulario dele e accent/danger/default/success/warning) — o cliente mapeia
// `info` para o `accent` do alerta, exatamente como os cartoes aprovados 5, 6,
// 7 e 11 (status real accent na galeria).
//
// `actionLabel`/`secondaryActionLabel` tem UMA palavra (regra aprovada; o
// cartao 5 e o unico com duas acoes: `Recusar` secundaria + `Aceitar`).
//
// Nome do kind: primeiro segmento = QUEM DEVE A ACAO (`player`|`organization`),
// depois dominio + pendencia. O enum e FECHADO e cresce por ADICAO: kind novo
// entra aqui + em `PENDING_KINDS_BY_SCOPE` + no registro (`registry.ts`) + na
// spec. Pendencia sem cartao aprovado pelo usuario NAO entra (RUL-0033/0039).

export const PENDING_SCOPE_OPTIONS = ["organization", "player"] as const;

export const PENDING_KINDS_BY_SCOPE = {
  organization: [
    "organization_league_challenges_awaiting_validation",
    "organization_league_join_requests",
    "organization_league_payment_account_missing",
    "organization_tournament_entries_awaiting_approval",
    "organization_tournament_entries_awaiting_payment",
  ],
  player: [
    "player_league_challenges_pending_actions",
    "player_league_inactivity_risk",
    "player_league_membership_payment_due",
    "player_league_membership_payment_due_soon",
    "player_league_membership_suspended",
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

/**
 * Dominio dono da REGRA que sustenta a pendencia (nao o da tela): `player` fica
 * reservado para pendencia do proprio perfil do jogador e nao tem kind na v1 —
 * o valor existe porque o shape aprovado o tem, e o registro cresce por adicao.
 */
export const PENDING_DOMAIN_OPTIONS = [
  "league",
  "payment",
  "player",
  "tournament",
] as const;

export const PENDING_SEVERITY_OPTIONS = ["danger", "info", "warning"] as const;

export const PENDING_SOURCE_TYPE_OPTIONS = [
  "league",
  "league_membership",
  "organization",
  "tournament",
  "tournament_entry",
] as const;

/**
 * TIPO da acao do CTA — enum FECHADO que cresce por ADICAO. O rótulo
 * (`actionLabel`/`secondaryActionLabel`, copy aprovada) diz o que a tela MOSTRA;
 * este campo diz o que o cliente EXECUTA, sem adivinhar por kind:
 *
 * - `open_route`: navegacao pura — o destino e o `route` + `params` do item.
 * - `pay_league_membership`: cria a cobranca da MESMA membership do item
 *   (`source`, tipo `league_membership`) e abre o checkout. Label `Pagar`.
 * - `pay_tournament_entry`: cria a cobranca da inscricao de
 *   `action.params.entryId` (a inscricao a pagar, que NAO e o `source` quando o
 *   item agrega o torneio) e abre o checkout. Label `Pagar`.
 * - `accept_partner_invite` / `decline_partner_invite`: respondem ao convite de
 *   `action.params.entryId`.
 *
 * Acao de MUTACAO nunca depende de `route` (o destino vem da resposta) — o
 * unico tipo que exige `route` nao nulo e `open_route`.
 */
export const PENDING_ACTION_TYPE_OPTIONS = [
  "open_route",
  "pay_league_membership",
  "pay_tournament_entry",
  "accept_partner_invite",
  "decline_partner_invite",
] as const;

export type PendingDomain = (typeof PENDING_DOMAIN_OPTIONS)[number];
export type PendingActionType = (typeof PENDING_ACTION_TYPE_OPTIONS)[number];
export type PendingKind = (typeof PENDING_KIND_OPTIONS)[number];
export type PendingScope = (typeof PENDING_SCOPE_OPTIONS)[number];
export type PendingSeverity = (typeof PENDING_SEVERITY_OPTIONS)[number];
export type PendingSourceType = (typeof PENDING_SOURCE_TYPE_OPTIONS)[number];

/** kind -> escopo dono. Unico lugar que decide em qual escopo um kind aparece. */
export const PENDING_KIND_SCOPES = Object.fromEntries(
  PENDING_SCOPE_OPTIONS.flatMap((scope) =>
    PENDING_KINDS_BY_SCOPE[scope].map((kind) => [kind, scope])
  )
) as Record<PendingKind, PendingScope>;

export const pendingDescriptionPartSchema = z.object({
  /** Trecho em negrito na tela (o peso e escolha do usuario na galeria). */
  isHighlighted: z.boolean().optional(),
  text: z.string().min(1),
});

export const pendingDescriptionLineSchema = z.object({
  parts: z.array(pendingDescriptionPartSchema).min(1),
});

/**
 * UMA frase (string — os casos em que a copy real do app ja e uma string) OU
 * LINHAS de partes. Alerta que agrega mais de um tipo de pendencia usa uma
 * LINHA por tipo, nunca um separador no meio da frase (r4 da galeria).
 */
export const pendingDescriptionSchema = z.union([
  z.string().min(1),
  z.array(pendingDescriptionLineSchema).min(1),
]);

export const pendingSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(PENDING_SOURCE_TYPE_OPTIONS),
});

/** Acao EXECUTAVEL de um CTA (o rótulo aprovado mora no `*ActionLabel`). */
export const pendingActionSchema = z.object({
  /** O que a acao precisa para rodar (ex.: a inscricao a pagar/responder). */
  params: z.record(z.string(), z.string()).nullable(),
  type: z.enum(PENDING_ACTION_TYPE_OPTIONS),
});

export const pendingItemSchema = z.object({
  /** Acao do CTA principal; `null` quando o item nao tem CTA. */
  action: pendingActionSchema.nullable(),
  /** CTA principal, sempre de UMA palavra; `null` = pendencia sem acao. */
  actionLabel: z.string().min(1).nullable(),
  /** Quantos casos o item agrega; `null` quando o item e de um caso so. */
  count: z.number().int().positive().nullable(),
  /** Prazo em epoch ms que decide a acao (vencimento, fim de inscricao). */
  deadlineAt: z.number().int().nullable(),
  description: pendingDescriptionSchema,
  domain: z.enum(PENDING_DOMAIN_OPTIONS),
  /** Deterministico: `<kind>:<sourceId>` — a tela usa como key/identidade. */
  id: z.string().min(1),
  kind: z.enum(PENDING_KIND_OPTIONS),
  /** Dinheiro envolvido em centavos; `null` quando a pendencia nao tem valor. */
  moneyCents: z.number().int().nonnegative().nullable(),
  /** Query params do destino (o `route` ja e o pathname do expo-router). */
  params: z.record(z.string(), z.string()).nullable(),
  /** Pathname do expo-router (molde dos CTAs vivos dos alertas), ou `null`. */
  route: z.string().min(1).nullable(),
  /** Acao do CTA secundario (rodape do alerta); `null` quando nao ha segundo. */
  secondaryAction: pendingActionSchema.nullable(),
  /** Acao de menor hierarquia (rodape do alerta), tambem de UMA palavra. */
  secondaryActionLabel: z.string().min(1).nullable(),
  severity: z.enum(PENDING_SEVERITY_OPTIONS),
  /** Entidade que originou a pendencia (para acao e rastreio). */
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
 * Sinal de SATURACAO da leitura: a fonte bateu no cap da varredura, entao o
 * item/contagem daquele kind pode estar SUBESTIMADO (o titulo nunca deve ser
 * lido como total quando o kind aparece aqui). Lista vazia = leitura completa.
 * Nao confundir com `truncated`, que e o corte da LISTA no cap de itens.
 */
export const pendingSaturationSchema = z.object({
  /** Kind cujo dado pode ter sobrado fora da leitura. */
  kind: z.enum(PENDING_KIND_OPTIONS),
  /** Cap da leitura que cortou. */
  limit: z.number().int().positive(),
});

/**
 * Resultado de `pendings.list`: os `counts` sao derivados do MESMO array
 * devolvido (o badge nunca mente SOBRE a lista), `truncated` avisa quando o cap
 * de itens cortou e `saturation` avisa quando uma LEITURA cortou (contagem
 * possivelmente menor que a real).
 */
export const pendingsListResultSchema = z.object({
  counts: pendingsCountsSchema,
  items: z.array(pendingItemSchema),
  saturation: z.array(pendingSaturationSchema),
  scope: z.enum(PENDING_SCOPE_OPTIONS),
  truncated: z.boolean(),
});

export const listPendingsSchema = z.object({
  scope: z.enum(PENDING_SCOPE_OPTIONS),
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
