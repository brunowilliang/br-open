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
- **Gate backend:** `bun run codegen` → `typecheck:convex` → `bun run test convex`.

## Frontend (Expo Router)

- **Rota é dona do fluxo de dados:** queries/mutations/toasts/invalidate vivem
  nas telas (ex.: `src/app/(private)/leagues/[leagueId]/challenges.tsx`).
- **Erro de procedure vira toast pela mensagem DO SERVIDOR:** todo `onError`
  passa por `getToastErrorMessage(error, fallback)`
  (`src/lib/errors/toast-message.ts`). O helper tira a mensagem de dentro do
  envelope do Convex no `message` do erro do cliente ("[CONVEX M(...)]
  [Request ID: ...] Server Error" + "Uncaught CRPCError: <mensagem>" — entra só
  a primeira linha depois do rótulo intencional) e mantém o payload do
  `ConvexError` (`error.data = { code, message }`) como o outro caminho — os
  dois sob o mesmo crivo de envelope —, com o genérico apenas como último
  recurso (erro de transporte, `ArgumentValidationError`, payload sem mensagem
  própria).
- **`src/components/pages/`** guarda views complexas (overviews por papel,
  dialogs); lógica derivada em `src/lib/leagues/*-derived.ts`.
- **HeroUI Native + Uniwind** para componentes e estilos; `onPress`, não onClick.
- **Gate frontend:** `bun run check` (lint + typecheck) + `bun run test src`.

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
| Fundo de navegação segue o tema na raiz | `contentStyle`/`sceneStyle` com `useThemeColor` em todos os navigators + containers nativos das stacks pintados via `ThemeProvider` do expo-router com `colors.background` do tema (`src/app/_layout.tsx`); sem o provider o expo-router pinta esse container com o `DefaultTheme` do react-navigation (cinza claro em ambos os modos), que aparece nas transições fade. `expo-system-ui` é no-op com `enableSceneSupport` (a window vive no scene delegate) e não participa do fundo (IBX-0045, IBX-0059) |
| docs/spec/ versionado (este diretório) | Troca de CLI/agente sem perda de contexto; histórico no git |
| docs/agents/ local | Regras de papéis do workspace Maestri, não versionadas por design |
| OTA iOS pelo canal `production` com o env `development` | DEC-0006: device, simulador e agentes rodam no Convex de dev `kindred-yak-142`. A flag `--environment` do eas-cli **vence** o `.env.local`: com ela o export roda com `EXPO_NO_DOTENV=1` e o env do EAS sobreposto ao do shell, então o environment errado embute a URL do Convex errada. Script de hoje: `update:ios:prod-dev-env`; `update:ios:prod` (env `production`, `amiable-albatross-845`) volta a ser o certo quando o device voltar pro PROD |

## Próximos passos conhecidos

- Itens de decisão da padronização ainda em aberto (se não resolvidos):
  renomear `canManageLeague`, `organizerType` → `organizationType`,
  `requireActiveManager` → `requireActiveOrganizer` — verificar nos docs de
  domínio se já foram aplicados.
