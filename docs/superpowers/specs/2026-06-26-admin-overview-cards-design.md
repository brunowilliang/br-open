# AdminOverview Cards — Design Spec

**Data:** 2026-06-26
**Status:** Aprovado (brainstorming)
**Escopo:** `src/components/pages/leagues/admin-overview.tsx` + novo módulo derivado.

## Objetivo

O `AdminOverview` hoje é um placeholder (`<Text>Modo admin</Text>`). Este design
define os cards/alertas do painel de **gestão** exibido quando `role === "owner"`
na tela de detalhes da liga.

O objetivo é dar ao administrador um painel de gestão: alertas de ação
imediata + pulso da liga (ocupação, partidas, andamento, atividade) +
capacidade (vagas).

## Não-escopo (YAGNI)

- Métricas financeiras (preço/cobrança) — fora deste painel.
- Configuração de regras — já acessível pelo menu Editar.
- Edição inline de membros — fica nas telas dedicadas (ranking/requests).

## Padrão a seguir

Espelhar `ParticipantOverview` fielmente:

- **Alertas condicionais empilhados** no topo (cada um um `WidgetAlert`
  independente, some quando `total === 0`).
- **Grid 2×2** de `WidgetCard` (`flex-row gap-3`, cada card `flex-1`).
- **Builders puros** num módulo `*-overview-derived.ts`, retornando `null`
  quando não aplicável. O componente não contém lógica de negócio.

## Arquitetura

Dois arquivos, no mesmo molde do participant:

1. **`src/lib/leagues/admin-overview-derived.ts`** (novo)
   - Builders puros, testáveis, sem React.
   - Inputs tipados (subsets mínimos dos tipos do Convex).
   - Retornam `null` quando não aplicável.

2. **`src/components/pages/leagues/admin-overview.tsx`** (reescreve o
   placeholder)
   - Lê do bucket$: `data.challenges`, `data.membershipOverview`,
     `data.league`.
   - Chama os builders, renderiza alerts + grid.
   - Nenhuma lógica de negócio inline.

### Fonte dos dados

O bucket$ já expõe tudo que o admin precisa (não há novos fetches):

- `bucket$.data.challenges` → `ChallengeItem[]`
- `bucket$.data.membershipOverview` → `MembershipOverview | null` (com
  `pendingRequests` e `ranking`)
- `bucket$.data.league` → `LeagueOverview` (com `ruleConfig`, `maxPlayers`)

`membershipOverview` já é hidratado quando `shouldFetchLeagueDetailsMembershipOverview`
é verdadeiro — e para `owner` ele sempre é (`canOpenRanking` e
`canOpenRequests` são `true`).

## Alertas

Espelham o participant: empilhados, condicionais, cada um um `WidgetAlert`.
Somem quando não há itens. Se a liga usa validação **automática**, os status
`pending_admin_*` não ocorrem e os alertas de validação naturalmente somem.

### 1. Solicitações de ingresso

- **Fonte:** `membershipOverview.pendingRequests.length`.
- **Condição:** `total > 0`.
- **Status:** `accent`.
- **Título:** `"{total} {jogadores|jogador} aguardando aprovação"`
  (pluralização pt-BR).
- **Descrição:** não há (a contagem já está no título), alinhado ao
  participant onde o alerta de ações pendentes usa o total no título e o
  detalhamento na descrição. Aqui o detalhamento seria só repetir nomes;
  mantemos sem descrição por simplicidade.

### 2. Validacões pendentes (consolidado)

- **Fonte:** desafios cujo status está em
  `ADMIN_ATTENTION_STATUSES` (o mesmo conjunto já definido em
  `challenge-tab-counts.ts`):
  - `pending_admin_challenge_validation`
  - `pending_admin_result_validation`
  - `pending_admin_decision`
  - `pending_result_correction`
- **Condição:** `total > 0`.
- **Status:** `warning`.
- **Título:** `"{total} {itens|item} precisando de atenção"`.
- **Descrição:** frase consolidada por *kind*, no mesmo estilo do
  `summarizePendingActions` do participant (conta por categoria e junta com
  `" · "`). Ex: `"2 desafios para validar · 1 resultado para aprovar"`.
- **Função `summarizeAdminPendingActions`:** classifica cada status num
  *kind* legível e conta:
  - `pending_admin_challenge_validation` → `"desafio(s) para validar"`
  - `pending_admin_result_validation` → `"resultado(s) para aprovar"`
  - `pending_admin_decision` → `"disputa(s) para decidir"`
  - `pending_result_correction` → `"placar(es) para corrigir"`

> Decisão de consolidação: ao contrário do participant (que tem 2 alertas
> de naturezas distintas — inatividade vs ações), aqui as validações
> pendentes são todas da mesma natureza (ação administrativa). Consolidá-las
> num único alerta evita ruído visual quando há múltiplos tipos. As
> solicitações de ingresso ficam separadas porque levam a uma tela diferente
> (Requests) e têm peso de aprovação de pessoa, não de partida.

## Grid 2×2 — Cards de métrica

Quatro `WidgetCard`, `flex-1`, duas colunas por linha.

### Card 1 — Ocupação

Combina "participantes ativos" + "vagas restantes" num único card (resolve
o desbalanceamento do grid quando há 5 cards e o caso `maxPlayers: null`).

- **Fonte:** `activeCount = membershipOverview.ranking.length`;
  `max = league.maxPlayers`.
- **Título:** `"{activeCount} ativos"`.
- **Descrição:** `max !== null ? "{max - activeCount} vagas restantes" :
  "vagas ilimitadas"`. Quando `activeCount >= max` (lotada):
  `"Liga lotada"`.
- **Ícone:** `UserGroup02Icon`.

### Card 2 — Partidas no mês

- **Fonte:** desafios `finished` com `finishedAt >= monthStart` (liga
  inteira — não filtrado por viewer).
- **monthStart:** `new Date(now)` com `setDate(1)` e horas zeradas (mesmo
  cálculo do participant).
- **Título:** `"{finishedCount} partidas"`.
- **Descrição:** `"disputadas este mês"`.
- **Ícone:** `Calendar03Icon`.

### Card 3 — Desafios em andamento

- **Fonte:** desafios cujo status está em `ADMIN_ONGOING_STATUSES` (mesmo
  conjunto de `challenge-tab-counts.ts`: `pending_opponent_response`,
  `pending_creator_reapproval`, `confirmed`,
  `pending_cancellation_acceptance`, `pending_result_submission`,
  `pending_result_confirmation`). Os status admin-attention vão para o
  alerta, não para este card (evita dupla contagem).
- **Título:** `"{ongoingCount} desafios"`.
- **Descrição:** `"em andamento"`.
- **Ícone:** `Target02Icon`.

### Card 4 — Taxa de atividade

- **Fonte:** membros ativos distintos (`ranking`) que participam de ao menos
  uma partida `finished` este mês.
- **Cálculo:**
  1. `activeMembershipIds = new Set(ranking.map(m => m.id))`
  2. `activePlayersThisMonth = Set` de `membershipId`s extraídos dos
     desafios `finished` este mês (`challenger.membershipId` e
     `challenged.membershipId`).
  3. `activeRate = activePlayersThisMonth ∩ activeMembershipIds / |
     activeMembershipIds |`.
- **Título:** `"{percent}%"` (inteiro arredondado).
- **Descrição:** `"dos jogadores ativos jogaram este mês"`.
- **Edge case:** se `activeCount === 0`, taxa é `0` (sem divisão por zero).
- **Ícone:** `TrendUp02Icon`.

## Tipos exportados (admin-overview-derived.ts)

```ts
export type AdminJoinRequestsAlert = { total: number };

export type AdminPendingActionKind =
  | "challenge_validation"
  | "decision"
  | "result_approval"
  | "result_correction";

export type AdminPendingAction = { kind: AdminPendingActionKind };

export type AdminValidationsAlert = {
  actions: AdminPendingAction[];
  total: number;
};

export type AdminOccupationCard = {
  activeCount: number;
  label: string; // "8 vagas restantes" | "vagas ilimitadas" | "Liga lotada"
};

export type AdminMonthlyMatchesCard = { finishedCount: number };

export type AdminOngoingChallengesCard = { ongoingCount: number };

export type AdminActivityRateCard = { activeCount: number; rate: number };
// rate ∈ [0,1]; 0 quando activeCount === 0
```

## Funções de builder (assinaturas)

```ts
buildAdminJoinRequestsAlert(input: {
  pendingRequestsCount: number;
}): AdminJoinRequestsAlert | null;

buildAdminValidationsAlert(input: {
  challenges: ChallengeItem[];
}): AdminValidationsAlert | null;

buildAdminOccupationCard(input: {
  activeCount: number;
  maxPlayers: number | null;
}): AdminOccupationCard;

buildAdminMonthlyMatchesCard(input: {
  challenges: ChallengeItem[];
  now: number;
}): AdminMonthlyMatchesCard;

buildAdminOngoingChallengesCard(input: {
  challenges: ChallengeItem[];
}): AdminOngoingChallengesCard;

buildAdminActivityRateCard(input: {
  challenges: ChallengeItem[];
  now: number;
  ranking: MembershipOverview["ranking"];
}): AdminActivityRateCard;

summarizeAdminPendingActions(actions: AdminPendingAction[]): string;
```

> Notas de nullabilidade: `buildAdminJoinRequestsAlert` e
> `buildAdminValidationsAlert` retornam `null` quando `total === 0` (para o
> render condicional `{x ? <WidgetAlert/> : null}`). Os builders de card de
> métrica sempre retornam valor (sempre há algo para mostrar); `rate` é
> defensado contra divisão por zero.

## Reuso de constantes

Os conjuntos de status `ADMIN_ATTENTION_STATUSES` e
`ADMIN_ONGOING_STATUSES` já existem em `challenge-tab-counts.ts` mas são
**privados** lá. Para evitar duplicação e drift, este design **exporta** esses
conjuntos de `challenge-tab-counts.ts` e os importa no módulo admin. Se a
exportação quebrar a coesão, a alternativa é movê-los para um
`challenge-status-groups.ts` compartilhado — mas prefiro a exportação
direta por YAGNI até haver um terceiro consumidor.

## Componente (admin-overview.tsx)

Estrutura de renderização (espelha participant):

```tsx
export function AdminOverview() {
  const bucket$ = getLeagueDetailsBucket$(leagueId); // via props ou hook
  const challenges = useValue(bucket$.data.challenges);
  const membershipOverview = useValue(bucket$.data.membershipOverview);
  const league = useValue(bucket$.data.league);
  const now = Date.now();

  const joinRequests = buildAdminJoinRequestsAlert({
    pendingRequestsCount: membershipOverview?.pendingRequests.length ?? 0,
  });
  const validations = buildAdminValidationsAlert({ challenges });
  const occupation = buildAdminOccupationCard({
    activeCount: membershipOverview?.ranking.length ?? 0,
    maxPlayers: league?.maxPlayers ?? null,
  });
  const monthlyMatches = buildAdminMonthlyMatchesCard({ challenges, now });
  const ongoing = buildAdminOngoingChallengesCard({ challenges });
  const activityRate = buildAdminActivityRateCard({
    challenges,
    now,
    ranking: membershipOverview?.ranking ?? [],
  });

  return (
    <View className="gap-3">
      {joinRequests ? <WidgetAlert .../> : null}
      {validations ? <WidgetAlert .../> : null}

      <View className="flex-row gap-3">
        <WidgetCard className="flex-1" ...occupation />
        <WidgetCard className="flex-1" ...monthlyMatches />
      </View>
      <View className="flex-row gap-3">
        <WidgetCard className="flex-1" ...ongoing />
        <WidgetCard className="flex-1" ...activityRate />
      </View>
    </View>
  );
}
```

> **`leagueId`:** o participant recebe `league` via props do `index.tsx`. O
> admin atualmente é renderizado sem props. Para acessar o bucket$ sem
> mudar a assinatura do caller (`{role === "owner" && <AdminOverview />}`),
> o componente lê `leagueId` via `useLocalSearchParams` internamente — mesmo
> padrão que a rota usa. Alternativa seria passar `league` como prop (como o
> participant), mas isso exigiria mudar o caller. **Decisão:** ler
> `leagueId` via `useLocalSearchParams` dentro do componente, mantendo o
> caller inalterado.

## Testes

`src/lib/leagues/admin-overview-derived.test.ts` cobrindo, para cada
builder:

- Caminho feliz (valores típicos).
- Caso de null/vazio (alertas retornam `null`, cards retornam zeros).
- `summarizeAdminPendingActions` com 0, 1, múltiplos e mistos.
- `buildAdminActivityRateCard`:
  - zero membros ativos → `rate: 0` (sem NaN).
  - intersecção parcial.
  - 100%.
- `buildAdminOccupationCard`:
  - `maxPlayers: null` → "vagas ilimitadas".
  - `activeCount >= maxPlayers` → "Liga lotada".
  - vagas restantes > 0.

## Verificação

- `bun run typecheck`
- `bun test` (cobertura dos builders)
- `bun x ultracite fix`
- `git diff --check`
