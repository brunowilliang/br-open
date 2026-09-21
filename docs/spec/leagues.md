# Leagues — Estado atual

> Verificado em 10-08-2026 contra o código do repo (src/, convex/).

## Visão geral

Ligas são o núcleo competitivo do app: o organizador cria uma liga (modo fixo `challenges`), define regras de desafio, quadras com disponibilidade semanal, configura cobrança mensal opcional (PIX/Woovi) e aprova membros; jogadores entram, veem ranking, desafiam quem está acima (respeitando distância/limites), negociam data/horário/quadra por propostas e registram resultados com validação automática ou manual do organizador. O domínio vive em `convex/domains/league/` (contratos Zod + tabelas + regras puras), com API CRPC em `convex/functions/league/` (`management`, `discovery`, `membership`, `challenges`), rotas em `src/app/(private)/leagues/[leagueId]/` (cluster overview/ranking/challenges/requests/rules/schedule) e formulário em `src/app/(private)/settings/leagues/[mode]/`.

## Implementado

### Criação de liga (form wizard tabulado, um submit final)
- **Status:** implementado
- **Data:** 17/06/2026
- **Referências:** `src/app/(private)/settings/leagues/[mode]/_layout.tsx` (rotas `new`/`edit` resolvidas por `resolveLeagueFormTarget`), `src/app/(private)/settings/leagues/[mode]/{index,location,categories,courts,rules,settings}.tsx`, `src/lib/leagues/league-form-controller.tsx`, `src/lib/leagues/league-form-store.ts`, `src/lib/leagues/league-form-navigation.ts`, `src/components/pages/leagues/form-schema.ts`, `form-defaults.ts`, `form-validation.ts`, `convex/functions/league/management.ts` (`create`), `convex/domains/league/contract.ts` (`CreateLeagueSchema`).
- **Decisões:** o fluxo de criação é `/settings/leagues/[mode]?mode=new` (não existem rotas `new.tsx`/`edit.tsx`; o cluster compartilha 6 tabs: Detalhes, Local, Categorias, Quadras, Regras, Configurações). O criador é a organização ativa (`requireActiveManager` → `organizationId`); a liga pertence a `organization`, não a um `managerUserId`. Form é um único `useForm` + `FormProvider` com resolver Zod (`LeagueSchema` em `form-schema.ts`), validação onBlur e submit final com navegação para a aba com erro (`form-validation.ts` + `onValidationTabRequest`). Capa/avatar com picker real (galeria + crop 1:1 avatar / 16:9 capa, upload diferido no submit via `generateUploadUrl` — `league-form-controller.tsx`, `src/lib/uploads/image-crop.ts`, `convex/functions/league/management.ts:134-139`); os antigos placeholders `DEFAULT_*_STORAGE_ID` viraram IDs legados só para não apagar media antiga (`LEGACY_DEFAULT_LEAGUE_STORAGE_IDS`). `CreateLeagueSchema` inclui `approvalMode`, `maxPlayers`, `monthlyPriceCents`, `priceBillingInterval`, `gracePeriodDays`, `reminderDaysBefore`, `courts`; `visibility` é `public|private` — a opção `invite_only` do modelo original foi **descartada** (não há ligas "só convite"); valor legado é normalizado para `public` via `normalizeLeagueVisibility` (migration `20260615_083000` reescreve docs antigos). Default de visibilidade no form: `public`.
- **Como funciona:** a rota `[mode]/_layout.tsx` carrega `viewer.context.get` (capacidade `canCreateLeague`), monta `CreateLeagueForm` → `useLeagueFormController` (defaults de `buildCreateLeagueDefaultValues`), tabs são telas Expo Router sob `FloatingTabBar` (`LEAGUE_FORM_TAB_ITEMS` em `league-form-navigation.ts`); no submit, media pendente é enviada ao storage, `create` insere a liga, invalida `listMine` e navega para `/settings/leagues` com toast.

### Edição de liga (mesmo form, regras editáveis)
- **Status:** implementado
- **Data:** 17/06/2026
- **Referências:** `src/app/(private)/settings/leagues/[mode]/_layout.tsx` (`EditLeagueForm`, `getById`, `update`, `remove`), `src/app/(private)/settings/leagues/[mode]/settings.tsx` (dialog "Deletar liga" com texto "Essa ação remove permanentemente a liga e não pode ser desfeita."), `convex/functions/league/management.ts` (`update`, `remove`), `convex/domains/league/contract.ts` (`UpdateLeagueSchema`, `DeleteLeagueSchema`).
- **Decisões:** a edição é `/settings/leagues/[mode]?mode=edit&leagueId=...` e `UpdateLeagueSchema` aceita `ruleConfig` completo — as regras são **totalmente editáveis após a criação** (`isRulesLocked: false` em `EditLeagueForm`). Aba `Localização` virou `Local` (label em `LEAGUE_FORM_TAB_ITEMS`). Delete é real, com confirmação, invalida `listMine` e redireciona para `/settings/leagues`.
- **Como funciona:** `EditLeagueForm` carrega `league.management.getById`, converte `League → LeagueScreenValues` (`toLeagueScreenValues`), `update` persiste e invalida `listMine`+`getById`; `remove` é gated por `requireActiveManager` + `getManagedLeagueOrThrow` (ownership por `organizationId`). Media substituída é deletada do storage via `collectReplacedLeagueStorageIds` + `deleteStorageIds`.
- **Header no loading do wizard (IBX-0060):** enquanto `getById` (edição) ou `viewer.context.get` (criação) carregam, o fallback mantém o header idêntico ao estado carregado (back + `Page.Header.SubTitle` "Criar Liga"/"Editar Liga" + `Page.Header.Title` da tab ativa, label resolvido de `useSegments` contra `LEAGUE_FORM_TAB_ITEMS` com default "Detalhes") e o spinner confinado à área de conteúdo abaixo do header; erro/inválido/sem-permissão mantêm o header de título único (o menu Salvar só existe no estado carregado — no fallback o `Page.Header.Right` fica vazio). O fallback vive no componente global `FormFallback` (`src/components/ui/form-fallback.tsx`), compartilhado com o torneio (RUL-0005; extingue os duplicados `LeagueFormFallback`/`TournamentFormFallback`).
- **Mídia sem overlay (IBX-0064):** nas telas de Detalhes (`[mode]/index.tsx`, create e edit), banner e avatar NÃO têm overlay escuro com texto — o toque abre o dialog de confirmação "Quer alterar o banner?"/"Quer alterar o avatar?" (`MediaConfirmDialog` global em `src/components/ui/media-confirm-dialog.tsx`, molde dos dialogs Sair/Deletar liga; 1 dialog por tela com alvo dinâmico) e o CONFIRMAR chama o fluxo de troca de hoje (`onMediaPress` → picker/crop/upload, handlers intocados); o `PressableFeedback` fica desabilitado durante o upload (`isMediaUploading`).

### Quadras (tab dedicada com disponibilidade semanal)
- **Status:** implementado
- **Data:** 17/06/2026
- **Referências:** `src/app/(private)/settings/leagues/[mode]/courts.tsx` (editor com Accordion por quadra, tabs por dia, selects de horário de 30 em 30 min, add/remove/rename), `convex/domains/league/contract.ts` (`LeagueCourtSchema`, `LeagueCourtAvailabilitySchema`, `LeagueCourtsSchema`, `EMPTY_LEAGUE_COURT_AVAILABILITY`), `convex/domains/league/tables.ts` (`league.courts` JSON), `convex/domains/league/challenge-scheduling-rules.ts` (day-key UTC a partir da data, `rangesOverlap` half-open).
- **Decisões:** quadra tem `id/name/availability` por dia (`mon..sun`) com `startMinute/endMinute` múltiplos de 30, sem overlap (toque permitido), nomes únicos case-insensitive (normalização `normalizeCourtName` no front; `LeagueCourtsSchema.superRefine` no contrato) e ordenação por startMinute. A aba `Quadras` é compartilhada entre create e edit. Validação também existe no contrato (múltiplos de 30, `start < end`, 0–1440, overlap). Não há geração de slots nem exceções por data (fora de escopo, segue fora). O dialog `Adicionar Horário` do `CourtEditor` aceita MÚLTIPLOS dias na mesma ação (chips de dia avulsos + chip `Todos` na MESMA fileira, que seleciona/desmarca todos os dias; presets compostos `Seg+Qua+Sex`/`Ter+Qui` extintos 16/09; IBX-0047): o range é criado em todos os dias selecionados de uma vez, com validação de overlap por dia listando os dias em conflito; a edição de um range existente SUBSTITUI em place (mesmo dia). A mutação/validação é pura e compartilhada em `src/lib/courts/court-availability.ts` (`applyCourtRange`, testado; BUG-0032/IBX-0050): overlap validado em TODOS os caminhos (add, edit, multi-dia) contra o MESMO estado que é gravado; horários são minutos 24h exatos, sem bloquear digitação (espírito RUL-0019).
- **Como funciona:** o editor emite valores normalizados para o campo `courts` do form (RHF context); no submit, `courts` viaja junto com o payload (`CreateLeagueInput`/`UpdateLeagueInput`); serialização cobre legados (`courts: record.courts ?? []` em `serializeLeague`).

### Regras toggleáveis
- **Status:** implementado
- **Data:** 23/06/2026
- **Referências:** `convex/domains/league/contract.ts` — helper `toggleableRule<T>` + tipo `ToggleableRule<T>` (linhas ~65-88), `resolveRuleValue`, `NO_RESPONSE_DEADLINE_HORIZON_YEARS = 100`, `DEFAULT_LEAGUE_RULE_CONFIG` (linhas 252-267), `ChallengeRuleConfigSchema` com `maxChallengeDistance`, `maxActiveChallengesPerPlayer`, `maxChallengesPerMonth`, `responseDeadlineHours` enrolados em `toggleableRule(...)` (linhas 460-501); os enums obrigatórios (`challengeValidationMode`, `resultValidationMode`, `winBehavior`, `lossBehavior`, `walkoverBehavior`, `newPlayerPlacement`) seguem como required sem toggle. `convex/domains/league/challenge-rules.ts` — `resolveResponseDeadline` (sentinel far-future quando desabilitado), `resolveChallengeCreationRuleError` numérico. `convex/functions/league/_challenges/scheduling_guards.ts` (linhas 168-180) — `resolveChallengeCreationRuleError` com `resolveRuleValue(rule, Number.POSITIVE_INFINITY)`. UI: `src/components/pages/leagues/rule-card.tsx` (`ToggleableRuleCard` + `RuleExpandableContent` com `accessibilityRole="checkbox"`), `form/rules/sections/challenge-rules-section.tsx` (4 `ToggleableRuleCard` + `RuleCard` de `challengeValidationMode`), `result-rules-section.tsx` (`resultValidationMode` na tab Resultado), `src/app/(private)/settings/leagues/[mode]/rules.tsx` (4 tabs: Desafios/Resultado/Ranking/Partidas), `settings.tsx` (toggles "Limitar vagas" e "Cobrança"; `togglePaidPrice` bloqueia se `wooviStatus !== "active"`). Migrations: `20260623_000001_toggleable_rule_config.ts` e `20260623_000002_challenge_scoring_snapshot.ts`. Seed: `convex/domains/seed/data.ts` (`defaultSeedRuleConfig` com shape `{ enabled, value }` + `scheduleVisibility`). Testes: `contract.test.ts`, `challenge-creation-rules.test.ts` (casos `Infinity`).
- **Decisões:** "no deadline" é timestamp far-future (coluna `responseDeadlineAt` `notNull()`); resolução do valor efetivo fica no caller; valor preservado ao desabilitar (validação do `value` continua com `enabled:false`). Scoring renomeado na implementação: `LeagueScoringModeOptions = ["advantage", "no_advantage"]` (contract.ts linha 63), label "Sem vantagem" em `src/lib/leagues/rule-format.ts` e `form/rules/shared.ts` (antes `no_ad`/"No-ad").

### Match config compartilhado — bestOf {1,3,5} + tie-break derivado (R10/R11)
- **Status:** implementado
- **Data:** 22/08/2026
- **Referências:** `convex/domains/league/contract.ts` —
  `LeagueMatchConfigSchema.superRefine` exige `bestOfSets` ∈ {1, 3, 5}
  (`SUPPORTED_BEST_OF_SET_COUNTS`, R10) e `tieBreakPoints` ∈ {7, 10}
  (`SUPPORTED_TIE_BREAK_POINTS`, R11; presets oficiais do tênis — set TB a
  7, super TB a 10). **R11:
  `tieBreakAtGamesAll`/`finalSetTieBreakAtGamesAll` REMOVIDOS** do schema —
  o gatilho do TB acompanha os games do set (derivação na leitura do
  placar; ver REWORK-2 abaixo). No input da liga o
  `.default(DEFAULT).catch(DEFAULT)` do `ruleConfig.matchConfig` segue como
  healing de docs legados; Zod stripa a chave extra de docs antigos sem
  disparar o catch (testado em `league/tests/contract.test.ts` — "legado
  R11"). Auditoria dev+prod pré-tighten: todos os docs já 6/7/10 (derivação
  neutra). Sem migration.
- **IBX-0034 (10-09): mini-placar do tie-break por set** — campo
  `tieBreak` opcional no schema de set; **REWORK-2 (10-09): o placar manual é
  LIVRE** — a validação por forma (padrão 7x6, direção, alvo, win-by-2, teto)
  saiu do caminho manual e o cluster INTEIRO foi REMOVIDO (`getSetValidationError`,
  `buildChallengeScoreProgress`, `getRequiredSetWins`, `getExpectedSetKind`,
  `isChallengeScoreSetBlank`, `resolveChallengeScoreWinnerMembershipId`,
  `validateChallengeScore` — zero call sites fora dos testes, checado por grep).
  **Rodada 4 (10-09): a derivação CONTA o TB anexo** — linha empatada em games
  é decidida pelo `tieBreak` anexo (mais pontos vence a linha; TB empatado ou
  ausente = linha de ninguém); linha não-empatada segue pelos games. Sem
  migration, sem mudança de config (o config do TB continua no
  wizard/regras, mas não valida mais resultado manual).
- **UI do form (R11, entregue):** campo "em qual placar entra o tie-break"
  REMOVIDO do set normal (o gatilho acompanha os games);
  "pontos no tie-break" virou SEGMENTO 7|10 ("7 pontos"/"10 pontos", molde
  do bestOf — `match-rules/match-basics-section.tsx:73-81`; set em
  `tie-break-section.tsx:58-80`; a seção própria do último set,
  `final-set-section.tsx`, foi EXTINTA no DEC-0004); toggle Tie-break
  preservado;
  espelho gamesPerSet→tieBreakAtGamesAll EXTINTO; `MATCH_CONFIG_FIELDS`
  sem as 2 chaves (`use-match-config-form.ts:3`); `/rules` read-only DERIVA
  o empate de gamesPerSet (`formatTieBreak` — "Tie-break em 6x6" para set
  de 6, `rule-format.ts:98-107`); `MATCH_RULE_INFO.tieBreak` reescrito
  ("O tie-break entra quando o set chega em games-a-games.",
  `match-rules/shared.ts:55-58`).
- **DEC-0004 (15-09, opção A): o grupo do ÚLTIMO SET foi REMOVIDO do
  formato** — vale LIGA E TORNEIO (schema compartilhado). Último set =
  formato dos demais sets; super tie-break segue coberto por
  `tieBreakPoints` 7|10 e pelo placar LIVRE do resultado (RUL-0019).
  Campos removidos do `LeagueMatchConfigSchema`/
  `DEFAULT_LEAGUE_MATCH_CONFIG`: `finalSetMode`/`finalSetGamesPerSet`/
  `finalSetHasTieBreak`/`finalSetMustWinByTwoGames`/`finalSetScoringMode`/
  `finalSetTieBreakMustWinByTwo`/`finalSetTieBreakPoints`/
  `finalSetSuperTieBreakMustWinByTwo`/`finalSetSuperTieBreakPoints` (e
  `LeagueFinalSetModeOptions` extinto). Configs salvos com as chaves ficam
  inertes: a coluna `json` mantém o blob e o zod STRIPA na leitura sem
  erro (mesmo padrão do R11; testado em "legado (DEC-0004)" no
  `league/tests/contract.test.ts`). Sem migration (coluna
  `json<Record<string, unknown>>` — nada destrutivo). Seed
  (`functions/seed.ts:buildSeedScore`) passou a gerar o set decisivo com o
  mesmo `gamesPerSet` dos demais.
- **Decisões:** uma regra a menos para o organizador configurar (o gatilho
  acompanha os games por set) e placares sempre coerentes com os presets
  oficiais; mesmo schema compartilhado com torneio (detalhes do lado do
  torneio em tournaments.md, "Backend implementado"). **Forms NÃO espelham
  o refine {7,10}** — herdam do schema-base (o segmento elimina a entrada
  inválida na UI); o `superRefine` bestOf dos forms ficou redundante pelo
  mesmo motivo (aceito como está — LOW de cleanup futuro).

### Seções de partida do form como módulo global (RUL-0005, R10)
- **Status:** implementado
- **Data:** 22/08/2026 (IBX-0010 R10 — regra de partida no torneio)
- **Referências:** `src/components/match-rules/` (NOVO módulo global) —
  `match-rules-section.tsx` compõe `match-basics-section.tsx` +
  `tie-break-section.tsx` (a terceira seção, `final-set-section.tsx`, foi
  EXTINTA no DEC-0004), todos parametrizados
  por `RuleSectionProps.prefix` (`shared.ts:7-11` — `"ruleConfig.matchConfig"`
  na liga, `"matchConfig"` no torneio); `use-match-config-form.ts` resolve
  os paths RHF (`buildMatchConfigPaths(prefix)`) e erros aninhados
  (`resolveMatchConfigFieldError`) das seções compartilhadas;
  `MATCH_RULE_INFO` vive em `match-rules/shared.ts` (:24-60). As seções de
  partida SAÍRAM de `form/rules/sections/` (arquivos removidos; a aba
  Partidas de `settings/leagues/[mode]/rules.tsx` monta
  `MatchRulesSection prefix="ruleConfig.matchConfig"` — rules.tsx:14,100-103);
  as seções de desafio/resultado/ranking continuam em
  `form/rules/sections/`. `CHALLENGE_RULE_INFO` restaurado byte-a-byte no
  `form/rules/shared.ts` da liga (:22-43) junto de `RULE_INFO`
  (:45+) — nada de conteúdo perdido na extração.
- **Decisões:** uma só implementação das seções de regras de partida para
  liga e torneio; a liga continua passando o prefixo antigo, o contrato e o
  payload NÃO mudaram (slice de frontend puro).

### Desafios (lifecycle completo de propostas + resultados)
- **Status:** implementado
- **Data:** 24/05/2026
- **Referências:** `convex/functions/league/challenges.ts` (18 procedures), `convex/domains/league/challenge-rules.ts`, `challenge-status.ts`, `challenge-form.ts`, `tables.ts` (`leagueChallenge`, `leagueChallengeProposal`, `leagueChallengeResultSubmission`, `leagueChallengeOrganizerAction`), `src/app/(private)/leagues/[leagueId]/challenges.tsx`, `src/components/pages/leagues/challenge-proposal-dialog.tsx`, `src/components/ui/score-result-dialog.tsx` (GLOBAL, IBX-0024), `src/lib/matches/score-draft.ts`, `challenge-card.tsx`, `challenge-organizer-action-dialog.tsx`, `src/lib/leagues/use-challenge-mutations.ts`, `challenge-route-view.ts`, `challenge-menu-actions.ts`, `challenge-tab-counts.ts`, `challenge-feedback.ts`, `challenge-formatters.ts`.
- **Decisões:** modelo de negociação com proposta ativa única, contrapropostas com histórico (`revisionNumber`, status `active|accepted|replaced|declined|cancelled`), reset do deadline (`buildResponseDeadline`), lock após aceite (`resolveAcceptedChallengeStatus`), bloqueio de slot nos estados ativos (`ACTIVE_CHALLENGE_BLOCKING_STATUSES`). Nomenclatura "admin" → "organizer" (`pending_organizer_challenge_validation`, `pending_organizer_result_validation`, `pending_organizer_decision`). Lifecycle com 14 estados, incluindo `pending_cancellation_acceptance`: o cancelamento é por solicitação aceita pelo outro lado (`requestCancellation` + `respondCancellationRequest` com `cancellationRequestedAt/By`), além do `cancel` direto. Score com schema próprio (`leagueChallengeScoreSchema`: sets com `kind: set|super_tiebreak`, winner por membership) e validação dirigida pelo `matchConfigSnapshot` (`validateChallengeScore`, `buildChallengeScoreProgress`, `getSetValidationError`). Tabela `leagueChallengeOrganizerAction` com trilha de auditoria das ações do organizador. Resultado com validação manual: `reviewResult` (approve/request_correction/invalidate) e `organizerSubmitResult` (organizador preenche placar quando o jogador não confirma). Regras de criação (`resolveChallengeCreationRuleError`): não se desafiar, posição acima, distância máxima, limites ativos/mensais. `challengeValidationMode`/`resultValidationMode` (automatic/manual) com defaults `automatic`.
- **Como funciona:** jogador cria desafio com proposta completa (data, hora, quadra) contra um membro ativo; o outro aceita/recusa/contrapropõe; aceite trava a proposta e confirma (ou vai para validação manual do organizador); após a partida, um jogador submete placar, o outro confirma; o organizador valida quando o modo é manual, pode pedir correção, invalidar, cancelar/invalidar/reabrir (`organizerManage` com ações `cancel|invalidate|reopen_challenge|reopen_result`) e lembrar resultado (`organizerRequestResultReminder`). Abas unificadas para jogador/organizador: `active|attention|ongoing|history` (`buildChallengeRouteVisibleChallenges`), com contadores de badge (`buildChallengeTabCounts`) e menus derivados de `challenge-status.ts` (paridade backend/frontend garantida por `challenge-status-parity.test.ts`).

### Ocupação de quadra no agendamento derivada no servidor (BUG-0027/IBX-0043)
- **Status:** implementado
- **Data:** 15/09
- **Referências:** `convex/domains/league/challenge-scheduling-rules.ts` (`resolveMatchOccupiedEndMinute`), `convex/functions/league/_challenges/scheduling_guards.ts` (`assertCourtSlotAvailable`), `convex/functions/league/challenges.ts` (`create`, `counterPropose`), `challenge-scheduling-rules.test.ts`.
- **Regra:** a janela ocupada de uma partida é `[startMinute, startMinute + defaultDurationMinutes)` derivada no SERVIDOR a partir das regras (`matchConfig` vigente no `create`; `matchConfigSnapshot` do desafio na contraproposta e no guard), nunca do `endMinute` enviado pelo cliente: uma janela menor mentida pelo cliente não escapa mais do conflito. `create` e `counterPropose` continuam recusando sobreposição na mesma quadra+data contra qualquer desafio em status ativo (`ACTIVE_CHALLENGE_BLOCKING_STATUSES`; janela half-open, encostar não conflita) e passam a gravar na proposta o `endMinute` derivado da regra. Contrato pro cliente: `league.challenges.listOccupiedSlots` devolve os slots ocupados (quadra/data/janela) e o dialog desabilita horários em conflito.
- **Nota (review):** `listOccupiedSlots` devolve o endMinute ARMAZENADO na
  proposta: propostas criadas antes do deploy (endMinute subnotificado)
  sub-desabilitam horários na UI até a proposta ser renovada
  (contraproposta). Auto-resolve: o SERVIDOR deriva a janela do snapshot de
  regras e é a rede de proteção.

### Dialog de placar do desafio (GLOBAL — IBX-0024 + IBX-0034, RUL-0005/RUL-0019)
- **Status:** implementado
- **Data:** 26/08 (IBX-0024); 10/09 (IBX-0034: fluxo set a set → LISTA LIVRE)
- O "lançar placar" do desafio e o "lançar resultado" do torneio eram o
  mesmo conceito duplicado em 2 componentes — extraído para o núcleo
  GLOBAL `src/components/ui/score-result-dialog.tsx` (lados A/B neutros,
  W.O. por `walkoverEnabled`; submissão `{sets, walkover, winnerId}` com
  vencedor EXPLÍCITO) com puras em `src/lib/matches/score-draft.ts`. Na
  liga: `challenges.tsx` consome com payload `{sets,
  winnerMembershipId}` e título dinâmico preservado;
  `challenge-result-dialog.tsx` EXTINTO (grep 0).
- **IBX-0034 (10-09, RUL-0019) — resultado como lista livre (rounds 2-4):**
  o dialog tem um topo FIXO (`absolute top-4 right-4`): o botão "Adicionar"
  (label SEMPRE visível, agora o `Menu.Trigger` — o menu do corpo foi
  extinto no round 5; desabilitado enquanto o submit pende) ao lado do X de
  fechar GLOBAL (`DialogCloseButton`,
  `src/components/ui/dialog-close-button.tsx`, adotado por todos os
  dialogs, posição preservada). O menu oferece
  "Adicionar set" (par de `NumberStepper` 0-99 com "x" e os nomes dos
  jogadores — entrada numérica, NUNCA chips/ToggleButtonGroup),
  "Adicionar tie-break" (linha avulsa de pontos, só com 1+ set na lista)
  e "Registrar W.O." (entrou no menu no round 3; o link standalone saiu
  do corpo). DENTRO de cada linha o botão "Tie-break" (centralizado sob
  os steppers) anexa o mini-placar — UM por linha, sem botão de
  "adicionar outro" quando já existe, remoção pelo X (`Cancel01Icon`) da
  própria sub-linha; o X do header remove a linha. Sem gates: set 3x3
  fecha como qualquer linha, sem erro inline, sem labels de regra, sem
  limites por gamesPerSet (`isTieBreakDue`/`applyTieBreakToSet`/
  `getDraftSetError`/chips EXTINTOS no round 2). SEM scoreboard (faixa e
  resumo extintos no round 3; `buildMatchVictorySummary` removido): a
  contagem de linhas (`buildScoreboard`) só alimenta o desfecho — round 4:
  mais games decide a linha; EMPATE em games é decidido pelo TB anexo
  (mais pontos no TB — 6x6 com TB 7-3 é linha do lado A; TB empatado não
  conta). O "Quem venceu?" aparece ON-DEMAND na hora de salvar quando o
  conjunto fica indefinido (nada aparece nem bloqueia antes). Submit
  exige 1+ linha e vencedor (derivado ou escolhido). W.O. no menu
  (2 botões grandes + voltar; payload `[LEAGUE_WALKOVER_SET]` + flag).
  Hydrate preserva `initialSets` (trim de linhas zeradas à direita). As
  animações são da família rule-card
  (FadeIn 180ms / FadeOut 120ms + AccordionLayoutTransition).
- **BUG-0026 (15-09, DEC-0005 opção A) — botão "Tie-break" CONTEXTUAL:**
  o botão dentro da linha de placar (set e super tie-break) só aparece com
  o placar DAQUELA linha empatado e além do 0x0 (`canAttachTieBreak`,
  `src/lib/matches/score-draft.ts`, +6 testes); desempatou, esconde; com o
  mini-placar anexado não volta (remoção pelo X da sub-linha). O menu
  ("Adicionar set/tie-break/W.O.") e a linha avulsa continuam LIVRES em
  qualquer estado — zero validação nova, RUL-0019 intacta. Entrada/saída do
  botão ganharam wrapper animado no molde rule-card (FadeIn 180ms /
  FadeOut 120ms + AccordionLayoutTransition, mesmo idioma do card do set):
  a troca botão↔bloco de TB cruza em fade e a altura do card cresce suave
  (antes o bloco "entrava do nada", item 2 do BUG-0026).
- **BUG-0035/IBX-0055 (16-09) — tie-break anexado DISSOLVE quando o set
  desempata:** o update da linha no dialog (`updateLine`) passa pelo
  `settleAttachedTieBreak` (`src/lib/matches/score-draft.ts`): se o placar
  de games mudou e o placar novo deixou de ser elegível (desempatado ou
  0x0), o `tieBreak` anexo sai sozinho (`null`); mudou e segue empatado
  (4x4 → 5x5), mantém; placar intacto (edição só dos pontos do próprio
  TB), NUNCA mexe — o mini-placar edita pela mesma via de `onUpdate`. A
  elegibilidade é a mesma semântica do gate do botão (DEC-0005), extraída
  em `hasTieBreakEligibleScore` sem a cláusula de "já tem tie-break".
  Menu livre (RUL-0019), linha avulsa de tie-break e gate de exibição do
  botão intocados; vale liga E torneio (dialog global, RUL-0005/IBX-0024),
  inclusive editando resultado já publicado. +6 testes em
  `score-draft.test.ts`.
- **Corpo scrollável + gesto (10-09, rodada 8):** o corpo (lista + empty
  state + "Quem venceu?") vive num `ScrollShadow color="surface"` com
  `maxHeight = min(450, metade da janela)` + `ScrollView` (molde do repo:
  `challenge-proposal-dialog.tsx:457` / `select-scroll-content.tsx`, e a
  seção Scrollable Content da doc do HeroUI Native); FICOS: título, o par
  do topo (Adicionar + X) e o rodapé (Salvar + mensagem de erro acima) —
  o botão de salvar nunca sai da tela. `isSwipeable={false}` neste dialog:
  o drag-to-dismiss (default true) brigaria com o scroll vertical do
  corpo; fechamento pelo X.
- **BACKEND POUSADO (10-09, REWORK-2):** o contrato combinado está no ar no
  zod: `leagueChallengeScoreSetSchema.kind` ganhou `"tiebreak"` (linha avulsa
  de pontos) e `leagueChallengeScoreSchema.winnerMembershipId` virou NULLISH —
  o vencedor EXPLÍCITO é obrigatório só quando as linhas empatam (derivado por
  linhas vencidas caso contrário; `resolveChallengeScoreOutcome` em
  `challenge-rules.ts`). Validação manual LIVRE: sem gamesPerSet/2-de-diferença/
  empate-proibido/teto de sets; só sanidade (ints ≥ 0, 1+ linha) + exatamente 1
  vencedor (explícito incoerente = erro). Binding alinhado no Front
  (10-09): os casts saíram (handlers de `challenges.tsx` tipam com
  `LeagueChallengeScore` direto; `ScoreDraftSet.kind` importa o tipo do
  contrato) e o dialog manda `winnerMembershipId` explícito SÓ quando as
  linhas empatam ou em W.O. (null quando o placar decide).

### W.O. no resultado do desafio + edição de resultado publicada (IBX-0026/0028)
- **Status:** implementado
- **Data:** 31-08-2026
- **Referências:** `convex/domains/league/contract.ts` (`leagueChallengeScoreSchema.walkover?`), `convex/domains/league/challenge-rules.ts` (`resolveWalkoverScoreError`, `applyChallengeResultToRanking` walkover-aware), `convex/functions/league/challenges.ts` (`submitResult`, `confirmResult`, `organizerSubmitResult` — editor único), `convex/functions/league/_challenges/ranking.ts` (`recordOrganizerChallengeAction` com action `edit_result` + `reason`), `src/app/(private)/leagues/[leagueId]/challenges.tsx` (`walkoverEnabled` + `LEAGUE_WALKOVER_SET`), protocolo de notificações (`league.challenge.walkover_submitted|walkover_confirmed|result_edited`).
- **Decisões:** W.O. espelha a convenção do torneio (payload = 1 set placeholder 0-0 + flag; `LEAGUE_WALKOVER_SET` no vocabulário challenger/challenged) — backward compat, scores antigos parseam sem flag. NENHUM estado novo no lifecycle: submit → `pending_result_confirmation` (perdedor confirma; modo manual → `pending_organizer_result_validation`) — ninguém se auto-declara vencedor sem contraparte ou organizador. `walkoverBehavior: "cancel_challenge"` desliga W.O. como resultado na liga (manda cancelar); `"automatic_loss_and_move_to_end"` manda o perdedor pro fim do ranking (vencedor toma a posição); `"automatic_loss"` mantém o efeito padrão. Ranking com snapshots/reversão como nos resultados jogados. Editor único de resultado publicado = organizador (`organizerSubmitResult` já aceitava `finished`); edição detectada (finished + submission existente) gera auditoria `leagueChallengeOrganizerAction` action `edit_result` com `reason` JSON `{before, after}` + notificação `result_edited` aos 2 jogadores; re-ranking restaura o snapshot e reaplica.
- **Como funciona:** jogador ou organizador submete `{sets:[0-0], walkover:true, winnerMembershipId}` → valida `resolveWalkoverScoreError` (vencedor ∈ lados, 1 set zerado, behavior não-cancelamento) em vez de `validateChallengeScore` → fluxo de confirmação normal com notificações `walkover_submitted`/`walkover_confirmed`. Edição pelo organizador: novo submission confirmado + restore/re-apply de ranking + auditoria + `result_edited`. Delta de UI pendente (Frontend): chip "W.O." no card quando `submission.score.walkover` (flag já serializada ao cliente).

### Agenda / Schedule
- **Status:** implementado
- **Data:** 26/06/2026
- **Referências:** `convex/domains/league/contract.ts` — `LeagueScheduleVisibilityOptions`, `DEFAULT_LEAGUE_SCHEDULE_VISIBILITY = "public"`, campo `scheduleVisibility` no `ChallengeRuleConfigSchema` (linha 498), `leagueScheduleItemSchema`. `convex/functions/league/challenges.ts` (linhas 120-133) — `league.challenges.listScheduled` (`authQuery`): se `scheduleVisibility !== "public"` exige `getViewerContextOrThrow` (FORBIDDEN para visitante); filtra status `confirmed` + `matchDate >= hoje`; ordena por `matchDate`/`startMinute`. `src/app/(private)/leagues/[leagueId]/schedule.tsx` — rota standalone (Page.Header + ScrollView), janela `7|15 dias`, tabs de data via `buildScheduleDateTabs`, sempre abre em "Hoje", períodos manhã/tarde/noite via `buildScheduleDayView`. `src/app/(private)/leagues/[leagueId]/index.tsx` — item "Agenda" no menu `⋮` quando `access.canOpenSchedule`. `src/lib/leagues/league-details-derived.ts` — `canOpenSchedule: scheduleVisibility === "public" ? true : isMember`. `src/lib/leagues/schedule-view.ts` — `buildScheduleDateTabs`, `buildScheduleDayView`, `SCHEDULE_WINDOW_OPTIONS` (7/15), `SCHEDULE_PERIOD_META` (manhã <720, tarde <1080, noite >=1080), `formatScheduleMinute`; testes em `schedule-view.test.ts`. `src/components/ui/schedule-card.tsx` (GLOBAL — RUL-0005; era `src/components/pages/leagues/schedule-card.tsx`) — card simplificado (fotos sobrepostas, `NOME x NOME`, `HH:MM · Quadra`), usado pela agenda da liga e pela do torneio. `settings.tsx` — "Visibilidade da agenda" (`scheduleVisibilityOptions`: "Aberta para todos"/"Somente jogadores").
- **Decisões:** filtro de janela client-side; flag vive no `ruleConfig` com fallback `?? "public"` no backend e no client; serialização com fallback sem migração de dados (docs legados caem no default).

### Ranking (posições + reordenação manual + efeito automático de resultados)
- **Status:** implementado
- **Data:** 15/06/2026
- **Referências:** `src/app/(private)/leagues/[leagueId]/ranking.tsx` (lista com drag-and-drop via `SortableCardList`, dialog de desafiar), `convex/functions/league/membership.ts` (`reorderRanking`, `getOverview` com `ranking`), `convex/functions/league/challenges.ts` (`listForLeague`), `convex/domains/league/challenge-rules.ts` (`applyChallengeResultToRanking`, `resolveChallengeCreationRuleError`), `convex/domains/league/membership-rules.ts` (`resolveApprovedMembershipRankingPosition`, `resolveRankingReorderError`), `src/lib/leagues/league-details-derived.ts` (`buildLeagueDetailsRankingItems`, `resolveLeagueDetailsViewerPosition`), `src/lib/leagues/ranking-local-order.ts`.
- **Decisões:** não existe conceito "ladder" — o ranking é por posição (`leagueMembership.rankingPosition`) com: novo jogador ao final (`newPlayerPlacement: "end_of_ranking"`), vitória troca de posição (`take_opponent_position`) ou sobe 1 (`climb_one_position`), derrota `stay_put` ou `drop_one_position`, walkover `automatic_loss`; o organizador pode reordenar manualmente (`reorderRanking` — adicional ao desenho inicial); desafios só contra posições acima dentro de `maxChallengeDistance` (toggleable). Efeito de ranking aplicado com snapshots (`rankingSnapshotBeforeResult`/`AfterResult`, `rankingAppliedAt`) e reversível (`resolveChallengeRankingRestore`, ações `reopen_challenge`/`reopen_result`).
- **Como funciona:** `getOverview` monta `ranking` + `pendingRequests`; `league-details-derived.ts` marca `isChallengeable` por papel/distância/posição; `reorderRanking` valida que a lista enviada é exatamente o conjunto de membros ativos (`resolveRankingReorderError`).

### Detalhe da liga (cluster de rotas + store Legend-State)
- **Status:** implementado
- **Data:** 15/06/2026
- **Referências:** `src/app/(private)/leagues/[leagueId]/_layout.tsx` (layout com `Tabs` + `FloatingTabBar` e bootstrap/hydration do store), `index.tsx` (overview com banner, menu com Regras/Editar), `ranking.tsx`, `challenges.tsx`, `requests.tsx` (owner-only, redireciona quem não pode), `rules.tsx` (regras read-only em grid 2xN — desde o R10 com `RulesGrid`/`RulesItemCard` GLOBALIZADOS em `src/components/ui/rules-grid.tsx`, cutover da liga com a tela de torneio reutilizando; helpers locais removidos), `schedule.tsx` (agenda — rota nova, além do refactor), `src/lib/leagues/league-details-store.ts` (store singleton com buckets por `leagueId`), `league-details-derived.ts`, `league-navigation-tabs.ts`, `challenge-route-view.ts`, `challenge-tab-counts.ts`, `schedule-view.ts`, `src/components/pages/leagues/{guest-overview,player-overview,organizer-overview,league-join-footer}.tsx` (o `schedule-card.tsx` virou o global `src/components/ui/schedule-card.tsx`; a lista espelha o diretório real).
- **Decisões:** o modelo de 3 papéis é `guest|player|organizer` (`LeagueDetailsRole` em `league-details-derived.ts`; `buildLeagueDetailsRole` resolve organizer > membro ativo > guest) e o access inclui `canOpenSchedule` (regido por `scheduleVisibility: public|members_only`). O store é `observable` do Legend-State v3 (`@legendapp/state@~3.0.0-beta.48`) com buckets por `leagueId` (`getLeagueDetailsBucket$`) e deriveds (access, counts, rankingItems, requestItems, rulesView, viewerPosition); React Query é dono do servidor (queries em `_layout.tsx`, invalidação em `use-challenge-mutations.ts`). `requests.tsx` falha fechado para não-organizador. Navegação por `FloatingTabBar` + rotas (sem tab-query-param).
- **Como funciona:** `_layout.tsx` lê `leagueId` de `useLocalSearchParams` (params da PRÓPRIA rota; nunca `useGlobalSearchParams` aqui, que segue a rota FOCADA e fazia uma liga empilhada em cima de outra ler o `leagueId` de cima — reset/hidratação no bucket errado e bucket de baixo vazio; mesmo fix do torneio, BUG-0033). `_layout.tsx` hidrata `discovery.getById` + `viewer.context.get`, deriva papel/access no bucket, hidrata membros (`membership.getOverview`, só se `canOpenRanking||canOpenRequests`), desafios (`challenges.listForLeague`, só se `canOpenChallenges`) e slots ocupados; cada rota consome os deriveds do bucket e executa mutações com invalidação via React Query.

### Aviso de pagamento na liga + renovação pelo checkout (IBX-0039)
- **Status:** implementado
- **Data:** 15/09/2026
- **Referências:** `src/lib/leagues/league-details-derived.ts` (`buildLeaguePaymentAlert`, `buildLeagueDetailsRole`, `buildLeagueGuestOverviewAlert`), `src/lib/leagues/league-details-store.ts` (`setViewerMembership`/`setViewerMembershipStatus` passam a derivar o papel pelo builder, sem regra duplicada), `src/components/ui/widget-alert.tsx` (`action` opcional no alerta), `src/components/pages/leagues/player-overview.tsx` (alerta + CTA), `src/components/pages/leagues/guest-overview.tsx` (alerta do suspenso), `src/app/(private)/checkout/[chargeId]/index.tsx` (ação "Gerar novo Pix" nos estados PAID e EXPIRED), `src/app/(private)/leagues/[leagueId]/index.tsx` (rodapé de pagar segue só para `role === "guest"`).
- **Decisões:** o membro com `payment_due` (carência) NÃO é mais rebaixado a visitante: mantém abas e overview de membro e recebe aviso de pagamento com o CTA DENTRO do alerta (`WidgetAlert.action`), porque o rodapé de pagar só renderiza para visitante. `awaiting_payment` (entrada ainda não ativada) e `suspended` seguem como visitante; o suspenso ganha o alerta no `GuestOverview` e mantém o CTA de renovar no rodapé (`canResumeCheckout`). O checkout deixa de ser beco sem saída em charge PAID/EXPIRED: a origem `league_membership` com `canRegenerate` (sinal de `payment.charge.listMine`, espelho de `canMembershipBeCharged`) oferece gerar a cobrança nova. O aviso de renovação do membro `active` ("Mensalidade vence em X dias") usa `viewerMembershipDueAt` do contrato de leitura da liga (C5, Backend) e aparece só dentro da janela `reminderDaysBefore`; sem data (`null`) ele fica silencioso.
- **Como funciona:** `buildLeaguePaymentAlert({ dueAt, now, reminderDaysBefore, status })` devolve `{ actionLabel, description, severity, title } | null` (payment_due → warning + "Pagar agora"; suspended → danger sem CTA; active na janela → warning + "Renovar mensalidade" com o título "Mensalidade vence hoje/amanhã/em N dias", contado em dias de CALENDÁRIO DO BRASIL (offset fixo UTC-3, nunca o fuso do aparelho, para o texto bater com a notificação do servidor). `PlayerOverview` renderiza o alerta antes dos demais e o CTA chama `payment.charge.createCharge({ sourceId: membershipId, sourceType: "league_membership" })` navegando para `/checkout/[chargeId]`. No checkout, PAID e EXPIRED mostram "Gerar novo Pix" quando a origem da charge é `league_membership` e a membership dela é cobrável (`canRegenerate` de `payment.charge.listMine`); o gatilho é a membership, não a charge aberta, então renovar funciona a partir de qualquer charge dela (inclusive uma EXPIRED antiga). Erro vira toast e, quando o servidor cria outra charge, a tela faz `router.replace` para ela (reaproveitando a PENDING existente quando houver).
- **BUG-0042 (20/09/2026):** o aviso do suspenso no `GuestOverview` caiu junto com o card de features no corte de conteúdo do IBX-0071 e a página ficou MUDA para o membro suspenso (que segue no papel guest). Restaurado: `buildLeagueGuestOverviewAlert({ now, reminderDaysBefore, status })` isola o único sub-estado de visitante que tem o que avisar — `suspended` → o mesmo alerta danger do `buildLeaguePaymentAlert`, sem CTA dentro do alerta — e o `GuestOverview` o renderiza ANTES da descrição da liga. `payment_due` e `active` continuam fora daqui (papel de membro, aviso no `PlayerOverview`: nunca dois avisos da mesma pendência). O caminho da ação é o rodapé de entrada: o suspenso TEM `viewerMembershipId` no `discovery.getById` (o servidor devolve a membership sem filtrar por status, `convex/functions/league/discovery.ts:158-166`), então `canResumeCheckout` → CTA habilitado → `handlePayPress` (charge PENDING em fast-path ou `createCharge`) → `/checkout/[chargeId]`, onde o `canRenew` do checkout cobre o suspenso (`src/lib/payments/checkout-view.ts:78,119`).
- **Cutover (20/09/2026, Etapa 2 do PLN-0008):** `buildLeaguePaymentAlert` e `buildLeagueGuestOverviewAlert` foram **EXTINTOS** — os avisos da casa da liga (jogador E visitante) vêm do item do servidor (`pendings.list` do escopo player, recortado pela liga/membership no bucket) pelo renderer único `PendingAlerts`, e o CTA de pagamento do item é a MESMA `payment.charge.createCharge` (`action: pay_league_membership`). O CTA de renovar do suspenso no rodapé segue igual. Ver `docs/spec/dashboard.md`, seção "Pendências em tela — Etapa 2".

### Cards do painel do organizador (overview por papel)
- **Status:** implementado, com renomeação admin → organizer
- **Data:** 26/06/2026
- **Referências:** `src/lib/leagues/organizer-overview-derived.ts` (renomeado de `admin-overview-derived.ts`) — builders puros: `buildOrganizerJoinRequestsAlert`, `buildOrganizerValidationsAlert`, `summarizeOrganizerPendingActions`, `buildOrganizerOccupationCard`, `buildOrganizerMonthlyMatchesCard`, `buildOrganizerOngoingChallengesCard`, `buildOrganizerActivityRateCard`; tipos `Organizer*`; re-exporta `ORGANIZER_ATTENTION_STATUSES`/`ORGANIZER_ONGOING_STATUSES`. `src/components/pages/leagues/organizer-overview.tsx` (renomeado de `admin-overview.tsx`) — lê `leagueId` via `useLocalSearchParams`, consome `bucket$.data.challenges/membershipOverview/league`, renderiza 2 `WidgetAlert` condicionais + grid 2×2 de `KpiCard` (ocupação, partidas no mês, desafios em andamento, taxa de atividade). `src/lib/leagues/challenge-tab-counts.ts` — alias para os conjuntos do domínio backend (`challenge-status.ts`, evita drift). Status: `ORGANIZER_ATTENTION_CHALLENGE_STATUSES` = `pending_organizer_challenge_validation`, `pending_organizer_result_validation`, `pending_organizer_decision`, `pending_result_correction` (challenge-status.ts linhas 104-110). `src/components/pages/leagues/player-overview.tsx` + `src/lib/leagues/player-overview-derived.ts` (posição, partidas no mês, último jogo, alerta de inatividade, ações pendentes) e `guest-overview.tsx` (usa `buildPreviewFeatures`) — renderizados por papel em `[leagueId]/index.tsx`. Testes: `organizer-overview-derived.test.ts`.
- **Decisões:** validações pendentes consolidadas num único alerta; solicitações de ingresso separadas (levam à tela Requests); taxa de atividade defensada contra divisão por zero; status sets reutilizados por exportação com origem no domínio Convex.

### Descoberta e participação (público)
- **Status:** implementado
- **Data:** 19/05/2026
- **Referências:** `convex/functions/league/discovery.ts` (`getById`, `listAvailable`, `listParticipating`), `convex/domains/league/discovery-list.ts` (busca sem acento, `getActiveMembershipLeagueIds`), `src/app/(private)/(tabs)/search.tsx` (busca com `listAvailable` + filtro local), `(tabs)/index.tsx` e `(tabs)/competitions.tsx` ("Minhas Competições", ex-`ligas.tsx`; grid do jogador via `listParticipating` da liga e do torneio; cards "Nova liga"/"Novo torneio" para organizador via `CreateCompetitionCard`), `src/components/pages/leagues/league-join-footer.tsx` (join + checkout/status), `convex/functions/league/membership.ts` (`requestJoin`, `approve`, `reject`, `remove`).
- **Decisões:** discovery completo com visibilidade (`isLeagueDiscoverableVisibility`, privadas só para o organizador), contagem de ativos (`activePlayerCount`), estado do viewer (`viewerMembershipId/Status`) e join com fluxo de pagamento. **Ligas pagas** (Woovi/PIX) com `approvalMode auto|manual`, `monthlyPriceCents`, `maxPlayers`, `gracePeriodDays`, `reminderDaysBefore` e status de membro `awaiting_payment|payment_due|suspended` (config em `settings.tsx` do form, checkout em `src/app/(private)/checkout/[chargeId]/`; fee da plataforma em `DECISAO-004` no `contract.ts`).
- **Como funciona:** jogador entra por `search` (listAvailable), pede entrada (`requestJoin`), organizador aprova/recusa (`approve`/`reject`); em liga paga, entrada vira checkout (`awaiting_payment`) ou fila (`pending`) conforme `approvalMode`; `listParticipating` alimenta a Home do jogador e a aba Minhas Competições (junto com `tournament.discovery.listParticipating`).

### Upload de perfil do jogador (cleanup centralizado)
- **Status:** implementado
- **Data:** 26/06/2026
- **Referências:** `src/lib/uploads/convex-storage-upload.ts` — `uploadImageToStorage({ file: CroppedImage, uploadUrl })` → `{ storageId }`, POST `UploadType.BINARY_CONTENT` via `expo-file-system`, valida 2xx, parseia JSON, lança `Error` genérico "Não foi possível enviar a imagem.". `src/app/(private)/settings/player/profile.tsx` — máquina de upload inline removida; `uploadPendingAvatar` wrapper fino (gera upload URL via `crpc.player.profile.generateUploadUrl`, chama o helper, seta `avatarStorageId`, limpa `avatarDraftUri` e `pendingAvatarFile`); toast próprio "Não foi possível enviar o avatar. Verifique sua conexão e tente novamente." (linhas 175-179); crop com `PLAYER_AVATAR_CROP_TARGET` (width 900) + `ImageCropper` (aspect 1:1). `src/lib/leagues/league-form-controller.tsx` — `uploadPendingMedia` itera `LEAGUE_MEDIA_KINDS` (`["avatar", "cover"]`). Consumidores além do jogador: organização usa o mesmo helper para logo (`organization-form-fields.tsx`, `settings/organization/profile.tsx`, `onboarding.tsx`). Domínio player: `convex/domains/player/contract.ts` (`upsertPlayerProfileSchema` com `avatarStorageId` + `collectReplacedPlayerAvatarStorageIds`), `tables.ts` (`playerProfile.avatarStorageId`), `identity.ts` (`buildPlayerDisplayName` — fallback "Jogador#XXXX"). Teste: `convex/domains/player/tests/profile-media.test.ts`.
- **Decisões:** helper sem classe de erro customizada; callers mantêm o texto do toast; cleanup de storage antigo via `collectReplacedStorageIds` (`convex/shared/media-rules.ts`).

### Upload de mídia da liga (capa + avatar)
- **Status:** implementado
- **Data:** 17/06/2026
- **Referências:** `convex/domains/league/tables.ts` — `league.coverStorageId`, `league.avatarStorageId`; `convex/domains/league/contract.ts` — `DEFAULT_LEAGUE_STORAGE`, `LEGACY_DEFAULT_LEAGUE_STORAGE_IDS`, `collectReplacedLeagueStorageIds`, `LeagueMediaStorageIdSchema`; mídia no `CreateLeagueSchema`/`UpdateLeagueSchema`/`leagueSchema`. `convex/functions/league/management.ts` — `generateUploadUrl` (`authMutation`, `requireActiveManager`), serialização com `resolveStorageUrl` + `isDeletableLeagueStorageId`, cleanup `deleteStorageIds(ctx, collectReplacedLeagueStorageIds(...))` no update (linha 212) e delete (linha 246). `convex/functions/league/discovery.ts` — mesma resolução de URLs para leitura pública. `src/lib/leagues/league-form-controller.tsx` — `LEAGUE_MEDIA_CROP_CONFIG`: avatar 1:1 (900×900), cover 16:9 (1600×900) (linhas 66-79); fluxo picker → `cropImage` com `buildLeagueMediaCropConfig(kind)` → preview → upload no save. `src/app/(private)/settings/leagues/[mode]/index.tsx` — banner/avatar tappable ("Alterar Banner"). `src/components/pages/leagues/form-defaults.ts` — defaults de mídia no create; `form-schema.ts` estende contrato. `src/app/(private)/leagues/[leagueId]/index.tsx` — `LeagueBanner` renderiza `league.coverUrl`. Teste: `convex/domains/league/tests/media-storage.test.ts`.
- **Decisões:** storage IDs persistidos, URLs resolvidas no read; ids placeholder legados excluídos do cleanup; crop in-app (16:9/1:1) porque `expo-image-picker` não honra ratio arbitrário no iOS. O mesmo helper de upload serve organização (logo).

### Modelo de dados e API do domínio (base)
- **Status:** implementado
- **Data:** 19/05/2026
- **Referências:** `convex/domains/league/` — `contract.ts`, `tables.ts`, `relations.ts`; regras puras em módulos especializados: `challenge-rules.ts` (deadlines, validação de score, ranking, restauração com snapshot), `challenge-status.ts` (conjuntos de status), `membership-rules.ts`, `discovery-list.ts`, `challenge-form.ts`, `challenge-scheduling-rules.ts` (dia da semana, `buildScheduledDate`, overlap de intervalos). Tabelas (`tables.ts`): `league` (com `courts` JSON, `monthlyPriceCents`, `approvalMode`, `gracePeriodDays`, `reminderDaysBefore`, `platformFeePercent`), `leagueMembership` (com `rankingPosition`), `leagueChallenge` (com `matchConfigSnapshot`, `rankingSnapshotBeforeResult`/`AfterResult`, `rankingAppliedAt`), `leagueChallengeProposal` (`matchDate`, `startMinute`, `endMinute`, `courtId`, `responseDeadlineAt`, `revisionNumber`), `leagueChallengeResultSubmission` (`score`, `winnerMembershipId`, `reviewAction`), `leagueChallengeOrganizerAction` (auditoria `fromStatus`/`toStatus`/`reason`). **Não existem** tabelas `leagueSeason` nem `leagueRankingEvent`: a posição vive em `membership.rankingPosition` e a auditoria em `leagueChallengeOrganizerAction`. `convex/functions/league/` — `management.ts`, `membership.ts`, `challenges.ts` + submódulo `_challenges/` (`proposals.ts`, `ranking.ts`, `record_guards.ts`, `scheduling_guards.ts`, `serializers.ts`, `status_helpers.ts`, `types.ts`, `notifications.ts`), `discovery.ts`. Rotas: públicas em `src/app/(private)/leagues` (`index`, `[leagueId]/index|ranking|challenges|requests|rules|schedule`) e gestão em `src/app/(private)/settings/leagues` (`index`, `[mode]/settings|index|location|rules|courts|categories`).
- **Status de desafio** (`LeagueChallengeStatusOptions`): `pending_opponent_response`, `pending_creator_reapproval`, `pending_organizer_challenge_validation`, `confirmed`, `pending_cancellation_acceptance`, `pending_result_submission`, `pending_result_confirmation`, `pending_organizer_result_validation`, `pending_result_correction`, `pending_organizer_decision`, `finished`, `declined`, `cancelled` (+ `invalidated` em conjuntos).
- **Seed** de cenários: `convex/domains/seed/plan.ts` + `data.ts` + `contract.ts` (`SeedPreviewSchema`), acionado por `shouldSeedScenarioLeagues` em `convex/functions/seed.ts` (linha 1455).

## Não implementado / Parcial

### Manutenção programada de ligas (expirar desafios, inatividade, reset)
- **Status:** nao implementado
- **Evidência:** `convex/functions/crons.ts` só registra jobs de pagamento/notificação (`expire-stale-charges`, `send-renewal-reminders`, `reconcile-charges`, `sweep-stale-deliveries`, `refresh-subaccount-balances`, `sweep-pending-withdraw-fees`). Não há cron/job para expirar desafios sem resposta, marcar partidas atrasadas como walkover ou aplicar penalidade de inatividade; não há `convex/functions/league/maintenance.ts`. O enforcement de inatividade segue config-only. Flags (`matchDeadlineDays`, `inactivityDropDays`, `inactivityBottomDays`, `resetLimitsMonthly`) não existem no contrato atual. Semânticas planejadas no modelo original: 15 dias de inatividade → cai 1 posição; 30 dias → fim do ranking; reset mensal de contadores por membro (as opções `drop_one_position`/`move_to_ranking_end` existem em `LeagueInactivityPenaltyTypeOptions`, sem enforcement).

### Notificações push de desafio
- **Status:** implementado (o push chega; o que não existe é BOTÃO nele) — os 18 eventos `league.challenge.*` têm emissor vivo em `convex/functions/league/challenges.ts`, todos passando pelo helper `convex/functions/league/_challenges/notifications.ts:8`, e percorrem o MESMO pipeline de feed + push do resto do app: `notification.orchestrator.createForRecipients` cria a linha em `notificationFeed` e as `notificationDelivery` por device (`convex/functions/notification/orchestrator.ts:270` e `:313`) e `sendPending` (`:517`) envia ao Expo. O que NÃO existe para esses eventos é categoria de push (nenhum tem `categoryId`: `convex/shared/notifications/protocol.ts:64-69`), ou seja o push do sistema não traz botão; o item da central carrega ação desde o IBX-0077 (`docs/spec/notifications.md`).

### Geração automática de slots a partir da disponibilidade de quadras
- **Status:** nao implementado (fora de escopo mantido) — o agendamento usa os slots escolhidos manualmente nas propostas, com checagem de conflito (`listOccupiedSlots`, `isChallengeSlotBlocked`, `challenge-scheduling-rules.ts`).

### Ledger de ranking (`leagueRankingEvent`) — trilha de todas as mudanças de posição
- **Status:** nao implementado
- **Evidência:** não existe tabela `leagueRankingEvent`. Hoje o ranking é auditado apenas parcialmente: snapshots por resultado (`rankingSnapshotBeforeResult`/`AfterResult` no `leagueChallenge`) e ações do organizador (`leagueChallengeOrganizerAction`). Movimentações por aprovação/remoção de membro e reordenação manual (`reorderRanking`) **não têm trilha persistida** — o modelo original previa registrar toda mudança de posição.

### Temporadas (`leagueSeason`)
- **Status:** nao implementado (conceito do modelo original adiado)
- **Evidência:** não existe tabela `leagueSeason`; sazonalidade não é modelada. O modelo original listava a tabela e o slice de criação explicitava "não reintroduzir nesse slice" — sem registro de decisão posterior (siga como pendência de produto).

### Templates de liga e versionamento de regras (`ruleVersion`)
- **Status:** nao implementado
- **Evidência:** o modelo original previa `ruleVersion` + `ruleConfig` armazenados para permitir futuros templates de liga sem mudança de schema; hoje o modo é fixo `challenges` e o campo `ruleVersion` não existe no contrato.

### Rematch / exceções por data de quadra / taxa de quadra / reservas
- **Status:** nao implementado (fora de escopo, segue fora; sem código correspondente).

## Decisões tomadas

- **Ownership por organização:** liga pertence a `organization` (`league.organizationId`, cascade delete) e o acesso do organizador passa por `requireActiveManager(ctx)` — evoluiu do `managerUserId`.
- **Modelo de roles do detalhe:** `guest | player | organizer`, com `canOpenSchedule` condicionado a `scheduleVisibility`.
- **Store único Legend-State v3 com buckets por `leagueId`:** React Query é fonte da verdade do servidor; deriveds puros em `src/lib/leagues/*-derived.ts` (testados). `reset()` zera o bucket e **INCREMENTA** `identity.resetVersion` (versão monotônica, nunca um binário 0/1 que volta ao mesmo valor): é a mudança que os efeitos de hidratação do layout observam para re-hidratar.
- **Regras editáveis após criação:** o travamento de regras na edição foi abandonado; `update` aceita `ruleConfig` completo.
- **Roteamento do editor por `[mode]`:** create/edit compartilham o cluster `/settings/leagues/[mode]` com 6 tabs.
- **Cancelamento de desafio negociado:** pedido com aceite do outro lado (`pending_cancellation_acceptance`) substituiu o cancelamento unilateral.
- **Vocabulário "organizer" em vez de "admin"** nos estados e ações (ex.: `pending_organizer_challenge_validation`, `organizerManage`).
- **Media real via storage do Convex:** picker + crop + upload diferido no submit; placeholders antigos viraram IDs legados de limpeza.
- **Ligas pagas (Woovi/PIX)** com aprovação auto/manual, carência, lembretes, fee de plataforma (`DECISAO-004`) e checkout dedicado.
- **Imutabilidade da configuração da partida dentro do desafio:** `matchConfigSnapshot` no `leagueChallenge`; placar validado contra o snapshot, nunca contra a config atual da liga.
- **Ações do organizador auditadas:** `leagueChallengeOrganizerAction` registra ação, status de origem/destino e autor.
- **Contrato Zod como fonte da verdade** (`convex/domains/league/contract.ts`), com serializers aplicando fallbacks para docs legados; código gerado por codegen (kitcn/CRPC).
- **Regras puras e testáveis** em `convex/domains/league/*` sem contexto Convex; funções deployáveis finas em `convex/functions/league/` (com submódulo `_challenges/`).
- **Agenda fora da floating tab bar**, acessível pelo menu `⋮`; visibilidade `public`/`members_only` no `ruleConfig`.
- **W.O. espelha o torneio:** mesmo payload (1 set placeholder 0-0 + flag `walkover` no score) e regra M4 de vencedor ∈ lados (`resolveWalkoverScoreError`); sem estado novo no lifecycle — confirmação do perdedor ou organizador arbitra. `walkoverBehavior` da liga governa o efeito (`automatic_loss_and_move_to_end` manda o perdedor pro fim; `cancel_challenge` rejeita W.O. como resultado).
- **Editor único de resultado publicado:** o organizador corrige placar/vencedor/W.O. de desafio `finished` via `organizerSubmitResult`; edição gera auditoria `leagueChallengeOrganizerAction` (`edit_result`, reason JSON before/after) + `league.challenge.result_edited`; ranking restaura snapshot e reaplica com o novo resultado.
- Migrações idempotentes e versionadas em `convex/functions/migrations/` (12 arquivos, incl. rename de status e de scoring).

## Próximos passos

- **Jobs de manutenção de liga** (expirar desafios sem resposta, penalidade de inatividade, reset mensal) — sem evidência de implementação; a penalidade de inatividade segue config-only.
- **`platformFeePercent`** na tabela `league` sem superfície de UI (comentário no código: "no app surface exposes this yet", `convex/domains/league/contract.ts:189`).
- **Notificações de desafio** existem como helper (`convex/functions/league/_challenges/notifications.ts`) mas integração de push nativo não foi verificada.
- **Reembolso automático (estorno Woovi)** — fluxo não existe no app hoje;
  nasce na feature de torneios e depois se aplica às ligas (BAC-0002;
  design em `docs/spec/tournaments.md`).
- **Pasta vazia** `src/components/pages/leagues/form/rules 2/` (cruft de refactor — sem arquivos).
- Divergência cosmética: label "Somente jogadores" vs "Somente membros" (código manda).

## IBX-0071 / PLN-0007 · FASE 2 — overview charts-first (19/09, sem commit)

Cortes e gráficos aprovados no doc v2, compostos sobre o bucket existente (zero backend):

- **Jogador (`player-overview.tsx`):** KPIs "Partidas" e "Última partida como stat" SAÍRAM. Novo widget "Seu desempenho": **RadialChart** de win rate (`buildPlayerWinRate`, todos os desafios finalizados do viewer) + **BarChart** V/D por mês (`buildPlayerMonthlyWinLoss`, janela de 6 meses, vencedor do `latestResultSubmission.winnerMembershipId` já resolvido pelo servidor). A última partida vira **linha de feed** (`bg-surface-secondary`) e o pé ganha CTAs "Ver ranking" e "Desafiar".
- **Organizador (`organizer-overview.tsx`):** KPIs "Partidas" e "Desafios em andamento" SAÍRAM (duplicação/estado). Entram **AreaChart "Partidas por mês"** (`buildOrganizerMonthlyMatchesSeries`, 6 meses, meses vazios com zero) e **TrendChip** na Atividade (`buildOrganizerActivityTrend`: % do mês vs mês anterior, mesma amostra do ranking). Alertas ganharam ação "Ver" → `requests`.
- **Refactor:** `buildOrganizerActivityRateCard` e o novo `buildOrganizerActivityTrend` compartilham a MESMA fórmula (`computeActivityRate` por janela `[start, end)`): o KPI do mês usa janela aberta, o trend compara mês corrente vs anterior. O delta real do refactor em comportamento é o DENOMINADOR: antes contava `ranking.length` (membros duplicados na lista inflavam a base), agora conta `Set.size` dos ids do ranking (dedup) — os DOIS lados do desafio (challenger e challenged) sempre entraram no conjunto de quem jogou, desde a origem do helper; não houve correção de contagem de lados.
- **Posição por tempo (LineChart):** `rankingSnapshotAfterResult` NÃO é exposto em `listForLeague` (output `leagueChallengeSchema` não tem o campo) — composição de posição histórica NA LIGA ficou **EXIGE LÓGICA** (exposição no output); o histórico de posição entregue ao jogador vem do agregado novo `player.dashboard.getOverview` (ver docs/spec/dashboard.md).
- **Testes:** `organizer-overview-derived.test.ts` (série mensal tz-safe + trend up/down/neutral), `player-overview-derived.test.ts` novo (win/loss mensal + win rate).

## IBX-0071 / PLN-0007 · PLANO DE CONTEÚDO FECHADO — texto simples (19/09, sem commit)

O usuário fechou o conteúdo da casa da liga item a item: KPIs e charts viram LINHAS DE TEXTO SIMPLES (rótulo + valor, classes tipográficas já usadas no app, valor sem dado = 0). SUPERSEDE a seção FASE 2 acima (overview charts-first) nos pontos conflitantes. Nenhum componente ou estilo novo; nenhuma query nova; floating tabs e `LeagueJoinFooter` SEM mudança.

- **Jogador (`player-overview.tsx`):** os 3 WidgetAlerts (mensalidade com ação Pagar, inatividade, pendências de desafio) FICAM. Textos: "Posição" (`#N de M`; "0" sem posição), "Partidas no mês" (última linha de `buildPlayerMonthlyWinLoss` = mês corrente, que entra com zero), "Desempenho" (`XV · YD` de `buildPlayerWinRate`, zero quando sem partida).
- **REMOVIDOS do jogador:** widget "Seu desempenho" (RadialChart + BarChart), feed "Última partida", CTAs "Ver ranking"/"Desafiar", KPI "Desafios no mês" (não marcado no plano). Deriveds extintas com corte limpo: `buildPlayerLastMatchCard`, `buildPlayerMonthlyChallengesCard` (+ helpers só delas) e seus testes.
- **Organizador (`organizer-overview.tsx`):** textos "Receita da liga" (soma no cliente do `bySource` de `payment.dashboard.getRevenueSeries` com `sourceType === "league_membership"` filtrado pelos membershipIds da liga — ranking + solicitações pendentes; janela 12 meses; charges de memberships cancelados ficam fora), "Inscritos" (ativos, `N/limite` quando há limite) e "Partidas no mês" (`buildOrganizerMonthlyMatchesSeries`, mês corrente).
- **REMOVIDOS do organizador:** WidgetAlerts de aprovações/validações (com suas ações), TrendChip da Atividade, KPI "Ocupação", AreaChart "Partidas por mês". Deriveds extintas: `buildOrganizerJoinRequestsAlert`, `buildOrganizerValidationsAlert`, `summarizeOrganizerPendingActions`, `buildOrganizerOccupationCard`, `buildOrganizerActivityRateCard`, `buildOrganizerActivityTrend`, `computeActivityRate` (+ testes; a série mensal e seu teste ficam).
- **Guest (`guest-overview.tsx`):** só a descrição da liga. REMOVIDOS: card de features (`lib/leagues/league-preview-features.ts` extinto) e WidgetAlert de pagamento dos sub-estados guest — o alerta do SUSPENSO voltou depois (BUG-0042, acima) porque o membro suspenso segue no papel guest e ficou sem nenhum sinal na página. O rodapé de entrada (chip de vagas + preço + CTA) permanece como estava.

## IBX-0074 r24 · CUTOVER DO RODAPÉ GUEST — JoinFooter global (20-09, sem commit)

Pedido direto do usuário ("aproveita e já coloca o JoinFooter na liga agora"). O **`LeagueJoinFooter` está EXTINTO** (arquivo removido; zero consumidores — grep prova). A casa da liga monta o **`JoinFooter` em modo LIGA** (sem `categories` → o CTA dispara `onAction` DIRETO, o painel nunca abre; r5 do componente).

- **Wiring na página (`leagues/[leagueId]/index.tsx`):** TODO o fluxo migrou do componente pra tela (padrão do torneio) — `requestJoin` (com intents request/cancel, updates otimistas no bucket e rollback no erro), `createCharge`, pre-fetch da `pendingCharge` com fast-path pro checkout, dialog de cancelar solicitação, toasts por status resultante (`getJoinSuccessToast`) e invalidate de discovery/membership/challenges. Helpers de rótulo viraram funções de módulo da tela (`getJoinFooterActionLabel`, `getJoinSuccessToast`).
- **Gate e ação idênticos ao antigo:** monta só para `role === "guest"` com league carregada; CTA = `joinActionLabel` derivada (ou "Sem vagas" sem vagas e sem pedido pendente); caminho de pagamento (`canResumeCheckout` + membershipId) tem CTA sempre habilitado (desabila só em voo) e o caminho de join desabilita com `!canRequestJoin || !hasAvailableSpots`. O **X de cancelar solicitação** (pending/awaiting_payment) entra pela prop NOVA `actionTrailing` do JoinFooter (fora do `isActionDisabled` de propósito — precisa responder mesmo com CTA desabilitado; o `isDisabled` do MorphButton só trava o press da raiz).
- **Padding:** `footerClassName="pb-floating-tab-bar-4"` — a floating tab bar do cluster da liga EXISTE pra visitante (mesma sobreposição que o torneio tinha no r16).
- Visual da pílula herda o design final do componente (chip de vagas success, preço com sufixo do intervalo via `formatLeaguePriceParts`, CTA sm). `GuestOverview` intocado.
- **Fix H1 do review (20-09): o gate de lotada/`!canRequestJoin` agora vale DENTRO do CTA** (`join-footer.tsx:222-228`): o `isDisabled` do MorphButton trava só o press da raiz (`morph-button.js:146`), então na liga lotada a pílula mostrava "Sem vagas" mas o toque disparava mutate → recusa → toast de erro (o rodapé antigo era inerte). O `isDisabled` do botão soma o gate SO no modo liga (`!hasCategories`); torneio/galeria inalterados.

## QA no simulador (20-09, sem commit) — BUG-0046 (KPI Posição)

- **BUG-0046:** o KPI "Posição" da casa da liga montava o texto literal
  "#undefined de 0" quando o jogador não tinha posição no ranking.
  `buildPlayerPositionCard` (`lib/leagues/player-overview-derived.ts:29-46`) só
  tratava `null` como "sem posição" — `undefined` passava e o card saía com
  `position: undefined`. Agora o guarda é de TIPO (`typeof input.viewerPosition
  !== "number"`): `null` e `undefined` são o MESMO estado explícito da derived e
  o card volta `null`; a tela usa o guarda explícito `position === null`
  (`pages/leagues/player-overview.tsx:74-81`, não mais a veracidade do objeto) e
  segue mostrando "0" sem posição. Com posição nada muda (`#1 de 3`). Prova: 3
  casos em `player-overview-derived.test.ts` (`undefined` → `null`, `null` →
  `null`, valor → card com `position`/`totalPlayers`).
