# Frontend — convenções deste app (leia antes de codar)

Estrutura: rotas em `src/app/` (grupos `(public)/` e `(private)/`, `_layout.tsx` por
grupo montando Stack/Tabs e gates de auth/ator); views grandes e reutilizáveis em
`src/components/pages/<feature>/`; UI base em `src/components/ui/` e
`src/components/core/`; lógica de domínio, derivadas e stores em `src/lib/<feature>/`.
Regra de negócio NUNCA dentro de componente — o componente consome derivada pronta.

Rotas: arquivo = rota, dinâmica com `[param]`; params com `useLocalSearchParams`,
navegação com `router`/`Link`. A TELA é dona do fluxo de dados — queries, mutations,
toasts e invalidates vivem nela, no padrão das telas existentes
(`leagues/[leagueId]/challenges.tsx`, `ranking.tsx`). Views grandes ficam em `pages/` e
são renderizadas pela rota; forms RHF moram na tela ou em componentes dedicados
(`components/pages/<dominio>/form/`).

Dados: SEMPRE `useCRPC()` (`@/lib/convex/crpc`) + TanStack Query —
`useQuery(crpc.<modulo>.<arquivo>.<fn>.queryOptions(input))`,
`useMutation(...mutationOptions({ onError }))`, refresh com
`queryClient.invalidateQueries(crpc...queryFilter(input))`. Gate condicional com
`enabled` (ex.: esperar o viewer context decidir o ator). Nunca fetch/axios direto,
nunca chave de query manual.

Estados de tela: toda query tem loading, erro e vazio tratados com `LoadingState`,
`ErrorState` e `EmptyState` de `@/components/ui/`; erro de mutation vira toast via
`getToastErrorMessage` (`@/lib/errors/toast-message`).

Forms: react-hook-form + `zodResolver` com o schema do contrato do domínio
(`@convex/domains/<modulo>/contract`, fonte única app+backend) + validações de tela.
Nunca duplique schema que já existe no domínio; campo que o contrato não cobre se
resolve no backend, não local.

Estado local: stores `@legendapp/state` em `src/lib/<feature>/*-store.ts` (padrão
`league-form-store`, `league-details-store`). Estado compartilhado do fluxo vive na
store — nunca prop drilling nem estado duplicado entre store e query.

UI: HeroUI Native (OSS + Pro) + Uniwind; ícones via `HugeIcons`
(`@/components/ui/huge-icons`); classes Uniwind direto no `cn`/`className` (nunca const
de estilo, RUL-0026); reutilize `@/components/ui/*` e `core/*` em vez de versão local;
card/tecla interativo usa `Card` + `PressableFeedback` com `Highlight` como último filho
(RUL-0003); overlay com `position absolute` fica filho direto do container de layout
(RUL-0008).

Listas: `Page.LegendList` (`@/components/core/page`, AnimatedLegendList do
`@legendapp/list`) dentro de `ScrollShadow` — nunca FlatList/ScrollView manual pra lista
grande; ordenação/drag segue o padrão existente (`SortableCardList`, reanimated-dnd).

Imports: aliases `@/*` (src) e `@convex/*` (convex) — nunca caminho relativo cruzando
diretório top-level.

Dados de teste manuais: nunca nomes com cheiro de IA, sempre humanos (a regra de dados
concreta vive na `team-rules`).
