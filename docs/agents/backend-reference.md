# Backend — invariantes do repo (leia antes de codar)

Domínio: `convex/domains/<modulo>/` com `tables.ts` (convexTable + índices),
`relations.ts`, `contract.ts` (schemas zod e tipos compartilhados com o app via
`@convex/*`), `*-rules.ts` (regras puras e testáveis) e `tests/`. O app importa o
contract — nunca duplique schema/tipo do lado do app. Helpers de schema em
`convex/utils/contract.zod.ts` (`requiredString`, `enumField`, `requiredNumber`). Seed de
dev em `convex/functions/seed.ts` + `convex/domains/seed/`.

Procedures: `convex/functions/<modulo>/<arquivo>.ts` viram `api.<modulo>.<arquivo>.<fn>`.
Use SEMPRE os builders de `convex/lib/crpc.ts`: `publicQuery/Mutation/Action`,
`optionalAuthQuery/Mutation`, `authQuery/Mutation/Action` (meta auth "optional"/"required"
dirige o cliente), `privateQuery/Mutation/Action` (internal, nunca exposto) e
`publicRoute`/`authRoute`/`optionalAuthRoute` + `router` para HTTP. Nos builders auth,
`ctx.user`/`ctx.userId` já vêm resolvidos pelo middleware — nunca re-busque sessão dentro
da procedure. O módulo `viewer/` (`context.ts`) expõe sessão, ator ativo
(player/organization) e capacidades: é dele que o app tira o gating de telas.

Padrões inegociáveis: `ctx.orm` para dados do app (nunca `ctx.db` em caminho que depende
de constraints/RLS); input root sempre `z.object(...)`; erro esperado = `CRPCError` com
código explícito (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, BAD_REQUEST,
TOO_MANY_REQUESTS); listas sempre limitadas (`limit`, cursor ou
`.paginated({ limit, item })`); `where` com predicado exige `.withIndex(...)`;
update/delete sem `where` é proibido; sem `.output(...)` em mutation sem retorno (nunca
`z.void()`); `.meta(...)` é visível no cliente — nunca segredo ali.

Composição entre procedures: `ctx.runAction`/`ctx.runMutation`/`ctx.runQuery` com
referências `internal.<modulo>.<arquivo>.<fn>`. Duas exceções documentadas no codebase:
arquivo `"use node"` (`payment/providerNode.ts`) não pode ser importado de código comum
nem ter caller gerado usado (quebra o bundle do Convex) — só via `ctx.runAction`; e action
que precisa de `ctx.orm` cruza com `ctx.runMutation(internal.*)` porque o caller gerado
tem problema de inferência TS para `.actions` em `ActionCtx`. A skill kitcn recomenda
`create<Module>Handler/Caller` de `convex/functions/generated/<modulo>.runtime.ts`; este
repo ainda não usa — siga o padrão existente, nunca introduza convenção paralela.

Invariantes entre linhas: trigger de schema (`.triggers(...)` no `defineSchema`) quando
bounded e não-recursivo; senão helper explícito na mutation. Side effect externo (Resend,
Woovi) fica em action, nunca em query/mutation.

Auth: Better Auth em `convex/functions/auth.ts` via `defineAuth` (plugins: expo,
organization, emailOTP, i18n; social Apple/Google ligado por env). Tabelas/relations/
triggers de auth vivem em `convex/domains/auth/`, roles e permissões em
`convex/shared/auth-shared.ts`, trusted origins em `convex/lib/auth-trusted-origins.ts`,
i18n em `convex/lib/auth-i18n.ts`. Env do servidor fica em `convex/.env` e é lida só via
`convex/lib/get-env.ts` — nunca `process.env` solto.

HTTP/webhooks: `convex/functions/http.ts` monta o Hono (CORS por `SITE_URL`,
`authMiddleware`) e exporta `httpRouter` com os routers de domínio. Webhook SEMPRE valida
assinatura antes de qualquer side effect. Crons em `convex/crons.ts` (UTC).

Migrations: `bunx kitcn migrate create <nome>` para backfill, rename, remoção ou campo
opcional→obrigatório — gera o arquivo datado em `convex/functions/migrations/` e atualiza
`manifest.ts`. Mudança backward-compatible (tabela nova, campo opcional novo) não precisa
de migration.

Código gerado: NUNCA edite à mão `convex/functions/generated/`,
`convex/functions/_generated/`, `convex/shared/api.ts` e
`convex/functions/migrations/manifest.ts` — ajuste a fonte e rode `bun run codegen`.

Testes: regra de domínio e contrato ganham teste em `convex/domains/<modulo>/tests/`.
Mínimo por feature: happy path, UNAUTHORIZED, FORBIDDEN quando relevante, NOT_FOUND e
side effect de trigger/schedule.
