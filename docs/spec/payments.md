# Payments e Checkout — Estado atual

> Verificado em 10-08-2026 contra o código do repo (src/, convex/).

## Visão geral

O app cobra mensalidade de ligas pagas via PIX com split Woovi (organizador + BR-Open) e o pagamento é o gate de entrada/renovação da inscrição. O domínio `payment` (convex/domains/payment + convex/functions/payment) implementa: onboarding da organização como subconta Woovi via chave PIX, criação de charges PIX com split, webhook autenticado por RSA (fonte de verdade de PAID/EXPIRED/REFUNDED), cron de renovação com período de carência configurável, dashboard financeiro do organizador na Home, hub de pagamentos do jogador, reconciliação com o provedor e saque (withdraw) do saldo da subconta (DECISAO-003). O checkout é uma rota própria (`/checkout/[chargeId]`) que re-renderiza QR/copia-e-cola de uma charge existente.

## Implementado

### 1. Onboarding da organização como subconta Woovi
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/functions/payment/onboarding.ts (`start` authAction com input `{ pixKey }`, `getStatus` authQuery, `upsertAccount` privateMutation); convex/domains/payment/contract.ts (`paymentAccountSchema`: name, pixKey, status, onboardedAt); convex/functions/payment/providerNode.ts (`createSubaccountAction`, `"use node"` via `@woovi/node-sdk`); src/components/pages/organization/organization-form-fields.tsx (seção "Pagamentos" ~linhas 663-1070: `OnboardingPaymentSection` no modo onboarding + card com status e botão "Conectar conta"); src/app/(private)/settings/organization/onboarding.tsx (chama `payment.onboarding.start` na ativação da org); src/lib/payments/pix-key.ts (validação/máscara de chave PIX CPF/CNPJ/email/celular/aleatória).
- **Decisões:** o snapshot da subconta virou JSON embed `organization.paymentAccount` (1:1), validado por zod no serializer (comentário em convex/domains/payment/contract.ts). O input é `pixKey` apenas — a Woovi aceita `{name, pixKey}` sem taxId, e a chave PIX é o identificador do split ("split recipient identifier"). Status `pending`/`active`/`rejected` mantido; a subconta é criada síncrona e utilizável imediatamente (comentário no contract.ts).
- **Como funciona:** `start` exige `requireActiveManager`, chama `createSubaccountAction` (SDK Woovi) e persiste o snapshot ativo com a pixKey. `getStatus` devolve o snapshot (usado pelo form da org, pelo form de liga e pela tela de saque).

### 2. Charge PIX com split + checkout
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/functions/payment/charge.ts (`createCharge` authAction, `getPendingCharge`, `getCheckoutContext`, `saveCharge`, `resolveSourceForCharge`); convex/functions/payment/providerNode.ts (`createChargeWithSplitAction`); convex/domains/payment/tables.ts (`paymentCharge`); convex/domains/payment/rules.ts (`computeSplit`, `CHARGE_EXPIRES_IN_SECONDS = 3600`, `normalizeProviderStatus`); convex/domains/payment/contract.ts (`createChargeOutputSchema`, `checkoutContextSchema`); src/app/(private)/checkout/[chargeId]/index.tsx (tela: QR, copia-e-cola, countdown, estados PAID/EXPIRED, skeleton); src/app/(private)/_layout.tsx (declara `checkout/[chargeId]` como Stack.Screen explícito); src/components/pages/leagues/league-join-footer.tsx (branch: após `requestJoin`, se `awaiting_payment` → `createCharge` → navega para `/checkout/[chargeId]`; fast path com `getPendingCharge` para renovação).
- **Decisões:** a tabela `paymentCharge` é **polimórfica** por `sourceType`+`sourceId` (hoje só `league_membership`; pronta para event_registration etc. — comentário em tables.ts). Rota própria `/checkout/[chargeId]` (deep-linkável, re-display via `getCheckoutContext`). `expiresAt` = 1 hora. Status UPPERCASE: `PENDING/PAID/EXPIRED/REFUNDED/FAILED`. `simulatePayment` (authMutation, bloqueado em production) existe como ferramenta dev-only para teste — o desenho inicial previa remoção; foi mantido (divergência registrada).
- **Como funciona:** `createCharge({sourceId, sourceType})` valida a membership (`canMembershipBeCharged`: awaiting_payment, payment_due, suspended), resolve a liga, calcula `computeSplit` com `platformFeePercent` (league ou `DEFAULT_PLATFORM_FEE_PERCENT = 10`) + pixKey da org, chama a Woovi com `correlationId` determinístico (`bropen:<sourceType>:<sourceId>:<timestamp>`), salva a charge PENDING e devolve `brCode`/`qrCodeUrl`/`expiresAt`. O checkout consulta `getCheckoutContext` e reage a PAID/EXPIRED via invalidação de queries; botão "pagar" do footer usa `getPendingCharge` para navegação instantânea quando já existe charge válida.

### 3. Webhook Woovi (autenticado, idempotente)
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/functions/payment/webhook.ts (`publicRoute.post("/api/webhooks/woovi")`); convex/domains/payment/webhook-signature.ts (`verifyWooviWebhookSignature`); convex/domains/payment/webhook-events.ts (eventos + `wooviWebhookPayloadSchema`); convex/functions/http.ts (rota registrada via `paymentWebhookRouter`); convex/domains/payment/rules.ts (`canChargeBePaid`, `canChargeBeExpired`, `canChargeBeRefunded`); convex/functions/payment/charge.ts (`applyPaidCharge`, `markChargeExpired`, `markChargeRefunded`).
- **Decisões:** autenticação por **RSA-SHA256 com a chave pública fixa da Woovi** (`x-webhook-signature`, `crypto.subtle` — Web Crypto porque Convex roda em isolate V8 sem `node:crypto`), método recomendado pela Woovi e sem secret por merchant (comentário em webhook-signature.ts). Não há `WOOVI_WEBHOOK_SECRET` em convex/lib/get-env.ts.
- **Como funciona:** lê o body cru + header de assinatura, verifica RSA, faz parse com zod union e despacha: `OPENPIX:TRANSACTION_RECEIVED` e `OPENPIX:CHARGE_COMPLETED` → `applyPaidCharge` (pipeline atômico: charge PAID + ativa a membership), `OPENPIX:CHARGE_EXPIRED` → `markChargeExpired`, `OPENPIX:CHARGE_REFUNDED` → `markChargeRefunded` (membership → left, rankingPosition → null, notificação), `OPENPIX:MOVEMENT_FAILED` → marca withdraw como failed. Idempotência por `correlationId` + guardas de transição (só PENDING → PAID/EXPIRED; REFUNDED aceito de PAID/EXPIRED). Sempre devolve 200 para evitar retries da Woovi.

### 4. Renovação com carência + lembretes proativos
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/functions/payment/charge.ts (`sendRenewalReminders` privateMutation, cron em convex/crons.ts `send-renewal-reminders` a cada 24h); convex/domains/payment/rules.ts (`shouldSendRenewalReminder`, `shouldMarkPaymentDue`, `shouldSuspend`); convex/domains/league/contract.ts (`DEFAULT_LEAGUE_GRACE_PERIOD_DAYS = 7`, `DEFAULT_LEAGUE_REMINDER_DAYS_BEFORE = 3`, status `payment_due`, `approvalMode` auto/manual); convex/domains/league/tables.ts (`gracePeriodDays`, `reminderDaysBefore`); src/app/(private)/settings/leagues/[mode]/settings.tsx (seção "Cobrança" com NumberStepper "Carência (dias)" e "Lembrete antes do vencimento (dias)"); src/lib/leagues/presentation.ts (formatação).
- **Decisões:** `canMembershipBeCharged` aceita `awaiting_payment`, `payment_due` e `suspended` (CHARGEABLE_MEMBERSHIP_STATUSES em rules.ts). O cron lê `gracePeriodDays`/`reminderDaysBefore` da liga em runtime (não snapshot). Timeline: D−reminder → renewal_reminder (dedupe 24h); D-0 → membership `payment_due` (ainda joga); D+grace → `suspended` + `renewal_due`. `rankingPosition` preservado nas transições (update só de status). Os status `awaiting_payment` + `payment_due` e `approvalMode` (auto = vai direto ao checkout; manual = fila do organizador; ligas grátis sempre manual) foram adicionados na implementação.

### 5. Notificações de pagamento
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/shared/notifications/protocol.ts (eventos `league.membership.payment_confirmed`, `payment_due`, `payment_expired`, `payment_refunded`, `renewal_due`, `renewal_reminder`); convex/domains/notification/definitions.ts (templates pt-BR + deep-links `getCheckoutUrl`/`getLeagueUrl`); convex/functions/payment/charge.ts (agendamento em `applyPaidCharge`/`markChargeExpired`/cron, ex. `payment_expired` ~linha 838).
- **Decisões:** o fluxo usa `payment_confirmed` (disparado quando o webhook confirma o pagamento) e os eventos `payment_expired` e `payment_refunded` (não previstos no desenho inicial). O evento `charge_created` previsto (avisar o jogador quando a charge é criada) **NÃO existe** — só há notificação após confirmação/expiração/reembolso.

### 6. Dashboard do organizador na Home
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/functions/payment/dashboard.ts (`getOverview` authQuery — hero recebido no mês/mês passado, `activeSubscribers`, `overdueCount`, `paymentsThisMonth`, `projectedMonthlyCents`, `recentCharges`, `account`); convex/domains/payment/contract.ts (`dashboardOverviewSchema`, `dashboardRecentChargeSchema`); src/app/(private)/(tabs)/index.tsx (modo organizador renderiza `<OrganizerDashboard>`); src/components/pages/home/organizer-dashboard.tsx (hero KPI + KPI grid 2×2 + atividade recente + card "Saldo + saque" com navegação `/withdraw`); src/lib/format/currency.ts (`formatTrendPercent`).
- **Decisões:** quando Woovi não conectado, `getOverview` retorna zeros early (account não active) e renderiza o dashboard zerado — o CTA de conexão vive no form da organização (organization-form-fields.tsx), não na Home.

### 7. PIX key como seção do perfil/onboarding da organização
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** src/components/pages/organization/organization-form-fields.tsx (seção "Pagamentos" com status `pending/active/rejected`, botão "Conectar conta", `OnboardingPaymentSection` no modo onboarding); src/app/(private)/settings/organization/onboarding.tsx (ativação da org já conecta o PIX); src/lib/payments/pix-key.ts (validação). `src/app/(private)/settings/organization/payments.tsx` **não existe mais**.
- **Decisões:** a seção foi integrada ao formulário da organização (organization-form-fields), usado tanto no onboarding quanto na edição do perfil (`profile.tsx` importa OrganizationFormFields). O form de liga também consulta `payment.onboarding.getStatus` (settings/leagues/[mode]/settings.tsx ~linha 94).

### 8. Reconciliação de charges
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/functions/payment/charge.ts (`findStaleChargesForReconciliation`, `reconcileCharges` privateAction); convex/functions/payment/providerNode.ts (`getChargeStatusAction` — GET /api/v1/charge/{correlationId}); convex/crons.ts (`reconcile-charges` a cada 30 min, gate `DEPLOY_ENV === "production"`); convex/domains/payment/rules.ts (`normalizeProviderStatus`: ACTIVE→PENDING, COMPLETED→PAID, EXPIRED→EXPIRED).
- **Como funciona:** busca charges PENDING com mais de 10 min, consulta a Woovi por correlationId e despacha para `applyPaidCharge`/`markChargeExpired` (idempotente).

### 9. Refund e sweep de charges expiradas
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** convex/domains/payment/webhook-events.ts (`OPENPIX_CHARGE_REFUNDED`); convex/functions/payment/webhook.ts (dispatch → `markChargeRefunded`); convex/functions/payment/charge.ts (`markChargeRefunded`, `expireStaleCharges`); convex/crons.ts (`expire-stale-charges` a cada 1h).
- **Decisões:** além do refund por webhook (reembolso manual no dashboard Woovi), `REFUNDED` também é alcançado pelo "over-enrollment guard" (liga lotada enquanto o jogador pagava) — notificação `payment_refunded` com texto "A liga atingiu o limite de jogadores enquanto você pagava. O reembolso será processado." (definitions.ts).

### 10. Hub de pagamentos do jogador
- **Status:** implementado
- **Data:** 22/07/2026
- **Referências:** src/app/(private)/settings/player/payments.tsx (cards com `PAYMENT_STATUS_META` chip, menu, botão gerar novo PIX em charges expiradas via `createCharge` → navega `/checkout/[chargeId]`); convex/functions/payment/charge.ts (`listMine`); convex/domains/payment/contract.ts (`myPaymentItemSchema` com `canRegenerate`); src/lib/payments/status.ts (`PAYMENT_STATUS_META`: PENDING→warning "Pendente", PAID→success "Pago", EXPIRED/FAILED→danger, REFUNDED→default "Reembolsado").

### 11. Saque do organizador (withdraw — DECISAO-003)
- **Status:** implementado
- **Data:** — (não commitado ainda)
- **Referências:** convex/domains/payment/tables.ts (`withdrawals`, `subaccountBalance`); convex/domains/payment/withdraw-rules.ts (`WITHDRAW_FEE_TIERS`: R$1.000→R$5, R$2.000→R$3, R$3.000→R$2; `FREE_WITHDRAW_FROM_CENTS = 300_000`; `MIN_WITHDRAW_CENTS = 2000`; `computeWithdrawFee`, `computeLiquidAmountCents`); convex/functions/payment/withdraw.ts (`getBalance`, `requestWithdraw`, `insertWithdrawal`, `upsertBalanceCache`, `refreshSubaccountBalances` cron 5 min, `markWithdrawFailedByProviderId`); convex/functions/payment/providerNode.ts (`getSubaccountBalanceAction`, `withdrawSubaccountAction` — POST /api/v1/subaccount/{pixKey}/withdraw, `WITHDRAW_ERROR_MESSAGES` legíveis); src/app/(private)/withdraw/index.tsx (tela: saldo, taxa por faixa, validação min/máx, confirmação); src/lib/withdraw/ (contract.ts, api.ts `useWithdrawApi`, calculations.ts, balance-card.ts, info.ts); src/components/pages/home/organizer-dashboard.tsx (card "Saldo + saque" com botão "Sacar"); convex/domains/payment/relations.ts; convex/crons.ts (`refresh-subaccount-balances`); convex/domains/payment/tests/withdraw-rules.test.ts.
- **Decisões:** faixas escalonadas definidas pelo usuário (DECISAO-003). O contrato do frontend foi escrito antes do backend: src/lib/withdraw/contract.ts ainda tem o comentário "O backend AINDA NÃO existe: a Forja implementa depois" — **desatualizado** (o backend existe e o convex/domains/payment/contract.ts diz que espelha esse arquivo; os shapes batem). Taxa nunca hardcoded no frontend: vem do backend via `getBalance`.

### 12. Testes do domínio
- **Status:** implementado
- **Data:** 22/07/2026 (withdraw-rules.test.ts: não commitado)
- **Referências:** convex/domains/payment/tests/ (contract.test.ts, rules.test.ts — split math com Woovi fee e margem, webhook-events.test.ts, webhook-signature.test.ts, withdraw-rules.test.ts).

## Não implementado / Parcial

### Financeiro por liga — tab "Financeiro"
- **Status:** nao implementado
- **Evidência:** grep em src/ por `getLeagueFinance|listLeagueTransactions|financeiro|Financeiro` → sem matches. src/app/(private)/leagues/[leagueId]/ tem apenas index, rules, schedule, ranking, requests, challenges, _layout (sem financeiro.tsx). `convex/functions/payment/dashboard.ts` expõe somente `getOverview`. Também não há snapshots `leagueId`/`leagueName`/`playerName` na tabela `paymentCharge` (o código usa `sourceLabel` snapshot + joins em `getOverview`).

### Pix Automático
- **Status:** nao implementado (decisão explícita)
- **Evidência:** rejeitado como mecanismo primário (frequência mensal, bancos com suporte limitado, split não confirmado); deferido indefinidamente. Nenhuma rota de assinatura/mandato no código; o checkout tem só PIX único.

### Override de fee por liga com UI
- **Status:** parcial (backend pronto, UI inexistente)
- **Evidência:** `league.platformFeePercent` existe em convex/domains/league/tables.ts (integer, nullable) e é usado em `computeSplit` (charge.ts: `currentLeague.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT`), mas o comentário em league/tables.ts:38-41 diz explicitamente: "Set directly in the Convex dashboard — no app surface exposes this yet".

### Fontes polimórficas de charge além de league_membership
- **Status:** parcial (estrutura pronta, sem uso)
- **Evidência:** `paymentCharge.sourceType/sourceId` e `SOURCE_TYPE_LEAGUE_MEMBERSHIP = "league_membership"` (charge.ts); webhook/handlers e `sendRenewalReminders` filtram por `sourceType === "league_membership"`. Nenhum outro sourceType registrado.

### Deep-link "Ver no painel Woovi" (dashboard do organizador)
- **Status:** nao implementado
- **Evidência:** o desenho de UI previa o link "Ver no painel Woovi →" no card de receita do organizador; `organizer-dashboard.tsx` não tem link externo para o painel da subconta.

### Tela de detalhe de pagamento com histórico
- **Status:** nao implementado
- **Evidência:** o desenho de UI previa tela de detalhe da charge com histórico de eventos; o hub do jogador (`settings/player/payments.tsx`) lista charges sem tela de detalhe.

### Notificação ao organizador sobre reembolso
- **Status:** nao implementado
- **Evidência:** `payment_refunded` notifica apenas o jogador (definitions.ts); o organizador não é avisado quando um pagamento é reembolsado.

### Itens de UI não implementados
- **Status:** parcial
- **Evidência:** não há componente dedicado `PaymentStatusChip` (o mapeamento vive em src/lib/payments/status.ts, usado por hub/dashboard); não há skeleton específico para QR (o checkout usa `Skeleton isLoading` genérico do HeroUI); não há progress indicator de 4 passos no checkout; o countdown existe com threshold de perigo em 5 min (`DANGER_THRESHOLD_MS = 300_000` no checkout); não há empty states específicos (o desenho previa copy para "Meus Pagamentos" vazio e "Nenhum jogador inscrito ainda. Compartilhe o link da liga."). O fluxo de "Sair da liga" como dialog destrutivo não foi verificado nesta análise (fora do escopo payment).

## Decisões tomadas

- **Split dentro da Woovi:** BR-Open nunca toca no dinheiro; Woovi é o PSP regulado; sem IAP (App Store BR pós-CADE).
- **PIX único é o mecanismo primário:** Pix Automático rejeitado (frequência, suporte bancário, split não confirmado); carência + lembretes resolvem o "esqueci de pagar".
- **Sem pagamento offline/manual:** todo pagamento passa pelo split Woovi; liga grátis é R$0.
- **Carência configurável por liga:** `gracePeriodDays` (default 7) e `reminderDaysBefore` (default 3), lidos em runtime pelo cron.
- **`payment_due` como status novo** e **ranking preservado na suspensão**; refund ainda limpa `rankingPosition`.
- **Grandfathering de preço:** próxima charge usa o preço novo; snapshot `amountCents` preserva o histórico.
- **Fee da plataforma = max(feePercent·ticket, Woovi PIX-IN + margem R$1,00)** (DECISAO-004): Woovi 0,80% (min R$0,50, max R$5,00); `PLATFORM_FEE_MIN_MARGIN_CENTS = 100`; default 10% com override por liga (backend-only).
- **Webhook com RSA-SHA256 via chave pública fixa da Woovi:** sem secret por merchant; Web Crypto por causa do isolate V8.
- **Provider via `@woovi/node-sdk`** (substituiu o fetch cru do desenho inicial) em `providerNode.ts` "use node"; auth `Authorization: <APP_ID>` verbatim (descoberta na integração; sem Basic/Bearer).
- **Snapshot do split por charge** (`splitConfig` com `recipientPixKey`, `feePercent`, `brOpenCents`, `organizerCents`, `wooviFeeCents` opcional para charges legadas) — histórico imune a mudança de fee.
- **Saque com faixas escalonadas vindas do backend** (DECISAO-003), mínimo R$20, grátis ≥ R$3.000; saldo cacheado (cron 5 min) porque query do Convex não chama provider.

## Próximos passos

- **Tab Financeiro por liga** é o maior item não executado: queries `getLeagueFinance`/`listLeagueTransactions` + rota `leagues/[leagueId]/financeiro.tsx` + snapshots `leagueId/leagueName/playerName` na `paymentCharge` — evidência: ausência total no código.
- **UI para `league.platformFeePercent`**: backend pronto, sem superfície no app (comentário em convex/domains/league/tables.ts:38-41).
- **Withdraw `completed` reservado**: o status existe no enum mas só `pending`/`failed` são alcançados (sem webhook de sucesso conhecido — comentário em convex/domains/payment/contract.ts).
- **Limpeza**: pasta vazia `src/app/(private)/checkout/[chargeId] 2/` (sem index.tsx, sem arquivos) — candidata a remoção; comentário desatualizado em src/lib/withdraw/contract.ts ("O backend AINDA NÃO existe").
