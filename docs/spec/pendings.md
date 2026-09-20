# Pendencias e alertas — Estado atual

> Verificado em 20-09-2026 contra o código do repo (`convex/`) e o DEV
> (kindred-yak-142, function-spec + sonda read-only). **EM ANDAMENTO (sem
> commit):** a Etapa 1 entrega o CONTRATO de leitura — nada está ligado em tela
> ainda (o wiring é a Etapa 2, com o Frontend).

## Visão geral

Um sistema único de pendências/alertas para todas as superfícies do app: o item
nasce no SERVIDOR (kind + copy + destaque + ordem + rota) e a tela só renderiza.
O desenho substitui o que hoje existe espalhado — builders no cliente
(`lib/leagues/league-details-derived.ts`, `lib/tournaments/*-derived.ts`), oito
usos do `WidgetAlert` em cinco telas e a regra de "quem deve a ação" duplicada
entre backend e cliente — pelo padrão: **fonte de dado única por escopo no
servidor + um componente único de apresentação no app** (PLN-0008).

A Etapa 1 cobre o contrato (uma query por escopo) e é a fonte da verdade do
shape. O **shape visual está aprovado pelo usuário** na galeria dev do app
(`AlertsVariantsSection`, 16 cartões, IBX-0076 r1–r6): os kinds abaixo são
1:1 com os cartões aprovados 1 a 14, e a copy é literal deles.

## Contrato — `pendings.list`

- **Procedimento:** `convex/functions/pendings/list.ts` (`authQuery`) → no
  cliente, `api.pendings.list.list` (módulo `pendings`, arquivo `list`, função
  `list`). Sem tabela nova, sem migration, sem cron.
- **Input:** `{ scope: "organization" | "player" }` (raiz `z.object`).
- **Output:** `{ counts, items, saturation, scope, truncated }`
  (`pendingsListResultSchema`, `convex/domains/pendings/contract.ts`).

### O item (`pendingItemSchema`)

| Campo | Regra |
|---|---|
| `id` | Determinístico: `<kind>:<sourceId>` (`buildPendingItemId`). É a identidade/key do item na lista. |
| `kind` | Enum FECHADO que cresce por ADIÇÃO (14 kinds na v1). Primeiro segmento = quem deve a ação (`player`/`organization`), depois domínio + pendência. `PENDING_KIND_SCOPES` (contrato) é o único lugar que decide o escopo de cada kind. |
| `domain` | Domínio dono da REGRA: `league`, `payment`, `tournament` — `player` existe no enum (shape aprovado) e não tem kind na v1. |
| `severity` | `danger` \| `warning` \| `info`. O componente do app não tem `info`: o cliente mapeia `info` para `accent` do alerta, como na galeria (cartões 5, 6, 7 e 11). |
| `title` | Sempre presente (regra aprovada: todo alerta tem título E descrição). Frase única, com a contagem no plural quando agrega. |
| `description` | `string` (quando a copy real do app já é uma frase) OU **LINHAS de PARTES**: `{ parts: { text, isHighlighted? }[] }[]`. Quem decide o destaque e a quebra por linha é o SERVIDOR. Agregado usa UMA LINHA POR TIPO — nunca separador no meio da frase. |
| `actionLabel` | CTA principal, **UMA palavra**, ou `null` (pendência sem ação). É a COPY do botão. |
| `action` | **Como o cliente EXECUTA o CTA**: `{ type, params }` ou `null`. `type` é enum FECHADO que cresce por adição (`open_route`, `pay_league_membership`, `pay_tournament_entry`, `accept_partner_invite`, `decline_partner_invite`); `params` carrega o que a ação precisa além do `source`/`route`. Ver "Ação executável" abaixo. |
| `secondaryActionLabel` | Rótulo da ação de menor hierarquia (rodapé do alerta, antes da principal), também de uma palavra. Só o convite recebido tem duas ações (`Recusar` + `Aceitar`). |
| `secondaryAction` | Ação executável do CTA secundário (mesmo shape de `action`); `null` quando não há segundo botão. |
| `route` + `params` | Deep-link no molde dos CTAs vivos dos alertas (`router.navigate({ pathname, params })`): o pathname do expo-router (`/leagues/[leagueId]/challenges`) + os params (`{ leagueId }`, `{ mode: "edit", leagueId }`, `{ initialTab: "pending", tournamentId }`). Eles são o **destino** quando `action.type = "open_route"` (aí são obrigatórios) e podem ser **contexto da entidade** nos demais casos (o recorte da casa lê o `params`, ex.: `tournamentId`); o **alvo** de uma mutação nunca mora aqui — mora em `action.params` ou no `source`. |
| `count` | Quantos casos o item agrega (`null` quando é um caso só). O título usa a MESMA contagem. |
| `deadlineAt` | Epoch ms do prazo que decide a ação (vencimento, fim de inscrição, instante da penalidade) ou `null`. |
| `moneyCents` | Dinheiro envolvido em centavos ou `null`. |
| `source` | Entidade de origem (`{ type, id }`): `league`, `league_membership`, `organization`, `tournament`, `tournament_entry`. `payment_charge` NÃO está no enum hoje: entra quando o kind que aponta para uma cobrança existir (é o caso (b) em "O que NÃO entra na v1"), no mesmo passo tipo → enum → registro. |

**Destaque (regra aprovada):** no máximo UM por linha, sempre a palavra-chave
que identifica a pendência (nome de pessoa, categoria, competição, valor,
prazo, ou a expressão número + objeto), nunca número solto nem palavra
genérica.

### Ação executável (por kind)

O rótulo diz o que a tela MOSTRA; o `action.type` diz o que o cliente FAZ — sem
mapa `kind` → handler espalhado nas telas e sem adivinhar:

| `action.type` | O que o cliente executa | Kinds |
|---|---|---|
| `open_route` | `router.navigate({ pathname: route, params })` (destino no item) | 8, 10, 11, 12, 13 e o agregado de 4 com mais de uma inscrição |
| `pay_league_membership` | `createCharge({ sourceType: "league_membership", sourceId: source.id })` e abrir o checkout | 1, 2 (`Pagar` e `Renovar` são a MESMA ação; o rótulo é que difere) |
| `pay_tournament_entry` | `createCharge({ sourceType: "tournament_entry", sourceId: action.params.entryId })` e abrir o checkout | 4 com **uma** inscrição (`action.params.entryId`) |
| `accept_partner_invite` | `respondPartnerInvite({ entryId: action.params.entryId, accept: true })` | 5 (`Aceitar`) |
| `decline_partner_invite` | `respondPartnerInvite({ entryId: action.params.entryId, accept: false })` | 5 (`Recusar`, no `secondaryAction`) |

Invariantes (cobertas por teste):

1. **Todo kind tem ação declarada** — ou uma ação executável, ou `null` com os
   rótulos nulos (kinds 3, 6, 7, 9 e 14 não têm CTA).
2. **`open_route` sempre tem destino** (`route` + `params` do ITEM não nulos) e
   nunca carrega `action.params`: para navegação pura o destino é o par do item.
3. **Ação de mutação nunca depende de `route`/`params`** — o ALVO vive em
   `action.params` (o `entryId` da inscrição a pagar/responder) ou no próprio
   `source` (`pay_league_membership`, cujo alvo é a membership do item). O item
   PODE carregar `route` + `params` como **CONTEXTO da entidade**: é o que o
   recorte da tela lê para decidir em qual casa o item aparece (ex.: o convite
   carrega `/tournaments/[tournamentId]` + `{ tournamentId }` e a mutação
   ignora esse par). O que este invariante PROÍBE é mutação cujo único alvo
   esteja em `route`/`params` — o cliente nunca navega por eles nesse caso.
4. **O agregado de 4 decide pela contagem**: com UMA inscrição a ação paga
   aquela inscrição (`pay_tournament_entry`); com mais de uma não existe
   pagamento único (a taxa é por categoria), então a ação abre a casa do torneio
   (`open_route`), onde cada inscrição tem o seu `Pagar`. Quem decide é o
   servidor, não a tela.

### Ordem, cap e contagens

- **Ordem determinista** (`sortPendingItems`): `severity` (danger → warning →
  info) → `deadlineAt` ascendente (**null por último**) → `moneyCents`
  descendente → `id` ascendente (desempate estável).
- **Cap:** `PENDING_ITEM_CAP = 20` itens (`pendings-rules.ts`). O cap corta
  DEPOIS da ordenação, e `truncated` diz que houve corte.
- **Contagens:** `counts.bySeverity`, `counts.byDomain` e `counts.total` são
  derivados do MESMO array devolvido (`buildPendingsResult`) — o badge nunca
  mente sobre o que a LISTA mostra (a ressalva fica para os caps de LEITURA,
  abaixo).
- **Saturação:** `saturation` lista os kinds cuja LEITURA encheu o cap
  (`{ kind, limit }`, um por kind, com o menor cap que cortou). É o aviso de que
  o item/contagem daquele kind pode estar **subestimado** (o título de um
  agregado nunca deve ser lido como total quando o kind aparece ali). `truncated`
  e `saturation` são coisas diferentes: o primeiro é o corte da LISTA no cap de
  20 itens; o segundo, o corte de uma varredura que alimenta o dado.

### Autorização (invariante)

- O ator ativo é resolvido **no servidor** (nunca vem por input), pela porta
  tolerante `findViewerActiveActor` (`convex/functions/viewer/context.ts`) —
  `null` em vez de erro quando a conta não tem perfil de jogador nem
  organização ativa.
- Escopo que não pertence ao ator devolve **`items: []` — nunca erro**:
  organização não recebe pendência de jogador e vice-versa. A guarda mora nos
  derivadores (`registry.ts`), que só rodam no seu próprio escopo; conta sem
  ator nenhum também recebe vazio.
- Chamada anônima continua rejeitada (`UNAUTHORIZED`): o procedimento é
  `authQuery` (provado no DEV).
- Nenhum dado de terceiro entra: cada item carrega só o que a tela equivalente
  já mostra (nome de quem convidou/convidado, categoria, competição, valor,
  prazo, contagem).

## Kinds da v1 (1:1 com os cartões aprovados)

| # | kind | Escopo | Domínio | Severidade | Título (copy aprovada) | CTA | Rota |
|---|---|---|---|---|---|---|---|
| 1 | `player_league_membership_payment_due` | player | payment | warning | Pagamento atrasado | Pagar | — (ação: gerar PIX) |
| 2 | `player_league_membership_payment_due_soon` | player | payment | warning | Mensalidade vence hoje/amanhã/em N dias | Renovar | — (ação: gerar PIX) |
| 3 | `player_league_membership_suspended` | player | payment | danger | Inscrição suspensa | — | — (o CTA do estado é o `Renovar inscrição` do RODAPÉ da liga) |
| 4 | `player_tournament_entries_awaiting_payment` | player | tournament | warning | N inscrição(ões) aguardando pagamento | Pagar | uma inscrição: — (o destino é a ação); 2 ou mais: `/tournaments/[tournamentId]` + `tournamentId` |
| 5 | `player_tournament_partner_invite_received` | player | tournament | info | Convite de dupla aguardando sua resposta | Aceitar (+ Recusar) | `/tournaments/[tournamentId]` + `tournamentId` (contexto; o alvo da resposta é a inscrição) |
| 6 | `player_tournament_partner_invite_sent` | player | tournament | info | Convite de dupla enviado | — | `/tournaments/[tournamentId]` + `tournamentId` (contexto) |
| 7 | `player_tournament_entry_awaiting_approval` | player | tournament | info | Inscrição aguardando aprovação | — | `/tournaments/[tournamentId]` + `tournamentId` (contexto) |
| 8 | `player_league_challenges_pending_actions` | player | league | warning | N desafio(s) precisando de atenção | Ver | `/leagues/[leagueId]/challenges` + `leagueId` |
| 9 | `player_league_inactivity_risk` | player | league | warning/danger | Risco de queda por inatividade / Você está inativo | — | — |
| 10 | `organization_league_payment_account_missing` | organization | payment | warning | Conta de pagamento não conectada | Conectar | `/settings/leagues/[mode]/settings` + `mode: "edit"`, `leagueId` |
| 11 | `organization_tournament_entries_awaiting_approval` | organization | tournament | info | N inscrição(ões) aguardando aprovação | Ver | `/tournaments/[tournamentId]/entries` + `initialTab: "pending"`, `tournamentId` |
| 12 | `organization_tournament_entries_awaiting_payment` | organization | tournament | warning | N inscrição(ões) aguardando pagamento | Ver | idem 11 |
| 13 | `organization_league_join_requests` | organization | league | warning | N solicitação(ões) de entrada | Revisar | `/leagues/[leagueId]/requests` + `leagueId` |
| 14 | `organization_league_challenges_awaiting_validation` | organization | league | warning | N desafio(s) esperando sua validação | — | — |

**Como cada item agrega (e por quê):**

- **4 · 11 · 12 — por TORNEIO.** O título pluraliza pela contagem, como a tela
  já faz hoje. A 4 conta só as inscrições do lado A do viewer (quem paga, o
  gate `canPay` da casa do jogador); a 11/12 varrem as inscrições dos torneios
  da organização.
- **5 · 6 · 7 — por INSCRIÇÃO.** A copy nomeia pessoa/categoria/competição, que
  são dados da inscrição — agregar perderia o dado. Exigem o NOME disponível
  (sem ele não há como escrever o destaque e o item não é emitido).
- **8 — por LIGA**, com uma linha por tipo de pendência de resultado
  (`N resultados para registrar` / `para confirmar` / `para corrigir`).
- **9 — por MEMBERSHIP** (a penalidade é do membro na liga).
- **13 — por LIGA** (o CTA precisa do destino da liga).
- **14 — pela ORGANIZAÇÃO** (soma as ligas): não tem CTA nem rota — um item por
  liga repetiria a mesma frase sem destino, e a decisão do organizador acontece
  na tela do desafio, que ainda não tem destino único a partir do alerta.
- **1 · 2 · 3 — por MEMBERSHIP**; **10 — por LIGA PAGA** (a conta é da
  organização, mas quem não consegue cobrar é a liga com mensalidade).

## Como é derivado

- **Regras puras por domínio** (dado → item, sem ctx, testáveis isoladas — molde
  de `domains/league/challenge-status.ts`):
  - `convex/domains/payment/pendings-rules.ts` — mensalidade (1, 2, 3) e conta
    de pagamento (10), com o rótulo pt-BR do vencimento no calendário do Brasil
    (UTC-3, sem ICU) e a janela de lembrete reusando `shouldSendRenewalReminder`.
  - `convex/domains/tournament/pendings-rules.ts` — inscrições do jogador (4, 5,
    6, 7) e do organizador (11, 12).
  - `convex/domains/league/pendings-rules.ts` — desafios com atenção (8, 14),
    solicitações de entrada (13) e inatividade (9).
  - `convex/domains/pendings/pendings-rules.ts` — o que é comum: identidade,
    ordem, cap, contagens, concordância de número, partes/linhas.
- **Registro + leitura:** `convex/domains/pendings/registry.ts` monta os
  derivadores por escopo (`PENDING_DERIVERS`), lê o mínimo com `ctx.orm` e
  fecha o resultado em `collectPendings`. Todo kind é declarado pelo derivador
  que o emite e a **completude é auditada por teste** (união dos declarados =
  kinds do escopo, sem duplicata; cada kind no escopo que o contrato registrou).
  Se um item sair no escopo errado, a query **falha** (erro explícito) em vez de
  mostrar pendência no escopo errado.
- **Fonte única dos desafios:** o status usado é o EFETIVO
  (`computeEffectiveChallengeStatus`, `functions/league/_challenges/`), então um
  jogo cujo fim passou sem placar já conta como pendência de resultado, como na
  lista que a tela recebe. Os conjuntos de atenção do organizador continuam
  vindo de `domains/league/challenge-status.ts`: a v1 os PARTE em duas linhas
  (`ORGANIZER_ATTENTION_VALIDATION_STATUSES` para resultado +
  `ORGANIZER_ATTENTION_PROPOSAL_STATUSES` para proposta) com **paridade testada**
  contra o set do servidor.

## Limites e caps declarados

Nenhum scan ilimitado; os limites são os do padrão já shipado
(`functions/player/dashboard.ts`), todos no cabeçalho de `registry.ts`. Todo
lote por id (`in`) é dimensionado pela PRÓPRIA lista de ids (nunca um cap menor
que o lote), e toda varredura com `orderBy` explícito — sem ordem definida, qual
linha fica de fora depende da ordem interna do índice.

| Leitura | Cap que corta | Sinal de saturação |
|---|---|---|
| Memberships do jogador por status (active/payment_due/suspended) | 20 cada | kinds de 1, 2, 3, 8 e 9 |
| Desafios por lado/membership (atenção + `confirmed`) | 200 | 8 |
| Desafios `finished` por lado/membership (só ligas com penalidade) | 200 | 9 |
| Inscrições de torneio por lado (jogador) | 100 | 4, 5, 6 e 7 |
| Categorias/torneios/perfis do jogador (lote `in`) | tamanho da lista de ids | não corta |
| **Ligas lidas de uma vez** (organização: as da organização; jogador: as das memberships já lidas) | 50 (organização) / tamanho do lote (jogador) | 10, 13 e 14 (organização) |
| Solicitações de entrada por liga | 100 | 13 |
| Desafios por liga (organização) | 300 | 14 |
| Torneios da organização lidos / varridos por inscrição | 50 / 20 (mais recentes) | 11 e 12 |
| Categorias por torneio / inscrições por categoria | 10 / 300 | 11 e 12 |
| Itens devolvidos (`PENDING_ITEM_CAP`) | 20 | `truncated` |

**Leitura da tabela:** o cap da terceira coluna é onde a varredura para; quando
ela ENCHE, o kind da quarta coluna aparece em `saturation` — ou seja, o número
daquele item pode ser menor que o real. Um escopo com muitos membros/torneios
(acima de 20 ligas, 20 torneios ou 300 inscrições numa categoria) é justamente
onde a leitura trunca: o dado segue honesto porque o aviso vem junto.

**Não há índice de `tournamentEntry` por jogador** (`playerAId`/`playerBId`
isolados): a leitura é o scan limitado do mesmo padrão pré-existente
(`tournament.discovery.listParticipating`, decisão do IBX-0071) — índice
próprio é trabalho futuro (exige migration, fora deste corte).

## O que NÃO entra na v1

- **Dispensar/silenciar pendência** (`dismiss`/`snooze`) e **ação executável
  dentro do item**: o item é leitura + CTA de navegação/ação da tela; nada de
  esconder pendência nem de mutação a partir do alerta.
- **Push nativo, badge fora do app e e-mail**: fora do escopo do PLN-0008.
- **Cobranças em atraso da ORGANIZAÇÃO** (membros `payment_due`/`suspended` nas
  ligas pagas, hoje o `metrics.overdueCount` da home da organização) e
  **PIX/charge pendente ou expirado do JOGADOR** (o estado `awaiting_payment` da
  membership e a cobrança PENDING/EXPIRED): **não têm cartão aprovado na
  galeria** e a regra do processo é não inventar frase por analogia — os dois
  ficam como GAP DE COPY para um round 2 da galeria. Evidência do buraco no DEV:
  a membership `n97ef6kqw5fsgvc9ng0hrddg7s8b3avs` (`awaiting_payment`) não gera
  nenhum item hoje.
- **Cartão 15 ("4 confrontos sem agendamento")**: a própria galeria registra
  que "qual confronto conta como pendência ainda não tem regra" — sem regra, sem
  kind.
- **Receita da organização, estornos e saques** como pendência: não existem
  cartões aprovados para eles.
- **Índice novo de `tournamentEntry` por jogador** (follow-up declarado).

### Notas de fiação (Etapa 2, Frontend)

- Nada consome a query ainda. O `WidgetAlert` já aceita o shape
  (`ui/widget-alert.tsx`: `WidgetAlertDescriptionLine`/`Part` são os mesmos
  tipos do contrato) — o cliente mapeia `severity: info` → `status="accent"`,
  renderiza `actionLabel`/`secondaryActionLabel` como os botões e **executa
  `action`/`secondaryAction`** (nada de mapa `kind` → handler na tela). Ou seja:
  `pay_league_membership` vira `createCharge` na membership do `source`,
  `pay_tournament_entry` vira `createCharge` na inscrição de
  `action.params.entryId`, `accept_partner_invite`/`decline_partner_invite`
  viram `respondPartnerInvite` e `open_route` abre `route` com os `params` DO
  ITEM (o destino é o par do item — o `action` não carrega params nesse caso).
- Os builders derivados duplicados no cliente (`buildLeaguePaymentAlert`,
  `buildPlayerPendingActionsAlert`, `buildPlayerInactiveAlertCard`,
  `buildTournament*Alert` e o `isParticipantAttention` de
  `challenge-tab-counts.ts`) passam a ser APAGADOS quando as telas consumirem o
  servidor — é o cutover obrigatório do PLN-0008 (senão vira a terceira cópia
  da regra).

## Decisões e apontamentos

- **A ação é EXPLÍCITA no contrato (revisão da Etapa 1).** Antes, o cliente
  que fizesse o óbvio (`actionLabel` → `router.navigate(route)`) produzia botão
  morto em 1, 2, 3 (o CTA é mutação de cobrança e vinha com `route` nulo) e
  navegação sem pagamento em 4 (`route` apontava a casa do torneio). O campo
  `action` fecha isso: cada CTA diz o que executa e com quais params.
- **`Pagar` e `Renovar` são a MESMA ação** (`pay_league_membership`): o que muda
  entre os cartões 1, 2 e 3 é a copy do rótulo, não o que o app faz (gerar a
  cobrança da membership e abrir o checkout). Um `renew_*` separado seria
  vocabulário sem comportamento por trás.
- **Convite nomeia a pessoa pela cadeia de nomes do app** (revisão da Etapa 1):
  o item nunca mais deixa de nascer por o perfil convidante não ter `fullName` —
  `buildPlayerProfileDisplayName` (`convex/domains/player/identity.ts`) resolve
  `fullName` → `nickname` → nome da conta → `Jogador#NNNN` (o fallback que o app
  já exibe), com o `username` fora da conta (não é nome, e o convite já nasce por
  `username`). O builder mantém a guarda de nome vazio como DEFESA: com nome
  vazio ele não monta a frase (o cartão 5 destaca o nome e uma frase sem ele
  ficaria quebrada) — caminho que o derivador não alcança mais.
- **O suspenso (kind 3) não tem CTA** (revisão da Etapa 1): no MESMO estado a
  página mantém o rodapé de entrada habilitado com `Renovar inscrição`, e dois
  botões de pagamento para a mesma membership na mesma tela é o BUG-0042. O
  alerta só INFORMA; a ação do estado é o rodapé (decisão de 20-09).
- **O convite recebido (cartão 5) ficou sem `route`**: responder o convite é
  mutação (`accept_partner_invite` / `decline_partner_invite`) e a tela real
  responde no lugar — route nulo é o contrato, não uma perda.
- **Severidade do convite recebido (cartão 5) é `info`.** O despacho da Etapa 1
  descrevia "warning com ação" para o convidado, mas o cartão APROVADO usa o
  status real `accent` (a nota do próprio cartão registra "o pedido citava
  warning" e a marcação do usuário decide). Vale o aprovado: `info` para os dois
  lados do convite, com a diferença no CTA (convidado age, criador não).
- **`player_league_inactivity_risk` tem duas severidades** porque o app já tem
  as duas cópias reais (warning "Faltam N dias" / danger "Você está inativo");
  é o único kind com essa variação.
- **Mensalidade em `awaiting_payment` não gera item** (a v1 só cobre
  `payment_due`, janela de lembrete do `active` e `suspended`, as três cópias
  reais). O estado é justamente o GAP de copy acima.
- **Mensalidade só resolve vencimento em liga paga** (`monthlyPriceCents > 0`):
  liga gratuita não tem ciclo de cobrança, então nenhuma consulta de charge é
  feita para ela.
- **Torneio encerrado ou cancelado não gera pendência de inscrição** no escopo
  da organização (não há mais ação possível); a tela do torneio continua
  mostrando o bucket dela.
- **A porta tolerante do ator é nova** (`findViewerActiveActor`): o
  `getViewerContext` (estrito, `NOT_FOUND` sem perfil de jogador) segue
  intocado nas telas; a leitura de pendências usa a porta que devolve `null` —
  sem duplicar a resolução de ator ativo.
- **Escopo da ORGANIZAÇÃO exige manager ativo** (`resolvePendingsActor`,
  `registry.ts`): um `member` puro (ou ator de organização sem papel) recebe
  `items: []`, o MESMO gate das leituras equivalentes (`requireActiveManager`, a
  aba Solicitações e o valor da mensalidade no ajuste da liga) — sem isso o
  alerta devolveria contagem/ids que as telas escondem dele.
- **Nome do procedimento:** o caminho do arquivo manda (`pendings/list.ts`), então
  o cliente chama `api.pendings.list.list` — convenção `módulo.arquivo.função`
  do repo, não um nome novo.
- **Nenhum dado novo é criado:** o kind 4 e o 12 foram provados no DEV com a
  MESMA inscrição (`rd714y595ax7zp5xy3gbpb2grs8erhda`, Copa Vila Tênis Clube,
  R$ 5,00) vista pelos dois lados — jogador ("1 inscrição aguardando pagamento"
  + `Pagar`) e organização ("1 inscrição aguardando pagamento" + `Ver`).
