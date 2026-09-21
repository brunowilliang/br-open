# Notificações — Estado atual

> Verificado em 21-09-2026 contra o código do repo (`convex/`, `src/`) e o DEV
> (kindred-yak-142, `function-spec` + schema das tabelas). **EM ANDAMENTO (sem
> commit):** a Etapa 1 entrega o CONTRATO da notificação acionável — o campo
> `presentation` e o builder no servidor. A Etapa 2 (botão no PUSH do sistema,
> categoria por tipo) vem depois.
>
> As referências abaixo citam o **símbolo** sempre que o arquivo é do domínio de
> notificação (o número da linha acompanha como atalho): este é o corte que mais
> mexe nesses arquivos, e o símbolo não drifta.

## Visão geral

Um subsistema único de notificação para o app inteiro, com três peças:

1. **O evento** (`eventType`): 44 tipos catalogados em `NOTIFICATION_EVENT_TYPES`
   (`convex/shared/notifications/protocol.ts:1-46`), cada um com template pt-BR
   próprio no mapa `definitions` (`convex/domains/notification/definitions.ts:129-465`).
2. **A central** (`notificationFeed`): uma linha por destinatário, criada no
   servidor com título, corpo, `data` (ids + url de destino) e a apresentação
   acionável (`presentation`). O app lista e renderiza; não decide nada.
3. **O push** (Expo): uma `notificationDelivery` por device habilitado, com
   retry e recuperação de execuções travadas.

O princípio é o mesmo das pendências (`docs/spec/pendings.md`): **o servidor é a
fonte da verdade** — copy, url e ação nascem no backend, e a tela não infere
ação por `eventType`.

## Pipeline de criação (ponto único)

Toda notificação nasce em `createForRecipients`
(`convex/functions/notification/orchestrator.ts:270`) — o **único**
`insert("notificationFeed")` do repo (mesmo arquivo, `:313`). Nenhum emissor
escreve na tabela direto.

- **Input:** `createForRecipientsSchema` (`orchestrator.ts:46-74`):
  `{ actorUserId, eventType, leagueId XOR tournamentId, metadata?,
  recipientUserIds (min 1), sourceEntityId?, sourceEntityType? }`; o
  `superRefine` (`:60-74`) recusa os dois ids de origem juntos e exige um deles.
- **Fonte:** `resolveNotificationSource` (`orchestrator.ts:138`) lê a liga ou o
  torneio e guarda `{ id, kind, name, organizationId }`.
- **Ator:** `getActorName` (`orchestrator.ts:104`) resolve
  `playerProfile.nickname` → `playerProfile.fullName` → `user.name`. Sem ator, o
  template cai no genérico `Um jogador`.
- **Destinatário:** `resolveRecipientActor` (`orchestrator.ts:169`). O evento
  decide o KIND do ator: `ORGANIZER_RECIPIENT_EVENTS` (`orchestrator.ts:122`) tem
  **dois** eventos (`league.membership.requested`, `tournament.entry.created`),
  que nascem no ator **organização**; todo o resto nasce no ator **jogador** e é
  **descartado em silêncio** quando o usuário destinatário não tem
  `playerProfile` (`orchestrator.ts:184-190` devolve `null` → `:292-294` pula o
  destinatário).
- **Conteúdo e apresentação:** `buildNotificationContent`
  (`definitions.ts:481`) e `buildNotificationPresentation` (`presentation.ts`)
  recebem o MESMO input (`orchestrator.ts:296-311`), então corpo e botão nunca
  divergem.
- **`data` publicado:** `{ ...metadata, eventType, leagueId?|tournamentId?, url }`
  (bloco `data` de `buildNotificationContent`, `definitions.ts:497-503`).
  `sourceEntityId`/`sourceEntityType` **não** entram no `data` (ficam na linha da
  tabela).
- **Push:** lê `notificationPreference` (pula se `pushEnabled` é falso), lê até
  100 `notificationDevice` e filtra `!disabledAt && permissionStatus ===
  "granted"`; insere uma `notificationDelivery` `awaiting_delivery` por device
  (`orchestrator.ts:330-355`).

### Emissores (quem chama)

| Wrapper | Onde | Usado por |
|---|---|---|
| `scheduleLeagueNotification` | `convex/functions/notification/events.ts:17` | membership e pagamento da liga |
| `scheduleChallengeNotification` | `convex/functions/league/_challenges/notifications.ts:8` | os 18 `league.challenge.*` (injeta `metadata.challengeId`, `sourceEntityType: "leagueChallenge"`) |
| `scheduleTournamentNotification` | `convex/functions/tournament/_shared/guards.ts:149` | torneio |
| `scheduler.runAfter` cru | `payment/charge.ts:1270` (estorno por categoria cheia) e `:1304` (confirmação paga) | ativação paga da inscrição |

Toda emissão é **diferida** (`ctx.scheduler.runAfter(0, ...)`), inclusive as que
já rodam em cron/webhook. Crons que emitem: `expire-stale-charges`,
`send-renewal-reminders`, `reconcile-charges` e `auto-start-tournaments`
(`convex/functions/crons.ts`).

## Apresentação acionável (`presentation`)

Campo **nullable** na tabela `notificationFeed` (coluna `presentation` em
`convex/domains/notification/tables.ts:67`), aditivo e sem migration: linha antiga
(ou evento informativo) chega `presentation: null` e a tela desenha o cartão sem
ação. No app esses rótulos são ITENS DO MENU ⋮ do cartão da central, não botões
no corpo (rodada 2 do IBX-0077, `docs/spec/dashboard.md` → "TODA AÇÃO NO MENU ⋮"):
`presentation: null` = cartão sem item de ação, e o menu segue com o item
destrutivo. Schema: `notificationPresentationSchema`
(`convex/domains/notification/contract.ts:56-71`); o item do feed expõe o campo
em `notificationFeedItemSchema`
(`convex/domains/notification/contract.ts:73-92`, campo em `:81`).

| Subcampo | Regra |
|---|---|
| `action` | **Como o cliente EXECUTA** o botão principal: `{ type, params }` ou `null`. Reusa o MESMO schema e o MESMO enum das pendências (`pendingActionSchema`, `convex/domains/pendings/contract.ts:175-178`) — um só vocabulário de ação no repo. |
| `actionLabel` | Copy do botão, pt-BR, **uma palavra** (`Aprovar`, `Recusar`, `Aceitar`, `Confirmar`, `Pagar`, `Renovar`). |
| `secondaryAction` | Ação executável do botão secundário (mesmo shape), ou `null`. |
| `secondaryActionLabel` | Copy do secundário, ou `null`. |
| `bodyHighlights` | Trechos **literais** do `body` que vão em negrito (pode ser vazio). Derivados do PRÓPRIO corpo renderizado, comparando sem caixa: o servidor só marca palavra que o texto mostra (ver `findActorNameInBody` em `presentation.ts`). |

**Quem decide:** `buildNotificationPresentation`
(`convex/domains/notification/presentation.ts`), módulo **puro** (molde de
`definitions.ts`), com o mapa declarativo `EVENT_PRESENTATION_BUILDERS` — um
lugar só. A galeria dev do app importa a MESMA função para montar os cartões com
os rótulos reais, sem copiar copy.

**Sem o id, sem botão:** quando o emissor não manda o id que a mutation exige, o
builder devolve `null` (item vira informativo). Nunca nasce botão morto.

### Mapa evento → ação (12 tipos)

| `eventType` | Papel | Botões | `action.type` | `action.params` |
|---|---|---|---|---|
| `league.membership.requested` | organizador | Aprovar · Recusar | `approve_league_membership` · `reject_league_membership` | `{ membershipId }` |
| `tournament.entry.created` | organizador | Aprovar · Recusar | `approve_tournament_entry` · `reject_tournament_entry` | `{ entryId }` |
| `tournament.partner.invited` | jogador | Aceitar · Recusar | `accept_partner_invite` · `decline_partner_invite` | `{ entryId }` |
| `league.challenge.created` | jogador | Aceitar · Recusar | `accept_challenge_proposal` · `decline_challenge_proposal` | `{ challengeId }` |
| `league.challenge.counter_proposed` | jogador | Aceitar · Recusar | `accept_challenge_proposal` · `decline_challenge_proposal` | `{ challengeId }` |
| `league.challenge.cancellation_requested` | jogador | Aceitar · Recusar | `accept_challenge_cancellation` · `decline_challenge_cancellation` | `{ challengeId }` |
| `league.challenge.result_submitted` | jogador | Confirmar | `confirm_challenge_result` | `{ challengeId }` |
| `league.challenge.walkover_submitted` | jogador | Confirmar | `confirm_challenge_result` | `{ challengeId }` |
| `league.membership.payment_due` | jogador | Pagar | `pay_league_membership` | `{ membershipId }` |
| `league.membership.payment_expired` | jogador | Pagar | `pay_league_membership` | `{ membershipId }` |
| `league.membership.renewal_due` | jogador | Renovar | `pay_league_membership` | `{ membershipId }` |
| `league.membership.renewal_reminder` | jogador | Renovar | `pay_league_membership` | `{ membershipId }` |

Os outros 32 eventos são **informativos** (`presentation: null`).

**Divergência assumida:** na PENDÊNCIA o `pay_league_membership` lê o alvo do
`source.id`; na NOTIFICAÇÃO ele viaja em `action.params.membershipId`, porque o
item do feed não tem `source` (documentado no próprio enum,
`convex/domains/pendings/contract.ts:87-90`).

**Enum de ação:** `PENDING_ACTION_TYPE_OPTIONS`
(`convex/domains/pendings/contract.ts:118-133`) — FECHADO e **crescente por
adição**, 14 tipos. A notificação adicionou 9 membros (os pares aprovar/recusar
de membership e entry, os pares de proposta e de cancelamento de desafio, e
`confirm_challenge_result`); os 5 originais seguem intactos. Pares de ida e
volta são tipos SEPARADOS, nunca um booleano em `params` (que é
`Record<string, string>`).

### Destaque (`bodyHighlights`)

Regra: o **nome do ator** entra em negrito somente quando o corpo realmente cita
esse nome — o dado que o destinatário precisa reconhecer para decidir, a mesma
régua dos cartões aprovados na galeria de Alertas (IBX-0076). O trecho destacado
é o que o CORPO mostra (`findActorNameInBody`, `presentation.ts`), com comparação
sem caixa: um template que formate o nome diferente da entrada continua gerando
negrito, e todo item de `bodyHighlights` é subtrecho literal do `body` por
construção. Ator ausente (o corpo cai em `Um jogador`) não gera destaque. Os
quatro eventos de pagamento saem **sem** destaque: o corpo não tem palavra-chave
(o servidor não manda data nem valor nesses estados).

## Gates de estado (o botão nunca mente)

Notificação é **evento passado**, não pendência viva: o feed não recheca estado.
Por isso o botão só existe onde a mutation recusa o que já foi resolvido.

| Botão | Mutation | Gate |
|---|---|---|
| Aprovar / Recusar solicitação de entrada | `league.membership.approve` / `.reject` | **adicionado no BUG-0048**: `resolveMembershipReviewError` (`convex/domains/league/membership-rules.ts:83`, status revisável em `:71`) exige `status === "pending"` e devolve `CONFLICT` "Essa solicitação de entrada já foi resolvida.", aplicado em `convex/functions/league/membership.ts:529-535` e `:595-601`. Antes, `approve` setava `active` para QUALQUER status anterior e `reject` derrubava membership ativa. |
| Aprovar / Recusar inscrição | `tournament.entries.approve` / `.reject` | `status !== "pending_approval"` → `BAD_REQUEST`, um gate por procedimento (`convex/functions/tournament/entries.ts:639-643` e `:688-692`). Já existia. |
| Aceitar / Recusar convite de dupla | `tournament.entries.respondPartnerInvite` | `status !== "pending_partner"` → `BAD_REQUEST` (`convex/functions/tournament/entries.ts:533-538`), dono do convite → `FORBIDDEN` (`:539-543`); no aceite ainda valida janela de inscrição, duplicidade na categoria e capacidade (`:580-589`). Já existia. |
| Aceitar / Recusar proposta de desafio | `league.challenges.acceptProposal` / `.declineProposal` | `getCurrentProposalOrThrow` (`convex/functions/league/_challenges/proposals.ts:30-56`, `NOT_FOUND` sem proposta) + status em `VIEWER_PROPOSAL_RESPONSE_CHALLENGE_STATUSES` (`convex/functions/league/challenges.ts:478-488` e `:564-574`). Já existia. |
| Aceitar / Recusar cancelamento | `league.challenges.respondCancellationRequest` | `status !== "pending_cancellation_acceptance"` (`convex/functions/league/challenges.ts:975-980`) + quem responde (`:985-994`). Já existia. |
| Confirmar resultado | `league.challenges.confirmResult` | sem submissão (`convex/functions/league/challenges.ts:1216-1221`), o autor do envio não confirma (`:1223-1230`), já confirmado (`:1232-1237`). Já existia. |
| Pagar / Renovar mensalidade | `payment.charge.createCharge` | **Sem risco de cobrança duplicada**: `createCharge` REUSA a cobrança PENDING válida e do mesmo dono (`convex/functions/payment/charge.ts:203-213`, com o gate `findPendingChargeForSource` em `:132-143`); fora disso, `resolveSourceForCharge` recusa membership não cobrável com `BAD_REQUEST` "Esta solicitacao nao esta aguardando pagamento." (`:683-691`) e ownership (`:642-651`). |

O caminho pago do torneio (`pay_tournament_entry`) tem o mesmo desenho:
`resolveTournamentEntrySource` (`convex/functions/payment/charge.ts:721`) exige
`status === "awaiting_payment"` (gate em `:746`).

**Decisão de produto:** `tournament.entry.confirmed` sai **informativo** mesmo
quando o `metadata` traz `chargeId`. Esse evento é pós-pagamento — o emissor
marca a inscrição `active` (`convex/functions/payment/charge.ts:1289`) e só
depois notifica (`:1304-1309`) — então um botão `Pagar` ali mentiria. O CTA de
pagar do torneio segue na pendência `player_tournament_entries_awaiting_payment`.

## A central (`notification.feed.list`)

- **Procedimento:** `list` (`convex/functions/notification/feed.ts:86`,
  `authQuery`) → `api.notification.feed.list`. Escrevem: `markRead` (`:115`),
  `markAllRead` (`:141`), `remove` (`:173`), `removeAll` (`:194`) — todos exigem
  `recipientUserId === ctx.userId` + ator ativo, senão `NOT_FOUND`
  (`getActiveActorNotificationOrThrow`, `feed.ts:63-84`).
- **Shape do item:** `notificationFeedItemSchema`
  (`convex/domains/notification/contract.ts:73-92`), 18 campos. O app decide a
  apresentação por `presentation`, `isRead`, `title`, `body` e `occurredAt`.
- **Escopo por ator:** a central é SEMPRE do ator ativo (jogador OU
  organização), nunca os dois juntos (`isNotificationForActiveActor`,
  `convex/domains/notification/feed-rules.ts:27-40`).
- **Ordem e cap:** índice `recipientUserId_actorKind_occurredAt` em
  `order("desc")` (`.order("desc")`, `convex/functions/notification/feed.ts:98`)
  → `.take(100)` (`:99`) → filtro por ator e descarte de linhas `retracted`
  (`:101-110`) → `.slice(0, limit ?? 50)` (`:111`). O default é
  `DEFAULT_FEED_LIMIT = 50` (`feed.ts:17`).
- **Sem sinal de saturação:** não há `truncated` nem cursor — acima de 100
  linhas por ator, o excedente simplesmente não aparece e nada avisa. O contraste
  é o `pendings.list`, que tem `truncated` e `saturation` (mudar isso é trabalho
  futuro, não regressão).
- **`unreadCount`** (badge da home e de Ajustes) vem de
  `notification.settings.status`, via `getActiveActorUnreadCount`
  (`convex/functions/notification/settings.ts:27-44`), com `.collect()` sem cap
  no índice `recipientUserId_actorKind_isRead`.

## Deliveries, push e retração

- **Envio:** `sendPending` (`orchestrator.ts:517`, action) →
  `claimPendingDeliveries` (`orchestrator.ts:369`) → `POST
  https://exp.host/--/api/v2/push/send` (constante `EXPO_PUSH_SEND_URL`,
  `orchestrator.ts:24`) → `markDeliveryResults` (`orchestrator.ts:463`).
- **Payload:** `{ body, channelId: "default", categoryId?, data: { ...feed.data,
  notificationId, recipientActorKind, recipientOrganizationId,
  recipientPlayerProfileId }, sound: "default", title, to }`
  (`orchestrator.ts:438-452`; o `categoryId` sai de
  `getNotificationPushCategoryId(feed.eventType)`, `:438`).
- **Categoria de push (botão no sistema):** só `league.membership.requested` tem
  categoria hoje (`NOTIFICATION_EVENT_CATEGORY_IDS`,
  `convex/shared/notifications/protocol.ts:64-69`), com `Aprovar`/`Recusar`
  registrados em `registerNotificationCategoriesAsync`
  (`src/lib/notifications/expo-notifications.ts:91-104`). Os outros 43 eventos
  chegam SEM botão no push; o item da central é que carrega ação.
  **A categoria por tipo é a Etapa 2.**
- **Estados:** `awaiting_delivery`, `in_progress`, `delivered`, `needs_retry`,
  `failed`, `maybe_delivered`, `unable_to_deliver` (`notificationDelivery`,
  `convex/domains/notification/tables.ts:135-157`), com até 5 tentativas
  (`MAX_RETRY_ATTEMPTS`).
- **Recuperação:** `sweepStaleInProgressDeliveries` (`orchestrator.ts:708`, cron
  `sweep-stale-deliveries` de 1 min) reseta `in_progress` órfão para
  `needs_retry`; é no-op fora de produção (`DEPLOY_ENV !== "production"`).
- **Retração:** `retractNotifications` (`orchestrator.ts:625`) marca
  `status: "retracted"` + `retractedAt` e derruba entregas pendentes. Usado antes
  de um evento que substitui outro: desafio cancelado/contraproposto
  (`_challenges/notifications.ts:57-67`) e lembrete de renovação do ciclo
  anterior (`retractMembershipRenewalReminders`, `payment/charge.ts:1564-1573`).
- **Lembrete de renovação reescrito no lugar:** `upsertRenewalReminder`
  (`payment/charge.ts:1585-1637`) reescreve a MESMA linha (corpo, `data`,
  `occurredAt`, `presentation` e título — o input compartilhado está em
  `:1603-1614` e o `set` da linha viva em `:1620-1631`) enquanto o ciclo não
  muda, para o texto seguir os dias restantes sem gerar um push por dia.

## Preferências e devices

- `notification.settings.status` (`authQuery`), `setPreference` e `upsertDevice`
  (`authMutation`) em `convex/functions/notification/settings.ts`.
- **Prontidão de push** (`resolvePushReadiness`,
  `convex/domains/notification/state.ts:24-42`): `preference_disabled` →
  `permission_denied` → `permission_undetermined` → `missing_device` → `ready`.
  O app mostra a razão no dialog de Preferências.
- Um device só recebe push com `permissionStatus === "granted"` e sem
  `disabledAt`, e só se a preferência do usuário estiver ligada.
- **Badge no ícone do app NÃO existe** (`shouldSetBadge: false` em
  `Notifications.setNotificationHandler`,
  `src/lib/notifications/expo-notifications.ts:25-32`): a contagem de não lidas
  vive no app (home e Ajustes).

## O que NÃO entra na Etapa 1

- **Botão no push do sistema para os outros 43 eventos** (categoria por tipo):
  Etapa 2. Hoje o push entrega o texto e o toque abre a tela.
- **Sinal de saturação no feed** (`truncated`/cursor) e **paginação**: a central
  corta em 100/50 sem avisar.
- **Badge no ícone do app** e **notificação in-app fora da central**.
- **Agrupamento/filtro/busca na central** e **desfazer remoção**.
- **Evento de pagamento do torneio** (`tournament.entry.awaiting_payment` e
  afins não existem): o PIX do torneio aparece só como pendência e no checkout.

## Decisões e apontamentos

- **A ação mora no servidor.** O cliente não tem mapa `eventType` → handler; ele
  traduz `action.type` (o MESMO enum das pendências) para a mutation viva, no
  tradutor único `resolvePendingAction`
  (`src/lib/pendings/pendings-view.ts:87-195`) e executa pelo runner
  `src/lib/pendings/use-pending-action-runner.ts`. Evidência de que isso já
  funciona: o tradutor cobre os 14 tipos em DEV (validado no `function-spec`).
- **Botão só onde há gate**: o critério de entrada de um tipo no mapa é existir
  mutation viva + recusa do estado já resolvido. Desfecho não ganha botão.
- **`tournament.entry.confirmed` informativo** (ver "Gates de estado").
- **O `presentation` é derivado, não editado à mão:** nasce no ponto único de
  criação e é recalculado quando a linha é reescrita (lembrete de renovação).
  Nenhum outro caminho escreve o campo.
- **Divergência conhecida (fora deste corte):**
  `tournament.bracket.placement_failed` tem texto de ORGANIZADOR
  (body/título do definition, `definitions.ts:351-352`) mas NÃO está em
  `ORGANIZER_RECIPIENT_EVENTS` (`orchestrator.ts:122`): o destinatário é
  resolvido como jogador e o aviso é descartado quando o manager não tem perfil
  de jogador. A correção é o evento entrar na allowlist (mudaria o ator da
  linha) e fica para um corte próprio.
- **Divergência conhecida (fora deste corte):**
  `league.challenge.result_reminder_requested` não tem deduplicação — duas
  chamadas no mesmo dia geram duas linhas e dois pushes
  (`organizerRequestResultReminder`, `convex/functions/league/challenges.ts:2014-2081`).
- **`recipientRole` é campo morto:** declarado em `definitions.ts:27` e passado
  em `orchestrator.ts:300`, mas nenhum template o lê. Jogador e organizador
  recebem o mesmo texto para o mesmo evento; o que muda é quem recebe.
