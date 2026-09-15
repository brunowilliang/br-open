# Tournaments — Design aprovado

> **Status: BACKEND IMPLEMENTADO (slice 2, 22-08-2026) + FRONTEND
> IMPLEMENTADO (slice 3, 22-08-2026).** Design aprovado pelo usuário em
> 22-08-2026; domínio, CRPC, pagamento+refund e notificações entregues e
> deployados em dev+prod; telas do app entregues (ver "Frontend implementado
> (slice 3)"). Aguardando code review + QA do usuário.

## Frontend implementado (slice 3 — 22-08-2026)

### Infra compartilhada (RUL-0005)
- **`src/lib/forms/media-form-store.ts`** — factory `createMediaFormDomain` do
  padrão de rascunho de mídia (cover+avatar com crop, upload diferido,
  callbacks por sessão, activeSessionKey); `league-form-store.ts` agora é um
  wrapper fino do domínio da liga (API pública idêntica, testes preservados).
- **`src/lib/forms/media-form-controller.tsx`** — controller genérico
  `useMediaFormController` (useForm + resolver injetado + upload de mídia no
  submit + cropper + toasts); `league-form-controller.tsx` é wrapper que
  injeta LeagueSchema/validação-de-tab/uploadUrl da liga.
- **`src/components/ui/court-editor.tsx`** — editor de quadras globalizado
  (accordion por quadra, tabs de dia, ranges de 30min com validação de
  overlap/nome duplicado); as rotas `settings/leagues/[mode]/courts.tsx` e
  `settings/tournaments/[mode]/courts.tsx` são wrappers que só montam header
  + menu Salvar.

- **`src/components/match-rules/`** e **`src/components/ui/rules-grid.tsx`**
  (R10) — seções de regras de partida parametrizadas por `prefix` e o grid
  2xN read-only, ambos globalizados a partir da liga (detalhes em
  leagues.md, "Seções de partida do form como módulo global").

### Wizard `/settings/tournaments/[mode]` (cluster `[mode]`, 6 tabs + FloatingTabBar)
- **`src/lib/tournaments/tournament-form-navigation.ts`** — tabs
  Detalhes·Local·Categorias·Quadras·Regras·Ajustes (molde
  `league-form-navigation`; **Regras entre Quadras e Ajustes desde o R10**,
  `TOURNAMENT_FORM_TAB_ITEMS` :66-72).
- **`src/components/pages/tournaments/form-schema.ts`** — `TournamentSchema`
  (shapes do contrato Convex; datas ISO `YYYY-MM-DD` com conversão
  epoch↔calendar; `registrationDeadlineAt < startDate`); presets das 5
  categorias (SM/SF/DM/DF/MX) via `buildCategoryDisplayName`.
- **`[mode]/rules.tsx`** (Regras — R10; **R12: seletor de PRESETS de
  formato EXTINTO** — decisão do usuário: o organizador personaliza as
  regras campo a campo) — a aba é a **seção global de match-rules**
  (`MatchRulesSection` com `prefix="matchConfig"` — módulo
  `src/components/match-rules/`, ver leagues.md) DIRETO no
  `Page.ScrollView`; header com menu ⋮ → Salvar (`onSubmitPress`,
  desabilitado enquanto `isSubmitPending`). Arquivos
  `match-config-presets.{ts,test.ts}` REMOVIDOS no R12.
- **`form-defaults.ts` / `form-validation.ts`** — defaults (matchConfig da
  liga) e grupos de erro→tab (molde da liga; **R10**: grupo "Regras
  incompletas" → tab `rules`, `form-validation.ts:55-59`). `form-schema.ts`
  ganhou o refine `TournamentMatchConfigFormSchema` —
  `CreateTournamentSchema.shape.matchConfig.superRefine` com
  `getBestOfSetValidationError` (bestOf ∈ {1,3,5}, :12-27), espelhando o
  backend (ver "Backend implementado").
- **`tournament-form-store.ts` / `tournament-form-controller.tsx`** — domínio
  + controller do torneio sobre a infra genérica.
- **`[mode]/_layout.tsx`** — resolve create/edit (`?mode=new|edit`), viewer
  gate `canManageLeagues`, mutations create/update/remove com toasts e
  invalidação de `listMine`/`getById`; create → detalhe do rascunho.
- **`[mode]/index.tsx`** (Detalhes) — capa/avatar (padrão de mídia), nome,
  descrição, DatePicker de início + prazo (mínimo hoje; prazo com
  `maxValue` = véspera do início — QA round 7: dia do início e posteriores
  barrados no calendário).
- **`[mode]/categories.tsx`** — uma categoria por card das 5; card NO MOLDE
  `RuleCard`/`RuleExpandableContent` (`pages/leagues/rule-card`, QA R13:
  accordion igual às seções de Regras). **Gatilho do accordion: TOCAR NO
  CARD** — header inteiro pressable (mecânica `RuleToggleRow`,
  `rule-card.tsx:154-180`; o Switch é só INDICADOR DE ESTADO com
  `pointerEvents="none"`), não apenas o Switch: habilitar expande animado
  os campos (fade + `AccordionLayoutTransition`), desabilitar recolhe para
  só nome + Switch. Erro do array ("Selecione pelo menos uma categoria.")
  fica FORA dos cards, ABAIXO DE TODOS (**R13-T2b**: voltou à posição
  original; a leitura "dentro do primeiro card" do T2 não vingou), envolto
  em `Animated.View` com entering=`FadeIn` 180ms / exiting=`FadeOut` 120ms /
  layout=`AccordionLayoutTransition` — as mesmas transições do
  `RuleExpandableContent` (`rule-card.tsx:28-29`, `92-103`): aparece/some
  animado com reflow suave; revalidação on-the-fly ao habilitar uma
  categoria preservada. Campos: NumberField BRL de taxa (0 =
  grátis; `isRequired` como o
  Valor da cobrança da liga; Input `variant="secondary"` — QA round 8: o
  default `--color-field` ≡ `--color-surface` nos dois temas e o input sumia
  no card `bg-surface`; secondary renderiza `--color-default`, que contrasta
  em light e dark) + Switch Limitar vagas + NumberStepper (dica de potências
  de 2); estado = array `categories` do form.
- **`[mode]/settings.tsx`** — visibilidade (pública/privada), aprovação
  (auto/manual), delete NO MOLDE DA LIGA (QA rounds 7-8, molde
  `settings/leagues/[mode]/settings.tsx:515-583`): `Animated.View gap-2` +
  `AccordionLayoutTransition` envolvendo `RuleCard`
  `border border-danger-soft bg-danger-soft` + título "Deletar torneio"
  `text-danger` + botão `danger-soft self-start`; dialog Cancelar
  (secondary) + Deletar torneio (`danger-soft`, com guarda `isDisabled`
  no onOpenChange, Close condicional e confirm `.catch(() => undefined)`
  como na liga); botão visível SÓ em draft (`showDelete: status ===
  "draft"` no `_layout`; published+ o backend rejeita).

### Detalhe `/tournaments/[tournamentId]` (cluster + store Legend-State)
- **`src/lib/tournaments/tournament-details-derived.ts`** — papéis
  `guest|player|organizer` (`isTournamentOrganizer` > `viewerEntryIds`),
  access `canManage/canOpen{Bracket,Entries,Schedule}` (bracket/agenda só a
  partir de `ongoing` para não-organizador), tabs, placeholder da chave,
  chips de status de entry/match, `formatEntrySideLabel` (dupla junta nomes),
  `formatRoundLabel` (Final/Semifinal/Quartas/Rodada N), taxa formatada.
- **`tournament-details-store.ts`** — bucket por `tournamentId`
  (discovery+entries+matches, deriveds access/entriesById/categoriesById/
  shouldFetchMatches/tabItems).
- **Tipagem das entries** — direto pelo `TournamentEntryWithPlayers` do
  contrato (`tournamentEntryWithPlayersSchema`, com
  `playerA/playerB: TournamentPlayerCard` de 5 campos — alinhado ao
  `serializePlayerCard` em 22-08).
- **`_layout.tsx`** — bootstrap (discovery sempre; matches gated por
  `shouldFetchMatches`; entries sempre), Tabs+FloatingTabBar com ícones e
  `resolveValueFromRouteName` (index→overview; QA round 6).
- **Overview do organizador** (QA round 9) — `OrganizerOverview`
  (`components/pages/tournaments/`) no molde da liga: `WidgetAlert` accent
  (N aguardando aprovação) + `WidgetAlert` warning (N aguardando pagamento)
  + grid 2x2 de `KpiCard` (Inscrições ativas, Pendências, Categorias,
  Partidas concluídas/total — "—" antes do sorteio; **linhas vacant do
  IBX-0035 NÃO contam no total**); builders PUROS em
  `src/lib/tournaments/organizer-overview-derived.ts` (+ teste co-localizado).
- **`index.tsx`** (overview) — ESTRUTURA ESPELHADA da página principal da
  liga (QA round 6, RUL-0007, molde `leagues/[leagueId]/index.tsx`):
  `TournamentBanner` (molde `LeagueBanner` file:line — stretch h-90 com
  gradiente, avatar `size-28 rounded-3xl border-2`, chip "Torneio", título,
  chip de local `formatLeagueMeta`), header `overlay` com back secondary e
  menu ⋮ (`MoreVerticalIcon`, moldes da liga) — Editar primeiro, **Agenda**
  (gated `canOpenSchedule`, → `/schedule` pushed, QA round 9: mesma
  mecânica do menu da liga), **Regras** (R10 — item `Regras` com
  `ClipboardIcon`, `index.tsx:275-282`, → `/rules` pushed, mesma mecânica)
  + ações de ciclo (Publicar/Cancelar com dialog de estorno; **Sortear e
  Iniciar MIGRARAM pro menu ⋮ do header do chaveamento — IBX-0037**),
  estados de loading/erro CENTRADOS (`cn grow + centered gap-4 px-4`),
  switch de papéis com componentes `OrganizerOverview`/`PlayerOverview`/
  `GuestOverview` em `components/pages/tournaments/` (molde das irmãs da
  liga; mutações ficam na tela, callbacks descem como props), chips de
  categoria com taxa + datas + contagem como bloco comum antes do switch;
  `TournamentJoinFooter` para guest em `published`; "Suas inscrições" com
  chip via `getEntryStatusChip`, aceite/recusa de convite para o parceiro
  (`respondPartnerInvite`) e botão "Pagar inscrição" para o criador em
  `awaiting_payment` (`createCharge` → checkout — fecha o fluxo de duplas
  pagas após o aceite).
- **Tabs de navegação** (QA round 9; **Agenda virou TAB — IBX-0033 B**) —
  `buildTournamentNavigationTabItems`: Overview (Home01Icon, rota `index`),
  Chave (slot do Ranking), **Agenda (Calendar03Icon, rota `schedule`, gated
  `canOpenSchedule`: organizador sempre; player/guest a partir de
  `ongoing`)** e Inscrições (slot Desafios), gated por access; a entrada do
  menu ⋮ da overview (organizador) CONTINUA e leva na mesma rota;
  FloatingTabBar resolve index→overview e schedule→schedule; `schedule.tsx`
  perdeu o BackButton (tela de tab, Left vazio como bracket/entries).
- **`bracket.tsx`** (Chaveamento — R10; canvas próprio `BracketCanvas`
  desde PLN-0002, antes componente **Flow**, IBX-0014) — título
  **Chaveamento**; **menu ⋮ de ações de chaveamento no header**
  (`Page.Header.Right`, IBX-0037; molde do kebab do card — `Menu.Trigger
  asChild` > `Button` icon-only terciário + `Menu.Portal` > overlay
  `bg-backdrop` + `Menu.Content popover width={240}`, precedente IBX-0020 do
  overlay fora do transform): **Cabeças de chave** (CrownIcon, IBX-0035 —
  `published`/`drawn`, → `/entries?initialTab=confirmed`), Sortear chave
  (`published`), **Re-sortear** (`drawn`, IBX-0037/re-draw do backend; com
  confronto agendado abre **diálogo de confirmação** de destruição, molde do
  cancelamento do torneio — apaga data, horário e quadra) e
  Iniciar torneio (`drawn`), mutações `bracket.draw`/`bracket.start` com
  toasts e `invalidateTournamentContext`; menu some quando não há ação
  aplicável; organizador-only (guest não vê nada disso).
  **tabs de CATEGORIA no
  header** (`Tabs` heroui-native no molde entries.tsx) APENAS com 2+
  categorias COM chave (o draw pula
  categorias com <2 inscritas — bracket.ts:94 — então categorias sem árvore
  não ganham tab); categoria única renderiza sem barra. **Uma árvore por vez
  no canvas** (faixa de rodadas e rótulo de categoria dentro da chave
  EXTINTOS).
  **Adoção do Flow (IBX-0014, substitui o canvas próprio do IBX-0013)** — bloco
  HISTÓRICO, superseded pelo REBUILD PLN-0002 (ver "REBUILD PLN-0002"):
  componente `Flow` da panelui.dev (doc `panelui.dev/docs/components/flow`;
  `npx panelui-cli@latest add flow`, copy-the-source own-and-edit), extraído
  da fonte oficial, reconciliado com a cópia do usuário (nenhum ajuste
  estrutural dele além de formatação — a copia antiga tinha imports quebrados)
  e que morou em `src/components/flow/`: `index.tsx` + `flow-paths.ts` +
  `flow-identifiers.ts` + `flow-accessibility.ts` — diretório EXTINTO no
  REBUILD PLN-0002 (cadáver em `.backup-pln0002-corpse/flow/`, untracked;
  o canvas vivo é `src/components/pages/tournaments/bracket-canvas.tsx`).
  Suporte mapeado pro repo:
  ícones dos controles via HugeIcons (`plus-sign`, `minus-sign`,
  `maximize-02`, `lock`), botões com `PressableFeedback` (RUL-0003) no lugar
  do AnimatedPressable da panelui, `Text` do core, `cn` = `twMerge`
  (tailwind-merge nativamente ignora falsy) e helper local `textChildren`.
  O canvas hand-rolled RNGH+Reanimated do IBX-0013 e o desenho manual de
  paths SVG foram EXTINTOS (grep 0). Props usadas na chave:
  `fitViewPadding` (`BRACKET_FIT_VIEW_PADDING = 24`, compartilhado com a
  fórmula do fit) — a chave flutua CENTRADA com respiro, nunca colada nas
  bordas (cura das colunas coladas do QA R16). **Canvas FULL-BLEED (QA
  R18)**: o inset fantasma era o wrapper da própria rota
  (`bracket.tsx:310` antigo, classe `pb-floating-tab-bar-4` herdada do
  canvas hand-rolled — rota fora do grupo `(tabs)`, não há tab bar);
  removido — o wrapper mede o viewport (`onLayout`) sem nenhum inset e o
  `PageRoot` não injeta padding (`NewPage/context.tsx:165`). **minZoom
  DINÂMICO = zoom exato do fit (QA R18)**: `bracketFitZoom`
  (bracket-tree.ts) replica a fórmula do `fitView` do Flow — o Flow NÃO
  expõe o zoom que calculou — e a tela passa o resultado como `minZoom`,
  então o zoom-out PARA exatamente no enquadramento do fit (recalculado em
  medição de viewport, troca de categoria e ajuste de alturas; fallback
  0.2 antes da primeira medição); testado em bracket-tree.test.ts;
  **`maxZoom={1}` — lei do R15, inegociável: nunca upscale, texto nítido
  por construção** (o fitView e a pinça do Flow clampeiam no maxZoom);
  **SEM `Flow.Background`** (QA R17: fundo liso do tema — a capability
  continua no Flow, o bracket não usa); **SEM `Flow.Controls`** (QA R18:
  navegação só pan/pinça). Cada partida é um `Flow.Node` (id = id do match,
  posição vinda do bracket-tree, card com width/height explícitos pra
  medição casar com a geometria) e cada conector um `Flow.Edge from/to`
  PELOS IDS dos matches — o campo `path` SVG foi extinto de
  `BracketTreeLink` (virou `{from, to}` child→parent),
  `variant="smoothstep"` `width={1.5}` `gap={6}` com
  `fromSide="right"`/`toSide="left"` fixados (as colunas sempre fluem pra
  direita), cor padrão do Flow (`muted-foreground`) — elbow fino do print
  original do R15 (R17 provou bezier, revertido no R18). **LINHAS ENCOSTADAS
  (QA R19 — causa raiz)**: o Flow registrava TODO `Flow.Node` também como
  grupo (`flow/index.tsx:1170` antigo), e o edge layer aplica
  `GROUP_EDGE_STANDOFF = 5` a endpoints que são grupos
  (`flow/index.tsx:1843-1844`) — toda edge node→node nascia 5pt DENTRO do
  vão de cada lado; somado ao `gap=20` padrão do smoothstep num vão de
  32pt, os gap-points se CRUZAVAM (fromGap 281 > toGap 263 no caso real
  quartas→semi: `M261,50 L281,50 … L263,106 L283,106`) e o traço dobrava
  sobre si mesmo, solto no meio do gutter. Fix own-and-edit: registro de
  grupo MOVIDO do Flow.Node para o Flow.Group (nodes não são contêineres;
  documentado no cabeçalho do componente) + `gap={6}` (< metade do vão) —
  path provado `M256,50 … L288,106`: sai da borda direita da origem e chega
  na borda esquerda do destino, em qualquer zoom/pan.
  **CLAMP DE PAN (QA R19, faixa de visibilidade QA R20)**: o pane andava
  infinito (chave sumia da tela). O Flow não expõe limites — edição
  own-and-edit no gesto do próprio componente (`clampTranslateToViewport`
  em flow/index.tsx, aplicado a pan E pinça). **Regra final (R20)**: no
  limite do arrasto, uma banda de 24pt (screen) do CONTEUDO permanece
  visível dentro do viewport — a borda do grafo nunca passa de 24pt dentro
  da borda da tela (`t ∈ [24 − z·right, width − 24 − z·left]`, idem y,
  contra o modelo `screen = t + z·c`), trava seco, sem rubber-band. Chave
  menor que a tela segue centralizada (o intervalo contém o fit — sem
  pulo). Lê shared values vivos (zoom/rects/size): vale automaticamente
  após zoom, troca de categoria e medições.
  **JANELA DE EDGES (QA R21 — linhas sumiam em chaves grandes)**: causa
  raiz numérica — o edge layer upstream era UM `<Svg>` dimensionado por
  `clampCanvas` (cap 4000pt; past texture size a plataforma desenha NADA) e
  desenhava em `y + origin.y` com `origin = layer/2`: na chave 64
  (~4724pt de altura, reach 4800 → layer 4000 → origin.y 2000), o plano de
  corte caía em **graph y = 2000** — edges abaixo disso nunca renderizavam
  (nodes são Views, não sofrem: só as linhas sumiam, como no vídeo).
  Correção estrutural own-and-edit (**janela**, documentada no cabeçalho do
  componente): o edge layer saiu da camada transformada e virou overlay EM
  ESPAÇO DE TELA — superfície sempre do tamanho do container (nenhum limite
  de textura, qualquer escala) — com `viewBox` igual ao retângulo visível
  do grafo, sincronizado dos shared values via `useAnimatedReaction`; edges
  desenham em coordenadas puras do grafo. Escala sem cap (128+ keys idem);
  custo: edges re-renderizam por frame de pan/pinça — o mesmo trade dos
  drags que o componente já documenta. Edges ficam SOB os cards (paint
  order no root). Sem regressão na chave 8. **Canvas de nodes SEM cap
  (follow-up R21)**: o layer dos cards é View pura (sem textura) e pulou
  fora do `clampCanvas` — pai menor que os filhos quebrava o hit-test
  Android fora dos bounds (toque morto na metade de baixo da chave 64); o
  grid opcional segue no layer clampado (Svg).
  **EDGES ESTÁTICAS (IBX-0029 — opção 1b do Orion, GO do usuário)**: o
  usuário re-reportou o flicker com sintoma afiado — a chave "se sobrepõe,
  tudo junto, SOMENTE na pinça; pan limpo". Diagnóstico: dessincronia de
  camadas — os cards se movem pelo transform nativo (worklet, instantâneo)
  enquanto a janela de edges atualizava o `viewBox` via
  `runOnJS`→`setState`→render React por frame (o custo documentado do QA
  R21), lento o bastante pra se separar dos nodes na mudança de ESCALA da
  pinça. Fix estrutural: **`Flow.StaticEdge`** — edges como VIEWS COMUNS em
  coordenadas de GRAFO, renderizadas DENTRO do canvas de nodes (antes dos
  cards, `pointerEvents="none"`), recebendo O MESMO transform do worklet:
  uma única árvore transformada, composta atomicamente — pan e pinça não
  tocam JS por frame (zero setState, zero render, zero round-trip; o mesmo
  mecanismo dos cards que nunca tremeram). A geometria é a MESMA rota do
  smoothstep (`smoothStepRoute` extraída de `flow-paths.ts`, fonte única
  com o path SVG — os dois renderizadores não derivam um do outro),
  decomposta em barras + quadrados de canto (quarto de anel: canto interno
  vazado `size − w/2`, canto do vértice `size·1.07 + w/2`, que cobre a
  quadrática do bend — excursão máx ~1.061·size; runs invadem os quadrados
  por w/2 pra não costurar AA). A StaticEdge recebe os RETÂNGULOS por prop
  (sem registro, sem round-trip de medição — determinística no render); o
  bracket passa os boxes do bracket-tree. `Flow.Edge`/FlowEdgeLayer
  PERMANECEM intactos pros usos genéricos; o layer ganhou um guard no
  reaction: canvas sem edges registradas E sem handles não re-janela
  (nada a desenhar — pinça do bracket 100% UI thread). Auditoria de
  round-trips por frame no caminho de gesto do bracket: o viewBox era o
  ÚNICO (`reportViewport` roda 1x no FIM do gesto e é no-op na tela;
  updates de pan/pinça e o `contentStyle` são worklet puros). Migração
  RUL-0015 junto: `runOnJS` → `scheduleOnRN` (react-native-worklets) em
  todo o flow/index.tsx, semântica preservada.
  **ACABAMENTO VISUAL (IBX-0022 — camada Skia, substitui a decomposição em
  views)**: a decomposição barras+quartos-de-anel virou cunha sólida no iOS
  em zooms médios (raios opostos do anel somam `size−w/2 + size·1.07+w/2 >
  size` → o clamp de raios adjacentes do CoreAnimation escala tudo), e o
  usuário aprovou o visual "pills" mas pediu cantos ARREDONDADOS. Solução:
  **`Flow.SkiaEdge`** (`@shopify/react-native-skia`) — uma superfície única
  de edges por Flow (`FlowSkiaEdgeLayer`: Canvas screen-sized, `overflow
  hidden`, `pointerEvents none`, irmã do FlowEdgeLayer DENTRO do mesmo
  contexto transformado), um `SkPath` por edge reconstruído em worklet
  (`useDerivedValue`) lendo `rects`/`zoom` compartilhados; geometria =
  mesma `smoothStepRoute` (fonte única) com `bendSkia` (PathBuilder,
  quadraticTo — `SkPath.quadTo` deprecated) e cantos de raio CONSTANTE NA
  TELA (radius 8, stroke 1.5) em qualquer zoom; pan vai no transform
  nativo do Canvas (translate-only), zero JS/React por frame de gesto
  (mesma cura da pinça da StaticEdge). Alinhamento: os pontos do path são
  `zoom·ponto` puros — o Canvas compartilha o translate do pan; a cadeia
  de render dos cards (layer em −origin + filho em +origin + pivot
  transformOrigin) cancela a origem, então NÃO há termo de origem no path.
  Registro por `useEffect` (`FlowSkiaEdge` resolve âncoras na montagem,
  defaults gap 20/radius 8/width 2, tint `--color-muted-foreground` com
  fallback). Testes de byte-parity dos goldens de `edgePath` preservados
  (a rota é a mesma). `FlowEdgeLayer` genérico intacto (dots/arrows/labels
  de uso ad-hoc). Lição de dev: rebundles do Metro sobre estados
  intermediários do arquivo deixam o worklet do Canvas sem capturas
  (ReferenceError) e o canvas SEM pan → edges "desalinhadas"; cache clear +
  restart frio resolve — não é bug de geometria.
  **REBUILD PLN-0002 (09/09 — o Flow MORREU com o SkiaEdge; machado total,
  arquitetura trancada por 3 pesquisas: post-mortem Orion + survey Vega +
  matriz Lyra)**: causa raiz da morte do SkiaEdge PROVADA (Orion) — o
  `useAnimatedStyle` do pan era aplicado ao `<Canvas>` do RN Skia, que NÃO
  é componente Animated (Reanimated 4 só entrega updates a views
  registradas por `AnimatedComponent`); o transform do Canvas CONGELOU no
  mount (translate 0,0 antes do fit) → camada de linhas permanentemente
  offset dos cards, no sim E no device (a prova anterior validava
  GEOMETRIA do cotovelo, nunca ANEXAÇÃO linha-card). A nova arquitetura
  (`src/components/pages/tournaments/bracket-canvas.tsx`):
  **UMA `Animated.View` dona do transform** (`translateX/translateY/scale`,
  `transformOrigin [0,0,0]`, conteúdo no tamanho nativo do grafo) com **UM
  `useAnimatedStyle`**; TUDO que anda junto mora DENTRO dela — cards
  (`BracketMatchCard` intacto) E conectores. Zero Skia, zero SVG, zero
  worklet de path: linhas = **Views comuns** (barras + cotovelo com
  `borderRadius` no canto externo) em coordenadas de grafo, geometria pura
  em `src/lib/tournaments/bracket-edges.ts` (rota smoothstep portada do
  flow-paths: âncora centro da face, gap 6, dog-leg no meio do corredor;
  decomposer cola waypoints colineares, clamp de raio por `bendSize`).
  **ESTÁGIO B — LINHAS RETAS (veredito do usuário: 'deixa elas retas,
  simples assim'; visual challonge/start.gg)**: o smoothstep, o arco, o
  cotovelo arredondado e o dog-leg morreram. Conector ortogonal CLÁSSICO:
  sai do centro da face direita do card filho, horizontal RETO até o meio
  do corredor, vertical RETO no corredor (irmãos de um mesmo pai caem na
  MESMA x → fork/join clássico), horizontal RETO até o centro da face
  esquerda do card pai. Cantos VIVOS (zero raio): as barras estendem meia
  espessura além de cada waypoint, cruzando no vértice — canto soldado sem
  fenda nem arredondamento. Centros alinhados colapsam num único
  horizontal. Anexação por construção inalterada (barras terminais
  invadem meia espessura o card, desenhado por cima). bracket-edges.ts
  ficou MAIS SIMPLES (só barras; decomposer de arco, excursão de
  quadrática e testes de silhueta extintos).
  **PINÇA com foco nos dedos (estágio B)**: o miolo do focal-follow do
  zoom-toolkit virou função PURA e testada em bracket-tree
  (`pinchFollowTransform`: t1 = f1 − (f0 − t0)·k1/k0 — o PONTO SOB OS DEDOS
  NO INÍCIO do gesto fica sob os dedos sempre; focal ATUAL carrega o pan
  de 2 dedos: pinça e pan-de-2-dedos são UM gesto). Seeds lidos dos dedos
  REAIS na ativação (sem salto no 2º dedo). ANTI DOUBLE-APPLY: enquanto o
  pinch está ativo ele é o dono único do translate (shared value
  `pinchActive`); o pan simultâneo não soma tradução própria — a causa do
  sintoma 'amplia tudo igualmente'. Invariantes pinadas por testes
  unitários (zoom puro mantém o focal fixo; focal móvel com zoom igual
  translada pelo delta exato; composição nos dois eixos, cantos do clamp
  inclusos).

  **ESTÁGIO C — escritor único + tap endurecido + espessura graph-space
  (veredito: 'mesma merda' + 'ao tirar o zoom a linha aumenta a
  espessura')**: a pinça rápida com 2 dedos caindo quase juntos era lida
  pelo TAP como double-tap → a animação do double-tap (withTiming)
  brigava com a pinça viva por zoom/translate a cada frame (stutter 'ta
  ta ta', conteúdo voando pro máximo). Fixes: (1) TAP ENDURECIDO —
  `maxDeltaX/Y(10)` + `maxDuration(250)`. PREMISSA CORRIGIDA (review): o
  maxDelta do RNGH mede o DESLOCAMENTO DE CADA PRÓPRIO toque durante o
  tap (tolerância a tremor), NÃO a distância entre os dois toques — ele
  endurece o tap contra toques arrastados, mas NÃO discrimina dedos de
  pinça; quem mata o falso double-tap são o flag abaixo e o cancelamento
  (2). RNGH 2.32 NÃO tem `maxPointers` no Tap (só `minPointers`). (2)
  FLAG DE COEXISTÊNCIA SEM RELÓGIO (`multiTouchedSinceTap`): armada no
  instante que um 2º+ ponteiro toca (pinch.onTouchesDown ≥2 — ANTES de
  qualquer up, determinístico em qualquer timing de aterrisagem), limpa
  no próximo down limpo de 1 ponteiro; enquanto armada OU com pinça viva
  (`pinchActive`), ativação de double-tap bloqueada. É a forma clock-free
  da janela de recência: RNGH NÃO expõe timestamp de evento aos worklets
  (conferido nos .d.ts) e `Date.now()` em worklet não é confiável. (3)
  ESCRITOR ÚNICO: pinch.onStart faz `cancelAnimation(zoom/translate)` —
  a animação do double-tap MORRE no nascimento da pinça e os seeds leem
  o valor corrente; mesmo que um misfire escape dos guardas, a briga nem
  começa. (4) ESPESSURA: a compensação de fim de gesto foi EXTINTA por
  inteiro (state `committedZoom`, `commitZoom` e divisão por zoom
  apagados) — stroke 1.5pt GRAPH-SPACE constante, escala com o conteúdo
  como qualquer card (mata o snap 'a linha aumenta a espessura ao tirar
  o zoom'); zero setStates por gesto. Prova com probe de flag
  `animateTo`: double-tap limpo dispara exatamente 1 animação; pinça
  rápida (e composto tap+pinça) disparam ZERO — pinça sintética
  simultânea não reproduz o misfire original (aterrissagens escalonadas
  são impossíveis de sintetizar nas ferramentas; documentado).
  Anexação POR CONSTRUÇÃO: barras terminais invadem meia espessura DENTRO
  do card (cards desenham por cima) → ponta visível encosta na borda em
  qualquer zoom (prova numérica de pixels: 4 estados de zoom verificados
  no bundle release — fit 0.215, 0.336, 0.696, 1.0 — endpoints adjacentes
  às bordas; misses apenas cards cortados pelo viewport). Engine de gesto:
  `Gesture.Simultaneous(pan maxPointers(1) minDistance 12, pinch
  manualActivation 2 dedos, doubleTap fit<->nativo)`; 3 shared values +
  seeds por gesto; clamp `clampPanToViewport` (faixa 24pt, QA R20, agora
  pura/testada em bracket-tree); zoom clampado [fitZoom, 1] (R15/R18);
  **double-tap NÃO pode ficar em `Exclusive` sobre o pan** (RNGH veta o pan
  no BEGAN do tap — todo toque nasce tap; provado com probes) e **worklet
  não captura imports cross-module** (`ReferenceError: withTiming doesn't
  exist` visto ao vivo — classe do bug do canvas congelado; a animação do
  double-tap roda no RN thread via `scheduleOnRN`, padrão reportViewport);
  pan/pinch aplicam a translação final também no `onEnd` (streams
  sintéticos de automação entregam translation 0; dedo real faz streaming
  — comportamento idêntico nos dois). Fit inicial em `useLayoutEffect` (monta já enquadrado, sem flash) +
  refit em resize do grafo; remontagem por categoria via `key={tree.id}`
  no `BracketCanvas` (fit fresco por árvore). Pendências honestas:
  streaming contínuo de pan/pinça e o visual do cotovelo (interior
  "soldado" aceito no estágio A) aguardam dedo real — preview OTA no
  device do usuário (estágio A do PLN-0002) antes do polimento (estágio
  B). Cadáver do Flow em `.backup-pln0002-corpse/` (untracked).
  Troca de tab de categoria: `key={tree.id}` REMONTA o canvas → fit roda
  de novo por categoria (não herda viewport da anterior).
  Interação: toque curto nos cards abre dialogs/swap; posição é estrutural
  (sem drag; a ação explícita de rearranjo é o swap A/B); arrasto de 1 dedo
  = pan (ativa após 12pt, `maxPointers(1)`); pinça de 2 dedos com
  `manualActivation` ancorada no foco; double-tap alterna fit↔nativo. Taps
  dos cards preservados: o tap falha no movimento do pan e o pan precisa de
  12pt — exclusão por limiar, sem veto de composição.
  Alturas variáveis medidas por `onLayout` do card (fallback
  `BRACKET_CARD_ESTIMATED_HEIGHT`, recalibrada p/ 136 com o card compacto);
  altura medida IGUAL à estimativa não commita state (montagem da 64-key
  sem cascatas de setState, lição IBX-0022).
  Geometria em `src/lib/tournaments/bracket-tree.ts`:
  `buildBracketCategoryTrees` (agrupa por categoria — conectores NÃO cruzam
  categorias, :53-90) + `layoutBracketCategoryTree` (posições absolutas, pai
  no midpoint dos filhos, clamp anti-overlap, :98-193). Card de confronto:
  `BracketMatchCard` + `BracketSideRow` em
  `components/pages/tournaments/bracket-match-card.tsx` — **COMPACTADO
  ~25% (IBX-0013, visão de mapa)** mantendo os moldes do repo (`Card`;
  side rows em `Pressable` puro, sem feedback de escala — o único toque
  com feedback é o `PressableFeedback.Highlight` interno do trigger do
  menu, IBX-0020): paddings justos (`p-2`/`py-1`), avatares size-6,
  ações px-2/py-1; **raio do card EXPLÍCITO `rounded-2xl` (16) — QA R20,
  bracket-match-card.tsx:136, override local do default do Surface
  (`var(--radius-3xl)` = 24)**; primeira linha = **fase da partida escrita
  no card**
  (`formatBracketStage(round, totalRounds)` por draw size: Final, Semifinal,
  Quartas de final, Oitavas de final, fallback "Rodada N" — derivada testada
  em tournament-details-derived.test.ts), chip de status, avatares (dupla
  empilha 2), placar por set, campeão na final; **linha de agendamento
  (IBX-0033 A)**: quando `matchDate`+`startMinute`+`courtId` existem, linha
  xs muted `data · HH:MM · quadra` (ex. "12 de set. · 14:00 · Quadra 2") sob
  o header do card, via `formatMatchScheduleSummary`
  (tournament-details-derived, UTC-safe — `formatMatchMonthDay` em
  lib/format/date.ts) computada no `renderCard` da rota (lookup do nome da
  quadra em `tournament.courts`); organizador (IBX-0020):
  Menu ⋮ kebab NO HEADER do card (molde challenge-card.tsx:65-100 —
  `Menu.Trigger asChild` > `Button` icon-only `size-7` terciário +
  `Menu.Portal` > `Menu.Overlay bg-backdrop` > `Menu.Content presentation=
  "popover" width={240}`) com os itens Agendar/Reagendar (label dinâmico
  por `match.matchDate`, Calendar03Icon) e Resultado (Edit02Icon), nos
  confrontos definidos e não encerrados (gating `canAct && status !==
  "finished"`); e swap de POSIÇÃO (toque no jogador de um confronto →
  toque no jogador a trocar → `swapSlots(round/sideA/sideB)` — troca
  EXATAMENTE as duas inscrições clicadas, jogador por jogador, sem mover
  os confrontos) enquanto sem placar — **generalizado pra MESMA rodada em
  qualquer rodada (IBX-0035: entradas diretas ocupam lados na rodada 2+
  já no sorteio; o guard de seleção reinicia em pick cross-categoria OU
  cross-rodada; `canSwapMatch` = sem placar, não-finalizada e
  não-vacant)**; **linhas VACANT (IBX-0035)**: subárvores podadas de
  cabeças de chave chegam com `status "vacant"` — card mantém a fase e os
  lados "A definir", SEM chip de status, SEM kebab (`canAct` exige dois
  lados) e SEM troca; não entram em agenda (nunca têm `matchDate`) nem em
  placar. Jogador em `published/drawn` vê
  placeholder "Chave disponível a partir de {data}".
- **`entries.tsx`** (Inscrições) — tabs segmentadas Pendências|Confirmados
  no molde challenges.tsx (QA round 7; pendências = `pending_approval` /
  `pending_partner` / `awaiting_payment`, confirmados = `active`; empty
  state por tab por papel no tom da liga; dica de seeds no fim da lista
  EXTINTA — IBX-0036);
  CARDS NO MOLDE DE SOLICITAÇÕES da liga (QA round 9, molde inline
  `requests.tsx:178-232`, sem componente extraído): `Card p-3` com row
  avatar (dupla empilha 2 no estilo ScheduleCard) + nome
  (`formatEntrySideLabel`) + sub (categoria; nota de convite quando
  `pending_partner`) + trailing por estado — aprovação do organizador e
  convite do parceiro = par icon-only `outline Cancel01Icon` / `default
  Tick02Icon` idêntico ao da liga; seed = botão "Seed #N"/"Marcar seed"
  (aba Confirmados) **+ PICKER DE FASE DE ENTRADA (IBX-0035, mesmo
  trailing)**: Menu no molde do seletor de janela da agenda
  (schedule.tsx) com **`buildEntryRoundOptions`** — UMA opção por rodada
  da chave ATUAL, na mesma conta do sorteio (`nextBracketSize` das
  inscrições ativas da categoria), rotulada por `formatBracketStage`:
  "Oitavas de final" cai na rodada certa em qualquer tamanho de chave
  (16 inscritos → rodada 1; 32 → rodada 2; 64 → rodada 3; 128 → rodada 4
  — a lista fixa anterior só valia para chave de 32), `null` = 1ª rodada
  — via `setEntryRound`, com o rótulo da fase escolhida pela mesma
  derivação (`formatEntryRoundLabel`), habilitado em
  `published` E `drawn` (em drawn, `Menu.Label` "Vale no próximo
  sorteio"; mudança inerte até re-sortear); erros do backend (fase sem
  seed, fase inexistente, mesma vaga, completabilidade) chegam prontos no
  toast do sorteio/re-sorteio; demais = chip de status. A rota aceita
  `?initialTab=confirmed` (atalho "Cabeças de chave" do menu do
  chaveamento). Lista `Page.ScrollView` +
  map + `Footer pb-floating-tab-bar-4` (molde requests.tsx:160-237).
- **`schedule.tsx`** (Agenda — **TAB da FloatingTabBar desde IBX-0033 B**,
  sem BackButton) — ESTRUTURA DA AGENDA DA LIGA (QA round 7,
  molde `leagues/[leagueId]/schedule.tsx`): header com janela 7/15 dias
  (Menu ⋮ terciário) + tabs de data ("Hoje" + próximos dias), corpo por
  período (manhã/tarde/noite via `SCHEDULE_PERIOD_META`), partidas como
  `ScheduleCard` REUTILIZADO (nomes via `formatEntrySideLabel`, avatar do
  playerA; dupla junta no label), quadra via `tournament.courts`;
  agrupamento pelo `buildScheduleDayView` GENERICIZADO na lib da liga
  (RUL-0005 — uma implementação para liga e torneio); empty state
  "Nenhum jogo neste dia".
- **`rules.tsx`** (Regras — R10) — tela READ-ONLY no molde `/rules` da liga:
  card **"Partidas"** ("O formato que vale para todos os confrontos do
  torneio.") com `RulesGrid`/`RulesItemCard` GLOBALIZADOS em
  `src/components/ui/rules-grid.tsx` (6 itens: Formato, Set, Pontuação,
  Duração, Tie-break, Decisão — `rules.tsx:73-80`); view derivada por
  `buildTournamentRulesView` em
  `src/lib/tournaments/tournament-rules-derived.ts` (formatters reutilizados
  de `lib/leagues/rule-format.ts`). Espelho da decisão R10: regra ÚNICA por
  torneio, sem seção por categoria.

### Dialogs e components (`src/components/pages/tournaments/`)
- **`score-result-dialog.tsx`** (GLOBAL — IBX-0024 + IBX-0034, RUL-0005/RUL-0019) —
  resultado como LISTA LIVRE (rounds 2-4 de 10-09): o topo do dialog tem o
  par FIXO (`absolute top-4 right-4`, sempre visível, desabilitado enquanto
  o submit pende) formado pelo botão "Adicionar" — que É o `Menu.Trigger`
  (o menu do corpo foi EXTINTO no round 5) — e pelo X de fechar GLOBAL
  (`DialogCloseButton`, `src/components/ui/dialog-close-button.tsx`:
  `Button` puro icon-only terciário sz sm com `Cancel01Icon` do HugeIcons,
  fechando pelo contexto do root — `useDialog().onOpenChange(false)`, o
  mesmo mecanismo interno do `Dialog.Close`, sem envolvê-lo — e aceitando
  `isDisabled`; adotado por TODOS os dialogs do app, posição preservada);
  menu "Adicionar set" (`NumberStepper`
  0-99 por lado com "x", entrada numérica, NUNCA chips), "Adicionar
  tie-break" (avulso, só com 1+ set) e "Registrar W.O."; "Tie-break"
  dentro de cada linha anexa/remove o mini-placar (um por linha,
  centralizado sob os steppers, remoção pelo X); X (`Cancel01Icon`)
  remove linha/sub-linha; empty state SÓ com zero linhas
  (`lines.length === 0` — antes renderizava sempre); zero gates de regra
  (3x3 vale); SEM scoreboard
  — "Quem venceu?" só aparece na hora de salvar quando o conjunto fica
  indefinido (empate em games é decidido pelo TB anexo, mais pontos).
  Adaptação só de identidade/lados no componente (sem `matchConfig`/
  `validateSets`/`winnerFromSets` desde o round 2); payload `{sets,
  walkover, explicitWinnerId}` com vencedor explícito CONDICIONAL; núcleo
  neutro em `src/components/ui/score-result-dialog.tsx` + puras em
  `src/lib/matches/score-draft.ts` (17 testes). No torneio: payload
  `{matchId, score, walkover}` com `winnerEntryId` nullish (explícito só
  quando as linhas empatam ou em W.O.; null quando o placar decide e o
  backend deriva); corpo scrollável com `ScrollShadow` + `maxHeight =
  min(450, metade da janela)` e `isSwipeable={false}` (o drag-to-dismiss
  brigaria com o scroll; fixos: título, Adicionar + X, rodapé com Salvar);
  o antigo `tournament-result-dialog.tsx` foi EXTINTO
  (grep 0). Detalhes do fluxo na spec da liga (mesmo componente global).
- **Agendar/Reagendar confronto (IBX-0030, RUL-0005)** — o torneio REUSA
  o dialog global da liga `ChallengeProposalDialog`
  (`components/pages/leagues/challenge-proposal-dialog.tsx`) com
  description adaptada ("A contra B."), `occupiedSlots={[]}` e payload
  `{matchId, courtId, endMinute, matchDate, startMinute}` — o paralelo
  `tournament-schedule-dialog.tsx` foi EXTINTO (o modelo do torneio não
  tem duração visível; endMinute segue exigido pelo contrato
  `ScheduleTournamentMatchSchema` e é computado do
  `defaultDurationMinutes`).
- **`tournament-join-footer.tsx`** — select de categoria (taxa no label),
  duplas: input de username com debounce 500ms + `players.searchByUsername`
  ao vivo — precheck é HINT de UX, nunca gate do submit (erro de rede fica
  neutro; decisão do slice 1: o servidor valida o convite); submit
  `entries.create` com o username normalizado digitado;
  `awaiting_payment` → `payment.charge.createCharge`
  (`tournament_entry`) → `/checkout/[chargeId]`.
- **`tournament-card.tsx`** — removido (QA round 1): o card de torneio
  virou o card universal.

### Descoberta universal (QA rounds 1–2, 22-08)
- **Card universal** (`src/components/ui/competition-card.tsx`) — um só
  componente para Liga e Torneio (RUL-0005): `CompetitionCard` com chip
  visível `chipLabel` ("Liga"/"Torneio") e `CreateCompetitionCard`
  props-driven (label/description/onPress); substitui LeagueCard/
  CreateLeagueCard/TournamentCard (arquivos antigos removidos; consumidores:
  tabs index/search/competitions + settings/leagues).
- Altura estável por linha (IBX-0021): CompetitionCard e CreateCompetitionCard reservam título em 2 linhas (min-h-12) e descrição em 2 (min-h-8) — o LegendList posiciona cada célula da grid com position:absolute e não estica colunas como o FlatList, então a altura é intrínseca ao card e idêntica nas duas abas, qualquer quebra de linha do título.
- **`(tabs)/competitions.tsx`** (ex-`ligas.tsx` → `competicoes.tsx`,
  renomeada p/ inglês no QA round 3 — RUL-0013: identificadores em inglês,
  texto visível pt-BR; aba organizer-only, gate `href` no `(tabs)/_layout.tsx`
  como em `search`) = "Minhas Competições" — MODO ORGANIZADOR: abas internas
  segmentadas Ligas|Torneios no molde exato do challenges.tsx (título +
  Tabs.List abaixo do header), cada aba com os cards do tipo + card de
  criação DENTRO da lista ("Nova liga"/"Novo torneio" → wizard respectivo);
  SEM menu no header — nenhuma ação de criação fora dos cards (QA round 2).
  MODO JOGADOR (se chegar à rota): SEM abas internas — lista única universal
  de ligas+torneios em que participa (`discovery.listParticipating` dos dois
  domínios) com chip por card. Botão de EDITAR com paridade total (QA
  round 5): liga → `/settings/leagues/[mode]` edit; torneio →
  `/settings/tournaments/[mode]` edit (mesmo caminho do menu do detalhe);
  busca não expõe edição (nenhum consumidor passa `onEditPress`); no ramo
  de participação o `onEditPress` é simétrico para os dois kinds — ramo
  praticamente morto (só alcançável por ator organization sem role manager,
  que não participa de competições; comportamento idêntico ao da liga
  desde o round 1). Corpo no
  padrão das tabs de lista (moldes `(tabs)/index.tsx` e `(tabs)/search.tsx`):
  `ScrollShadow` como wrapper e
  `Page.LegendList` container único de scroll (never dentro de ScrollView),
  estados de loading/erro no `Page.ScrollView` irmão e pad inferior
  `pb-floating-tab-bar-4` (token da floating tab bar, `global.css`).
- **`(tabs)/search.tsx`** — resultados UNIFICADOS numa lista só (sem
  headers de seção): filtro da liga (`filterLeaguesBySearchQuery`) +
  novo filtro puro de torneios (`convex/domains/tournament/discovery-list.ts`
  + `tests/discovery-list.test.ts`, padrão discovery-list da liga:
  normalização NFD/acentos/caixa, match por nome/cidade/estado/descrição).
  Buscar "Bruno" retorna a Liga e o Torneio do Bruno juntos, cada card com
  seu chip.

### Regras puras testadas
- `src/lib/tournaments/bracket-view.ts` (+ `bracket-view.test.ts`, 5 testes
  pós-R10): join de lados (`buildMatchSides`), swap só na 1ª rodada sem
  placar (`canSwapMatch`), placeholder da chave. (`buildBracketColumns` foi
  removido no R10 — os casos de colunas migraram p/ bracket-tree.)
- `src/lib/tournaments/bracket-tree.ts` (+ `bracket-tree.test.ts`, 5 testes
  — R10): agrupamento por categoria, layout com midpoint dos filhos,
  clamp anti-overlap, conectores child→parent `{from, to}`.
- ~~`src/lib/tournaments/match-config-presets.ts` (+ teste, 10 testes —
  R10)~~ — REMOVIDO no R12: presets de formato extintos junto com o seletor
  da aba Regras (organizador personaliza campo a campo).
- `src/lib/tournaments/tournament-details-derived.ts` (+
  `tournament-details-derived.test.ts`, 11 testes): papéis
  organizer>player>guest, access por status (chave pública só em
  ongoing/finished para não-organizador), tabs filtradas por access,
  placeholder da chave com a data de início.

### Pendências conhecidas
- ~~`tournamentPlayerCardSchema` incompleto~~ — ✔ resolvido e deployado
  22-08 (contract.ts:236-242 declara os 5 campos; view type paliativo
  removido do frontend).
- Deep-link `/tournaments/:id` das notificações resolve para o cluster
  (rota existe); falta registrar o prefixo no mapa de deep-links do app se
  houver validação central.
- QA R16 (IBX-0014): validação INTERATIVA pendente pro usuário (RUL-0002/
  0007): suavidade da pinça no Flow, toque curto em Agendar/Resultado/side
  rows sob o pane gesture, e fit centrado com respiro nas bordas.
- IBX-0020 (QA print do usuário): botão pressionado no card BORRA o texto
  sob zoom — causa raiz provada no source: o `Button` heroui anima
  `transform: scale` (1→0.985) no root do PressableFeedback a cada press
  (heroui-native button.styles.ts:8-13, button.tsx:236-250) e, sob o
  ancestral transformado do Flow (scale `fitScale..1.0`,
  flow/index.tsx:839-845), o iOS re-rasteriza o texto em escala composta
  fracionária enquanto pressionado; vizinho estático fica nítido. Fix:
  `animation={{ scale: false }}` no trigger (API oficial da lib,
  button.styles.ts:22) — feedback de toque permanece no
  `PressableFeedback.Highlight` (opacity/bg, SEM transform), nítido em
  QUALQUER zoom/pan. Menu sob o canvas é seguro: âncora medida via RN
  `measure` que em new arch inclui os transforms da shadow tree
  (react-native DOM.cpp:501-504 `includeTransform: true` ×
  `getTransform()` de cada ancestral), conteúdo renderiza no
  FullWindowOverlay em escala de janela (1.0) e o overlay fullscreen
  bloqueia pan/zoom com o menu aberto (âncora não drifta).
- IBX-0022 [A] (abertura da chave — timeline REAL, medida em sim iPhone
  17 Pro Max com profiler/logs): 1a cura (1o fit instantâneo + agendamento
  por rAF com retry até todo node ter rect, hard stop ~20 frames; sem
  timer fixo nem spring de 320ms na abertura) MANTIDA — mas o delay
  percebido não era ela: o fit SÓ pode aterrissar após o MOUNT completo
  das 63 cards, e esse mount é um commit único de ~910ms em dev (React
  Profiler: `View` ×2023, `Pressable` ×480, `ExpoImage` ×252, 63
  BracketMatchCards) + medições — mount+fit medido em 1598-1943ms (dev;
  ≈÷3 em prod). Piso restante = o próprio mount; próximo passo real
  (decisão do Maestro, muda comportamento visível): janelar/deferir cards
  fora da viewport. Flush do estado de rects BATCHEADO ≤1/frame (o
  imediato por card era O(n²) no context do Flow). Fórmula/clamps
  (minZoom=fitZoom, maxZoom=1 — lei do R15 sem upscale) e guards do
  BUG-0008 intactos.
- IBX-0022 [B] (flicker RECORRENTE no meio da pinça — "buga e volta",
  zonas diferentes): perfil nativo (xctrace) + React Profiler provaram a
  corrida — no iOS TUDO corre na main thread (worklets Reanimated = UI
  thread) e cada frame de pinça pagava `runOnJS`→`setState` do viewBox →
  render React reconciliando AS 62 EDGES + repaint nativo do SVG
  (`RNSVGRenderable renderLayerTo` no stack do hang; dt do viewBox media
  9-48ms = frames perdidos). Estourado o frame budget, o transform hitcha
  e compensa no frame seguinte = "buga e volta". `React.memo` nas paths
  NÃO segurou sob o React Compiler (4526 renders / ~4.1s de JS com props
  diff VAZIO — medido). FIX: elementos das edges em cache de IDENTIDADE
  (`useMemo` por edges/boxes/handles/tint) — elemento reference-equal faz
  o reconciler pular a subárvore inteira; pós-fix: 124 renders/2.9ms na
  mesma janela, 1 commit ≥16ms na sessão, edges grudadas aos cards.
  Rejeitado COM PROVA: viewBox como animated prop no Svg crasha nativo ao
  montar o layer (campo minado BUG-0008 — reproduzido em sim e
  revertido). O pulo de re-ancoragem do 1o round era bug real menor e
  segue corrigido (`panStart` âncora única do pan). Intactos: guards do
  BUG-0008 (reaction null-safe, runOnJS, isFinite, early-return
  degenerate), clamp 24pt, R19, maxZoom=1.
- IBX-0029 [B] (flicker SÓ na pinça — "a chave se sobrepõe, tudo junto";
  pan limpo): 1b do Orion implementada — `Flow.StaticEdge` (edges como
  views em coordenadas de grafo dentro do canvas de nodes, mesmo
  transform do worklet) + guard de janela vazia no FlowEdgeLayer +
  migração `runOnJS`→`scheduleOnRN` (RUL-0015). Zero trabalho de React e
  zero round-trip JS por frame de gesto no bracket; geometria idêntica
  (mesma rota de `flow-paths.ts`, paridade de strings SVG pinned em
  flow-paths.test.ts; decomposição barras+cantos testada: facing,
  foldback, overshoot de anchor, radius 0). Intactos: FlowEdgeLayer
  genérico + guards BUG-0008, clamp 24pt, âncora única, R19, maxZoom=1,
  fit instantâneo + hard stop do rAF. Sem OTA — revisão primeiro.
- ~~Limite conhecido (IBX-0014): `minZoom={0.2}` satura o fit em categorias
  com ~45+ inscritos~~ — ✔ RESOLVIDO no R18: minZoom dinâmico = zoom exato
  do fit (`bracketFitZoom`); o zoom-out alcança SEMPRE o enquadramento
  completo, em qualquer tamanho de chave.

## Backend implementado (slice 2 — 22-08-2026)

### Domínio (`convex/domains/tournament/`)
- **contract.ts** — Zod completo: `CreateTournamentSchema`/`UpdateTournamentSchema`
  (com `categories`, validação `registrationDeadlineAt < startDate`), status enums
  (`TournamentStatusOptions`, `TournamentEntryStatusOptions`), `CreateCategoryInputSchema`
  (recusa `singles`+`mixed`), schemas de saída (tournament/category/entry/match) e
  score A/B (`tournamentMatchScoreSetSchema`). Match config e quadras reutilizados
  da liga (`LeagueMatchConfigSchema`, `LeagueCourtsSchema`). **R10 (22-08):
  `LeagueMatchConfigSchema` ganhou `superRefine` `bestOfSets` ∈ {1, 3, 5}**
  (fonte única em `convex/domains/league/contract.ts` —
  `SUPPORTED_BEST_OF_SET_COUNTS` + `getBestOfSetValidationError` movidos para
  lá e re-exportados de `challenge-rules.ts`), então create/update de torneio
  rejeitam `bestOfSets: 2` no backend (antes o refine só existia no form da
  liga). No input da LIGA o `.catch(DEFAULT_LEAGUE_MATCH_CONFIG)` pré-existente
  do `ruleConfig.matchConfig` continua engolindo configs inválidas (healing de
  docs legados); no torneio não há catch — rejeição dura. Testes:
  `convex/domains/tournament/tests/contract.test.ts` +
  `league/tests/contract.test.ts`. Deployado dev+prod em 22-08.
  **R11 (22-08): `tieBreakAtGamesAll`/`finalSetTieBreakAtGamesAll`
  REMOVIDOS do schema compartilhado** — o gatilho do tie-break é DERIVADO:
  TB em X-X onde X = `gamesPerSet` do set (no último set custom, X =
  `finalSetGamesPerSet`); derivação em
  `challenge-rules.ts:getSetValidationError`. E
  `tieBreakPoints`/`finalSetTieBreakPoints`/`finalSetSuperTieBreakPoints`
  agora exigem ∈ {7, 10} (`SUPPORTED_TIE_BREAK_POINTS` +
  `getTieBreakPointsValidationError` no mesmo superRefine do bestOf,
  paths próprios; mensagem "Escolha 7 ou 10 pontos no tie-break.").
  Racional: padrões oficiais do tênis — set TB a 7, super TB a 10, win-by-2
  sempre; nada de mínimo livre. Auditoria dev+prod antes de cada tighten:
  TODOS os docs (1 liga dev/prod, 31 snapshots, 1 torneio) já 6/7/10 —
  derivação e refine neutros (super TB vivo = 10 em 100% dos docs). Docs
  antigos com a chave extra: Zod stripa (testado) e o `.catch` da liga NÃO
  dispara. Sem migration. Deployado dev+prod em 22-08. UI do form ENTREGUE
  no mesmo round (campo de placar do TB removido, segmentos 7|10 — ver
  leagues.md, "Match config compartilhado").
- **tables.ts** — `tournament` (organizationId cascade, courts JSON, matchConfig
  JSON, registrationDeadlineAt/startDate, status, platformFeePercent),
  `tournamentCategory` (modality×gender com **uniqueIndex**
  `tournamentId_modality_gender`), `tournamentEntry` (playerA/playerB,
  createdByUserId, seedRank, **uniqueIndex por categoria** em playerA e playerB —
  inscrição única garantida pelo banco, melhoria sobre a liga),
  `tournamentMatch` (round/slotInRound com **uniqueIndex**
  `categoryId_round_slotInRound`, entryA/B nullable, winnerEntryId, score JSON,
  agendamento matchDate/startMinute/courtId, `publishedAt` trava swap,
  `rowVersion` concorrência otimista, walkover).
- **relations.ts** — categories/entries/matches + playerA/B e entryA/B/winner com alias.
- **bracket-rules.ts** (puro, testado) — `nextBracketSize` (próx. potência de 2,
  mín. 2), `seedOrder`/`slotOfSeed` (seeding clássico: 1×8/4×5/2×7/3×6 — 1 e 2
  só na final), `validateSeedRanks` (1..s sem buracos), `buildBracket`
  (seeds nos slots padrão, **byes priorizados aos top seeds**, não-seeds na ordem
  embaralhada pelo caller, byes resolvidos como walkover com avanço imediato),
  `validateSlotSwap`/`applySlotSwap` (swap 1ª rodada; placar publicado trava;
  byes re-deriváveis), `nextMatchCoordinates`.
- **entry-rules.ts** (puro, testado) — `buildCategoryDisplayName` (as 5 categorias),
  `validateEntryGenders` (mixed = 1 "Masculino"+1 "Feminino", ambos definidos),
  `resolveEntryStatusAfterPartnerAccepted`, `isEntryDrawable`.
- **score-rules.ts** — `validateTournamentMatchScore` adapta para o
  `validateChallengeScore` da liga (reuso integral das regras de tênis:
  games/tie-breaks/super tie-break/win-by-two; mensagens pt-BR idênticas) e
  `validateWalkoverWinner` (M4: vencedor ∈ lados).
  **IBX-0028: `resolveResultEditReverb` (NOVO, puro)** — decisão de edição de
  resultado publicado sobre a chave: mesmo vencedor/sem próxima → `keep`;
  vencedor trocado + próxima não publicada → `swap`; próxima já publicada →
  `conflict` (edição em cadeia exigida). Testes:
  `tests/score-rules.test.ts` (NOVO).
- **tests/** — `bracket-rules.test.ts` + `entry-rules.test.ts` (55 testes:
  potências, seeding, byes p/ seeds, propagação, swap bloqueado por placar,
  gênero misto, placares válidos/inválidos, **H1: 5/6/7/9/12 inscrições
  com/sem seeds sempre completáveis (1 bye por par)**, **M4: walkover
  arbitrário rejeitado + refine do contract**).
- **management.ts** — `create/update/remove/getById/listMine/generateUploadUrl/publish`
  (edit travado fora draft/published; remove só draft). **Edição de categorias
  é por DIFF desde o review do slice 2** — pares mantidos são atualizados
  (taxa/vagas, com piso `maxEntries >= inscrições ativas`); par removido só
  some sem inscrições ativas (`CONFLICT` com nome da categoria caso contrário);
  par novo é criado. Nunca delete+recreate: cascade apagaria
  entries/matches de torneios publicados e órfã cobranças pagas.

### CRPC (`convex/functions/tournament/`)
- **management.ts** — `create/update/remove/getById/listMine/generateUploadUrl/publish`
  (edit travado fora draft/published; remove só draft; categorias ressincronizadas).
- **discovery.ts** — `getById` (público p/ status discoverable + organizador),
  `listAvailable` (public/draft-invisível), `listParticipating`.
- **entries.ts** — `create` (simples direto; duplas nascem `pending_partner` com
  convite por **username** normalizado lowercase; valida gênero misto; capacidade),
  `respondPartnerInvite` (aceitar/recusar → `awaiting_payment`/`pending_approval`/`active`),
  `approve`/`reject` (organizador), `cancel` (jogador antes do sorteio ou organizador),
  `setSeed`, `listForTournament`.
- **bracket.ts** — `draw` (shuffle Fisher-Yates + `buildBracket` por categoria;
  status→drawn), `swapSlots` (valida + aplica + **re-propaga vencedores** em
  partidas sem placar; notifica os novos lados), `start` (drawn→ongoing;
  `tournament.bracket.published` a todos), `listBracket` (organizador).
- **matches.ts** — `publishResult` (valida resultado via score-rules ou walkover;
  trava com `publishedAt`; **avança vencedor** na rodada seguinte; notifica os
  lados; `maybeFinishTournament` → finished automático quando todas as finais
  têm campeão + notifica; **fix IBX-0026: `walkover` gravava `false` por
  hardcode — agora `Boolean(input.walkover)`**), `editResult` (**IBX-0028,
  NOVO** — edita resultado JÁ publicado, mesmo payload do publish;
  organizador only; reverb via `resolveResultEditReverb`: mesmo vencedor →
  keep, vencedor trocado + próxima não publicada → swap do slot, próxima já
  publicada → `CONFLICT`, torneio finished + swap → `BAD_REQUEST` protege o
  campeão; auditoria em `tournamentMatchEdit` before/after + editor; notifica
  `tournament.match.result_edited`; `maybeFinishTournament` re-roda),
  `scheduleMatch` (data/hora/quadra; reschedule distinto),
  `listForTournament`.
- **lifecycle.ts** — `cancel` (entries canceladas + `tournament.cancelled` +
  charges pagas marcadas refund-pending + handoff à action), `processRefunds`
  (action: chama provider por charge, idempotente), `listRefundableCharges`,
  `applyRefundOutcome` (`refunded|failed`), `sweepPendingRefunds` (cron 15min,
  padrão sweep dos withdraws).
- **players.ts** (despacho do slice 3, 22-08) — `searchByUsername({username})`
  (authQuery, **busca exata** pelo design do convite; normaliza com a regra
  pura `normalizeUsernameLookup` — lowercase/trim, a mesma do convite;
  retorna `TournamentPlayerCard | null`, só perfis com username definido).
- **Leituras enriquecidas** (despacho do slice 3): `entries.listForTournament`
  devolve `tournamentEntryWithPlayersSchema` — cada entry embute
  `playerA`/`playerB` `TournamentPlayerCard {playerProfileId, fullName,
  nickname, avatarUrl, username}` (perfis+users pré-carregados em mapas,
  avatarUrl via `resolveStorageUrl`; cardCache evita N+1). `bracket.listBracket`
  e `matches.listForTournament` seguem devolvendo só IDs de entry — o
  Frontend monta o mapa entryId→card client-side a partir das entries
  enriquecidas (uma fonte de verdade).

### Pagamento
- `paymentCharge` ganhou `refundStatus` (`pending|failed|refunded`, trilha do
  estorno; campo opcional, sem migration).
- `charge.ts`: `SOURCE_TYPE_TOURNAMENT_ENTRY` + `resolveTournamentEntrySource`
  (entry precisa `awaiting_payment`; valor = taxa da categoria, **um charge por
  inscrição**; label "Torneio — Categoria") + `applyPaidTournamentEntryCharge`
  (entry→active + `tournament.entry.confirmed` a criador+parceiro).
- `providerNode.ts`: **`refundChargeAction`** — REST validado na doc oficial
  (`POST /api/v1/charge/{correlationID}/refund`), refund integral, correlationID
  determinístico `refund-<charge>` (idempotente), IN_PROCESSING tratado como ok.

### Notificações
- `protocol.ts`: 13 eventos `tournament.*` no catálogo (IBX-0028:
  `tournament.match.result_edited`).
- `definitions.ts`: templates pt-BR + deep-links `/tournaments/:id`; input
  genérico (`leagueId` OU `tournamentId`).
- `orchestrator.ts`: **fim do hardcode league** — `resolveNotificationSource`
  resolve por leagueId|tournamentId; recipientas organizer via mapa
  `ORGANIZER_RECIPIENT_EVENTS` (`tournament.entry.created` incluído). Ligas
  inalteradas (`scheduleLeagueNotification` continua válido).

### Ambientes
- Deploy DEV (kindred-yak-142) + PROD (amiable-albatross-845) alinhados
  (RUL-0011, `bunx kitcn deploy --yes`); 13 índices de tournament criados em
  PROD, zero índices deletados, sem migrations de dados. Gates: codegen,
  typecheck:convex, `bun test convex` (302 pass, +38 do torneio),
  `bun run check` — todos verdes.
- **31-08 (IBX-0026/0028): deploy dev+prod alinhados** — tabela nova
  `tournamentMatchEdit` (índice `matchId`) criada nos dois ambientes,
  additive, zero migrations de dados, zero índices deletados. Gates:
  739 testes pass (+19: walkover da liga, reverb de edição, refine W.O.),
  typecheck, `bun run check`.

### Avanço direto de fase + placar de tie-break (IBX-0035/PLN-0004 + IBX-0034, 10-09)

**EntryRound (opção B aprovada pelo usuário em 10-09): cabeças de chave podem
entrar direto numa fase avançada da chave, pulando múltiplas rodadas**
(cenário: chave grande de 60-80 jogadores com cabeças começando nas oitavas).
Só torneio (liga não tem chave).

- **`tournamentEntry.entryRound`** (integer nullable, aditivo, sem migration):
rodada em que a inscrição entra na chave (null/1 = 1ª rodada). Avanço de fase
é privilégio de cabeça: exige `seedRank` (validado no sorteio por
`validateEntryRounds`). Escrita via **`entries.setEntryRound`** (organizador,
status `published` (pré-sorteio) ou `drawn` (pré-início — a mudança alimenta
o re-sorteio, IBX-0037; mesma janela do `setSeed`).
- **Completabilidade (regra pura `validateEntryRounds`)**: cada rodada pulada
consome `2^(r-1) − 1` dos byes forçados (`drawSize − inscritos`); a soma dos
saltos nunca pode excedê-los, e a fase precisa existir na chave. **Os blocos
de rodada 1 podados por entradas diretas precisam ser DOIS A DOIS DISJUNTOS**
(review C1/H1, 10-09): o orçamento conta os blocos como regiões disjuntas e
uma fase contida na região de outra (ex.: seed 3 na R3 + seed 6 na R2 numa
chave de 16) deixaria um confronto com lado morto e a chave nunca terminaria;
a regra rejeita os dois casos de sobreposição (mesma vaga e bloco contido).
- **Fase é número de RODADA, não nome fixo**: o tamanho da chave sai de
  `nextBracketSize(inscritos ativos da categoria)`, então o nome da fase de uma
  rodada muda com a chave (chave de 16 → oitavas na rodada 1; de 32 → rodada 2;
  de 64 → rodada 3; de 128 → rodada 4). A UI deriva os rótulos desse tamanho
  (`buildEntryRoundOptions`/`formatEntryRoundLabel`, mesma conta do sorteio) —
  nunca de uma lista fixa.
- **`buildBracket` (passo a passo)**: (1) entradas diretas reivindicam o
side-slot padrão do seu seed NA rodada de entrada (`slotOfSeed` projetado na
árvore); dois cabeças no mesmo side-slot = eles se enfrentariam antes dessa
fase → erro; (2) a subárvore que alimentaria esse side-slot é PODADA: as
linhas continuam existindo como **status `vacant`** (sem lados, sem vencedor)
para preservar a grade completa do layout; (3) seed da 1ª rodada cujo slot
padrão foi absorvido por uma entrada direta → erro (organizador avança a fase
vindo por baixo).
- **Re-sorteio em `drawn` (IBX-0037, 10-09)**: `bracket.draw` aceita
`published` **ou** `drawn` (regra pura `canDrawTournament`); o re-sorteio é o
mesmo caminho delete-matches → `buildBracket` → insert — em `drawn` nenhuma
partida tem `publishedAt` (resultados só existem em `ongoing`), então nenhum
RESULTADO precisa ser preservado; auditorias `tournamentMatchEdit` só existem
para resultados publicados, então nada se perde no cascade. **AGENDAMENTO, sim,
existe em `drawn`** (a Agenda é acessível antes do início) e o delete leva
data, horário e quadra embora: com qualquer confronto agendado (data + horário
+ quadra, em qualquer categoria), o item **Re-sortear** abre diálogo de
confirmação de destruição antes de disparar (`hasScheduledMatch` nos dados já
carregados da chave; sem agendamento, dispara direto). `ongoing` NUNCA
re-sortea (chave com placar é intocável). Organizador preso pós-sorteio
com seeds/fases erradas agora re-sortea na janela drawn→iniciar.
- **Contrato**: `SetEntryRoundSchema { entryId, entryRound: int ≥ 1 | null }`;
`tournamentEntrySchema.entryRound`; `SwapBracketSlotsSchema.round`
(default 1); `tournamentMatchSchema.status` ganha **`vacant`**.
- **Swap generalizado para MESMA rodada** (`swapSlots` aceita `round`,
default 1 — retrocompatível): lados de rodada ≥ 2 podem estar ocupados no
sorteio pelas entradas diretas; a re-derivação de bye continua exclusiva da
1ª rodada (`applySlotSwap` round-aware) e a re-propagação de vencedores segue
bloqueada por `publishedAt`. Troca ENTRE rodadas diferentes = fora do
contrato (mudança de fase é pré-sorteio). **Posse da categoria (review C1,
10-09)**: `getManagedTournamentOrThrow` só prova a posse do `tournamentId`
recebido — a procedure carrega a categoria (`getCategoryRecordOrThrow`) e
exige `category.tournamentId === record.id` (regra pura
`validateSwapCategoryOwnership`, NOT_FOUND no mismatch); sem isso um
organizador do torneio A embaralhava a chave do torneio B com um categoryId
forjado (IDOR cross-tenant).
- **Visibilidade do `listForTournament` (review M2, 10-09)**: mesmo gate do
`discovery.getById` — organizador OU torneio descobrível OU participante
DAQUELE torneio (entry não-cancelada em categoria dele); sem o gate qualquer
usuário autenticado enumerava as inscrições (com cards de jogador) de
torneios privados/draft. `isDiscoverable` subiu para `_shared/guards.ts`
(fonte única dos dois gates).
- **BUG-0017 (10-09, achado do re-review)**: o `viewerEntryIds` do
`discovery.getById` computava as entradas do jogador SEM filtro de torneio —
qualquer jogador com QUALQUER inscrição furava o gate de torneio privado e a
resposta vazava ids alheios. Agora as entradas são filtradas pelas categorias
do torneio em questão; a regra pura `selectViewerTournamentEntryIds`
(`entry-rules.ts`) é a fonte única dos dois gates (getById e
listForTournament).
- **Vacant fora de agenda e placar**: `publishResult` e `scheduleMatch`
rejeitam partidas `vacant` (BAD_REQUEST); listagens seguem devolvendo as
linhas (a chave precisa da grade) — o filtro visual é do frontend (Radar).
- **Placar de tie-break (IBX-0034, parte backend)**: `tournamentMatchScoreSetSchema`
ganha `tieBreak: { aPoints, bPoints } | null | undefined` (nullish — drafts do
cliente carregam null); resultados antigos sem tieBreak seguem válidos; W.O.
não carrega TB (refine do `PublishMatchResultSchema`). Adaptador do torneio
mapeia A/B ↔ challenger/challenged (`toLeagueSets`) e `serializeMatchScore`
normaliza null → ausente no JSON armazenado.
- **Placar manual LIVRE (REWORK-2, 10-09)**: a validação do resultado manual
(`validateTournamentMatchScore`) deixou de aplicar regras de tênis — aceita
linhas `{a, b, kind: "set"|"tiebreak"|"super_tiebreak"}` com números ≥ 0
QUAISQUER e `tieBreak` anexo livre (só ints ≥ 0; nada de padrão 7x6, direção,
alvo/win-by-2/teto). Vencedor: derivado por linhas vencidas — **linha empatada
em games é decidida pelo TB ANEXO (mais pontos; TB empatado = ninguém)**;
quando as linhas empatam, o payload manda `score.winnerEntryId` EXPLÍCITO
(campo agora nullish/aditivo) — sem explícito = erro claro ("O placar não
define o vencedor; informe o vencedor do confronto."), explícito incoerente
com a derivação = erro. W.O. inalterado (vencedor nulo no payload ganha
"Informe o vencedor do W.O."). O bracket avança pelo vencedor resolvido;
`editResult` idem. Ligas espelham o mesmo resolver
(`resolveChallengeScoreOutcome`); sem migration; leitura de resultados antigos
intacta. O cluster de validação por forma da liga (`getSetValidationError`,
`buildChallengeScoreProgress`, `getRequiredSetWins`, `getExpectedSetKind`,
`isChallengeScoreSetBlank`, `resolveChallengeScoreWinnerMembershipId`,
`validateChallengeScore`) foi REMOVIDO — zero call sites fora dos testes
(grep; o draft antigo do client não existe mais).
- **Gates (10-09)**: codegen (dev), typecheck:convex, `bun test convex`
(399 pass na entrega, +13 do entryRound/TB; 403 hoje), ultracite nos arquivos
tocados.
Deploy DEV via codegen; **PROD pendente de autorização** (RUL-0011).
Frontend (UI de seeds/fase + vacant + fluxo de resultado com TB) despachado
ao Maestro para Tribuna/Radar.

## Visão geral

Torneios de tênis/beach tênis organizados pela organização (independente de
liga): eliminatória direta (mata-mata) por categoria, presenciais e de duração
estendida flexível — data de início definida, fim real quando saem os campeões
(sem prazo por rodada, nada expira por cron). O torneio é um container:
nome, capa, local, quadras e **categorias estruturadas por modalidade ×
gênero** (Simples Masculino, Simples Feminino, Duplas Masculinas, Duplas
Femininas, Duplas Mistas), cada categoria com chave e inscrições próprias.
Inscrição opcionalmente paga (checkout PIX/Woovi reutilizado). Em duplas, par
fixo formado na inscrição via convite ao parceiro por **username**. O
organizador é a mesa: lança os placares e a chave avança.

Vocabulário de produto: **torneio** (nunca "evento").

## Modelo aprovado

### Tabelas (convex/domains/tournament/)

- **`tournament`** — `organizationId` (ownership igual `league.organizationId`,
  acesso por `requireActiveManager`), nome, `coverStorageId`/`avatarStorageId`
  (mesmo padrão de mídia/limpeza da liga), local (mesmo modelo da aba Local da
  liga), `registrationDeadlineAt` (inscrições até), `startDate` (início
  divulgado; sem data final — o fim é o campeão), quadras (JSON no
  padrão `LeagueCourtsSchema`), `approvalMode: auto|manual`,
  `status: draft|published|drawn|ongoing|finished|cancelled`, `matchConfig`
  (formato de partida da liga reutilizado — `LeagueMatchConfigSchema`, que
  desde 22-08/R10 exige `bestOfSets` ∈ {1, 3, 5} no próprio schema, agora
  também no backend e não só no form da liga; default do
  `DEFAULT_LEAGUE_MATCH_CONFIG`: melhor de 3 sets, 6 games, tie-break a 6-6
  e último set `same_as_previous` — SEM super tie-break).
- **`tournamentCategory`** — `tournamentId`, `modality: singles|doubles`,
  `gender: male|female|mixed` (validação: `singles` não aceita `mixed`),
  nome gerado a partir do par (ex.: "Duplas Mistas"), `entryFeeCents`
  opcional (0/undefined = grátis), `maxEntries` opcional.
- **`tournamentEntry`** — `categoryId`, jogadores: 1 (simples) ou
  `playerAId`/`playerBId` (duplas), `createdByUserId` (quem paga),
  `seedRank` opcional (cabeça de chave marcado pelo organizador),
  `entryRound` opcional (IBX-0035: rodada em que entra na chave; null/1 =
  1ª rodada; exige seed),
  status `pending_partner|pending_approval|awaiting_payment|active|rejected|cancelled`
  (duplas nascem `pending_partner` até o convite ser aceito; depois seguem
  para `awaiting_payment` ou `pending_approval` conforme a categoria).
  Em `mixed`, valida 1 homem + 1 mulher pelo gênero do perfil dos dois
  jogadores (exige gênero definido nos dois).
- **`tournamentMatch`** — `categoryId`, `round`, `slotInRound`,
  `entryAId`/`entryBId` (nullable = a definir/bye), `winnerEntryId`, placar
  com o schema de score da liga (sets + super tiebreak + mini-placar opcional
  de tie-break, IBX-0034), agendamento opcional
  (data + horário + quadra, padrão da liga), `walkover` boolean,
  `status` inclui **`vacant`** (IBX-0035: linha da subárvore podada por
  entrada direta, sem lados para sempre).
- **`tournamentMatchEdit`** (IBX-0028) — auditoria de edições de resultado
  publicado: `matchId` (cascade), `before`/`after` (JSON: score, status,
  walkover, winnerEntryId), `editedByUserId`, `createdAt`; índice `matchId`.
  Tabela additive — sem migration.

### Lifecycle

```
draft ──publicar──► published ──fechar inscrições + sortear──► drawn ──iniciar──► ongoing ──finais com vencedor──► finished
```

- `published`: entra na descoberta (busca, padrão `listAvailable` da liga);
  inscrições abertas até `registrationDeadlineAt` (ou fechamento antecipado
  pelo organizador).
  Sortear move o torneio para `drawn` e encerra as inscrições.
- Sorteio (por categoria): chave do tamanho da próxima potência de 2;
  **byes priorizados para os cabeças de chave**; seeds espalhados nas
  extremidades da chave (padrão de torneio), demais posições aleatórias.
  Sorteio é aleatório por padrão — o organizador apenas marca/desmarca seeds
  nas inscrições antes de sortear.
- `drawn` (preparação): chave sorteada, inscritos fechados. A chave é
  PRIVADA do organizador — ele ajusta (troca de slots, ver abaixo) **ou
  re-sortea** (`draw` aceita `drawn` desde o IBX-0037, após mudar
  seeds/fases de entrada) na
  janela entre o sorteio e o início (ex.: inscrições até 22, torneio
  dia 25 — ajustes de 22 a 25). Jogadores veem placeholder
  "chave disponível a partir de {startDate}". Sem cron: o organizador
  toca **iniciar** (dia 25) e a chave vira pública.
- **Ajuste manual da chave (pós-sorteio)**: o organizador troca as DUAS
  inscrições clicadas (o jogador escolhido em cada confronto — lado A ou B)
  entre DOIS confronteiros da 1ª rodada da categoria (incluindo slots de
  bye) enquanto as partidas afetadas ainda não têm placar publicado —
  partida com placar/avanço trava. Rodadas seguintes derivam dos
  vencedores, então o ajuste na 1ª rodada é o único necessário. UI:
  toque no jogador → toque no jogador a trocar → troca exata (BUG-0010;
  antes o backend trocava sempre o lado A — por isso "trocava o outro").
  Sem drag na v1.
- `ongoing` (a partir de "iniciar"): chave pública; organizador lança
  placares e a chave avança na hora; ajuste de slots segue permitido em
  partidas ainda sem resultado.
- `finished`: automático quando toda final de categoria tem vencedor.
- `cancelled`: manual.

### Pagamento

- `paymentCharge` ganha `sourceType: "tournament_entry"` (infra já
  polimórfica; o código já antecipou "tournament entries"). Branch em
  `resolveSourceForCharge`, side effect em `applyPaidCharge` → entry
  `active`. Checkout `/checkout/[chargeId]`, split/fee (`DECISAO-004`) e
  withdraw herdam de graça.
- Pagante = quem cria a inscrição; na dupla, a taxa é da inscrição (valor
  único, não por jogador).
- **Reembolso automático no cancelamento**: cancelar um torneio com
  inscrições pagas dispara, por inscrição paga, o estorno integral via API
  de refund da Woovi (validar endpoint no slice; idempotente por charge,
  com trilha de status `refunded|refund_failed` e retry pelo mesmo padrão
  de sweep dos withdraws). Fluxo NOVO no app — nasce aqui e depois se
  aplica às ligas (registrado em BAC-0002). A notificação de cancelamento
  avisa o estorno.

### Username (pré-requisito de duplas)

- Better Auth `username` plugin — **implementado no backend 22-08**
  (defaults 3–30, `[a-zA-Z0-9_.]`, lowercase; login continua por e-mail;
  detalhes e verificação em `docs/spec/auth.md`). Nota: a opção
  `displayUsername: false` do design não existe na versão instalada
  (1.6.24) — o intent (não expor) é atendido pela UI, que não mostra o
  campo; coluna fica como técnica.
- Convite de parceiro: busca por username → convite in-app (notificação) →
  parceiro aceita → inscrição fecha (`pending_partner` → próximo status).

### Notificações

Pipeline existente (feed + deliveries + orchestrator com scheduler/lock/retry)
ganha catálogo `tournament.*`; hoje `createForRecipients` resolve `league`
hardcoded — vira resolver genérico por `sourceType`. Todas in-app (feed +
central de notificações); push nativo segue fora da v1. Princípio de design:
notificação é do JOGADOR; pendência do organizador vive no painel
(`WidgetAlert`/`KpiCard`), não no feed.

| Evento | Dispara | Quem recebe |
|---|---|---|
| `tournament.partner.invited` | convite de dupla enviado | parceiro convidado |
| `tournament.partner.responded` | parceiro aceita/recusa | quem criou a dupla |
| `tournament.entry.created` | nova inscrição (approvalMode manual) | organizador |
| `tournament.entry.confirmed` | inscrição ativa (grátis ou paga confirmada) | criador + parceiro |
| `tournament.entry.rejected` | organizador recusa | criador |
| `tournament.bracket.published` | organizador toca **iniciar** | todos os inscritos ativos |
| `tournament.match.reassigned` | ajuste de slot em partida sem placar | os 2 novos lados |
| `tournament.match.scheduled` | data/hora/quadra definidas | os 2 lados |
| `tournament.match.rescheduled` | reagendamento | os 2 lados |
| `tournament.match.result` | placar publicado | os 2 lados (vencedor vê avanço) |
| `tournament.match.result_edited` (IBX-0028) | organizador corrige resultado publicado | os 2 lados |
| `tournament.finished` | todas as finais com campeão | todos os inscritos ativos |
| `tournament.cancelled` | cancelamento | todos os inscritos ativos |

Cada notificação deep-linka à tela certa (chave da categoria, inscrições,
checkout quando aplicável). Bye de 1ª rodada não gera evento próprio — o
avanço é revelado no `bracket.published`.

## Telas aprovadas (padrões do repo)

- **Criação/edição**: wizard `/settings/tournaments/[mode]` no molde da liga
  (cluster `[mode]`, tabs telas + `FloatingTabBar`), tabs **Detalhes · Local
  · Categorias · Quadras · Configurações**. Aba Categorias = checkboxes das
  5 categorias (SM/SF/DM/DF/MX) + taxa + vagas de cada uma.
- **Detalhe**: cluster `/tournaments/[tournamentId]` — header do torneio +
  chips de categoria; tabs **Chaveamento · Agenda · Inscrições**; access model
  `guest|player|organizer` da liga; store Legend-State por bucket, React
  Query dono do servidor.
- **Chaveamento (bracket)**: canvas navegável estilo mapa (pinça = zoom
  ancorado com cap na resolução nativa, pan nas 4 direções clampado, duplo
  toque toggle fit ↔ máximo permitido; abre já mostrando a chave inteira —
  organizador e jogador); título Chaveamento com tabs de categoria no header
  quando o torneio tem 2+ categorias com chave (trocar reseta zoom); cada
  card carrega a própria fase (Final,
  Semifinal, Quartas de final, Oitavas de final) + jogadores/avatares (dupla
  = 2 avatares), placar, chip de status
  (vocabulário do challenge-card). Organizador toca no confronto → dialog de
  placar (`src/components/ui/score-result-dialog.tsx`, GLOBAL — RUL-0005; o
  antigo `challenge-result-dialog` está extinto) ou agenda data/hora/quadra
  (molde `challenge-proposal-dialog`). Disputa de 3º lugar não existe (fora de
  escopo); final destaca campeão.
- **Agenda**: programação por dia/período (molde `schedule.tsx`), confrontos
  de todas as categorias juntos.
- **Inscrição do jogador**: escolhe categoria(s); simples confirma; duplas
  convidam parceiro por username; pagamento via checkout quando a categoria
  tem taxa; join footer no molde da liga.
- **Painel do organizador**: alertas de inscrições pendentes
  (`WidgetAlert`), inscrições com aceitar/recusar (molde `requests.tsx`),
  marcar seeds, fechar inscrições + sortear, lançar placares.

## Decisões tomadas

- **Eliminatória direta** na v1 — grupos e todos-contra-todos descartados
  (22-08, usuário).
- **Modalidade vive na categoria, não no torneio** — torneio é container;
  categorias estruturadas modalidade × gênero, agenda unificada
  (22-08, usuário).
- **Misto = dupla 1 homem + 1 mulher** (22-08, usuário).
- **Par fixo na inscrição** via convite aceito no app; sem jogador solto
  (22-08, usuário).
- **Torneio independente de liga** — `tournament.organizationId` como a liga
  (22-08, usuário).
- **Taxa de inscrição opcional** por categoria; checkout reutilizado
  (22-08, usuário).
- **Fase de preparação (`drawn`)** — inscrições até `registrationDeadlineAt`;
  o sorteio encerra inscrições; chave PRIVADA do organizador na janela
  entre sorteio e início (organizador ajusta; jogadores veem placeholder
  com a data); "iniciar" é ação manual do organizador no dia — sem cron
  (22-08, usuário).
- **Duração estendida flexível** — sem deadline por rodada/cron; termina na
  final (22-08, usuário).
- **Organizador lança o placar** — mesa é a autoridade, sem confirmação do
  adversário (22-08, usuário).
- **Sorteio aleatório com seeds opcionais** — organizador marca cabeças de
  chave nas inscrições; byes priorizados para seeds (22-08, usuário).
- **Parceiro por username** — exige habilitar username no app antes do
  convite de dupla (22-08, usuário).
- **Misto exige gênero definido** nos dois perfis (consequência do modelo).
- **Ajuste manual da chave pós-sorteio** — organizador troca exatamente as
  DUAS inscrições clicadas entre dois confrontos da 1ª rodada (incluindo
  byes) enquanto as partidas afetadas não têm resultado (22-08, usuário;
  BUG-0010: lados clicados vão ao `swapSlots` — antes trocava sempre o
  lado A).
- **Estorno automático no cancelamento** — fluxo de reembolso (Woovi)
  nasce no torneio e depois se aplica às ligas (BAC-0002) (22-08, usuário).
- **Mapa de notificações** — 12 eventos `tournament.*` com destinatário por
  evento; notificação é do jogador, pendência do organizador vive no painel
  (22-08, usuário).
- **Regra de partida única por torneio (R10, fatia 1)** — o formato vive só
  em `tournament.matchConfig` e vale para TODAS as categorias
  (22-08, usuário). **Fatia 2 futura (apenas desenhada, nada implementado):
  override opcional por categoria** — `tournamentCategory.matchConfig`
  nullable, resolução `resolveMatchConfig = category.matchConfig ??
  tournament.matchConfig` consumida por placar/agenda/diálogos, toggle
  "formato próprio desta categoria" na UI. Não há `bestOf=2` literal: "2
  sets + super tie-break" segue alcançável manualmente — melhor de 3 +
  final set em super tie-break (`bestOfSets: 3` + `finalSetMode:
  "super_tiebreak"`).
- **Sem presets de formato no wizard (R12)** — o organizador personaliza as
  regras de partida campo a campo na aba Regras; o seletor "Formato do
  torneio" e `match-config-presets` foram extintos (22-08, usuário).
- **Torneio não snapshota matchConfig por partida** — `publishResult` valida
  o placar contra `tournament.matchConfig` ao vivo (diferente da liga, que
  congela `matchConfigSnapshot` por desafio porque permite editar regras a
  qualquer momento). Seguro porque `update` é travado fora de
  draft/published: pós-sorteio o config é imutável na prática.
- **Editor único de resultado publicado (IBX-0028)** — o organizador corrige
  placar/vencedor/W.O. de partida já publicada via `editResult`; trocar quem
  avança só entra enquanto a partida seguinte não foi jogada (`CONFLICT`
  caso contrário) e torneio finished bloqueia swap (protege o campeão).
  Toda edição fica auditada em `tournamentMatchEdit` (before/after) e
  notifica os 2 lados (`tournament.match.result_edited`) (31-08, usuário).
- **Avanço direto de fase por cabeça de chave (IBX-0035, opção B)** —
  organizador marca seed E fase de entrada por inscrição antes do sorteio;
  cada rodada pulada consome um bye forçado; subárvore abaixo da entrada
  direta vira linhas `vacant` (grade preservada); swap generalizado pra
  mesma rodada (10-09, usuário; mecânica da seção "Avanço direto de fase").
- **Mini-placar de tie-break persistido (IBX-0034)** — cada set do placar
  pode carregar `tieBreak {a/b points}` opcional; validado contra o padrão
  do TB (fecha `(X+1)xX`, direção do vencedor, alvo + win-by-2 + teto de
  sanidade); resultados antigos seguem válidos; super tie-break sem
  mini-placar (10-09, usuário).
- **Re-sorteio na janela drawn (IBX-0037)** — `draw` aceita `drawn`
  (regra `canDrawTournament`): organizador muda seeds/fases de entrada e
  re-sortea a chave inteira (delete + rebuild); `ongoing` nunca re-sortea
  (10-09, usuário via pedido "ressortear").

## Fora do escopo (v1)

Níveis A/B/C e faixa de idade (cabe depois como campo da categoria) ·
grupos/todos-contra-todos · prazos por rodada · ordenação manual completa do
seeding (drag) · disputa de 3º lugar · W.O. automático por cron · push
nativo · convite por link externo · login por username (campo existe, login
segue por e-mail).

## Próximos passos (slices)

1. ~~**Username no app**~~ — ✔ backend+UI entregues 22-08 (ver
   docs/spec/auth.md).
2. ~~**Contrato backend**~~ — ✔ entregue 22-08 (ver "Backend implementado").
3. ~~**Frontend**~~ — ✔ entregue 22-08 (ver "Frontend implementado").
4. Code review → QA do usuário (RUL-0002) → specs consolidadas.
