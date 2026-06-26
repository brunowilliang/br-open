# Agenda de Jogos da Liga — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma tela de Agenda na liga que mostra os desafios confirmados agrupados por dia e por período (manhã/tarde/noite), com flag configurável de visibilidade (`public`/`members_only`).

**Architecture:** Nova flag `scheduleVisibility` no `ruleConfig` + nova query `league.challenges.listScheduled` (payload enxuto, acesso público ou restrito conforme a flag). Tela standalone `/leagues/[leagueId]/schedule` acessível via menu `⋮`, com tabs de data (7/15 dias selecionáveis) e cards simplificados. Card de configuração em Ajustes.

**Tech Stack:** Convex (kitcn/CRPC), Zod, Expo Router, React Native, heroui-native, Legendapp state, TanStack Query, Biome/Ultracite.

**Spec:** `docs/superpowers/specs/2026-06-26-league-schedule-agenda-design.md`

---

## File Structure

**New files:**
- `src/app/(private)/leagues/[leagueId]/schedule.tsx` — rota da agenda
- `src/components/pages/leagues/schedule-card.tsx` — card simplificado de jogo
- `src/lib/leagues/schedule-view.ts` — helpers de view (datas, períodos, janela)
- `convex/domains/league/tests/schedule-view-helpers.test.ts` — testes dos helpers de data/período

**Modified files:**
- `convex/domains/league/contract.ts` — flag `scheduleVisibility`, schema `leagueScheduleItemSchema`, options/defaults
- `convex/domains/league/tests/contract.test.ts` — testes da nova flag
- `convex/functions/league/challenges.ts` — `serializeLeagueRecord` fallback + query `listScheduled`
- `src/lib/leagues/league-details-derived.ts` — `canOpenSchedule` no access
- `src/lib/leagues/league-details-store.ts` — tipo `LeagueDetailsRoute` ganha `"schedule"`
- `src/app/(private)/leagues/[leagueId]/_layout.tsx` — registrar `schedule` em `LEAGUE_DETAIL_SCREEN_NAMES`
- `src/app/(private)/leagues/[leagueId]/index.tsx` — item "Agenda" no menu `⋮`
- `src/app/(private)/settings/leagues/[mode]/settings.tsx` — renomear label + config de visibilidade da agenda

**Generated files (via `bun run codegen`):**
- `convex/shared/api.ts`
- `convex/functions/generated/league/challenges.runtime.ts`
- `convex/functions/generated/server.ts`

---

## Task 1: Adicionar flag `scheduleVisibility` ao contract

Adiciona a flag de visibilidade da agenda no `ruleConfig` + o novo schema enxuto do item de agenda.

**Files:**
- Modify: `convex/domains/league/contract.ts`

- [ ] **Step 1: Adicionar options e default**

Em `convex/domains/league/contract.ts`, logo após `LeagueResultValidationModeOptions` (linha ~51), adicionar:

```ts
export const LeagueScheduleVisibilityOptions = [
  "public",
  "members_only",
] as const;
```

Logo após `DEFAULT_LEAGUE_RESULT_VALIDATION_MODE` (linha ~54), adicionar:

```ts
export const DEFAULT_LEAGUE_SCHEDULE_VISIBILITY = "public" as const;
```

- [ ] **Step 2: Adicionar a flag ao `ChallengeRuleConfigSchema`**

No objeto do `ChallengeRuleConfigSchema` (por volta da linha 395-435), adicionar o campo `scheduleVisibility` junto aos outros campos de enum (após `resultValidationMode`):

```ts
    scheduleVisibility: z
      .enum(LeagueScheduleVisibilityOptions)
      .default(DEFAULT_LEAGUE_SCHEDULE_VISIBILITY),
```

- [ ] **Step 3: Atualizar `DEFAULT_LEAGUE_RULE_CONFIG`**

Em `DEFAULT_LEAGUE_RULE_CONFIG` (linha ~188), adicionar dentro do objeto:

```ts
  scheduleVisibility: "public",
```

- [ ] **Step 4: Adicionar o schema enxuto do item de agenda**

No final do arquivo, próximo aos outros schemas de challenge (após `leagueChallengeSchema`, linha ~765), adicionar:

```ts
export const leagueScheduleItemSchema = z.object({
  id: z.string().min(1, "Desafio inválido."),
  matchDate: z.string().min(1, "Data inválida."),
  startMinute: z
    .number()
    .int()
    .min(0)
    .max(MINUTES_PER_DAY),
  courtName: z.string().min(1, "Quadra inválida."),
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

- [ ] **Step 5: Adicionar o tipo exportado**

No bloco de tipos exportados (após `LeagueChallenge`, linha ~897), adicionar:

```ts
export type LeagueScheduleItem = z.infer<typeof leagueScheduleItemSchema>;
```

- [ ] **Step 6: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS (sem erros de tipo). Pode haver erros de lint sobre `scheduleVisibility` ainda não usado — ignore por enquanto.

- [ ] **Step 7: Commit**

```bash
git add convex/domains/league/contract.ts
git commit -m "feat(league): add scheduleVisibility flag and schedule item schema"
```

---

## Task 2: Testar a flag `scheduleVisibility` no contract

Garante que a flag tem default correto e aceita os valores válidos.

**Files:**
- Modify: `convex/domains/league/tests/contract.test.ts`

- [ ] **Step 1: Adicionar testes para `scheduleVisibility`**

No `describe("ChallengeRuleConfigSchema", ...)` em `convex/domains/league/tests/contract.test.ts`, adicionar os testes abaixo. Primeiro, atualizar `validRuleConfig` para incluir a flag explícita (mantendo compatibilidade com testes existentes):

Adicionar a `scheduleVisibility: "public"` ao objeto `validRuleConfig` (próximo à linha 30, junto aos outros enums como `challengeValidationMode`):

```ts
  scheduleVisibility: "public",
```

Depois adicionar estes testes no `describe("ChallengeRuleConfigSchema")`:

```ts
  it("defaults scheduleVisibility to public when omitted", () => {
    const { scheduleVisibility: _omit, ...rest } = validRuleConfig;
    const result = ChallengeRuleConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scheduleVisibility).toBe("public");
    }
  });

  it("accepts members_only for scheduleVisibility", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      scheduleVisibility: "members_only",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid scheduleVisibility value", () => {
    const result = ChallengeRuleConfigSchema.safeParse({
      ...validRuleConfig,
      scheduleVisibility: "secret",
    });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 2: Rodar os testes**

Run: `bun test convex/domains/league/tests/contract.test.ts`
Expected: PASS — todos os testes, incluindo os 3 novos.

- [ ] **Step 3: Commit**

```bash
git add convex/domains/league/tests/contract.test.ts
git commit -m "test(league): cover scheduleVisibility default and values"
```

---

## Task 3: Atualizar `serializeLeagueRecord` com fallback da flag

Garante que documentos legados (sem `scheduleVisibility`) recebam o default ao serem serializados.

**Files:**
- Modify: `convex/functions/league/challenges.ts`

- [ ] **Step 1: Adicionar fallback na serialização**

Em `serializeLeagueRecord` em `convex/functions/league/challenges.ts` (por volta da linha 122-130), atualizar o bloco `ruleConfig` para incluir o fallback de `scheduleVisibility`. Localizar:

```ts
    ruleConfig: {
      ...record.ruleConfig,
      challengeValidationMode:
        record.ruleConfig?.challengeValidationMode ??
        DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
      resultValidationMode:
        record.ruleConfig?.resultValidationMode ??
        DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
    },
```

E adicionar `scheduleVisibility` no mesmo objeto (manter os imports existentes; o default já deve estar importado se seguirmos o próximo passo):

```ts
    ruleConfig: {
      ...record.ruleConfig,
      scheduleVisibility:
        record.ruleConfig?.scheduleVisibility ??
        DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
      challengeValidationMode:
        record.ruleConfig?.challengeValidationMode ??
        DEFAULT_LEAGUE_CHALLENGE_VALIDATION_MODE,
      resultValidationMode:
        record.ruleConfig?.resultValidationMode ??
        DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,
    },
```

- [ ] **Step 2: Adicionar import do default**

No bloco de imports de `../../domains/league/contract` (linhas 24-51), adicionar `DEFAULT_LEAGUE_SCHEDULE_VISIBILITY` à lista. Localizar a linha com `DEFAULT_LEAGUE_RESULT_VALIDATION_MODE,` e adicionar logo após:

```ts
  DEFAULT_LEAGUE_SCHEDULE_VISIBILITY,
```

- [ ] **Step 3: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/functions/league/challenges.ts
git commit -m "feat(league): serialize scheduleVisibility with default fallback"
```

---

## Task 4: Adicionar a query `listScheduled`

A query central da agenda: retorna desafios confirmados com data >= hoje, respeitando a flag de visibilidade.

**Files:**
- Modify: `convex/functions/league/challenges.ts`

- [ ] **Step 1: Adicionar import do schema enxuto**

No bloco de imports de `../../domains/league/contract` em `convex/functions/league/challenges.ts`, adicionar `leagueScheduleItemSchema` à lista. Localizar a linha com `leagueChallengeSchema,` e adicionar:

```ts
  leagueScheduleItemSchema,
```

- [ ] **Step 2: Adicionar a query `listScheduled`**

Em `convex/functions/league/challenges.ts`, logo após o `export const listForLeague = ...` (que termina na linha ~995), adicionar:

```ts
export const listScheduled = authQuery
  .input(LeagueByIdSchema)
  .output(z.array(leagueScheduleItemSchema))
  .query(async ({ ctx, input }) => {
    const leagueId = input.leagueId as Id<"league">;
    const currentLeague = await getLeagueRecordOrThrow(ctx, leagueId);
    const scheduleVisibility =
      currentLeague.ruleConfig.scheduleVisibility ??
      "public";

    // Acesso público (qualquer usuário autenticado) quando a agenda é pública.
    // Caso contrário, exige owner ou participante ativo.
    if (scheduleVisibility !== "public") {
      await getViewerContextOrThrow(ctx, leagueId);
    }

    const challengeRecords = await ctx.orm.query.leagueChallenge.findMany({
      limit: 500,
      where: { leagueId },
    });

    const todayUtc = buildTodayUtcKey();
    const scheduledItems = await Promise.all(
      challengeRecords.map(async (challenge) => {
        if (challenge.status !== "confirmed") {
          return null;
        }

        const currentProposal = await getCurrentProposalOrThrow(
          ctx,
          challenge
        );

        if (currentProposal.matchDate < todayUtc) {
          return null;
        }

        const [challengerMembership, challengedMembership] = await Promise.all([
          getMembershipRecordByIdOrThrow(
            ctx,
            challenge.challengerMembershipId as Id<"leagueMembership">
          ),
          getMembershipRecordByIdOrThrow(
            ctx,
            challenge.challengedMembershipId as Id<"leagueMembership">
          ),
        ]);

        const [challenger, challenged] = await Promise.all([
          getPlayerSummary(
            ctx,
            challengerMembership.playerProfileId as Id<"playerProfile">
          ),
          getPlayerSummary(
            ctx,
            challengedMembership.playerProfileId as Id<"playerProfile">
          ),
        ]);

        const courtName = getCourtNameOrThrow(
          currentLeague,
          currentProposal.courtId
        );

        return leagueScheduleItemSchema.parse({
          id: challenge.id,
          matchDate: currentProposal.matchDate,
          startMinute: currentProposal.startMinute,
          courtName,
          challenger: {
            fullName: challenger.fullName,
            avatarUrl: challenger.avatarUrl ?? null,
          },
          challenged: {
            fullName: challenged.fullName,
            avatarUrl: challenged.avatarUrl ?? null,
          },
        });
      })
    );

    return scheduledItems
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (a.matchDate !== b.matchDate) {
          return a.matchDate < b.matchDate ? -1 : 1;
        }
        return a.startMinute - b.startMinute;
      });
  });
```

- [ ] **Step 3: Adicionar helper `buildTodayUtcKey`**

No mesmo arquivo, na seção de helpers (antes do `export const listForLeague`), adicionar:

```ts
function buildTodayUtcKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Rodar codegen**

Run: `bun run codegen`
Expected: gera/atualiza `convex/shared/api.ts`, `convex/functions/generated/league/challenges.runtime.ts`, `convex/functions/generated/server.ts` com a nova query `listScheduled`.

- [ ] **Step 5: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/functions/league/challenges.ts convex/shared/api.ts convex/functions/generated/
git commit -m "feat(league): add listScheduled query for schedule agenda"
```

---

## Task 5: Helpers de view da agenda (`schedule-view.ts`)

Funções puras que geram as tabs de data, agrupam por período e formatam rótulos. São testáveis isoladamente.

**Files:**
- Create: `src/lib/leagues/schedule-view.ts`

- [ ] **Step 1: Criar o arquivo com os helpers**

Criar `src/lib/leagues/schedule-view.ts`:

```ts
import type { ApiOutputs } from "@convex/shared/api";

type ScheduleItem = ApiOutputs["league"]["challenges"]["listScheduled"][number];

const MINUTES_PER_HOUR = 60;
const AFTERNOON_START_MINUTE = 12 * MINUTES_PER_HOUR; // 720
const EVENING_START_MINUTE = 18 * MINUTES_PER_HOUR; // 1080

export type ScheduleWindowDays = 7 | 15;

export type ScheduleDateTab = {
  matchDate: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
};

export type ScheduleDayView = {
  morning: ScheduleItem[];
  afternoon: ScheduleItem[];
  evening: ScheduleItem[];
};

export type SchedulePeriodKey = keyof ScheduleDayView;

export const SCHEDULE_PERIOD_META: Record<
  SchedulePeriodKey,
  { label: string }
> = {
  afternoon: { label: "Tarde" },
  evening: { label: "Noite" },
  morning: { label: "Manhã" },
};

export const SCHEDULE_WINDOW_OPTIONS: Array<{
  label: string;
  value: ScheduleWindowDays;
}> = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
];

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  weekday: "short",
});

/**
 * Constrói a lista de tabs de data, de "Hoje" até `windowDays - 1` dias à
 * frente. Cada tab carrega o `matchDate` no formato `YYYY-MM-DD` (UTC) usado
 * pela API, mais um rótulo amigável.
 */
export function buildScheduleDateTabs(input: {
  today: Date;
  windowDays: ScheduleWindowDays;
}): ScheduleDateTab[] {
  const tabs: ScheduleDateTab[] = [];

  for (let offset = 0; offset < input.windowDays; offset += 1) {
    const date = new Date(input.today);
    date.setUTCDate(date.getUTCDate() + offset);

    const matchDate = formatDateToUtcKey(date);
    const isToday = offset === 0;
    const isTomorrow = offset === 1;

    tabs.push({
      isToday,
      isTomorrow,
      label: buildDateTabLabel({ date, isToday, isTomorrow }),
      matchDate,
    });
  }

  return tabs;
}

function buildDateTabLabel(input: {
  date: Date;
  isToday: boolean;
  isTomorrow: boolean;
}): string {
  if (input.isToday) {
    return "Hoje";
  }

  if (input.isTomorrow) {
    return "Amanhã";
  }

  return DAY_LABEL_FORMATTER
    .format(
      Date.UTC(
        input.date.getUTCFullYear(),
        input.date.getUTCMonth(),
        input.date.getUTCDate()
      )
    )
    .replace(".", "");
}

export function formatDateToUtcKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Agrupa os itens de um dia por período (manhã/tarde/noite), cada lista
 * ordenada por `startMinute`. Períodos vazios ficam como array vazio; a UI
 * decide se renderiza ou não.
 */
export function buildScheduleDayView(input: {
  challenges: readonly ScheduleItem[];
  matchDate: string;
}): ScheduleDayView {
  const dayChallenges = input.challenges.filter(
    (challenge) => challenge.matchDate === input.matchDate
  );

  const morning: ScheduleItem[] = [];
  const afternoon: ScheduleItem[] = [];
  const evening: ScheduleItem[] = [];

  for (const challenge of dayChallenges) {
    if (challenge.startMinute < AFTERNOON_START_MINUTE) {
      morning.push(challenge);
    } else if (challenge.startMinute < EVENING_START_MINUTE) {
      afternoon.push(challenge);
    } else {
      evening.push(challenge);
    }
  }

  const sortByStartMinute = (a: ScheduleItem, b: ScheduleItem) =>
    a.startMinute - b.startMinute;

  morning.sort(sortByStartMinute);
  afternoon.sort(sortByStartMinute);
  evening.sort(sortByStartMinute);

  return { afternoon, evening, morning };
}

export function formatScheduleMinute(minute: number): string {
  const hour = Math.floor(minute / MINUTES_PER_HOUR);
  const currentMinute = minute % MINUTES_PER_HOUR;
  return `${String(hour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS (pode haver erro se `listScheduled` ainda não estiver no tipo gerado — confirmar que Task 4 foi concluída).

- [ ] **Step 3: Commit**

```bash
git add src/lib/leagues/schedule-view.ts
git commit -m "feat(league): add schedule view helpers (date tabs, periods)"
```

---

## Task 6: Testar os helpers de view da agenda

Cobre geração de tabs, agrupamento por período e formatação.

**Files:**
- Create: `convex/domains/league/tests/schedule-view-helpers.test.ts`

- [ ] **Step 1: Criar o arquivo de testes**

Criar `convex/domains/league/tests/schedule-view-helpers.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  formatDateToUtcKey,
  formatScheduleMinute,
} from "../../../src/lib/leagues/schedule-view";

type ScheduleItem = {
  id: string;
  matchDate: string;
  startMinute: number;
  courtName: string;
  challenger: { fullName: string; avatarUrl: string | null };
  challenged: { fullName: string; avatarUrl: string | null };
};

function scheduleItem(input: {
  id: string;
  matchDate: string;
  startMinute: number;
}): ScheduleItem {
  return {
    challenged: {
      avatarUrl: null,
      fullName: "Maria",
    },
    challenger: {
      avatarUrl: null,
      fullName: "João",
    },
    courtName: "Quadra 1",
    id: input.id,
    matchDate: input.matchDate,
    startMinute: input.startMinute,
  };
}

describe("buildScheduleDateTabs", () => {
  it("generates 7 tabs starting at today with friendly labels", () => {
    const today = new Date(Date.UTC(2026, 5, 26)); // 2026-06-26 UTC
    const tabs = buildScheduleDateTabs({ today, windowDays: 7 });

    expect(tabs).toHaveLength(7);
    expect(tabs[0]).toMatchObject({
      isToday: true,
      isTomorrow: false,
      label: "Hoje",
      matchDate: "2026-06-26",
    });
    expect(tabs[1]).toMatchObject({
      isToday: false,
      isTomorrow: true,
      label: "Amanhã",
    });
    expect(tabs[2].isToday).toBe(false);
    expect(tabs[2].isTomorrow).toBe(false);
  });

  it("generates 15 tabs when window is 15", () => {
    const today = new Date(Date.UTC(2026, 5, 26));
    const tabs = buildScheduleDateTabs({ today, windowDays: 15 });
    expect(tabs).toHaveLength(15);
  });
});

describe("buildScheduleDayView", () => {
  const matchDate = "2026-06-26";

  it("groups challenges into morning/afternoon/evening by startMinute", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "1", matchDate, startMinute: 540 }), // 09:00 manhã
        scheduleItem({ id: "2", matchDate, startMinute: 840 }), // 14:00 tarde
        scheduleItem({ id: "3", matchDate, startMinute: 1140 }), // 19:00 noite
        scheduleItem({ id: "4", matchDate, startMinute: 360 }), // 06:00 manhã
      ],
      matchDate,
    });

    expect(view.morning.map((c) => c.id)).toEqual(["4", "1"]);
    expect(view.afternoon.map((c) => c.id)).toEqual(["2"]);
    expect(view.evening.map((c) => c.id)).toEqual(["3"]);
  });

  it("sorts each period by startMinute ascending", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "a", matchDate, startMinute: 600 }),
        scheduleItem({ id: "b", matchDate, startMinute: 480 }),
      ],
      matchDate,
    });

    expect(view.morning.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("excludes challenges from other days", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "1", matchDate: "2026-06-27", startMinute: 540 }),
      ],
      matchDate,
    });

    expect(view.morning).toHaveLength(0);
    expect(view.afternoon).toHaveLength(0);
    expect(view.evening).toHaveLength(0);
  });

  it("treats 12:00 (720) as afternoon start", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "1", matchDate, startMinute: 720 }),
      ],
      matchDate,
    });

    expect(view.morning).toHaveLength(0);
    expect(view.afternoon).toHaveLength(1);
  });

  it("treats 18:00 (1080) as evening start", () => {
    const view = buildScheduleDayView({
      challenges: [
        scheduleItem({ id: "1", matchDate, startMinute: 1080 }),
      ],
      matchDate,
    });

    expect(view.afternoon).toHaveLength(0);
    expect(view.evening).toHaveLength(1);
  });
});

describe("formatScheduleMinute", () => {
  it("formats minutes since midnight as HH:MM", () => {
    expect(formatScheduleMinute(540)).toBe("09:00");
    expect(formatScheduleMinute(0)).toBe("00:00");
    expect(formatScheduleMinute(1140)).toBe("19:00");
  });
});

describe("formatDateToUtcKey", () => {
  it("formats a Date as YYYY-MM-DD using UTC", () => {
    expect(formatDateToUtcKey(new Date(Date.UTC(2026, 5, 26)))).toBe(
      "2026-06-26"
    );
  });
});
```

- [ ] **Step 2: Rodar os testes**

Run: `bun test convex/domains/league/tests/schedule-view-helpers.test.ts`
Expected: PASS — todos os testes.

- [ ] **Step 3: Commit**

```bash
git add convex/domains/league/tests/schedule-view-helpers.test.ts
git commit -m "test(league): cover schedule view helpers"
```

---

## Task 7: Componente `ScheduleCard`

Card simplificado de jogo, reusando o layout de fotos sobrepostas do `ChallengeCard`.

**Files:**
- Create: `src/components/pages/leagues/schedule-card.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/pages/leagues/schedule-card.tsx`:

```tsx
import { memo } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";

type ScheduleCardProps = {
  challengedAvatarUrl?: string | null;
  challengedFullName: string;
  challengerAvatarUrl?: string | null;
  challengerFullName: string;
  courtName: string;
  startMinute: number;
};

function formatMinute(minute: number) {
  const hour = Math.floor(minute / 60);
  const currentMinute = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
}

function ScheduleCardImpl(props: ScheduleCardProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface-secondary p-3">
      <View className="relative h-13 w-12">
        <Image
          className="absolute top-0 left-0 size-8.5 rounded-full border border-separator"
          fallback="green"
          source={props.challengerAvatarUrl}
        />
        <Image
          className="absolute right-0 bottom-0 size-8.5 rounded-full border border-separator"
          fallback="blue"
          source={props.challengedAvatarUrl}
        />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-1">
          <Text
            className="max-w-[40%]"
            numberOfLines={1}
            variant="description"
          >
            {props.challengerFullName}
          </Text>
          <Text className="text-muted" variant="description">
            x
          </Text>
          <Text
            className="max-w-[40%]"
            numberOfLines={1}
            variant="description"
          >
            {props.challengedFullName}
          </Text>
        </View>
        <Text color="muted" numberOfLines={1} variant="description">
          {`${formatMinute(props.startMinute)} · ${props.courtName}`}
        </Text>
      </View>
    </View>
  );
}

export const ScheduleCard = memo(ScheduleCardImpl);
```

- [ ] **Step 2: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/leagues/schedule-card.tsx
git commit -m "feat(league): add ScheduleCard component"
```

---

## Task 8: Rota da agenda `schedule.tsx`

A tela principal, com header, tabs de data + select de janela, e agrupamento por período.

**Files:**
- Create: `src/app/(private)/leagues/[leagueId]/schedule.tsx`

- [ ] **Step 1: Criar a rota**

Criar `src/app/(private)/leagues/[leagueId]/schedule.tsx`:

```tsx
import { useValue } from "@legendapp/state/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "better-styled";
import { useLocalSearchParams } from "expo-router";
import { Menu, Select } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { ScheduleCard } from "@/components/pages/leagues/schedule-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getLeagueDetailsBucket$ } from "@/lib/leagues/league-details-store";
import {
  buildScheduleDateTabs,
  buildScheduleDayView,
  formatScheduleMinute,
  SCHEDULE_PERIOD_META,
  SCHEDULE_WINDOW_OPTIONS,
  type SchedulePeriodKey,
  type ScheduleWindowDays,
} from "@/lib/leagues/schedule-view";

const PERIOD_ORDER: SchedulePeriodKey[] = ["morning", "afternoon", "evening"];

export default function LeagueScheduleRoute() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const crpc = useCRPC();
  const bucket$ = getLeagueDetailsBucket$(leagueId);
  const bootstrapStatus = useValue(bucket$.identity.bootstrapStatus);
  const league = useValue(bucket$.data.league);

  const scheduleQuery = useQuery({
    ...crpc.league.challenges.listScheduled.queryOptions({ leagueId }),
  });

  const [windowDays, setWindowDays] = useState<ScheduleWindowDays>(7);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    bucket$.actions.setActiveRoute("schedule");
  }, [bucket$]);

  const today = useMemo(() => new Date(), []);
  const dateTabs = useMemo(
    () => buildScheduleDateTabs({ today, windowDays }),
    [today, windowDays]
  );

  // Sempre começa em "Hoje". selectedDate só é null antes do primeiro render
  // das tabs; quando elas existem, cai para a primeira (Hoje).
  const activeDate = selectedDate ?? dateTabs[0]?.matchDate ?? null;

  useEffect(() => {
    if (!activeDate && dateTabs.length > 0) {
      setSelectedDate(dateTabs[0].matchDate);
    }
  }, [activeDate, dateTabs]);

  const challenges = scheduleQuery.data ?? [];
  const dayView = useMemo(
    () =>
      activeDate
        ? buildScheduleDayView({ challenges, matchDate: activeDate })
        : null,
    [activeDate, challenges]
  );

  const isError = bootstrapStatus === "error" || scheduleQuery.isError;
  const isLoading =
    bootstrapStatus !== "ready" || !league || scheduleQuery.isPending;
  const showStatusState = isError || isLoading;

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Agenda</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView
        contentContainerClassName={cn(
          "gap-3 px-4 pb-safe-offset-4",
          showStatusState && "centered"
        )}
      >
        {isError && (
          <ErrorState message="Não foi possível carregar a agenda." />
        )}
        {!isError && isLoading && <LoadingState />}
        {!(isError || isLoading) && (
          <>
            <View className="flex-row items-center gap-2">
              <Menu value={activeDate ?? ""}>
                <Menu.ScrollView horizontal>
                  {dateTabs.map((tab) => (
                    <Menu.Trigger
                      key={tab.matchDate}
                      onPress={() => {
                        setSelectedDate(tab.matchDate);
                      }}
                      variant={
                        activeDate === tab.matchDate ? "primary" : "secondary"
                      }
                    >
                      <Menu.Label>{tab.label}</Menu.Label>
                    </Menu.Trigger>
                  ))}
                </Menu.ScrollView>
              </Menu>
              <Select
                onValueChange={(nextValue) => {
                  if (nextValue && !Array.isArray(nextValue)) {
                    setWindowDays(
                      nextValue.value as ScheduleWindowDays
                    );
                    setSelectedDate(null);
                  }
                }}
                selectionMode="single"
                value={SCHEDULE_WINDOW_OPTIONS.find(
                  (option) => option.value === windowDays
                )}
              >
                <Select.Trigger size="sm">
                  <Select.Value numberOfLines={1} />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="popover" width="trigger">
                    {SCHEDULE_WINDOW_OPTIONS.map((option) => (
                      <Select.Option
                        key={option.value}
                        value={option.value}
                      >
                        <Select.OptionLabel>{option.label}</Select.OptionLabel>
                      </Select.Option>
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>

            {dayView &&
            PERIOD_ORDER.every(
              (period) => dayView[period].length === 0
            ) ? (
              <EmptyState
                description="Veja os jogos nos outros dias da agenda."
                title="Nenhum jogo neste dia"
              />
            ) : (
              dayView &&
              PERIOD_ORDER.map((period) => {
                const items = dayView[period];
                if (items.length === 0) {
                  return null;
                }
                return (
                  <View className="gap-2" key={period}>
                    <Text color="muted" variant="description" weight="medium">
                      {SCHEDULE_PERIOD_META[period].label}
                    </Text>
                    <View className="gap-2">
                      {items.map((item) => (
                        <ScheduleCard
                          challengedAvatarUrl={item.challenged.avatarUrl}
                          challengedFullName={item.challenged.fullName}
                          challengerAvatarUrl={item.challenger.avatarUrl}
                          challengerFullName={item.challenger.fullName}
                          courtName={item.courtName}
                          key={item.id}
                          startMinute={item.startMinute}
                        />
                      ))}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </Page.ScrollView>
    </Page>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/(private)/leagues/[leagueId]/schedule.tsx
git commit -m "feat(league): add schedule route with date tabs and periods"
```

---

## Task 9: Adicionar `"schedule"` ao tipo de rota e registrar no layout

Permite que a store reconheça a rota e que o layout registre a tela.

**Files:**
- Modify: `src/lib/leagues/league-details-store.ts`
- Modify: `src/app/(private)/leagues/[leagueId]/_layout.tsx`

- [ ] **Step 1: Adicionar `"schedule"` ao tipo `LeagueDetailsRoute`**

Em `src/lib/leagues/league-details-store.ts`, localizar:

```ts
export type LeagueDetailsRoute =
  | "overview"
  | "ranking"
  | "challenges"
  | "requests"
  | "rules";
```

E adicionar `"schedule"`:

```ts
export type LeagueDetailsRoute =
  | "overview"
  | "ranking"
  | "challenges"
  | "requests"
  | "rules"
  | "schedule";
```

- [ ] **Step 2: Registrar `schedule` em `LEAGUE_DETAIL_SCREEN_NAMES`**

Em `src/app/(private)/leagues/[leagueId]/_layout.tsx`, localizar:

```ts
const LEAGUE_DETAIL_SCREEN_NAMES = [
  "index",
  "ranking",
  "challenges",
  "requests",
  "rules",
] as const;
```

E adicionar `"schedule"`:

```ts
const LEAGUE_DETAIL_SCREEN_NAMES = [
  "index",
  "ranking",
  "challenges",
  "requests",
  "rules",
  "schedule",
] as const;
```

- [ ] **Step 3: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/leagues/league-details-store.ts src/app/(private)/leagues/[leagueId]/_layout.tsx
git commit -m "feat(league): register schedule route in store and layout"
```

---

## Task 10: Adicionar `canOpenSchedule` ao access derivado

Controla a visibilidade do item de menu da agenda conforme a flag de visibilidade.

**Files:**
- Modify: `src/lib/leagues/league-details-derived.ts`

- [ ] **Step 1: Ler o arquivo para entender a estrutura atual**

Run: `Read src/lib/leagues/league-details-derived.ts` (linhas 1-140) para confirmar os nomes exatos de `LeagueDetailsAccess`, `buildLeagueDetailsAccess` e `buildLeagueDetailsCanOpenLeagueMenu`.

- [ ] **Step 2: Adicionar `canOpenSchedule` ao tipo `LeagueDetailsAccess`**

Localizar:

```ts
export type LeagueDetailsAccess = {
  canOpenChallenges: boolean;
  canOpenRanking: boolean;
  canOpenRequests: boolean;
  canOpenRules: boolean;
};
```

E adicionar `canOpenSchedule`:

```ts
export type LeagueDetailsAccess = {
  canOpenChallenges: boolean;
  canOpenRanking: boolean;
  canOpenRequests: boolean;
  canOpenRules: boolean;
  canOpenSchedule: boolean;
};
```

- [ ] **Step 3: Computar `canOpenSchedule` em `buildLeagueDetailsAccess`**

Localizar `buildLeagueDetailsAccess` (a função que retorna o objeto com `canOpenChallenges`, etc.) e atualizar para receber a `scheduleVisibility`. A assinatura atual provavelmente é `(role: LeagueDetailsRole)`. Atualizá-la para:

```ts
export function buildLeagueDetailsAccess(input: {
  role: LeagueDetailsRole;
  scheduleVisibility: "public" | "members_only";
}): LeagueDetailsAccess {
  const isMember = input.role === "participant" || input.role === "owner";
  return {
    canOpenChallenges: input.role === "participant" || input.role === "owner",
    canOpenRanking: input.role === "participant" || input.role === "owner",
    canOpenRequests: input.role === "owner",
    canOpenRules: true,
    canOpenSchedule:
      input.scheduleVisibility === "public" ? true : isMember,
  };
}
```

**Importante:** o caller em `league-details-store.ts` chama `buildLeagueDetailsAccess(bucket$.viewer.role.get())`. Precisamos atualizá-lo (Task 11) para passar também a `scheduleVisibility`.

- [ ] **Step 4: Atualizar `buildLeagueDetailsCanOpenLeagueMenu`**

Localizar a função `buildLeagueDetailsCanOpenLeagueMenu` (que checa `access.canOpenRanking || access.canOpenChallenges || ...`). Adicionar `access.canOpenSchedule` à condição OR:

```ts
  return (
    access.canOpenRanking ||
    access.canOpenChallenges ||
    access.canOpenRules ||
    access.canOpenRequests ||
    access.canOpenSchedule
  );
```

- [ ] **Step 5: Verificar typecheck**

Run: `bun run typecheck`
Expected: erro de tipo no `league-details-store.ts` (caller de `buildLeagueDetailsAccess` ainda passa só `role`). Isso é esperado — será corrigido na Task 11. Anote o erro e continue.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leagues/league-details-derived.ts
git commit -m "feat(league): add canOpenSchedule to derived access"
```

---

## Task 11: Atualizar a store para passar `scheduleVisibility` ao access

Conecta a flag vinda da liga ao access derivado.

**Files:**
- Modify: `src/lib/leagues/league-details-store.ts`

- [ ] **Step 1: Atualizar o derived `access` na store**

Em `src/lib/leagues/league-details-store.ts`, localizar o derived `access`:

```ts
      access: () => buildLeagueDetailsAccess(bucket$.viewer.role.get()),
```

E atualizar para passar a `scheduleVisibility` da liga:

```ts
      access: () => {
        const league = bucket$.data.league.get();
        const scheduleVisibility =
          league?.ruleConfig.scheduleVisibility ?? "public";
        return buildLeagueDetailsAccess({
          role: bucket$.viewer.role.get(),
          scheduleVisibility,
        });
      },
```

- [ ] **Step 2: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS (o erro da Task 10 deve estar resolvido agora).

- [ ] **Step 3: Commit**

```bash
git add src/lib/leagues/league-details-store.ts
git commit -m "feat(league): pass scheduleVisibility to derived access"
```

---

## Task 12: Adicionar item "Agenda" no menu `⋮` da Visão Geral

Ponto de entrada para a tela de agenda.

**Files:**
- Modify: `src/app/(private)/leagues/[leagueId]/index.tsx`

- [ ] **Step 1: Adicionar o ícone ao import**

Em `src/app/(private)/leagues/[leagueId]/index.tsx`, no import de `@hugeicons/core-free-icons` (linhas 3-7), adicionar `Calendar03Icon` (já existe nos imports de `participant-overview.tsx`, então é um ícone válido):

```ts
import {
  BookOpenCheckIcon,
  Calendar03Icon,
  Edit02Icon,
  Location06Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
```

- [ ] **Step 2: Atualizar `canOpenLeagueMenu`**

Localizar (linha ~158):

```ts
  const canOpenLeagueMenu = access.canOpenRules || canManageLeague;
```

E adicionar `access.canOpenSchedule`:

```ts
  const canOpenLeagueMenu =
    access.canOpenRules || access.canOpenSchedule || canManageLeague;
```

- [ ] **Step 3: Adicionar o item de menu "Agenda"**

Localizar o item de menu "Regras" dentro do `Menu.Content` (linhas ~178-192):

```tsx
                  {access.canOpenRules ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId },
                          pathname: "/leagues/[leagueId]/rules",
                        });
                      }}
                    >
                      <Menu.ItemTitle className="flex-none">
                        Regras
                      </Menu.ItemTitle>
                      <HugeIcons icon={BookOpenCheckIcon} />
                    </Menu.Item>
                  ) : null}
```

Adicionar o item "Agenda" logo **após** esse bloco (antes do `{canManageLeague ? ...}`):

```tsx
                  {access.canOpenSchedule ? (
                    <Menu.Item
                      onPress={() => {
                        router.navigate({
                          params: { leagueId },
                          pathname: "/leagues/[leagueId]/schedule",
                        });
                      }}
                    >
                      <Menu.ItemTitle className="flex-none">
                        Agenda
                      </Menu.ItemTitle>
                      <HugeIcons icon={Calendar03Icon} />
                    </Menu.Item>
                  ) : null}
```

- [ ] **Step 4: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(private)/leagues/[leagueId]/index.tsx
git commit -m "feat(league): add Agenda entry in overview menu"
```

---

## Task 13: Renomear "Visibilidade" para "Visibilidade da liga" em Ajustes

Ajuste de copy solicitado.

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/settings.tsx`

- [ ] **Step 1: Renomear o label**

Em `src/app/(private)/settings/leagues/[mode]/settings.tsx`, localizar (linha 170):

```tsx
          <Label>Visibilidade</Label>
```

E alterar para:

```tsx
          <Label>Visibilidade da liga</Label>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/settings.tsx
git commit -m "refactor(league): rename visibility label to Visibilidade da liga"
```

---

## Task 14: Adicionar config "Visibilidade da agenda" em Ajustes

Controla a flag `scheduleVisibility` via UI.

**Files:**
- Modify: `src/app/(private)/settings/leagues/[mode]/settings.tsx`

- [ ] **Step 1: Adicionar as opções de visibilidade da agenda**

No topo do arquivo `src/app/(private)/settings/leagues/[mode]/settings.tsx`, logo após o array `visibilityOptions` (linha 38), adicionar:

```ts
const scheduleVisibilityOptions = [
  { label: "Aberta para todos", value: "public" as const },
  { label: "Somente membros", value: "members_only" as const },
];
```

- [ ] **Step 2: Adicionar watch de `ruleConfig.scheduleVisibility`**

No componente `LeagueSettingsRoute`, localizar o bloco de `useWatch` (por volta das linhas 86-105). Adicionar um watch para `ruleConfig.scheduleVisibility` logo após o `priceBillingInterval`:

```ts
  const scheduleVisibility = useWatch({
    control,
    name: "ruleConfig.scheduleVisibility",
    defaultValue: getValues("ruleConfig.scheduleVisibility") ?? "public",
  });
```

- [ ] **Step 3: Adicionar o campo de config abaixo do campo de visibilidade da liga**

Localizar o fechamento do `TextField` de visibilidade (o `</TextField>` logo após `<FieldError>{visibilityError ?? ""}</FieldError>`, linha ~219). Adicionar o novo campo logo **após** esse `</TextField>` e **antes** do `<Animated.View className="gap-2" ...>`:

```tsx
        <TextField isRequired>
          <Label>Visibilidade da agenda</Label>
          <Select
            isDisabled={isDisabled}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setValue(
                  "ruleConfig.scheduleVisibility",
                  nextValue.value as LeagueScreenValues["ruleConfig"]["scheduleVisibility"],
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  }
                );
              }
            }}
            selectionMode="single"
            value={scheduleVisibilityOptions.find(
              (option) => option.value === scheduleVisibility
            )}
          >
            <Select.Trigger>
              <Select.Value
                className="font-normal"
                numberOfLines={1}
                placeholder="Escolha uma opção"
              />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.ListLabel className="mb-2">
                  Escolha uma opção
                </Select.ListLabel>
                {scheduleVisibilityOptions.map((option) => (
                  <SelectOptionItem
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Select.Content>
            </Select.Portal>
          </Select>
          <Description>
            Define quem pode ver os jogos agendados da liga.
          </Description>
        </TextField>
```

- [ ] **Step 4: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(private)/settings/leagues/[mode]/settings.tsx
git commit -m "feat(league): add schedule visibility setting"
```

---

## Task 15: Validação final

Rodar todos os checks do repositório antes de considerar pronto.

**Files:** Nenhum (validação).

- [ ] **Step 1: Rodar todos os testes**

Run: `bun test`
Expected: PASS — todos os testes (incluindo os novos de contract e schedule-view).

- [ ] **Step 2: Rodar typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Rodar lint/format check**

Run: `bun x ultracite check`
Expected: PASS. Se houver issues auto-corrigíveis, rodar `bun x ultracite fix` e re-checar.

- [ ] **Step 4: Rodar diff hygiene**

Run: `git diff --check`
Expected: sem erros de whitespace.

- [ ] **Step 5: Confirmar codegen está consistente**

Run: `bun run codegen`
Expected: nenhum diff nos arquivos gerados (já rodado na Task 4). Se houver diff, commitá-lo.

- [ ] **Step 6: Smoke test mental do fluxo**

Confirmar manualmente (ou via leitura do código) o fluxo completo:
1. Admin abre Ajustes → vê "Visibilidade da liga" (renomeada) + "Visibilidade da agenda" (nova).
2. Admin define agenda como `public` → visitante vê item "Agenda" no menu `⋮`.
3. Admin define agenda como `members_only` → visitante NÃO vê "Agenda".
4. Tela Agenda abre em "Hoje", mostra desafios confirmados agrupados por manhã/tarde/noite.
5. Select de janela alterna entre 7 e 15 dias.
6. Dia sem jogos mostra empty state.

- [ ] **Step 7: Commit final (se houver leftovers de codegen/lint)**

```bash
git add -A
git commit -m "chore(league): final validation for schedule agenda"
```

---

## Notas de implementação

- **Codegen:** A query `listScheduled` só aparece em `crpc.league.challenges.listScheduled` depois de rodar `bun run codegen` (Task 4). Tasks que usam a query (8) dependem disso.
- **Acesso de visitante:** A query `listScheduled` é a única que visitantes chamam relacionada a challenges. `listForLeague` continua restrita a membros.
- **Sem migração:** A flag usa `.default("public")`, então documentos legados são cobertos sem migração.
- **heroui-native:** O `Menu` usado para tabs de data na Task 8 pode não ser o componente ideal — se o typecheck revelar que `Menu.Trigger` não aceita `variant`, trocar por um padrão de botões simples (`Button variant="primary"|"secondary"`) dentro de um `ScrollView horizontal`. Verificar a API real durante a implementação.
