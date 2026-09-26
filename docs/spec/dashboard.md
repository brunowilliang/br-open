# Dashboards — Estado atual

> Verificado em 20-09-2026 contra o código do repo (convex/ + src/). Contratos de leitura do IBX-0071/PLN-0007 (dash pessoal do jogador + séries da home da organização) entregues e provados no DEV (kindred-yak-142, function-spec 162→164, sonda autenticada); composição das telas entregue em duas etapas: o plano de conteúdo em TEXTO SIMPLES (IBX-0071) e, agora, a composição com os COMPONENTES REAIS nos itens que o usuário marcou um a um (IBX-0075 — seção no fim). Em andamento (sem commit).

## Visão geral

Os dashboards por persona consomem duas queries novas de LEITURA, sem tabela nova, sem migration e sem cron: `player.dashboard.getOverview` (agregado do modo jogador: próximos jogos, V/D consolidado com série mensal, inscrições ativas por categoria e parceiro de duplas mais frequente) e `payment.dashboard.getRevenueSeries` (série mensal de receita da organização + quebra por competição, a partir do histórico real de `paymentCharge`). As regras puras que sustentam as duas queries são testáveis isoladamente (`domains/player/dashboard-rules.ts`, `domains/payment/dashboard-rules.ts`) e o calendário de referência de TODAS as séries é o do Brasil (offset fixo UTC-3, `BRAZIL_UTC_OFFSET_MS` em `domains/payment/rules.ts` — mesma convenção da renovação e do auto-start de torneio).

## Implementado

### 1. Dash pessoal do jogador — `player.dashboard.getOverview`
- **Status:** implementado (backend + TELA EM TEXTO SIMPLES por plano de conteúdo fechado do usuário, 19-09-2026: `src/components/pages/home/player-dashboard.tsx` renderiza "Partidas por mês" (série mensal em texto, rótulos de `buildPlayerResultsChart`), "Desempenho" (`XV · YD` de `performance.wins/losses`), "Suas inscrições" (contagem de `entryCategories`) e a lista "Próximos jogos" (mantida). RadialChart, BarChart, LineChart, PieChart, TrendChip, card do parceiro e a trilha/vitrine de competições SAÍRAM da tela; `buildPlayerPositionChart` foi extinto (corte limpo, com teste). Os componentes de KPI/gráfico para estes dados serão DEFINIDOS E APROVADOS item a item antes de voltar
- **Data:** 19-09-2026 (em andamento, sem commit)
- **Referências:** convex/functions/player/dashboard.ts (`getOverview` authQuery, input `{ months?: 1..24 }`, default 6); convex/domains/player/contract.ts (`playerDashboardOverviewSchema` + `playerDashboardPlayerCardSchema`, `playerDashboardUpcomingMatchSchema`, `playerDashboardResultMonthSchema`, `playerDashboardEntryCategorySchema`, `playerDashboardPartnerSchema`); convex/domains/player/dashboard-rules.ts (`brazilDayKey`, `classifyResultOutcome`, `bucketResultsByMonth`, `findMostFrequentPartner`, `countActiveEntriesByCategory`); convex/domains/payment/rules.ts (`buildBrazilMonthKey`, `buildRecentMonthKeys`, `monthKeyWindowStartMs`); convex/domains/player/tests/dashboard-rules.test.ts.
- **Shape:** `{ upcomingMatches[], performance { wins, losses, winRate 0..1, byMonth[{month,wins,losses}] }, entryCategories[{categoryId, displayName, entryCount}], frequentPartner {count, player{playerProfileId, fullName, avatarUrl}} | null }`. `upcomingMatches[]` = `{ id, competitionId, competitionName, categoryId, categoryDisplayName, matchDate "YYYY-MM-DD", startMinute, endMinute, courtName, partner|null, opponents[] }`, ordenado por (matchDate, startMinute), limite 20 (o `kind` saiu do contrato no IBX-0124: enum de um valor só, sem informação).
- **Como funciona:** exige ator player (`requireActivePlayerProfile`, FORBIDDEN caso contrário). Próximos jogos = matches de torneio agendados a partir de hoje; `matchDate` comparado por chave de dia do BRASIL (`brazilDayKey`) — escolha documentada: o produto segue o calendário do Brasil. V/D = matches `finished` com `winnerEntryId` em entradas minhas (não canceladas) dentro da janela; W.O. de SORTEIO (bye: `walkover` sem `publishedAt`) NÃO conta como resultado. Inscrições por categoria = entries `active` agrupadas por categoria (decisão do doc: distribuição só de confirmadas). Parceiro frequente = duplas não canceladas dos dois lados (playerA ou playerB), desempate count → entrada mais recente → id. Wins/losses/winRate = totais da janela (consistente com `byMonth`).
- **Decisões:** leituras limitadas; indexadas onde o índice existe (50 matches por query via `entryAId`/`entryBId`, 20 upcoming). EXCEÇÃO assumida: as buscas de entries por `playerAId`/`playerBId` isolados NÃO têm índice próprio (só os compostos `categoryId_playerXId`, `domains/tournament/tables.ts`) e rodam como scans limitados (100 por lado) — o MESMO padrão pré-existente do `tournament.discovery.listParticipating`, sem regressão; índice próprio é trabalho futuro (migration, fora do corte read-only). Profile lookup com cache por playerProfileId e degradação para placeholder quando um perfil sumiu (o dash não pode 500 por causa de uma linha órfã). O agregado é composto dos buckets existentes — sem tabela nova; se V/D global precisar escalar além dos limites atuais, a decisão de índice/view materializada fica registrada como trabalho futuro (não inventado agora).

### 2. Série de receita da organização — `payment.dashboard.getRevenueSeries`
- **Status:** implementado; a TELA virou TEXTO no ajuste final do usuário (19-09-2026): a home da organização renderiza a série mensal em texto ("ago R$ 120 · set R$ 90", rótulos de `formatDashboardMonthLabel`) + "Total da janela" (`totalCents`), no mesmo molde dos demais KPIs de texto. O widget de chart `org-revenue-widget.tsx` foi EXTINTO (BarChart + bySource footer). O app está com ZERO charts; `victory-native`/`@shopify/react-native-skia` permanecem no package.json SEM USO até o componente de gráfico ser definido e aprovado item a item. A quebra `bySource` segue no contrato (consumida pela receita de torneio no cliente) **(SUPERSEDE no IBX-0078 · 21-09-2026: o componente foi aprovado e esta seção da home virou chart — o `MonthlyChartCard` compartilhado, sobre ESTA MESMA série; o texto "ago R$ 120 · set R$ 90" saiu e o "Total da janela" ficou. Ver a seção do IBX-0078 no fim da spec.)**
- **Data:** 19-09-2026 (em andamento, sem commit)
- **Referências:** convex/functions/payment/dashboard.ts (`getRevenueSeries` authQuery, input `{ months?: 1..24 }`, default 6; `organizerCentsOf` movido para as regras — `getOverview` passa a importar de lá, fonte única da matemática de split); convex/domains/payment/contract.ts (`dashboardRevenueSeriesSchema` = `{ series[{month, receivedCents}], bySource[{sourceType, sourceId, sourceLabel, totalCents}], totalCents }`); convex/domains/payment/dashboard-rules.ts (`buildRevenueSeries`, `organizerCentsOf`, `RevenueCharge`); convex/domains/payment/tests/dashboard-rules.test.ts.
- **Como funciona:** exige manager da organização ativa (`requireActiveManager`). Lê o histórico real de `paymentCharge` da org (limite 1000, mais recente primeiro) e soma SOMENTE charges `PAID` por mês brasileiro de `paidAt`, valendo os centavos do organizador do split (`splitConfig.organizerCents` com fallback ao valor cheio — o MESMO dinheiro que o `getOverview` reporta). Todos os meses da janela vêm no array (mês vazio = 0, o gráfico não engole buraco); `bySource` agrupa pelo par polimórfico `sourceType`+`sourceId` (hoje `tournament_entry`) usando o snapshot `sourceLabel` como nome — sem join — ordenado por receita desc. Gate de conta espelha o `getOverview`: sem subconta `active` devolve série vazia (zeros), coerente com o hero da home.
- **Decisões:** a série inclui TODOS os sourceTypes (a `getOverview` olha as mesmas charges; a receita real da org é a das inscrições de torneio). Sem índice de `organizationId` em `paymentCharge`: a leitura é scan limitado (mesmo padrão da `getOverview`, que já consulta assim); se o volume de charges crescer, índice (`organizationId_paidAt`) ou agregado são a decisão futura apontada — EXIGE migration, fora do escopo read-only deste corte.

## Limites e próximos passos

- Teto de leitura: histórico de charges > 1000 trunca a janela (os mais recentes vencem) — registrar se algum org real chegar perto.
- Pendências de dado conhecidas (IA-0071 doc v2): "Recebimentos por competição" existe via `bySource`; "Precisa de você" global (pendências somadas) continua sem contrato — cada página tem o seu.
- FASE 2 (Frontend): ENTREGUE — charts HeroUI Pro native compostos contra estes shapes (`PlayerDashboard` + `OrgRevenueSeriesWidget`); sem gate de função no cliente (skip chart quando série/total zerados).

## Plano de conteúdo das telas (IBX-0071 — 19-09-2026, sem commit)

O usuário marcou a lista de dashboards item por item (RUL-0033) e fechou o conteúdo de 9 superfícies: TODOS os componentes de dashboard (KPI, chart, TrendChip, card de stat, feed de resumo) saem das telas e cada item vira LINHA DE TEXTO SIMPLES (rótulo + valor, classes tipográficas já usadas no app, valor sem dado = 0, separador "·"). WidgetAlert, listas de próximos jogos, floating tabs, rodapés fixos, blocos de AÇÃO ("Suas inscrições" com ações; Saldo + Realizar Saque) e o BottomSheet de categoria CONTINUAM. **Processo:** componente de KPI e de gráfico serão definidos e aprovados UM A UM com o usuário antes de qualquer re-introdução. **(SUPERSEDE 20-09, IBX-0075 r2: o usuário ditou a composição final das 9 telas/modos e depois CORRIGIU o escopo no app — TODO bloco de número da lista dele é o `KpiCard` da galeria (a marcação `(KPI)` era exemplo do tipo, não a lista dos que viram card); o que não é número segue no componente reutilizado (`WidgetAlert`, `MatchCard`, `JoinFooter`) ou em texto (descrições). A composição final por tela/modo, com file:line, está na seção IBX-0075 no fim desta spec.)**

- **Home jogador:** "Partidas por mês" (série mensal), "Desempenho" (`XV · YD`) e "Suas inscrições" (contagem) em `KpiCard` (IBX-0075 r2); "Próximos jogos" (lista). **Pendências/Alertas = bloco do SERVIDOR** (Etapa 2 do PLN-0008 — `pendings.list` escopo player no 1º bloco; a "nota A" desta spec está RESOLVIDA, ver a seção da Etapa 2). REMOVIDOS: RadialChart, BarChart V/D, TrendChip, LineChart de posição, PieChart, parceiro de dupla, trilha "Suas competições", vitrine "Inscrições abertas" (+ queries `listParticipating`/`listAvailable` sem consumidor na home).
- **Home organizador:** Saldo + "Realizar Saque" (ação no `KpiCard`), "Recebido este mês", "Previsto/mês" e "Em atraso" em `KpiCard` (IBX-0075 r2); "Receita por mês" em TEXTO (série mensal + "Total da janela") **— SUPERSEDE no IBX-0078: virou o `MonthlyChartCard` aprovado, com o "Total da janela" mantido em texto**. **Pendências/Alertas = bloco do SERVIDOR** (Etapa 2 do PLN-0008 — `pendings.list` escopo organization no 1º bloco; mesma nota A resolvida). REMOVIDOS: TrendChip, "Atividade recente", "Minhas competições" (decisão anterior) e, no AJUSTE FINAL do usuário, o próprio chart de receita (widget extinto; **SUPERSEDE 21-09: o "Total da janela" foi REMOVIDO por pedido direto no chat e o chart da receita segue no `MonthlyChartCard` — ver a seção "Remoção do bloco Total da janela"**).
- **Torneio (casa):** organizador = **pendências do SERVIDOR** (`PendingsAlerts`, kinds 11/12 recortados pelo `tournamentId`; Etapa 2 do PLN-0008) + **"Receita do torneio", "Inscrições" e "Partidas" em `KpiCard` (IBX-0075 r2)** (`bySource` × entryIds no cliente, janela 12 meses); jogador = **pendências do SERVIDOR** das próprias entries (kinds 4 a 7, os todos na casa: 5/6/7 pelo `params.tournamentId` e o 4 com UMA inscrição pelo `source` de torneio)  (o bloco "Suas inscrições" MIGROU para a aba Inscrições no IBX-0080) + **"Próximo jogo" no `MatchCard` (IBX-0075)**; guest = descrição. Tabs flutuantes e rodapé fixo de inscrição (CTA → BottomSheet) restaurados. REMOVIDOS: charts de categoria/evolução, chip de ciclo, meta line, alerta de janela, bloco no corpo, EmptyState guest, "Inscritos confirmados" na casa.
- **Apontamentos de dado (nenhuma query nova neste corte):** pendências agregadas da home = DADO NOVO (continua; cada página tem a sua); receita por torneio = resolvida no cliente via `bySource` (janela da query, 12 meses).

## Galeria dev de componentes (IBX-0072 — 19-09-2026, sem commit)

Área dev-only em Configurações para APROVAÇÃO de componentes variante por variante (o processo item a item desta spec). O plano texto-simples segue FROZEN: dashboards intocados até os componentes saírem daqui aprovados.

- **Mecanismo dev (passo 0):** `process.env.EXPO_PUBLIC_IS_DEV === "true"` — o ÚNICO mecanismo de dev do app (precedente checkout `[chargeId]/index.tsx:365-370`, que documenta por que `__DEV__` não serve: é `false` até no perfil dev de TestFlight). "Perfil dev" de CONTA não existe no viewer/context (só capabilities de organizador) — o gate é do build, não de conta (apontado). Gate na ENTRADA (`devOnly` no filtro de menus de `settings/index.tsx`) e na ROTA (as duas telas retornam `null` fora de dev; deep link não chega).
- **Estrutura extensível:** registro único `src/lib/dev/component-registry.ts` (`COMPONENT_GALLERY_ENTRIES`) alimenta a listagem (`settings/components/index.tsx`, linhas ListGroup do settings) e a rota dinâmica `settings/components/[component].tsx` (param inválido → EmptyState). Componente novo = +1 entrada no registro + seção de variantes na tela dinâmica.
- **Variantes do KPI (títulos numerados e estáveis pra aprovação) — SOMENTE do `KpiCard` (`ui/kpi-card.tsx`):** KPI 1 normal · KPI 2 com descrição (+ícone) · KPI 3 com erro (`tint="danger"`) · KPI 4 com diálogo (o InfoDialog INTERNO do próprio card, prop `info` → InfoTrigger + InfoDialog). **Decisões do usuário no componente:** a prop `size` foi REMOVIDA do KpiCard (variante "grande" extinta da galeria — o valor fica no padrão que ele fez: `size="base"` + `weight="semibold"`); o WIP visual dele está RATIFICADO como decisão: label em `weight="medium"` (variant description) e label + description em `danger` quando `tint="danger"`. Nenhum estilo novo criado; tudo em tokens/classes já usados (RUL-0026/0007).

## Galeria: item Texto (IBX-0073 — 19-09-2026, sem commit)

Fase B da padronização de texto (levantamento numerado em `/tmp/IBX-0073-levantamento-texto.md`):

- **Componente:** `core/text.tsx` já cobria todos os papéis via props (`variant` body/description/title/heading/label/display + `color` + `size` + `weight`). Única lacuna medida: **alinhamento** (12-15 usos de `text-center` na mão) — adicionada a dimensão `align` (center/left/right, classes já existentes; zero token novo).
- **Galeria:** registro ganhou `Texto` (`component-registry.ts`); tela `settings/components/[component].tsx` mostra os papéis com exemplo real (Texto 1 título · 2 heading · 3 corpo · 4 descrição (description+muted) · 5 rótulo · 6 display · 7 preço 3xl · 8 ênfases semânticas · 9 align center).
- **MIGRAÇÃO EXECUTADA (mesmo dia, decisão do usuário: "input NENHUM é tocado; fora do input, tudo usa o componente"):** migrados **63 `<Description>` soltos** (3 deles com override `text-danger` → `color="danger"`; visual 1:1 — fora de field o CSS do Description é exatamente `text-sm` + `muted`) e **13 `<Label>` soltos** (→ `weight="medium"`, cópia exata do `label__text`) e **41 `<Text>` com classe na mão** (→ props; `text-center` → `align="center"`; condicionais `text-accent` → `color` ternário). **EXCEÇÃO DECLARADA:** ficam do HeroUI os 29 `<Description>` e 83 `<Label>` DENTRO de contexto de campo (TextField/ControlField/Select — comportamentos de form que o Text não cobre) e o `Label` de input. **Sobre as superfícies "frozen" do IBX-0071:** a migração tocou 3 arquivos delas com 4 trocas 1:1 EXIGIDAS pela própria decisão do usuário (fora de input, tudo usa o componente) — `tournaments/player-overview.tsx` (text-base dropado = default body), `tournament-join-sheet.tsx` (Description SOLTO das rows de categoria → Text muted/description; a hint do parceiro no TextField permanece HeroUI) e `kpi-card.tsx` (2 Description → Text). São parte da migração, não violação de freeze (revisão aprovou como 1:1); dashboards seguem frozen pra CONTEÚDO. **Apontados (sem precedente no vocabulário, classe mantida):** `text-surface-tertiary-foreground` (ranking:543 — cor sem variante no Text), `text-muted/70` (3 usos, somente em `src/app/(public)/index.tsx:21/35/48` — migrado como `muted` + `opacity-70`, equivalente aprovado na review), `text-6xl` (fora do vocabulário de size, no +not-found). Gates: check limpo, 523/523.

## Galeria: item Inscrição, rodapé flutuante com MorphButton (IBX-0074 — 19-09-2026, sem commit)

Padronização do rodapé flutuante de inscrição (pedido do usuário): componente novo com o MorphButton do HeroUI Native Pro como superfície. NENHUMA tela mexida (dashboards frozen); os 2 rodapés atuais continuam intocados até o usuário aprovar o componente e escolher a troca. **(SUPERSEDE 20-09: o TORNEIO já trocou — ver bullet RENAME + WIRING abaixo.)** Os moldes citados nesta seção como `sheet:NN`/`TournamentJoinSheet:NN` são do rascunho de 19-09: esse arquivo NÃO existe mais em `src/` (grep vazio em 23-09) — o sucessor é `ui/join-footer.tsx`.

- **RENAME + WIRING NO TORNEIO (20-09, decisão do usuário):** `RegistrationFooter` → **`JoinFooter`** (`ui/join-footer.tsx`; id da galeria `join-footer`, título "Inscrição" mantido; o nome cobre as competições e casa com o já extinto `tournament-join-footer`). CONTRATO novo: `onAction(selection: {categoryId, partnerUsername})` — a seleção local do painel sobe pra página, e a confirmação fecha/reseta o painel (no extinto sheet ele ficava aberto no erro; agora fecha e o toast explica); `confirmLabel?` (CTA do painel, default `actionLabel`); `isActionPending?` (trava CTAs; a página troca o rótulo pra "Enviando..."); `onSearchPartner?` + `partnerOptions?` (busca externa do autocomplete — modo assíncrono oficial da doc: `filter={() => true}` + `onInputChange`; sem callback = lista estática com o filtro contains, caso da galeria); `price.prefix?` (o "a partir de" virou dado — grátis renderiza só "Grátis"); em duplas o CTA exige parceiro escolhido (mesma regra do extinto sheet:252-256). Cutover na tela: `tournaments/[tournamentId]/index.tsx` trocou o rodapé moldado + `TournamentJoinSheet` (EXTINTO, arquivo removido) pelo componente com a MESMA sequência `entries.create` → `charge.createCharge` → checkout; busca viva do parceiro `players.searchByUsername` (debounce 500ms) alimenta `partnerOptions`; `PersonCard` ganhou `avatarUrl` (avatar real do player card). Detalhes do cutover na spec `tournaments.md`.
- **ESTADO FINAL (ROUND 14 — pronto-pra-uso, 21-09):** o usuário FINALIZOU o design; o corte des-fixou os dados (design 1:1): pílula = `props.price.amount`/`price.suffix` (o "a partir de" é copy da pílula); chip de vagas acima = `props.availabilityLabel`; **rows de categoria = `displayName` + chip de modalidade (`MODALITY_LABEL`: singles "Single" — escolha dele, doubles "Duplas" — vocabulário do app) + chip de vagas (`vacancyLabel`) ou "Lotada" (copy de status atrelada a `isFull`) + `priceLabel` (NOVO campo obrigatório do `RegistrationFooterCategory`)**; CTA expandido = `props.actionLabel`. Removidos na conferência: bloco comentado "Preço Final"/Separator (dead code — import fora), `size="sm"` e `displayName` comentados, `Pagar R$ 40,00` e `Masculino`/`Single` fixos; comentários de rodada consolidados em forma curta; JSDoc refeito (modos/props/variantes). **Apontamentos:** (1) o chip de modalidade "Duplas" é inferência do vocabulário (ele só mostrou "Single"); (2) o preço da pílula NÃO troca com a categoria selecionada — wiring futuro da página (dica, não implementado); (3) a copy da variante vazia do PersonCard ("Selecionar Parceiro"/"Clique para adicionar") fica fixa no componente (uso único; virar prop opcional só num segundo contexto). Pendências de comportamento (fora do corte, sem wiring): `onAction`/convite de parceiro são da página; PARTNER_OPTIONS segue exemplo. Veredito final: review completa do reviewer + QA visual do usuário.
- **Moldes mapeados (file:line):** torneio guest = `tournaments/[tournamentId]/index.tsx:518-545` (gate de montagem :518-521 + o `JoinFooter` :522-545); o molde ANTIGO desta linha (Card tertiary, "Inscreva-se", preço, CTA e o `TournamentJoinSheet`) foi EXTINTO — a montagem do conteúdo mora no `ui/join-footer.tsx`. **Prazo:** NENHUM dos moldes renderiza prazo em texto — no torneio o prazo é GATE de visibilidade (`buildRegistrationWindowState`, index.tsx:280-285; `formatDayMonth` foi extinto no corte 0071). Por isso o componente NÃO ganhou prop de prazo (RUL-0019); se o usuário quiser prazo no painel expandido, é prop nova sob aprovação.
- **Componente:** `ui/registration-footer.tsx` (`RegistrationFooter`). Props = só os papéis dos moldes: `title` ("Inscreva-se"/"Preço"), `price` (`amount` + `suffix`), `availabilityLabel` (chip de vagas), `actionLabel` + `onAction` (CTA; wiring é da página: BottomSheet no torneio), `isActionDisabled` (lota vira `isDisabled` do MorphButton inteiro). Colocação interna `Page.Footer` + `items-center`. **Unificação deliberada de peso:** o título vai em `weight="medium"` nos dois estados (recolhido e expandido) — no molde torneio o título já era medium (`index.tsx:474`),; o componente unifica em medium como padrão dele, e a ratificação visual fica na marcação do usuário na galeria.
- **Decisões MorphButton (pacote Pro 1.0.0-beta.10; OSS 1.0.9 NÃO tem — inventário do 0071 errava o pacote):** `direction="top"` (expande pra cima; rodapé na base), `variant="secondary"` (superfície `surface-secondary` = mesma leitura do Card tertiary aprovado; a variante `primary` é invertida e exigiria `text-background`, cor fora do vocabulário do Text do app — apontado, 1 troca de palavra se o usuário preferir). Recolhido = pílula título + preço; no round 1 o toque expandia o painel w-72 (supersedido pelo round 2 abaixo: expansão só pelo botão).
- **Galeria:** registro ganhou `Inscrição` (`registration-footer`); seção `RegistrationFooterVariantsSection` em `[component].tsx`. **ROUND 4 enxugou pra 3 variantes** no padrão-canônico (o mesmo fluxo sempre; só muda o chip/estado): 1 com vagas (chip) · 2 sem chip · 3 lotada (desabilitada). As 5 anteriores colapsaram: torneio-a-partir e torneio-grátis viram "sem chip"; "fechado" saiu (era nota: não renderiza, é gate da página). **SUPERSEDE (ROUND 5):** a leitura "3 estados de chip" estava ERRADA — o usuário esclareceu que as variantes são MODOS DE USO, não estados de chip; o eixo novo é o fluxo (veja bullet ROUND 5). Instâncias dentro de caixas `h-28` porque o rodapé é absoluto e ancora no pai direto (RUL-0008); CTA sem ação na galeria (wiring é da página).
- **ROUND 6 — PARCEIRO POR AUTOCOMPLETE EM DIÁLOGO (pedido do usuário, 20-09, leva dele no fluxo de duplas):** sai o TextField manual de username (molde PartnerUsernameField, sheet:291-311) e entra o **`Autocomplete` do heroui-native-pro em `presentation="dialog"`** — a variante que abre diálogo EXISTE no pacote (doc MCP `get_component_docs autocomplete` + código instalado `lib/module/components/autocomplete/` conferidos ANTES de compor; doc native autocomplete > Dialog and Bottom Sheet Presentations). Conteúdo do diálogo posicionado `justify-start` + `paddingTop: insets.top + 12` (receita exata da doc pra ficar fora do teclado; molde de `useSafeAreaInsets` no repo: floating-tab-bar.tsx:75) e `SearchField` com autofocus ao abrir = "abre, pesquiso e seleciono o parceiro". **Design do item (pedido 2):** linha de pessoa = molde `requests.tsx:179-195` — `Image` `size-10 rounded-full` fallback blue + nome `weight="semibold"` + username `@` em linha `muted variant="description"` — em `Card` `p-3` dentro do item (RUL-0003, cara de card); `Autocomplete.ItemIndicator` (check accent) marca o selecionado (auto-esconde sem seleção); filtro por `textValue` = "Nome @username" (busca bate nos dois). **Descrição da dupla fixa (pedido 3):** mesmo texto, agora em core `Text` `size="xs" variant="description"` (size pequeno do vocabulário do core/text; moldes size+variant no próprio arquivo, `TextVariantsSection` :86-148 — no r6 era :74-79 e os imports/seções do IBX-0075 deslocaram o topo do arquivo). **Terminologia (pedido 4):** galeria troca "4 duplas" → "4 vagas" (`[component].tsx:181`, o `vacancyLabel` da categoria "Misto" dentro do bloco `tournamentCategories` :168-190; no r6 a linha era :168 e a extração do componente no r4 deslocou o arquivo do IBX-0075); quantidade é sempre em vagas. **Lotada (pedido 5):** o chip Lotada que o usuário adicionou no WIP fica INTOCO (`bg-muted/15` + `Chip.Label text-muted`) e passa a ser acionado por `category.isFull` (a categoria cheia já marca isFull); chip de vagas fica pros casos com `vacancyLabel`; categoria sem limite não mostra chip nenhum — antes o ternário do WIP mostrava "Lotada" pra `vacancyLabel` null (sem limite sairia lotada por engano). Estado do parceiro = seleção local do painel (`selectedPartner`, tipo `AutocompleteOption` do pacote); opções de exemplo humanas no componente (sem wiring, como sempre).
- **ROUND 7 — ITEM SELECIONADO DO AUTOCOMPLETE (leva do usuário, 20-09):** o fundo do item selecionado no diálogo é `bg-accent-soft` (mesmo token do seletor de categorias), entrando pelo slot OFICIAL da doc bundled: children do `Autocomplete.Item` como render fn recebendo `isSelected` (select.md:239-260, tabela :669) — na prática, a linha `// isSelected && "bg-accent-soft"` que o usuário deixou comentada no `cn` do Card, ativada por dentro do contrato da API. Itens da busca já estavam no desenho de card dele (Card + Image size-10 + nome + @username + ItemIndicator); nada alinhado além do slot.
- **ROUND 8 — CARD DO SELECIONADO NO TRIGGER, SEM CHEVRON (leva do usuário, 20-09):** após escolher o parceiro, o campo mostra o cardzinho dele — `Image` `size-10 rounded-full` + nome semibold + `@username` muted, o mesmo desenho da row do diálogo — e o `TriggerIndicator` (chevron) sai. **Slot oficial:** o conteúdo custom do trigger mora no próprio `Autocomplete.Trigger` (doc bundled select.md:35, "wraps any child element with press handlers") porque o `Select.Value` é Text fixo — o primitivo sempre renderiza `label`/`placeholder` e sobrescreve children (primitives/select.js Value :176-206, conferido no pacote). Dados vêm da option (`label` = nome, `value` = username), sem lookup nem objeto custom.
- **ROUND 9 — ENTRADA DO BLOCO DE DUPLAS ACOMPANHANDO O MORPH (leva do usuário, 20-09):** o "abre seco" era montagem tardia — o bloco de duplas só monta quando a categoria doubles é escolhida, DEPOIS que o painel abriu, então nenhuma animação o cobria. **Apontamento doc-first:** a prop `animation` do `ExpandedContent` (`MorphButtonContentAnimation`, morph-button.types.d.ts:82-101) configura só o cross-fade/scale `[closed, open]` dos dois slots (Collapsed/Expanded) — não anima sub-árvore que monta depois. **Receita usada (padrão do app):** `Animated.View` com `entering={FadeIn.duration(180)}` no bloco (molde rule-card.tsx:92-99 — mesma família FadeIn.duration(180) de score-result-dialog.tsx:57 e categories.tsx:294, IBX-0034); `gap-2` no wrapper preserva o espaçamento que vinha do gap do ExpandedContent. Sem nada inventado; validação visual é do usuário na galeria (RUL-0025).
- **ROUND 10 — PASSADA DE FEEDBACK DE TOQUE (RUL-0035, leva do usuário, 20-09):** trigger e itens do autocomplete ganham `PressableFeedback` pela composição oficial `asChild` (doc bundled select.md:323; primitivos Trigger/Item com `Slot.Pressable` — o `onPress` do select/seleção compõe com o pressed do PressableFeedback, o press atravessa; precedentes no app: `Menu.Trigger asChild` em 10+ telas). Trigger: PressableFeedback envolve o cardzinho/placeholder (superfície default do trigger continua vindo pelo className mergulhado no Slot); itens: PressableFeedback por fora do Card (wrapper aditivo, estilos dele intocados, `Highlight` último filho — RUL-0003); o `isSelected` passou do render fn para o estado do painel (`selectedPartner?.value === username`, mesma fonte — com asChild o children é elemento único). **Varredura de touchables (RUL-0035):** botão da pílula, INSCREVER e VOLTAR = `Button` HeroUI com pressed nativo (FICA, sem empilhar wrapper); seletor de categorias = PressableFeedback (já tinha); trigger e itens do diálogo = SEM feedback → entra agora; superfície da pílula = clique propositalmente no-op (decisão round 2); chips/labels = não clicáveis.
- **ROUND 11 — PERSONCARD, O COMPONENTEZINHO DO CARD DE PESSOA (leva do usuário, 21-09):** extraído para `ui/person-card.tsx` (`PersonCard`) com os estilos das rounds 6-10 movidos VERBATIM — Card `flex-row items-center gap-3` + `bg-accent-soft` quando selecionado + `Image` `size-10 rounded-full` + nome semibold + `@username` description + `Highlight` (RUL-0003) + slot `children` (o `ItemIndicator` das rows, específico do Autocomplete, fica no call site). **Variante vazia (nova, pedido do usuário):** sem nome/username, o MESMO cardzinho renderiza placeholders — avatar `fallback="black"`, "Selecionar Parceiro" no slot do nome e "Clique para adicionar" no slot do username (desenho final DELE ao vivo sobre a extração; ele iterou 3 versões — ícone, placeholders, e essa — e a do disco é a final). Substitui o placeholder de texto do trigger (o esqueleto inacabado `<Card className="w-full items-center">` dele). **Call sites:** trigger com selecionado, trigger vazio e rows do diálogo (registration-footer.tsx) — render idêntico ao estado aprovado À ÉPOCA; **SUPERSEDE (r12, edição viva do usuário):** ele REMOVEU o Text "Dupla fixa: o parceiro precisa ter username definido." (odiou o texto; item 3 do r6 SUPERSEDED — o bullet r12 registra a decisão), e o comentário órfão que restou saiu na limpeza pós-r13; asChild/PressableFeedback (r10), `isSelected → bg-accent-soft` (r7/r10), FadeIn (r9) intactos. Snapshot: o arquivo citado no despacho não existia em /tmp — snapshot tirado pelo executor do próprio disco no início (`/tmp/IBX-0074-wip-usuario-20260921-030700-frontend.tsx`, md5 7b613369).
- **ROUND 13 — REMOVER NO TRIGGER + TICK NO LUGAR DO INDICADOR (leva do usuário, 21-09):** (1) com parceiro selecionado, o PersonCard do trigger ganha botão de remover no trailing (slot children) — `setSelectedPartner(null)`; molde do X: `Button` `isIconOnly size="sm" variant="tertiary"` + `Cancel01Icon` `size-5` (dialog-close-button.tsx:20-31; pressed nativo do Button — RUL-0035 sem wrapper empilhado). O toque no botão NÃO abre o diálogo: responder mais interno vence o PressableFeedback do trigger (composição aninhada intencional). (2) `<Autocomplete.ItemIndicator />` extinto das rows — no slot children entra o check do vocabulário do app, `{isSelected ? <HugeIcons className="text-accent" icon={Tick02Icon} /> : null}` (molde sheet:212-214). Comportamentos r10/r11/r9 intactos.
- **ROUND 5 — VARIANTES = MODOS DE USO (contrato do usuário, 20-09):** o modo deriva da presença de `categories` no `registration-footer.tsx` — **SEM categorias**: o clique no CTA dispara a ação DIRETA da página (`onAction`) e o painel NUNCA abre — nem pelo toque na superfície, que já era no-op no modo controlado (`use-controllable-state.js:70-80`); via escolhida: MorphButton sempre-fechado (a alternativa — pílula sem MorphButton — duplicaria o JSX da pílula do usuário; a escolhida preserva os estilos DELE intactos, `ExpandedContent` fica inalcançável só nesse modo). **TORNEIO** (com `categories`): fluxo atual — clique EXPANDE, seletor, dupla, gate, Inscrever confirma dentro. **DESABILITADA**: lotada (`isActionDisabled` vale nos 2 modos, superfície inteira). Galeria: 1 modo direto (chip de vagas = detalhe, não eixo) · 2 TORNEIO abre o painel (categories de exemplo no molde do sheet: singles 8 vagas, MISTO·DUPLAS com o campo de parceiro, uma cheia `opacity-50`; `description` exercitada; price sem suffix — torneio não é "/mês") · 3 lotada. Type `RegistrationFooterCategory` virou export (galeria consome no `satisfies`).
- **ROUND 4 — CONTEÚDO OFICIAL DO PAINEL (decisões do usuário, 19-09; fim do rascunho declarado):** o expandido estrutura a inscrição de verdade na ordem dele: título · descrição (`description?`) · SELETOR DE CATEGORIA quando torneio (`categories?` → linhas `PressableFeedback` do molde `TournamentJoinSheet:178-219` — `rounded-xl px-4 py-3`, selecionada `bg-surface-secondary` + título `accent` + `Tick02Icon`, cheia `opacity-50` + desabilitada) · VALOR ("Preço" + amount + suffix) · seção de DUPLA quando a categoria escolhida é doubles (molde `PartnerUsernameField`, `TournamentJoinSheet:291-311`: TextField + Label "Username do parceiro" + Input `variant="secondary"` + Description). INSCREVER confirma DENTRO do painel (o fluxo mora nele; gate `!categoryId` espelhado do sheet:258 — com categorias, exige seleção). **SUPERSEDE do rascunho (round 2, item e):** o conteúdo provisório da pílula ("a partir de"/"R$ 40,00"/"/mês" fixos + chip fixo "3 vagas disponíveis") SAIU do código no primeiro corte do round 4; pílula e chip voltaram às props do molde (`title`/`price`/`availabilityLabel`). **REVERTIDO no mesmo dia por ordem do usuário (BUG-0039/RUL-0034):** ele tinha REESTILIZADO o arquivo por cima do fix H1 e o corte reescreveu sem reler — a versão DELE voltou (undo do editor, snapshot `/tmp/IBX-0074-wip-usuario-20260920-001928.tsx` como base absoluta) e o rascunho/estilos dele ficam ATÉ NOVA ORDEM: a ordem "rascunho sai" está SUPERSEDED; a estrutura do round 4 (categories/description, seletor, dupla, gate) foi REAPLICADA POR DENTRO dos estilos dele (caixa `rounded-2xl p-2` dele virou o container do conteúdo; `w-80 gap-2 p-2` e `m-0 gap-3 py-2 pr-2 pl-4` dele intocados; placeholder "content" virou o conteúdo; `isDisabled` de seleção somado ao botão INSCREVER dele). Seleção e parceiro são estado LOCAL (estrutura sem wiring; mutation é da página via `onAction`). **Apontamentos:** (1) a busca ao vivo de parceiro (`searchByUsername`, sheet:82-97) e o fluxo de convite/aceite (pending_partner) NÃO entram — wiring de domínio, fora do corte; hint estática copiada do estado sem-checagem do sheet (:233); (2) a estrutura nova (seletor/dupla) NÃO aparecia nas variantes sem `categories` — **RESOLVIDO no ROUND 5**: a galeria ganhou a variante TORNEIO com `categories` de exemplo, e o usuário aprovou os modos de uso; (3) o `p-0` do painel (round 3) foi SUPERADO pela reestilização do usuário: o ExpandedContent dele trouxe `w-80 gap-2 p-2` — estilo dele manda (BUG-0039), padding resolvido na prática.
- **ROUND 2 (decisões do usuário, 19-09 — WIP dele preservado por cima, precedente KpiCard do 0072):** (a) superfície arredondada: no round 2 era `rounded-full` fixo no slot surface; o **round 3** tornou o arredondamento POR ESTADO (`surface: isOpen ? undefined : "rounded-full"`, registration-footer.tsx:63-70) — pílula 100% redonda, painel expandido volta ao raio padrão (`radius-3xl`); a API não tem raio por estado nem anima border-radius (fora da lista width/height/top/start da doc), então a troca é instantânea no toque; e o padding do painel expandido foi REMOVIDO a pedido literal do usuário (`p-0` no ExpandedContent) — conteúdo pode colar na borda: se ele não gostar no QA, padding mínimo volta sob decisão dele. (b) expansão SOMENTE pelo botão da pílula — modo controlado `isOpen` sem `onOpenChange`: o toque na superfície chama o toggle interno que em controlado SÓ dispara o callback (`use-controllable-state.js:70-80` e `morph-button.js:44-52,88-93` do pacote), então não expande; (c) painel com 2 botões: VOLTAR (encolhe por código, molde do Voltar dos dialogs, `tournaments/[tournamentId]/index.tsx:519-527` e `:560-568`) + INSCREVER (`onAction`, wiring da página); (d) **fechar por toque fora NÃO implementado: o MorphButton NÃO tem outside-press/dismiss** (API e fonte sem a prop) — alternativa proposta: scrim próprio sob a página, entra SÓ com aval do usuário; (e) o conteúdo da pílula ("a partir de" + "R$ 40,00" + "/mês" + chip "3 vagas disponíveis" fixo) é RASCUNHO declarado dele: estrutura fixa, sem virar props, versão oficial do conteúdo vem depois (SUPERSEDIDO no round 4 abaixo: o rascunho saiu e o painel virou conteúdo oficial). Galerias intactas no round 2 (as 5 variantes da época; enxugadas pra 3 no round 4).


## Composição das telas com os blocos reais (IBX-0075 — 20-09-2026, sem commit)

O usuário ditou a composição final das 9 telas/modos usando os componentes QUE JÁ EXISTEM (KPI da galeria dev, `WidgetAlert` e o card de jogo das agendas), na ORDEM exata por tela, marcando POR ITEM o tipo do bloco: `(KPI)`, `(Alert reutilizado)`, `(componente reutilizado)`. Regra do corte: onde há marcação o componente real entrou; item sem componente real ou sem dado no contrato = GAP apontado (nenhum componente novo, nenhuma versão paralela, nenhuma query/mutation/campo novo). Item sem marcação segue no molde texto-simples do IBX-0071 (RUL-0033/0027).

### ROUND 2 — correção de escopo (20-09, cobrança do usuário no app)

O round 1 trocou só os 5 blocos que ele havia marcado com `(KPI)` literal e deixou o resto no molde texto-simples — leitura errada do pedido. Regra correta: a marcação entre parênteses era exemplo do TIPO do bloco, e a frase dele ("os KPIs já estão prontos lá em componentes, então é reaproveitar de lá") vale para TODO bloco de número da lista. O round 2 converteu mais 16 blocos em `KpiCard` (20 no total), SEM tocar em rótulo/valor (as mesmas strings), sem ícone/`tint`/`description`/`info` novo e sem lógica nova — o adendo do usuário no meio do passe desdobrou o bloco "Desempenho" em três KPIs na home do jogador. Os 2 do round 1 (Torneio organizador "Inscrições"/"Partidas") seguem iguais.

| Tela/modo | Blocos convertidos no round 2 | Call sites (file:line) |
| --- | --- | --- |
| Home jogador | "Suas inscrições" e o bloco "Desempenho" desdobrado em "Vitórias", "Derrotas" e "Aproveitamento" (o "Partidas por mês" deste round virou o chart card no r4 — ver seção no fim) | `pages/home/player-dashboard.tsx:84-103` |
| Home organizador | "Saldo disponível" (botão de saque no `action`), "Recebido este mês", "Previsto/mês", "Em atraso" | `pages/home/organizer-dashboard.tsx:71-102` (KPI do saldo `:71-86`, botão `:73-81`) |
| Torneio organizador | "Receita do torneio" | `pages/tournaments/organizer-overview.tsx:61-65` (linha do KPI) |

### Estado final por tela/modo (ordem ditada: KpiCard x reutilizado x texto x GAP)

- **Home jogador** — `(tabs)/index.tsx:155-182` (o gate dos QUATRO estados; `PlayerDashboard` :179) + `pages/home/player-dashboard.tsx`: 1. **Pendências/Alertas = `PendingsAlerts` do SERVIDOR** (`pendings.list` escopo player; `player-dashboard.tsx:64-70`); 2. **`MonthlyChartCard`** (o chart aprovado na galeria, série real; era `MonthlyMatchesCard`, renomeado no IBX-0078) — SUPERSEDE r4 do `KpiCard` deste item; 3. desempenho em três na MESMA linha (`:91-98`): `KpiCard` "Vitórias" :92 · "Derrotas" :93 · "Aproveitamento" :94-97 (o `%` fica no valor, via `formatRateAsPercent`); 4. `KpiCard` "Suas inscrições" :100-103; 5. "Próximos jogos" = **GAP (dado + componente)** (lista atual mantida :105, `upcomingMatches.map` :110).
- **Home organizador** — `(tabs)/index.tsx:155-182` (o mesmo gate dos quatro estados, com o `OrganizerDashboard` em :169; a rota só monta o painel, um `Page` só desde o IBX-0082) + `pages/home/organizer-dashboard.tsx`: 1. **Pendências/Alertas = `PendingsAlerts` do SERVIDOR** (`pendings.list` escopo organization; `organizer-dashboard.tsx:52-56`); 2. `KpiCard` "Saldo disponível" com o botão "Realizar Saque" no `action` (:71-86, slot :72-82, botão :73-81); 3. `KpiCard` "Recebido este mês" :89-92 · 4. `KpiCard` "Previsto/mês" :93-96 · 5. `KpiCard` "Em atraso" :99-102. Fora da lista dele: "Receita por mês" virou o chart compartilhado **no IBX-0078** e é bloco DESTE painel desde o IBX-0081 (bloco :107-121, card :108-120), logo abaixo dos KPIs. O "Total da janela", que ficava em texto ao lado do chart, foi **REMOVIDO a pedido do usuário (21-09-2026)** — ver a seção da remoção no fim desta spec.
- **Torneio visitante** — `pages/tournaments/guest-overview.tsx:12`: descrição em texto.
- **Torneio jogador** — `tournaments/[tournamentId]/index.tsx:513-518` + `pages/tournaments/player-overview.tsx` (alertas :96-101 e "Próximo jogo" :108-133): 1. Pendências/Alertas = `PendingsAlerts` do SERVIDOR — os QUATRO kinds do jogador aparecem nesta casa (4, 5, 6 e 7): 5/6/7 são achados pelo `params.tournamentId` (o `route`/`params` do item voltaram a ser o CONTEXTO da entidade, `convex/domains/tournament/pendings-rules.ts:77-78`, `:123-124` e `:167-168`; a ação do 5 segue só em `action.params.entryId`) e o 4 com UMA inscrição pelo `source` de torneio (`:211-216`, fallback do recorte); 2. Inscrição = rodapé `JoinFooter` da página (`tournaments/[tournamentId]/index.tsx:534`) — o bloco "Suas inscrições" com ações saiu da casa no IBX-0080 e vive no segmento "Minhas" da aba Inscrições (`entries.tsx:436-454` barra e `:485-538` ramo mine, com `EntryRowActions` :57 e `segment={activeTab}` :531); 3. "Próximo jogo" = `MatchCard` (`player-overview.tsx:108-133`).
- **Torneio organizador** — `pages/tournaments/organizer-overview.tsx`: 1. Pendências = `PendingsAlerts` do SERVIDOR (kinds 11 e 12); 2. `KpiCard` "Receita do torneio" · 3. `KpiCard` "Inscrições" · 4. `KpiCard` "Partidas".

### Dados dos KPIs (builders já existentes, nenhum novo)

| Bloco | Builder/derivada consumida | Fonte |
| --- | --- | --- |
| Home jogador "Partidas por mês" | `buildPlayerResultsChart` (`lib/home/player-dashboard-view.ts:19`) | `player.dashboard.getOverview.performance.byMonth` |
| Home jogador "Vitórias"/"Derrotas" | `performance.wins` / `performance.losses` (sem builder) | idem |
| Home jogador "Aproveitamento" | `performance.winRate` (0..1) convertido no ponto pra inteiro com `%` no VALOR (primeira exibição do número no app) | idem |
| Home jogador "Suas inscrições" | soma de `entryCategories` + `formatCount` | idem |
| Home organizador "Saldo disponível" | `buildWithdrawBalanceCard` (`lib/withdraw/balance-card.ts:18`) | `withdraw.getBalance` |
| Home organizador "Recebido este mês" | `formatCurrencyCents` | `payment.dashboard.getOverview.metrics` |
| Home organizador "Receita por mês" (IBX-0078) | `series[].receivedCents` com `formatDashboardMonthLabel` no eixo X e `formatCurrencyCents` no balão do crosshair — **nenhum builder novo, nenhuma métrica nova** | `payment.dashboard.getRevenueSeries` |
| Torneio organizador "Receita do torneio" | somatório `bySource` filtrado pelos entryIds (`pages/tournaments/organizer-overview.tsx:46`) | `payment.dashboard.getRevenueSeries` |
| Torneio organizador "Inscrições"/"Partidas" | `buildTournamentEntriesKpi` (`lib/tournaments/organizer-overview-derived.ts:14-21`) / `buildTournamentMatchesKpi` (`:24-38`) | bucket do torneio |

### Layout das linhas de KPI

- Linha = `View className="flex-row gap-3"` com 2 `KpiCard` (o `Card` interno é `flex-1`). Emparelhamento: os blocos de KPI na ORDEM ditada, 2 por linha (a exceção é o desempenho do jogador, linha de 3 — bullet abaixo), e a sobra sozinha na própria linha — Home jogador [MonthlyChartCard "Partidas por mês"] [Vitórias | Derrotas | Aproveitamento] [Suas inscrições]; Home organizador [Saldo] [Recebido este mês]; Torneio organizador [Receita | Inscrições] [Partidas].
- **Desempenho = os 3 KPIs na MESMA linha** (instrução direta do usuário; a regra anterior de 2 + 1 está CANCELADA): um único `View className="flex-row gap-3"` com os três `KpiCard` (o `Card` interno é `flex-1`, então os três dividem a largura em partes iguais), na ordem "Vitórias" · "Derrotas" · "Aproveitamento" (ordem literal do usuário, sem o `%` no rótulo). Vale na home do jogador (`pages/home/player-dashboard.tsx`).
- `KpiCard` entra só com `label` + `value` (e `isLoading` no saldo): nenhum `icon`, `description`, `info` ou `tint` foi ligado, porque nenhum desses blocos tinha isso hoje.

### GAPs (nada inventado)

1. **HOME jogador e HOME organizador — "Pendências/Alertas".** ~~O componente existe (`ui/widget-alert.tsx:16`); o DADO não.~~ **RESOLVIDO na Etapa 2 do PLN-0008 (20-09): as duas homes pedem `pendings.list` (escopo player / organization) e o 1º bloco é o renderer único `PendingsAlerts`** — ver a seção "Pendências em tela — Etapa 2". O texto abaixo fica como registro do buraco que existia: A home do jogador só carrega `player.dashboard.getOverview` (upcomingMatches/performance/entryCategories/frequentPartner) e a do organizador `payment.dashboard.getOverview` (metrics/recentCharges/account), nenhuma com agregado de pendências cross-competição (nota A desta spec). **Falta (Backend):** um agregado de pendências para a home (jogador: inscrições aguardando pagamento/convites de dupla pendentes; organizador: inscrições aguardando aprovação/pagamento nas competições dele), no mesmo espírito dos builders por página que já existem (`buildTournamentPendingApprovalAlert`). Sem contrato, o slot fica sem nada (nenhum placeholder entrou).
2. **HOME jogador — "Próximos jogos" (componente reutilizado).** O componente reutilizado das outras telas é o `MatchCard` (`ScheduleCard` não existe mais: virou o `MatchCard`, que já desenha o pé de `data · hora · quadra`), mas ele NÃO comporta a lista da home sem perda: o contrato entrega `partner` + `opponents[]` (o lado do viewer não vem como card com nome/avatar — só o parceiro) e o card não tem slot de COMPETIÇÃO (a lista de hoje mostra `data · hora · competição` e navega pra competição, e o card não tem onde pôr o nome dela). **Falta:** ou o contrato entrega os dois lados no shape do card (nome+avatar por lado, como `buildMatchSides` entrega no torneio) e o usuário aceita o card sem a competição, ou o bloco mantém a lista atual. Lista atual MANTIDA (decisão é dele; nada foi removido).

### Apontamentos

- **Saldo mudou de forma:** saiu do hero centralizado (valor `size="3xl"` bold, `py-5`) para o card do KPI (valor `size="base"` semibold). O botão "Realizar Saque" segue com o mesmo texto, `size="sm"`, `variant="secondary"` e `onPress`; saiu o `className` `mt-1` (glue do layout empilhado antigo) e ele agora vive no slot `action` do card. O `isLoading` é o mesmo (`balanceQuery.isPending`) e o skeleton passa a ser o interno do `KpiCard`.
- **Aperto na linha de 3 ENCERRADO POR EDIÇÃO AO VIVO DO USUÁRIO (09:12):** ele editou `src/components/ui/kpi-card.tsx` no disco e o `Text` do label ganhou `numberOfLines={1}` (:48) — o rótulo não quebra mais, trunca com reticências, então o aperto do "Aproveitamento" em 1/3 de largura deixou de existir. Arquivo DELE: ninguém do processo tocou. O apontamento abaixo fica como registro do estado anterior.
- **"Partidas por mês" em linha cheia:** o valor é uma série de 6 meses (`buildPlayerResultsChart`) e quebra em 2-3 linhas dentro do card; ficou sozinho na linha, então tem a largura toda.
- **Desempenho em 3 KPIs** (adendo do usuário, chegado no meio do passe): home do jogador com os rótulos LITERAIS "Vitórias" (COM acento, como ele escreveu), "Derrotas" e "Aproveitamento" (sem o `%`). "Vitórias"/"Derrotas" mostram o número puro — o sufixo do molde antigo (`XV · YD`) sai porque agora cada card tem o próprio rótulo.
- **Varredura de rótulos deste passe (letra por letra contra a lista dele):** "Partidas por mês", "Suas inscrições", "Saldo disponível", "Recebido este mês", "Previsto/mês", "Em atraso", "Inscrições", "Partidas", "Receita do torneio" e "Recebido este mês" são o TEXTO DE HOJE da tela (já com acento onde cabe) e não foram tocados; os únicos rótulos de copy nova são "Vitórias"/"Derrotas"/"Aproveitamento". **APONTAMENTO:** a lista dele traz "Receita do Torneio" com T maiúsculo e o texto de hoje é "Receita do torneio" (minúsculo) — mantive o de hoje (RUL-0027: o que vale é o texto da tela); trocar o T é 1 palavra dele.
- **O `%` do aproveitamento fica no VALOR (nas duas telas), com formatter ÚNICO:** ele nunca existiu em nenhum lugar antes do round 2 (nenhuma tela mostrava aproveitamento; a busca no histórico só acha `winRate` no tipo gerado do Convex) e o único lugar onde ele estava era o rótulo que o steering 3 mandou limpar — então o valor sai como "75%" (inteiro). O helper é `formatRateAsPercent` (`src/lib/format/percent.ts:5`, molde dos vizinhos de `lib/format`; teste co-localizado `percent.test.ts:5-21` com 0, 1, 1/3, 2/3, 0.5 e as bordas que arredondam pra 100/0) e o ponto que consome é `pages/home/player-dashboard.tsx` (`performance.winRate`, do contrato). Clean cutover: não sobrou nenhuma conversão inline (o `Math.round(x * 100)` do aproveitamento não existe mais no componente).
- **Comentários/docblocks (limpeza fina do fecho do round 2):** o cabeçalho de `(tabs)/index.tsx:27-31` dizia que a home do jogador era "dash em TEXTO SIMPLES ... KPI/chart só volta após aprovação item a item" — falso desde o round 2 — e agora descreve o estado real (KpiCard nos dois papéis; fora só o que esta spec declara).  **APONTADO fora do escopo:** `formatTrendPercent` (`lib/format/currency.ts:20`) está SEM consumidor nenhum no app (sobrou da era dos charts) — remover é decisão do usuário.
- **Rótulos:** mantidos os de hoje — "Seu desempenho" (nome usado na lista) virou os três cards "Vitórias"/"Derrotas"/"Aproveitamento" e "Partidas" aparece no torneio; nenhuma outra string de tela foi reescrita (o pedido foi de molde, não de copy).
- **Slot de COMPETIÇÃO (não de data):** o card (`MatchCard`; o `ScheduleCard` deste apontamento não existe mais) desenha o pé com `data · hora · quadra`, então o "Próximo jogo" do torneio mostra os dois lados + data + hora + quadra (como a agenda); o que falta ao card é o nome da competição, que é o que a lista "Próximos jogos" da home carrega.
- **"Receita por mês" + "Total da janela"** na home do organizador não estão na lista ditada e não ocupam o lugar de nenhum bloco listado: mantidos; saem só com palavra dele (RUL-0033). **A palavra chegou no IBX-0078 (21-09): "Receita por mês" virou o chart aprovado.** E em 21-09/2026 o usuário **REMOVEU o bloco "Total da janela"** a pedido dele (decisão direta no chat) — a linha ficou sem substituto nenhum; ver a seção da remoção no fim.

## Galeria: item Gráfico com crosshair (IBX-0075 r3 — 20-09-2026, sem commit)

Ordem do usuário: o bloco "Partidas por mês" NÃO é KPI nem widget — é o **ChartCrosshair do HeroUI Pro**, na estrutura literal `Card > title > description > chart`, e o item entra na galeria "Componentes" pra ele APROVAR antes de qualquer aplicação. **A home do jogador segue com o bloco como está** (o `KpiCard` do round 2) até a aprovação.

### Doc-first (prova no pacote instalado)

- **Existe na versão instalada?** Sim: `heroui-native-pro` **1.0.0-beta.10** (`package.json:82`; `node_modules/heroui-native-pro/package.json:3`), exportado na raiz por `lib/typescript/src/index.d.ts:8` (`export * from './components/chart-crosshair'`) e `lib/typescript/src/components/chart-crosshair/index.d.ts:1` (`export { default as ChartCrosshair }`).
- **Composição canônica** (doc bundled `node_modules/heroui-native-pro/lib/module/components/chart-crosshair/chart-crosshair.md`): Import :5; **Anatomy :11** (`ChartCrosshair.Anchor` envolvendo o chart + `ChartCrosshair.Value` irmão); **Basic usage :36** (o `ChartCrosshair` mora DENTRO do canvas, no render callback do chart, com `x={state.x.position}` e `top`/`bottom` de `chartBounds`); **Variants :68** (`dashed`/`solid`); **Custom color :93**; **Tooltip overlay :107** (Anchor + Value, com `onChartBoundsChange` espelhando os bounds); **Value variants :153** (`default`/`ghost`); **Value placement :162**; **Custom value content :185**; **API Reference :289**.
- **Tipos** (`node_modules/heroui-native-pro/lib/typescript/src/components/chart-crosshair/chart-crosshair.types.d.ts`): `ChartCrosshairProps` :52 (`x: SharedValue<number>`, `top`, `bottom`, `variant`, + props do `Path` do Skia), `ChartCrosshairVariant` :16, `ChartCrosshairAnchorProps` :186 (`children`, `chartBounds?`, `isActive?`, `x?`), `ChartCrosshairValueProps` :214 (`value: SharedValue<string>`, `variant` :86, `placement`, `offset`, `classNames`); o composto `ChartCrosshair` com `Anchor`/`Value`/`ValueBackground`/`ValueLabel` em `chart-crosshair.d.ts:33-37`.
- **Chart que recebe o crosshair:** `BarChart`/`LineChart` do próprio pacote (wrappers do `CartesianChart` do victory-native — `helpers/internal/components/base-cartesian-chart.d.ts`: `BaseCartesianChartProps` = props do `CartesianChart`); `BarChart.Bar` exige `chartBounds` do render arg (doc bundled `bar-chart.md:37-45`); o press state vem do victory-native (`victory-native/dist/index.d.ts:13`, `useChartPressState`).
- **Regra de layout da doc (seguida):** com `ChartCrosshair.Anchor`, o `wrapperClassName` do chart NÃO pode ter padding — o anchor mede no mesmo espaço do canvas Skia.

### Item criado

- **Registro:** `src/lib/dev/component-registry.ts:31-35` — `{ id: "chart-crosshair", title: "Gráfico", description: "Gráfico de partidas por mês com crosshair para aprovação" }`, no mesmo gate dev-only das outras 3 entradas (nenhum mecanismo paralelo).
- **Tela:** `src/app/(private)/settings/components/[component].tsx` — **linhas do estado PRE-r4, antes da extração do componente (não valem mais no disco):** `GalleryCrosshairCard` :278-358 (Card > `Card.Title` "Partidas por mês" > `Card.Description` > `ChartCrosshair.Anchor` com o chart + `ChartCrosshair.Value`), `ChartCrosshairVariantsSection` :367 (a seção, com a nota de dado de exemplo) e a branch da rota :433-434. **Receita VIGENTE (reponteada no fecho do BUG-0055):** `src/components/ui/monthly-chart-card.tsx` (componente :117-193) — o `monthly-matches-card.tsx:74-124` desta linha era o r4 e o arquivo NÃO existe mais (IBX-0078).
- **Variantes (aprovação uma a uma, numeradas como no KPI):** **(SUPERSEDE r3b: o usuário reprovou as 3 variantes — o item virou UM chart só; ver a seção de refinamento no fim desta spec)** — **Gráfico 1 · barras com crosshair tracejado** (default do pacote, candidato pro bloco) · **Gráfico 2 · linha com crosshair tracejado** · **Gráfico 3 · barras com crosshair sólido e balão fantasma**. As variações são as REAIS do pacote: barra x linha (o dado) e `dashed`/`solid` + pill `default`/`ghost` (os dois eixos da própria doc). **Não há variante de grade:** o victory-native 41.26.0 não exporta `Grid` (`victory-native/dist/index.d.ts`) — grade sairia desenhada na mão, fora do componente; e a altura é `wrapperClassName="h-48"` (prop, não variante).
- **Copy escolhida (título/description no vocabulário do app, sem travessão):** título **"Partidas por mês"** (o do bloco) e description **"Total de partidas por mês nos últimos 6 meses."**; o balão mostra **"mês · total"** (ex.: "set. · 4"), o mesmo formato do bloco de hoje. Nota da seção (dev-only, declara o exemplo): "Série de exemplo no mesmo shape da home do jogador (lá entra a série real de 6 meses). Toque e arraste no gráfico para ver o crosshair."
- **Dado:** **EXEMPLO DECLARADO** — a galeria é dev-only e não consulta o dashboard (o dado real exige o ator jogador), então o item usa o MESMO shape (`performance.byMonth`) passado pelo MESMO builder (`buildPlayerResultsChart`) sobre 6 meses de exemplo (`[component].tsx:250-266`). Na home entra a série real.

### Nativo (fatos; nenhuma build rodada)

- **Pacotes:** `victory-native` ^41.26.0 (instalado 41.26.0; JS-only, sem pod — o pacote só tem `dist/` e `src/`) e `@shopify/react-native-skia` 2.12.0 (instalado 2.12.0), que faz o render.
- **Pods:** `ios/Podfile.lock:1893` traz `react-native-skia (2.12.0)` com o path pro node_modules (:2730 e :2949-2950), e `ios/Pods/Manifest.lock` é IDÊNTICO ao `Podfile.lock` (conferido por `diff`) → **pods em sync**.
- **O dev client instalado JÁ carrega o Skia:** o `BROpen.app` instalado no simulador (`~/Library/Developer/CoreSimulator/Devices/F849F6FF.../data/Containers/Bundle/Application/19028B62.../BROpen.app`) é o build local de **2026-09-19 11:56** e o `BROpen.debug.dylib` dele tem o RNSkia linkado (2046 ocorrências de "skia" nas strings; símbolos `RNSkia..RNSkPlatformContext`), idêntico ao build de `~/Library/Developer/Xcode/DerivedData/BROpen-agdcz.../Build/Products/Debug-iphonesimulator/BROpen.app`. **Conclusão: o item da galeria renderiza no dev client atual, SEM build nova.** Ressalva: um binário reinstalado anterior a 19/09 11:51 precisaria de rebuild (RUL-0031/RUL-0028).

### Status

- **Aguardando a APROVAÇÃO do usuário** na galeria (variante por variante). **Nada foi aplicado nas telas:** o bloco "Partidas por mês" da home do jogador segue como o round 2 deixou (`KpiCard` com a série em texto, `pages/home/player-dashboard.tsx:66`) — a ordem nova dele (chart no lugar do KPI) só vale depois da aprovação do item.

## Galeria: item Gráfico — refinamento (IBX-0075 r3b — 20-09-2026, sem commit)

O usuário REPROVOU o formato do r3 (3 variantes + barras) e ditou o alvo: **UM chart só**, linha SUAVE, toque/arrasto com TOOLTIP, **degradê** sob a linha e título/description no `Text` do app. Item refinado; **a home continua intocada**.

### Receita doc-first (prova no pacote instalado, 1.0.0-beta.10)

- **Degradê (área com gradiente do accent pra transparente):** doc bundled `area-chart.md`, seção **"Gradient fill" :46-60** — o `LinearGradient` do Skia entra como FILHO do `AreaChart.Area` (`colors` / `start` / `end={vec(...)}`); o `AreaChart.Area` aceita `children` e "Skia paint props" (tabela :291-299, com `colorClassName` default `accent-chart-3` :295 e `opacity` default `0.2` :296).
- **Linha suave:** `area-chart.md` **"Curve type" :62-70** (`curveType="monotoneX"`, o `type="monotone"` da web) e `line-chart.md` **"Curve type" :65**.
- **Linha por cima da área:** `area-chart.md` **"Outline strokes on top of areas" :208-210** — "Pair `AreaChart.Area` ... with `LineChart.Line` to render a solid outline along the area's top edge in its matching color" (exatamente o que o item faz).
- **Toque + tooltip:** `area-chart.md` **"Chart press overlays" :212-214** e o exemplo canônico do card em **"Example" :216-278** (Card + `AreaChart` com `chartPressState`, `Area curveType="monotoneX"` e overlays gated por `isActive`); o balão de valor é a receita do `line-chart.md` **"ChartCrosshair.Value (RN overlay label)" :247-310** (`Anchor` envolvendo o chart + o Value, `chartBounds` do `onChartBoundsChange`, `isActive={state.isActive}`, `x={state.x.position}`); o balão é a casca `className="bg-accent px-4 pb-2"` com o filho EXPLÍCITO `<ChartCrosshair.ValueLabel className="text-sm" />` (`monthly-chart-card.tsx:63-64`) e a LARGURA não é classe: vem da semente do maior rótulo no `value` + o piso do PRÓPRIO tema (`.chart-crosshair__value-container` do pacote, `min-width: calc(var(--spacing) * 14)`) — **a receita da doc era `className="min-w-20 px-2"` e NÃO é o conserto do BUG-0055**; o ponto do dedo é o `ChartIndicator` (`chart-indicator.types.d.ts:40` e :45).
- **Cor do accent em JS (pro degradê):** o próprio pacote expõe **`useThemeColorPro`** (`helpers/external/hooks/use-theme-color-pro.js:60`; exportado na raiz em `lib/typescript/src/index.d.ts:52` e no subpath `heroui-native-pro/hooks`, `package.json:16-19`), e o token **`chart-3` é o accent puro** (`--chart-3: var(--accent)`, `styles/theme.css:10`).
- **Nada do alvo ficou de fora:** todos os elementos existem na versão instalada — o gradiente por `LinearGradient` do Skia é a receita OFICIAL da doc (não desenho na mão).

### Antes → depois do item

> **Linhas do estado PRE-r4** (antes da extração do componente no r4): os file:line desta tabela descrevem o layout INLINE da galeria, que não existe mais. Receita VIGENTE (reponteada no fecho do BUG-0055): `src/components/ui/monthly-chart-card.tsx` — componente :117-193, `ChartCrosshair.Anchor` :133, `AreaChart.Area` :150, gradiente :157 (o `LinearGradient`), `LineChart.Line` :163, `ChartIndicator` :170, `ChartCrosshair` :174, `ChartCrosshair.Value` :63 (dentro do `ChartCrosshairValue` :47-67) (no r4 eram `monthly-matches-card.tsx:74-124` com Anchor :74, Area :90, gradiente :97, linha :103, indicador :110, crosshair :114 e Value :124; o arquivo NÃO existe mais) — seção r4.

| | r3 (reprovado) | r3b (este) |
| --- | --- | --- |
| Estrutura | 3 variantes numeradas (`VariantSection`) | **UM bloco só**, sem numeração (`ChartCrosshairGallerySection` :397 com `GalleryMatchesChartCard` :302) |
| Chart | `BarChart.Bar` e `LineChart` retos | **`AreaChart.Area`** com `curveType="monotoneX"` + **`LinearGradient`** (accent -> transparente) + **`LineChart.Line`** suave por cima (:337-365) |
| Press | crosshair (com variantes sólido/ghost) | **indicador + crosshair + balão** — `ChartIndicator` :371, `ChartCrosshair` :375, `ChartCrosshair.Value` :385 |
| Título/description | `Card.Title` / `Card.Description` | **`Text` do app**: `Text size="base" weight="semibold"` :320 e `Text className="flex-1" color="muted" numberOfLines={1} variant="description"` :330 — o estilo que o usuário colou, já aplicado POR ELE no disco às 09:34 e preservado byte a byte |
| Dado | exemplo declarado | igual: exemplo declarado, mesmo shape/builder (`buildPlayerResultsChart`, :260-273) |

- **Copy (mantida do r3):** título **"Partidas por mês"** e description **"Total de partidas por mês nos últimos 6 meses."**; o balão mostra **"set. · 4"** (mês · total). Nota da seção: "Série de exemplo no mesmo shape da home do jogador (lá entra a série real de 6 meses). Toque e arraste no gráfico para ver o crosshair."
- **Valores escolhidos (apontados):** altura do chart `h-48` (prop do wrapper), `accent-chart-3` na área e na linha + o accent resolvido pro gradiente (`useThemeColorPro("chart-3")`), `opacity={0.35}` na área (a doc usa 0.35 no exemplo de degradê; o default do componente é 0.2) e o balão na casca `bg-accent px-4 pb-2` com `<ChartCrosshair.ValueLabel className="text-sm" />` (**era a receita da doc `className="min-w-20 px-2"`; mudou no WIP do usuário, 21-09-2026 — a largura vem da semente do maior rótulo + o piso do tema).
- **Status:** aguardando a aprovação do usuário na galeria. **A home seguiu com o `KpiCard`** do round 2 (`pages/home/player-dashboard.tsx:66`) até a aprovação — SUPERSEDE r4: aprovado e aplicado (ver seção no fim).

## Galeria: item Gráfico — fix do eixo X (IBX-0075 r3c — 20-09-2026, sem commit)

Feedback visual do usuário no item da galeria: o eixo X mostrava **abr., mai., jul., ago., set.** e o **"jun." não aparecia** — 6 pontos no dado, 5 rótulos no eixo.

### Causa (prova no pacote instalado)

- Com campo de texto o victory-native gera os ticks do eixo X **reduzindo a lista por `tickCount`**: `getXAxisTicks` usa `downsampleTicks(ix.map((_, index) => index), tickCount)` no ramo categórico (`victory-native/dist/cartesian/utils/getXAxisTicks.js:10`) e o `tickCount` default é **5** (`victory-native/dist/utils/tickHelpers.js:4`, `DEFAULT_TICK_COUNT`; default do eixo em `cartesian/components/XAxis.js:19`, repassado em :24-30). O `downsampleTicks` (:11-30) com 6 índices e 5 ticks dá `round(i * 5 / 4)` = **[0, 1, 3, 4, 5]** — o índice 2 ("jun.") é DESCARTADO. O pacote Pro não injeta `tickCount` (`helpers/internal/components/base-cartesian-chart.js:145-166` só faz merge de font/cores).
- A doc bundled cobre exatamente esse caminho: **`bar-chart.md`, "Categorical X-axis tick values" :153-171** — "When the X field is a `string`, victory-native's default tick generator can return fractional positions... Generate integer indices for `xAxis.tickValues` to keep labels aligned", com o snippet `const tickValues = Array.from({ length: DATA.length }, (_, index) => index)` + `xAxis={{ tickValues }}` (:158 e :164) e o mesmo helper no exemplo (:226-227); o `xAxis` é prop documentada dos charts do Pro (`area-chart.md:289`, "all chart props ... `xAxis`, `yAxis` ... are supported"). **O que a doc NÃO cobre:** o downsample por `tickCount` (o ramo acima é do victory-native) — então a receita fica `tickValues` (doc) **+ `tickCount`** com o número de pontos, senão o rótulo continua sendo cortado.

### Antes → depois (só no item da galeria)

| | antes | depois |
| --- | --- | --- |
| Eixo X | ticks default do victory-native (5) — "jun." fora | **6 rótulos, um por mês** (`abr., mai., jun., jul., ago., set.`) |
| Props | — | `AreaChart` recebeu `xAxis={{ tickCount: 6, tickValues: [0..5] }}` (no r3c, **pre-r4**, no `[component].tsx`; hoje `src/components/ui/monthly-chart-card.tsx:143`) |
| Helper | — | `categoryAxisTickValues(count)` = `Array.from({ length: count }, (_, index) => index)` (recipe da doc; no r3c era `[component].tsx:282-283` + `galleryMonthTickValues` :285-287, **pre-r4** — hoje o mesmo `Array.from` vive no `useMemo` do componente, `src/components/ui/monthly-chart-card.tsx:97-100`) |

- **Correção no ITEM** (props do chart), **não no componente do pacote**: nada foi alterado em `node_modules`, nenhum eixo desenhado na mão, nenhum componente novo.
- **Dado, copy, altura, degradê, curva, crosshair e o `Text` do título/description seguem iguais** (WIP do usuário intocado). Status: aprovado no r4 — a home trocou o `KpiCard` pelo chart (no r4 era o `MonthlyMatchesCard`, `pages/home/player-dashboard.tsx:66`; hoje é o `MonthlyChartCard`, `pages/home/player-dashboard.tsx:80-84`; ver seção no fim).

## Chart "Partidas por mês" aplicado na home (IBX-0075 r4 — 20-09-2026, sem commit)

O usuário aprovou o item da galeria ("certo!"): o bloco "Partidas por mês" da home do jogador **deixou de ser KpiCard** e passou a ser o chart aprovado, com a **série real**.

### Componente único (RUL-0005)

- **`MonthlyMatchesCard`** — `src/components/ui/monthly-matches-card.tsx` (type `MonthlyMatchesPoint` :19-22, componente :40-129; nome ESCOLHIDO no vocabulário do app, no molde dos vizinhos `*-card.tsx`: retângulo do bloco "Partidas por mês"). **(SUPERSEDE no IBX-0078 — 21-09-2026: o arquivo virou o genérico `src/components/ui/monthly-chart-card.tsx` (`MonthlyChartCard`, type `MonthlyChartPoint`) com `data`, `title`, `description` e `formatValue`; o desenho é idêntico. Ver a seção do IBX-0078 no fim.)** Carrega, sem mudança visual nenhuma, o que foi aprovado na galeria: `Card` de superfície + `Card.Body` + o `Text` do app do título (`size="base" weight="semibold"`) e da description (`className="flex-1" color="muted" numberOfLines={1} variant="description"`) — o estilo do WIP do usuário —, e o chart na receita da doc: `AreaChart.Area curveType="monotoneX"` + `LinearGradient` (accent -> transparente) + `LineChart.Line` + `ChartIndicator` + `ChartCrosshair` + `ChartCrosshair.Value`.
- **Props:** ~~só `data: MonthlyMatchesPoint[]` (`{ label, matches }`) — o dado entra PRONTO, o componente não soma nada (nenhuma regra de negócio dentro dele).~~ **(SUPERSEDE no IBX-0078/BUG-0055: hoje são `data` `{ label, value }`, `title`, `description`, `formatValue?` e `formatAxis?` — `monthly-chart-card.tsx:69-76`.)** O princípio segue: o dado entra PRONTO e o componente não soma nada.
- **Escolhas aprovadas preservadas:** `h-48`, `opacity={0.35}`, balão na casca `bg-accent px-4 pb-2` com `ChartCrosshair.ValueLabel` `text-sm` (**era `min-w-20 px-2`, receita da doc — mudou no WIP do usuário, 21-09-2026**), `accent-chart-3` na área e na linha, accent do `useThemeColorPro("chart-3")` no degradê e o eixo com `xAxis={{ tickCount, tickValues }}` — os índices agora vêm do `useMemo` sobre `props.data.length` (`src/components/ui/monthly-chart-card.tsx:97-100`, o arquivo `monthly-matches-card.tsx` desta linha NÃO existe mais — IBX-0078), mesma receita da doc.
- **Copy:** "Partidas por mês" + "Total de partidas por mês nos últimos 6 meses." (as do item aprovado, dentro do componente).

### Galeria consumindo o componente

- `settings/components/[component].tsx`: a seção do item continua igual, agora com **`<MonthlyChartCard data={galleryMatchesByMonth} title="Partidas por mês" description="Total de partidas por mês nos últimos 6 meses." />` (`[component].tsx:306-310`; no r4 era `<MonthlyMatchesCard data={galleryMatchesByMonth} />` :278, nome que não existe mais)** (a seção e a nota de dado de exemplo seguem no lugar). O que saiu do arquivo: o card local (`GalleryMatchesChartCard`), o helper `categoryAxisTickValues`/`galleryMonthTickValues` e os imports que só ele usava (Skia, `heroui-native-pro`, `useState`, `useDerivedValue`, victory-native) — nenhuma cópia do bloco restou.
- O dado da galeria é o mesmo de antes: **exemplo declarado** (`galleryResultsByMonth` em `src/app/(private)/settings/components/[component].tsx:250-266`, shape do `performance.byMonth` passado pelo mesmo `buildPlayerResultsChart`).

### Home do jogador com o chart

- `pages/home/player-dashboard.tsx:80-84` (**no r4 era :66**) — bloco 2 na ORDEM ditada: **`<MonthlyChartCard data={monthlyMatches} title="Partidas por mês" description="Total de partidas por mês nos últimos 6 meses." />`** ocupando a largura toda (o card aprovado), com a **série REAL** que a tela já carregava: `buildPlayerResultsChart(performance.byMonth)` (:49) `months: 6` do `player.dashboard.getOverview`; a série vira `{ label, value }` com o MESMO `wins + losses` que o texto antigo já somava (`src/components/pages/home/player-dashboard.tsx:57-60`). **Zero contrato novo, zero query nova, zero cálculo novo.**
- **O que saiu da home:** o `KpiCard label="Partidas por mês"` (com o valor em texto) e a const `monthlyText` do `join(" · ")` — ninguém mais consome (`KpiCard` segue usado nos outros quatro blocos). O **loading continua o mesmo**: `LoadingState` no `isPending` (`src/components/pages/home/player-dashboard.tsx:35`), sem skeleton nem prop de loading nova no card.
- Ordem final da home (inalterada na ordem, com o bloco 1 JÁ LIGADO): 1 Pendências/Alertas (**`PendingsAlerts` do servidor**, Etapa 2 do PLN-0008) · 2 **MonthlyChartCard** · 3 Vitórias/Derrotas/Aproveitamento (linha 3) · 4 Suas inscrições · 5 Próximos jogos (GAP).

### Varredura

- Nenhuma outra tela renderiza o bloco "Partidas por mês" (grep em `src/`: só o componente, a galeria e a home citam o nome).

## Galeria: item Alertas (IBX-0076 r1 — 20-09-2026, sem commit)

Superfície de APROVAÇÃO VISUAL do sistema de pendências/alertas (PLN-0008, card IBX-0076). Nesta rodada entrou SÓ a galeria dev: nenhum contrato, nenhum backend, nenhum wiring em tela e nenhum builder tocado (o inventário do que existe hoje está em `/tmp/br-open-alertas-inventario.md`, com os 8 usos reais do `WidgetAlert`).

- **Registro:** `src/lib/dev/component-registry.ts:36-40` ganhou a entrada `Alertas` (`id: "alerts"` em inglês como o RUL-0013 pede, título "Alertas" e descrição "Alertas e pendências por caso de uso para aprovação"). A listagem (`settings/components/index.tsx`) e a rota dinâmica leem do registro: nenhum arquivo novo.
- **Tela:** `settings/components/[component].tsx` — `AlertsVariantsSection` (:460-709) e o ramo da rota `entry.id === "alerts"` (:1288-1289). A moldura `VariantSection` ganhou a prop OPCIONAL `note` (:48-66), a linha de procedência de cada cartão; os outros itens (KPI, Texto, Inscrição, Gráfico) não mudam.
- **Base visual:** o `WidgetAlert` REAL (`ui/widget-alert.tsx:16-37`) com o vocabulário de severidade que ele já tem (accent/danger/default/success/warning) mais o `Button` no molde das telas. Nenhum componente paralelo de alerta, nenhuma severidade nova, nenhuma classe de tint nova. Os CTAs são no-op (a galeria aprova, não executa) e o feedback de toque é o do próprio `Button` (RUL-0035).
- **Copy real do builder, não transcrita:** ~~os três estados de pagamento saíam do builder real dentro do `GalleryPaymentAlert`, com dado de exemplo declarado~~ **EXTINTO:** `GalleryPaymentAlert`, `galleryNow` e esses três alerts NÃO existem mais em `src/` (grep vazio em 23-09; os file:line desta parte não valem no disco) e `presentation.ts:215-217` hoje é o ramo `pending` ("Pendente") — o `Renovar` do suspenso saiu no IBX-0084 — no alerta de TELA esse botão não existe: o ramo do suspenso sai do builder com `actionLabel: null` e a ação real vive no rodapé de entrada. O resto da copy real é literal de tela (títulos com pluralização montados no JSX) e cada cartão cita o file:line. **(SUPERSEDE na Etapa 2 do PLN-0008, 20-09: o builder foi extinto e a galeria passou a carregar a copy do SERVIDOR em literal, citando `convex/domains/payment/pendings-rules.ts` — ver a seção "Pendências em tela — Etapa 2".)**

### Cartões (contexto no título, um por caso)

| Cartão | Marcador | Caso | Origem da copy |
|---|---|---|---|
| Alerta 4 | REAL + composição nova | Torneio (jogador): inscrição aguardando pagamento | título do card que morava em `pages/tournaments/player-overview.tsx:108-117` (bloco EXTINTO no IBX-0080; a referência viva do card do jogador é `entries.tsx:490-537`); CTA `Pagar` do card `entries.tsx:111-121` |
| Alerta 5 | REAL + composição nova | Torneio (jogador): convite de dupla recebido | título e status accent do card de convite que morava em `player-overview.tsx:119-124` (bloco EXTINTO no IBX-0080); par de ícones do molde, hoje `entries.tsx:86-110` |
| Alerta 6 | PROPOSTA | Torneio (jogador): convite de dupla enviado | nova; o real hoje é o chip `Aguardando parceiro` (`lib/tournaments/tournament-details-derived.ts:118`) |
| Alerta 7 | PROPOSTA | Torneio (jogador): inscrição aguardando aprovação | nova; o real hoje é o chip `Aguardando aprovação` (`:117`) |
| Alerta 11 | REAL | Torneio (organizador): inscrições aguardando aprovação | `pages/tournaments/organizer-overview.tsx:53-58` (accent) |
| Alerta 12 | REAL | Torneio (organizador): inscrições aguardando pagamento | `pages/tournaments/organizer-overview.tsx:53-58` |
| Alerta 15 | PROPOSTA | Torneio (organizador): confronto sem agendamento | nova; aviso real mais próximo `lib/tournaments/tournament-details-derived.ts:435-441` |

### Divergências e apontamentos (o que não coube no shape)

- **Um CTA só:** o `WidgetAlert` aceita UMA ação (`ui/widget-alert.tsx:27-32` e `:59-60`). Onde o caso pede duas (convite de dupla), o par entrou composto abaixo do alerta com os ícones do molde real (hoje `entries.tsx:86-110`, Alerta 5; o trecho vivia em `player-overview.tsx:188-209`, extinto no IBX-0080); ação dentro do alerta é composição NOVA nos cartões 4 e 5: hoje esses alertas não têm CTA. **SUPERSEDE (r2):** o par de botões fora do alerta foi REPROVADO pelo usuário; as ações passaram para dentro da superfície (ver seção do r2).
- **Status pedido diferente do status real:** convite de dupla recebido (accent real, o pedido dizia warning), organizador aguardando aprovação (accent real, pedido warning), conta de pagamento (warning real, pedido danger) e mensalidade em atraso (CTA real `Pagar agora`, pedido renovar). Em todos, o cartão mostra o REAL e a nota registra a diferença: a marcação do usuário decide.
- **`info` não existe no componente:** o vocabulário é accent/danger/default/success/warning; o pedido dizia info e os cartões 6 e 7 usam accent, com a nota explicando.
- **Casos que não existem como alerta hoje** (cartões 6, 7, 13, 14 e 15): nascem como PROPOSTA de copy e o equivalente real de cada um está na nota (chip de status, cards da aba, badge, aviso do diálogo Iniciar).
- **`sem placar` não existe como estado** no torneio (a partida é A definir, Agendada, Encerrada ou W.O., `lib/tournaments/tournament-details-derived.ts:137-148`) e **qual confronto conta como pendência ainda não tem regra**: apontado no cartão 15, não inventado.

### Três estilos divergentes (cartão "Estilos divergentes hoje", :546-593)

Lado a lado, no mesmo item: (a) o `WidgetAlert`, o alerta do app; (b) o `Alert` cru do HeroUI como está hoje em Notificações (`settings/notifications.tsx:480-497`); (c) o `Surface bg-warning-soft` do diálogo Iniciar (`tournaments/[tournamentId]/index.tsx:607-611`), com o aviso real de convite sem resposta (`lib/tournaments/tournament-details-derived.ts:427`). O quarto molde, o `RNAlert.alert` nativo com o mesmo aviso de notificações (`settings/notifications.tsx:317-329`), está citado na nota e não dá para renderizar em tela. **Nenhum desses dois arquivos foi alterado** (`settings/notifications.tsx` e o cartão da galeria, que usa cópias locais do `Alert` e do `Surface`): a decisão de unificar é do usuário.

### Fora de escopo (não tocado)

Nenhum wiring em tela, nada em `convex/`, nenhum contrato, nenhum builder alterado, nenhuma tela de torneio/home tocada; o gate dev-only (`EXPO_PUBLIC_IS_DEV`) da listagem e da rota segue intacto. Gates desta rodada: `bun run check` (430 arquivos, tsc app + convex) e `bun test src` (528/528) verdes, `git diff --check` limpo. SEM COMMIT.
**Citações de linha do r1:** superadas pela reescrita do r2 (a seção do r2 abaixo é a VIGENTE; os números do r1 valiam no arquivo de então).

## Galeria: item Alertas — round 2 (IBX-0076 r2 — 20-09-2026, sem commit)

O usuário reprovou o r1 e ditou 5 ajustes literais: CTA de UMA palavra, TODO alerta com título E descrição, revisar o botão dentro do alerta contra o padrão do HeroUI, refazer o convite de dupla (descrição com quem/para que/onde + ações DENTRO da superfície) e doc-first do Alert. Só a galeria dev mudou, mais o componente de alerta do app (abaixo): nada de tela, contrato ou builder.

### Doc-first: o padrão do HeroUI Native para AÇÃO dentro do alerta

Prova na doc BUNDLED da versão instalada (`heroui-native` 1.0.9) e no MCP de docs do HeroUI Native (conteúdo idêntico; o cabeçalho do MCP marca `Category: native` e a fonte é `native/components/(feedback)/alert.mdx`, ou seja **NÃO é web-only**):

- **Anatomia SEM slot de ação** — `node_modules/heroui-native/lib/module/components/alert/alert.md:11-27`: `Alert > Alert.Indicator + Alert.Content(Alert.Title, Alert.Description)`. A ação é um `Button` IRMÃO do conteúdo: "Place additional elements like buttons alongside the content" (`:91-93`), com o exemplo canônico `<Button size="sm" variant="primary">Refresh</Button>` (`:104`).
- **Variante da ação pelo status do alerta:** o exemplo oficial usa `variant="primary"` no alerta `accent` (`:160`) e **`variant="danger"` no alerta `danger`** (`:174`). Semântica no pacote: `primary` = `--color-accent` (`lib/module/styles/components/button.css:10-12`), `danger` = `--color-danger` (`:32`), `secondary` = `--color-default` (`:14`); "seven visual variants for different emphasis levels" (`lib/module/components/button/button.md:79-91`, tamanhos em `:69-77`).
- **Tamanho:** `size="sm"` em todos os exemplos de alerta com ação (`alert.md:104`, `:160`, `:174`) — o app JÁ usava `sm`: sem mudança.
- **Status de cor:** exatamente `default | accent | success | warning | danger` (`alert.md:50` e a API `:195-205`).
- **Layout que sustenta o botão irmão:** raiz `flex-direction: row; gap: 12px` e conteúdo `flex: 1` (`lib/module/styles/components/alert.css:1-8` e `:21-23`), com o conteúdo sem gap interno (por isso a ação secundária dentro do conteúdo leva espaçamento próprio).

O que a doc **cobre**: anatomia e partes, os 5 status, o lugar da ação (irmão do conteúdo), um exemplo de ação por status (`accent` + `primary`; `danger` + `danger`), o tamanho `sm`, o par título + descrição como uso básico e a opção "Title Only" (`alert.md:78-80`).
O que a doc **NÃO cobre** (apontado, sem improviso): (1) não existe seção de do/dont; (2) **mais de uma ação** no alerta (sem slot e sem exemplo) — a composição do cartão 5 é decisão nossa; (3) variante de ação para o status `warning` (a doc só exemplifica accent e danger); (4) qualquer par de hierarquia entre ação principal e secundária (o Button só lista "emphasis levels"); (5) o nível `info` (não existe no vocabulário).

### Mudanças no componente do app (`src/components/ui/widget-alert.tsx`)

| Antes | Depois | Por quê |
|---|---|---|
| `Button size="sm" variant="primary"` fixo | `size="sm"` + `variant={props.status === "danger" ? "danger" : "primary"}` (:51) | padrão da doc: alerta danger usa ação danger (`alert.md:174`) |
| sem ação secundária | prop OPCIONAL `secondaryAction` (:13), renderizada DENTRO do `Alert.Content` como `Button size="sm" variant="secondary" className="mt-1.5 self-start"` (:34-44) | ordem do usuário (ações dentro da superfície); o alerta não tem slot para duas ações |

Impacto nos 8 usos existentes: **zero** — os status em uso são `warning` (×4), `accent` (×2) e o dinâmico do builder (o ramo `danger` do suspenso, que desde o BUG-0042 renderiza no `GuestOverview` — sem ação naquele momento; desde o IBX-0084 o item do servidor manda o CTA `Renovar`), e nenhum uso passa `secondaryAction`. `size="sm"` já era o padrão da doc.

### Antes → depois por cartão (r1 → r2)

| # | Título | Descrição | CTA |
|---|---|---|---|
| 4 | igual (real) | nenhuma → **PROPOSTA** (a doc e o app permitiam só título) | nenhum → `Pagar` (rótulo real do card, já de uma palavra) |
| 5 | igual (real) | vaga → **PROPOSTA** com QUEM convida, PARA QUE (categoria) e ONDE (competição), com nomes de exemplo | 2 ícones FORA do alerta → `Aceitar` no slot de ação + `Recusar` (variant secondary) DENTRO do conteúdo |
| 6 | igual | ganhou quem foi convidado, categoria e competição | sem CTA |
| 7 | igual | igual | sem CTA |
| 11 | igual (real) | nenhuma → **PROPOSTA** | `Ver` igual |
| 12 | igual (real) | nenhuma → **PROPOSTA** | `Ver` igual |
| 15 | igual (PROPOSTA) | igual | sem CTA |
| Estilos | separado e rotulado, agora com blocos `a` a `d` | igual | `Abrir ajustes` real em `a`/`b` + bloco `d` com a proposta `Ajustes` |

Na galeria TODOS os 15 cartões e os 4 blocos do cartão de estilos têm título E descrição; a única supressão do r1 é o par de ícones fora do alerta (cartão 5), que saiu — nenhum botão da galeria vive fora de uma superfície de alerta.

### Apontamentos do r2

- **Rótulos reais de DUAS palavras** (mantidos como reais, cada um com a proposta de uma palavra renderizada ao lado): `Pagar agora`, `Renovar mensalidade`, `Renovar inscrição`, `Conectar conta` e `Abrir ajustes` (cartão de estilos). `Ver` e `Pagar` já eram de uma palavra. **(SUPERSEDE no IBX-0084, 21/09: `Renovar inscrição` saiu da lista — o ramo `suspended` de `getMembershipActionLabel` foi apagado junto com o CTA do rodapé, e o rótulo do estado passou a ser `Renovar`, do servidor; os outros quatro seguem como estavam.)**
- **`info` continua não existindo**: cartões 6 e 7 usam `accent` (não inventei severidade).
- **Título + descrição obrigatórios na galeria, prop opcional no componente:** tornar `description` obrigatório mexeria nas 8 telas vivas (e a doc permite "Title Only", `alert.md:78-80`) — decisão do usuário.
- **Doc não cobre duas ações nem hierarquia** (acima): a composição `Aceitar` no slot + `Recusar` no conteúdo é nossa, dentro da superfície do alerta.
- **Sem verificação visual** (RUL-0025, sem device/simulador): o encaixe do botão secundário dentro do conteúdo (`mt-1.5 self-start`, `widget-alert.tsx:36`) é o ponto a conferir no dedo.

### Fora de escopo (não tocado)

Nenhum wiring em tela, nada em `convex/`, nenhum contrato, nenhum builder alterado, nenhuma tela de torneio/home tocada, nenhum dos arquivos dos estilos divergentes alterado, WIP do usuário em `ui/kpi-card.tsx` intocado. Gates: `bun run check` (430 arquivos, tsc app + convex) e `bun test src` (528/528) verdes, `git diff --check` limpo. Arquivos: `src/components/ui/widget-alert.tsx`, `src/app/(private)/settings/components/[component].tsx`, `src/lib/dev/component-registry.ts` (entrada do r1, sem mudança) e esta spec. SEM COMMIT.

## Galeria: item Alertas — round 3 (IBX-0076 r3 — 20-09-2026, sem commit)

Ajustes literais do usuário depois de ele aprovar a direção ("ta melhorando, bastante"): (1) as ações do convite de dupla no RODAPÉ do alerta, dentro da superfície e na mesma linha; (2) nomes/categoria/competição em NEGRITO dentro da descrição; (3) CTA de UMA palavra como a única ação renderizada. Só a galeria dev mudou, mais o componente `WidgetAlert`. Nada de tela, contrato ou builder.

### Rodapé de ações (ordem COPIADA do molde, RUL-0007)

- **Ordem provada no molde do app** — `entries.tsx:88-98` (recusar: `respondPartnerInvite.mutate({accept: false, entryId})`, `variant="outline"`) e `:99-108` (aceitar: `respondPartnerInvite.mutate({accept: true, entryId})`, botão padrão), no ramo mine da aba Inscrições — o trecho vivia em `pages/tournaments/player-overview.tsx:188-209`, EXTINTO no IBX-0080 (as props `onRespondInvite`/`onCancelEntry`/`onPayEntry` não existem mais): a secundária primeiro e a que CONFIRMA por último, exatamente a regra pedida. Copiada, não inventada.
- **`src/components/ui/widget-alert.tsx`**: com `secondaryAction`, as DUAS ações vão para uma linha no rodapé do alerta, dentro do `Alert.Content` (`mt-1.5 flex-row items-center gap-2 self-end`, :62-75), na ordem secundária → principal. Sem `secondaryAction`, a ação principal segue no slot irmão do conteúdo (:77-79), o layout que as 8 telas vivas já usam. O botão foi extraído em `WidgetAlertButton` (:27-41) para o JSX não existir duas vezes.
- Impacto nos 8 usos existentes: **zero** (nenhum passa `secondaryAction` — grep confirmado).
- **Apontamento:** a doc do HeroUI coloca a ação como irmã do conteúdo (`alert.md:91-108`) e **não cobre duas ações**; o rodapé dentro do conteúdo é composição nossa, ainda dentro da superfície do alerta.

### Trechos destacados (negrito) na descrição

- **Mecanismo verificado no código, não suposto:** (a) o `better-styled` monta o className na ordem base → variantes (na ordem das chaves) → `className` do consumidor (`node_modules/better-styled/dist/index.js:1`, função interna `fH`: `p(base, variantClasses, compoundVariants, rest)`); (b) o `Text` do app declara as variantes na ordem `align, color, size, variant, weight` (`src/components/core/text.tsx:18-57`, com `weight` por último, :50); (c) o Uniwind resolve propriedade por propriedade e **o token POSTERIOR vence** quando a complexidade empata (`node_modules/uniwind/src/core/native/store.ts:158-182`: o guard de `complexity`/`important` em :162-174 e a escrita `resultGetters[property] = valueGetter` em :182). A doc do Uniwind avisa que não há dedupe de classes em conflito (`style-specificity#class-name-conflicts`), e é por isso que a parte destacada repete `color`/`variant` do texto em volta e só troca o peso.
- **API:** `description?: ReactNode` (`widget-alert.tsx:64`) — string continua funcionando (os 8 usos vivos passam string; nada muda neles) e a galeria passa PARTES.
- **Na galeria:** ~~o type `AlertDescriptionPart = { isHighlighted?, text }` (:330) e o renderizador `HighlightedDescription` (:332-351)~~ **EXTINTO:** nem o type (hoje `WidgetAlertDescriptionPart`, `ui/widget-alert.tsx:40-43`) nem o renderizador local existem mais em `src/` (grep vazio em 23-09). O destaque saía como `Text color="muted" variant="description" weight="semibold"` — mesmo tamanho e cor da descrição do alerta, só o peso muda; as partes sem destaque ficam sem wrapper e herdam o estilo da `Alert.Description`.
- **Apontamento:** um `Text` aninhado SEM `color`/`variant` explícitos repinta a parte com as classes base do componente (`text-foreground` + `text-base`), saindo maior e na cor padrão.
- **Cartões com destaque:** 5 (Marina Costa, Duplas Mistas, Copa Dracena 8), 6 (Gustavo Lima, Duplas Mistas, Copa Dracena 8) e 9 (o prazo, 3 dias). O texto final é o mesmo dos rounds anteriores, só dividido em partes; a categoria usa o formato real do app (`convex/domains/tournament/entry-rules.ts:29-38`).
- **Cartões 1 a 3 não têm destaque:** a descrição deles é a copy REAL do builder, que devolve string.

### Contrato futuro (nota para o PLN-0008 / IBX-0076)

O item de pendência **não pode** carregar `description: string`: precisa carregar **PARTES** (`{ text, isHighlighted? }[]`), porque o destaque é decisão de quem PRODUZ a pendência (o servidor), não da tela. O shape provado nesta rodada é o da galeria, e o renderizador pode ser o próprio `Text` do app (`src/components/core/text.tsx`). Requisito registrado para o contrato; nada implementado em `convex/` nesta rodada.

### CTA de uma palavra (o que saiu de cena)

- A galeria agora renderiza **só** o rótulo de uma palavra: `Pagar`, `Renovar` (×2), `Conectar`, `Ajustes`, `Ver` (×3), `Revisar`, `Aceitar`, `Recusar` — nenhum botão com duas palavras (checagem mecânica).
- **Divergências APONTADAS** (cópias reais de duas palavras que o app usa hoje e que só voltam ao botão quando o contrato/servidor mandar o rótulo): `Conectar conta` (`pages/organization/organization-form-fields.tsx:1088`) e `Abrir ajustes` (`settings/notifications.tsx:390`).
- O cartão de estilos divergentes usa `Ajustes` nos blocos `a` e `b` (o rótulo real do molde de Notificações fica apontado na nota) e o bloco `d` (comparação de rótulo) saiu: com uma palavra em `a`, ele ficou redundante.

### Antes → depois por cartão (r2 → r3)

| # | O que mudou |
|---|---|
| 4 | igual (`Pagar`, já de uma palavra) |
| 5 | `Aceitar` no slot + `Recusar` abaixo → as DUAS no rodapé do alerta, mesma linha, `Recusar` antes de `Aceitar`; descrição com trechos destacados |
| 6 | descrição com trechos destacados (mesmo texto do r2) |
| 7 e 8 | iguais |
| 11 a 15 | iguais |
| Estilos | `a` e `b` com `Ajustes`, bloco `d` removido, rótulo real `Abrir ajustes` apontado |

### Fora de escopo (não tocado)

Nenhum wiring em tela, nada em `convex/`, nenhum contrato, nenhum builder alterado, nenhuma tela de torneio/home tocada, nenhum dos arquivos dos estilos divergentes alterado, WIP do usuário em `ui/kpi-card.tsx` intocado; o gate dev-only (`EXPO_PUBLIC_IS_DEV`) segue intacto. Checagem mecânica desta rodada: 15 cartões numerados 1 a 15, nenhum `WidgetAlert` sem descrição, nenhum rótulo com duas palavras, nenhuma das 5 cópias reais de duas palavras renderizada como botão, nenhum botão fora de superfície de alerta. Gates: `bun run check` (430 arquivos, tsc app + convex) e `bun test src` (528/528) verdes, `git diff --check` limpo. SEM COMMIT.

## Galeria: item Alertas — round 4 (IBX-0076 r4 — 20-09-2026, sem commit)

Dois ajustes: (1) o WIP do usuário no destaque (semi-bold → **bold**) é verdade intocável; (2) alerta que AGREGA mais de um tipo de pendência passa a mostrar **uma LINHA por tipo**, nunca uma frase com separador no meio. Só a galeria dev e o `WidgetAlert`; nada de tela, contrato ou builder.

### WIP do usuário preservado (negrito cheio)

- **Snapshot antes de editar (RUL-0034):** `/tmp/IBX-0076-snap-r4-component.tsx` (galeria, md5 `bed651567dac527c9994858b8ef5bec8`) e `/tmp/IBX-0076-snap-r4-widget-alert.tsx` (md5 `273f22b59c7b74c9da21d59306cebecf`).
- **A mudança dele:** `weight="semibold"` → `weight="bold"` no renderizador do destaque (linha 341 do snapshot da galeria). O diff mecânico contra a reconstrução do estado do r3 mostrou que essa foi a ÚNICA mudança de conteúdo dele (as outras duas diferenças eram só formatação do nosso próprio `ultracite fix`).
- **Onde a verdade vive agora:** o renderizador das partes saiu da galeria e mora no `WidgetAlert` (`ui/widget-alert.tsx:91-98`), com o peso **`bold`** — não voltou para `semibold` em lugar nenhum (grep: o único `weight=` do componente é `bold`).

### Agregado em LINHAS, por tipo

- **Levantamento dos 16 cartões:** só DOIS agregavam mais de um tipo na mesma frase — o **8** (pendências de desafio, era `2 resultados para registrar · 1 resultado para confirmar`) e o **14** (desafio esperando validação, era `Resultados e propostas esperando a decisão do organizador.`). Os do organizador com contagem (**11** e **12**) são UM tipo cada (o app tem alertas separados por status, não uma frase agregada) e os demais são uma frase simples: ficaram como estavam. O único `·` que sobra na galeria é a copy REAL verbatim do diálogo Iniciar (bloco `c` do cartão de estilos), que não é descrição de alerta agregada (apontado).
- **Origem real da agregação:** ~~`summarizePendingActions` juntava os tipos com `" · "`~~ **EXTINTO:** o símbolo NÃO existe mais em `src/` (grep vazio em 23-09, o file:line desta linha não vale mais no disco); o badge da aba conta por status (fonte apontada pelo inventário).
- **Antes → depois:** cartão 8 = uma frase com `·` → **2 linhas** (`2 resultados para registrar` / `1 resultado para confirmar`), título `3 desafios precisando de atenção`; cartão 14 = uma frase com "e" → **2 linhas** (`2 resultados para validar` / `1 proposta para decidir`), título `3 desafios esperando sua validação`. O destaque de cada linha vai no NÚMERO (o dado que decide a contagem).

### Estrutura das linhas

- **No componente** (`ui/widget-alert.tsx`): `description?: WidgetAlertDescriptionLine[] | string` (:64) — string segue o caminho de sempre (`Alert.Description`, :193-195) e mantém os usos vivos idênticos; as linhas vão para um container `View className="gap-0.5"` (:198) dentro do `Alert.Content`, com **uma `Text` do app por linha** (:199) e as partes dentro dela (:199-205). O gap é o das linhas empilhadas do app, não margin chumbada.
- **Tipos exportados pelo componente** (o contrato vai consumir daqui): `WidgetAlertDescriptionPart = { isHighlighted?, text }` (:40-43) e `WidgetAlertDescriptionLine = { parts }` (:45-47). A galeria importa esses tipos e só carrega os exemplos (`settings/components/[component].tsx:313-408`).
- **Destaque:** a parte destacada é o mesmo texto da linha com `weight="bold"` e repete `color="muted" variant="description"` porque o `Text` do app aplica as classes base (`text-foreground font-normal`) — o mecanismo está provado na seção do r3 (ordem base → variantes no `better-styled` + token posterior vencendo no Uniwind).
- **Apontamento de a11y:** as linhas NÃO são `Alert.Description`, porque o primitivo do alerta renderiza a descrição como `Text` (impossível aninhar elemento de layout dentro) e aplica um `nativeID` ÚNICO e fixo `${nativeID}_desc` (`node_modules/heroui-native/lib/module/primitives/alert/alert.js:110`, com o root apontando `aria-describedby` em `:41`) — repetir a parte em N descrições duplicaria o id. As linhas usam o MESMO par visual da descrição do alerta (`core/text.tsx` `variant="description"` + `color="muted"` = `text-sm` + `--color-muted`, o que o `alert.css:55-60` define para a descrição). Quando o contrato chegar, a fiação de acessibilidade das linhas é decisão de UMA peça (o renderizador), não de cada tela.

### Shape revisado do item (nota para o PLN-0008 / IBX-0076)

O item do servidor **não pode** carregar `description: string` nem uma lista plana de partes: tem que carregar **LINHAS**, cada linha com as suas partes:

```ts
type AlertDescriptionPart = { isHighlighted?: boolean; text: string };
type AlertDescriptionLine = { parts: AlertDescriptionPart[] };
// description: string | AlertDescriptionLine[]
```

Motivo: o produtor da pendência (servidor) decide o destaque E a quebra por tipo; a tela só renderiza. O shape provado nesta rodada é exatamente o do `WidgetAlert` (tipos exportados), então o contrato pode reusá-lo sem adaptador.

### Mantido do r2/r3

Ações sempre dentro da superfície (duas ações no rodapé, na ordem secundária → principal do molde `entries.tsx:86-110`, ramo mine da aba Inscrições — o trecho vivia em `pages/tournaments/player-overview.tsx:188-209`, extinto no IBX-0080); CTA de uma palavra; todo alerta com título E descrição; 15 cartões numerados + o cartão de estilos divergentes, com marcação REAL x PROPOSTA e file:line; CTAs no-op; base = `WidgetAlert` real; nenhuma severidade nova.

### Fora de escopo (não tocado)

Nenhum wiring em tela, nada em `convex/`, nenhum contrato, nenhum builder alterado, nenhuma tela tocada, arquivos dos estilos divergentes intactos, WIP do usuário em `ui/kpi-card.tsx` intocado. Checagem mecânica: 16 cartões com descrição (3 deles via o builder no `GalleryPaymentAlert`), 2 cartões com 2 linhas cada e 1 destaque por linha, nenhum `·` em descrição de alerta, único `weight=` do componente é `bold`. Gates: `bun run check` (430 arquivos, tsc app + convex) e `bun test src` (528/528) verdes, `git diff --check` limpo. SEM COMMIT.

## Galeria: item Alertas — round 5 (IBX-0076 r5 — 20-09-2026, sem commit)

Revisão geral das descrições e dos destaques, por ordem do usuário ("isso aí tá muito grande... verifica todas as descrições e quais palavras-chave devem estar highlight/bold... revisa todos"). Só a galeria dev; `WidgetAlert` e demais arquivos intactos.

**SUPERSEDE (r6):** a regra 1 (descrição curta) foi REVERTIDA pelo usuário — ele havia pedido SÓ o destaque, não o encurtamento; o texto voltou ao do r4 (verbatim) e a única mudança passou a ser o negrito. Ver round 6.

### As duas regras

1. **Descrição curta** (REVOGADA no r6 — o texto do r4 volta): UMA frase curta por alerta (o quem/o que/onde + o prazo/valor quando for o dado que decide), **sem explicar consequência**; alvo de 1 linha (2 no máximo) no cartão. A mesma régua vale para o TÍTULO quando ele estiver comprido.
2. **Destaque é a EXPRESSÃO da pendência, não o número solto**: número + objeto (`2 resultados`, `1 resultado`, `2 resultados para validar`), nome de pessoa, categoria, competição, prazo/valor quando for o que decide. Nunca número solto nem palavra genérica. **No máximo UM destaque por linha/descrição**; quando dois disputam, fica o que o usuário precisa reconhecer para agir (escolha apontada no cartão).

### Antes → depois por cartão (16/16 conferidos)

| # | Título | Descrição | Destaque | CTA |
|---|---|---|---|---|
| 4 | não mudou (real com contagem) | consequência → **`Taxa de **R$ 40,00** por inscrição.`** | o VALOR (o dado que decide pagar) | `Pagar` (não mudou) |
| 5 | não mudou (real; dentro do alvo) | 3 destaques → **`**Marina Costa** convidou você para Duplas Mistas.`** | QUEM convida (categoria sem destaque, competição fora por contexto: apontado) | `Recusar` → `Aceitar` (não mudou) |
| 6 | não mudou | 3 destaques → **`Aguardando **Gustavo Lima** aceitar o convite.`** | QUEM falta responder | sem CTA (não mudou) |
| 7 | não mudou | 2 frases com consequência → **`Categoria **Duplas Mistas**.`** | a CATEGORIA | sem CTA (não mudou) |
| 11 | contagem ajustada às 2 linhas (`2`) | instrução → **`**Marina Costa**`** / **`**Gustavo Lima**`** | o NOME por linha | `Ver` (não mudou) |
| 12 | não mudou | consequência → **`**Camila Ferraz**`** / **`**Pedro Almeida**`** | o NOME por linha | `Ver` (não mudou) |
| 15 | não mudou | regra/consequência → **`Falta agendar os confrontos em aberto.`** | nenhum (falta o dado decisivo: apontado) | sem CTA (não mudou) |

### Apontamentos

- **Falta de dado (proposta minha, para o contrato)**: cartões 1 e 3 (o builder não manda valor nem data da pendência), 15 (qual rodada/quadra está em aberto), e os valores/nomes dos cartões 4, 10, 11, 12 e 13 são EXEMPLO da galeria — o contrato precisa mandar o valor real e a lista de quem/cada item.
- **Competição e categoria fora de cena nos cartões 5 e 6**: a tela já é o torneio, então o destaque ficou com o NOME (o que o usuário precisa reconhecer para agir). Se quiser a categoria visível também, ela volta como linha (a régua de 1 destaque por linha continua).
- **Título com contagem não aceita destaque**: o `Alert.Title` é string (o shape de partes é só da descrição). Onde a contagem precisa de destaque, ela desce para a descrição/linha (cartões 8 e 14); se o usuário quiser o número em `bold` no título, o título também precisa virar partes — nota de contrato.
- **CTAs reais de duas palavras seguem apontados** (voltam ao botão quando o contrato/servidor mandar o rótulo): `Pagar agora` (`presentation.ts:211-213`), `Conectar conta` (`organization-form-fields.tsx:1088`) e `Abrir ajustes` (`notifications.tsx:390`).

### Verificação desta rodada

Sonda descartável (apagada) provou que a descrição enxuta do cartão 2 é o texto REAL do builder com a oração de consequência removida (`real.replace(" para continuar jogando sem interrupção", "")`), e conferiu verbatim nos arquivos citados as cópias reais dos cartões 1, 3, 9 e 10 e os cinco rótulos reais de duas palavras. Checagem mecânica: nenhum destaque com número solto, nenhuma descrição acima de 1 linha (12 a 46 caracteres), cada linha com no máximo um destaque, todos os CTAs com uma palavra, nenhum `·` em descrição de alerta. WIP do usuário preservado: `weight="bold"` segue em `ui/widget-alert.tsx:95` (o arquivo não foi tocado nesta rodada — byte a byte igual ao snapshot `/tmp/IBX-0076-snap-r5-widget-alert.tsx`). Gates: `bun run check` (430 arquivos, tsc app + convex) e `bun test src` (528/528) verdes, `git diff --check` limpo. SEM COMMIT.

## Galeria: item Alertas — round 6 (IBX-0076 r6 — 20-09-2026, sem commit)

Desfaz o ENCURTAMENTO do r5. O usuário reprovou a regra de "descrição curta" ("tava legal antes, você removeu coisas que eu não pedi") — o pedido dele no r5 era SÓ achar as palavras-chave e pôr o destaque. O TEXTO volta ao do r4 (que ele aprovou) e a única mudança desta rodada é o **negrito**. Só a galeria dev; `WidgetAlert` intocado.

### O que voltou e o que é novo

- **Texto = r4, verbatim**, em todos os cartões que o r5 havia mexido (1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15 e o cartão de estilos), copiado do snapshot do r4 (`/tmp/IBX-0076-snap-r5-component.tsx`, tirado antes do r5). Prova mecânica: nenhuma linha `description="..."` da galeria aparece no diff contra esse snapshot — só as consts de partes (destaque), o `description?` do `GalleryPaymentAlert` (usado só pelo cartão 2) e o `title` do cartão 10.
- **Títulos voltam ao r4**, EXCETO o do cartão 10 (`Conta de pagamento não conectada`), que ele aprovou enxuto — o resto do título real (`: os jogadores não conseguirão pagar.`) fica na nota do cartão. As contagens dos cartões 11 (`3 inscrições aguardando aprovação`) e 13 (`4 solicitações de entrada`) voltaram ao r4.
- **Cartões 11/12/13**: a lista de nomes do r5 saiu e voltou a frase única do r4 (eles NUNCA foram linhas no r4 — só os cartões 8 e 14 são agregados em linhas, e continuam assim).
- **Destaque = única mudança**: no máximo 1 por linha, sempre a palavra-chave que identifica a pendência (nome de pessoa, categoria, competição, valor, prazo, expressão número + objeto). Contagem mecânica: 8 destaques em 8 linhas, 1 por linha (cartões 2, 5, 6, 8, 9 e 14). Peso é o `weight="bold"` do usuário (`ui/widget-alert.tsx:95`, intocado).
- **Cartão 2** é o único cuja copy REAL carrega um dado destacável (a data), então a descrição vem do builder em PARTES — a junção é igual à string do builder, provado por sonda (`Renove até 23 de set. de 2026 para continuar jogando sem interrupção.`). Custo: um `description?` opcional no `GalleryPaymentAlert`; sem ele o componente renderiza `props.alert.description` como no r4.
- **Cartões 5 e 6**: o r4 tinha 3 destaques na mesma linha (nome + categoria + competição); com a régua de 1 destaque por linha, o negrito fica no NOME (o dado que o usuário precisa reconhecer para agir) e categoria/competição seguem no texto sem negrito — apontado na nota do cartão.
- **Cartões sem destaque (não forçados)**: 1, 3, 4, 7, 10, 11, 12, 13, 15 e o cartão de estilos — nenhuma dessas frases tem palavra-chave do vocabulário; o dado que falta em cada uma está apontado na nota e é o que o contrato vai ter de mandar (valores, prazos e as listas de quem espera).
- **Comentário órfão do r4 não restaurado**: o bloco "Descrição do alerta em LINHAS (IBX-0076 r4)" era um doc comment sem declaração embaixo (o mecanismo mora em `ui/widget-alert.tsx`); ficaram o doc do `GalleryPaymentAlert` e o doc das partes.

### Verificação

Diff contra `/tmp/IBX-0076-snap-r5-component.tsx` (estado do r4) provando o texto verbatim, sonda descartável (apagada) provando que a junção das partes do cartão 2 é igual à descrição real do builder, e conferência dos CTAs de uma palavra na seção de alertas. WIP do usuário: `weight="bold"` segue em `ui/widget-alert.tsx:95` e o arquivo está byte a byte igual a `/tmp/IBX-0076-snap-r6-widget-alert.tsx` (md5 `f45754f1df988ce5d8ecbbbd487d11ee`, o MESMO do snapshot do r5 — nenhuma rodada tocou nele). Snapshot pré-r6 da galeria: `/tmp/IBX-0076-snap-r6-component.tsx` (md5 `992cc1a4c0a11fbaee3696924689f661`). Gates: `bun run check` (430 arquivos, tsc app + convex) e `bun test src` (528/528) verdes, `git diff --check` limpo. SEM COMMIT.

## Pendências em tela — Etapa 2 do PLN-0008 (IBX-0076 · 20-09-2026, sem commit)

Ligou o contrato `pendings.list` (Etapa 1, Backend) nas telas e APAGOU o que o cliente derivava em paralelo. Nada de copy, severidade, ordem ou visibilidade re-derivada no cliente: a tela só recorta o item do escopo certo e o renderer único desenha.

### O renderer único

- **`src/components/ui/pending-alerts.tsx`** — `PendingAlerts({ className?, isError?, isLoading?, items, onActionPerformed? })`: mapeia o item do servidor para o `WidgetAlert` REAL (mesmo componente aprovado na galeria, nenhuma severidade/cor/tamanho novo). `description` passa direto (string ou LINHAS de partes com o destaque do servidor); `action`/`secondaryAction` saem no rodapé na ordem secundária → principal que o `WidgetAlert` já renderiza, e **cada botão resolve o SEU `action`** (o secundário pelo `item.secondaryAction`, com o próprio `isDisabled` na mutation em voo — botão sem ação resolvível não é desenhado); `key` = `item.id`. Estados: `isLoading` → `LoadingState` (não pisca área vazia), `isError` → `ErrorMessage` compacto, lista vazia → não desenha nada. **`onActionPerformed`** (opcional) é chamado depois de CADA ação concluída — **aguardado nos dois caminhos** (pagamento: invalidação antes de abrir o checkout; convite: invalidação antes do toast) —: o renderer invalida só a lista de pendências (que é dele) e a PÁGINA — que conhece a entidade — passa a invalidação do próprio contexto (a casa do torneio invalida `tournament.discovery.getById`; as homes não passam nada). Sem esse callback, responder ao convite de dentro do alerta deixava o card da inscrição e os KPIs velhos até o refetch (M1 do re-veredito).
- **`src/lib/pendings/pendings-view.ts`** — o que a tela decide: `PENDING_ALERT_STATUS` (severidade → status; `info` → `accent`, como os cartões aprovados), **`resolvePendingAction`** (PONTO ÚNICO que traduz o `action` do contrato para a ação viva) e o recorte `resolvePendingsForTournament({ items, tournamentId })`. O recorte do torneio (`src/lib/pendings/pendings-view.ts:108-117`) casa pelos `params.tournamentId` — a chave dos kinds 5, 6 e 7 (contexto da entidade) e do 4 com 2+ inscrições — **e cai para o `source` quando não há params** (`source.type === "tournament"` → `source.id`): a pendência de inscrição aguardando pagamento com UMA inscrição não tem `params` nem `route` — o torneio vive só no `source` (`convex/domains/tournament/pendings-rules.ts:211-216`) — e sem esse fallback o item sumia da casa do torneio (H1 do re-veredito). Com as duas chaves, os QUATRO kinds do jogador (4, 5, 6 e 7) ficam alcançáveis nesta casa; conferido no disco com sonda: 4/4 achados e 0 para outro torneio. Testes co-localizados (`pendings-view.test.ts` + `pendings-action-parity.test.ts`).
- **Ação por AÇÃO EXPLÍCITA, nunca por kind nem por rótulo** (`convex/domains/pendings/contract.ts:98-107`): `open_route` → navega no **destino do ITEM** (`route` + `params`; `action.params` é sempre nulo nesse tipo e entra só como override — os params vão como merge `item.params` + `action.params`, e sem ler o `item.params` os CTAs Ver/Revisar/Conectar abririam as rotas com placeholder sem o id da entidade); `pay_tournament_entry` → o MESMO `createCharge` com o `action.params.entryId` → checkout; `accept_partner_invite`/`decline_partner_invite` → `tournament.entries.respondPartnerInvite` (a MESMA mutation e os MESMOS toasts do wiring do convite na casa do torneio), com invalidate de `pendings.list` depois. `actionLabel` + `action` nulo (ou `open_route` sem `route`, ou mutação sem o `params` que ela exige) → **o botão é OMITIDO** (nunca botão morto, nunca `actionLabel` → `navigate(route)` cru).

### O que foi ligado

- **As duas homes (o GAP declarado):** `pendings.list` como PRIMEIRO bloco — `pages/home/player-dashboard.tsx:33-35` (escopo player) e `pages/home/organizer-dashboard.tsx:33-35` (escopo organization), renderizados por `PendingAlerts` (as queries moram na própria view, como as demais queries das homes).
- **Casas de torneio:** os DOIS escopos são pedidos no `_layout.tsx` (o servidor responde `items: []` no escopo que não é do ator — nenhum gate de papel no cliente) e o derived `pendings` recorta pelo `tournamentId` — **kinds 4, 5, 6 e 7 no jogador** (5/6/7 pelo `params.tournamentId`, o 4 com uma inscrição pelo `source` de torneio) e 11 e 12 no organizador.

### O que foi APAGADO (cutover, com prova de zero órfão)

| Apagado | Onde vivia | Prova |
|---|---|---|
| `buildTournamentPendingApprovalAlert`, `buildTournamentAwaitingPaymentAlert` (+ tipos) | `src/lib/tournaments/organizer-overview-derived.ts` | `grep` dos dois nomes em `src` → **zero USO** (só o comentário do cutover no docstring da view) |
| os alertas derivados no cliente (`awaitingPaymentCount`, `pendingInvite`) e o `handleSeeEntriesPress` (o `Ver` agora é o `open_route` do item) | `pages/tournaments/player-overview.tsx`, `pages/tournaments/organizer-overview.tsx` | zero |
| os testes dos builders extintos | 3 arquivos `*.test.ts` | a suíte CAIU de 528 para os testes que restam + os novos: nenhum teste ficou apontando para símbolo morto |


### O que ficou FORA (apontado, não inventado)

2. **`truncated` e `saturation` do resultado não são desenhados** (o cap de 20 itens e a leitura saturada ficam invisíveis na tela). Sem contrato visual aprovado, nada entrou.
3. **Erro na leitura de pendências:** o bloco mostra o `ErrorMessage` compacto em vez do `ErrorState` de página (o `ErrorState` traz o botão "Voltar" e derrubaria a home) — decisão registrada.
5. **A ordem de merge dos dois escopos no torneio** pressupõe que só um deles tenha item (o outro volta vazio) — verdade pela guarda de escopo do servidor, anotado no código.

### Round 2 da galeria (1 cartão NOVO, só na galeria — RUL-0033)

`settings/components/[component].tsx` ganhou o **Alerta 17**, marcado PROPOSTA (nada entra em tela sem o usuário marcar):

- **Alerta 17 · PROPOSTA · Jogador: PIX pendente ou vencido** (origem: membership em `awaiting_payment` e `paymentCharge` PENDING × EXPIRED). Três blocos: **Pendente** (warning; `PIX aguardando pagamento`; `Pague até **12 de set. de 2026** para garantir sua vaga.`; `Pagar`), **Vencido** (warning; `PIX vencido`; `O PIX de **R$ 40,00** venceu sem pagamento.`; `Pagar`) e **Vencido com a vaga liberada** (danger; `O prazo terminou e sua vaga foi liberada.`; `Renovar`). **O que o contrato precisa mandar:** kind novo de escopo player (ex.: `player_payment_charge_open` / `player_payment_charge_expired`), `source {type:"payment_charge", id}` com `sourceId`/`sourceType` da cobrança e `action: open_route|pay_*` para o CTA, `deadlineAt` = expiração do PIX, `moneyCents` = valor da cobrança e a REGRA de severidade (warning pendente/vencido reservado; danger quando a vaga foi liberada). É o buraco declarado da v1: o estado `awaiting_payment` não gera item hoje.

### Verificação desta etapa

`bunx ultracite check src` limpo (271 arquivos), `bunx tsc --noEmit` sem erro em `src/` (os 3 erros restantes são testes de `convex/domains/**` do Backend, em voo), `bun test src` **537/537** verdes, `git diff --check` limpo. WIP do usuário (`ui/widget-alert.tsx`, `ui/kpi-card.tsx`) intocado — nenhum dos dois aparece no diff desta etapa, e o md5 do `widget-alert.tsx` (`f45754f1df988ce5d8ecbbbd487d11ee`) é o MESMO dos snapshots do r5/r6 da galeria. Snapshot da etapa: `/tmp/IBX-0076-etapa2-snap/` (estado PÓS-edição em `pos/` + a versão do HEAD em `head/`, que vale como "antes" dos arquivos que estavam limpos; o "antes" dos que já carregavam mudanças das rodadas anteriores — BUG-0042 e galeria — está nos snapshots dessas rodadas e no `git diff`; ver o README de lá). SEM COMMIT. Sem verificação visual em device/simulador (RUL-0025): o encaixe dos alertas nas 5 telas é o ponto a conferir no dedo.

### Fechamento do re-veredito (20-09-2026, mesma etapa)

- **H1 (HIGH, regressão de cobertura) — FECHADO.** Kind 4 com UMA inscrição aguardando pagamento não tem `params` nem `route` (o torneio vive só no `source`) e o recorte da casa do torneio devolvia 0 itens: a casa mostrava o alerta antes do cutover (HEAD: `pages/tournaments/player-overview.tsx:109`) e ficou muda depois. `resolvePendingsForTournament` (`src/lib/pendings/pendings-view.ts:112-117`) passou a casar pelos `params.tournamentId` **ou** pelo `source` (`source.type === "tournament"` → `source.id`), com comentário do invariante (o contrato garante que o único kind de escopo player com source de torneio é o 4). Prova: `bun test src/lib/pendings/pendings-action-parity.test.ts` — com o filtro antigo (params-only) o teste "finds the single-entry payment item in the tournament house" FALHA (`+ []` em vez de `["player_tournament_entries_awaiting_payment"]`); com o fix passa.
- **L1 (LOW) — FECHADO com teste cruzado do servidor.** `src/lib/pendings/pendings-action-parity.test.ts` constrói UM item REAL de cada kind do catálogo pelos BUILDERES DO SERVIDOR (`buildPlayerEntryPendings`, `buildOrganizerEntryPendings`) e afirma: (a) são os kinds do catálogo; (b) todo item COM `actionLabel` resolve ação pelo `resolvePendingAction` do renderer (o invariante "nenhum item cai na omissão do botão" deixa de depender da soma de duas suítes); (c) item com `action: null` nunca vem com `actionLabel`; (d) o caso do H1 (kind 4 com 1 inscrição) é achado pelo recorte da casa do torneio e resolve `pay_entry`.
- **M1 (MEDIUM) — FECHADO pela prop de callback.** Responder ao convite pelo alerta invalidava só `pendings.list` (o wiring antigo invalidava `tournament.discovery.getById`: `tournaments/[tournamentId]/index.tsx:75` e `entries.tsx`): o card da inscrição e os KPIs ficavam velhos e um segundo toque tendia a bater em erro do servidor. Agora `PendingAlerts` aceita `onActionPerformed` (chamada no sucesso do `respondPartnerInvite` e do `createCharge`) e quem conhece a entidade passa a invalidação: a casa do torneio (`invalidateTournamentContext`) via props `onPendingActionPerformed` nos overviews; as duas homes não passam nada (não há contexto de entidade a invalidar) e o renderer NÃO invalida namespace global por padrão.

### Fechamento do achado do Backend (open_route sem os params do item, 20-09-2026)

- **Achado (mesma classe do H1 — navegação sem o parâmetro):** o ramo `open_route` do `resolvePendingAction` usava `params: action.params ?? {}`. Como no `open_route` o `action.params` é SEMPRE nulo (invariante do contrato: o destino é o par do ITEM), a navegação saía com `{}` e os CTAs de navegação abriam a rota com placeholder (`/tournaments/[tournamentId]/entries`) **sem o id da entidade**.
- **Fix (`src/lib/pendings/pendings-view.ts:61-78`):** o resolver passou a receber o **ITEM** e a montar os params como merge `item.params` + `action.params` (a ação vence quando tiver params). Continua genérico, por TIPO de ação, sem mapa kind → destino e sem hardcode por kind; o JSDoc passou a afirmar exatamente isso.
- **Prova (`src/lib/pendings/pendings-action-parity.test.ts`):** (a) para TODO item de `open_route`, cada placeholder do `route` tem valor nos params da navegação; (b) tabela explícita dos kinds de navegação — 11 e 12 → `{initialTab: "pending", tournamentId}` — mais o kind 4 agregado (2+ inscrições) → `{tournamentId}`; (c) nenhuma ação de MUTAÇÃO vira navegação; (d) kind 4 com UMA inscrição segue `pay_entry`. Com o `params: action.params ?? {}` de volta, os três primeiros testes FALHAM (5 pass / 3 fail); com o fix, 18/18 verdes.

### Fechamento do HIGH do `Recusar` (20-09-2026)

- **Bug (verificação final):** o kind 5 tem DUAS ações (Aceitar primária, Recusar secundária) e o renderer resolvia só a PRIMÁRIA e passava o MESMO `onPress` para os dois botões — como o `accept` vinha do tipo da ação primária (`accept_partner_invite` → `true`), tocar em **Recusar ACEITAVA o convite** (dupla fechada, toast "Convite aceito"). A spec do contrato (`docs/spec/pendings.md`, ação executável) sempre declarou o certo: o `secondaryAction` é `decline_partner_invite` com `accept: false`.
- **Fix (`src/components/ui/pending-alerts.tsx`):** cada CTA resolve a SUA ação — `primary = resolvePendingAction(item)` e `secondary = resolvePendingAction({ ...item, action: item.secondaryAction })` — e cada um ganhou o SEU `onPress` (um `runAction(resolution)` compartilhado, sem tratar `respond_invite` por rótulo nem mapa por kind) e o SEU `isDisabled` pela mutation em voo (`isInFlight(resolution)`). Botão cujo `action` não resolve não é desenhado (mesma regra defensiva do principal), e o `secondaryActionLabel` entrou na asserção de paridade.
- **Prova (testes):** `src/components/ui/pending-alerts.test.tsx` (novo) monta o renderer com o framework stubado no boundary e aperta cada botão do item REAL do kind 5: **Aceitar manda `{accept: true, entryId}` e Recusar manda `{accept: false, entryId}`** (com a versão bugada o teste FALHA com `- "accept": false, + "accept": true`, provando que pega o bug); o CTA de navegação roteia com os params do item e não cria cobrança; os DOIS botões ficam `isDisabled` com a mutation do convite em voo e nenhum desabilita com a de cobrança em voo. No arquivo de paridade, além da asserção estendida ao secundário (com prova negativa), dois testes travam o padrão: o secundário do convite resolve `accept: false` e nenhum item resolve o secundário com a ação do primário.


## Item Notificações + cartão da central (IBX-0077 · 21-09-2026, sem commit)

Etapa 1 de 2 do PLN-0009: o CARTÃO da central de notificações e a galeria dev dos 44 tipos. O botão no push do sistema (categoria por tipo) é a Etapa 2 e não foi tocado. O domínio de notificação tem doc própria no ar — [`notifications.md`](notifications.md) (44 eventos, `presentation`, gates de estado, deliveries, preferências); esta seção cobre só o lado de TELA (o cartão, a galeria e o que executa no app).

### O cartão (`src/components/notifications/notification-card.tsx`)

- **Extraído do item que vivia dentro da tela.** A função local `NotificationFeedItem` (`settings/notifications.tsx:123-191` no estado anterior) MORREU e a tela passou a importar `NotificationCard` (`notifications.tsx:28` e o elemento no render em `:516-529`): cutover limpo, uma fonte só. Preservados o toque (abre + marca lida, via `handleOpenNotification` da tela), o menu ⋮ (com o item destrutivo, agora `Remover notificação` — rodada 2) e o feedback de toque (`PressableFeedback.Highlight` é o último filho, RUL-0035).
- **É o layout do ALERTA, sem o ícone.** Não existe prop oficial para esconder o `Alert.Indicator`: a doc bundled (`node_modules/heroui-native/lib/module/components/alert/alert.md`, "Anatomy" + API de `Alert.Indicator`) e o código (`alert.js:73-99`, o componente do indicador; o root só monta `[backgroundElement, children]` em `alert.js:39-68`, a linha dos children em `:67`) mostram que o indicador é uma PARTE composta renderizada pelo consumidor. O mecanismo oficial é OMITIR a parte; o layout aguenta (quem tem `flex: 1` é o `alert__content`, `alert.css:21-23`). Implementado como `isIndicatorHidden` no MESMO `WidgetAlert` (`ui/widget-alert.tsx:55` e o render condicional em `:110`), sem componente paralelo (RUL-0005): dos call sites de `WidgetAlert` hoje, quase todos NÃO passam a prop (o item dev da galeria e `components/ui/pending-alerts.tsx:64`) e 1 passa (`components/notifications/notification-card.tsx:122`), com o desenho dos que não passam inalterado.
- **Conteúdo dentro do alerta = título e descrição** (a rodada 2 tirou os botões do corpo — ver "RODADA 2" abaixo). A descrição vem do servidor e vira PARTES quando há `presentation.bodyHighlights` (`lib/notifications/notification-view.ts`, `buildNotificationDescription`): recorte por `indexOf` no texto original, com trechos sobrepostos fundidos e o peso `bold` do `WidgetAlert` (o caminho aprovado no IBX-0076). Sem destaque, a string passa direto. O CORTE de texto que o feed já tinha segue igual: título em 1 linha e descrição em 2 (`numberOfLines` do item antigo, `git show HEAD:src/app/(private)/settings/notifications.tsx:143` e `:149`), agora por duas props opcionais do alerta (`titleNumberOfLines` / `descriptionNumberOfLines`, `ui/widget-alert.tsx:61` e `:44`) — sem elas nenhum chamador muda de desenho. O corte vale para os DOIS caminhos do alerta (string e partes de linha), e o cartão liga os dois (`notification-card.tsx`).
- **SUPERSEDE (rodada 2): os botões do corpo saíram** — a regra de **cada ação resolver a SUA** continua valendo, agora dentro do menu ⋮, na ordem da rodada 3 (principal → secundária → destrutiva). O que segue do desenho antigo: `resolvePendingAction` sobre `presentation.action` e `presentation.secondaryAction`, ação sem resolução não é desenhada (nunca item morto) e o gatilho do menu faz `stopPropagation` para o toque nele não abrir a notificação (`WidgetAlertAction.onPress` ganhou o parâmetro do evento na rodada 1, `ui/widget-alert.tsx:11`).
- **Fora do alerta ficam a hora e a marca de não lida** (ponto + título em `accent`): é a informação que a tela já mostrava, e o cartão entra com as duas ligadas para não tirar nada do feed. O desenho final é escolha do usuário na galeria (cartão de estados). Duas props opcionais controlam isso (`showTimestamp`, `showUnreadMark`), ambas `true` por default.

### RODADA 2 — TODA AÇÃO NO MENU ⋮ (pedido do usuário, 21-09)

O usuário marcou a galeria e ditou uma correção de desenho, literal: *"coloca TODOS os botões nesse menu"* — o ⋮ já existia no cartão, então as ações viram ITENS dele. Exceções que ele mesmo manteve: o aviso "Notificações bloqueadas" da tela e o renderer de pendências (desenho aprovado no IBX-0076) ficam como estão, com botão visível.

- **O corpo do cartão é só título + descrição.** O `WidgetAlert` do cartão não recebe mais `action`/`secondaryAction` — nenhuma ação aparece fora do menu.
- **Os itens do menu são um derivado único** (`buildNotificationMenuItems`, `lib/notifications/notification-view.ts`): a ORDEM é a única decisão de tela e mora num lugar só — **SUPERSEDE (rodada 3):** a ordem desta rodada era secundária acima da principal (copiada do rodapé do alerta); a rodada 3 trocou para PRINCIPAL → SECUNDÁRIA → DESTRUTIVA, e o derivado registra que a ordem do MENU não é a do ALERTA. Segue valendo: o item destrutivo é o ÚLTIMO, ação cujo id não resolve não gera item, cada item carrega a SUA resolução (o par Aprovar/Recusar não se confunde em forma de menu) e o `isDisabled` é da mutation daquele item em voo.
- **Item destrutivo renomeado para `Remover notificação`** (palavra do usuário; comportamento igual: `onRemove` da tela, `variant="danger"`).
- **A execução é a MESMA do feed:** os itens chamam o `onAction(resolution)` da tela, que é o `runAction` do runner compartilhado (`lib/pendings/use-pending-action-runner.ts`) — nenhum caminho paralelo, mesmos toasts e invalidações.
- **Gatilho sem colisão com o texto.** O tamanho já era o mínimo do componente (`size="sm"` — o `Button` só aceita `sm | md | lg`, `button.styles.js`, e no `isIconOnly` ele fica 40×40 por `button__root--size-sm`, `button.css:43-48` e `:66-69`); o defeito era ele ser ABSOLUTO (`top-2 right-2`) com o texto da descrição passando por baixo. A reserva entrou no CONTEÚDO do alerta: `WidgetAlert` ganhou a prop aditiva `contentClassName` (aplicada ao `Alert.Content`, `ui/widget-alert.tsx:111`) e o cartão passa `pr-12` = 8px do `right-2` + 40px do botão. O texto para antes da faixa do gatilho em todas as linhas.
- **A galeria mostra a anatomia nova** (`NotificationMenuAnatomy`, `[component].tsx`): o cartão limpo + um `LabeledBlock` "menu ⋮" com os itens na ordem real, tirados do MESMO derivado do cartão (nenhum rótulo digitado na galeria, RUL-0007) e cada linha com a resolução ao lado — só os cartões ACIONÁVEIS ganham o bloco (no informativo o menu tem um item só, o destrutivo). A nota do cartão de estados foi ajustada para o desenho novo.
- **Teste do cartão reescrito** (`components/notifications/notification-card.test.tsx`): prova a ordem dos itens (na rodada 2, `Recusar`, `Aprovar`, `Remover notificação` — SUPERSEDE a ordem pela rodada 3), que cada item entrega a SUA resolução, que o último chama o `onRemove`, que ação sem resolução não gera item (nem ação no corpo do alerta) e que só o item em voo desabilita — o que ele provava antes, na forma nova.

### RODADA 3 — ORDEM E COR NO MENU ⋮ (correções do usuário, 21-09)

O usuário olhou a rodada 2 e corrigiu duas coisas no MENU, literal: *"o recusar NUNCA é em primeiro; o recusar é em segundo. Então, por exemplo, ACEITAR, RECUSAR e REMOVER NOTIFICAÇÃO"* e *"o recusar também tem que seguir meio que o estilo do remover notificação, porque é uma recusa, então ele é DANGER. E o aceitar... o verde, o SUCESSO"*.

- **ORDEM (supersede a rodada 2):** PRINCIPAL → SECUNDÁRIA → DESTRUTIVA (`Aprovar`, `Recusar`, `Remover notificação`). Esta é a ordem do MENU e ela é DIFERENTE, de propósito, da ordem do rodapé do ALERTA (`ui/widget-alert.tsx`), que desenha a secundária antes da principal por causa do molde do convite do torneio (`tournaments/[tournamentId]/entries.tsx:86-110`): o alerta empilha BOTÕES (quem confirma fecha a linha, à direita), o menu é uma LISTA DE COMANDOS (o principal abre). A régua está no comentário do derivado e no do alerta — quem mexer num não deve "consertar" o outro.
- **COR POR SEMÂNTICA, nunca pelo nome do tipo:** o item carrega um `tone` (`NotificationMenuItemTone`) que o cartão traduz para a aparência: aceitar/aprovar/confirmar (incl. o `accept: true` do convite de dupla) = `success`; recusar/recusar-cancelamento (incl. `accept: false`) e o destrutivo = `danger`; pagar/renovar e a navegação pura = neutro. O mapeamento é por `resolution.kind` (`readActionTone`, derivado), então renomear um `type` do contrato não muda a cor. **SUPERSEDE (rodada 4):** o tom `success` saiu do mapa — hoje é `danger` × `default` (ver "RODADA 4" abaixo); o resto do bullet (cor por SEMÂNTICA, via `readActionTone` sobre `resolution.kind`) segue valendo.
- **As variants REAIS do `Menu.Item` são só duas:** `default` e `danger` (`menu.types.d.ts`: `ItemVariant = 'default' | 'danger'`; o CSS só tem `menu__item-title--variant-default` e `--variant-danger`, `menu.css:71-77`). **NÃO existe variant de sucesso** — o verde entra pelo className `text-success!` no `Menu.ItemTitle` (o token `--success` vive no tema do app, `src/global.css`), com o `!` que a doc do Uniwind manda usar quando um utilitário precisa vencer outro estilo (`style-specificity`). O perigo e o destrutivo usam a variant `danger` de verdade. **SUPERSEDE (rodada 4):** o `text-success!` e o token `--success` não são mais usados pelo cartão — o `tone` entra DIRETO como `variant` e o mapa de aparência morreu junto (ver "RODADA 4").
- **Pagar/Renovar ficam NEUTROS** (o usuário não disse e o componente não tem tom de dinheiro): a escolha está APONTADA na galeria e no apontamento 9 abaixo — trocar é uma linha em `readActionTone`. **SUPERSEDE (rodada 4):** o neutro virou a REGRA GERAL — todo item que não é recusa nem destrutivo é `default`, e pagar/renovar segue neutro junto de aceitar/aprovar/confirmar.
- **Galeria SEM corte de texto, feed COM corte:** os cartões da galeria passam `isClamped={false}` (prop nova, opcional, default `true`), então título e descrição aparecem INTEIROS para ele conferir a copy; no feed continua o corte de antes (título 1 linha, descrição 2). Era a causa provável do "parece que mudou o texto". A nota do cartão de estados explica a diferença.
- **A galeria mostra o menu com a cor real:** o bloco `LabeledBlock` "menu ⋮ (itens reais, na ordem e nas cores em que saem no cartão)" desenha cada item na cor do SEU tone com o número, o tom e a resolução ao lado. **SUPERSEDE (rodada 4):** a régua de desenho virou `text-danger` / `foreground` (sem o `text-success`) e a nota condicional do "Pagar/Renovar sem tom de dinheiro" virou a nota GERAL do mapa, em todo cartão acionável (o `hasNeutralAction` morreu com ela) — ver "RODADA 4".
- **PROVA da copy (teste):** o teste do cartão ganhou o caso dos 44 tipos do catálogo — junta o que o cartão desenha (título + partes de cada linha da descrição, na ordem) e compara com o `title`/`body` que `buildNotificationContent` devolve para a MESMA entrada da fixture. Resultado: 44/44 idênticos, zero divergência (o destaque é só um recorte do mesmo texto). O corte do feed é ellipsis de RENDER (`numberOfLines`), não perda de caractere: é a única diferença visível entre o cartão e o servidor, e ela some na galeria (`isClamped={false}`).
- **Teste do cartão (rodada 3):** além da ordem nova, prova a cor por semântica (Aprovar = `text-success!` + variant `default`, Recusar e Remover = variant `danger`, Pagar = neutro) e o par de clamp (feed 1/2, galeria sem `numberOfLines`). **SUPERSEDE (rodada 4):** o caso da cor passou a travar `default` × `danger` no lugar do `text-success!` e ganhou o par do convite de dupla; o par de clamp segue igual (ver "RODADA 4").

### RODADA 4 — O VERDE SAI DO MENU ⋮ (correção do usuário, 21-09)

O usuário viu a rodada 3 na galeria e recusou o verde, literal: *"acho que esses aceitar em verde ficou feio... acho que podemos voltar ele para a cor anterior pode ser?"*. "Cor anterior" = o `default` da rodada 2. O resto do desenho NÃO mudou: a ORDEM (principal → secundária → destrutiva), o corte de texto, a reserva do gatilho do ⋮ e as exceções que ele mandou manter (o renderer de pendências e o aviso "Notificações bloqueadas") seguem como estavam.

- **O mapa de cor virou a EXCEÇÃO, não a regra:** `danger` só no que é RECUSA ou DESTRUTIVO — `decline_challenge_cancellation`, `decline_challenge_proposal`, `reject_entry`, `reject_membership`, o `respond_invite` com `accept: false` e o item `Remover notificação`. TODO o resto é `default`: aceitar/aprovar/confirmar (`accept_challenge_cancellation`, `accept_challenge_proposal`, `approve_entry`, `approve_membership`, `confirm_challenge_result` e o `respond_invite` com `accept: true`), `pay_entry`, `pay_membership` e a navegação pura.
- **`NotificationMenuItemTone` perdeu o `success`:** o tipo agora tem dois valores (`"danger" | "default"`) e o `readActionTone` continua sendo o ÚNICO ponto do mapa (`lib/notifications/notification-view.ts`), por SEMÂNTICA da ação — nunca pelo nome do `type` do contrato nem pelo rótulo do item.
- **O `MENU_ITEM_APPEARANCE` do cartão MORREU:** sem o verde ele era um mapa identidade (`tone` → variant de MESMO nome), então o `tone` entra DIRETO como `variant` no `Menu.Item` e a constante saiu junto com o `titleClassName` do tipo do teste e o `className` do `Menu.ItemTitle`. Nenhum código morto ficou: o docblock que ocupou o lugar registra o porquê (o `Menu.Item` só tem `default` e `danger`, `menu.types.d.ts`) e aponta o `readActionTone` como o lugar da semântica.
- **O token `--success` continua no tema** (`src/global.css`) e em uso em outras telas; o que saiu foi só o USO dele no cartão da central.
- **A galeria acompanha o mapa:** a régua de cor do bloco "menu ⋮" virou `text-danger` / `foreground` e o `hasNeutralAction` morreu — a antiga nota condicional do "Pagar/Renovar sem tom de dinheiro" virou a nota GERAL do mapa, mostrada em todo cartão acionável: *DANGER só no que é recusa ou destrutivo (Recusar, Remover notificação); todo o resto é o neutro do componente*.
- **Teste com DENTE:** o caso da cor passou a provar o `default` no lugar do `text-success!` e ganhou o par do convite de dupla (o MESMO `kind` nos dois sentidos, com o `accept` decidindo o tom). A ordem e o destrutivo seguem com dente, provado por mutação temporária (revertida, arquivo idêntico por md5): (a) o aceitar do convite virando `danger` derruba 1 caso (`- "default" + "danger"`); (b) o item destrutivo virando `default` derruba 2; (c) o `push` do destrutivo virando `unshift` (ele deixa de ser o último) derruba 3.

### A galeria (`settings/components/[component].tsx` + `lib/dev/notification-gallery-fixtures.ts`)

- **Registro e dispatch:** entrada nova no `component-registry.ts` (`id: "notifications"`, título "Notificações") e ramo no dispatch da tela de variantes (`[component].tsx:977`), no padrão dos itens existentes.
- **16 cartões, um por tipo do catálogo, em 5 grupos** (Torneio inscrição jogador e organizador, Torneio dupla, Torneio chave/partidas, Torneio ciclo), na **ordem aprovada dos grupos** — que NÃO é a ordem do catálogo: o grupo 1 abre na inscrição do jogador (`tournament.entry.confirmed`) e o catálogo abre em `tournament.bracket.placement_failed`. A copy NÃO é digitada: cada cartão chama os DOIS builders do servidor (`buildNotificationContent` + `buildNotificationPresentation`) com a MESMA entrada — fixture é só o INPUT (nome do ator, competição e os ids do emissor). Título no padrão `Notificação N · <grupo>: <eventType>` e nota por cartão com a procedência (linha do template no `definitions.ts`, papel do destinatário e a ação ou "informativo").
- **Os 12 tipos acionáveis saem com os itens de ação no menu ⋮ do builder** (nenhum rótulo digitado à mão); cada cartão acionável mostra ao lado o bloco "menu ⋮" com os itens na ordem real e a resolução de cada um (rodada 2). **Nenhum CTA executa**: o `onAction` não é passado, como o `noop` do IBX-0076.
- **Cartão de estados do item** (`LabeledBlock`): a) só título e descrição (o pedido literal), b) com a hora, c) com a marca de não lida. É a decisão que falta do usuário sobre o que entra além do alerta; a nota registra que a marca de não lida conversa com o badge (que conta `notification.settings.status.unreadCount`) e que o CORTE de texto veio de antes (título 1 linha, descrição 2), com o convite para ele riscar se quiser o texto inteiro.
- **Cartão de moldes de aviso** extraído para `NoticeMoldsVariants` e usado pelos DOIS itens (Alertas e Notificações): era o fecho do cartão 18 do IBX-0076 e agora vive num lugar só. A nota dele foi ajustada porque o `WidgetAlert` ganhou o `isIndicatorHidden` nesta rodada.
- **Teste de cobertura** (`src/lib/dev/notification-gallery-fixtures.test.ts`): o conjunto dos grupos é EXATAMENTE o catálogo do servidor (44 tipos, sem duplicata), os 2 eventos de organizador estão nos seus grupos, todo tipo tem linha de template, todo tipo acionável tem rótulo do builder e todo informativo tem `presentation` nulo — e o `tournament.entry.confirmed` segue INFORMATIVO (evento pós-pagamento, decisão registrada na doc do domínio).

### O tradutor e o runner (o lado que executa)

- **`resolvePendingAction` (`lib/pendings/pendings-view.ts`) é o ÚNICO ponto que traduz ação → mutation/rota** e cobre os tipos do enum, com os params que cada mutation exige: `approve|reject_tournament_entry` → `entryId`; `accept|decline_partner_invite` → `entryId`; `pay_tournament_entry` → `entryId` (neste o item manda o `entryId` em `action.params`). Sem os ids obrigatórios a resolução é `null` e o botão não é desenhado.
- **O alvo virou um shape comum** (`PendingActionTarget`): `PendingItem` o satisfaz sem adaptador (o renderer de pendências segue chamando igual) e a notificação monta o seu em `getNotificationActionTarget` — `route` = `data.url` (o destino já nasce com os ids).
- **A execução saiu do renderer de pendências para um runner compartilhado** (`lib/pendings/use-pending-action-runner.ts`): as MESMAS 10 mutations das telas, com os MESMOS toasts (copy aprovada, reaproveitada verbatim de `requests.tsx`, `entries.tsx`, `use-challenge-mutations.ts` e do próprio `PendingAlerts`), a invalidação de `pendings.list` que o renderer já fazia no `respond_invite` (`use-pending-action-runner.ts:81-82`) e o callback `onPerformed` em TODA ação concluída. `PendingAlerts` foi cortado para ele (as mutations inline morreram) e a central usa o mesmo runner com `onPerformed` = invalidar feed + status (`settings/notifications.tsx:155-156`).
- **Regra de invalidação mantida:** o runner invalida a lista de pendências só no `respond_invite` (o comportamento que o renderer já tinha) e chama o `onPerformed` de quem conhece a entidade; contexto de domínio (do torneio) continua sendo das telas, e as queries refazem no mount (não há `staleTime` global em `lib/convex/query-client.ts`). Erro de ação vira toast, como nas telas.
- O teste do renderer (`components/ui/pending-alerts.test.tsx`) teve os mocks de `crpc` estendidos: o runner monta o vocabulário inteiro, então o mock precisa da superfície toda — as asserções de wiring (Aceitar/Recusar com `accept` próprio, navegação do `open_route` sem cobrança, `isDisabled` por mutation em voo) seguem intactas.

### Verificação desta rodada

`bunx ultracite check` nos 15 arquivos de CÓDIGO do corte (o 16º arquivo tocado é esta spec): limpo. `bunx tsc --noEmit` (app + convex): **0 erros**. Testes focados do corte (`bun test --isolate` nos 5 arquivos: `pendings-view.test.ts`, `notification-view.test.ts`, `notification-gallery-fixtures.test.ts`, `pending-alerts.test.tsx` e `notification-card.test.tsx`): **44/44**, 243 asserts. O teste do cartão existe pelo mesmo motivo do teste do renderer de pendências: provar que CADA botão entrega a SUA resolução ao runner (o HIGH do `Recusar` do IBX-0076), que botão sem resolução não é desenhado e que só o botão em voo desabilita. **Gates completos deste fechamento:** `bun run check` EXIT 0 (ultracite em 458 arquivos + `tsc` do app + `tsc` do convex) e `bun run test` **1252 pass / 0 fail** em 102 arquivos; `git diff --check` EXIT 0. WIP do usuário preservado: o `weight="bold"` de `ui/widget-alert.tsx:135` segue igual e as mudanças do arquivo são aditivas (`isIndicatorHidden`, os dois cortes de texto e o parâmetro do evento no `onPress`). Sem verificação visual em device/simulador (RUL-0025): o desenho do cartão e a leitura dos 44 cartões são o QA do usuário.

**Rodada 2 (mesmos comandos):** `bun run check` EXIT 0 (458 arquivos + `tsc` app + `tsc` convex), `bun run test` **1263 pass / 0 fail** em 102 arquivos (8130 asserts — os 1260/8127 do estado anterior (BUG-0054 já dentro) mais os 3 casos novos do cartão) e `git diff --check` EXIT 0. Testes FOCADOS do corte: **32/32** em 221 asserts nos 4 arquivos (`notification-card.test.tsx`, `notification-view.test.ts`, `notification-gallery-fixtures.test.ts` e `pending-alerts.test.tsx` — o do renderer de pendências segue verde porque nada nele mudou). Sem verificação visual em device/simulador (RUL-0025): o encaixe do gatilho é o ponto que o QA dele confirma na tela.

**Rodada 3 (ordem/cor/galeria):** `bun run check` EXIT 0 (458 arquivos + `tsc` app + `tsc` convex), `bun run test` **1266 pass / 0 fail** em 102 arquivos (8140 asserts — os 1263/8130 da rodada 2 mais 3 casos novos) e `git diff --check` EXIT 0. Focados: **35/35** em 231 asserts nos mesmos 4 arquivos. A prova da copy tem DENTE: com um espaço a mais no título do cartão (mutação temporária, revertida — arquivo idêntico por md5) o caso dos 44 tipos FALHA nomeando o evento; com o código real, 44/44 idênticos ao `buildNotificationContent`. O `src/components/ui/kpi-card.tsx` (WIP do usuário) não foi tocado: md5 `cabf852ec2bc4208561f8af58864e5b6` igual ao snapshot `/tmp/IBX-0077-wip-usuario-kpi-card-20260921-054830.tsx` e mtime 05:44:59 intacto depois do `ultracite fix` (que só reescreveu os 2 arquivos do cartão).

**Rodada 4 (o verde sai):** `bun run check` EXIT 0 (ultracite em **458 arquivos** + `tsc` do app + `tsc` do convex), `bun run test` **1266 pass / 0 fail** em **102 arquivos** (**8139 asserts** — os 8140/1266 da rodada 3 menos 1 assert: o caso da cor virou UMA asserção por cartão (`toEqual` na lista de variants) no lugar de três `toMatchObject` por item, e ganhou o cartão do convite de dupla) e `git diff --check` EXIT 0. Focado do corte: **13/13** em 24 asserts no `notification-card.test.tsx`. O DENTE foi provado por mutação temporária no `readActionTone`/no builder (revertida, arquivo idêntico byte a byte, md5 `2ef99bcba88913378c94ab377d688da4`): aceitar do convite virando `danger` → 12 pass / **1 fail**; destrutivo virando `default` → 11 pass / **2 fail**; `push` → `unshift` do destrutivo (ele deixa de ser o último) → 10 pass / **3 fail**. `src/components/ui/kpi-card.tsx` (WIP do usuário) NÃO foi tocado: md5 `cabf852ec2bc4208561f8af58864e5b6` e mtime `2026-09-21T05:44:59` iguais aos do snapshot desta rodada.

### Apontamentos

1. **Não existe prop oficial para esconder o indicador do `Alert`** — o caminho é omitir a parte `Alert.Indicator` (mecanismo do próprio componente). A `isIndicatorHidden` do `WidgetAlert` encapsula isso para os dois casos ficarem num componente só.
3. **A duplicação que o runner resolveu**: as mesmas duas mutations (`createCharge`, `respondPartnerInvite`) estavam escritas em `PendingAlerts` e seriam reescritas na central; agora há um lugar só.
4. **Invalidação de contexto de domínio durante uma ação da central** fica por conta do `onPerformed` (a central invalida o feed; o torneio refaz no mount). Se o usuário quiser a tela de origem atualizada em tempo real, é passar o contexto certo no callback da tela.
5. **A hora e a marca de não lida do feed** entram ligadas (informação de hoje preservada) e o desenho é escolha dele no cartão de estados: trocar é mexer no default das duas props.
6. **Etapa 2 (botão no push)**: nenhum tipo do catálogo manda botão no sistema.
7. **Ordem DENTRO do menu (resolvido na rodada 3):** a ordem é PRINCIPAL → SECUNDÁRIA → DESTRUTIVA por palavra do usuário (`o recusar NUNCA é em primeiro`). A ordem do rodapé do ALERTA continua a outra (secundária → principal) e isso é PROPOSITAL: são dois desenhos, com réguas próprias — não "conserte" um pelo outro.
8. **Ação `Pagar`/`Renovar` do menu** cai no mesmo `createCharge` + navegação para o checkout do runner (a tela de checkout é outra rota): o item fecha o menu e sai da central, comportamento que o botão do corpo já tinha.
9. **Todo item que não é recusa nem destrutivo fica no tom NEUTRO** (`default`): o `Menu.Item` só tem as variants `default` e `danger` (`ItemVariant`), não existe um tom de dinheiro, e o verde foi TENTADO e RECUSADO pelo usuário na rodada 4 — pagar/renovar fica neutro junto de aceitar/aprovar/confirmar e da navegação. Mudar o tom de um item é uma linha em `readActionTone` (`lib/notifications/notification-view.ts`), o único ponto do mapa.
10. **O verde do sucesso (`text-success!` + `MENU_ITEM_APPEARANCE`) foi REMOVIDO na rodada 4** por palavra do usuário (*"ficou feio"*): como o `Menu.Item` NÃO tem variant de sucesso, o caminho do className com o `!` foi embora INTEIRO em vez de ficar desligado, e o `tone` entra direto como `variant`. Se algum dia um tom de sucesso voltar, o ponto é o `readActionTone` mais um mapa de aparência de novo — o registro do que foi tentado fica na seção "RODADA 3".

## Chart de receita na home da organização (IBX-0078 · 21-09-2026, sem commit)

Pedido do usuário: a seção **"Receita por mês"** da home do organizador passa a ser desenhada pelo **chart que o app já tem** (o aprovado na galeria, IBX-0075 r4); o **DADO não muda** — o mesmo número e o mesmo período que a tela mostrava hoje, sem métrica nova e sem recálculo.

### Componente único (RUL-0005) — o card virou genérico

- **`MonthlyMatchesCard` (`ui/monthly-matches-card.tsx`, r4) → `MonthlyChartCard` (`src/components/ui/monthly-chart-card.tsx`)**: MESMO desenho, nome do conceito genérico (série mensal), agora com 3 consumidores (home do jogador, galeria dev e home da organização). O arquivo antigo foi **DELETADO** e nenhum consumidor sobrou com o nome velho (`grep` em `src/`: zero ocorrências de `MonthlyMatchesCard`/`monthly-matches-card`/`MonthlyMatchesPoint`) — cutover limpo, sem alias nem re-export.
- **Props** (`monthly-chart-card.tsx:69-76`): `data: MonthlyChartPoint[]` (`{ label, value }`, :25-28 — `value` é o que vai pro eixo Y e o dado entra PRONTO), `title`, `description`, `formatValue?` (texto do balão) e `formatAxis?` (rótulo do eixo Y, ligado no BUG-0055).
- **Desenho byte a byte o aprovado** (:117-193): `Card` + `Card.Body` + `Text size="base" weight="semibold"` e `Text className="flex-1" color="muted" numberOfLines={1} variant="description"` (o estilo do WIP do usuário), `h-48`, `opacity={0.35}`, balão na casca `bg-accent px-4 pb-2` com `ChartCrosshair.ValueLabel` `text-sm` (**era `min-w-20 px-2`**), `accent-chart-3` na área e na linha, degradê com `useThemeColorPro("chart-3")`, `xAxis={{ tickCount, tickValues }}` (o `useMemo` do r3c virou `Array.from({ length: data.length }, ...)`, :97-100) e o crosshair inteiro (`ChartIndicator` + `ChartCrosshair` + `ChartCrosshair.Value`).
- **O que mudou de verdade:** o `yKeys` fixo `matches` virou `value` (:146) e o balão deixou de ser `${x} · ${y}` fixo; o resto é o mesmo JSX reordenado em props.

### Eixo Y ancorado em 0, com passo inteiro e `domain` explícito (23-09-2026, sem commit)

- **Por que não é o default do pacote:** sem `domain` explícito o victory-native abre os bounds iguais em `[1, -1]` (`getYScaleDomain.ts`, `singleValueYScaleDomain`) — com pouco dado o eixo saía -1 / -0,5 / 0 / 0,5 / 1, com marcas fracionadas e o zero no MEIO do gráfico. O eixo do card sai de `buildMonthlyYAxis` (`src/components/ui/monthly-chart-axis.ts:33-50`), ligado no `useMemo` do card (`src/components/ui/monthly-chart-card.tsx:101`) e consumido no `yAxis` (`:102-115`).
- **Regras do helper:** máximo por COMPARAÇÃO (`NaN` não passa no teste e fica fora do eixo); `step` = o menor redondo da década (1, 2, 5, 10, 20, 50…) que cobre `⌈máximo⌉ / 4`, nunca abaixo de 1 (`niceStep`, `:23-31`; `TICK_INTERVALS = 4`, `:16`); `domain: [0, top]` com `top = max(⌈máximo/passo⌉ × passo, passo)` — âncora em 0 e teto fechado no múltiplo do passo; `ticks` = `0, passo, 2×passo…` até `top`. Nenhum dado novo: a série entra pronta e o helper só a mede.
- **Sem dado nenhum** (máximo 0) o eixo ainda tem duas marcas (`domain` `[0, 1]`, `ticks` `[0, 1]`): o piso `top ≥ passo` existe porque `[0, 0]` degenerado o victory reabriria em `[1, -1]`.
- **Prova:** teste co-localizado `src/components/ui/monthly-chart-axis.test.ts` — série vazia e série de zeros (as duas em `[0, 1]`), teto no primeiro tick acima do máximo da janela, escala em centavos com passo inteiro, série com valor negativo que não derruba a âncora, e a varredura de `max` (0 na primeira marca, passo inteiro, no máximo 5 marcas, `domain` fechando no último tick).

### Balão do crosshair: por que o formatter roda no JS, não no worklet

- `ChartCrosshair.Value` recebe `value: SharedValue<string>` (`node_modules/heroui-native-pro/lib/typescript/src/components/chart-crosshair/chart-crosshair.types.d.ts:214-218`): o texto do balão é montado na **UI thread**, e formatter de moeda (`Intl.NumberFormat`, `lib/format/currency.ts`) não roda em worklet (chamar função JS de dentro do worklet estoura `Tried to synchronously call a non-worklet function on the UI thread`).
- **Receita seguida (REESCRITA no BUG-0055; tabela do rótulo no fecho dos LOW):** o `formatValue` é aplicado do lado JS (`useMemo`, `monthly-chart-card.tsx:86-89`) e o texto do balão segue o índice pressado pela UI thread (`useSharedValue` + `useAnimatedReaction` sobre o `matchedIndex`, `ChartCrosshairValue` :47-67, com a casca `bg-accent px-4 pb-2` e o filho explícito `<ChartCrosshair.ValueLabel className="text-sm" />` no `:63-64`) — nenhuma função JS é chamada de dentro do worklet. A versão do IBX-0078 casava o mês por TEXTO (`months.indexOf`) e o balão ficava vazio/parcial; a seção do BUG-0055 documenta a causa e o conserto.
- **Consequência:** sem `formatValue` o balão mostra o número cru (`String(value)`) — é o **"set. · 4" aprovado** do "Partidas por mês", byte a byte igual ao de antes (o `${...}` do template antigo dá o mesmo texto que `String(...)`).

### Home da organização (a troca)

- **`src/components/pages/home/organizer-dashboard.tsx:95-109`** — o bloco "Receita por mês" deixou de ser rótulo + série em texto (`map(...).join(" · ")`) e passou a ser o `<MonthlyChartCard>` (:96-108). No IBX-0078 o bloco vivia SOLTO em `(tabs)/index.tsx:157-191` (`<MonthlyChartCard>` :164-181) e o IBX-0081 o moveu pra dentro do painel, com a query — ver a seção do IBX-0081 no fim desta spec:
  - `data` = `revenueSeriesQuery.data.series.map((point) => ({ label: formatDashboardMonthLabel(point.month), value: point.receivedCents }))` — **MESMA janela de 6 meses** da query que a tela já pedia (`months: 6`), MESMA série, MESMOS centavos (`receivedCents`). **Zero query nova, zero cálculo novo, zero builder novo, zero campo novo de contrato.**
  - `formatValue={formatCurrencyCents}` → o balão mostra "set. · R$ 90,00", exatamente o valor formatado que o texto mostrava (mesmo formatter, `lib/format/currency.ts`).
  - Título **"Receita por mês"** (o texto de hoje da tela, sem tocar a copy) e description **"Total de receita por mês nos últimos 6 meses."** — molde literal do aprovado ("Total de partidas por mês nos últimos 6 meses.").
- **"Total da janela" FICA como está** (rótulo + `formatCurrencyCents(totalCents)` em texto — `pages/home/organizer-dashboard.tsx:121-128` depois do IBX-0081, `(tabs)/index.tsx:182-189` no IBX-0078): não estava no pedido e a linha anterior desta spec registra que ele só sai com palavra dele (RUL-0033/RUL-0027). **SUPERSEDE (21-09-2026): a palavra chegou e o bloco foi REMOVIDO** — ver a seção da remoção no fim.
- **Nada mais da tela mudou:** KPIs, pendências, ordem dos blocos e o loading seguem iguais. A ordem VISUAL é a mesma (pendências → KPIs → chart → total); o que o IBX-0081 mudou foi o PAI do bloco, não o conteúdo.

### Call sites (os 3, todos migrados no mesmo passo)

> Faixas das colunas "Antes" e "IBX-0078" = código da época do round; os arquivos citados podem não existir mais no disco.

| Onde | Antes | Agora |
| --- | --- | --- |
| Home do jogador (`pages/home/player-dashboard.tsx:80-84`) | `<MonthlyMatchesCard data={monthlyMatches} />` com `{ label, matches }` (:57-60) | `<MonthlyChartCard data={monthlyMatches} title="Partidas por mês" description="Total de partidas por mês nos últimos 6 meses." />` com `{ label, value }` — sem `formatValue` (balão cru, o aprovado) |
| Galeria dev (`settings/components/[component].tsx:306-310`) | `<MonthlyMatchesCard data={galleryMatchesByMonth} />` | idem com as mesmas props do jogador; o dado de exemplo (:287-292) virou `{ label, value }` |
| Home da organização (`pages/home/organizer-dashboard.tsx:106-120` depois do IBX-0081; `(tabs)/index.tsx:164-181` no IBX-0078) | série em texto (`join(" · ")`, bloco removido) | `<MonthlyChartCard … formatValue={formatCurrencyCents} />` sobre `getRevenueSeries.series` |

### Apontamento RETRATADO no BUG-0055: o eixo Y **aparece** (o diagnóstico abaixo estava errado)

> **RETRATAÇÃO (BUG-0055 · 21-09-2026): o usuário testou no device e o eixo Y aparece — e mostrava os centavos CRUS ("1000 / 800 / 600 / 400 / 200 / 0"). O texto abaixo partia do `outputWindow` do chart, não do retângulo final do plot, e por isso concluiu "invisível". O mecanismo real e o conserto estão na seção do BUG-0055 no fim desta spec; o parágrafo fica como REGISTRO do erro.** Foi ele que sustentou o "não mexi no eixo" do IBX-0078.

- **O que eu li errado:** `CartesianChart.js:131-134` monta só o `outputWindow` (a janela do canvas, que começa em 0); o retângulo do plot vem DEPOIS, de `getCartesianChartBounds({ xScale, ... })` (`victory-native/dist/cartesian/utils/getCartesianChartBounds.js:9-40`, `left = xScale(domain[0])`), e o `xScale` é construído sobre um range AJUSTADO: `transformInputData.js:206-241` soma `xMinAdjustment += labelWidth + yLabelOffset` quando o eixo Y está à esquerda com `labelPosition: "outset"` (o default, `cartesian/utils/axisDefaults.js:36-42`), com `labelWidth` = o `maxYLabel` medido por `getAxisLabelLayout`. Ou seja: o plot começa depois dos rótulos e o `YAxis` desenha em `chartBounds.left - (labelWidth + labelOffset)` (`cartesian/components/YAxis.js:65-79`) **dentro** do canvas.
- **O eixo X tem o mesmo cuidado:** `adjustedOutputWindow.yMax -= xAxisOutset` (`transformInputData.js:100-150`) reserva a altura dos meses — por isso os dois eixos aparecem e nada é cortado.

### Verificação desta rodada

- **`bun run check` / `bunx ultracite check` (458 arquivos do repo)**: **zero apontamento nos arquivos deste corte** no fecho (os apontamentos que a varredura pegou no meio da rodada eram de arquivos de outros cortes — um WIP em `tournaments/[tournamentId]/entries.tsx` e um scratch em `.scratch-ibx0079-review.ts` —, intocados aqui e já fora da árvore).
- **`bun run typecheck` (app + convex)**: **0 erros** no estado final.
- **Testes (RUL-0002)**: `bun run test src` = **602 pass / 0 fail** em 57 arquivos e a suite completa `bun run test` = **1266 pass / 0 fail** em 102 arquivos. (No fecho do BUG-0055: 608 e 1272 pass, 0 fail.)
- **`git diff --check`**: limpo.
- **Verificação visual:** NÃO houve nesta rodada (RUL-0025). O que ela deixou aberto — o eixo cru e o balão instável — o usuário pegou no device e virou o BUG-0055, cujo conserto TEM prova de runtime no simulador (seção do BUG-0055, com screenshots).
- **WIP do usuário:** snapshot dos 4 arquivos antes de editar (`/tmp/IBX-0078-snap/`), `ui/kpi-card.tsx` (md5 `cabf852ec2bc4208561f8af58864e5b6`) **não foi tocado** — a edição da home da organização foi aditiva e nenhum estilo dele foi reescrito (RUL-0034). SEM COMMIT.

## Fix do chart de receita: eixo em reais e balão estável (BUG-0055 · 21-09-2026, sem commit)

O usuário testou o IBX-0078 no device e reportou DOIS defeitos no chart da home da organização. Escopo deste fecho: `monthly-chart-card.tsx` (componente global) + os 3 usos + esta spec. Nenhum outro corte foi tocado.

### Defeito 1 — eixo Y com centavos crus (e o meu diagnóstico errado do IBX-0078)

- **O que ele viu:** "1000 / 800 / 600 / 400 / 200 / 0" descendo pela lateral do chart de receita — os `receivedCents` da série, sem moeda e sem separador.
- **Reconciliação (o meu "o eixo Y não aparece" do IBX-0078 estava ERRADO; a retratação está na seção do IBX-0078):** o eixo aparece sempre. O que eu li foi só o `outputWindow` do chart (`victory-native/dist/cartesian/CartesianChart.js:131-134`, que começa em 0); o retângulo final do plot sai de `getCartesianChartBounds({ xScale, ... })` (`dist/cartesian/utils/getCartesianChartBounds.js:9-40`, `left = xScale(domain[0])`) e o `xScale` é montado sobre um range AJUSTADO: `transformInputData.js:206-241` soma `xMinAdjustment += labelWidth + yLabelOffset` para o eixo Y à esquerda com `labelPosition: "outset"` (o default: `dist/cartesian/utils/axisDefaults.js:36-42`), com `labelWidth` = o `maxYLabel` medido por `getAxisLabelLayout`. O plot começa DEPOIS dos rótulos e o `YAxis` desenha `chartBounds.left - (labelWidth + labelOffset)` (`dist/cartesian/components/YAxis.js:65-79`) dentro do canvas. **Erro de leitura meu, apontado pelo QA do card e confirmado pela tela dele.**
- **Causa do número cru:** o default do eixo é `formatYLabel: (label) => String(label)` (`dist/cartesian/utils/axisDefaults.js:36-42`) e o `IBX-0078` não passava formatter nenhum — o eixo é alimentado pelos VALORES da série (`transformInputData.js:181`), ou seja centavos.
- **Conserto:** prop opcional **`formatAxis`** no card (`monthly-chart-card.tsx:73`, `:102-115`) que entra no chart como `yAxis={[{ formatYLabel }]}` (`:145`); a home da organização passa o formatter COMPACTO que o repo já tem: `(cents) => formatCurrencyCents(cents, { whole: true })` (`pages/home/organizer-dashboard.tsx:105`; era `(tabs)/index.tsx:176-178` até o IBX-0081 mover o bloco) — nenhuma lib nova, nenhum formato inventado. O rótulo formatado passa pelo mesmo `getAxisLabelLayout` antes de virar texto (`transformInputData.js:181` e o `maxYLabel` de `:206-241`), então a margem do plot cresce com o rótulo e nada é cortado.
- **Escopo por uso (decidido e justificado):** o eixo em reais é ligado SÓ onde o dado é dinheiro (a home da organização, que é onde ele reclamou). O "Partidas por mês" (home do jogador e galeria) mantém o eixo numérico cru aprovado — `formatAxis` é opcional e esses dois usos não passam nada, então o desenho deles não muda. Impacto verificado em runtime na home do jogador: o eixo segue 0/1/2 (contagem), sem "R$".
- **Antes → depois (mesmos ticks, mesma série):** `1000 / 800 / 600 / 400 / 200 / 0` → **`R$ 10 / R$ 8 / R$ 6 / R$ 4 / R$ 2 / R$ 0`** (a série do DEV é de reais; o `whole` corta os centavos do rótulo do eixo, o balão segue com centavos).
- **E o eixo X?** Não está cortado nem empurrado: o mesmo `transformInputData` reserva a altura dos meses (`adjustedOutputWindow.yMax -= xAxisOutset`, `:100-150`) e a tela mostra os SEIS meses (`abr. mai. jun. jul. ago. set.`) na home da org e na do jogador — conferido nas duas telas no simulador. A hipótese do reviewer de que o X cairia fora pelo mesmo motivo do Y não se confirmou: os dois eixos reservam o próprio espaço.
- **Prova (runtime):** `/tmp/IBX-0078-final-limpo.png` (home da org com o eixo em R$ e os 6 meses; o mesmo arquivo em `/tmp/IBX-0078-org-home-instr.png` com a instrumentação do balão do defeito 2) e `/tmp/IBX-0078-bug0055-estado.png` (o estado inicial).

### Defeito 2 — balão do crosshair parcial ("ago · R$") ou vazio

- **O que ele viu:** ao pressionar a linha, às vezes "ago · R$" (cortado) e só depois de ~1s "ago · R$ 5,00"; outras vezes vazio.
- **Causa (provada no pacote, não suposta):** o rótulo é um `ReText` cuja LARGURA de layout vem do `value` do React — `const initialValue = useMemo(() => text.get(), [text])` (`heroui-native-pro/lib/module/helpers/internal/components/re-text.js:28`) —, enquanto o texto do toque chega por `animatedProps` (`:44`), FORA do layout do Yoga. Na versão do IBX-0078 o rótulo era um `useDerivedValue` lendo `state.x.value` + `months.indexOf(...)`: no mount `x.value` é `"" as string` e o `indexOf` cai no fallback, que devolvia o próprio `""` — o campo era medido para string VAZIA (mínimo do rótulo, 40pt; do pill, 80pt) e o texto do ponto só chegava depois, em um re-render que re-media. Daí os dois sintomas: sem re-render durante o toque o pill fica VAZIO; com re-render ele mostra o texto cortado no campo antigo ("ago · R$") até a re-medida ("ago · R$ 5,00" ~1s depois). O `indexOf` ainda tinha um defeito latente (LOW do reviewer): `getRevenueSeries` aceita janela de até 24 meses e o rótulo de mês REPETE depois de 12, então casar por texto mostraria sempre a primeira ocorrência.
- **Conserto — uma fonte só para o rótulo, semeada com o MAIOR texto e atualizada pelo ÍNDICE:**
  - `const label = useSharedValue(widestPillLabel)` (`monthly-chart-card.tsx:53`, dentro do `ChartCrosshairValue`) — o `value` do React (que é quem MEDE o campo) nasce com o maior rótulo da série: o campo cabe qualquer ponto e NUNCA é uma string vazia. **Limite declarado da semente:** o `widest` é o maior rótulo por COMPRIMENTO — proxy bom para os rótulos homogêneos daqui ("mmm. · valor"), mas em fonte proporcional dois rótulos de mesmo comprimento podem inverter por poucos pontos (limite conhecido, sem ação).
  - `useAnimatedReaction(() => matchedIndex.get(), (index) => label.set(pillLabelTable[index + 1]))` (`:55-60`) — o texto do toque é escolhido por ÍNDICE (`matchedIndex`, API pública do press state: `victory-native/dist/cartesian/hooks/useChartPressState.js:34`, setado no mesmo frame do `isActive` pelo `handleTouch` do `CartesianChart.js:254`), sem casar texto e sem fallback vazio: a TABELA vem pronta do `buildCrosshairLabels` (`monthly-chart-labels.ts`, regra pura testada) e a posição 0 é o "sem toque" (`matchedIndex` = -1). Nada de função JS dentro do worklet (RUL-0015 respeitada: nada de `runOnJS`/`runOnUI`) — e isso é medido, não suposto: uma função IMPORTADA não é workletizada pelo `babel-preset-expo` (sonda com o preset do repo: o módulo sai sem `__workletHash`), então chamá-la do worklet estoura "Tried to synchronously call a non-worklet function on the UI thread"; por isso o worklet só LÊ a posição da tabela.
  - `key={widestPillLabel}` no `ChartCrosshairValue` (`:185`) REMONTA a subárvore do campo quando a série muda de magnitude (raridade: só quando um mês cruza um dígito) e é ESSA remontagem que re-semeia o rótulo: desde o fecho dos LOW, o `useSharedValue` e a reaction moram DENTRO do filho remontado (`ChartCrosshairValue`, `:47-67`), então o valor do mount já é o `widest` NOVO — que é o texto que o `ReText` relê em `text.get()` e usa para medir o campo. **CORREÇÃO do fecho dos LOW (LOW 1 do review final, agora IMPLEMENTADO): a atribuição anterior — "quem RE-SEMEIA o rótulo é o RESTART do `useAnimatedReaction`" — descreve METADE do mecanismo.** O restart ESCREVE sim o widest no SharedValue: o mapper nasce `dirty: true` e o `start` marca `isAnyMapperDirty` (`react-native-reanimated/lib/module/mappers.js:169` e `:176`), o `mapperRun` executa todo mapper dirty (`:75-92`, com `mapper.worklet()` em `:89`) e, sem `dependencies`, as deps do `useAnimatedReaction` são os closures + os workletHashes (`react-native-reanimated/lib/module/hook/useAnimatedReaction.js:33-37`) — trocar a tabela reinicia o mapper e ele RODA uma vez, escrevendo `byIndex[0]` (o widest novo). O que o restart NÃO faz é RE-MEDIR: a largura do campo é o `value` do MOUNT do `ReText` (`re-text.js:28` e `:41`) e a escrita do toque/restart vai por `animatedProps`, fora do layout — no código anterior a remontagem acontecia ANTES dessa escrita, então o campo ficava dimensionado pelo rótulo antigo. Por isso só o `key` sobre a subárvore dona do SharedValue re-mede. O `useSharedValue` lê o argumento UMA vez, no mount (`react-native-reanimated/src/hook/useSharedValue.ts:24-34`, `useState(() => makeMutable(...))` em :27-33) — por isso a semente tem que nascer no filho que o `key` remonta. Era exatamente o "padrão à prova de timing" que a rodada anterior deixou como apontamento: implementado, com o `key` deixando de ser decorativo.
  - Os textos são PRÉ-FORMATADOS no lado JS (`pillLabels` do card, `src/components/ui/monthly-chart-card.tsx:86-89`) — o balão nunca monta string em pedaços.
- **Por que não pode mais sair parcial nem vazio:** o rótulo desenhado é sempre UMA string inteira, vinda da lista pré-formatada da série (nunca concatenada por partes, nunca `""`); a largura medida do campo é semeada com o MAIOR rótulo dessa mesma lista; e a única coisa que muda durante o toque é o texto nativo, que é sempre um rótulo completo.
- **Prova (runtime, simulador iPhone 17 Pro Max do canvas, sessão `qa` reusada, Metro único do Shell intocado — RUL-0032):**
  - **ANTES (mutação = semântica pré-fix):** com o mesmo estado forçado, rótulo sem fonte real (`useSharedValue("")` + o reaction removido) → o pill aparece **VAZIO** — o defeito relatado volta (`/tmp/IBX-0078-pill-mutado5.png`, recorte `-crop.png`).
  - **DEPOIS (fix):** no mesmo estado forçado o pill mostra **`set. · R$ 10,50` COMPLETO**, com o campo dimensionado para caber (`/tmp/IBX-0078-pill-fix2.png`, recorte `-crop.png`).
  - **Ressalva honesta sobre a mutação:** voltar SÓ a semente (`useSharedValue("")` mantendo o reaction) NÃO reproduz o defeito — a primeira escrita do reaction cai antes do primeiro passe de layout, então o campo já é medido com um rótulo real. A reversão decisiva é a FONTE do rótulo (pré-fix: `state.x.value` + `months.indexOf`), que é a que foi executada e deixou o pill vazio.
  - **Como o estado foi forçado:** o gesto sintético do agent-device não ativa o `activateAfterLongPress(100)` do pan do victory-native (duas gravações de tela, 24 frames, ZERO balão em cada), então a evidência usa instrumentação TEMPORÁRIA de 2 linhas (`isActive` fixo + `state.matchedIndex.value = data.length - 1`) — o código sob teste (semente + reaction) fica intacto. A instrumentação foi REMOVIDA: o arquivo final não tem `forcedActive` nem `useEffect` (grep) e o conteúdo é o do fix (`cp` da cópia de `/tmp`, md5 `a685f5a49efc7c1a363ebc5514c99213` após o `ultracite fix`).
- **Escopo por uso:** o conserto é do COMPONENTE (vale para os 3 usos). No "Partidas por mês" o maior rótulo é curto (`set. · N`) e o campo fica sobre o piso do tema nas duas telas; na receita o pill passa a caber o rótulo em reais. **RETRATAÇÃO (21-09-2026, WIP do usuário no balão):** a frase "o pill continua com a largura mínima de hoje — sem mudança visual" NÃO vale mais — a casca perdeu o `min-w-20`, a largura agora é só a semente do MAIOR rótulo sobre o piso do PRÓPRIO tema (`.chart-crosshair__value-container`, `min-width: calc(var(--spacing) * 14)`, que é MENOR que o `min-w-20` antigo) e o rótulo subiu para `text-sm`. **O conserto do BUG-0055 nunca foi o `min-w-20` (receita da doc): é a semente do maior rótulo + o `key` que a re-semeia.**

### Gates do fecho (estado final do código)

- **`bun run check`** EXIT 0 (ultracite em **458 arquivos** sem apontamento + `tsc` do app + `tsc` do convex com **0 erros**); `bunx ultracite check` escopado nos 2 arquivos do corte: limpo.
- **`bun run test src`** (canônico, RUL-0002): **608 pass / 0 fail** em 57 arquivos. Suite completa `bun run test`: **1272 pass / 0 fail** em 102 arquivos (8152 asserts).
- **`git diff --check`**: limpo.
- **Nada commitado, nenhum push, nenhuma OTA.** O simulador ficou na home da ORGANIZAÇÃO (o estado do início da sessão).

### Arquivos do corte

`src/components/ui/monthly-chart-card.tsx` (formatter de eixo + rótulo do balão), `src/app/(private)/(tabs)/index.tsx:176-178` (`formatAxis` da receita — hoje em `src/components/pages/home/organizer-dashboard.tsx:105`, onde o IBX-0081 pôs o bloco), `docs/spec/dashboard.md` (esta seção + retratação do eixo + citações corrigidas). Evidências em `/tmp/IBX-0078-*` (screenshots, recortes, vídeos e o telemetry dos gestos).

## Fecho dos LOW do review final do chart (IBX-0078 · 21-09-2026, sem commit)

Os três apontamentos LOW do Code Reviewer no fecho consolidado de IBX-0078/0079/0080. Escopo: o chart (`monthly-chart-card.tsx` + a regra pura co-localizada) e as citações desta spec — nenhuma tela, contrato, backend ou outro corte tocado.

### LOW 1 — o campo do balão era medido pelo rótulo ANTIGO

- **Defeito:** quando a série troca de magnitude (ex.: "R$ 999,99" → "R$ 1.234,56") o `key` remonta o valor do crosshair, mas o `SharedValue` do rótulo vivia na CARD: `useSharedValue` ignora o argumento depois do mount, então o `ReText` remontado relia `text.get()` com o rótulo VELHO e o campo seguia dimensionado por ele — o ponto mais longo podia cortar. É a MESMA classe do BUG-0055 que o usuário reportou.
- **Conserto:** o `SharedValue` e a `useAnimatedReaction` foram para dentro do `ChartCrosshairValue` (`monthly-chart-card.tsx:47-67`), a subárvore que o `key` remonta. A série nova monta um `SharedValue` NOVO, já semeado com o `widest` novo — o `key` deixou de ser decorativo e passou a ser o gatilho da re-semeadura. Nenhum `useEffect`, nenhuma escrita de shared value dentro do render.
- **Prova sem device:** a regra pura que produz a semente e a tabela do balão é testada (LOW 3), inclusive o cenário da LOW 1: com a série trocando de magnitude o `widest` — que é o `key` e o valor com que a semente do mount nasce — passa a ser o rótulo NOVO. **Ficou para o device:** que o `ReText` re-meça o campo no remount é semântica do pacote + React/Yoga e não é exercitada headless; a conferência visual é do usuário (RUL-0025).

### LOW 2 — citações repontadas (todas conferidas LENDO o arquivo)

Duas famílias: o bloco da home da organização cresceu quando o `<MonthlyChartCard>` entrou (as citações ficaram no estado anterior) e as citações ao próprio card andaram com este fecho (o balão ganhou o filho `ChartCrosshairValue` e a regra pura saiu para `monthly-chart-labels.ts`). **REPONTE (21-09-2026, WIP do usuário no balão):** o `<ChartCrosshair.Value>` ganhou o filho explícito `<ChartCrosshair.ValueLabel className="text-sm" />` e a casca virou `bg-accent px-4 pb-2` — o arquivo passou de 216 para 220 linhas, então TODA citação ao `monthly-chart-card.tsx` a partir do balão antigo (`:89`) andou **+4**; a coluna "Correto" desta tabela foi ATUALIZADA para os números de hoje (leitura direta do arquivo).

| Citação | Dizia | Correto | Onde |
| --- | --- | --- | --- |
| `(tabs)/index.tsx` · bloco da receita | `157-183` | **`157-191`** | `:691` |
| `(tabs)/index.tsx` · `<MonthlyChartCard>` | `164-173` | **`164-181`** | `:691`, `:704` |
| `(tabs)/index.tsx` · "Total da janela" | `174-181` | **`182-189`** | `:695` |
| `monthly-chart-card.tsx` · props | `54-60` | **`95-101`** | `:235`, `:679` |
| `MonthlyChartPoint` | `19-22` | **`25-28`** | `:679` |
| componente (corpo) | `53-146` | **`95-220`** | `:680` |
| `useMemo` do `tickValues` | `74-77`, `96-99` | **`126-129`** | `:223`, `:236`, `:680` |
| `useMemo` do `pillLabels` | `72-75` | **`113-116`** | `:686`, `:745` |
| semente + reaction do balão | `85-95` | **`73-93`** (o filho) | `:686`, `:742`, `:743` |
| `formatAxis` (prop) / `useMemo` do `yAxis` | `58`, `100-111` | **`99`, `130-141`** | `:731` |
| `yAxis={yAxis}` / `xAxis` do `AreaChart` | `141`, `139` | **`171`, `169`** | `:222`, `:731` |
| `yKeys` fixo → `value` | `142` | **`172`** | `:681` |
| `re-text.js` (medida × animatedProps) | `31`, `33-37` | **`28`, `44`** | `:740` |

As cinco citações a `entries.tsx` do ramo `mine` (`:270` card `490-537` e `Pagar` `111-121`, `:271`/`:285`/`:448` par do convite `86-110`, `:367` recusar `88-98` e aceitar `99-108`) foram conferidas no arquivo e **repontadas de novo em 23-09** — o lote do card encolheu o `entries.tsx` e os ranges antigos (`460-569`, `553-566`, `518-551`, `520-533`, `534-549`) caíram em outro código.

**SUPERSEDE (IBX-0081 · 21-09-2026):** as três citações a `(tabs)/index.tsx` desta tabela retratam o estado de ENTÃO e seguem verdadeiras como histórico; o bloco do chart + o "Total da janela" desceram para `src/components/pages/home/organizer-dashboard.tsx` (bloco `:104-130`, `<MonthlyChartCard>` `:106-120`, total `:121-128`; **hoje o bloco é `:107-121`, o card `:108-120` e o total foi REMOVIDO em 21-09-2026**) — a referência viva é a seção do IBX-0081 no fim desta spec.

### LOW 3 — a escolha do rótulo do balão tem teste (regra pura co-localizada)

- **`src/components/ui/monthly-chart-labels.ts`** — `buildCrosshairLabels(pillLabels)` devolve `{ byIndex, widest }`: a tabela que o worklet LÊ (posição 0 = sem toque, `matchedIndex` -1; 1..n = o rótulo de cada índice; última = índice fora da série) e o maior rótulo por COMPRIMENTO (empate fica com o primeiro). A regra saiu do componente porque uma função importada **não é workletizada** pelo `babel-preset-expo` (sonda descartável com o preset do repo: sem `__workletHash`) e chamá-la de dentro do worklet estouraria "Tried to synchronously call a non-worklet function on the UI thread".
- **`src/components/ui/monthly-chart-labels.test.ts`** — 6 casos: índice do ponto pressado; escolha por ÍNDICE com o rótulo de mês repetindo (24 meses); fallback do `matchedIndex` -1 e do índice fora da série (tabela inteira assertada, o contrato do `+ 1` que o card usa); maior rótulo por comprimento com o empate pelo primeiro da série; **série trocando de magnitude** (o `widest` acompanha o rótulo novo — o cenário da LOW 1); série vazia.
- **Dente provado por mutação** (4 mutações no módulo, cada uma quebra casos): tirar o fallback da ponta DIREITA → 2 fail; tirar o da ponta ESQUERDA → 4 fail; trocar o empate para o ÚLTIMO da série → 1 fail; `widest` = primeiro rótulo da série → 3 fail. Restaurado, 6 pass (`md5` do módulo idêntico ao original: `9b5970e68ae373691d4e63184ba37a2a`).

### Gates do fecho dos LOW

- **`bun run check`** EXIT 0 (ultracite em **460 arquivos** sem apontamento + `tsc` do app + `tsc` do convex com **0 erros**).
- **`bun test --isolate src/components/ui/monthly-chart-labels.test.ts`**: 6 pass / 0 fail. Suite completa `bun run test`: **1278 pass / 0 fail** em 103 arquivos (o módulo novo entra com os 6 casos).
- **`git diff --check`**: limpo.
- **Nada commitado, nenhum push.** Os arquivos do corte: `src/components/ui/monthly-chart-card.tsx`, `src/components/ui/monthly-chart-labels.ts` (novo), `src/components/ui/monthly-chart-labels.test.ts` (novo) e esta spec.

## O bloco do chart desce pro painel (IBX-0081 · 21-09-2026, sem commit)

Pedido do usuário no chat ("MonthlyChartCard não deveria estar dentro de OrganizerDashboard?"): o bloco do chart de receita + o "Total da janela" ficavam SOLTOS em `(tabs)/index.tsx`, renderizados FORA do gate `isLoading / isError / dashboardData` — apareciam mesmo com o painel falhando —, enquanto TODOS os outros blocos da home da organização moram em `pages/home/organizer-dashboard.tsx`, que já faz as próprias queries. Movimento de bloco: nenhum dado, contrato, backend ou copy tocados.

### O que mudou (e o que não mudou)

> Faixas da coluna "Antes" = código da época do round; os arquivos citados podem não existir mais no disco.

| | Antes | Depois |
| --- | --- | --- |
| Bloco do chart | `(tabs)/index.tsx:157-191`, IRMÃO do `OrganizerDashboard` dentro do `Page.ScrollView` | `pages/home/organizer-dashboard.tsx:95-109` (no IBX-0081), último bloco do `View className="gap-3"` do painel |
| `<MonthlyChartCard>` | `(tabs)/index.tsx:164-181` | `pages/home/organizer-dashboard.tsx:96-108` (no IBX-0081) |
| "Total da janela" (rótulo + valor) | `(tabs)/index.tsx:182-189` | chegou a descer pra `pages/home/organizer-dashboard.tsx:121-128` no IBX-0081 e foi **REMOVIDO em 21-09-2026** (a pedido do usuário) |
| Query `getRevenueSeries` | `(tabs)/index.tsx:78-83`, `{ ...staticQueryOptions({ months: 6 }), enabled: isOrganizationActor }` | `pages/home/organizer-dashboard.tsx:38-43`, `crpc.payment.dashboard.getRevenueSeries.staticQueryOptions({ months: 6 })` — sem `enabled`, no padrão das outras queries do painel, porque o painel só monta no ator organização (o gate que já existia) |
| Gate do bloco | `revenueSeriesQuery.data ? … : null`, FORA do gate do painel | mesmo `data ? … : null`, agora DENTRO do bloco que já trata loading/erro/vazio |

- **Nada de dado, contrato ou copy:** mesma série (`series[].receivedCents`), mesma janela (`months: 6`), mesmo `formatDashboardMonthLabel` no eixo X, mesmo `formatCurrencyCents(cents, { whole: true })` no eixo Y (`organizer-dashboard.tsx:105`), mesmo `formatCurrencyCents` no balão (`:106`), mesmo título "Receita por mês" (`:107`) e mesma description — **zero string nova, zero texto trocado** (RUL-0039). O rótulo "Total da janela", que desceu junto neste card no IBX-0081, saiu com a remoção do bloco em 21-09-2026.
- **Ganho (o motivo do pedido):** o chart deixou de renderizar sobre painel quebrado — se `payment.dashboard.getOverview` está em loading/erro/vazio, o chart não aparece (antes aparecia). **Custo declarado:** com `getOverview` em erro e `getRevenueSeries` OK, o chart some junto — consequência direta de o bloco passar a ser bloco do painel; nenhum estado novo foi inventado pra isso (nada de skeleton/gate próprio).
- **Único delta de espaçamento (declarado, não "escondido"):** o pai antigo era o `Page.ScrollView` (`contentContainerClassName` com `gap-4`) e o novo é o `View className="gap-3"` do painel, então a distância entre a última linha de KPI ("Em atraso") e o card do chart é 12px em vez de 16px. Naquele momento o par chart → "Total da janela" ficou em 12px (o `View className="gap-3"` que envolvia os dois virou fragmento, e o gap do pai dava o mesmo espaçamento); com a remoção do total (21-09-2026) o painel termina no card do chart e o `gap-3` do pai segue valendo pro último bloco. Nenhuma outra medida mudou.
- **Tailwind/gap na raiz do painel:** o bloco entrou no MESMO `View className="gap-3"` dos KPIs, na mesma posição visual (pendências → KPIs → chart → total; desde a remoção do total o painel fecha no chart).
- **Import limpo (RUL-0005/RUL-0008):** `MonthlyChartCard`, `formatCurrencyCents` e `formatDashboardMonthLabel` saíram de `(tabs)/index.tsx` (grep: zero uso restante no arquivo, e o docblock da rota segue descrevendo o desenho) e entraram em `organizer-dashboard.tsx`. O modo jogador (`pages/home/player-dashboard.tsx`, mesmo card em "Partidas por mês") e a galeria dev seguem INTOCADOS, com o mesmo componente global.
- **Semântica de montagem preservada:** o bloco continua condicionado a `revenueSeriesQuery.data` (nunca renderiza sem dado — o card não tem estado de loading próprio), como no IBX-0078.

### Gates desta rodada

- `bun run check`: **EXIT 0** (ultracite em 460 arquivos sem apontamento + `tsc` do app + `tsc` do convex com 0 erros).
- `bun run test`: **1278 pass / 0 fail** em 103 arquivos.
- `git diff --check`: limpo.
- **Sem verificação visual nesta rodada** (o usuário estava testando no simulador e a regra da rodada foi não abrir sessão de device nem encostar no Metro do Shell — RUL-0032; nenhuma OTA publicada, a `01a0c3be` no ar não foi mexida). O delta de 4px do gap e o desaparecimento do chart com o painel em erro são os dois pontos a conferir no dedo.
- WIP do usuário (`ui/kpi-card.tsx`, md5 `cabf852ec2bc4208561f8af58864e5b6`) e `profile.tsx`, `username-rules`, `entries.tsx`, `derived.ts`, `player-overview.tsx` e `monthly-chart-card.tsx` intocados. **SEM COMMIT e sem push.**

## Um Page só na rota (IBX-0082 · 21-09-2026, sem commit)

Pedido do usuário: "o Page ali, o header, e o mesmo no organizer mode e o mesmo no player mode, entao a verificacao se e organizador ou player deveria vir la dentro, dentro do Page.ScrollView... nao precisava ter outros dois return". A rota tinha DOIS returns (um por papel), cada um com o próprio `Page` + `Page.Header` + `ScrollShadow` + `Page.ScrollView` e o header duplicado byte a byte. Agora é **UM return** (`(tabs)/index.tsx:105-186`, 210 linhas contra 206): um `Page`, um `Page.Header` (:107-148) e um `ScrollShadow`/`Page.ScrollView` (:149-183), com o conteúdo resolvido DENTRO do ScrollView (`:155-182`) — forma final escolhida pelo usuário no IBX-0083 (nem ternário fora do ScrollView, nem variável de conteúdo). Header único: o ÚNICO ponto que difere por papel é o destino do toque no avatar, `router.navigate(isOrganizationActor ? "/settings/organization/profile" : "/settings/player/profile")`; o resto (avatar `size-10 rounded-full` + `fallback="green"`, badge de não lidas, saudação, botão de `Settings02Icon`) é literalmente o mesmo JSX.

- **Zero mudança visual e de comportamento:** as contagens antes→depois de cada literal do header e do casco SÓ caem de 2 para 1 (`fallback="green"`, `variant="ghost"`, `icon={Settings02Icon}`, `className="-mt-1"`, `color="danger"`, `size="sm"`, `className="flex-1 flex-row items-center justify-between gap-4"`, `size-10 rounded-full`, `<ScrollShadow className="flex-1" …>`, `showsVerticalScrollIndicator={false}`) porque o JSX deixou de existir em dobro — nenhuma string saiu de cena e a mensagem `"Não foi possível carregar o painel."` segue 1. As classes por papel que restam são as mesmas de antes (o `PressableFeedback` do avatar e o gate do painel).
- **`contentContainerClassName` unificado em `"gap-4 px-4 pb-safe-offset-23"` (o do organizador), com prova de leitura: o `grow` do jogador era REDUNDANTE.** O próprio `Page.ScrollView` (`components/core/page/scrollview.tsx:65`) já injeta `grow` em TODO content container — `contentContainerClassName={cn("grow", props.contentContainerClassName)}` —, e `Page.ScrollView` é o `PageKeyboardAwareScrollView` (`core/page/index.tsx:32`), então os dois papéis já recebiam `grow` e o token explícito do jogador era resíduo. Consequência: não precisou de classe condicional e o layout do organizador não mudou (a classe dele é literalmente a mesma; o jogador perde só o token duplicado).
- **Hooks intactos:** nenhum hook virou condicional e todos seguem no topo; os antigos `dashboardData`/`isLoading` do ramo da organização SAÍRAM do corpo (quem lê o estado das queries são os ramos dentro do `Page.ScrollView` — IBX-0083) e o `dashboardQuery` continua com `enabled: isOrganizationActor` (`(tabs)/index.tsx:81`), como antes.
- **Gate de ator (BUG-0056 · 21-09-2026, sem commit):** o usuário viu o painel do JOGADOR por um instante ao abrir o app, trocando pro da organização depois. Causa: `isOrganizationActor` sai de `viewer.context.get` e, enquanto essa query está PENDENTE, `activeActor` é null → false → caía no `<PlayerDashboard>`. O gate é o PRIMEIRO ramo do CONTEÚDO, dentro do `Page.ScrollView` (`viewerContext.isPending ?` → `<LoadingState />`, `(tabs)/index.tsx:155-156`; a forma VIGENTE é a cadeia do ScrollView — ver o IBX-0083) e a escolha nunca acontece com o ator indefinido; ator resolvido e NULO cai no jogador. Efeito colateral do mesmo furo, consertado junto: `playerProfile` tinha `enabled: !isOrganizationActor` (agora `enabled: !(viewerContext.isPending || isOrganizationActor)`, `:60` — o MESMO sinal do gate do ator, e não `isSuccess`: no ERRO do ator `isPending` é false e o perfil volta a ser buscado, o comportamento do HEAD nesse caminho) e disparava no primeiro frame mesmo na organização. No erro do ator o perfil segue com um consumidor real: o HEADER (nome/avatar), que aparece nos quatro estados — ver o IBX-0083.
- **Ordem dos estados (o que o gate garante):** ator pendente → `LoadingState` (o painel do jogador NÃO monta, então nem a query `player.dashboard.getOverview` dele dispara); ator = organização → o painel financeiro (erro → `ErrorState`, dado → `OrganizerDashboard`, sem dado → `LoadingState`); ator = jogador → `<PlayerDashboard />`. **Erro do ator era APONTADO aqui como "cai no jogador em silêncio": o usuário DECIDIU no IBX-0083 que ele passa a mostrar `ErrorState`** — ver a seção do IBX-0083.
- **Custo declarado no header:** durante o gate o header já está na tela com o nome VAZIO e o avatar no `fallback="green"` (`userName`/`userAvatarSource` saem de `activeActor`/`playerProfile`) — igual a antes do fix; para o JOGADOR o nome passa a chegar um round-trip depois, porque o perfil agora espera o ator (é exatamente a janela que o `LoadingState` cobre). Nenhum desenho do header mudou; a proposta de fallback pelo `session.data.user.username` ficou **APONTADA, sem aplicar**.
- **Gates:** `bun run check` EXIT 0 (ultracite em 460 arquivos sem apontamento + `tsc` do app + `tsc` do convex, 0 erros); `bun run test` **1278 pass / 0 fail** em 103 arquivos; `git diff --check` limpo. Sem verificação visual (RUL-0032: o usuário estava no simulador — nenhuma sessão de device, nenhum toque no Metro do Shell, nenhuma OTA). Diff de cada card em `/tmp/IBX-0082-diff/` (união da rota: `before/` = estado do IBX-0081, `after/` = estado do IBX-0082) e `/tmp/BUG-0056-diff/` (o gate de ator: `before/` = estado do IBX-0082, `after/` = o do gate) e `/tmp/BUG-0056-enabled-diff/` (o predicado do `enabled`: `before/` = gate com `isSuccess`, `after/` = o do BUG-0056, o predicado). A tabela de estados do `enabled` sai de `/tmp/prova-bug0056-enabled.mjs` (script descartável: os flags são do `@tanstack/query-core` instalado, 8 checagens, 0 fail). **SEM COMMIT e sem push.**


## Os quatro estados da home num ponto só (IBX-0083 · 21-09-2026, sem commit)

O usuário REPROVOU a forma que o BUG-0056 deixou no JSX: "sao quatro coisas que se precisa na tela: o loading, o error state, o organizer dashboard e o player dashboard... do jeito que voce fez, visualmente, vendo esse codigo, ta ridiculo... senior nao pensaria desse jeito", e complementou que o `ErrorState` não cobre só o ator e o painel da organização: "e se o ator falhar, e se o painel da organizacao falhar E SE O PAINEL DO PLAYER FALHAR. Nao esqueca do player."

### Os estados DENTRO do `Page.ScrollView` (forma final escolhida pelo usuário)

- **A/B decidido pelo usuário = A**, com regra dura: "tudo que voce for fazer nessa merda e pra fazer DENTRO do page.scrollview. Nao e pra fazer lugar e colocar homeContent no outro." Então a variável `homeContent` e a cadeia de `if`/`else if` do corpo foram **DELETADAS**: a decisão mora no `{…}` do `Page.ScrollView` (`(tabs)/index.tsx:155-182`, dentro do `Page.ScrollView` `:150-183`). Sem função separada, sem componente novo, sem variável de conteúdo fora do ScrollView.
- **LOW 1 do delta-check (doc):** a frase anterior — "zero ternário no JSX" — não batia ao pé da letra, porque a rota tem QUATRO ternários, todos no HEADER, pré-existentes e fora da resolução dos estados (`userName` `:114-116`, `userAvatarSource` `:117-119`, destino do toque no avatar `:131`, `unreadCount > 0 ? <Badge> : null` `:144` — nenhum deles tocado). A redação correta é: **zero ternário na RESOLUÇÃO DO CONTEÚDO** (os 4 do header são JSX pré-existente, não parte dos quatro estados).

| Estado | Ramo da cadeia (na ordem em que a tela pensa) |
| --- | --- |
| `LoadingState` — espera do ATOR | `viewerContext.isPending ?`, `:155-156` |
| `ErrorState` — falha do ATOR | `: viewerContext.isError ?`, `:157-161` |
| `ErrorState` — falha do painel da ORGANIZAÇÃO | `dashboardQuery.isError ?`, `:163-167` |
| `OrganizerDashboard` | `dashboardQuery.data ?`, `:168-169` |
| `LoadingState` — espera do painel da ORGANIZAÇÃO | `) : (<LoadingState />)`, `:170-172` |
| `ErrorState` — falha do painel do JOGADOR | `: playerOverviewQuery.isError ?`, `:173-177` |
| `PlayerDashboard` | `playerOverviewQuery.data ?`, `:178-179` |
| `LoadingState` — espera do painel do JOGADOR | `) : (<LoadingState />)`, `:180-182` |

- **São QUATRO componentes e TRÊS fontes de falha:** o `LoadingState` cobre as duas esperas (a do ator e a do painel escolhido — "sem erro e sem dado" é a espera) e o `ErrorState` cobre a falha do ATOR (`(tabs)/index.tsx:157-161`), a do painel da ORGANIZAÇÃO (`:163-167`) e a do painel do JOGADOR (`:173-177`). Cada um com a sua mensagem, num `const` no topo do arquivo: `ACTOR_ERROR_MESSAGE` = **"Não foi possível identificar o seu perfil."** (copy do usuário, ditada no BUG-0056 — APONTADA: é texto dele), `DASHBOARD_ERROR_MESSAGE` = "Não foi possível carregar o painel." (a que a tela já mostrava) e `PLAYER_DASHBOARD_ERROR_MESSAGE` = "Não foi possível carregar seu painel." (**a MESMA copy que o `PlayerDashboard` mostrava na falha do dado dele, içada literalmente**). O `ErrorState` do repo não tem retry: a ação dele é `Voltar` (`ui/error-state.tsx:46-49`), então nada de botão novo.
- **Ordem dos estados SEMÂNTICA:** ator primeiro (sem ele não se sabe de quem é a home), depois o painel do papel. **Ator resolvido e NULO cai no jogador** (comportamento de antes, sem estado novo) e **erro do ator deixou de cair no painel do jogador em silêncio** — DECISÃO DO USUÁRIO no BUG-0056: mostra `ErrorState`.
- **Caso de borda declarado:** o antigo ramo `: null` (painel da organização sem erro e sem dado) virou `LoadingState` (`(tabs)/index.tsx:170-172`) — inalcançável na prática (`status` do React Query é pendente/sucesso/erro; sucesso sempre traz dado neste contrato) e a tela mostra espera em vez de um vazio mudo.

### O painel do jogador virou apresentação (a carga subiu pra rota)

- **Leitura do `PlayerDashboard` antes:** ele montava as PRÓPRIAS queries — `player.dashboard.getOverview` (o dado primário) e `pendings.list` escopo player (o bloco de alertas) — e tratava o próprio loading (`if (overviewQuery.isPending) return <LoadingState />`) e o próprio erro (`if (overviewQuery.isError || !overviewQuery.data) return <ErrorState message="Não foi possível carregar seu painel." />`). Ou seja: a home não tinha como saber que ele falhou.
- **Molde do repo (e o que foi feito):** o `OrganizerDashboard` é APRESENTAÇÃO e recebe `data` — carga e erro são do pai —, enquanto as queries de BLOCO (pendências, saldo, série) ficam no painel. `PlayerDashboard` passou a seguir o mesmo desenho: **`props: { data: PlayerDashboardOverview }`** (`pages/home/player-dashboard.tsx:33`), com o `getOverview` subindo pra rota (`(tabs)/index.tsx:87-90`, com o comentário do bloco em `:84-86`; LOW 2 do delta-check: a citação anterior dizia `:103-110`, mas de `:110` em diante entram a linha em branco (`:109`) e o `notificationStatus` em `:110-112`) e o `enabled: viewerContext.isSuccess && !isOrganizationActor` em `:107` e o `pendingsQuery` FICANDO no painel (`player-dashboard.tsx:39-41`), alimentando o `PendingAlerts` com `isLoading`/`isError`, como no painel da organização. **Sem query duplicada:** a única fonte do `getOverview` do jogador é a rota, e a única do `pendings.list` player é o painel.
- **O que saiu do `PlayerDashboard`:** os dois blocos de estado (`LoadingState`/`ErrorState`) e os imports deles; o corpo virou `const overview = props.data;`. Nada mais mudou — mesmos blocos, copy, classes e navegação.

### `playerProfile.enabled` — decisão mantida, com a justificativa do estado novo

- **LOW 3 do delta-check (performance), aplicado:** a `playerOverviewQuery` tinha `enabled: !(viewerContext.isPending || isOrganizationActor)` (`:105`) e, com o ator em ERRO, o ramo 2 do conteúdo mostra `ErrorState` — o painel do jogador NUNCA monta e o GET de `player.dashboard.getOverview` saía com o payload descartado (o único consumidor dessa query é o painel do jogador). Agora ela é **`enabled: viewerContext.isSuccess && !isOrganizationActor`** (`(tabs)/index.tsx:89`): só busca depois de o ator resolver COM SUCESSO e não ser organização.
- **O `playerProfile` (`:46`) NÃO mudou, e o trade fica APONTADO (decisão do usuário, não tomada):** ali o GET tem DOIS consumidores no caminho de erro do ator — o HEADER (nome/avatar, em tela nos quatro estados, porque mora no casco e não no ScrollView) e o `useEffect` de firstRun (`:49-77`, redirect em `:60-69`). Manter `!isPending` = identidade no erro + o redirect do HEAD; trocar por `isSuccess` = zero request e header vazio. Predicado no disco hoje: **`enabled: !(viewerContext.isPending || isOrganizationActor)`** (`(tabs)/index.tsx:46`; o `&&` da primeira versão foi reescrito pelo `ultracite` na forma de De Morgan, mesma semântica). **No erro do ator ele CONTINUA buscando** — e vale, porque o único consumidor nesse estado é o HEADER (nome/avatar), que está em tela nos QUATRO estados (ele mora no casco, não no `ScrollView`); com o ator em erro o dado não alimenta painel nenhum, mas ainda identifica quem está usando o app. O `Header` NÃO faz parte dos quatro estados: ele é o casco do `Page`, com o nome vazio e o avatar no `fallback="green"` enquanto ator/perfil não chegam (custo declarado, igual ao de antes do BUG-0056).

### Gates do IBX-0083

- `bun run check`: **EXIT 0** (ultracite em 460 arquivos sem apontamento + `tsc` do app + `tsc` do convex, 0 erros) — o `tsc` é a prova de que a assinatura nova do `PlayerDashboard` casa com o único call site.
- `bun run test`: **1278 pass / 0 fail** em 103 arquivos.
- `git diff --check`: limpo.
- **Sem verificação visual** (RUL-0032: sem device, sem Metro, sem OTA). O único call site do `PlayerDashboard` é a home (`grep` em `src/`: nenhum outro), então não há tela a migrar.
- Diff desta rodada em `/tmp/IBX-0083-diff/` (`before/` = estado pós-BUG-0056, `after/` = o de agora, com a rota e o painel do jogador). Arquivos: `src/app/(private)/(tabs)/index.tsx`, `src/components/pages/home/player-dashboard.tsx` e esta spec. SEM COMMIT e sem push.

## Loading da home: o "loading a mais" era o `PendingAlerts` (BUG-0057 · 21-09-2026, sem commit)

Report do usuário (literal): "quando eu faco o reload do app, ele aparece o loading. E ai ele, por exemplo, ja identificou que eu to numa organizacao. So que o loading ainda continua aparecendo. E aparece o [dashboard] normal ali e tal. Ele aparece pouquinho o loading a mais e depois some o meu loading. Acho que ta pouquinho errado isso."

### A causa real (achada pelo USUÁRIO, 21-09-2026, direto no chat)

- **Palavras dele, literais:** "o erro do loading a mais, eu descobri onde que era. Era no pending alerts. Porque la tem a propria loading. Eu coloquei agora como null. Da uma conferida. Entao tudo que voce fez, da uma revisada pra ver se realmente precisa ser feito. E esse animation aí disable, cara, pelo amor de Deus, tira isso."
- **Fato no código:** a home tem **TRÊS cargas** — (1) o ATOR (`viewer.context.get`), (2) o painel do papel (`dashboardQuery` / `playerOverviewQuery`) e (3) as **pendências de BLOCO** (`pendings.list`, query montada DENTRO do painel). Até esta rodada o `PendingAlerts` desenhava o **PRÓPRIO `<LoadingState />`** enquanto `isLoading` (`pending-alerts.tsx` no WIP do usuário: `if (props.isLoading) { return <LoadingState />; }` — hoje o arquivo devolve `null` em `:37`), e **os SEIS call sites** passam `isLoading` do estado da própria query de pendências (`pages/home/organizer-dashboard.tsx:53`, `pages/home/player-dashboard.tsx:67`, `pages/tournaments/organizer-overview.tsx:55`, `pages/tournaments/player-overview.tsx:98`). **Era ESSE o desenho que aparecia DEPOIS de o painel já estar em tela** — o terceiro loading, não a espera do ator nem a do painel.
- **Decisão do usuário (21-09-2026, direta no chat), já no disco:** `isLoading` devolve **`null`** NAQUELE componente (`pending-alerts.tsx:37-39`), com o import de `LoadingState` removido (o `ErrorMessage` passou a ser o import de topo, `:6`); o **estado de ERRO fica intacto** — `props.isError` segue renderizando o `ErrorMessage` ("Não foi possível carregar suas pendências.", `:41-45`). O arquivo é **WIP do usuário** (md5 `9addd6624c1fd655cf40dddcf75e1d7b`; snapshot em `/tmp/BUG-0057-wip-usuario-pending-alerts-20260921-1005.tsx`) — ninguém mais edita. Efeito: as seis telas que usam o renderer (ele é COMPARTILHADO, não é só a home) deixam de mostrar spinner de pendências; o bloco aparece quando o dado chega. **O prop `isLoading` NÃO é código morto e não deve ser removido:** nos SEIS call sites ele segue sendo o CONTRATO do renderer (o par do `isError`, alimentado pelo estado de pendências de cada tela — `pendingsQuery.isPending` nas duas homes e `bucket$.identity.pendingsStatus === "loading"` nos quatro overviews) e é ele que declara "esta tela ainda não tem o dado de pendências"; apagar o prop é mudança de contrato nas seis telas, não limpeza (a decisão do usuário foi `isLoading -> null`, não matar o prop).
- **O fix do fade do spinner foi DESCARTADO e REVERTIDO.** A rodada anterior tinha aplicado `<Spinner animation="disabled" />` + docblock em `src/components/ui/loading-state.tsx`; o usuário mandou tirar ("E esse animation aí disable, cara, pelo amor de Deus, tira isso"), porque a causa era outra. O arquivo voltou ao HEAD **byte a byte**: `git diff -- src/components/ui/loading-state.tsx` VAZIO e md5 do working tree = md5 de `git show HEAD:src/components/ui/loading-state.tsx` = `23e632548f574355ffc8e4a095f2b893`. O `LoadingState` é de novo `<Spinner />` sem docblock. **Nenhum outro arquivo foi cortado sob o BUG-0057:** `grep -rn "BUG-0057"` no repo aponta só para esta spec.
- **Limpeza do resíduo APLICADA (mesma leva):** `ui/pending-alerts.test.tsx` **não tem caso de `isLoading`** (nenhuma asserção sobre o ramo — os casos são wiring dos botões/navegação), então **nada mudou nele por comportamento**; só o `mock.module("@/components/ui/loading-state", …)` ficou SEM uso depois da remoção do import e foi DELETADO (3 linhas, era `:63-65`), com o comentário do `afterAll` corrigido de "seis" para **"cinco"** módulos que não voltam (`:203`). Os oito stubs que ficam continuam consumidos: `react-native`/`better-styled`/`widget-alert`/`error-state`/`crpc` pelo renderer e `react-query`/`expo-router`/`heroui-native` pelo runner (`useMutation`+`useQueryClient`, `useRouter`, `useToast` em `lib/pendings/use-pending-action-runner.ts:1-3`).

### O diagnóstico que NÃO era a causa (fica como fato estrutural, sem mudança de comportamento)

- **Espera em DUAS fases EM SÉRIE — CONFIRMADA como fato, mas NÃO é o que o usuário via.** `dashboardQuery` tem `enabled: isOrganizationActor` (`(tabs)/index.tsx:81`) e `playerOverviewQuery` tem `enabled: viewerContext.isSuccess && !isOrganizationActor` (`:89`); nenhuma das duas pode COMEÇAR antes de o `viewer.context.get` resolver, então a espera é round trip do ator + round trip do painel. **Nada mudou na ordem nem no comportamento da home por isso** — e não há como remover a serialização sem saber o papel antes do ator.
- **Hipóteses REFUTADAS** (registradas para não voltarem): (a) **remontagem do `LoadingState`** na passagem da fase 1 para a fase 2 — mesmo slot, mesmo `type`, sem `key` ⇒ o React reconcilia a MESMA instância; (b) as **animações de entrada/saída do spinner** — era o fix que o usuário derrubou; o "loading a mais" era o `LoadingState` do `PendingAlerts`, um nó DIFERENTE, montado com o painel já em tela.
- **APONTADO, sem dono (decisão do usuário, não tomada):** persistir o último ator conhecido para a query do painel já sair no primeiro frame — é a única alternativa que REMOVE um round trip inteiro da abertura, ao custo de manter estado persistido do ator e do risco de um frame com o papel errado quando o ator mudou entre sessões.

### Gates desta revisão

- `bun run check` EXIT 0; `bun run test` **1278 pass / 0 fail** em 103 arquivos; `git diff --check` limpo. Sem device, sem Metro e sem OTA (RUL-0032). Arquivos desta revisão: `src/components/ui/loading-state.tsx` (revertido ao HEAD), `src/components/ui/pending-alerts.test.tsx` (limpeza do mock morto) e esta spec. SEM COMMIT.

## Remoção do bloco "Total da janela" (21-09-2026, sem commit)

Decisão do usuário nesta rodada (bloco removido a pedido dele, 21-09-2026, decisão direta no chat): o bloco **saiu da home da organização** e NÃO teve substituto — nada de outro número, outro rótulo ou outro lugar.

- **O que saiu:** o `View className="gap-1"` com o par de `Text` (rótulo **"Total da janela"** + `formatCurrencyCents(revenueSeriesQuery.data.totalCents)`), que era o ÚLTIMO filho do `View className="gap-3"` do `OrganizerDashboard` — antes da remoção ele vivia em `pages/home/organizer-dashboard.tsx:121-128` (faixa lida no arquivo); o arquivo passou de 133 para 123 linhas (`wc -l`; o mesmo delta de -10 em qualquer contagem).
- **O que ficou, byte a byte:** o `<MonthlyChartCard>` do bloco do chart (`:107-121`, card `:108-120`) — mesma série (`series[].receivedCents`), mesmo `formatDashboardMonthLabel` no eixo X, mesmo `formatCurrencyCents(cents, { whole: true })` no eixo Y (`:117`), mesmo `formatCurrencyCents` no balão (`:118`), mesmo título "Receita por mês" (`:119`) e mesma description. O fragmento `<>…</>` saiu junto, porque sobrou UM filho (o cartão) — sem wrapper à toa.
- **Cutover limpo (RUL-0005):** o import `{ Text }` de `@/components/core/text` SAIU (o par de `Text` do total era o único uso do arquivo — conferido com `grep`); `formatCurrencyCents` FICOU (eixo do gráfico, balão e os KPIs "Recebido este mês"/"Previsto/mês"); `revenueSeriesQuery` FICOU (alimenta `series` no chart).
- **Campo APONTADO como morto no app:** o `totalCents` de TOPO do `getRevenueSeries` deixou de ser lido por qualquer arquivo de `src/` (os outros dois leitores de `totalCents` são `bySource[].totalCents`, outro campo, em `pages/tournaments/organizer-overview.tsx:43`). O campo segue no contrato: o `totalCents` da SÉRIE é o `dashboardRevenueSeriesSchema.totalCents` (`convex/domains/payment/contract.ts:211` — o `:205` é o `totalCents` de `dashboardRevenueSourceSchema`, o `bySource`, OUTRO campo), é calculado em `convex/domains/payment/dashboard-rules.ts:113` e tem teste de backend (`convex/domains/payment/tests/dashboard-rules.test.ts:104`) — tirar é mudança de contrato/backend e precisa da palavra do usuário.
- **Gates:** `bun run check` EXIT 0, `bun run test` 1278 pass / 0 fail, `git diff --check` limpo. Arquivos: `src/components/pages/home/organizer-dashboard.tsx` + esta spec. SEM COMMIT.

## Esqueleto no valor de todos os KPIs (IBX-0087 · 21-09-2026, sem commit)

O usuário viu KPI **sem esqueleto no lugar do valor** enquanto carregava. A prop
`isLoading` do `KpiCard` já existia (`src/components/ui/kpi-card.tsx:23`; o valor
vira `Skeleton className="h-6 w-28 rounded-xl"`, `:64-65`) e era usada **só** no
saldo da home da organização (`pages/home/organizer-dashboard.tsx:71-86`) — o buraco
estava nos call sites que não passavam a prop. Esta rodada liga a prop em TODO KPI
cujo número tem carga própria, e nada mais: layout, padding, rótulo, valor,
`tint`, `action`, textos e o componente em si ficaram intocados (nenhum
`className` extraído, RUL-0026).

**SUPERSEDE o bullet do IBX-0075 r2** ("`KpiCard` entra só com `label` + `value`
(e `isLoading` no saldo)"): agora todo KPI com carga própria entra com `isLoading`.

### Call sites com a prop ligada (de onde vem o valor → condição)

| KPI | Arquivo:linha | Dono do valor | `isLoading` |
| --- | --- | --- | --- |
| Receita do torneio | `pages/tournaments/organizer-overview.tsx:64` | `getRevenueSeries` do próprio painel (`:34`) cruzada com `entryIds` (de `entries`) | `revenueSeriesQuery.isPending \|\| entriesLoading` |
| Inscrições | `pages/tournaments/organizer-overview.tsx:69` | `entries` do bucket (`entries.listForTournament`) | `entriesLoading` |
| Partidas | `pages/tournaments/organizer-overview.tsx:78` | `entries` (lados) **e** `matches` do bucket | `entriesLoading \|\| matchesLoading` |

A **receita espera as DUAS cargas**: o valor sai do cruzamento de `bySource` com
os ids da outra query (`membershipIds`/`entryIds`), então o `isLoading` dos dois
KPIs de receita é `isPending` **ou** o flag da outra fonte (com `isPending`
sozinho o esqueleto podia sumir antes de os ids chegarem).

### Call sites SEM a prop (o dado já chega resolvido — nada inventado)

- **Home do organizador** — "Recebido este mês"
  (`organizer-dashboard.tsx:89-92`), "Previsto/mês" (`:93-96`) e "Em atraso"
  (`:99-102`) saem de `props.data`
  (`payment.dashboard.getOverview`), que a ROTA espera antes de montar o painel
  (`(tabs)/index.tsx:155-182`: erro → `ErrorState`, dado → painel, senão
  `LoadingState`). O saldo (`:71-86`) já tinha a prop.
- **Home do jogador** — "Vitórias" (`player-dashboard.tsx:92`), "Derrotas"
  (`:93`), "Aproveitamento" (`:94-97`) e "Suas inscrições" (`:100-103`) vêm de
  `props.data` (`player.dashboard.getOverview`), resolvido na rota pelo mesmo
  gate (`(tabs)/index.tsx:155-182`, IBX-0083).
- **Casa do torneio (jogador)** — `pages/tournaments/player-overview.tsx` não tem
  `KpiCard` (só `PendingAlerts` + `MatchCard`).
- **Galeria dev** — `settings/components/[component].tsx:74-102` são variantes
  estáticas (props fixas, nenhuma query): não existe estado de carga ali.

### O estado que faltava nos KPIs de bucket

A casa do torneio lê o número pelo bucket, e o bucket só tinha
status de **pendências** — a query de bloco vive no `_layout` do cluster, então o
`KpiCard` não tinha como saber que ela estava em voo. Cada layout passou a
alimentar dois flags por casa: `identity.challengesLoading` /
`identity.entriesLoading` /
`identity.matchesLoading` (torneio). A escrita é **POR FLAG**: torneio em
`isPending` (`tournaments/[tournamentId]/_layout.tsx`); torneio em
`tournaments/[tournamentId]/_layout.tsx:143-146` (matches, com o gate
`shouldFetchMatches`) e `:138` (entries, SEM gate, porque a query nunca é
desabilitada). Query desabilitada não pode fixar o flag em `true` (seria
esqueleto eterno nos KPIs). O `reset()` do bucket
zera os flags — flag preso em `true` depois do reset é o mesmo defeito —, e isso
está coberto nos testes de reset dos dois stores.

### Gates desta rodada

- `git diff --check` limpo; `bun run check` EXIT 0; `bun run test` **1284 pass / 0
  fail** em 103 arquivos. Sem device, sem Metro e sem OTA (RUL-0032). Arquivos:
  `src/lib/tournaments/tournament-details-store.ts`,
  os dois `_layout.tsx` dos clusters, os três `*-overview.tsx` com KPI, os dois
  testes de store e esta spec (mais as notas em `tournaments.md`).
  SEM COMMIT.

## Esconder na home — dispensa por superfície (IBX-0085 · 21-09-2026, sem commit)

Corte do Frontend sobre o contrato já publicado no DEV (tabela, mutation e o
parâmetro `surface` da leitura; a regra é de `docs/spec/pendings.md`, não
repetida aqui). O gesto de esconder existe SÓ na home — a casa continua sem ele.

- **As duas homes leem a superfície `home`:** `pages/home/organizer-dashboard.tsx:32-37`
  (escopo organization) e `pages/home/player-dashboard.tsx:36-41` (escopo player)
  passam `surface: "home"` na `pendings.list`. As casas (layout do
  torneio) seguem SEM o parâmetro, ou seja, lendo a casa — que nunca esconde.
- **A ação revelada deixou de ser só pintura.** `PendingAlerts` ganhou a prop
  OPT-IN `dismissSurface` (`ui/pending-alerts.tsx:21`) e repassa por item um
  `dismissAction` ao `WidgetAlert` (`:68-79`), que liga o toque do
  `PressableFeedback` da ação revelada (`ui/widget-alert.tsx:158-170`; o `onPress`
  está em `:161`). A prop é aditiva: AUSENTE = nenhum handler, ação revelada como
  sempre foi. Os dois
  painéis são os ÚNICOS call sites que passam `dismissSurface="home"`
  (`organizer-dashboard.tsx:51`, `player-dashboard.tsx:65`); as quatro overviews
  das casas não passam.
- **A dispensa executa pelo runner compartilhado, sem caminho paralelo:**
  `dismissPendingItem` (`lib/pendings/use-pending-action-runner.ts:127`)
  chama `pendings.dismiss` com `{ itemId, surface }` (o ator vem da sessão, no
  servidor) e, no SUCESSO, invalida `pendings.list` pelo `queryFilter()` do CRPC
  — o MESMO padrão de invalidação que o runner já usava. Não é otimista de
  propósito: quem tira o item da tela é a RELEITURA, então falha não faz alerta
  sumir — vira toast (`"Falha ao esconder"`, `getToastErrorMessage`) e o item
  fica onde está. O botão desabilita pela mutation em voo.
- **Nada de visual novo:** rótulo "Esconder", ícone, `size-4`/`size="sm"` e todo
  o desenho da ação revelada intactos (WIP do usuário no `widget-alert.tsx`:
  md5 de entrada `62808186b82f39a3810d5ffb05aee6ec` → saída
  `ad086def6f1efc18fd8650b68ec5f7da`), e o corte do swipe (só nos dois
  dashboards, via `isSwipeEnabled`) segue igual.
- **O item dispensado anima ao SAIR (IBX-0089 r5 · 22-09-2026):** com
  `dismissSurface` o item vai num `Animated.View` com
  `exiting={FadeOut.duration(180)}` e `layout={LinearTransition}`: o cartão
  desbota e os de baixo sobem pela animação de layout, sem animação de altura na
  linha. Sem a prop a casa não anima; quem tira o item é a RELEITURA e a falha
  não esconde o cartão.
- **O reflow hoje (IBX-0089 r5 · 22-09-2026):** cada home tem UM wrapper animado
  por grupo, com `layout={LinearTransition}` —
  `pages/home/organizer-dashboard.tsx:64-110` (bloco de número + chart) e
  `pages/home/player-dashboard.tsx:79-145`, mais a raiz do painel do jogador
  (`:59-146`); o item dispensado é o ÚNICO elemento com
  `exiting={FadeOut.duration(180)}` (`ui/pending-alerts.tsx:96-102`). Assim a
  altura que muda no bloco de cima (item saindo, lista chegando do servidor,
  item ressuscitando) move KPIs e charts na mesma cadência, sem salto. São
  `Animated.View` do próprio repo: nenhum componente animado novo e nenhum
  worklet.
- **Teste do wiring:** `ui/pending-alerts.test.tsx` (10 testes) prova que o gesto,
  com `dismissSurface`, manda `{ itemId, surface: "home" }` (`:295-302`), que SEM
  a prop o item não tem `dismissAction` (`:304-308`) e que `exiting`/`layout`
  existem só no caminho opt-in (`:312-323`). O arquivo NÃO cobre swipe/settle.
- **Gates:** `git diff --check` limpo; `bun run check` EXIT 0; `bun run test`
  **1306 pass / 0 fail** em 105 arquivos. Sem device, sem Metro e sem OTA
  (RUL-0025/0032) — a prova visual do gesto é do usuário. SEM COMMIT.

## Swipe do alerta na home (IBX-0086 r15 · 23-09-2026, sem commit)

O alerta das pendências pode ser ARRASTADO para revelar a ação **Esconder**, e nas
superfícies reais o gesto existe SÓ nas duas homes (a galeria dev-only tem UMA
amostra dele, para aprovação). O dispatcher da dispensa (tabela, mutation e a
regra do recibo) é de `docs/spec/pendings.md` — aqui fica o lado da tela.

- **Quem liga o gesto é a prop OPT-IN `isSwipeEnabled`**
  (`ui/widget-alert.tsx:86-91`). SEM ela o componente devolve o cartão puro e
  para ali (`:252-256`): nenhuma caixa de gesto, nenhum `Pressable` e
  `swipeClassNames` IGNORADO. `PendingAlerts` só repassa a prop
  (`ui/pending-alerts.tsx:24`, `:81`).
- **Contrato das classes** (`WidgetAlertSwipeClassNames`, `:61-68`): `container`
  → `containerClassName` (a caixa do gesto, é ela que clipa), `childrenContainer`
  → `childrenContainerClassName` (o nó do conteúdo, que carrega o deslize) e
  `action` → a `Animated.View` da ação. O par das duas homes é o mesmo
  (`pages/home/organizer-dashboard.tsx:56-60`,
  `pages/home/player-dashboard.tsx:70-74`): o container sangra 16px para fora do
  gutter `mx-4` da página e a ação recolhe o padding — sangramento espelhado do
  pai, sem estilo novo (RUL-0026). O `Swipeable` entra como
  `withUniwind(Swipeable)` porque ele sobrescreve `style` e só as props
  `{nome}ClassName` chegam (`:20`); `enableTrackpadTwoFingerGesture` está ligado
  (`:262`).
- **A ação revelada é o `Esconder`** (ícone `EyeOffIcon` + rótulo, `:170-176`;
  a largura base é `ACTION_WIDTH_PX` = 120 px em repouso, `:26`; a entrada usa
  `SWIPE_ACTION_ENTER_PX`, `:22-23`). O TOQUE dela só existe com `dismissAction`
  (`:45-49`, `:78-80`; o handler é o `onPress` do `PressableFeedback`,
  `:165-169`) — sem a prop a ação é só pintura. `PendingAlerts` monta o
  `dismissAction` por item quando recebe `dismissSurface`
  (`ui/pending-alerts.tsx:68-80`): chama `pendings.dismiss { itemId, surface }` e
  desabilita pela mutation em voo — é o MESMO caminho do IBX-0085, sem segundo.
- **Abrir/fechar:** o toque no CARD chama `openSwipe` → `openRight()`
  (`widget-alert.tsx:187-190`; o `PressableFeedback` está em `:273`) e só
  "garanta ABERTO": fechar é o tap interno do próprio `Swipeable`, o componente
  não tem caminho de fechar por código. Passado o ponto de abrir, a caixa da ação
  cresce 1:1 com o dedo (conta no helper puro worklet `getSwipeActionWidth`,
  `:28-36`, usada em `:158-160`); a entrada anima opacidade/translate/scale
  (`:137-156`).
- **Onde está ligado (2 superfícies):** home do organizador
  (`organizer-dashboard.tsx:54`) e home do jogador (`player-dashboard.tsx:68`),
  as duas com `dismissSurface="home"`. **Onde NÃO está:** as quatro overviews das
  `pages/tournaments/organizer-overview.tsx:53-58`,
  `pages/tournaments/player-overview.tsx:96-101` — nenhuma passa
  `isSwipeEnabled` nem `dismissSurface`), o cartão da central
  (`components/notifications/notification-card.tsx:44-60`, o mesmo `WidgetAlert`
  sem gesto) e a galeria dev-only, onde o gesto só existe na amostra nova
  "Alerta 18 · GESTO" (1 das 22 instâncias de `WidgetAlert` em
  `settings/components/[component].tsx`; as outras 21 seguem estáticas). Fora da
  amostra de aprovação, o gesto só nas duas homes é o pedido literal do r15.
- **A RUL-0043 no cartão da central:** corpo só com título e descrição e TODA
  ação no menu ⋮, na ordem principal → secundária → destrutiva, com `danger` só
  no que é recusa/destrutivo. O cartão cumpre: `buildNotificationMenuItems` monta
  nessa ordem (`lib/notifications/notification-view.ts:153-190`) e
  `readActionTone` (`:125-140`) só devolve `danger` nas recusas e no convite
  recusado (`accept: false`); o corpo é o `WidgetAlert` SEM ação
  (`notification-card.tsx:44-60`) e as ações são itens do menu (`:80-108`). A
  galeria aprova os itens REAIS do MESMO derivado (`[component].tsx:729-764`).
- **A RUL-0052 no mesmo cartão:** componente visual novo ou ALTERADO entra na
  galeria para ele aprovar, cobrindo os casos reais (inclusive extremos). A
  entrada existe (`lib/dev/component-registry.ts:34-38`, id `alerts`) e a
  superfície alterada TEM amostra aprovável: o "Alerta 18 · GESTO" leva
  `isSwipeEnabled` + `dismissAction` (handler de aprovação, não executa nada) + o
  par de classes das homes (`settings/components/[component].tsx:700-717`), para
  ele arrastar e aprovar ali. As 21 instâncias vizinhas e os 3 moldes do aviso
  seguem ESTÁTICOS de propósito.
- **Gates:** `git diff --check` limpo; `bun run check` EXIT 0. Sem device, sem
  Metro e sem OTA — a prova visual do gesto é do usuário. SEM COMMIT.
