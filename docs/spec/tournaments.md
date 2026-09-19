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
  (accordion por quadra, tabs de dia, ranges de 30min; dialog `Adicionar
  Horário` cria o range em MÚLTIPLOS dias de uma vez via chips de dia
  avulsos + chip `Todos` na MESMA fileira, que seleciona/desmarca todos os
  dias; presets compostos `Seg+Qua+Sex`/`Ter+Qui` extintos 16/09,
  IBX-0047; edição
  substitui em place e overlap é validado em todos os caminhos via lib pura
  compartilhada `src/lib/courts/court-availability.ts` (`applyCourtRange`),
  BUG-0032/IBX-0050); as rotas
  `settings/leagues/[mode]/courts.tsx` e
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
  **Header no loading (IBX-0060):** mesmo comportamento da liga — enquanto
  `getById`/`viewer.context.get` carregam, o fallback global `FormFallback`
  (`src/components/ui/form-fallback.tsx`) mantém back +
  `Page.Header.SubTitle` ("Criar Torneio"/"Editar Torneio") +
  `Page.Header.Title` da tab ativa (label de `useSegments` contra
  `TOURNAMENT_FORM_TAB_ITEMS`, default "Detalhes") com o loading só na área
  de conteúdo; erro/inválido/sem-permissão mantêm o header de título único.
- **`[mode]/index.tsx`** (Detalhes) — capa/avatar (padrão de mídia), nome,
  descrição, DatePicker de início + prazo (mínimo hoje; prazo com
  `maxValue` = véspera do início — QA round 7: dia do início e posteriores
  barrados no calendário). **Mídia sem overlay (IBX-0064):** banner e avatar
  SEM overlay escuro com texto — o toque abre o dialog de confirmação
  "Quer alterar o banner?"/"Quer alterar o avatar?" (`MediaConfirmDialog`
  global em `src/components/ui/media-confirm-dialog.tsx`, molde dos dialogs
  Sair/Deletar liga; 1 dialog por tela com alvo dinâmico) e o CONFIRMAR
  chama o fluxo de troca de hoje (`onMediaPress` → picker/crop/upload);
  `PressableFeedback` desabilitado durante o upload (`isMediaUploading`).
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
  shouldFetchMatches/tabItems). `reset()` zera o bucket e **INCREMENTA**
  `identity.resetVersion` (versão monotônica, nunca um binário 0/1 que volta
  ao mesmo valor): é essa mudança que o efeito de hidratação do layout
  observa para re-hidratar (BUG-0033 — um reset invisível deixava o bucket
  vazio ao voltar para um torneio já visitado).
- **Tipagem das entries** — direto pelo `TournamentEntryWithPlayers` do
  contrato (`tournamentEntryWithPlayersSchema`, com
  `playerA/playerB: TournamentPlayerCard` de 5 campos — alinhado ao
  `serializePlayerCard` em 22-08).
- **`_layout.tsx`** — `tournamentId` vem de `useLocalSearchParams` (params
  da PRÓPRIA rota; nunca `useGlobalSearchParams` aqui, que segue a rota
  focada e fazia um detalhe empilhado trocar de bucket no meio da pilha);
  hidratação destravada pelo `reset()` do bucket (discovery sempre; matches
  gated por `shouldFetchMatches`; entries sempre), Tabs+FloatingTabBar com
  ícones e `resolveValueFromRouteName` (index→overview; QA round 6).
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
  overlay fora do transform): **Sortear chave** (`published`), **Re-sortear**
  (`drawn`, IBX-0037/re-draw do backend; com
  confronto agendado abre **diálogo de confirmação** de destruição, molde do
  cancelamento do torneio — apaga data, horário e quadra) e
  **Iniciar torneio** (`drawn`, com **diálogo de confirmação** — título
  "Iniciar torneio?", corpo avisando que a chave será publicada e o torneio
  começa, botões Cancelar/Iniciar torneio no molde dos dialogs de
  confirmação do repo), mutações `bracket.draw`/`bracket.start` com
  toasts e `invalidateTournamentContext`; menu some quando não há ação
  aplicável; organizador-only (guest não vê nada disso). **O item
  "Confirmados" (ex-"Cabeças de chave") SAIU em 16-09**: sem os controles de
  seed/fase a lista de inscrições deixou de ser caminho de posicionamento — o
  organizador ajusta no próprio canvas e re-sorteia.
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
  REBUILD PLN-0002; o canvas vivo é
  `src/components/pages/tournaments/bracket-canvas.tsx`.
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
  B).
  Troca de tab de categoria: `key={tree.id}` REMONTA o canvas → fit roda
  de novo por categoria (não herda viewport da anterior).
  Interação: toque curto nos cards abre dialogs/swap; posição é estrutural
  (sem drag; a ação explícita de rearranjo é o swap A/B); arrasto de 1 dedo
  = pan (ativa após 12pt, `maxPointers(1)`); pinça de 2 dedos com
  `manualActivation` ancorada no foco; double-tap alterna fit↔nativo. Taps
  dos cards preservados: o tap falha no movimento do pan e o pan precisa de
  12pt — exclusão por limiar, sem veto de composição.
  Alturas variáveis medidas por `onLayout` do card (fallback
  `BRACKET_CARD_ESTIMATED_HEIGHT` = **120**). Três grandezas distintas, para não
  misturar origem: (a) **medição de device** (`onLayout`, é o que o CÓDIGO usa):
  120 na 1ª rodada e 112 nas rodadas fundas — o 112 é medição de device, não
  leitura de print: as sondas dev do run do usuário (HEIGHT-MISMATCH,
  dev/Metro) registraram `measured` = 112, 112,00000762939453 e 120, todos
  valores de `onLayout`; (b) **leitura da imagem do print**:
  ~120,4 (estimativa de pixel, não medição); (c) a **estimativa** do layout =
  120 (o valor de device da 1ª rodada, a que define a altura do grafo). Com 120 a
  malha estimada fecha a assentada (5x52 + 3x120 + 7x12 = 704, o H medido) e o
  reflow residual é <= 4pt por card nas rodadas fundas; com 120,4 a caixa NÃO
  fecha (1120 x 705,2) e o resíduo vai a 4,9pt. **O fit não muda de qualquer
  forma, porque é limitado pela LARGURA** (largura 365/1696 = 0,215212; altura
  1016/4212 = 0,241216). Resumo exato:
  **sem re-fit (fit limitado pela largura) e com reflow residual <= 4pt nas
  rodadas fundas**. O 136 anterior era suposição (nunca medida) e fazia o grafo
  inteiro pular ~8pt ao assentar — era a "piscada" da 1ª
  abertura; o teste de estabilidade do primeiro layout em `bracket-tree.test.ts`
  fixa a malha estimada == a assentada e traz a contraprova com o 136 antigo.
  o commit da medida é
  `commitCardHeight` (bracket-tree.ts), puro/testado: uma medida igual à
  altura EFETIVA não entra no state (a montagem da 64-key commita ZERO
  vezes, lição IBX-0022), mas a comparação é com a altura efetiva e NUNCA
  com a constante. **BUG-0033, defeito (i) — ÂNCORA DO CARD (chave grande):
  causa raiz era o guard do IBX-0022 comparando com a constante** — um card
  commitado em 154 (linha de agendamento no card) que volta a medir 136 tinha a
  medida DESCARTADA: o retângulo do layout ficava
  congelado 9pt acima do centro do card (âncora do conector = y + h/2) e
  nunca re-alinhava. Medição no harness puro do pipeline (chave de 64,
  viewport 413x1064 → fit 0.2151, o mesmo fit documentado): 1 card a cada 4
  congelado já dá âncora 9pt fora (média 2,25pt), vãos da coluna variando
  12→30pt (design 12) e a coluna 1 driftando até 144pt no fim. O pipeline em
  si é exato (âncora == centro do retângulo, delta 0,00): o erro só existe
  quando o retângulo do layout ≠ altura renderizada do card. O QUE ESTE FIX
  RESOLVE: o retângulo do layout voltar a acompanhar a altura medida (o conector
  volta ao eixo quando o card muda de altura). **Isto é o defeito (i) do
  BUG-0033 — dois defeitos diferentes viveram sob o mesmo ID: o (ii), a camada
  de conectores TRANSLADADA em toda montagem depois da 1ª (a view 0x0 pintando
  antes do transform), está no bloco do defeito (ii) logo abaixo ("CAMADA DE
  CONECTORES TRANSLADADA"); a geometria/medição do pipeline sempre estiveram
  certas nos dois.**
  Traço: 1.5pt de
  GRAFO constante (estágio C) → no fit da 64 = 0,323pt = 0,97 pixel físico
  @3x (sub-pixel; o da chave 8 = 1,97px).

  **BUG-0033, defeito (ii) — CAMADA DE CONECTORES TRANSLADADA (16/09, CAUSA
  PROVADA E CURA)**: é o segundo defeito sob o mesmo ID (o (i), a âncora do card
  por altura de layout, está no bloco "Alturas variáveis medidas por `onLayout`"
  acima e o fix de lá resolve o retângulo/âncora; este resolve o PIXEL da
  camada). A chave pintava os conectores fora do eixo em qualquer montagem
  DEPOIS da primeira. Evidência medida (2
  prints do repro, mesma tela e mesma chave): os 15 retângulos de card
  idênticos ao pixel (8+4+2+1), o mesmo fit (z=0,35) e a camada de conectores
  inteira TRANSLADADA (+195,8pt, +173,7pt) de tela = (+559,5, +496,2) pt de
  grafo, com o mesmo pitch, os mesmos 42 parts (14 links) e sem 2ª instância.
  Com instrumentação de PINTURA (marcador por instância e `measureInWindow` do
  container e da primeira barra) ficou provado o divórcio MEDIÇÃO x PIXEL: a
  medição sempre deu o lugar certo (barra = `graph*0,35 + fit`), a superfície
  pintada é que não correspondia — a camada dos conectores era a ÚNICA coisa
  desenhada dentro de uma view 0x0 (layer degenerado), enquanto os cards (que
  sempre pintaram certo) são filhos DIRETOS do container transformado.
  **Cura estrutural**: os conectores passaram a ser filhas DIRETAS do
  `Animated.View` (mesma natureza dos cards), cada barra com
  `pointerEvents="none"`, ordem de pintura preservada (conectores antes dos
  cards: pontas sob a borda do card). Geometria, fit, gestos e UX intactos.
  Reportado pelo usuário como resolvido na build da remoção (2ª, 3ª e 4ª
  entradas corretas) e revalidado na árvore seguinte.
  **Os dois flashes da entrada (16/09, depois da cura)**: (a) a TROCA DE ABA e
  a re-entrada piscavam porque a rota REMONTAVA o canvas por foco
  (`key tree.id:bracketFocusSeed`): a key passou a ser só a CATEGORIA e o seed
  vai como prop `focusSeed`; o `useLayoutEffect` do re-enquadramento o tem nas
  deps e a re-entrada re-enquadra a MESMA instância (sem re-medir, sem
  reconstruir); troca de categoria continua remontando de propósito (fit por
  árvore). (b) a PRIMEIRA abertura (entrar no torneio e abrir o Chaveamento)
  tinha dois saltos: o conteúdo era pintado no primeiro frame NATIVO ainda em
  identidade (translate 0, zoom 1) até o transform do fit chegar à UI thread.
  Fix ESTRUTURAL: o conteúdo vive num componente FILHO (`FramedBracketContent`)
  montado só quando o fit existe — `useSharedValue` só aceita valor inicial na
  PRIMEIRA renderização, e o pai (o medidor) ainda não conhece o fit nesse
  momento, então um seed condicional lá nascia em identidade (foi tentado e era
  ineficaz por construção); o filho nasce com o fit e o primeiro frame nativo
  já sai enquadrado. O estado inicial e o re-enquadramento (no foco) saem da
  MESMA `bracketFitTransform` (bracket-tree.ts, testada). O segundo salto: a
  malha provisória era montada com a estimativa 136 (nunca medida) e
  assentava em 112/120, re-layoutando o grafo inteiro (H 752 -> 704): a
  estimativa passou a ser 120 (medição de device do card da 1ª rodada): sem
  re-fit (o fit é limitado pela largura) e com reflow residual <= 4pt por card
  nas rodadas fundas (112 vs 120, imperceptível). O
  teste de estabilidade do primeiro layout em `bracket-tree.test.ts` fixa isso,
  com a contraprova do 136 antigo. A instrumentação de diagnóstico do canvas e
  da rota (sondas de log, marcadores de instância) foi REMOVIDA com o card.

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
  empilha 2; **lado vazio "A definir": avatar de fallback PRETO
  (`fallback black`, `src/components/core/image.tsx`) e rótulo muted** — o
  lado com inscrição segue o fallback azul e o rótulo default, vencedor em
  accent/semibold), placar por set, campeão na final; **linha de agendamento
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
  toque no jogador a trocar → `swapSlots` — troca EXATAMENTE as duas
  inscrições clicadas, jogador por jogador, sem mover
  os confrontos) enquanto sem placar — **generalizado pra MESMA rodada em
  qualquer rodada (IBX-0035: entradas diretas ocupam lados na rodada 2+
  já no sorteio)**; **modelo PURO da seleção em `lib/tournaments/
  bracket-view.ts` (IBX-0053, movido pra tela: o card só apresenta o que a
  tela decidiu, `swapPickEnabled`)** — `canSwapMatch` = LINHA que pode
  participar de um ajuste (sem placar, não-finalizada, não-vacant; o
  `winnerEntryId` da LINHA não trava nada: o vencedor de um bye é decisão do
  draw, não resultado), `swapSideIsLocked` = vaga TRAVADA por LADO (o lado é
  a vitória PROPAGADA da partida filha e essa decisão é resultado publicado;
  `status === "finished"` é o marcador que o wire carrega, `publishedAt` fica
  no backend), `canReceiveSwapSide` = card que pode RECEBER o lado selecionado
  (sem resultado publicado), `canPickSwapSecond` = janela da segunda
  coordenada (cross-categoria nunca; MESMA rodada em `drawn|ongoing`;
  OUTRA rodada SÓ em `drawn`) e `resolveSwapSelection` = desfecho do toque
  (`arm` | `clear` na mesma coordenada | `restart` no alvo fora da janela
  | `swap` com as duas coordenadas). O destino é uma COORDENADA (rodada,
  slot, lado) e não um card: lado "A definir" de partida viva e linha
  vacant são destinos legítimos (decisão do Maestro 16/09; o backend tem a
  palavra final e o erro dele chega no toast). **Move cross-rodada
  (IBX-0053) — BACKEND E FLIP DO CANVAS ENTREGUES 16-09 (schema + codegen
  + call site)**: o contrato em vigor é
  `swapBracketSlots { categoryId, tournamentId, roundA, slotA, sideA, roundB,
  slotB, sideB }` (mesma key `tournament.bracket.swapSlots`, mesma-rodada =
  `roundA === roundB` no MESMO call site: `handleSidePress` resolve pelo
  modelo e manda uma coordenada por lado). O `round` único morreu: o schema
  antigo descartava `roundA/roundB` e caía no default 1 — um payload do
  shape novo trocaria slots da RODADA 1 em silêncio, motivo pelo qual o
  schema novo saiu ANTES do flip. Com uma coordenada armada o card vira
  DESTINO (`canReceiveSwapSide` + `canPickSwapSecond`); o card armado segue
  tocável para o toque na MESMA coordenada limpar a seleção. Destino vazio
  esvazia a origem, destino ocupado transpõe — semântica do servidor.
  **Recusas do servidor que o canvas já NÃO oferece** (alinhadas 16-09 no
  gating por lado/feed): lado vazio como origem e destino vazio com FEED VIVO
  (só rodada 1 ou filha PODADA aceitam
  uma inscrição — `canReceiveSwapSide` recebe `feed: BracketFeed | null` por
  lado: null na 1ª rodada, `{ status, winnerEntryId }` da partida filha nas
  demais). **BUG-0034 (16-09): vaga
  derivada do BYE deixou de ser recusa no servidor em `drawn`** (o move
  desce até a posição e re-deriva o bye/avanço) e o canvas foi ALINHADO ao
  domínio: `swapSideIsLocked` trava só a vaga cuja vitória propagada vem de
  RESULTADO PUBLICADO, e a linha de bye (`walkover`, sem resultado) volta a
  ser origem e destino — o usuário viu a seta num lado que o servidor
  recusava porque o gating antigo olhava o `winnerEntryId` da LINHA, não a
  procedência do LADO. O texto da recusa deixou de morrer no genérico: o
  toast lê a mensagem do `CRPCError` que viaja no payload do `ConvexError`
  (`lib/errors/toast-message.ts`). Residuais que dependem da
  cadeia de propagação (o canvas não modela) e ficam por conta do servidor,
  com o toast explicando: "Esse ajuste moveria um vencedor para uma vaga já
  ocupada" — caso concreto (Forja 16-09): COMPLETAR os DOIS lados de uma
  linha podada cujo vencedor cairia numa vaga já ocupada pela entrada direta
  é recusado; preencher UM lado só segue válido (a linha fica "A definir") —
  e "A rodada seguinte já tem resultado publicado: o vencedor não pode
  mudar".
  **Gating POR LADO (`resolveSwapPickSides`, IBX-0053)**: sem coordenada
  armada os lados são ORIGEM e só o lado PREENCHIDO arma (`entryAId/
  entryBId !== null` — lado vazio é recusado pelo servidor: "Escolha uma
  posição preenchida para trocar"), então um card com um lado "A definir"
  mostra a seta apenas no lado que existe; com uma coordenada armada os
  lados são DESTINO (lado vazio só com feed morto) e o card da própria
  origem continua tocável para o toque na mesma coordenada limpar a
  seleção.
  **linhas VACANT (IBX-0035)**:
  subárvores podadas de
  cabeças de chave chegam com `status "vacant"` — card mantém a fase e os
  lados "A definir", SEM chip de status, SEM kebab (`canAct` exige dois
  lados); não entram em agenda (nunca têm `matchDate`) nem em
  placar (mas ACEITAM ser destino do move cross-rodada). Jogador em
  `published/drawn` vê
  placeholder "Chave disponível a partir de {data}".
  **card de BYE — vaga derivada do sorteio (16-09, decisão do usuário)**:
  a linha que nasce com um lado só e o vencedor já resolvido (o bye da 1ª
  rodada) desenha um card COMPLETAMENTE VAZIO. Predicado puro
  `isByeMatch(match) = status === "walkover"`
  (`lib/tournaments/bracket-view`): o discriminador é o STATUS —
  `walkover: true` sozinho não serve, porque o W.O. JOGADO de verdade
  (organizador declara vencedor sem placar) é gravado como `finished` com
  `walkover: true` (`publishResult`) e mantém o card normal (fase + chip +
  lados). O card de bye continua NA GEOMETRIA (âncora, links e
  `feedStatusBySlot` intactos — nada muda em bracket-tree/bracket-edges/swap),
  mas o ramo cedo do `BracketMatchCard` devolve o container do card SEM
  FILHOS: nenhuma fase, nenhum chip (nem "W.O.", nem "A definir"), nenhum
  lado fantasma, nenhuma seta e nenhuma identidade (o nome/avatar do lado que
  avançou não aparece no card). Altura FIXA `BRACKET_BYE_CARD_HEIGHT`
  (bracket-tree.ts), aplicada pelo próprio card no root: o retângulo do grafo
  casa com o render por construção e a medida nunca commita (a rota sai cedo
  no `onHeightChange` do bye), sem o churn de re-layout que o BUG-0033
  fechou; o `cardHeightOf` da rota escolhe a constante do bye em vez da
  estimativa (120).
- **`entries.tsx`** (Inscrições) — tabs segmentadas Confirmados|Pendências
  (Confirmados é a PRIMEIRA aba e a de entrada: sem `initialTab` a tela abre
  nela), no molde challenges.tsx (QA round 7; pendências = `pending_approval` /
  `pending_partner` / `awaiting_payment`, confirmados = `active`; empty
  state por tab por papel no tom da liga; dica de seeds no fim da lista
  EXTINTA — IBX-0036);
  CARDS NO MOLDE DE SOLICITAÇÕES da liga (QA round 9, molde inline
  `requests.tsx:178-232`, sem componente extraído): `Card p-3` com row
  avatar (dupla empilha 2 no estilo ScheduleCard) + nome
  (`formatEntrySideLabel`) + sub (categoria; nota de convite quando
  `pending_partner`) + trailing por estado — aprovação do organizador e
  convite do parceiro = par icon-only `outline Cancel01Icon` / `default
  Tick02Icon` idêntico ao da liga; **CONTROLES DE SEED E DE FASE REMOVIDOS
  (cutover IBX-0053, 16-09, decisão do usuário)**: a aba Confirmados não tem
  mais o botão "Marcar seed"/"Seed #N" nem o picker de fase de entrada
  (`setSeed`/`setEntryRound` saíram da tela, junto com as derivadas
  `buildEntryRoundOptions`/`formatEntryRoundLabel`/`isEntryRoundSelectable`)
  — com o MOVE nativo do chaveamento o organizador re-sorteia e arruma a
  posição no próprio canvas, então editar seed/fase por aqui era redundante e
  era a origem do dado que TRAVAVA o re-sorteio (uma linha em rodada ≥ 2 sem
  seed deixa a chave da categoria sem sorteio: "Avanço de fase é exclusivo de
  cabeças de chave."). O contrato e as procedures (`seedRank`,
  `entryRound`, `setSeed`, `setEntryRound`, `validateEntryRounds`) SEGUEM no
  domínio; sem UI, o único consumidor das linhas `vacant`/bye re-deriváveis
  passa a ser o sorteio/move. Trailing por estado: chip de status. A rota abre
  em Confirmados (o param `?initialTab=pending` abre a outra aba).
  Lista `Page.ScrollView` +
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
  `src/components/ui/rules-grid.tsx` (5 itens: Formato, Set, Pontuação,
  Duração, Tie-break — `rules.tsx:73-78`; o item "Decisão" saiu no
  DEC-0004); view derivada por
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
  `src/lib/matches/score-draft.ts` (29 testes). No torneio: payload
  `{matchId, score, walkover}` com `winnerEntryId` nullish (explícito só
  quando as linhas empatam ou em W.O.; null quando o placar decide e o
  backend deriva); corpo scrollável com `ScrollShadow` + `maxHeight =
  min(450, metade da janela)` e `isSwipeable={false}` (o drag-to-dismiss
  brigaria com o scroll; fixos: título, Adicionar + X, rodapé com Salvar);
  o antigo `tournament-result-dialog.tsx` foi EXTINTO
  (grep 0). Detalhes do fluxo na spec da liga (mesmo componente global).
- **BUG-0026 (15-09, DEC-0005 opção A) — botão "Tie-break" CONTEXTUAL:** no
  dialog global de resultado, o botão dentro da linha de placar só aparece
  com o placar daquela linha empatado e além do 0x0 (`canAttachTieBreak`
  em `src/lib/matches/score-draft.ts`); entrada/saída do botão com wrapper
  animado no molde rule-card (FadeIn/FadeOut + AccordionLayoutTransition).
  Menu e linha avulsa seguem livres em qualquer estado (RUL-0019 intacta).
  Detalhes na spec da liga (mesmo componente global).
- **BUG-0035/IBX-0055 (16-09) — tie-break anexado DISSOLVE quando o set
  desempata:** no dialog global de resultado, o update da linha passa pelo
  `settleAttachedTieBreak` (`src/lib/matches/score-draft.ts`) — o placar
  de games mudou e ficou inelegível (desempatado ou 0x0), o mini-placar
  anexo sai sozinho; mudou e segue empatado (4x4 → 5x5), mantém; edição
  só dos pontos do próprio TB, mantém. Vale liga e torneio (mesmo
  componente global, RUL-0005), inclusive editando resultado já
  publicado. Detalhes na spec da liga.
- **Agendar/Reagendar confronto (IBX-0030, RUL-0005)** — o torneio REUSA
  o dialog global da liga `ChallengeProposalDialog`
  (`components/pages/leagues/challenge-proposal-dialog.tsx`) com
  description adaptada ("A contra B."), `occupiedSlots` reais do torneio
  (BUG-0027/IBX-0043, bullet abaixo) e payload
  `{matchId, courtId, endMinute, matchDate, startMinute}` — o paralelo
  `tournament-schedule-dialog.tsx` foi EXTINTO (o modelo do torneio não
  tem duração visível; endMinute segue exigido pelo contrato
  `ScheduleTournamentMatchSchema` e é computado do
  `defaultDurationMinutes`).
- **Conflito de quadra no agendamento derivado no servidor (BUG-0027/IBX-0043)** —
  `tournament.matches.scheduleMatch` recusa agendamento/reagendamento com
  sobreposição na MESMA quadra+data (`BAD_REQUEST` "Esse horário já está
  reservado para outro confronto."), com a janela ocupada
  `[start, start + defaultDurationMinutes)` derivada das regras do torneio
  (`tournament.matchConfig`) dos DOIS lados (`findCourtSlotConflict` em
  `convex/domains/tournament/scheduling-rules.ts`; janela half-open, encostar
  não conflita; walkover ocupa a quadra; o confronto reagendado ignora a si
  mesmo). O `endMinute` gravado passa a ser o derivado da regra, não o do
  cliente. Contrato para a UI: `tournament.matches.listOccupiedSlots({
  tournamentId })` devolve `{matchId, courtId, matchDate, startMinute,
  endMinute}` de todo confronto agendado, com o MESMO gate do
  `listForTournament` (chave privada até começar). UI ENTREGUE (Frontend):
  o `bracket.tsx` busca `listOccupiedSlots` (query `enabled` só pro
  organizador, mesma audiência do dialog), renomeia `matchId` para o
  `slotId` NEUTRO e passa ao `ChallengeProposalDialog` com
  `slotIdToIgnore={scheduleTarget.id}` (o confronto em edição não bloqueia
  o próprio horário); o sucesso do agendamento invalida a query em
  `invalidateTournamentContext` e o erro do servidor segue virando toast
  com a mensagem do backend (`getToastErrorMessage`). O slot virou
  contrato neutro no par `src/lib/leagues/challenge-schedule.ts` + dialog
  (RUL-0005: cada domínio adapta na fronteira, liga renomeia
  `challengeId`, torneio `matchId`; +1 teste do vocabulário do torneio).
  Modelo DAY-SCOPED consciente (decisão registrada no review): a janela
  ocupa só o dia D (23:30 + 90min NÃO conflita com 00:15 do D+1), sem
  conflito na virada do dia. O torneio também NÃO valida a janela de
  disponibilidade da quadra no servidor (comportamento pré-existente;
  candidato a follow-up).
- **Swap zera a agenda do par antigo (BUG-0028/IBX-0046)** — trocar jogador
  de slot (`swapSlots`) mata o agendamento dos DOIS slots afetados: o
  persist (`convex/functions/tournament/bracket.ts`) grava `courtId`,
  `matchDate`, `startMinute` e `endMinute` como `null` junto com as
  entradas, e `deriveSwapMatchStatus`
  (`convex/domains/tournament/bracket-rules.ts`) NÃO deriva mais `scheduled`
  de `hasMatchDate` (mesmo princípio do re-sorteio: a agenda morre com a
  dupla) — o status volta a `pending`, preservando apenas resultado
  publicado, `vacant` e bye (`walkover`). Testes atualizados em
  `bracket-rules.test.ts` (`deriveSwapMatchStatus`,
  `buildSwapPersistPlan`).
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
  REMOVIDOS do schema compartilhado** — o gatilho do tie-break acompanha os
  games do set. E os pontos de TB (`tieBreakPoints` e, então, também os
  campos do último set) passaram a exigir ∈ {7, 10}
  (`SUPPORTED_TIE_BREAK_POINTS` + `getTieBreakPointsValidationError` no
  mesmo superRefine do bestOf; mensagem "Escolha 7 ou 10 pontos no
  tie-break.") — os campos do último set saíram no DEC-0004, restando só
  `tieBreakPoints`.
  Racional: padrões oficiais do tênis — set TB a 7, super TB a 10, win-by-2
  sempre; nada de mínimo livre. Auditoria dev+prod antes de cada tighten:
  TODOS os docs (1 liga dev/prod, 31 snapshots, 1 torneio) já 6/7/10 —
  derivação e refine neutros (super TB vivo = 10 em 100% dos docs). Docs
  antigos com a chave extra: Zod stripa (testado) e o `.catch` da liga NÃO
  dispara. Sem migration. Deployado dev+prod em 22-08. UI do form ENTREGUE
  no mesmo round (campo de placar do TB removido, segmentos 7|10 — ver
  leagues.md, "Match config compartilhado").
- **DEC-0004 (15-09, opção A): grupo do último set REMOVIDO do
  `LeagueMatchConfigSchema`** — vale liga e torneio (fonte única na liga);
  último set = formato dos demais sets; super TB segue coberto por
  `tieBreakPoints` 7|10 e pelo placar LIVRE do resultado (RUL-0019; `kind`
  `super_tiebreak` permanece no schema de set). Zod stripa as chaves
  `finalSet*` de configs salvos na leitura (coluna `json` mantém o blob —
  sem migration; testes "legado (DEC-0004)" em
  `league/tests/contract.test.ts` e no create do torneio). UI: seção
  `final-set-section.tsx` extinta e item "Decisão" fora da tela /rules.
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
  `validateSlotSwap`/`applySlotSwap` (**IBX-0053: leem o BOARD da categoria
  inteira — todas as rodadas — em DUAS coordenadas `(round, slotInRound,
  side)`**; placar publicado trava as duas partidas afetadas; lado vazio não é
  origem; **vaga derivada** (lado ocupado por vitória propagada de confronto
  já decidido) é resolvida até a POSIÇÃO que segura a inscrição
  (`resolveMoveCoordinate`, **BUG-0034**): vinda de um bye do sorteio ela é
  re-derivável e o move passa — o bye e o avanço são re-derivados; vinda de
  resultado PUBLICADO (partida jogada) a vaga segue recusada como origem e
  como destino; destino vazio esvazia a
  origem e só é aceito com feed morto (rodada 1 ou linha podada; o lado que
  espera um vencedor vivo é recusado); destino ocupado transpõe as duas
  entradas — nada sai da chave; `deriveSwapMatchStatus` só re-deriva walkover
  na linha que JÁ era bye do sorteio (qualquer outro lado sozinho é `pending`
  "A definir" — o move não dá W.O. a ninguém); `writeSwapFeed` empurra para a
  rodada seguinte o vencedor de um bye re-derivado e RETIRA o propagado quando
  a vaga decidida esvazia, recusando escrever sobre posição alheia, sobre
  rodada com `publishedAt` ou tornar jogável (2 lados) uma linha podada cujo
  vencedor cairia numa vaga ocupada), `validateSwapWindow` (cross-round só em `drawn`),
  `buildSwapPersistPlan` (linhas reescritas + entradas afetadas para a
  notificação; o move descendido persiste a POSIÇÃO permutada e a linha
  clicada entra como alimentada, com bump de `rowVersion`), `validateBracketStartable`
  (gate do `start`, vaga de rodada 1 incluída) e `nextMatchCoordinates`.
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
  status→drawn), `swapSlots` (**IBX-0053: move cross-round** — o input são
  duas coordenadas; valida janela/lado vazio e resolve a vaga derivada até a
  posição (BUG-0034: bye re-derivável passa, resultado publicado recusa),
  aplica o plano de
  persistência (permutação + status re-derivado + vaga alimentada/retirada),
  zera a agenda de TODA partida reescrita (BUG-0028) e notifica
  `tournament.match.reassigned` aos dois lados clicados e a quem perdeu a vaga
  retirada), `start` (drawn→ongoing; **gate novo: recusa iniciar com vaga "A
  definir" sem alimentação** — fecha o buraco que o move abre ao preencher uma
  linha podada; `tournament.bracket.published` a todos), `listBracket`
  (organizador).
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
  de 64 → rodada 3; de 128 → rodada 4). O rótulo do CARD da chave sai de
  `formatBracketStage(round, totalRounds)`; o picker de fase que oferecia essas
  rodadas na tela de Inscrições foi REMOVIDO no cutover do IBX-0053 (16/09)
  (com ele saíram `buildEntryRoundOptions`/`formatEntryRoundLabel`).
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
`tournamentEntrySchema.entryRound`;
**`SwapBracketSlotsSchema { categoryId, tournamentId, roundA, slotA, sideA,
roundB, slotB, sideB }` — IBX-0053, duas coordenadas explícitas, `round` único
EXTINTO (cutover limpo: o caller é só o canvas)**; `tournamentMatchSchema.status`
ganha **`vacant`**. Key do client MANTÉM `tournament.bracket.swapSlots` (muda só
o input); mesma-rodada = `roundA === roundB` no MESMO call site; retorno segue
`{ success: true }`.
- **Move de posição cross-round (IBX-0053, 16-09)** — `swapSlots` aceita duas
coordenadas de rodadas diferentes: `move(from → to)` PERMUTA os valores dos dois
lados. Destino vazio ⇒ a origem esvazia; destino ocupado ⇒ transposição entre
rodadas (a entrada deslocada vai para a vaga da origem — nunca descartada).
Lado vazio não é origem. **Vaga derivada (BUG-0034, 16-09)**: lado cujo ocupante
é vitória propagada do confronto de baixo — o card das QUARTAS de quem recebeu
bye, por exemplo — é resolvido até a POSIÇÃO que segura a inscrição
(`resolveMoveCoordinate` desce a corrente de alimentação) e o move permuta as
duas INSCRIÇÕES, persistindo o bye e o avanço RE-DERIVADOS. Em `drawn` (nada
publicado, nada jogado) os byes do sorteio são re-deriváveis, então mover o lado
das quartas vindo de bye PASSA; a recusa
(`Essa vaga vem de um confronto já decidido e não pode ser ajustada.`) fica SÓ
para a vaga cujo vencedor veio de resultado PUBLICADO — partida jogada
(`hasPublishedResult` no confronto de baixo), que não é re-derivável; o texto e
o `BAD_REQUEST` seguem iguais. **Janela: cross-round SÓ em `drawn`**
(mesma-rodada segue `drawn|ongoing`); a
agenda das partidas reescritas é zerada (BUG-0028); o vencedor propagado é
retirado da rodada seguinte quando ela não tem `publishedAt`; o move NUNCA
inventa bye nem entrega W.O. de graça (**correção da auditoria de 16-09**) —
só uma linha que JÁ era o bye do sorteio segue walkover com o sobrevivente
(o cabeça que sai dela leva o bye junto, e é re-derivável); qualquer outra
linha com um lado sozinho vira `pending` "A definir", o adversário NÃO avança
e o avanço automático anterior é retirado. **Destino vazio** só é aceito quando
nada pode aterrissar ali primeiro: rodada 1 (sem feed) ou lado alimentado por
uma linha PODADA (`vacant`) — o lado de uma partida viva que ainda espera o
vencedor de baixo é recusado (ao publicar, a propagação escreveria por cima e a
inscrição sumiria da chave). **Completar uma linha podada** (dar o SEGUNDO lado
a um confronto que a subárvore podada deixou morto) também é recusado quando o
vencedor dele cairia numa vaga já OCUPADA (a entrada direta que causou a poda):
preencher UM lado segue permitido e a linha fica "A definir", mas torná-la
jogável perderia a inscrição de cima na publicação — mesma raiz do caso
anterior, porta diferente. Erros `BAD_REQUEST` com mensagem específica.
**Gate do `start`** (mesma entrega): iniciar com vaga "A definir" que nenhuma
partida pode alimentar é recusado (`A chave tem uma vaga em aberto (rodada N)…`)
— vale para a vaga de rodada 2+ com subárvore podada E para a linha de RODADA 1
esvaziada pelo move (rodada 1 não tem feed: um lado sozinho ali nunca mais é
preenchido), porque `publishResult` exige dois lados.
**Posse da categoria (review C1,
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
- **Delta de contrato proposto (IBX-0044, NÃO implementado)**: o
`setEntryRound` posiciona a entrada direta no side-slot PADRÃO do seed na
rodada (`slotOfSeed` projetado na árvore); a escolha do slot ESPECÍFICO (semi
A vs B) só existe pós-sorteio, via `swapSlots` de mesma rodada. Proposta: o
schema ganhar slot/side explícito (ex. `slotInRound` + `side`) para o
`buildBracket` posicionar a entrada no side-slot exato já no (re-)sorteio —
exige `validateEntryRounds` estendido (disjuntividade avaliada por slot
exato). Decisão e implementação são do Backend.
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
  `DEFAULT_LEAGUE_MATCH_CONFIG`: melhor de 3 sets, 6 games, tie-break a
  6-6 — sem grupo de último set desde o DEC-0004: último set = formato dos
  demais sets).
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
  Sorteio é aleatório por padrão. Desde o cutover do IBX-0053 (16/09) a UI
  não edita seed nem fase de entrada (`seedRank`/`entryRound` seguem no
  contrato e valem no sorteio, sem tela — ver Inscrições).
- `drawn` (preparação): chave sorteada, inscritos fechados. A chave é
  PRIVADA do organizador — ele ajusta (troca de slots, ver abaixo) **ou
  re-sortea** (`draw` aceita `drawn` desde o IBX-0037, após ajustar as
  posições no canvas) na
  janela entre o sorteio e o início (ex.: inscrições até 22, torneio
  dia 25 — ajustes de 22 a 25). Jogadores veem placeholder
  "chave disponível a partir de {startDate}". Sem cron: o organizador
  toca **iniciar** (dia 25, com diálogo de confirmação na tela do
  chaveamento) e a chave vira pública.
- **Ajuste manual da chave (pós-sorteio)**: o organizador move a POSIÇÃO de
  uma inscrição tocando o lado de origem e depois o lado de destino (a
  coordenada é rodada + slot + lado). **Estado real (IBX-0053, 16-09)**: o
  move é CROSS-ROUND em `drawn` (a MESMA rodada segue valendo também em
  `ongoing`); o destino vazio esvazia a origem e o destino ocupado transpõe as
  duas inscrições. A vaga cuja vitória foi PROPAGADA do confronto de baixo —
  o card das quartas de quem recebeu bye, por exemplo — é MOVÍVEL: o move
  desce a corrente de alimentação até a posição que segura a inscrição,
  permuta as duas inscrições e persiste o bye e o avanço RE-DERIVADOS. A
  recusa fica só para a vaga decidida por RESULTADO PUBLICADO (partida jogada
  não é re-derivável) e para confronto com placar publicado; lado vazio só
  recebe inscrição com feed morto. UI: toque no jogador → toque no jogador a
  trocar → move exato (BUG-0010; antes o backend trocava sempre o lado A —
  por isso "trocava o outro"). Sem drag na v1.
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
  fechar inscrições + sortear, lançar placares.

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
- **Sorteio aleatório com seeds opcionais** — byes priorizados para os
  cabeças de chave (22-08, usuário). A marcação de seed pela UI saiu no
  cutover do IBX-0053 (16/09): `seedRank` continua no contrato e vale no
  sorteio, sem tela.
- **Parceiro por username** — exige habilitar username no app antes do
  convite de dupla (22-08, usuário).
- **Misto exige gênero definido** nos dois perfis (consequência do modelo).
- **Ajuste manual da chave pós-sorteio** — organizador troca exatamente as
  DUAS inscrições clicadas entre dois confrontos (incluindo byes) enquanto as
  partidas afetadas não têm resultado publicado (22-08, usuário;
  BUG-0010: lados clicados vão ao `swapSlots` — antes trocava sempre o
  lado A). **Superado pelo IBX-0053 (16-09): o move é cross-round em `drawn`
  e a vaga com vitória propagada de bye também é movível** (ver "Ajuste
  manual da chave (pós-sorteio)" no Lifecycle).
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
  "formato próprio desta categoria" na UI. **DEC-0004 (15-09, opção A): o
  grupo do último set saiu do formato (liga e torneio)** —
  `finalSetMode`/`finalSet*` extintos, último set = formato dos demais
  sets; com isso "2 sets + super tie-break" NÃO é mais expressível via
  config: o super TB continua possível no PLACAR (resultado livre,
  RUL-0019) e `tieBreakPoints` 7|10 cobre a pontuação. Não há `bestOf=2`
  literal.
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
  **UI REMOVIDA no cutover do IBX-0053 (16/09)**: `entryRound`,
  `setEntryRound`, `validateEntryRounds` e as linhas `vacant` seguem
  vigentes no domínio, sem tela nas Inscrições.
- **Mini-placar de tie-break persistido (IBX-0034)** — cada set do placar
  pode carregar `tieBreak {a/b points}` opcional; validado contra o padrão
  do TB (fecha `(X+1)xX`, direção do vencedor, alvo + win-by-2 + teto de
  sanidade); resultados antigos seguem válidos; super tie-break sem
  mini-placar (10-09, usuário).
- **Re-sorteio na janela drawn (IBX-0037)** — `draw` aceita `drawn`
  (regra `canDrawTournament`): organizador ajusta as posições no canvas e
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
