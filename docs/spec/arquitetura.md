# Arquitetura — Estado atual

> Verificado em 10-08-2026 contra o código do repo (src/, convex/, AGENTS.md).

## Stack

- **App:** Expo SDK 57, React 19.2, React Native 0.86, Expo Router (file-based)
- **Backend:** Convex via kitcn (ORM/CRPC: cRPC, ORM, auth, React bindings)
- **UI:** HeroUI Native (OSS + Pro) sobre Uniwind (Tailwind v4 para RN)
- **Auth:** Better Auth (wiring + auth field codegen; ver backend.md)
- **Linguagem/ferramentas:** TypeScript strict, Bun, Ultracite/Biome (lint+format)

## Estrutura de pastas

```
src/
  app/            rotas Expo Router (route groups (public)/ e (private)/)
  components/     ui/ (átomos), pages/ (views complexas), core/, navigation/
  lib/            lógica de domínio + stores (leagues/, payments/, format/, ...)
convex/
  domains/        módulos de domínio (contract.ts zod + tables.ts + rules.ts)
  functions/      procedures CRPC (router de convex/lib/crpc.ts)
  lib/            crpc.ts (builders public/optionalAuth/auth/private*)
  shared/         tipos/protocolos compartilhados app↔convex
  utils/          contract.zod.ts (helpers de schema)
```

TS path aliases: `@/*` → `src/*`, `@convex/*` → `convex/*` (inclui
`convex/shared/*`).

## Backend (Convex + kitcn)

- **Contrato primeiro:** cada domínio expõe seu schema em
  `convex/domains/<modulo>/contract.ts` (zod), importado no app via `@convex/*`.
  Mudou contrato → `bun run codegen` antes do typecheck.
- **Procedures:** builders de `convex/lib/crpc.ts` — `public`, `optionalAuth`,
  `auth`, `private*` — montam o router por domínio.
- **Composição entre procedures:** `ctx.runAction` / `ctx.runMutation` com
  `internal.*` (padrão real do repo, verificado). Exceções documentadas:
  arquivos `"use node"` (ex.: `payment/providerNode.ts`) via `ctx.runAction`;
  actions com `ctx.orm` via `ctx.runMutation` (limitação de tipos TS,
  documentada em `onboarding.ts`).
- **Módulos:** auth, league, notification, organization, payment, player, seed,
  viewer (contexto do ator ativo), withdraw.
- **Gate backend:** `bun run codegen` → `typecheck:convex` → `bun test convex`.

## Frontend (Expo Router)

- **Rota é dona do fluxo de dados:** queries/mutations/toasts/invalidate vivem
  nas telas (ex.: `src/app/(private)/leagues/[leagueId]/challenges.tsx`).
- **`src/components/pages/`** guarda views complexas (overviews por papel,
  dialogs); lógica derivada em `src/lib/leagues/*-derived.ts`.
- **HeroUI Native + Uniwind** para componentes e estilos; `onPress`, não onClick.
- **Gate frontend:** `bun run check` (lint + typecheck) + `bun test src`.

## Vocabulário canônico (padronização executada)

Resultado da padronização executada em 22-07-2026, confirmado no código:

- **Parte A — Utils (executada):** formatters consolidados em
  `src/lib/format/` (currency, time, date, relative-time, pluralize, user,
  email, phone) + `src/lib/numbers.ts`, `collections.ts`,
  `router/normalize-param.ts`, `payments/status.ts`, `leagues/rule-format.ts`.
- **Parte B — Nomenclatura (executada):** papéis canônicos
  `organizer` / `player` / `guest` (EN código; "organizador" / "jogador" /
  "visitante" em UI). `admin-overview-derived.ts` → `organizer-overview-derived.ts`,
  `participant-*` → `player-*`; status `pending_organizer_*`; mutations
  `organizerManage*`; tabela `leagueChallengeOrganizerAction`.
- **Não mexido (Better Auth org RBAC — conceito separado):**
  `member.role: "owner" | "admin" | "member"` da organização e gates
  `requireActiveManager()` / `MANAGER_ROLES`.

## Decisões de arquitetura (resumo)

| Decisão | Por quê |
|---------|---------|
| Contrato zod primeiro por domínio | Fonte única de tipos app↔convex; codegen mantém sincronia |
| Rota dona do fluxo de dados | Estado perto do uso; pages/ só para views complexas |
| kitcn/CRPC em vez de SDK gerado | Camada tipada sobre Convex; builders por nível de auth |
| HeroUI Native + Uniwind | UI nativa sem WebView, tema via Tailwind v4 |
| docs/spec/ versionado (este diretório) | Troca de CLI/agente sem perda de contexto; histórico no git |
| docs/agents/ local | Regras de papéis do workspace Maestri, não versionadas por design |

## Próximos passos conhecidos

- Itens de decisão da padronização ainda em aberto (se não resolvidos):
  renomear `canManageLeague`, `organizerType` → `organizationType`,
  `requireActiveManager` → `requireActiveOrganizer` — verificar nos docs de
  domínio se já foram aplicados.
