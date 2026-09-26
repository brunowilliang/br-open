# Pendencias e alertas — Estado atual

> Verificado em 20-09-2026 contra o código do repo (`convex/`) e o DEV
> (kindred-yak-142, function-spec + sonda read-only). **IBX-0076 (Etapa 1 +
> Etapa 2 entregues, sem commit):** o contrato de leitura e o wiring nas telas
> estão no código — as duas homes montam o bloco de pendências e a casa do
> torneio lê o mesmo servidor pelo bucket.
>
> **IBX-0085 (21-09-2026, sem commit):** o sistema ganha a DISPENSA por
> superfície — tabela `pendingDismissal`, mutation `pendings.dismiss` e o
> parâmetro `surface` na leitura. Backend/estado estão no DEV (migration
> `20260921_191850_add_pending_dismissal` aplicada); o gesto na tela está no
> `ui/pending-alerts.tsx` (prop opt-in `dismissSurface`, `:68-79`) e nas duas
> homes (a casa do torneio lê sem `surface`).
>
> **26-09-2026:** entra o sétimo kind, `organization_tournament_awaiting_conclusion`
> (a conclusão do torneio é ato do organizador) — o primeiro kind de ESTADO, sem
> dispensa — e o app passa a ter paridade de CONSUMO com o catálogo do servidor.

## Visão geral

Um sistema único de pendências/alertas para todas as superfícies do app: o item
nasce no SERVIDOR (kind + copy + destaque + ordem + rota) e a tela só renderiza.
O desenho substitui o que existia espalhado — builders derivados no cliente
(`lib/tournaments/*-derived.ts`), usos diretos do `WidgetAlert` nas telas e a
regra de "quem deve a ação" duplicada entre backend e cliente — pelo padrão:
**fonte de dado única por escopo no servidor + um componente único de
apresentação no app** (PLN-0008).

A Etapa 1 cobre o contrato (uma query por escopo) e é a fonte da verdade do
shape. O **shape visual está aprovado pelo usuário** na galeria dev do app
(`AlertsVariantsSection`, 9 cartões, IBX-0076 r1–r6): os kinds com cartão na
galeria são 1:1 com os Alertas 4 a 7, 11, 12 e 19, e a copy é literal deles (o 19
usa o BUILDER real do servidor, não texto digitado).

## Contrato — `pendings.list`

- **Procedimento:** `convex/functions/pendings/list.ts` (`authQuery`) → no
  cliente, `api.pendings.list.list` (módulo `pendings`, arquivo `list`, função
  `list`). Sem tabela nova (a tabela de recibos é da dispensa, abaixo), sem
  cron.
- **Input:** `{ scope: "organization" | "player", surface?: "home" | "house" }`
  (raiz `z.object`). Sem `surface` a leitura vale a CASA — ver "Dispensa por
  superfície".
- **Output:** `{ counts, items, saturation, scope, truncated }`
  (`pendingsListResultSchema`, `convex/domains/pendings/contract.ts`).

### O item (`pendingItemSchema`)

| Campo | Regra |
|---|---|
| `id` | Determinístico: `<kind>:<sourceId>` (`buildPendingItemId`). É a identidade/key do item na lista. |
| `kind` | Enum FECHADO que cresce por ADIÇÃO (7 kinds na v1, todos com cartão na galeria: 4 a 7, 11, 12 e 19). Primeiro segmento = quem deve a ação (`player`/`organization`), depois domínio + pendência. `PENDING_KIND_SCOPES` (contrato) é o único lugar que decide o escopo de cada kind. |
| `domain` | Domínio dono da REGRA: `payment`, `tournament` — `player` existe no enum (shape aprovado) e não tem kind na v1. |
| `severity` | `danger` \| `warning` \| `info`. O componente do app não tem `info`: o cliente mapeia `info` para `accent` do alerta, como na galeria (cartões 5, 6, 7 e 11). |
| `title` | Sempre presente (regra aprovada: todo alerta tem título E descrição). Frase única, com a contagem no plural quando agrega. |
| `description` | `string` (quando a copy real do app já é uma frase) OU **LINHAS de PARTES**: `{ parts: { text, isHighlighted? }[] }[]`. Quem decide o destaque e a quebra por linha é o SERVIDOR. Agregado usa UMA LINHA POR TIPO — nunca separador no meio da frase. |
| `actionLabel` | CTA principal, **UMA palavra**, ou `null` (pendência sem ação). É a COPY do botão. |
| `action` | **Como o cliente EXECUTA o CTA**: `{ type, params }` ou `null`. `type` é enum FECHADO que cresce por adição (`open_route`, `pay_tournament_entry`, `accept_partner_invite`, `decline_partner_invite`, `approve_tournament_entry`, `reject_tournament_entry`, `conclude_tournament`); `params` carrega o que a ação precisa além do `source`/`route`. Ver "Ação executável" abaixo. |
| `secondaryActionLabel` | Rótulo da ação de menor hierarquia (rodapé do alerta, antes da principal), também de uma palavra. Só o convite recebido tem duas ações (`Recusar` + `Aceitar`). |
| `secondaryAction` | Ação executável do CTA secundário (mesmo shape de `action`); `null` quando não há segundo botão. |
| `route` + `params` | Deep-link no molde dos CTAs vivos dos alertas (`router.navigate({ pathname, params })`): o pathname do expo-router (`/tournaments/[tournamentId]`, `/tournaments/[tournamentId]/entries`) + os params (`{ tournamentId }`, `{ initialTab: "pending", tournamentId }`). Eles são o **destino** quando `action.type = "open_route"` (aí são obrigatórios) e podem ser **contexto da entidade** nos demais casos (o recorte da casa lê o `params`, ex.: `tournamentId`); o **alvo** de uma mutação nunca mora aqui — mora em `action.params` ou no `source`. |
| `count` | Quantos casos o item agrega (`null` quando é um caso só). O título usa a MESMA contagem. |
| `deadlineAt` | Epoch ms do prazo que decide a ação (vencimento, fim de inscrição, instante da penalidade) ou `null`. |
| `moneyCents` | Dinheiro envolvido em centavos ou `null`. |
| `source` | Entidade de origem (`{ type, id }`): `organization`, `tournament`, `tournament_entry`. `payment_charge` NÃO está no enum hoje: entra quando o kind que aponta para uma cobrança existir (é o caso do PIX/charge pendente ou expirado do jogador, em "O que NÃO entra na v1"), no mesmo passo tipo → enum → registro. |

**Destaque (regra aprovada):** no máximo UM por linha, sempre a palavra-chave
que identifica a pendência (nome de pessoa, categoria, competição, valor,
prazo, ou a expressão número + objeto), nunca número solto nem palavra
genérica.

### Ação executável (por kind)

O rótulo diz o que a tela MOSTRA; o `action.type` diz o que o cliente FAZ — sem
mapa `kind` → handler espalhado nas telas e sem adivinhar:

| `action.type` | O que o cliente executa | Kinds |
|---|---|---|
| `open_route` | `router.navigate({ pathname: route, params })` (destino no item) | 11, 12 e o agregado de 4 com mais de uma inscrição |
| `pay_tournament_entry` | `createCharge({ sourceType: "tournament_entry", sourceId: action.params.entryId })` e abrir o checkout | 4 com **uma** inscrição (`action.params.entryId`) |
| `accept_partner_invite` | `respondPartnerInvite({ entryId: action.params.entryId, accept: true })` | 5 (`Aceitar`) |
| `decline_partner_invite` | `respondPartnerInvite({ entryId: action.params.entryId, accept: false })` | 5 (`Recusar`, no `secondaryAction`) |
| `approve_tournament_entry` | `entries.approve({ entryId: action.params.entryId })` (`convex/functions/tournament/entries.ts:622`; no cliente, `crpcClient.tournament.entries.approve` — `src/lib/pendings/use-pending-action-runner.ts:52`) — decisão da inscrição pelo organizador | NENHUM kind de pendência emite hoje: quem desenha é o cartão de NOTIFICAÇÃO de decisão de inscrição (agrupa "Aprovar" + "Recusar", `convex/domains/notification/presentation.ts:67`), e o app resolve os dois pelo MESMO `resolvePendingAction` (`src/lib/notifications/notification-view.ts:160`) |
| `reject_tournament_entry` | `entries.reject({ entryId: action.params.entryId })` (`entries.ts:671`; no cliente `:77`) — recusa, e as vagas da categoria voltam | idem (o `secondaryAction` "Recusar" do mesmo cartão) |
| `conclude_tournament` | `tournament.lifecycle.conclude({ tournamentId: action.params.tournamentId })` — no cliente `crpcClient.tournament.lifecycle.conclude` (`:104`); a conclusão é do DONO e o cliente não navega: o CTA É a mutação | 19 |

Invariantes (cobertas por teste):

1. **Todo kind tem ação declarada** — ou uma ação executável, ou `null` com os
   rótulos nulos (kinds 6 e 7 não têm CTA).
2. **`open_route` sempre tem destino** (`route` + `params` do ITEM não nulos) e
   nunca carrega `action.params`: para navegação pura o destino é o par do item.
3. **Ação de mutação nunca depende de `route`/`params`** — o ALVO vive em
   `action.params` (o `entryId` da inscrição a pagar/responder). O item
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

### Dispensa por superfície (IBX-0085)

O item pode ser ESCONDIDO, e a dispensa é **por superfície**: o MESMO item
aparece na home e na casa do torneio, e o gesto de esconder só existe na
home. A superfície viaja no input da leitura (`surface`) e a casa NUNCA esconde.

- **Tabela `pendingDismissal`** (`domains/pendings/tables.ts`), uma linha por
  `(ator, superfície, item)`: `actorKind` (`organization`/`player`), `actorId`
  (id do ator dono da pendência), `surface`, `itemId` (o id determinístico
  `<kind>:<sourceId>`), `dismissedAt` e o **snapshot**
  `severity`/`count`/`deadlineAt` do item no momento da dispensa. Índice único
  `actor_surface_item` — serve o upsert da dispensa e a leitura.
- **Mutation `pendings.dismiss`** (`functions/pendings/dismiss.ts`,
  `authMutation`, input `{ itemId, surface }`): o dono do recibo é o ATOR ATIVO
  resolvido no servidor (o cliente não manda ator), e o snapshot é
  **re-derivado** pelo mesmo caminho da leitura — o cliente não escolhe o que
  congela, então não consegue manter escondido um item que já piorou. Só o que
  a leitura daquele ator mostra é dispensável: item de outro ator/escopo (ou id
  sem kind registrado) devolve `NOT_FOUND` (o código diz `"Pendencia nao encontrada."`, sem acento — `convex/functions/pendings/dismiss.ts:32` e `:49`).
  Dispensar de novo o mesmo item regrava o recibo (upsert) — é o passo em que o
  recibo morto é substituído.
- **Recibo na casa é aceito e INERTE** (`surface: "house"`): a mutation grava,
  mas a leitura da casa nunca filtra — por isso o botão de esconder não pode
  existir na casa (o gesto é só da home).
- **Regra do recibo vivo** (`filterDismissedPendingItems`, `pendings-rules.ts`):
  o item fica escondido **enquanto o recibo casar com o item atual nos três
  campos do snapshot** — severidade igual, contagem igual (caso único, `count`
  nulo, conta 1) e prazo igual. Qualquer diferença (severidade que sobe, ex.:
  `warning` → `danger` no MESMO id; contagem que cresce; `deadlineAt` novo ou
  diferente) mata o recibo e o item **VOLTA** para a tela — "se piorar,
  reaparece" (DEC-0008, opção A). Recibo morto é ignorado na leitura, nunca
  bloqueia.
- **Efeito no resultado:** o filtro acontece ANTES do cap e das contagens
  (`buildPendingsResult`), então item escondido não ocupa vaga no cap de 20 nem
  entra em `counts` (a home nunca anuncia mais do que mostra) e `truncated`
  reflete a lista visível.
- **Leitura do estado:** `findPendingDismissals` (`registry.ts`) lê só os
  recibos do ator e da superfície (índice `actor_surface_item`, cap
  `PENDING_DISMISSAL_SCAN_LIMIT = 200`, ordem por `itemId`) e nem toca a tabela
  quando a superfície é a casa.
- **Poda no write-path do dismiss (BUG-0062).** Depois de gravar o recibo, a
  `pendings.dismiss` apaga os recibos **mortos daquele ator + superfície**
  (`selectDeadPendingDismissals`, `pendings-rules.ts`): item fora da **derivação**
  ou snapshot que não casa mais. A comparação roda sobre a derivação COMPLETA
  (`derivePendings`, o mesmo array que a leitura recebe ANTES de
  `buildPendingsResult` filtrar/ordenar/cortar) — nunca sobre a lista cortada em
  20, senão a poda enxerga um universo menor que a leitura e mata recibo vivo de
  item que a ordenação jogou para fora do cap. A classificação é a mesma das duas
  pontas (`classifyPendingDismissals`), então a poda não muda nada do que a tela
  mostra. Recibo vivo (inclusive o que a própria mutation acabou de regravar)
  nunca entra, e o `delete` pina `actorKind`/`actorId`/`surface` no `where`, nunca
  tocando recibo alheio. Efeito: a tabela passa a guardar só recibo vivo por ator,
  então o corte de 200 da leitura deixa de ser alcançável na prática.
- **Item dispensável = item da derivação (não da lista cortada).** O `itemId` é
  resolvido na derivação completa: item que existe na derivação mas caiu fora dos
  20 é dispensável como qualquer outro (antes devolvia `NOT_FOUND`, porque a
  mutation tratava a lista cortada como se fosse a derivação).
- **Migration:** `20260921_191850_add_pending_dismissal` — a tabela nasce vazia,
  então não há dado a backfillar; o registro existe para o journal do DEV/PROD
  acompanhar a mudança de schema (aplicada no DEV em 21-09).

- **Kind de ESTADO não tem dispensa** (`PENDING_NON_DISMISSIBLE_KINDS`,
  `convex/domains/pendings/contract.ts:86`): o GESTO não existe para ele — a
  `pendings.dismiss` recusa com `BAD_REQUEST` ("Essa pendência não pode ser
  dispensada.", `convex/functions/pendings/dismiss.ts:44`) e a leitura nunca
  esconde (`isPendingItemDismissible` entra na classificação dos recibos,
  `pendings-rules.ts:139` e `:191`), então um recibo gravado antes da regra morre
  em vez de sumir com o item. O critério é o mesmo do resto: o item sai quando o
  PROBLEMA acaba, não quando o ator o esconde. Hoje a lista tem um único kind,
  `organization_tournament_awaiting_conclusion` (abaixo).

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
| 4 | `player_tournament_entries_awaiting_payment` | player | tournament | warning | N inscrição(ões) aguardando pagamento | Pagar | uma inscrição: — (o destino é a ação); 2 ou mais: `/tournaments/[tournamentId]` + `tournamentId` |
| 5 | `player_tournament_partner_invite_received` | player | tournament | info | Convite de dupla aguardando sua resposta | Aceitar (+ Recusar) | `/tournaments/[tournamentId]` + `tournamentId` (contexto; o alvo da resposta é a inscrição) |
| 6 | `player_tournament_partner_invite_sent` | player | tournament | info | Convite de dupla enviado | — | `/tournaments/[tournamentId]` + `tournamentId` (contexto) |
| 7 | `player_tournament_entry_awaiting_approval` | player | tournament | info | Inscrição aguardando aprovação | — | `/tournaments/[tournamentId]` + `tournamentId` (contexto) |
| 11 | `organization_tournament_entries_awaiting_approval` | organization | tournament | info | N inscrição(ões) aguardando aprovação | Ver | `/tournaments/[tournamentId]/entries` + `initialTab: "pending"`, `tournamentId` |
| 12 | `organization_tournament_entries_awaiting_payment` | organization | tournament | warning | N inscrição(ões) aguardando pagamento | Ver | idem 11 |
| 19 | `organization_tournament_awaiting_conclusion` | organization | tournament | warning | Concluir torneio | Concluir | — (o CTA não navega: ele conclui) |

**Como cada item agrega (e por quê):**

- **4 · 11 · 12 — por TORNEIO.** O título pluraliza pela contagem, como a tela
  já faz hoje. A 4 conta só as inscrições do lado A do viewer (quem paga, o
  gate `canPay` da casa do jogador); a 11/12 varrem as inscrições dos torneios
  da organização.
- **5 · 6 · 7 — por INSCRIÇÃO.** A copy nomeia pessoa/categoria/competição, que
  são dados da inscrição — agregar perderia o dado. Exigem o NOME disponível
  (sem ele não há como escrever o destaque e o item não é emitido).
- **19 — por TORNEIO concluível** (um item por torneio): o item é do TORNEIO, não
  de uma categoria, e não agrega contagem — a frase diz que ele já tem campeão em
  todas as categorias.

### Kind 19 · `organization_tournament_awaiting_conclusion` (ESTADO, sem dispensa)

O sétimo kind é um kind de **ESTADO** (existe enquanto o problema existe), não um
lembrete, e tem cartão na galeria de alertas: "Alerta 19 · REAL · Torneio
(organizador): concluir torneio" (`src/app/(private)/settings/components/[component].tsx:558`),
alimentado pelo BUILDER REAL do servidor e não por copy digitada — o cartão monta o
item chamando `buildOrganizerConclusionPendings` (`:363`, item em `:372`). A nota
do próprio cartão registra a única diferença dele: é o kind sem gesto de esconder
(o servidor recusaria).

- **Quando nasce:** quando `canConcludeTournament` é verdadeiro
  (`convex/domains/tournament/conclusion-rules.ts:39`) — torneio **EM ANDAMENTO**
  (`status: "ongoing"`) e toda categoria JÁ SORTEADA com campeão. Campeão é o
  vencedor da FINAL, ou seja a partida de maior `round` no `slotInRound` 0
  (`resolveCategoryChampion`, `:20`); categoria sem chave (menos de 2 inscrições
  ativas, logo fora do sorteio) NÃO bloqueia o encerramento. O item é um por
  torneio, derivado por `collectOrgConclusionPendings`
  (`convex/domains/pendings/registry.ts:394`, registrado em `:497`) sobre o
  builder puro `buildOrganizerConclusionPendings`
  (`convex/domains/tournament/pendings-rules.ts:321`).
- **Forma:** escopo organização · domínio `tournament` · severidade `warning` ·
  título "Concluir torneio" · `actionLabel` "Concluir" · `count`, `deadlineAt` e
  `moneyCents` nulos · `source` = o torneio · `route` **nulo** (o CTA não navega,
  ele conclui).
- **CTA:** `action.type: "conclude_tournament"` com `action.params.tournamentId`;
  quem executa é a procedure do DONO, `api.tournament.lifecycle.conclude`
  (`convex/functions/tournament/lifecycle.ts:185`, input `{ tournamentId }`), que
  reusa a MESMA regra para recusar (`resolveTournamentConclusionError`, `:55`):
  "Só um torneio em andamento pode ser concluído." / "Todas as categorias precisam
  ter campeão antes de concluir o torneio.". O torneio fica `finished` — e a
  partir daí nenhuma escrita de partida passa.
- **Não dispensa:** está em `PENDING_NON_DISMISSIBLE_KINDS` — o item sai quando o
  organizador conclui, não quando ele o esconde (a regra está em "Dispensa por
  superfície", acima).
- **Paridade de consumo:** o app tem um teste que monta os itens de TODOS os
  kinds pelos builders do SERVIDOR e passa cada um por `resolvePendingAction`
  (`src/lib/pendings/pendings-action-parity.test.ts`: o array de itens tem um por
  kind do catálogo em `:99-112` e cada CTA desenhado precisa resolver em `:115`).
  É CONTRATO de consumo: o catálogo pinado é o `PENDING_KINDS_BY_SCOPE` do
  backend, então um kind novo quebra o teste até o app saber executá-lo — foi o
  que este kind exigiu do lado do cliente.

## Como é derivado

- **Regras puras por domínio** (dado → item, sem ctx, testáveis isoladas):
  - `convex/domains/tournament/pendings-rules.ts` — inscrições do jogador (4, 5,
    6, 7) e do organizador (11, 12).
  - `convex/domains/pendings/pendings-rules.ts` — o que é comum: identidade,
    ordem, cap, contagens, concordância de número, partes/linhas.
- **Registro + leitura:** `convex/domains/pendings/registry.ts` monta os
  derivadores por escopo (`PENDING_DERIVERS`), lê o mínimo com `ctx.orm` e
  fecha o resultado em `collectPendings`. Todo kind é declarado pelo derivador
  que o emite e a **completude é auditada por teste** (união dos declarados =
  kinds do escopo, sem duplicata; cada kind no escopo que o contrato registrou).
  Se um item sair no escopo errado, a query **falha** (erro explícito) em vez de
  mostrar pendência no escopo errado.

## Limites e caps declarados

Nenhum scan ilimitado; os limites são os do padrão já shipado
(`functions/player/dashboard.ts`), todos no cabeçalho de `registry.ts`. Todo
lote por id (`in`) é dimensionado pela PRÓPRIA lista de ids (nunca um cap menor
que o lote), e toda varredura com `orderBy` explícito — sem ordem definida, qual
linha fica de fora depende da ordem interna do índice.

| Leitura | Cap que corta | Sinal de saturação |
|---|---|---|
| Inscrições de torneio por lado (jogador) | 100 | 4, 5, 6 e 7 |
| Categorias/torneios/perfis do jogador (lote `in`) | tamanho da lista de ids | não corta |
| Torneios da organização lidos / varridos por inscrição e por conclusão | 50 / 20 (mais recentes) | 11, 12 e 19 |
| Categorias por torneio / inscrições por categoria | 10 / 300 | 11, 12 e 19 |
| Partidas por categoria (leitura da conclusão) | 300 | 19 |
| Itens devolvidos (`PENDING_ITEM_CAP`) | 20 | `truncated` |
| Recibos de dispensa por ator/superfície (`PENDING_DISMISSAL_SCAN_LIMIT`) | 200 | não emite `saturation`: é estado do próprio ator (e a casa nem lê). A poda do dismiss compara com a derivação COMPLETA e mantém a tabela só com recibo vivo, então na prática o corte não é alcançável (os vivos são no máximo os itens distintos que aquele ator vê) |

**Leitura da tabela:** o cap da terceira coluna é onde a varredura para; quando
ela ENCHE, o kind da quarta coluna aparece em `saturation` — ou seja, o número
daquele item pode ser menor que o real. Um escopo com muitos torneios (acima de
20 torneios, 300 inscrições numa categoria ou 300 partidas numa categoria) é
justamente onde a leitura trunca: o dado segue honesto porque o aviso vem junto.
As varreduras da organização são compartilhadas: a leitura das inscrições (11 e
12) e a da conclusão (19) usam o MESMO teto de 50 torneios e 20 varridos por
leitura, mas cada uma marca saturação só nos seus kinds (`ORG_ENTRY_KINDS` e
`ORG_CONCLUSION_KINDS`, `convex/domains/pendings/registry.ts:113` e `:116`).

**Não há índice de `tournamentEntry` por jogador** (`playerAId`/`playerBId`
isolados): a leitura é o scan limitado do mesmo padrão pré-existente
(`tournament.discovery.listParticipating`, decisão do IBX-0071) — índice
próprio é trabalho futuro (exige migration, fora deste corte).

## O que NÃO entra na v1

- **`snooze` (silenciar por tempo) e limpeza automática global de recibos
  mortos**: desde o IBX-0085 a dispensa existe e é POR SUPERFÍCIE, mas o item
  volta por PIORA (severidade, contagem, prazo), nunca por relógio; o recibo
  morto é substituído na próxima dispensa do MESMO item.
- **Push nativo, badge fora do app e e-mail**: fora do escopo do PLN-0008.
- **PIX/charge pendente ou expirado do JOGADOR** (a cobrança PENDING/EXPIRED do
  checkout): a galeria tem o cartão 17 como PROPOSTA (`PIX aguardando pagamento`
  / `PIX vencido`) e não existe kind na v1 — a regra do processo é não inventar
  frase por analogia.
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
  `pay_tournament_entry` vira `createCharge` na inscrição de
  `action.params.entryId`, `accept_partner_invite`/`decline_partner_invite`
  viram `respondPartnerInvite` e `open_route` abre `route` com os `params` DO
  ITEM (o destino é o par do item — o `action` não carrega params nesse caso).
- Os builders derivados duplicados no cliente (`buildTournament*Alert`) passam a
  ser APAGADOS quando as telas consumirem o servidor — é o cutover obrigatório do
  PLN-0008 (senão vira a terceira cópia da regra).

## Decisões e apontamentos

- **A ação é EXPLÍCITA no contrato (revisão da Etapa 1).** Antes, o cliente
  que fizesse o óbvio (`actionLabel` → `router.navigate(route)`) produzia
  navegação sem pagamento em 4 (`route` apontava a casa do torneio). O campo
  `action` fecha isso: cada CTA diz o que executa e com quais params.
- **Convite nomeia a pessoa pela cadeia de nomes do app** (revisão da Etapa 1):
  o item nunca mais deixa de nascer por o perfil convidante não ter `fullName` —
  `buildPlayerProfileDisplayName` (`convex/domains/player/identity.ts`) resolve
  `fullName` → `nickname` → nome da conta → `Jogador#NNNN` (o fallback que o app
  já exibe), com o `username` fora da conta (não é nome, e o convite já nasce por
  `username`). O builder mantém a guarda de nome vazio como DEFESA: com nome
  vazio ele não monta a frase (o cartão 5 destaca o nome e uma frase sem ele
  ficaria quebrada) — caminho que o derivador não alcança mais.
- **O convite recebido (cartão 5) ficou sem `route`**: responder o convite é
  mutação (`accept_partner_invite` / `decline_partner_invite`) e a tela real
  responde no lugar — route nulo é o contrato, não uma perda.
- **Severidade do convite recebido (cartão 5) é `info`.** O despacho da Etapa 1
  descrevia "warning com ação" para o convidado, mas o cartão APROVADO usa o
  status real `accent` (a nota do próprio cartão registra "o pedido citava
  warning" e a marcação do usuário decide). Vale o aprovado: `info` para os dois
  lados do convite, com a diferença no CTA (convidado age, criador não).
- **Torneio encerrado ou cancelado não gera pendência de inscrição** no escopo
  da organização (não há mais ação possível); a tela do torneio continua
  mostrando o bucket dela.
- **A porta tolerante do ator é nova** (`findViewerActiveActor`): o
  `getViewerContext` (estrito, `NOT_FOUND` sem perfil de jogador) segue
  intocado nas telas; a leitura de pendências usa a porta que devolve `null` —
  sem duplicar a resolução de ator ativo.
- **Escopo da ORGANIZAÇÃO exige manager ativo** (`resolvePendingsActor`,
  `registry.ts`): um `member` puro (ou ator de organização sem papel) recebe
  `items: []`, o MESMO gate das leituras equivalentes (`requireActiveManager`) —
  sem isso o alerta devolveria contagem/ids que as telas escondem dele.
- **Nome do procedimento:** o caminho do arquivo manda (`pendings/list.ts`), então
  o cliente chama `api.pendings.list.list` — convenção `módulo.arquivo.função`
  do repo, não um nome novo.
- **A dispensa é POR SUPERFÍCIE e o dono é o ATOR (IBX-0085).** O mesmo item é
  renderizado na home e na casa do torneio: esconder na home não apaga o
  alerta da casa (`surface: "house"` nunca filtra e nem lê os recibos). O recibo
  pertence ao ator dono da pendência (organização ou perfil de jogador), não à
  sessão que dispensou — os dois gestores da mesma organização veem o mesmo item
  escondido; o cliente nunca escolhe o dono (o input da mutation só tem
  `itemId` e `surface`).
- **O snapshot é re-derivado no servidor, não vem do cliente.** Se o cliente
  mandasse `severity`/`count`/`deadlineAt`, uma tela desonesta poderia congelar
  um snapshot à frente do item real e furar o "se piorar, reaparece"; a mutation
  deriva o item pelo MESMO caminho da leitura e congela o que ela mostra.
- **Sem `surface` a leitura vale a CASA.** É a única superfície que nunca
  esconde, então quem esquece o parâmetro recebe a lista completa — o default
  nunca faz uma pendência SUMIR por engano. As chamadas da casa (o `_layout.tsx`
  do torneio) seguem sem o parâmetro; a home passa `surface: "home"` no corte do
  Frontend.
- **Nenhum dado novo é criado PELA DERIVAÇÃO:** os itens continuam derivados a
  cada leitura (sem tabela de pendência). A ÚNICA escrita do sistema é o recibo
  de dispensa. O kind 4 e o 12 foram provados no DEV com a MESMA inscrição
  (`rd714y595ax7zp5xy3gbpb2grs8erhda`, Copa Vila Tênis Clube, R$ 5,00) vista
  pelos dois lados — jogador ("1 inscrição aguardando pagamento" + `Pagar`) e
  organização ("1 inscrição aguardando pagamento" + `Ver`).

### Seed de DEV do cenário de pendências (IBX-0090)

- `bunx convex run seed:pendencyScenario '{"primaryUserEmail":"<email>"}'` cria
  (e repara) o estado que faz a home da conta mostrar os **6 kinds**: 2 torneios
  do organizador levam as inscrições do cenário — uma aguardando pagamento (com
  o alvo no lado A), um convite enviado, um convite recebido e uma aguardando
  aprovação. O plano puro vive em `convex/domains/seed/pendency-plan.ts` (testes
  em `domains/seed/tests/`). O kind 19 NÃO sai deste seed: ele exige um torneio
  em andamento com campeão em todas as categorias, que o cenário não monta.
- Os 2 kinds da ORGANIZAÇÃO vêm de uma organização PRÓPRIA do seed ("Arena
  Beira-Rio", alvo como owner), dona dos dois torneios do cenário. No escopo do
  jogador o cenário inteiro aparece na home dele.
- **Cobertura da organização que o alvo JÁ usa (r2, 22-09).** O seletor do app
  ativa a PRIMEIRA organização da lista de membros
  (`availableActors.find(kind === "organization")`, `app/(private)/settings/index.tsx`)
  e não oferece escolher outra: sem isto os kinds da organização só existiriam
  numa organização que ele não consegue abrir. O seed ACRESCENTA — nunca altera —
  dado de teste nas organizações em que o alvo é `owner`/`admin` (até 3): no
  torneio mais recente com inscrições abertas, 2 inscrições aguardando pagamento e
  1 aguardando aprovação (cartões 11 e 12). O alvo do plantio é o TOTAL por status
  no torneio, então rodada repetida não acumula (o "aguardando pagamento" pede 2
  de propósito: o item já dispensado volta quando a contagem muda). O perfil
  `player-01` do seed (mesmo nome do dono da conta) fica fora das candidatas, e o
  par de dupla respeita o gênero da categoria (IBX-0074).
- **Idempotente e repetível**: rodar de novo não duplica (`primaryEntriesCreated`
  volta 0) e não faz reset; o prazo de inscrição dos torneios é REFRESCADO para o
  cenário seguir válido dias depois. **RESSURREIÇÃO**: o item dispensado volta
  quando `severity`, `count` ou `deadlineAt` mudam
  (`filterDismissedPendingItems`, `domains/pendings/pendings-rules.ts`), então
  mudar o que o item mostra ressuscita o alerta — nos cartões 11/12, a entrada
  nova que muda a contagem do torneio.

## QA no simulador (20-09, sem commit)

- **BUG-0047 (toast de recusa do convite, cartão 5):** o toast de sucesso da ação
  `decline_partner_invite` repetia a frase (título "Convite recusado" +
  descrição "Convite recusado."). A descrição passa a dizer o PRÓXIMO PASSO —
  "Convite recusado, as vagas voltaram para a categoria." — no toast do caminho
  do item (`lib/pendings/use-pending-action-runner.ts:68`), sem tocar em título, ids, invalidação nem nas
  outras copies do fluxo (o aceite segue "Convite aceito, a dupla está fechada.").
  O texto reflete o efeito do servidor: a inscrição recusada fica terminal e as
  vagas da categoria voltam a ficar livres (`respondPartnerInvite`,
  `convex/functions/tournament/entries.ts:553-565`).
