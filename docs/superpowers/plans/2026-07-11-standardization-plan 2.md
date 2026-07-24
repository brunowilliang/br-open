# Plano de Padronização: Utils + Nomenclatura

**Data:** 2026-07-11
**Status:** Aguardando aprovação
**Premissa:** Nada em produção. Dev DB pode ser wiped/reseeded.

---

## Visão Geral

Duas frentes de padronização, **independentes entre si**, que podem ser
executadas em paralelo ou sequencialmente:

| Frente | Objetivo | Fases | Arquivos afetados (estimativa) |
|--------|----------|-------|-------------------------------|
| **Parte A — Utils** | Consolidar ~30 funções duplicadas em módulos compartilhados | A0–A7 | ~25 arquivos |
| **Parte B — Nomenclatura** | Padronizar papéis para `organizer` / `player` / `guest` | B1–B7 | ~50 arquivos |

**Total:** ~75 arquivos (alguns sobrepostos entre A e B).

---

## Princípios de Execução

1. **Cada fase é um commit independente** — pode parar e o app funciona.
2. **Criar antes de destruir** — novas funções são adicionadas, call sites
   migrados, só depois o código antigo é removido.
3. **Codegen após mudanças de contrato Convex** — sempre rodar
   `bun run codegen` depois de tocar `convex/domains/*/contract.ts` ou
   `tables.ts`, antes do typecheck.
4. **Verificação obrigatória por fase:**
   ```bash
   bun run fix          # auto-formata
   bun run check        # lint + typecheck (gate completo)
   bun test             # quando há lógica/contratos alterados
   ```
5. **Não commitar sem aprovação explícita** (regra do AGENTS.md).

---

# PARTE A — Consolidação de Utils

## Fase A0 — Criar infraestrutura de format (CREATE-ONLY)

**Risco:** Zero (apenas cria arquivos novos, nada é modificado).

### Criar

| Arquivo | Exporta | Origem (de onde vem a lógica) |
|---------|---------|------|
| `src/lib/format/currency.ts` | `formatCurrencyCents(cents, opts?)`, `formatTrendPercent(current, previous)` | Sintetiza as 3 variantes em 1 canônica |
| `src/lib/format/time.ts` | `formatMinuteToHHMM(minute)`, `formatMsAsMMSS(ms)` | `challenge-formatters.ts:30-35` (a mais limpa) |
| `src/lib/format/date.ts` | `formatShortDate`, `formatMediumDateUtc`, `formatDateTimeShort`, `formatDayLabel`, `formatMonthDay`, `formatDateToUtcKey`, `getMonthStartMs(now)` | Sintetiza 6+ instâncias de `Intl.DateTimeFormat` |
| `src/lib/format/relative-time.ts` | `formatRelativeTime(iso)`, `formatRelativeDay(timestamp, now)`, `DAY_MS`, `HOUR_MS`, `MINUTE_MS` | `organizer-dashboard.tsx:38-53` + `participant-overview-derived.ts:186-211` |
| `src/lib/format/pluralize.ts` | `formatCount(value, singular, plural)` | `league-preview-features.ts:18-20` |
| `src/lib/format/user.ts` | `getUserInitials(name, fallback)`, `getGreetingLabel(now)` | Mover de `presentation.ts:239-268` |
| `src/lib/numbers.ts` | `clampToNonNegativeInt(value)`, `clamp(value, min, max)` | `league-navigation-tabs.ts:78-80` + `image-crop.ts:94` |
| `src/lib/collections.ts` | `getSelectedOption<T>(options, value)` | `form/rules/shared.ts:129-138` (versão genérica) |
| `src/lib/router/normalize-param.ts` | `normalizeRouteParam(value)` | `_layout.tsx:57-59` |
| `src/lib/payments/status.ts` | `PAYMENT_STATUS_META`, `formatPaymentStatus(status)`, `getPaymentStatusColor(status)` | `payments.tsx:29-57` + `organizer-dashboard.tsx:55-64` |
| `src/lib/leagues/rule-format.ts` | `formatResponseDeadlineHours`, `formatWinBehavior`, `formatLossBehavior`, `formatNewPlayerPlacement`, `formatWalkoverBehavior`, `formatScoringMode`, `formatTieBreak`, `formatFinalSet`, `formatInactivity` | `league-details-derived.ts:290-392` |

### Decisão de design para `formatCurrencyCents`

A versão canônica deve:
- Aceitar cents (inteiro), retornar string BRL formatada.
- Usar `Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" })`.
- Strip `\u00a0` → `" "` (bug de layout RN).
- Aceitar `opts.maximumFractionDigits` (default `2`, o caller escolhe `0`).
- Instanciar o formatter uma única vez (singleton).

```ts
// Design target
const formatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function formatCurrencyCents(
  cents: number,
  opts?: { maximumFractionDigits?: number },
): string {
  const value = formatter.format(cents / 100).replace(/\u00a0/g, " ");
  return opts?.maximumFractionDigits !== undefined
    ? value
    : value; // maximumFractionDigits handled by a second formatter if needed
}
```

### Verificação
```bash
bun run check   # typecheck deve passar (só novos arquivos)
```

---

## Fase A1 — Migrar formatCurrency (3 call sites)

**Risco:** Baixo. Mudança mecânica.

| Arquivo | Linha | Ação |
|---------|-------|------|
| `src/components/pages/home/organizer-dashboard.tsx` | 19-25 | Remover `formatCurrency` local → importar de `@/lib/format/currency` |
| `src/app/(private)/settings/player/payments.tsx` | 59-64 | Remover `formatCurrency` local → importar de `@/lib/format/currency` |
| `src/lib/leagues/presentation.ts` | 22-29 | Remover `formatCurrency` privada → importar de `@/lib/format/currency` |

Também migrar `formatTrend` (linhas 27-36 de `organizer-dashboard.tsx`) → `formatTrendPercent` de `@/lib/format/currency`.

### Verificação
```bash
bun run check && bun test src/lib/leagues/presentation.test.ts
```

---

## Fase A2 — Migrar formatMinute (5 call sites)

**Risco:** Zero. Todas as 5 implementações são idênticas.

| Arquivo | Linha | Ação |
|---------|-------|------|
| `src/lib/leagues/challenge-formatters.ts` | 30-35 | Remover `formatMinute` → re-exportar de `@/lib/format/time` (mantém compat) |
| `src/components/pages/leagues/schedule-card.tsx` | 16-20 | Remover local → importar de `@/lib/format/time` |
| `src/lib/leagues/challenge-schedule.ts` | 33-38 | Remover local → importar de `@/lib/format/time` |
| `src/lib/leagues/schedule-view.ts` | 143-147 | Remover `formatScheduleMinute` → importar `formatMinuteToHHMM` |
| `src/app/(private)/settings/leagues/[mode]/courts.tsx` | 93-98 | Remover `formatMinutes` → importar de `@/lib/format/time` |

**Nota:** `challenge-formatters.ts` re-exporta para não quebrar importers
existentes. Na limpeza (A7), remover o re-export e atualizar importers.

### Verificação
```bash
bun run check && bun test src/lib/leagues/
```

---

## Fase A3 — Migrar date formatters (6+ call sites)

**Risco:** Baixo, mas requer atenção às opções de cada formatter.

| Arquivo | Linha(s) | Constante atual | Nova função |
|---------|----------|-----------------|-------------|
| `src/lib/leagues/challenge-formatters.ts` | 5 | `CHALLENGE_DATE_FORMATTER` | `formatMediumDateUtc` |
| `src/lib/leagues/schedule-view.ts` | 43 | `DAY_LABEL_FORMATTER` | `formatDayLabel` |
| `src/app/(private)/settings/player/payments.tsx` | 23 | `PAYMENT_DATE_FORMATTER` | `formatShortDate` |
| `src/app/(private)/settings/notifications.tsx` | 55 | `NOTIFICATION_DATE_FORMATTER` | `formatDateTimeShort` |
| `src/components/pages/leagues/challenge-proposal-dialog.tsx` | 61, 90 | 2× `Intl.DateTimeFormat` inline | 1× `formatMediumDateUtc` |
| `src/lib/leagues/participant-overview-derived.ts` | 207 | `toLocaleDateString` inline | `formatMonthDay` |
| `src/lib/leagues/participant-overview-derived.ts` | 126-128, 276-278 | `monthStart` inline (2×) | `getMonthStartMs(now)` |
| `src/lib/leagues/admin-overview-derived.ts` | 153-158 | `getMonthStartMs` local | Importar de `@/lib/format/date` |

### Verificação
```bash
bun run check && bun test src/lib/leagues/
```

---

## Fase A4 — Migrar relative-time formatters (2 implementações)

**Risco:** Baixo.

| Arquivo | Linha(s) | Ação |
|---------|----------|------|
| `src/components/pages/home/organizer-dashboard.tsx` | 38-53 | Remover `formatRelativeTime` local → importar de `@/lib/format/relative-time` |
| `src/lib/leagues/participant-overview-derived.ts` | 49, 186-211 | Remover `DAY_MS` + `formatRelativeWhen` → importar `formatRelativeDay` |

### Verificação
```bash
bun run check
```

---

## Fase A5 — Migrar misc helpers

**Risco:** Baixo.

| Helper | Arquivos afetados | Ação |
|--------|-------------------|------|
| `clampToNonNegativeInt` | `league-navigation-tabs.ts:78-80`, `league-details-derived.ts:112-114` | Remover locais → importar de `@/lib/numbers` |
| `normalizeRouteParam` | `_layout.tsx:57-59`, `league-form-store.ts:35-37` | Remover locais → importar de `@/lib/router/normalize-param` |
| `getSelectedOption` | `challenge-proposal-dialog.tsx:67-76`, `courts.tsx:100-106` | Remover locais → importar de `@/lib/collections` (a versão genérica de `shared.ts`) |
| `formatCount` (pluralize) | `presentation.ts:65-67`, `admin-overview-derived.ts:130` | Substituir ternários inline → `formatCount` |
| `clamp` | `image-crop.ts:94` | Mover para `@/lib/numbers`, importar de lá |

### Verificação
```bash
bun run check && bun test
```

---

## Fase A6 — Migrar domain-specific formatters

**Risco:** Médio. Envolve reorganizar lógica de domínio.

### 6a. Payment status meta

| Arquivo | Ação |
|---------|------|
| `src/app/(private)/settings/player/payments.tsx` | Remover `formatPaymentStatus` + `getPaymentStatusColor` locais → importar de `@/lib/payments/status` |
| `src/components/pages/home/organizer-dashboard.tsx` | Remover `statusConfig` local → importar `PAYMENT_STATUS_META` de `@/lib/payments/status` |

### 6b. Rule formatters

| Arquivo | Ação |
|---------|------|
| `src/lib/leagues/rule-format.ts` | **NOVO** — casa todos os `format*Behavior` / `format*Mode` |
| `src/lib/leagues/league-details-derived.ts` | Remover `formatResponseDeadlineHours`, `formatWinBehavior`, `formatLossBehavior`, `formatNewPlayerPlacement`, `formatWalkoverBehavior`, `formatScoringMode`, `formatTieBreak`, `formatFinalSet`, `formatInactivity` (linhas 290-392) → importar de `@/lib/leagues/rule-format` |
| `src/lib/leagues/league-preview-features.ts` | Remover duplicatas `formatResponseDeadlineHours`, `formatWinBehavior`, `formatLossBehavior`, `formatRankingEntry` (linhas 22-65) → importar de `@/lib/leagues/rule-format` |

**Decisão de design:** As variantes "frase completa" vs "fragmento" do
`formatWinBehavior` etc. — usar option `style: "full" | "fragment"`:

```ts
export function formatWinBehavior(
  value: string,
  opts?: { style?: "full" | "fragment" },
): string { ... }
```

### Verificação
```bash
bun run check && bun test src/lib/leagues/
```

---

## Fase A7 — Migrar greeting/initials + limpeza

**Risco:** Baixo.

| Item | Arquivo | Ação |
|------|---------|------|
| `getGreetingLabel` | `presentation.ts:239-251` → `@/lib/format/user.ts` | Mover export |
| `getUserInitials` | `presentation.ts:253-268` → `@/lib/format/user.ts` | Mover export |
| `getHomeGreeting` | `(tabs)/index.tsx:18-30` | Remover → usar `getGreetingLabel()` + append comma no call site |
| Re-export de `formatMinute` | `challenge-formatters.ts` | Remover o re-export da Fase A2, atualizar importers diretos |

### Atualizar importers de `presentation.ts`

Após mover `getGreetingLabel` e `getUserInitials` para `@/lib/format/user`:
- `src/app/(private)/(tabs)/index.tsx`
- `src/components/pages/home/organizer-dashboard.tsx`
- Qualquer outro arquivo que importe essas funções de `@/lib/leagues/presentation`

### Verificação final da Parte A
```bash
bun run fix && bun run check && bun test
```

---

# PARTE B — Padronização de Nomenclatura

## Vocabulário Canônico

| Conceito | EN (código) | PT (UI) | Substitui |
|----------|-------------|---------|-----------|
| Quem organiza ligas | `organizer` | "organizador" | admin, owner (league role), gestor, manager, administrador |
| Quem joga ligas | `player` | "jogador" | participant, member (contexto de liga) |
| Quem vê mas não é membro | `guest` | "visitante" | visitor |

**Não mexer (Better Auth org RBAC — conceito separado):**
- `member.role: "owner" | "admin" | "member"` — roles de acesso da organização
- `MANAGER_ROLES`, `requireActiveManager()`, `isActiveActorManager()` — gates internos
- `auth-i18n.ts` strings sobre "proprietário" / "administrador" da organização

---

## Fase B1 — Backend: Enums de status + notification events

**Risco:** Médio. Mudança de valores de enum que fluem backend → frontend.
**Dependência:** Após esta fase, rodar codegen ANTES do typecheck.

### B1a. Renomear status enums

| Arquivo | Mudança |
|---------|---------|
| `convex/domains/league/contract.ts:131,136,138` | `"pending_admin_challenge_validation"` → `"pending_organizer_challenge_validation"` |
| `convex/domains/league/contract.ts:131,136,138` | `"pending_admin_result_validation"` → `"pending_organizer_result_validation"` |
| `convex/domains/league/contract.ts:138` | `"pending_admin_decision"` → `"pending_organizer_decision"` |
| `convex/domains/league/challenge-status.ts` | Todos os sets `ADMIN_ATTENTION_*`, `ADMIN_ONGOING_*` — atualizar valores literais |
| `convex/domains/league/challenge-rules.ts:11,16,18,329,337,342` | Status retornados por `resolveManualStatus` |
| `convex/functions/league/challenges.ts` | ~10 sites com `pending_admin_*` |
| `convex/functions/seed.ts:101,110-111,286,341,1006` | Seed fixtures |
| `convex/domains/seed/plan.ts:19-20,128,137` | Seed plan |
| `convex/domains/league/tests/challenge-rules.test.ts` | Test fixtures |
| `convex/domains/seed/tests/plan.test.ts:69-70` | Test fixtures |

**Constantes de set:** renomear para alinhar:
- `ADMIN_ATTENTION_CHALLENGE_STATUSES` → `ORGANIZER_ATTENTION_CHALLENGE_STATUSES`
- `ADMIN_ONGOING_CHALLENGE_STATUSES` → `ORGANIZER_ONGOING_CHALLENGE_STATUSES`

### B1b. Renomear notification events

| Arquivo | Mudança |
|---------|---------|
| `convex/shared/notifications/protocol.ts:25-26` | `"league.challenge.admin_approved"` → `"league.challenge.organizer_approved"` |
| `convex/shared/notifications/protocol.ts:25-26` | `"league.challenge.admin_rejected"` → `"league.challenge.organizer_rejected"` |
| `convex/domains/notification/definitions.ts:244,251` | Templates referenciando os eventos |
| `convex/functions/league/challenges.ts:1273,1298,1831` | Emitters dos eventos |

### B1c. Renomear notification recipient role

| Arquivo | Mudança |
|---------|---------|
| `convex/domains/notification/definitions.ts:12` | `NotificationRecipientRole = "manager" \| "player"` → `"organizer" \| "player"` |
| `convex/functions/notification/orchestrator.ts:231-232` | `recipientActor.kind === "organization" ? "manager"` → `"organizer"` |
| `convex/domains/notification/tests/content.test.ts:17,95` | `"manager"` → `"organizer"` |

### B1d. Codegen
```bash
bun run codegen
```

### B1e. Frontend follow-up (status + notification values)

| Arquivo | Mudança |
|---------|---------|
| `src/lib/leagues/admin-overview-derived.ts:36-38,43-45` | Status narrowing + map (`pending_admin_*` → `pending_organizer_*`) |
| `src/lib/leagues/challenge-formatters.ts:57,87,99` | `case` branches em `formatStatus` |
| `src/lib/leagues/challenge-route-view.ts:43-45,294,300,309` | Status checks + comments |
| `src/lib/leagues/admin-overview-derived.test.ts:46-49,167` | Test fixtures |
| `src/lib/leagues/challenge-status-parity.test.ts:71,76,78,93,95,113,115,127` | Tests |
| `src/lib/leagues/challenge-tab-counts.test.ts:55` | Tests |
| `src/lib/leagues/challenge-route-view.test.ts:42,173,182` | Tests |
| `src/lib/leagues/challenge-tab-counts.ts:3-4,8` | Re-exports `ADMIN_*` → `ORGANIZER_*` |

### Verificação
```bash
bun run fix && bun run codegen && bun run check && bun test
```

---

## Fase B2 — Backend: Tabela + colunas + CRPC mutations

**Risco:** Alto. Renomeia tabela Convex + mutations CRPC (API surface).
**Dependência:** B1 concluído. Requer wipe do dev DB.

### B2a. Renomear tabela + coluna

| Arquivo | Mudança |
|---------|---------|
| `convex/domains/league/tables.ts:139-140` | `convexTable("leagueChallengeAdminAction", ...)` → `"leagueChallengeOrganizerAction"` |
| `convex/domains/league/tables.ts:154-156` | Indexes da tabela renomeada |
| `convex/domains/league/tables.ts:206` | `adminReviewedByUserId` → `organizerReviewedByUserId` |
| `convex/domains/league/tables.ts:230-231` | Index `adminReviewedByUserId` → `organizerReviewedByUserId` |
| `convex/domains/league/relations.ts:81,83,116-117,121-127` | Relations: `adminActions`, `adminReviewedBy`, `leagueChallengeAdminAction` → `organizerActions`, `organizerReviewedBy`, `leagueChallengeOrganizerAction` |
| `convex/domains/league/contract.ts:799` | `adminReviewedByUserId` → `organizerReviewedByUserId` (zod schema) |
| `convex/domains/auth/tests/delete-actions.test.ts:61,66` | Referências à tabela + coluna |

### B2b. Renomear CRPC mutations

| Arquivo | Mutation atual | Novo nome |
|---------|---------------|-----------|
| `convex/functions/league/challenges.ts:1612` | `adminManage` | `organizerManage` |
| `convex/functions/league/challenges.ts:1472` | `adminSubmitResult` | `organizerSubmitResult` |
| `convex/functions/league/challenges.ts:1920` | `adminRequestResultReminder` | `organizerRequestResultReminder` |
| `convex/functions/league/_challenges/ranking.ts:101` | `recordAdminChallengeAction` | `recordOrganizerChallengeAction` |

### B2c. Atualizar callers backend

| Arquivo | Mudança |
|---------|---------|
| `convex/functions/league/challenges.ts:50` | Import `recordAdminChallengeAction` → `recordOrganizerChallengeAction` |
| `convex/functions/league/challenges.ts:1664,1734,1817,1885` | Calls para `recordAdminChallengeAction` |
| `convex/functions/league/_challenges/serializers.ts:153` | `adminReviewedByUserId` → `organizerReviewedByUserId` |
| `convex/functions/league/challenges.ts:1366,1409,1441,1555,1714` | Writes `adminReviewedByUserId` |
| `convex/functions/seed.ts:369,390,392,395-396,468,510` | Referências a `leagueChallengeAdminAction` |

### B2d. Codegen + wipe
```bash
bun run codegen
# Wipe do dev DB (não há produção):
# Opção A: convex dashboard → clear tables
# Opção B: npx convex dev --once (recria schema)
# Opção C: bun convex:dev + reseed
```

### B2e. Frontend follow-up (CRPC mutations + tipos)

| Arquivo | Mudança |
|---------|---------|
| `src/lib/leagues/use-challenge-mutations.ts:7-8,311-356,393-411` | `adminManageChallenge` → `organizerManageChallenge`, `adminSubmitChallengeResult` → `organizerSubmitChallengeResult`, `adminRequestResultReminder` → `organizerRequestResultReminder`; `crpc.league.challenges.adminManage` → `.organizerManage` etc. |
| `src/app/(private)/leagues/[leagueId]/challenges.tsx:87-89,104,108,160,192,229-230,269,576-596` | Todos os `adminManage*`, `adminSubmit*`, `adminRequest*`, `adminActionTarget`, `onAdminManage` |
| `src/lib/errors/toast-message.test.ts:10` | `"league/challenges:adminManage"` → `"league/challenges:organizerManage"` |

### Verificação
```bash
bun run codegen && bun run fix && bun run check && bun test
```

---

## Fase B3 — Frontend: LeagueDetailsRole type

**Risco:** Médio. Mudança de union type que afeta derive, store, e UI routing.
**Dependência:** Independente de B1-B2 (é puramente frontend).

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/lib/leagues/league-details-derived.ts:8` | `"visitor" \| "participant" \| "owner"` → `"guest" \| "player" \| "organizer"` |
| `src/lib/leagues/league-details-derived.ts:76` | `return "owner"` → `return "organizer"` |
| `src/lib/leagues/league-details-derived.ts:80` | `return "participant"` → `return "player"` |
| `src/lib/leagues/league-details-derived.ts:83` | `return "visitor"` → `return "guest"` |
| `src/lib/leagues/league-details-derived.ts:90,94` | `=== "participant"` → `=== "player"`, `=== "owner"` → `=== "organizer"` |
| `src/lib/leagues/league-details-derived.ts:151,175` | `=== "visitor"` → `=== "guest"` |
| `src/lib/leagues/league-details-derived.ts:265` | `=== "participant"` → `=== "player"` |
| `src/lib/leagues/league-details-store.ts:65` | Default role `"visitor"` → `"guest"` |
| `src/lib/leagues/league-details-store.ts:87` | `=== "owner"` → `=== "organizer"` |
| `src/lib/leagues/league-details-store.ts:224,250` | `"owner"` → `"organizer"`, `"visitor"` → `"guest"` |
| `src/lib/leagues/league-details-store.ts:226,252` | `"participant"` → `"player"` |
| `src/lib/leagues/league-details-store.ts:275` | `"visitor"` → `"guest"` |
| `src/app/(private)/leagues/[leagueId]/index.tsx:243-253` | `role === "owner"` → `=== "organizer"`, `=== "participant"` → `=== "player"`, `=== "visitor"` → `=== "guest"` |
| `src/lib/convex/actor-scoped-cache.test.ts:23,35` | Role values |

### Atualizar `canManageLeague` derive

```ts
// ANTES:
canManageLeague: () => bucket$.viewer.role.get() === "owner"

// DEPOIS:
canManageLeague: () => bucket$.viewer.role.get() === "organizer"
```

### `isManagerOwner` field

O campo `isManagerOwner` vem do backend (`convex/domains/league/contract.ts:855`)
e flui para o frontend. É um boolean que significa "o viewer é manager/owner
da org que possui esta liga".

**Decisão:** Renomear para `isLeagueOrganizer` — é mais claro e alinha com o
vocabulário canônico.

| Arquivo | Mudança |
|---------|---------|
| `convex/domains/league/contract.ts:855` | `isManagerOwner` → `isLeagueOrganizer` |
| `convex/functions/league/discovery.ts` (7 sites) | Field name |
| `convex/functions/league/challenges.ts` (14 sites) | Field name |
| `convex/functions/league/_challenges/record_guards.ts` (6 sites) | Field name |
| `src/lib/leagues/league-details-derived.ts:72,75` | Field name |
| `src/lib/leagues/league-details-store.ts:112,202` | Field name |
| `src/lib/leagues/presentation.ts:206,232` | Param name |
| Todos os testes que usam `isManagerOwner` | Field name |

### Verificação
```bash
bun run codegen && bun run fix && bun run check && bun test
```

---

## Fase B4 — Frontend: Renomear arquivos + componentes

**Risco:** Baixo. Mecânico, mas muitas edições de import path.
**Dependência:** B3 concluído (para que os componentes já usem os novos nomes de role).

### Renomeações de arquivo

| Arquivo atual | Novo nome |
|---------------|-----------|
| `src/lib/leagues/admin-overview-derived.ts` | `organizer-overview-derived.ts` |
| `src/lib/leagues/admin-overview-derived.test.ts` | `organizer-overview-derived.test.ts` |
| `src/lib/leagues/participant-overview-derived.ts` | `player-overview-derived.ts` |
| `src/components/pages/leagues/admin-overview.tsx` | `organizer-overview.tsx` |
| `src/components/pages/leagues/participant-overview.tsx` | `player-overview.tsx` |
| `src/components/pages/leagues/visitor-overview.tsx` | `guest-overview.tsx` |
| `src/components/pages/leagues/challenge-admin-action-dialog.tsx` | `challenge-organizer-action-dialog.tsx` |

### Renomeações de componente/identifier

| Identifier atual | Novo nome | Arquivos |
|-----------------|-----------|----------|
| `AdminOverview` | `OrganizerOverview` | `organizer-overview.tsx`, `index.tsx` |
| `ParticipantOverview` | `PlayerOverview` | `player-overview.tsx`, `index.tsx` |
| `VisitorOverview` | `GuestOverview` | `guest-overview.tsx`, `index.tsx` |
| `ChallengeAdminActionDialog` | `ChallengeOrganizerActionDialog` | `challenge-organizer-action-dialog.tsx`, `challenges.tsx` |
| `AdminActionTarget` | `OrganizerActionTarget` | `challenges.tsx` |
| `AdminPendingActionKind` | `OrganizerPendingActionKind` | `organizer-overview-derived.ts` |
| `AdminPendingAction` | `OrganizerPendingAction` | `organizer-overview-derived.ts` |
| `AdminJoinRequestsAlert` | `OrganizerJoinRequestsAlert` | `organizer-overview-derived.ts` |
| `AdminValidationsAlert` | `OrganizerValidationsAlert` | `organizer-overview-derived.ts` |
| `AdminOccupationCard` | `OrganizerOccupationCard` | `organizer-overview-derived.ts` |
| `AdminMonthlyMatchesCard` | `OrganizerMonthlyMatchesCard` | `organizer-overview-derived.ts` |
| `AdminOngoingChallengesCard` | `OrganizerOngoingChallengesCard` | `organizer-overview-derived.ts` |
| `AdminActivityRateCard` | `OrganizerActivityRateCard` | `organizer-overview-derived.ts` |
| `buildAdmin*` (6 funções) | `buildOrganizer*` | `organizer-overview-derived.ts`, `organizer-overview.tsx` |
| `summarizeAdminPendingActions` | `summarizeOrganizerPendingActions` | `organizer-overview-derived.ts` |
| `buildParticipant*` (6 funções) | `buildPlayer*` | `player-overview-derived.ts`, `player-overview.tsx` |
| `ChallengeAdminActionItem` | `ChallengeOrganizerActionItem` | `challenge-route-view.ts` |
| `ChallengeAdminMenuActionId` | `ChallengeOrganizerMenuActionId` | `challenge-route-view.ts` |
| `buildAdminVisibleChallenges` | `buildOrganizerVisibleChallenges` | `challenge-route-view.ts` |
| `buildChallengeAdminMenuActionIds` | `buildChallengeOrganizerMenuActionIds` | `challenge-route-view.ts` |
| `pushAdminMenuActions` | `pushOrganizerMenuActions` | `challenge-menu-actions.ts` |
| `getAdminManageChallengeSuccessToast` | `getOrganizerManageChallengeSuccessToast` | `challenge-feedback.ts` |
| `getAdminManageChallengeErrorToast` | `getOrganizerManageChallengeErrorToast` | `challenge-feedback.ts` |
| `getAdminActionCopy` | `getOrganizerActionCopy` | `challenge-formatters.ts` |
| `onAdminManage` (callback) | `onOrganizerManage` | `challenge-menu-actions.ts`, `challenges.tsx` |
| `"admin_cancel"` | `"organizer_cancel"` | `challenge-route-view.ts`, `challenge-menu-actions.ts` |
| `"admin_invalidate"` | `"organizer_invalidate"` | `challenge-route-view.ts`, `challenge-menu-actions.ts` |
| `"admin-submit-result"` | `"organizer-submit-result"` | `challenge-menu-actions.ts` (action ID runtime) |
| `buildParticipantVisibleChallenges` | `buildPlayerVisibleChallenges` | `challenge-route-view.ts` |
| `isParticipantAttentionChallenge` | `isPlayerAttentionChallenge` | `challenge-route-view.ts` |
| `isViewerParticipant` | `isViewerPlayer` | `challenge-tab-counts.ts` |
| `isParticipantAttention` | `isPlayerAttention` | `challenge-tab-counts.ts` |

### Atualizar imports

Todos os arquivos que importam dos arquivos renomeados precisam de path update:

| Importador | Imports afetados |
|------------|-----------------|
| `src/app/(private)/leagues/[leagueId]/index.tsx` | `AdminOverview` → `OrganizerOverview`, `ParticipantOverview` → `PlayerOverview`, `VisitorOverview` → `GuestOverview` (3 imports) |
| `src/app/(private)/leagues/[leagueId]/challenges.tsx` | `ChallengeAdminActionDialog` → `ChallengeOrganizerActionDialog`, `getAdminActionCopy` → `getOrganizerActionCopy` |
| `src/components/pages/leagues/organizer-overview.tsx` | Import de `organizer-overview-derived` (path) |
| `src/components/pages/leagues/player-overview.tsx` | Import de `player-overview-derived` (path) |
| `src/lib/leagues/organizer-overview-derived.test.ts` | Import de `organizer-overview-derived` (path) |
| `src/lib/leagues/use-challenge-mutations.ts` | `getAdminManage*` → `getOrganizerManage*` |
| `src/lib/leagues/challenge-tab-counts.ts` | Re-export `ADMIN_*` → `ORGANIZER_*` |
| Todos os testes que referenciam os identifiers acima | Nomes |

### Verificação
```bash
bun run fix && bun run check && bun test
```

---

## Fase B5 — UI: Padronizar strings PT-BR

**Risco:** Zero (só texto, sem lógica).
**Dependência:** Nenhuma. Pode ser feito a qualquer momento.

### B5a. Strings "admin" → "organizador" (frontend)

| Arquivo | Linha | String atual | Nova string |
|---------|-------|-------------|-------------|
| `challenge-formatters.ts` | 60 | `"Validação do admin"` | `"Validação do organizador"` |
| `challenge-formatters.ts` | 102 | `"Decisão do admin"` | `"Decisão do organizador"` |
| `challenge-formatters.ts` | 197 | `"Ação administrativa"` | `"Ação do organizador"` |
| `challenge-feedback.ts` | 68,75 | `"A ação administrativa foi aplicada..."` | `"A ação do organizador foi aplicada..."` |
| `challenge-feedback.ts` | 105 | `"...cancelar o desafio pelo admin."` | `"...cancelar o desafio pelo organizador."` |
| `challenge-feedback.ts` | 113 | `"...invalidar o desafio pelo admin."` | `"...invalidar o desafio pelo organizador."` |
| `use-challenge-mutations.ts` | 345 | `"...salvar o placar pelo admin."` | `"...salvar o placar pelo organizador."` |
| `form/rules/shared.ts` | 59 | `"...o administrador da liga precisa aprovar..."` | `"...o organizador da liga precisa aprovar..."` |
| `form/rules/shared.ts` | 79 | `"...o administrador precisa aprovar..."` | `"...o organizador precisa aprovar..."` |
| `form/rules/sections/challenge-rules-section.tsx` | 252-254 | `"...aprovação do admin."` | `"...aprovação do organizador."` |
| `form/rules/sections/result-rules-section.tsx` | 253-254 | `"...aprovação do admin."` | `"...aprovação do organizador."` |

**Nota sobre "Em Admin" nos tooltips:** `shared.ts` linhas 59/79 usam "Em Admin"
como nome do validation mode. Renomear para "Em modo manual" (o valor do enum
é `"manual"`, faz mais sentido).

### B5b. Strings "admin" → "organizador" (backend)

| Arquivo | Linha | String atual | Nova string |
|---------|-------|-------------|-------------|
| `convex/functions/league/challenges.ts` | 730,854 | `"...só o admin pode cancelar."` | `"...só o organizador pode cancelar."` |
| `convex/functions/league/challenges.ts` | 1252 | `"Só o admin da liga pode validar..."` | `"Só o organizador da liga pode validar..."` |
| `convex/functions/league/challenges.ts` | 1330 | `"Só o admin da liga pode validar resultados."` | `"Só o organizador da liga pode validar resultados."` |
| `convex/functions/league/challenges.ts` | 1489 | `"Só o admin da liga pode editar o placar."` | `"Só o organizador da liga pode editar o placar."` |
| `convex/functions/league/challenges.ts` | 1516 | `"...receber placar pelo admin."` | `"...receber placar pelo organizador."` |
| `convex/functions/league/challenges.ts` | 1629 | `"Só o admin da liga pode executar essa ação."` | `"Só o organizador da liga pode executar essa ação."` |
| `convex/functions/league/challenges.ts` | 1642 | `"...cancelado pelo admin."` | `"...cancelado pelo organizador."` |
| `convex/functions/league/challenges.ts` | 1937 | `"Só o admin da liga pode enviar lembretes..."` | `"Só o organizador da liga pode enviar lembretes..."` |
| `convex/functions/seed.ts` | 1400 | `"...gestão como administrador."` | `"...gestão como organizador."` |

### B5c. Strings "gestor" → "organizador" (backend)

| Arquivo | Linha | String atual | Nova string |
|---------|-------|-------------|-------------|
| `convex/functions/viewer/context.ts` | 250 | `"Voce precisa ser gestor da organizacao..."` | `"Você precisa ser organizador da organização..."` |
| `convex/functions/league/membership.ts` | 83 | `"...encontrada para esse gestor."` | `"...encontrada para esse organizador."` |
| `convex/functions/league/management.ts` | 97 | `"...encontrada para esse gestor."` | `"...encontrada para esse organizador."` |
| `convex/functions/payment/charge.ts` | 845 | `"Voce precisa ser gestor..."` | `"Você precisa ser organizador..."` |
| `convex/functions/seed.ts` | 567 | `"Usuario gestor nao encontrado."` | `"Usuário organizador não encontrado."` |

**Aproveitar para corrigir typos:** "Voce" → "Você", "organizacao" → "organização",
"nao" → "não", "Usuario" → "Usuário".

### B5d. Strings "participante" → "jogador"

| Arquivo | Linha | String atual | Nova string |
|---------|-------|-------------|-------------|
| `(tabs)/ligas.tsx` | 105 | `"...receber participantes"` | `"...receber jogadores"` |
| `(tabs)/index.tsx` | 172 | `"...sua participação estiver ativa..."` | `"...suas ligas ativas..."` |
| `(tabs)/index.tsx` | 173 | `"Nenhuma participação ativa"` | `"Nenhuma liga ativa"` |
| `settings/leagues/index.tsx` | 115 | `"...receber participantes"` | `"...receber jogadores"` |
| `form/rules/sections/ranking-rules-section.tsx` | 52 | `"...novos participantes entram..."` | `"...novos jogadores entram..."` |
| `form/rules/shared.ts` | 84 | `"...um novo participante entra..."` | `"...um novo jogador entra..."` |
| `record_guards.ts` | 135 | `"O participante informado não está ativo..."` | `"O jogador informado não está ativo..."` |
| `membership.ts` | 365 | `"...disponível para participação."` | `"...disponível para jogadores."` |
| `membership-rules.ts` | 17 | `"...participantes ativos."` | `"...jogadores ativos."` |
| `contract.ts` | 698 | `"Informe pelo menos um participante."` | `"Informe pelo menos um jogador."` |

### B5e. Strings "Somente membros" → "Somente jogadores"

| Arquivo | Linha | String atual | Nova string |
|---------|-------|-------------|-------------|
| `settings/leagues/[mode]/settings.tsx` | 46 | `"Somente membros"` | `"Somente jogadores"` |

### B5f. Padronizar título de settings/player/profile.tsx

| Arquivo | Mudança |
|---------|---------|
| `src/app/(private)/settings/player/profile.tsx` | Título `"Perfil"` → `"Perfil do jogador"` (alinha com `organization/profile.tsx` que diz `"Perfil da organização"`) |

### Verificação
```bash
bun run fix && bun run check
```

---

## Fase B6 — Backend: Remover roles mortos

**Risco:** Zero. São roles definidos mas nunca lidos/escritos em runtime.

| Arquivo | Mudança |
|---------|---------|
| `convex/shared/auth-shared.ts:89,90,93` | Remover `club_manager`, `league_manager`, `tournament_manager` do mapa `roles` e suas definições `ac.newRole(...)` |

### Verificação
```bash
bun run codegen && bun run check
```

---

## Fase B7 — Limpeza de comentários

**Risco:** Zero.

Atualizar TODOS os comentários que referenciam "admin", "participante",
"visitor" no contexto de liga para usar os novos termos. Listagem completa
na análise (Categoria E do audit).

Arquivos principais:
- `src/lib/leagues/challenge-route-view.ts` (~20 comentários)
- `src/lib/leagues/challenge-tab-counts.ts` (~5 comentários)
- `src/lib/leagues/player-overview-derived.ts` (docblocks)
- `src/lib/leagues/organizer-overview-derived.test.ts` (test labels)
- `convex/functions/league/challenges.ts` (~5 comentários)
- `convex/domains/league/challenge-status.ts` (~3 comentários)
- Todos os arquivos de teste com `describe("...(admin)")` → `describe("...(organizer)")`

### Verificação
```bash
bun run fix && bun run check && bun test
```

---

# MATRIZ DE DEPENDÊNCIAS

```
PARTE A (Utils) — independente de PARTE B
├── A0 (criar arquivos) ← sem dependência
├── A1-A7 (migrar) ← depende de A0
│   ├── A1-A5 podem ser feitas em qualquer ordem
│   ├── A6 depende de A0
│   └── A7 depende de A1-A6

PARTE B (Nomenclatura) — independente de PARTE A
├── B1 (backend enums) ← sem dependência
│   └── B1e (frontend follow-up) ← depende de B1a-d + codegen
├── B2 (tabela + CRPC) ← depende de B1 (mesmo codegen cycle)
│   └── B2e (frontend follow-up) ← depende de B2a-d + codegen
├── B3 (LeagueDetailsRole) ← independente
│   └── isManagerOwner rename ← requer codegen (backend contract)
├── B4 (file renames) ← depende de B3 (novos nomes de role)
├── B5 (UI strings) ← independente
├── B6 (dead roles) ← independente
└── B7 (comments) ← depende de B1-B4
```

### Ordeção recomendada

```
Semana 1:  A0 → A1 → A2 → A3 → A4 → A5 → A6 → A7
Semana 2:  B1 → B2 → B3 → B4 → B5 → B6 → B7
```

Ou em paralelo (dois ramos):
```
Branch A:  A0 → A1-A7
Branch B:  B1-B2 (backend) → codegen → B3-B4 (frontend) → B5-B7 (cleanup)
```

---

# CHECKLIST FINAL POR FASE

| Fase | Criados | Modificados | Deletados | Codegen? | Wipe DB? | Testes? |
|------|---------|-------------|-----------|----------|----------|---------|
| A0 | 11 | 0 | 0 | N | N | N |
| A1 | 0 | 3 | 0 | N | N | Y |
| A2 | 0 | 5 | 0 | N | N | Y |
| A3 | 0 | 8 | 0 | N | N | Y |
| A4 | 0 | 2 | 0 | N | N | N |
| A5 | 0 | 7 | 0 | N | N | Y |
| A6 | 1 | 4 | 0 | N | N | Y |
| A7 | 0 | 5 | 0 | N | N | Y |
| B1 | 0 | ~15 | 0 | Y | Opcional | Y |
| B2 | 0 | ~12 | 0 | Y | **Y** | Y |
| B3 | 0 | ~10 | 0 | Y (isManagerOwner) | N | Y |
| B4 | 0 (rename) | ~15 | 0 | N | N | Y |
| B5 | 0 | ~20 | 0 | N | N | N |
| B6 | 0 | 1 | 3 (role defs) | Y | N | N |
| B7 | 0 | ~10 | 0 | N | N | N |

---

# ITENS QUE EXIGEM DECISÃO DO PRODUTO

1. **`participant` em contexto de challenge** — `challenger` / `challenged` são
   "participantes do desafio" (o tipo `LeagueChallengeParticipant`). Manter
   `participant` aqui? Faz sentido — é o lado do match, não o role.
   **Recomendação:** Manter. O `participant` como role morre; como tipo de
   challenge participant vive.

2. **`requireActiveManager()` / `MANAGER_ROLES`** — são gates internos de
   acesso que verificam org-level owner/admin. Renomear para
   `requireActiveOrganizer()` alinha com o vocabulário, mas muda a semântica
   (manager = gate de acesso; organizer = vocabulário de UI).
   **Recomendação:** Renomear para `requireActiveOrganizer()` — a semântica
   é a mesma (você precisa ser organizador = ter role de owner/admin na org).

3. **`canManage` / `canManageLeague`** — usados em ~30 sites no frontend.
   Renomear para `canOrganize` / `isOrganizer`?
   **Recomendação:** Manter `canManageLeague` (é claro e já está consolidado).
   Ou renomear para `isLeagueOrganizer` — sua escolha.

4. **Migration de dados para B2** — renomear a tabela
   `leagueChallengeAdminAction` muda o table ID no Convex.
   **Recomendação:** Wipe do dev DB + reseed (não há produção).

5. **`organizerType` no schema** — é o tipo de organização (clube/academia/...),
   não um papel. Manter o nome?
   **Recomendação:** Renomear para `organizationType` — é mais preciso.

6. **`leagueChallengeAdminAction` → `leagueChallengeOrganizerAction`** —
   renomear a tabela ou manter?
   **Recomendação:** Renomear (está em desenvolvimento, agora é a hora).
