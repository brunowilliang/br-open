# Agenda de Jogos da Liga

**Data:** 2026-06-26
**Status:** Design (aguardando aprovação)

## Visão geral

A liga ganha uma tela de **Agenda** que mostra os desafios confirmados
agrupados por dia e por período do dia (manhã/tarde/noite). O objetivo é dar uma
visão rápida de "quem vai jogar hoje" e nos próximos dias.

A Agenda é uma tela própria (estilo da tela de Regras), acessível via item no
menu `⋮` da Visão Geral. Não entra na floating tab bar.

Um admin pode configurar, em **Ajustes**, se a agenda é pública (todos veem,
inclusive visitantes) ou restrita a membros.

## Decisões confirmadas

- **Tela própria** (rota standalone `/leagues/[leagueId]/schedule`), mesmo
  padrão da tela de Regras (`Page.Header` com back + título, `Page.ScrollView`).
- **Ponto de entrada:** item "Agenda" no menu `⋮` da Visão Geral, logo abaixo
  de "Regras".
- **Apenas desafios confirmados** (status `confirmed`) com `matchDate >= hoje`.
- **Janela de datas:** controlada por um select ao lado das tabs
  (`7 dias` / `15 dias`). As tabs de data refletem a escolha.
- **Sempre abre em "Hoje".**
- **Card simplificado:** fotos sobrepostas à esquerda + `NOME x NOME` +
  `HH:MM · Quadra`. Sem chip de status, menu ou placar.
- **Toque no card:** somente visualização (nenhuma ação).
- **Agrupamento por período:** manhã (00h–11h59), tarde (12h–17h59), noite
  (18h–23h59). Apenas períodos com jogos são renderizados.
- **Visibilidade configurável:** admin define em Ajustes se a agenda é
  `public` ou `members_only`. Padrão `public`.
- **Arquitetura de dados:** nova query `league.challenges.listScheduled` com
  payload enxuto (Opção B).

## Modelo de dados

### Flag de visibilidade (ruleConfig)

Adiciona um campo ao `ChallengeRuleConfigSchema` em
`convex/domains/league/contract.ts`:

```ts
export const LeagueScheduleVisibilityOptions = ["public", "members_only"] as const;

// dentro de ChallengeRuleConfigSchema:
scheduleVisibility: z
  .enum(LeagueScheduleVisibilityOptions)
  .default(DEFAULT_LEAGUE_SCHEDULE_VISIBILITY),
```

- `DEFAULT_LEAGUE_SCHEDULE_VISIBILITY = "public"` (junto aos outros defaults no
  mesmo arquivo).
- Documentos legados sem o campo caem no default via `.default()` — sem
  breaking change, sem migração de dados necessária.
- `DEFAULT_LEAGUE_RULE_CONFIG` recebe `scheduleVisibility: "public"`.
- A serialização em `serializeLeagueRecord` (`convex/functions/league/challenges.ts`)
  deve aplicar o fallback, no mesmo espírito de `challengeValidationMode` /
  `resultValidationMode`:

```ts
ruleConfig: {
  ...record.ruleConfig,
  scheduleVisibility:
    record.ruleConfig?.scheduleVisibility ?? DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
  challengeValidationMode: ...,
  resultValidationMode: ...,
}
```

### Nova query `league.challenges.listScheduled`

No mesmo arquivo `convex/functions/league/challenges.ts`, reusando os helpers
existentes (`getLeagueRecordOrThrow`, `serializeParticipant`, `serializeProposal`
para `courtName`/`matchDate`/`startMinute`).

**Input:** `LeagueByIdSchema` (`{ leagueId }`).

**Output (novo schema enxuto):**

```ts
export const leagueScheduleItemSchema = z.object({
  id: z.string().min(1),
  matchDate: z.string().min(1),
  startMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
  courtName: z.string().min(1),
  challenger: z.object({
    fullName: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
  challenged: z.object({
    fullName: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
});
```

Definido em `convex/domains/league/contract.ts` junto aos outros schemas de
challenge.

**Lógica de acesso (diferente de `listForLeague`):**

1. `getLeagueRecordOrThrow` carrega a liga.
2. Resolve o contexto do viewer sem exigir membership:
   - Se `ruleConfig.scheduleVisibility === "public"` → qualquer usuário
     autenticado pode ver (inclui visitantes).
   - Se `"members_only"` → exige owner ou participante ativo (reusa
     `getViewerContextOrThrow`, que já lança `FORBIDDEN` se não for).
3. Busca challenges da liga (`leagueChallenge.findMany`, `limit: 500`).
4. Filtra pelo **stored status** (`challenge.status === "confirmed"` no
   registro do DB) **E** `matchDate >= todayUtc` (data de hoje no formato
   `YYYY-MM-DD` UTC — mesmo formato de `matchDate`, então comparação de string
   funciona). Usar o stored status (e não o derivado) mantém a query simples e
   barata: não é preciso carregar result submissions só para derivar status.
   Para a agenda, um jogo confirmado cujo horário já passou hoje mas ainda sem
   placar continua aparecendo — isso é o comportamento desejado (ele estava
   agendado para hoje).
5. Ordena por `matchDate` asc, depois `startMinute` asc.
6. Para cada item restante, carrega o `currentProposal` (já necessário para
   `matchDate`/`startMinute`/`courtName`) e os memberships dos dois
   participantes, e serializa no schema enxuto. Não serializa proposals
   completas/resultados — só o necessário.

Observação: o filtro por data janela (7/15 dias) é feito **client-side** na
tela de Agenda, não na query. A query retorna tudo a partir de hoje; a UI
restringe a janela selecionada. Isso mantém a query simples e permite trocar a
janela sem refetch.

### Acesso derivado

Em `src/lib/leagues/league-details-derived.ts`:

- Novo campo `canOpenSchedule: boolean` em `LeagueDetailsAccess`.
- Lógica:

```ts
canOpenSchedule:
  league.ruleConfig.scheduleVisibility === "public"
    ? true
    : role === "participant" || role === "owner",
```

- `buildLeagueDetailsCanOpenLeagueMenu` passa a incluir `access.canOpenSchedule`
  (assim o item de menu aparece quando o viewer pode abrir a agenda).

## UI

### Rota nova

`src/app/(private)/leagues/[leagueId]/schedule.tsx`:

- Mesmo padrão da tela de Regras: `Page.Header` (back + título "Agenda"),
  `Page.ScrollView`.
- Registrada em `LEAGUE_DETAIL_SCREEN_NAMES` no `_layout.tsx` (igual `rules`),
  **sem** entrar na floating tab bar.
- `useEffect(() => bucket$.actions.setActiveRoute("schedule"))`.
- Tipo `LeagueDetailsRoute` ganha `"schedule"`.

### Ponto de entrada

Em `src/app/(private)/leagues/[leagueId]/index.tsx`, no menu `⋮` do header,
adiciona item "Agenda" logo abaixo de "Regras". Visível quando
`access.canOpenSchedule`. Navega para `/leagues/[leagueId]/schedule`.

### Layout da tela

```
┌─────────────────────────────────────┐
│  <            Agenda                │  header
├─────────────────────────────────────┤
│  [Hoje][Sex 27][Sáb 28]...  [7 dias▾│  tabs de data + select de janela
├─────────────────────────────────────┤
│  MANHÃ                              │  cabeçalho de período
│  ┌─────────────────────────────────┐│
│  │ ◉◉  João x Maria                ││  ScheduleCard
│  │     09:00 · Quadra Central      ││
│  └─────────────────────────────────┘│
│  TARDE                              │
│  ┌─────────────────────────────────┐│
│  │ ◉◉  Pedro x Ana                 ││
│  │     14:00 · Quadra 2            ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

- **Tabs de data:** geradas dinamicamente (`buildScheduleDateTabs`), de "Hoje"
  até `Hoje + windowDays - 1`. Sempre abre em "Hoje". Cada tab mostra o rótulo
  do dia ("Hoje", "Amanhã", ou `"Sex 27"` — dia da semana + dia).
- **Select de janela:** `7 dias` / `15 dias`, ao lado direito das tabs. Trocar
  regenera as tabs (sem refetch — só restringe os dados já carregados).
- **Períodos:** manhã (00h–11h59), tarde (12h–17h59), noite (18h–23h59). Só
  renderiza períodos que têm jogos no dia selecionado.
- **Empty state por dia:** mensagem "Nenhum jogo neste dia."
- **Estados de loading/erro:** `LoadingState` / `ErrorState`, reusando os
  componentes existentes.

### ScheduleCard (novo componente)

`src/components/pages/leagues/schedule-card.tsx`:

- Versão simplificada do `ChallengeCard`.
- Reaproveita o layout das duas fotos sobrepostas à esquerda (mesmas classes
  do `ChallengeCard`: container `relative h-13 w-12`, avatares `size-8.5
  rounded-full border border-separator`).
- Conteúdo: `NOME x NOME` + `HH:MM · Quadra`.
- **Sem** chip de status, menu, placar ou `Menu`.
- Toque = sem ação (somente visualização; sem `onPress`).

### Helpers de view

`src/lib/leagues/schedule-view.ts`:

- `buildScheduleDateTabs({ today, windowDays })` →
  `Array<{ matchDate: string; label: string; isToday: boolean; isTomorrow: boolean }>`.
- `buildScheduleDayView({ challenges, matchDate })` →
  `{ morning: ScheduleItem[]; afternoon: ScheduleItem[]; evening: ScheduleItem[] }`,
  cada lista ordenada por `startMinute`.
- `buildScheduleWindowOptions()` →
  `[{ label: "7 dias", value: 7 }, { label: "15 dias", value: 15 }]`.
- Constantes de períodos:
  - `MORNING`: `startMinute < 720` (12h).
  - `AFTERNOON`: `720 <= startMinute < 1080` (12h–18h).
  - `EVENING`: `startMinute >= 1080` (18h+).
- Formatação de hora (`formatMinute`) e rótulos de período reutilizam o estilo
  já existente em `challenges.tsx`.

### Renomeação de "Visibilidade" → "Visibilidade da liga"

Em `src/app/(private)/settings/leagues/[mode]/settings.tsx`:

- O `<Label>` da visibilidade (linha 170) muda de "Visibilidade" para
  "Visibilidade da liga".

### Configuração da agenda em Ajustes

Na mesma tela (`settings.tsx`), logo abaixo do campo de "Visibilidade da liga",
adiciona a configuração da visibilidade da agenda:

- `<Label>Visibilidade da agenda</Label>`
- `Select` com opções:
  - `{ label: "Aberta para todos", value: "public" }`
  - `{ label: "Somente membros", value: "members_only" }`
- Bound a `ruleConfig.scheduleVisibility` via `useWatch`/`setValue`, no mesmo
  padrão do campo de visibilidade da liga.
- `<Description>`: "Define quem pode ver os jogos agendados da liga."

A flag vive em `ruleConfig.scheduleVisibility` (decisão confirmada), acessada
na UI via `ruleConfig.scheduleVisibility`.

## Componentes e arquivos

### Novos

- `src/app/(private)/leagues/[leagueId]/schedule.tsx` — rota da agenda.
- `src/components/pages/leagues/schedule-card.tsx` — card simplificado.
- `src/lib/leagues/schedule-view.ts` — helpers de view (datas, períodos).

### Modificados

- `convex/domains/league/contract.ts` — `scheduleVisibility` no `ruleConfig`,
  novo schema `leagueScheduleItemSchema`, novos options/defaults.
- `convex/functions/league/challenges.ts` — `serializeLeagueRecord` fallback,
  nova query `listScheduled`.
- `convex/functions/_generated/api.ts` — gerado por codegen após adicionar a
  query.
- `convex/functions/generated/league/challenges.runtime.ts` — gerado por
  codegen.
- `src/lib/leagues/league-details-derived.ts` — `canOpenSchedule` no access,
  atualizar `buildLeagueDetailsCanOpenLeagueMenu`.
- `src/lib/leagues/league-details-store.ts` — tipo `LeagueDetailsRoute` ganha
  `"schedule"`.
- `src/app/(private)/leagues/[leagueId]/_layout.tsx` — registrar `schedule` em
  `LEAGUE_DETAIL_SCREEN_NAMES`.
- `src/app/(private)/leagues/[leagueId]/index.tsx` — item "Agenda" no menu `⋮`.
- `src/app/(private)/settings/leagues/[mode]/settings.tsx` — renomear label +
  adicionar config de visibilidade da agenda.
- `convex/shared/api.ts` — expor tipos da nova query, se necessário.

## Fluxo de dados

1. Usuário abre a Visão Geral da liga. O menu `⋮` mostra "Agenda" (se
   `canOpenSchedule`).
2. Usuário toca em "Agenda" → navega para `/leagues/[leagueId]/schedule`.
3. A rota busca `league.challenges.listScheduled({ leagueId })` via `useQuery`.
4. A query valida acesso (público ou membro conforme a flag), filtra
   confirmed + data >= hoje, retorna itens enxutos ordenados.
5. A tela chama `buildScheduleDateTabs` com a janela atual (7 ou 15) e
   `buildScheduleDayView` para o dia selecionado (default "Hoje").
6. Renderiza os períodos (manhã/tarde/noite) com `ScheduleCard`s.

## Tratamento de erros

- **Acesso negado (members_only + visitante):** a query lança `FORBIDDEN`.
  Como o item de menu é escondido via `canOpenSchedule`, o usuário nunca chega
  à rota por navegação normal. Defensivamente, um acesso direto à URL resulta
  no `ErrorState` padrão.
- **Loading:** `LoadingState` enquanto `challengesQuery.isPending`.
- **Erro de query:** `ErrorState` com mensagem "Não foi possível carregar a
  agenda."
- **Dia sem jogos:** mensagem inline "Nenhum jogo neste dia."

## Validação antes do handoff

- `git diff --check`
- `bun run typecheck`
- `bun test` (se houver lógica nova testável — `schedule-view.ts` é candidata)
- `bun run codegen` (após adicionar a query) + `bun run typecheck`

## Fora de escopo (follow-ups)

- Paginação/scroll infinito para datas muito distantes (a janela máxima atual
  é 15 dias, o que cobre o caso de uso sem paginação).
- Notificação/lembrete de "jogo hoje" (feature separada).
- Filtragem adicional na agenda (por quadra, por jogador).
