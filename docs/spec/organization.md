# Organização, Auth e Ator Ativo — Estado atual

> Verificado em 14-08-2026 contra o código do repo (`src/`, `convex/`) — estado pós IBX-0002.

## Visão geral

O app usa um modelo de ator ativo backend-owned: `user` (Better Auth) é só identidade de autenticação; `playerProfile` é o ator jogador (1:1 com user, criado por trigger); `organization` (tabela Better Auth) é o ator organizador/negócio, dono de ligas e de pagamentos. O `userPreference` guarda o ator ativo (`activeActorKind` + `activeOrganizationId`) e toda rota resolve contexto via `viewer.context.get`, recebendo capacidades e dados já filtrados — o frontend não decide permissões. O perfil da organização é um domínio real (`convex/domains/organization/`) com onboarding dedicado, edição e metadados validados por zod. A padronização executada em 22-07-2026 (utils consolidados, vocabulário organizer/player/guest, status e tabela renomeados) está amplamente aplicada, com poucos remanescentes de nomenclatura "Admin".

## Implementado

### Active Actor Architecture
- **Status:** implementado
- **Data:** 15/06/2026
- **Referências:** `convex/domains/auth/actor-context.ts` (schemas/`buildViewerCapabilities`/`isActiveActorManager`/`MANAGER_ROLES`), `convex/domains/auth/tables.ts` (`userPreference` com `activeActorKind`/`activeOrganizationId`; `organization`, `member`, `team`, `invitation`, `session`), `convex/domains/auth/triggers.ts` (`ensureInitialPlayerProfile` + `ensureInitialUserPreference` com `DEFAULT_ACTOR_KIND = "player"`), `convex/functions/viewer/context.ts` (`get`, `setActiveActor`, `activateOrganization`, `requireActivePlayerProfile`, `requireActiveOrganization`, `requireActiveManager`), `convex/domains/player/tables.ts` (`playerProfile` 1:1 com user)
- **Decisões:** Better Auth `organization` é o ator de negócio (sem tabela paralela de organizador). `setActiveActor` valida membership (`assertOrganizationMember` → `FORBIDDEN`) antes de trocar o ator; se o ator pedido é inválido, `getViewerContext` faz fallback para o ator jogador. `buildViewerCapabilities` evoluiu: `canManageLeagues` depende do role da org (`owner`/`admin` = manager; `member` puro não gerencia) — o desenho inicial previa `canManageLeagues: isOrganization` simples.
- **Como funciona:** no signup/signin os triggers criam `playerProfile` e `userPreference` (ator default player). `viewer.context.get` retorna `{ activeActor, availableActors, capabilities }`; `activateOrganization` insere a org com slug gerado (`createOrganizationSlug`), insere `member` role `owner` e faz upsert do `userPreference` para o novo ator. Troca de ator invalida queries actor-scoped no cliente via `applyViewerContextToClientState` (`src/lib/convex/actor-scoped-cache.ts`, lista `ACTOR_SCOPED_QUERY_NAMES`).

### League ownership por organização e participação por playerProfile
- **Status:** implementado
- **Data:** 15/06/2026
- **Referências:** `convex/domains/league/tables.ts` (`league.organizationId` linha ~35, `leagueMembership.playerProfileId` linha ~60), `convex/domains/auth/relations.ts` (`organization.managedLeagues`), migrations `convex/functions/migrations/20260615_083000_backfill_active_actor_league_fields.ts` e `20260615_083100_backfill_league_membership_player_profiles.ts`
- **Decisões:** `managerUserId` e `userId` de participação foram removidos; ownership de liga é `organizationId` e participação é `playerProfileId`. Migrations de backfill datadas 15-06-2026 confirmam o refactor executado.

### Notificações actor-scoped
- **Status:** implementado
- **Data:** 15/06/2026
- **Referências:** `convex/domains/notification/tables.ts` (`recipientActorKind`, `recipientOrganizationId`, `recipientPlayerProfileId` + índices), `convex/domains/notification/feed-rules.ts` (`isNotificationForActor`), `convex/domains/notification/relations.ts`, migration `20260615_083200_backfill_notification_actor_recipients.ts`
- **Como funciona:** `recipientUserId` serve para push; a visibilidade do feed é decidida por `recipientActorKind` + id do ator. `notification.settings.status` e `notification.feed.list` filtram pelo ator ativo.

### Auth UI sem papéis (cleanup do refactor)
- **Status:** implementado
- **Data:** 05/05/2026
- **Referências:** `src/app/(public)/sign-in.tsx` e `src/app/(public)/sign-up.tsx` (email/password + Apple/Google, sem tabs de papel nem `mode` param); `src/lib/convex/auth-client.ts` (`createAuthClient` com `convexClient()`, `organizationClient`, `emailOTPClient`, `expoClient`)
- **Decisões:** `src/lib/auth/pending-preferred-mode.ts`, `src/components/auth/preferred-mode-bootstrap.tsx` e `convex/domains/auth/user-preference.ts` não existem mais (glob confirmou remoção). Nenhum resquício de `preferredMode`/`UserMode`/`canCreateResources` no código (grep vazio).

### Organization Profile
- **Status:** implementado (com divergências pontuais)
- **Data:** 28/06/2026
- **Referências:** `convex/domains/organization/contract.ts` (zod schemas + enums), `convex/domains/organization/identity.ts`, `convex/domains/organization/tests/contract.test.ts` e `identity.test.ts`, `convex/functions/organization/profile.ts` (`get`, `upsert`, `generateUploadUrl`), `convex/functions/viewer/context.ts` (`activateOrganization` rico), `src/app/(private)/settings/organization/onboarding.tsx`, `src/app/(private)/settings/organization/profile.tsx`, `src/app/(private)/settings/index.tsx`, `src/components/pages/organization/organization-form-fields.tsx`, `src/lib/uploads/viacep.ts`, `src/lib/format/cep.ts`
- **Decisões:** sem tabela nova — `organization` (Better Auth) É o perfil; campos extras vivem em `organization.metadata` validado por zod com fallback `{}` para orgs legadas. Regra física/endereço e rótulos de "outro" são enforced via `superRefine` nos dois lados (contrato zod e formulário). Slug continua gerado e não é input. `acceptedTerms` é exigido na ativação e rejeitado no upsert — com um twist: o cliente manda `userId: ""` e o servidor injeta `ctx.userId` antes de persistir (`acceptedTermsInputSchema`, comentado em `contract.ts`).
- **Como funciona:** toggle/sem org → `settings/index.tsx` navega para `/settings/organization/onboarding` (card "Seja um organizador"); com org, o switch chama `setActiveActor`. Onboarding submete `viewer.context.activateOrganization` (payload rico), aplica `applyViewerContextToClientState` e invalida queries actor-scoped, depois redireciona para `/settings/organization/profile`. A entrada "Perfil" do Settings é dinâmica por ator ativo ("Perfil da organização" vs "Perfil do jogador"). `profile.upsert` revalida a regra física/endereço no servidor, coleta e deleta logos substituídos (`collectReplacedLogoStorageIds` → `collectReplacedStorageIds` em `convex/shared/media-rules.ts`).

### Padronização de Utils (executada)
- **Status:** executado
- **Data:** 22/07/2026
- **Referências:** módulos consolidados e consumidos: `src/lib/format/currency.ts` (`formatCurrencyCents`, `formatTrendPercent`), `time.ts`, `date.ts`, `relative-time.ts`, `pluralize.ts` (`formatCount`), `user.ts` (`getGreetingLabel`, `getUserInitials`), `src/lib/numbers.ts`, `src/lib/collections.ts`, `src/lib/router/normalize-param.ts`, `src/lib/payments/status.ts`, `src/lib/leagues/rule-format.ts`
- **Decisões:** call sites migrados: `src/components/pages/home/organizer-dashboard.tsx` importa `formatCurrencyCents`/`formatTrendPercent`/`formatRelativeTime`/`PAYMENT_STATUS_META` dos módulos novos; `src/app/(private)/settings/player/payments.tsx` usa `formatCurrencyCents` + `formatShortDate` + `formatPaymentStatus`; `src/lib/leagues/presentation.ts` re-exporta `getGreetingLabel`/`getUserInitials` (por compat) e `src/app/(private)/(tabs)/index.tsx` importa `getGreetingLabel` de `@/lib/format/user`. Extras além do plano: `src/lib/format/currency-input.ts`, `cep.ts`, `email.ts`, `phone.ts` (evolução posterior).

### Padronização de Nomenclatura (executada)
- **Status:** executado
- **Data:** 22/07/2026
- **Status enums:** executado. `pending_organizer_challenge_validation|result_validation|decision` em `convex/domains/league/contract.ts:131-138`, `challenge-rules.ts`, `challenge-status.ts`; sets `ORGANIZER_ATTENTION_CHALLENGE_STATUSES`/`ORGANIZER_ONGOING_CHALLENGE_STATUSES` (challenge-status.ts:104-118); frontend migrado (`challenge-formatters.ts`, `challenge-route-view.ts`, `challenge-tab-counts.ts`, testes); migration `convex/functions/migrations/20260711_000002_rename_admin_status_values.ts`. Obs.: os sets `ADMIN_CANCELABLE/INVALIDATABLE/RESULT_REMINDER/SCORE_EDITABLE_CHALLENGE_STATUSES` mantiveram o prefixo `ADMIN_`.
- **Notification events:** executado. `convex/shared/notifications/protocol.ts:25-26` com `league.challenge.organizer_approved|organizer_rejected`; templates em `convex/domains/notification/definitions.ts:118,125`; emitters em `convex/functions/league/challenges.ts:1273,1298,1831`.
- **Recipient role:** executado. `convex/domains/notification/definitions.ts:12` = `"organizer" | "player"`; `tests/content.test.ts` usa `recipientRole: "organizer"`.
- **Tabela + coluna + CRPC mutations:** executado. `leagueChallengeOrganizerAction` e `organizerReviewedByUserId` em `convex/domains/league/tables.ts:143,210` (+ relations e índices); migration `20260711_000001_rename_admin_reviewed_field.ts` (foi usada migration, não wipe/reseed). Mutations renomeadas: `organizerManage`, `organizerSubmitResult`, `organizerRequestResultReminder` (`convex/functions/league/challenges.ts:1472,1612,1920`), `recordOrganizerChallengeAction` (`_challenges/ranking.ts:101`); frontend migrado (`src/lib/leagues/use-challenge-mutations.ts`, `src/app/(private)/leagues/[leagueId]/challenges.tsx`, `src/lib/errors/toast-message.test.ts` com `league/challenges:organizerManage`).
- **LeagueDetailsRole + isLeagueOrganizer:** executado. `src/lib/leagues/league-details-derived.ts` retorna `"organizer" | "player" | "guest"` (linhas ~87-90) e o campo `isManagerOwner` virou `isLeagueOrganizer` (contract/derive/store/testes).
- **Renomeação de arquivos:** parcial (ver abaixo).
- **Strings PT-BR:** executado. Sem matches de "Validação do admin", "Decisão do admin", "Ação administrativa", "pelo admin", "Somente membros" no frontend; `challenge-formatters.ts` usa "Validação do organizador" (l.38) e "Decisão do organizador" (l.80); título de `settings/player/profile.tsx` = "Perfil do jogador"/"Complete seu perfil". Backend: mensagem de `requireActiveManager` já diz "organizador da organização" (`viewer/context.ts`), embora mantenha o typo "Voce".
- **Roles mortos:** executado. `convex/shared/auth-shared.ts` agora define apenas `{ admin, member, owner }` (removidos `club_manager`, `league_manager`, `tournament_manager`).
- **Comentários:** parcial (ver abaixo).

## Não implementado / Parcial

### Identifiers "Admin" remanescentes no frontend
- **Status:** parcial
- **Evidência:** os arquivos foram renomeados (`organizer-overview.tsx`, `player-overview.tsx`, `guest-overview.tsx`, `challenge-organizer-action-dialog.tsx`, `organizer-overview-derived.ts`, `player-overview-derived.ts` — todos existem), mas identifiers internos permanecem com nome Admin: `getAdminActionCopy` (`src/lib/leagues/challenge-formatters.ts:141`), `pushAdminMenuActions` (`src/lib/leagues/challenge-menu-actions.ts:321`), `getAdminManageChallengeSuccessToast`/`getAdminManageChallengeErrorToast` (`src/lib/leagues/challenge-feedback.ts:63,98`), e `adminActionTarget` (`src/app/(private)/leagues/[leagueId]/challenges.tsx:577-596`).

### Comentários com vocabulário antigo
- **Status:** parcial
- **Evidência:** comentários ainda dizem "Admin" em contexto de liga, ex.: `src/lib/leagues/challenge-route-view.ts:308` ("Admin pode lançar/editar o placar...") e `src/lib/leagues/challenge-tab-counts.test.ts:57` ("admin pediu correção de placar"). Limpeza cosmética, sem impacto funcional.

### Decisões de nomenclatura não aplicadas
- **Status:** nao executado (mantidos como estavam)
- **Evidência:** (1) `requireActiveManager()`/`MANAGER_ROLES`/`isActiveActorManager` NÃO foram renomeados para `requireActiveOrganizer` (gates internos — decisão em aberto); (2) `organizerType` não virou `organizationType`; (3) `canManageLeague` foi mantido (claro e consolidado).

### Diferenças do desenho inicial (implementadas com divergências)
- **Status:** documental
- **Evidência:** (1) `ORGANIZER_TYPES` tem 10 valores — adicionado `"particular"` em `convex/domains/organization/contract.ts`; (2) `activateOrganizationSchema` EXIGE `contactEmail` e `phone` e aceita `description`/`website`/`organizerTypeLabel`/`sportsLabel`; o metadata final tem 10 campos; (3) o onboarding coleta tipo de chave + chave + nome da conta (`accountName`, IBX-0002: obrigatório no form, zod `trim().min(1).max(80)`; opcional no backend por retrocompat) e o form sempre envia `accountName` em `crpc.payment.onboarding.start` (Woovi) após criar a org (`onboarding.tsx`) — integração de pagamento adicionada depois; `organizationOutputSchema` inclui `paymentAccount` (`convex/domains/payment/contract.ts`); (4) `organization.profile.get` é guardado por `requireActiveManager` (leitura restrita a managers, não a qualquer member); (5) a serialização ficou em `convex/functions/organization/profile.ts` (`serializeOrganization` local) e as funções do domínio `identity.ts` (`parseOrganizationMetadata`, `buildOrganizationDisplayName`) não têm call site em produção — só testes (`identity.test.ts`); (6) campos do formulário extraídos para `organization-form-fields.tsx` compartilhado; (7) `acceptedTerms.userId` vem "" do cliente e é injetado pelo servidor.

## Decisões tomadas

- Ator de negócio = Better Auth `organization` (sem tabela paralela); `playerProfile` (pessoa) vs `organization` (entidade).
- Backend é dono de permissões: rotas usam `requireActivePlayerProfile`/`requireActiveOrganization`/`requireActiveManager`; capabilities (`canCreateLeague`, `canManageLeagues`, ...) são só para renderização.
- `userPreference` guarda o ator ativo; fallback para player quando a preferência é inválida.
- Perfil da org = própria tabela `organization` + `metadata` json validado por zod; orgs legadas com `metadata: {}` continuam lendo (fallback).
- Regra física/endereço e termos de aceite enforced no zod (ativação exige termos; edição nunca re-pede).
- Padronização 22-07-2026: status `pending_organizer_*`, tabela `leagueChallengeOrganizerAction`, eventos `organizer_approved/rejected`, roles mortos removidos; renomeações de tabela feitas via migration versionada (não wipe/reseed).
- `participant` mantido como tipo `LeagueChallengeParticipant` (challenger/challenged são "participantes do desafio" — lado do match, não role); como role, morreu no vocabulário organizer/player/guest (decisão de produto registrada).
- Integração Woovi/PIX entrou no fluxo de onboarding da org (evolução posterior).

## Design futuro não executado (Phase 2)

### Payment Readiness (gate de planos + trial)
- **Status:** nao executado (design futuro)
- **Evidência:** o desenho previa estender `buildViewerCapabilities` (`convex/domains/auth/actor-context.ts:64-80`): hoje `canCreateLeague` é true para qualquer manager; Phase 2 = `hasActivePlan || inTrialWindow` (trial de 15 dias). Tabelas futuras previstas: `organizationSubscription`/`organizationEntitlement` (plano pago do organizador ancorado em `organization`) e `leagueMembershipPayment`/`playerPaymentMethod` (pagamento de participação ancorado em `leagueMembership`/`playerProfileId`). Regras de separação de escopo: payment de player não desbloqueia features de org; subscription de org não afeta taxas de participação; sem estado de subscription compartilhado via `userId` cru.

### Promoção de `acceptedTerms` para tabela própria
- **Status:** nao executado (design futuro)
- **Evidência:** hoje o aceite de termos vive no metadata da org (exigido na ativação, rejeitado no upsert); a Phase 2 previa tabela dedicada `termsAcceptance(userId, version, acceptedAt)` + migração do valor existente.

## Próximos passos

- Concluir a limpeza de remanescentes: renomear `getAdminActionCopy` → `getOrganizerActionCopy`, `pushAdminMenuActions` → `pushOrganizerMenuActions`, `getAdminManageChallenge*Toast` → `getOrganizerManage*Toast`, `adminActionTarget` → `OrganizerActionTarget`, e limpar comentários "Admin" (evidência: identifiers remanescentes listados acima).
- Decidir (produto) se `requireActiveManager`/`MANAGER_ROLES` serão renomeados para o vocabulário `organizer` e se `organizerType` vira `organizationType` — recomendação da padronização, ainda em aberto no código.
- Sem TODOs ou rotas quebradas detectados nos arquivos verificados deste domínio.
