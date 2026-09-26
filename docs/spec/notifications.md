# Notificações — Estado atual

> Verificado em 25-09-2026 contra o código do repo (`convex/`, `src/`).
>
> As referências abaixo citam o **símbolo** sempre que o arquivo é do domínio de
> notificação (o número da linha acompanha como atalho): este é o corte que mais
> mexe nesses arquivos, e o símbolo não drifta.

## Visão geral

Um subsistema único de notificação para o app inteiro, com três peças:

1. **O evento** (`eventType`): 16 tipos catalogados em `NOTIFICATION_EVENT_TYPES`
   (`convex/shared/notifications/protocol.ts:1-18`), cada um com template pt-BR
   próprio no mapa `definitions`
   (`convex/domains/notification/definitions.ts:41-158`).
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
(`convex/functions/notification/orchestrator.ts:232`) — o **único**
`insert("notificationFeed")` do repo (mesmo arquivo, `:274`). Nenhum emissor
escreve na tabela direto.

- **Input:** `createForRecipientsSchema` (`orchestrator.ts:44-54`):
  `{ actorUserId, eventType, tournamentId, metadata?, recipientUserIds (min 1),
  sourceEntityId?, sourceEntityType? }`; o torneio de origem é obrigatório
  (`:53`).
- **Fonte:** `resolveNotificationSource` (`orchestrator.ts:115`) lê o torneio e
  guarda `{ id, name, organizationId }`.
- **Ator:** `getActorName` (`orchestrator.ts:83`) resolve
  `playerProfile.nickname` → `playerProfile.fullName` → `user.name`. Sem ator, o
  template cai no genérico `Um jogador`.
- **Destinatário:** `resolveRecipientActor` (`orchestrator.ts:131`). O evento
  decide o KIND do ator: `ORGANIZER_RECIPIENT_EVENTS` (`orchestrator.ts:101`) tem
  **um** evento (`tournament.entry.created`), que nasce no ator **organização**;
  todo o resto nasce no ator **jogador** e é **descartado em silêncio** quando o
  usuário destinatário não tem `playerProfile` (`orchestrator.ts:150` devolve
  `null` → `:254-256` pula o destinatário).
- **Conteúdo e apresentação:** `buildNotificationContent`
  (`definitions.ts:161`) e `buildNotificationPresentation` (`presentation.ts`)
  recebem o MESMO input (`orchestrator.ts:258-268`), então corpo e botão nunca
  divergem.
- **`data` publicado:** `{ ...metadata, eventType, tournamentId?, url }`
  (bloco `data` de `buildNotificationContent`, `definitions.ts:172-177`).
  `sourceEntityId`/`sourceEntityType` **não** entram no `data` (ficam na linha da
  tabela).
- **Push:** lê `notificationPreference` (pula se `pushEnabled` é falso,
  `orchestrator.ts:291-297`), lê até 100 `notificationDevice` e filtra
  `!disabledAt && permissionStatus === "granted"` (`:299-305`); insere uma
  `notificationDelivery` `awaiting_delivery` por device (`:307-315`).

### Emissores (quem chama)

| Wrapper | Onde | Usado por |
|---|---|---|
| `scheduleTournamentNotification` | `convex/functions/tournament/_shared/guards.ts:149` | todo o torneio: inscrições, chave, partidas, colocação e ciclo de vida |
| `scheduler.runAfter` cru | `convex/functions/payment/charge.ts:727` (estorno por categoria cheia) e `:759` (confirmação paga) | ativação paga da inscrição |

Toda emissão é **diferida** (`ctx.scheduler.runAfter(0, ...)`), inclusive as que
já rodam em cron/webhook. Crons que emitem: `reconcile-charges`
(`convex/functions/crons.ts:19-24`, via `applyPaidCharge` →
`applyPaidTournamentEntryCharge`) e `auto-start-tournaments` (`crons.ts:68-73`).

## Apresentação acionável (`presentation`)

Campo **nullable** na tabela `notificationFeed` (coluna `presentation` em
`convex/domains/notification/tables.ts:64`), aditivo e sem migration: linha antiga
(ou evento informativo) chega `presentation: null` e a tela desenha o cartão sem
ação. No app esses rótulos são ITENS DO MENU ⋮ do cartão da central, não botões
no corpo (rodada 2 do IBX-0077, `docs/spec/dashboard.md` → "TODA AÇÃO NO MENU ⋮"):
`presentation: null` = cartão sem item de ação, e o menu segue com o item
destrutivo. Schema: `notificationPresentationSchema`
(`convex/domains/notification/contract.ts:51-66`); o item do feed expõe o campo
em `notificationFeedItemSchema`
(`convex/domains/notification/contract.ts:68-87`, campo em `:76`).

| Subcampo | Regra |
|---|---|
| `action` | **Como o cliente EXECUTA** o botão principal: `{ type, params }` ou `null`. Reusa o MESMO schema e o MESMO enum das pendências (`pendingActionSchema`, `convex/domains/pendings/contract.ts:103-106`) — um só vocabulário de ação no repo. |
| `actionLabel` | Copy do botão, pt-BR, **uma palavra** (`Aprovar`, `Recusar`, `Aceitar`). |
| `secondaryAction` | Ação executável do botão secundário (mesmo shape), ou `null`. |
| `secondaryActionLabel` | Copy do secundário, ou `null`. |
| `bodyHighlights` | Trechos **literais** do `body` que vão em negrito (pode ser vazio). Derivados do PRÓPRIO corpo renderizado, comparando sem caixa: o servidor só marca palavra que o texto mostra (ver `findActorNameInBody`, `presentation.ts:123`). |

**Quem decide:** `buildNotificationPresentation`
(`convex/domains/notification/presentation.ts`), módulo **puro** (molde de
`definitions.ts`), com o mapa declarativo `EVENT_PRESENTATION_BUILDERS` — um
lugar só. A galeria dev do app importa a MESMA função para montar os cartões com
os rótulos reais, sem copiar copy.

**Sem o id, sem botão:** quando o emissor não manda o id que a mutation exige, o
builder devolve `null` (item vira informativo). Nunca nasce botão morto.

### Mapa evento → ação (2 tipos)

| `eventType` | Papel | Botões | `action.type` | `action.params` |
|---|---|---|---|---|
| `tournament.entry.created` | organizador | Aprovar · Recusar | `approve_tournament_entry` · `reject_tournament_entry` | `{ entryId }` |
| `tournament.partner.invited` | jogador | Aceitar · Recusar | `accept_partner_invite` · `decline_partner_invite` | `{ entryId }` |

Os outros 14 eventos são **informativos** (`presentation: null`).

**Enum de ação:** `PENDING_ACTION_TYPE_OPTIONS`
(`convex/domains/pendings/contract.ts:58-65`) — FECHADO e **crescente por
adição**, 6 tipos: `open_route`, `pay_tournament_entry`, `accept_partner_invite`,
`decline_partner_invite`, `approve_tournament_entry`, `reject_tournament_entry`.
A notificação usa os quatro últimos. Pares de ida e volta são tipos SEPARADOS,
nunca um booleano em `params` (que é `Record<string, string>`).

### Destaque (`bodyHighlights`)

Regra: o **nome do ator** entra em negrito somente quando o corpo realmente cita
esse nome — o dado que o destinatário precisa reconhecer para decidir, a mesma
régua dos cartões aprovados na galeria de Alertas (IBX-0076). O trecho destacado
é o que o CORPO mostra (`findActorNameInBody`, `presentation.ts`), com comparação
sem caixa: um template que formate o nome diferente da entrada continua gerando
negrito, e todo item de `bodyHighlights` é subtrecho literal do `body` por
construção. Ator ausente (o corpo cai em `Um jogador`) não gera destaque.

## Gates de estado (o botão nunca mente)

Notificação é **evento passado**, não pendência viva: o feed não recheca estado.
Por isso o botão só existe onde a mutation recusa o que já foi resolvido.

| Botão | Mutation | Gate |
|---|---|---|
| Aprovar / Recusar inscrição | `tournament.entries.approve` / `.reject` | `status !== "pending_approval"` → `BAD_REQUEST`, um gate por procedimento (`convex/functions/tournament/entries.ts:638-642` e `:686-690`). Já existia. |
| Aceitar / Recusar convite de dupla | `tournament.entries.respondPartnerInvite` | `status !== "pending_partner"` → `BAD_REQUEST` (`convex/functions/tournament/entries.ts:532-536`), dono do convite → `FORBIDDEN` (`:538-542`); no aceite ainda valida janela de inscrição (`:579`), duplicidade na categoria (`:582`) e capacidade (`:588`). Já existia. |

O caminho pago do torneio (`pay_tournament_entry`) tem o mesmo desenho:
`resolveSourceForCharge` (`convex/functions/payment/charge.ts:433`) delega a
`resolveTournamentEntrySource` (`:468`), que exige `status === "awaiting_payment"`
(gate em `:493`) e o dono da cobrança (`:482-492`).

**Decisão de produto:** `tournament.entry.confirmed` sai **informativo** mesmo
quando o `metadata` traz `chargeId`. Esse evento é pós-pagamento — o emissor
marca a inscrição `active` (`convex/functions/payment/charge.ts:743-746`) e só
depois notifica (`:759-771`) — então um botão `Pagar` ali mentiria. O CTA de
pagar do torneio segue na pendência `player_tournament_entries_awaiting_payment`.

## A central (`notification.feed.list`)

- **Procedimento:** `list` (`convex/functions/notification/feed.ts:86`,
  `authQuery`) → `api.notification.feed.list`. Escrevem: `markRead` (`:115`),
  `markAllRead` (`:141`), `remove` (`:173`), `removeAll` (`:194`) — todos exigem
  `recipientUserId === ctx.userId` + ator ativo, senão `NOT_FOUND`
  (`getActiveActorNotificationOrThrow`, `feed.ts:63-84`).
- **Shape do item:** `notificationFeedItemSchema`
  (`convex/domains/notification/contract.ts:68-87`), 18 campos. O app decide a
  apresentação por `presentation`, `isRead`, `title`, `body` e `occurredAt`.
- **Escopo por ator:** a central é SEMPRE do ator ativo (jogador OU
  organização), nunca os dois juntos (`isNotificationForActiveActor`,
  `convex/domains/notification/feed-rules.ts:27-40`).
- **Ordem e cap:** índice `recipientUserId_actorKind_occurredAt` em
  `order("desc")` (`.order("desc")`, `convex/functions/notification/feed.ts:98`)
  → `.take(100)` (`:99`) → filtro por ator e descarte de linhas `retracted`
  (`:100-110`) → `.slice(0, limit ?? 50)` (`:111`). O default é
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

- **Envio:** `sendPending` (`orchestrator.ts:474`, action) →
  `claimPendingDeliveries` (`orchestrator.ts:330`) → `POST
  https://exp.host/--/api/v2/push/send` (constante `EXPO_PUSH_SEND_URL`,
  `orchestrator.ts:23`) → `markDeliveryResults` (`orchestrator.ts:420`).
- **Payload:** `{ body, channelId: "default", data: { ...feed.data,
  notificationId, recipientActorKind, recipientOrganizationId,
  recipientPlayerProfileId }, sound: "default", title, to }`
  (`orchestrator.ts:400-413`).
- **Estados:** `awaiting_delivery`, `in_progress`, `delivered`, `needs_retry`,
  `failed`, `maybe_delivered`, `unable_to_deliver` (`notificationDelivery`,
  `convex/domains/notification/tables.ts:122-147`), com até 5 tentativas
  (`MAX_RETRY_ATTEMPTS`, `orchestrator.ts:25`).
- **Recuperação:** `sweepStaleInProgressDeliveries` (`orchestrator.ts:660`, cron
  `sweep-stale-deliveries` de 1 min, `convex/functions/crons.ts:26-31`) reseta
  `in_progress` órfão para `needs_retry`; é no-op fora de produção
  (`DEPLOY_ENV !== "production"`).
- **Retração:** `retractNotifications` (`orchestrator.ts:577`) marca
  `status: "retracted"` + `retractedAt` e derruba as entregas pendentes; aceita
  `eventTypes` (whitelist) e `exceptEventTypes` (blacklist). Sem chamador no
  código hoje.

## Preferências e devices

- `notification.settings.status` (`authQuery`), `setPreference` e `upsertDevice`
  (`authMutation`) em `convex/functions/notification/settings.ts:72`, `:107` e
  `:146`.
- **Prontidão de push** (`resolvePushReadiness`,
  `convex/domains/notification/state.ts:24-42`): `preference_disabled` →
  `permission_denied` → `permission_undetermined` → `missing_device` → `ready`.
  O app mostra a razão no dialog de Preferências.
- Um device só recebe push com `permissionStatus === "granted"` e sem
  `disabledAt`, e só se a preferência do usuário estiver ligada.
- **Badge no ícone do app NÃO existe** (`shouldSetBadge: false` em
  `Notifications.setNotificationHandler`,
  `src/lib/notifications/expo-notifications.ts:21-27`, campo em `:24`): a
  contagem de não lidas vive no app (home e Ajustes).

## O que NÃO entra hoje

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
  (`src/lib/pendings/pendings-view.ts:51-101`) e executa pelo runner
  `src/lib/pendings/use-pending-action-runner.ts`. Evidência de que isso já
  funciona: o tradutor cobre os 6 tipos do enum.
- **Botão só onde há gate**: o critério de entrada de um tipo no mapa é existir
  mutation viva + recusa do estado já resolvido. Desfecho não ganha botão.
- **`tournament.entry.confirmed` informativo** (ver "Gates de estado").
- **O `presentation` é derivado, não editado à mão:** nasce no ponto único de
  criação. Nenhum outro caminho escreve o campo.
- **Divergência conhecida (fora deste corte):**
  `tournament.bracket.placement_failed` tem texto de ORGANIZADOR
  (body/título do definition, `definitions.ts:45-46`) mas NÃO está em
  `ORGANIZER_RECIPIENT_EVENTS` (`orchestrator.ts:101`): o destinatário é
  resolvido como jogador e o aviso é descartado quando o manager não tem perfil
  de jogador. A correção é o evento entrar na allowlist (mudaria o ator da
  linha) e fica para um corte próprio.
- **`recipientRole` é campo morto:** declarado em `definitions.ts:17` e passado
  em `orchestrator.ts:262`, mas nenhum template o lê. Jogador e organizador
  recebem o mesmo texto para o mesmo evento; o que muda é quem recebe.
