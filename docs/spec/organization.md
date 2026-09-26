# Organização, Auth e Ator Ativo — Estado atual

> Verificado em 14-08-2026 contra o código do repo (`src/`, `convex/`) — estado pós IBX-0002.

## Visão geral

O app usa um modelo de ator ativo backend-owned: `user` (Better Auth) é só identidade de autenticação; `playerProfile` é o ator jogador (1:1 com user, criado por trigger); `organization` (tabela Better Auth) é o ator organizador/negócio, dono de pagamentos. O `userPreference` guarda o ator ativo (`activeActorKind` + `activeOrganizationId`) e toda rota resolve contexto via `viewer.context.get`, recebendo capacidades e dados já filtrados — o frontend não decide permissões. O perfil da organização é um domínio real (`convex/domains/organization/`) com onboarding dedicado, edição e metadados validados por zod. A padronização executada em 22-07-2026 (utils consolidados, vocabulário organizer/player/guest) está amplamente aplicada. Auth e conta do usuário (login, senha, e-mail, contas vinculadas) vivem em [auth.md](auth.md).

## Implementado

### Active Actor Architecture
- **Status:** implementado
- **Data:** 15/06/2026
- **Referências:** `convex/domains/auth/actor-context.ts` (schemas/`buildViewerCapabilities`/`isActiveActorManager`/`MANAGER_ROLES`), `convex/domains/auth/tables.ts` (`userPreference` com `activeActorKind`/`activeOrganizationId`; `organization`, `member`, `team`, `invitation`, `session`), `convex/domains/auth/triggers.ts` (`ensureInitialPlayerProfile` + `ensureInitialUserPreference` com `DEFAULT_ACTOR_KIND = "player"`), `convex/functions/viewer/context.ts` (`get`, `setActiveActor`, `activateOrganization`, `requireActivePlayerProfile`, `requireActiveManager`), `convex/domains/player/tables.ts` (`playerProfile` 1:1 com user)
- **Decisões:** Better Auth `organization` é o ator de negócio (sem tabela paralela de organizador). `setActiveActor` valida membership (`assertOrganizationMember` → `FORBIDDEN`) antes de trocar o ator; se o ator pedido é inválido, `getViewerContext` faz fallback para o ator jogador. `buildViewerCapabilities` expõe `canManageOrganization`, que depende do role da org (`owner`/`admin` = manager; `member` puro não gerencia).
- **Como funciona:** no signup/signin os triggers criam `playerProfile` e `userPreference` (ator default player). `viewer.context.get` retorna `{ activeActor, availableActors, capabilities }`; `activateOrganization` insere a org com slug gerado (`createOrganizationSlug`), insere `member` role `owner` e faz upsert do `userPreference` para o novo ator. Troca de ator invalida queries actor-scoped no cliente via `applyViewerContextToClientState` (`src/lib/convex/actor-scoped-cache.ts`, lista `ACTOR_SCOPED_QUERY_NAMES`).

### Notificações actor-scoped
- **Status:** implementado
- **Data:** 15/06/2026
- **Referências:** `convex/domains/notification/tables.ts` (`recipientActorKind`, `recipientOrganizationId`, `recipientPlayerProfileId` + índices), `convex/domains/notification/feed-rules.ts` (`isNotificationForActiveActor`), `convex/domains/notification/relations.ts`
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
- **Logo com dialog de confirmação (IBX-0064 round 2):** o logo da organização NÃO tem overlay escuro com texto — o toque no círculo abre o dialog `Quer alterar o logo?`/`Quer adicionar um logo?` (copy dinâmica por estado: `hasLogo` = `logoSource` ou preview; título "Alterar logo"/"Adicionar logo") via o componente global `MediaConfirmDialog` (`src/components/ui/media-confirm-dialog.tsx` — mesmo padrão de confirmação de avatar/banner de auth/tournaments); o CONFIRMAR chama o fluxo de troca de hoje (`logo.handleLogoPress` → picker/crop/upload, intocado); o `PressableFeedback` fica desabilitado durante o submit.

### Padronização de Utils (executada)
- **Status:** executado
- **Data:** 22/07/2026
- **Referências:** módulos consolidados e consumidos: `src/lib/format/currency.ts` (`formatCurrencyCents`, `formatTrendPercent`), `time.ts`, `date.ts`, `relative-time.ts`, `pluralize.ts` (`formatCount`), `user.ts` (`getGreetingLabel`, `getUserInitials`), `src/lib/numbers.ts`, `src/lib/collections.ts`, `src/lib/router/normalize-param.ts`, `src/lib/payments/status.ts`, `src/lib/rules/rule-format.ts`
- **Decisões:** call sites migrados: `src/components/pages/home/organizer-dashboard.tsx` importa `formatCurrencyCents`/`formatTrendPercent`/`formatRelativeTime`/`PAYMENT_STATUS_META` dos módulos novos; `src/app/(private)/settings/player/payments.tsx` usa `formatCurrencyCents` + `formatShortDate` + `formatPaymentStatus`; `src/app/(private)/(tabs)/index.tsx` importa `getGreetingLabel` de `@/lib/format/user`. Extras além do plano: `src/lib/format/currency-input.ts`, `cep.ts`, `email.ts`, `phone.ts` (evolução posterior).

### Padronização de Nomenclatura (executada)
- **Status:** executado
- **Data:** 22/07/2026
- **Recipient role:** executado. `convex/domains/notification/definitions.ts:5` = `"organizer" | "player"`; `tests/content.test.ts` usa `recipientRole: "organizer"`.
- **Strings PT-BR:** executado. Título de `settings/player/profile.tsx` = "Perfil do jogador"/"Complete seu perfil" (`src/app/(private)/settings/player/profile.tsx:359`). Backend: mensagem de `requireActiveManager` diz "organizador da organização" (`convex/functions/viewer/context.ts:298`), embora mantenha o typo "Voce".
- **Roles mortos:** executado. `convex/shared/auth-shared.ts` agora define apenas `{ admin, member, owner }` (removidos `club_manager`, `tournament_manager`).

## Não implementado / Parcial

### Decisões de nomenclatura não aplicadas
- **Status:** nao executado (mantidos como estavam)
- **Evidência:** (1) `requireActiveManager()`/`MANAGER_ROLES`/`isActiveActorManager` NÃO foram renomeados para `requireActiveOrganizer` (gates internos — decisão em aberto); (2) `organizerType` não virou `organizationType`.

### Diferenças do desenho inicial (implementadas com divergências)
- **Status:** documental
- **Evidência:** (1) `ORGANIZER_TYPES` tem 10 valores — adicionado `"particular"` em `convex/domains/organization/contract.ts`; (2) `activateOrganizationSchema` EXIGE `contactEmail` e `phone` e aceita `description`/`website`/`organizerTypeLabel`/`sportsLabel`; o metadata final tem 10 campos; (3) o onboarding coleta tipo de chave + chave + nome da conta (`accountName`, IBX-0002: obrigatório no form, zod `trim().min(1).max(80)`; opcional no backend por retrocompat) e o form sempre envia `accountName` em `crpc.payment.onboarding.start` (Woovi) após criar a org (`onboarding.tsx`) — integração de pagamento adicionada depois; `organizationOutputSchema` inclui `paymentAccount` (`convex/domains/payment/contract.ts`); (4) `organization.profile.get` é guardado por `requireActiveManager` (leitura restrita a managers, não a qualquer member); (5) a serialização ficou em `convex/functions/organization/profile.ts` (`serializeOrganization` local) e as funções do domínio `identity.ts` (`parseOrganizationMetadata`, `buildOrganizationDisplayName`) não têm call site em produção — só testes (`identity.test.ts`); (6) campos do formulário extraídos para `organization-form-fields.tsx` compartilhado; (7) `acceptedTerms.userId` vem "" do cliente e é injetado pelo servidor.

## Decisões tomadas

- Ator de negócio = Better Auth `organization` (sem tabela paralela); `playerProfile` (pessoa) vs `organization` (entidade).
- Backend é dono de permissões: rotas usam `requireActivePlayerProfile`/`requireActiveManager`; capabilities (`canManageOrganization`) são só para renderização.
- `userPreference` guarda o ator ativo; fallback para player quando a preferência é inválida.
- Perfil da org = própria tabela `organization` + `metadata` json validado por zod; orgs legadas com `metadata: {}` continuam lendo (fallback).
- Regra física/endereço e termos de aceite enforced no zod (ativação exige termos; edição nunca re-pede).
- Integração Woovi/PIX entrou no fluxo de onboarding da org (evolução posterior).

## Design futuro não executado (Phase 2)

### Payment Readiness (gate de planos + trial)
- **Status:** nao executado (design futuro)
- **Evidência:** o desenho previa estender `buildViewerCapabilities` (`convex/domains/auth/actor-context.ts:57-67`): hoje `canManageOrganization` é true para qualquer manager; Phase 2 = `hasActivePlan || inTrialWindow` (trial de 15 dias). Tabelas futuras previstas: `organizationSubscription`/`organizationEntitlement` (plano pago do organizador ancorado em `organization`) e `playerPaymentMethod` (pagamento de participação ancorado em `playerProfileId`). Regras de separação de escopo: payment de player não desbloqueia features de org; subscription de org não afeta taxas de participação; sem estado de subscription compartilhado via `userId` cru.

### Promoção de `acceptedTerms` para tabela própria
- **Status:** nao executado (design futuro)
- **Evidência:** hoje o aceite de termos vive no metadata da org (exigido na ativação, rejeitado no upsert); a Phase 2 previa tabela dedicada `termsAcceptance(userId, version, acceptedAt)` + migração do valor existente.

## Próximos passos

- Decidir (produto) se `requireActiveManager`/`MANAGER_ROLES` serão renomeados para o vocabulário `organizer` e se `organizerType` vira `organizationType` — recomendação da padronização, ainda em aberto no código.
- Sem TODOs ou rotas quebradas detectados nos arquivos verificados deste domínio.
