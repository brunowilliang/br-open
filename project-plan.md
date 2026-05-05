# BR Open - Escopo e Roteiro de Desenvolvimento

## Visao do Produto

O BR Open e um app mobile para organizar, descobrir e acompanhar torneios de
tenis no Brasil. O produto completo deve resolver a operacao ponta a ponta:
criacao do torneio, inscricoes, pagamentos, chaves, agenda, resultados,
notificacoes, ranking, ligas, clubes, patrocinadores e administracao da
plataforma. A experiencia do jogador vem junto, mas o produto so fica forte
quando organizadores, ligas e clubes conseguem operar competicoes reais dentro
da plataforma.

## Publicos

### Jogador

- Descobre torneios por cidade, estado, data, categoria e modalidade.
- Cria perfil com nome, cidade, nivel/categoria, genero, data de nascimento e
  clube.
- Inscreve-se em categorias disponiveis.
- Acompanha chaves, horarios, local, regulamento, resultados e proxima partida.
- Recebe notificacoes de inscricao, confirmacao, alteracao de horario e chamada
  de jogo.
- Consulta historico de torneios, partidas e desempenho.

### Organizador

- Cria e publica torneios.
- Define local, datas, categorias, genero/modalidade, vagas, preco, regulamento
  e premiacao.
- Acompanha inscritos por categoria.
- Fecha inscricoes e gera chaves.
- Define quadras e horarios.
- Atualiza resultados e status das partidas.
- Envia comunicados para jogadores inscritos.
- Consulta relatorios basicos de inscricoes, receita e andamento do torneio.

### Gestor de Liga

- Cria uma liga publica ou privada.
- Define nome, cidade/estado, regulamento, categorias, temporadas e regra de
  pontuacao.
- Permite que jogadores se inscrevam na liga.
- Acompanha membros, ranking, historico e evolucao dos jogadores.
- Vincula torneios e partidas ao ranking da liga.
- Publica comunicados para membros da liga.

### Clube ou Arena

- Cadastra locais, endereco, contatos e quadras.
- Pode hospedar varios torneios.
- Pode ter pagina publica com torneios ativos e historico.

### Admin BR Open

- Modera torneios, usuarios e organizadores.
- Aprova organizadores, se necessario.
- Acompanha metricas gerais da plataforma.
- Resolve problemas de inscricoes, pagamentos e denuncias.

## Principios do Produto Completo

- Construir em fases, mas manter o escopo final desde o primeiro schema.
- Comecar pelo fluxo do organizador, porque sem torneios nao existe marketplace.
- Evitar retrabalho: modelar desde o inicio categorias, pagamentos, chaves,
  partidas, rankings, ligas e clubes como dominios separados.
- Fazer tudo mobile-first.
- Ter links compartilhaveis para torneios, porque divulgacao por WhatsApp e
  Instagram sera fundamental.
- Manter horario, pagamento e notificacao como funcionalidades criticas, nao
  cosmeticas.
- Separar claramente "torneio em rascunho", "publicado", "inscricoes abertas",
  "inscricoes encerradas", "chaves geradas", "em andamento" e "finalizado".
- Nao colocar componentes, tipos ou logica de negocio dentro de `src/app`; a
  pasta `app` deve ter apenas rotas e layouts.

## Stack do Projeto

O projeto deve seguir a base ja instalada no repositorio atual.

### Estrutura do Repositorio

- Package manager: Bun.
- Repo unico, sem divisao por workspaces ou pacotes internos.
- App Expo/React Native na raiz, com codigo em `src`.
- Rotas Expo Router em `src/app`.
- Componentes reutilizaveis em `src/components`.
- Helpers, clients e providers do app em `src/lib`.
- Backend Convex/kitcn na raiz em `convex`.
- Codigo deployado em `convex/functions`.
- Regras internas e algoritmos em `convex/lib`.
- Codigo compartilhado seguro para o app em `convex/shared`.

### Backend

- Convex como backend realtime, banco de dados, funcoes, actions, HTTP routes e
  webhooks.
- Better Auth como camada de autenticacao.
- `kitcn` como camada Convex para organizar funcoes, auth, cRPC, API type-safe,
  runtime gerado e codigo compartilhado com o app.
- Stripe para pagamentos de inscricao: Pix, Apple Pay, Google Pay, credito e
  debito.

Observacao: no `package.json` atual ja existem `convex`, `better-auth`,
`@better-auth/expo` e `kitcn`. O pacote Stripe ainda nao aparece instalado e
deve entrar quando a fase de pagamentos comecar.

### Frontend

- Expo.
- React Native.
- Expo Router.
- HeroUI Native.
- HeroUI Native Pro, se a licenca estiver disponivel.
- Uniwind.
- Uniwind Pro, se a licenca estiver disponivel.
- Expo Secure Store para persistencia segura da sessao no app nativo.
- Expo Notifications para notificacoes push.

Observacao: para app mobile, o nome correto da biblioteca e HeroUI Native.
HeroUI React / HeroUI Pro web nao devem ser usados nos componentes nativos.

### Pagamentos

- Stripe deve ser a base oficial de pagamentos.
- Pix deve ser tratado como metodo principal no Brasil.
- Cartao credito/debito deve ser suportado via Stripe.
- Apple Pay e Google Pay devem ser suportados via Stripe React Native.
- Apple Pay e Google Pay exigem development build/EAS Build; nao devem ser
  tratados como recursos testaveis apenas no Expo Go.
- Webhooks do Stripe devem atualizar o status da inscricao no Convex.
- Para marketplace/split futuro, avaliar Stripe Connect antes de definir o
  modelo financeiro final.

### Fora da Base Inicial

- Clerk nao deve ser usado neste projeto.
- Convex Auth nao deve ser usado como auth principal enquanto Better Auth +
  `kitcn` ja estiverem configurados.
- Pagamento manual por Pix pode existir apenas como fallback operacional, nao
  como arquitetura principal.
- Mapas/localizacao ficam para fase posterior, depois que busca por
  cidade/estado estiver validada.

## Setup Inicial

1. Usar a estrutura atual de repo unico.
2. Rodar o backend com `bun run convex:dev`.
3. Rodar o app mobile com `bun run dev`, `bun run ios`, `bun run android` ou
   `bun run web`, conforme o ambiente.
4. Manter auth em Better Auth + `kitcn`, usando `convex/functions/auth.ts` como
   contrato de auth no backend.
5. Manter o backend no padrao `convex/functions`, `convex/lib` e
   `convex/shared`.
6. Definir o schema Convex em `convex/functions/schema.ts` antes de construir
   telas complexas.
7. Organizar procedures cRPC por dominio dentro de `convex/functions`.
8. Manter regras internas e algoritmos em `convex/lib`.
9. Manter tipos/client metadata seguros em `convex/shared`.
10. Manter telas/rotas apenas em `src/app`.
11. Manter componentes reutilizaveis em `src/components`.
12. Criar dados seed de exemplo: cidades, clubes, ligas, torneios, categorias e
    jogadores.
13. Adicionar Stripe quando a fase de pagamentos comecar.

## Convex Dev e Dashboard

Para rodar o Convex com `kitcn`, use o script da raiz:

```bash
bun run convex:dev
```

O script executa `kitcn dev`. Quando aparecer que as funcoes Convex estao
prontas, o backend esta pronto para o app consumir.

Se o ambiente estiver usando Convex local, as URLs comuns sao:

- Dashboard Convex: `http://127.0.0.1:6790`
- API interna do dashboard/tooling: `http://127.0.0.1:6791`
- Convex client URL usada pelo app: `http://127.0.0.1:3210`
- Convex site/auth URL usada pelo app: `http://127.0.0.1:3211`

Se o ambiente estiver usando Convex local, as portas `3210` e `3211` podem ficar
registradas em `.convex/local/default/config.json`:

```json
{
  "ports": {
    "cloud": 3210,
    "site": 3211
  }
}
```

As portas `6790` e `6791` nao ficam no `convex.json`, `kitcn.json` ou `.env`.
Elas sao levantadas pelo processo local do Convex/kitcn para o dashboard e
tooling. Para confirmar em uma maquina local:

```bash
lsof -nP -iTCP -sTCP:LISTEN | rg '3210|3211|6790|6791|convex'
```

O app Expo deve apontar para o Convex em `.env.local`. Em ambiente local, os
valores costumam ficar assim:

```env
EXPO_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
EXPO_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211
```

Observacao operacional: nao assumir scripts de workspaces ou pacotes internos.
A base atual usa os scripts da raiz definidos em `package.json`.

## Estrutura Sugerida de Rotas

Sim, precisa existir uma estrutura de rotas, porque o Expo Router usa a pasta
`app` como fonte de navegacao. O que nao precisa e transformar cada componente
em rota. A pasta `src/app` deve conter apenas telas e `_layout.tsx`;
componentes reutilizaveis ficam em `src/components`, hooks em `src/hooks`,
helpers em `src/lib`, e regras/backend em `convex`.

A estrutura atual ainda esta minima. Para o BR Open, a recomendacao e evoluir
para grupos de rotas mais claros: auth, app autenticado, telas publicas,
organizador e admin.

```txt
src/app/
  _layout.tsx
  +not-found.tsx
  index.tsx
  modal.tsx

  (auth)/
    _layout.tsx
    login.tsx
    register.tsx
    complete-profile.tsx

  (app)/
    _layout.tsx
    (tabs)/
      _layout.tsx
      index.tsx
      tournaments.tsx
      leagues.tsx
      calendar.tsx
      notifications.tsx
      profile.tsx

    tournaments/
      [tournamentId]/
        index.tsx
        register.tsx
        payment.tsx
        bracket.tsx
        schedule.tsx
        rules.tsx
        players.tsx
        results.tsx

    venues/
      index.tsx
      [venueId]/
        index.tsx
        courts.tsx
        tournaments.tsx

    rankings/
      index.tsx
      [rankingId].tsx

    leagues/
      index.tsx
      [leagueId]/
        index.tsx
        join.tsx
        ranking.tsx
        members.tsx
        seasons.tsx
        tournaments.tsx
        calendar.tsx

    organizer/
      _layout.tsx
      index.tsx
      tournaments/
        new.tsx
        [tournamentId]/
          index.tsx
          settings.tsx
          categories.tsx
          registrations.tsx
          payments.tsx
          bracket.tsx
          matches.tsx
          schedule.tsx
          communications.tsx
          reports.tsx
      leagues/
        new.tsx
        [leagueId]/
          index.tsx
          settings.tsx
          members.tsx
          seasons.tsx
          scoring.tsx
          ranking.tsx
          tournaments.tsx
          communications.tsx

    admin/
      _layout.tsx
      index.tsx
      users.tsx
      organizers.tsx
      leagues.tsx
      tournaments.tsx
      payments.tsx
      reports.tsx
      moderation.tsx
```

Regras para essa estrutura:

- `index.tsx` na raiz pode redirecionar para `/login`, `/` autenticado ou
  descoberta, dependendo da sessao.
- `(auth)` deve ser publico.
- `(app)` deve ser protegido por sessao.
- `(app)/(tabs)` deve conter as telas principais do jogador.
- `organizer` pode ficar dentro de `(app)` porque tambem exige login e role de
  organizador.
- `admin` pode ficar dentro de `(app)` porque tambem exige login e role de
  admin.
- Usar diretorio dinamico com `index.tsx`, por exemplo
  `tournaments/[tournamentId]/index.tsx`, e mais limpo do que misturar
  `[tournamentId].tsx` com subrotas.
- Se algum drawer for adotado, ele deve ser uma decisao de navegacao visual, nao
  a organizacao principal do dominio. Para este app, tabs + stacks ja resolvem
  melhor a primeira versao completa.
- Expo Router loaders nao precisam ser a base do app nativo. Eles fazem mais
  sentido para web/SSR. Para o app Expo + Convex, carregar dados com
  queries/hooks do Convex nas telas e componentes de feature e mais direto.

## Modelo de Dados no Convex

### `users`

- Nome, email, telefone, foto, role principal e status.
- Roles: `player`, `organizer`, `league_manager`, `club`, `admin`.

### `playerProfiles`

- Usuario, cidade, estado, data de nascimento, genero, mao dominante, categoria
  declarada, clube e bio curta.

### `organizerProfiles`

- Usuario, nome publico, documento opcional, telefone, cidade, status de
  verificacao.

### `venues`

- Nome do clube/local, endereco, cidade, estado, coordenadas opcionais, contato,
  quantidade de quadras e tipos de piso.

### `tournaments`

- Nome, slug, organizador, local, cidade, estado, datas, status, descricao,
  regulamento, premiacao, imagem, politica de cancelamento e visibilidade.

### `tournamentCategories`

- Torneio, nome da categoria, genero/modalidade, tipo de disputa, limite de
  vagas, preco, idade minima/maxima opcional e status.

Exemplos:

- Especial masculino simples
- A feminino simples
- B masculino duplas
- C misto duplas
- D masculino simples

### `registrations`

- Torneio, categoria, jogador ou dupla, status, data de inscricao, origem,
  comprovante/pagamento e observacoes.

Status:

- `pending`
- `confirmed`
- `waitlist`
- `cancelled`
- `rejected`

### `courts`

- Local, nome/numero da quadra, tipo de piso, ativa/inativa.

### `matches`

- Torneio, categoria, fase, rodada, jogador A, jogador B, vencedor, placar,
  status, horario previsto, quadra e observacoes.

Status:

- `scheduled`
- `calling`
- `in_progress`
- `finished`
- `walkover`
- `cancelled`

### `brackets`

- Torneio, categoria, formato, seed, estrutura da chave e data de geracao.

### `notifications`

- Usuario, tipo, titulo, mensagem, link interno, lida/nao lida e data.

### `payments`

- Inscricao, usuario pagador, valor, moeda, metodo, status, gateway, Stripe
  PaymentIntent/Checkout Session, datas e metadata.
- Status vem preferencialmente do Stripe via webhook.
- Status manual deve existir apenas para isencao, ajuste administrativo ou
  contingencia registrada em auditoria.

### `leagues`

- Nome, slug, criador/gestor, cidade, estado, descricao, visibilidade, status,
  regulamento, regra de pontuacao, categorias aceitas e politica de entrada.
- Visibilidade: publica, privada ou por convite.
- Status: rascunho, aberta, em andamento, pausada, finalizada e arquivada.

### `leagueMemberships`

- Liga, jogador, status, categoria na liga, data de entrada, papel interno,
  origem da inscricao e observacoes.
- Status: pendente, ativo, suspenso, saiu, rejeitado.

### `leagueSeasons`

- Liga, nome da temporada, data inicial, data final, status, regra de pontuacao
  e configuracoes de reset/manutencao de ranking.
- Permite que a mesma liga tenha ranking mensal, trimestral, anual ou por
  circuito.

### `leagueRankingEntries`

- Liga, temporada, jogador, pontos, posicao, vitorias, derrotas, torneios
  jogados, partidas jogadas, ultima atualizacao e criterios de desempate.

### `leagueEvents`

- Liga, tipo de evento, torneio vinculado opcional, partida vinculada opcional,
  jogador afetado, pontos gerados e motivo.
- Serve como ledger/auditoria do ranking da liga.

### `auditLogs`

- Quem alterou, o que alterou, entidade afetada e data.
- Importante para resultados, horarios e cancelamentos.

## Modulos Convex Sugeridos

O backend deve seguir o padrao do `kitcn`: separar codigo deployado em
`convex/functions`, helpers internos em `convex/lib` e codigo importavel pelo
client em `convex/shared`. Cada arquivo dentro de `convex/functions` vira um
namespace da API gerada, entao `convex/functions/tournaments.ts` gera chamadas
como `crpc.tournaments.list.queryOptions(...)`.

O projeto deve manter a estrutura alvo do kitcn assim:

```txt
convex.json
convex/
  functions/
    _generated/
      api.ts
      dataModel.ts
    generated/
      server.ts
      auth.ts
    schema.ts
    auth.ts
    auth.config.ts
    convex.config.ts
    http.ts
    users.ts
    profiles.ts
    venues.ts
    tournaments.ts
    categories.ts
    registrations.ts
    payments.ts
    brackets.ts
    matches.ts
    schedule.ts
    notifications.ts
    rankings.ts
    leagues.ts
    leagueRankings.ts
    sponsors.ts
    audit.ts
    admin.ts
    migrations.ts
    crons.ts
  lib/
    crpc.ts
    orm.ts
    auth.ts
    permissions.ts
    errors.ts
    env.ts
    payments/
      stripe.ts
      webhooks.ts
    brackets/
      single-elimination.ts
      round-robin.ts
      groups.ts
      seeding.ts
    scheduling/
      conflicts.ts
      slots.ts
      reminders.ts
    notifications/
      push.ts
      templates.ts
    leagues/
      scoring.ts
      standings.ts
      seasons.ts
      memberships.ts
    plugins/
      ratelimit/
        schema.ts
        plugin.ts
  shared/
    api.ts
    types.ts
    constants.ts
```

Responsabilidades:

- `convex.json`: deve apontar `functions` para `convex/functions`, seguindo o
  padrao kitcn.
- `convex/functions/schema.ts`: schema ORM do kitcn com tabelas, indices,
  relacoes, triggers e extensoes.
- `convex/functions/auth.ts`: contrato Better Auth via kitcn; alterar aqui ao
  adicionar plugins ou mudar comportamento de auth.
- `convex/functions/auth.config.ts`: provider de auth do Convex usando o helper
  de config do kitcn.
- `convex/functions/http.ts`: rotas HTTP, Better Auth e webhooks como Stripe.
- `convex/functions/generated/*`: runtime gerado pelo kitcn; nao editar
  manualmente.
- `convex/functions/_generated/*`: tipos gerados pelo Convex; nao editar
  manualmente.
- `convex/functions/*.ts`: procedures cRPC por dominio. Separar por area do
  produto, nao por tipo tecnico.
- `convex/functions/migrations.ts`: migracoes/backfills quando o schema evoluir.
- `convex/functions/crons.ts`: rotinas agendadas como lembrete de partida,
  expiracao de pagamento e ranking periodico.
- `convex/lib/crpc.ts`: cria builders `publicQuery`, `authQuery`, `adminQuery`,
  `publicMutation`, `authMutation`, `adminMutation`, `privateMutation`,
  `publicAction`, `privateAction`, `publicRoute` e `router`.
- `convex/lib/orm.ts`: helpers de ORM, se precisar anexar contexto ou padronizar
  acesso.
- `convex/lib/auth.ts`: helpers como `requireUser`, `requireOrganizer`,
  `requireAdmin` e leitura da sessao.
- `convex/lib/permissions.ts`: regras de autorizacao por role e ownership.
- `convex/lib/payments/*`: logica interna de Stripe, PaymentIntent, Pix,
  reembolso, Connect e webhooks. As procedures publicas continuam em
  `functions/payments.ts`.
- `convex/lib/brackets/*`: algoritmos puros de chaveamento, seed, grupos e todos
  contra todos.
- `convex/lib/scheduling/*`: algoritmo de agenda, conflitos, descanso minimo e
  lembretes.
- `convex/lib/notifications/*`: push notification, templates e roteamento de
  comunicados.
- `convex/lib/leagues/*`: regras internas de pontuacao, temporadas, membros,
  criterios de desempate e recalculo de ranking de liga.
- `convex/lib/plugins/*`: plugins kitcn como rate limiting, caso sejam adotados.
- `convex/shared/api.ts`: metadata gerada da API cRPC para o app Expo consumir
  com `kitcn/react`.
- `convex/shared/types.ts`: tipos compartilhados seguros para client.
- `convex/shared/constants.ts`: constantes compartilhadas como status, labels e
  limites.

Regras de uso:

- Queries de leitura realtime devem ser `publicQuery`, `authQuery` ou
  `adminQuery`.
- Escritas transacionais devem ser `publicMutation`, `authMutation` ou
  `adminMutation`.
- Integrações externas como Stripe, Expo Push e WhatsApp devem ficar em `action`
  ou HTTP route, nao em mutation pura.
- Webhooks e rotas server-to-server devem usar builders internos/privados e
  serem idempotentes.
- A pasta `convex/lib` nao deve ser importada diretamente pelo app mobile; app
  consome `convex/shared` e a API gerada.
- Evitar arquivo gigante por dominio. Se `tournaments.ts` crescer demais, manter
  a API publica nele e mover regras internas para `convex/lib/tournaments/*`.
- Ao evoluir o padrao kitcn, rodar `kitcn dev` para regenerar
  `convex/functions/generated/*` e `convex/shared/api.ts`; nao editar arquivos
  gerados manualmente.

## Funcionalidades por Area

### 1. Autenticacao, Perfil e Permissoes

- [ ] Cadastro por email e senha.
- [ ] Login por email e senha.
- [ ] Logout.
- [ ] Sessao persistida no app nativo com Expo Secure Store.
- [ ] Recuperacao de senha.
- [ ] Verificacao de email.
- [ ] Login social, se fizer sentido para aquisicao.
- [ ] Perfil do jogador com nome, foto, cidade, estado, telefone, genero, data
      de nascimento, clube, categoria declarada e mao dominante.
- [ ] Perfil publico do jogador com historico, rankings e estatisticas.
- [ ] Perfil de organizador com nome publico, telefone, cidade, status de
      verificacao e documentos opcionais.
- [ ] Perfil de clube/arena com dados comerciais, endereco, contatos e quadras.
- [ ] Roles: jogador, organizador, gestor de liga, clube e admin.
- [ ] Guardas de rota para area do organizador.
- [ ] Guardas de rota para area administrativa.
- [ ] Preferencias de notificacao.
- [ ] Termos de uso e politica de privacidade.

### 2. Descoberta de Torneios

- [ ] Lista de torneios publicados.
- [ ] Busca por texto.
- [ ] Filtro por cidade e estado.
- [ ] Filtro por data.
- [ ] Filtro por categoria.
- [ ] Filtro por genero/modalidade.
- [ ] Filtro por simples/duplas.
- [ ] Busca por raio usando geolocalizacao.
- [ ] Calendario nacional de torneios.
- [ ] Torneios favoritos.
- [ ] Recomendacoes por cidade, nivel e historico do jogador.
- [ ] Tela de detalhes do torneio.
- [ ] Link compartilhavel do torneio.
- [ ] Estado de inscricoes: abertas, encerradas, em andamento e finalizadas.

### 3. Clubes, Arenas e Quadras

- [ ] Cadastro de local.
- [ ] Edicao de local.
- [ ] Endereco, cidade, estado e coordenadas opcionais.
- [ ] Contatos publicos do clube.
- [ ] Cadastro de quadras.
- [ ] Tipo de piso da quadra.
- [ ] Status da quadra: ativa, manutencao ou indisponivel.
- [ ] Pagina publica do clube.
- [ ] Lista de torneios ativos no clube.
- [ ] Historico de torneios do clube.

### 4. Torneios do Organizador

- [ ] Criar torneio.
- [ ] Editar torneio.
- [ ] Duplicar torneio anterior.
- [ ] Definir local.
- [ ] Definir data inicial e final.
- [ ] Definir descricao.
- [ ] Definir regulamento.
- [ ] Usar templates de regulamento.
- [ ] Definir premiacao.
- [ ] Definir imagem/banner.
- [ ] Definir patrocinadores.
- [ ] Publicar/despublicar torneio.
- [ ] Status do torneio: rascunho, publicado, inscricoes abertas, inscricoes
      encerradas, chaves geradas, em andamento, finalizado e cancelado.
- [ ] Pagina customizada/publica do torneio.
- [ ] Dashboard do organizador por torneio.
- [ ] Relatorios basicos do torneio.

### 5. Categorias e Regras de Inscricao

- [ ] Criar categoria.
- [ ] Editar categoria.
- [ ] Ativar/desativar categoria.
- [ ] Categoria por nivel: Especial, A, B, C, D.
- [ ] Categoria por genero: masculino, feminino e misto.
- [ ] Modalidade: simples e duplas.
- [ ] Limite de vagas.
- [ ] Preco por categoria.
- [ ] Regras de idade minima/maxima.
- [ ] Nivel minimo/maximo.
- [ ] Lista de inscritos por categoria.
- [ ] Lista de espera por categoria.
- [ ] Promocao automatica da lista de espera quando abrir vaga.
- [ ] Bloqueio de inscricao quando categoria estiver cheia.

### 6. Inscricoes

- [ ] Jogador escolhe torneio e categoria.
- [ ] Jogador confirma dados antes de inscrever.
- [ ] Inscricao em multiplas categorias.
- [ ] Inscricao em duplas com convite de parceiro.
- [ ] Status de inscricao: pendente, aguardando pagamento, confirmada, lista de
      espera, cancelada e rejeitada.
- [ ] Cancelamento de inscricao pelo jogador conforme regra do torneio.
- [ ] Cancelamento/rejeicao pelo organizador.
- [ ] Isencao manual pelo organizador/admin com auditoria.
- [ ] Jogador acompanha status em "Meus torneios".
- [ ] Organizador acompanha inscritos por categoria.

### 7. Pagamentos com Stripe

- [ ] Instalar e configurar `@stripe/stripe-react-native`.
- [ ] Configurar publishable key no app.
- [ ] Configurar secret key no backend Convex.
- [ ] Criar PaymentIntent ou fluxo equivalente para inscricao.
- [ ] Suportar Pix via Stripe.
- [ ] Suportar cartao de credito/debito.
- [ ] Configurar Apple Pay.
- [ ] Configurar Google Pay.
- [ ] Preparar development build/EAS Build para Apple Pay e Google Pay.
- [ ] Registrar pagamento em `payments`.
- [ ] Webhook Stripe em `convex/functions/http.ts`.
- [ ] Validar assinatura do webhook.
- [ ] Atualizar status de pagamento por webhook.
- [ ] Confirmar inscricao automaticamente apos pagamento aprovado.
- [ ] Tratar pagamento pendente, aprovado, expirado, falho, cancelado e
      reembolsado.
- [ ] Cupons/descontos.
- [ ] Recibos.
- [ ] Reembolso total/parcial.
- [ ] Taxa de plataforma.
- [ ] Stripe Connect/split para repasse a organizadores ou clubes.
- [ ] Relatorio financeiro do organizador.
- [ ] Relatorio financeiro do admin.

### 8. Chaves e Formatos de Disputa

- [ ] Gerar eliminatoria simples.
- [ ] Gerar BYE automatico quando necessario.
- [ ] Sorteio aleatorio.
- [ ] Seed manual.
- [ ] Seed por ranking.
- [ ] Regerar chave antes do torneio iniciar.
- [ ] Bloquear alteracao livre depois da primeira partida.
- [ ] Grupos + mata-mata.
- [ ] Todos contra todos.
- [ ] Consolacao.
- [ ] Chave de duplas.
- [ ] Tela publica da chave.
- [ ] Tela do organizador para revisar chave.

### 9. Agenda, Quadras e Horarios

- [ ] Criar horarios de disputa.
- [ ] Associar partida a quadra.
- [ ] Associar partida a horario.
- [ ] Jogador visualiza proxima partida.
- [ ] Organizador altera horario.
- [ ] Alteracao de horario registra auditoria.
- [ ] Alteracao de horario notifica jogadores.
- [ ] Bloqueio de quadras indisponiveis.
- [ ] Regras de descanso entre partidas.
- [ ] Deteccao de conflito de jogador em duas partidas no mesmo horario.
- [ ] Sugestao automatica de grade.
- [ ] Modo chamada de jogo.
- [ ] Visao "telão" ou pagina publica ao vivo.

### 10. Partidas, Placar e Resultados

- [ ] Criar partidas a partir da chave.
- [ ] Status da partida: agendada, chamada, em andamento, finalizada, WO e
      cancelada.
- [ ] Organizador informa vencedor.
- [ ] Organizador informa placar.
- [ ] Validacao basica de placar.
- [ ] Sistema avanca vencedor na chave.
- [ ] Jogador visualiza resultado.
- [ ] Historico da partida.
- [ ] Jogador confirma placar.
- [ ] Contestacao de resultado.
- [ ] WO com motivo.
- [ ] Upload de sumula/foto.
- [ ] Finalizacao da categoria com campeao e vice.

### 11. Notificacoes e Comunicados

- [ ] Central de notificacoes dentro do app.
- [ ] Registrar push token.
- [ ] Inscricao recebida.
- [ ] Pagamento aprovado.
- [ ] Inscricao confirmada/cancelada.
- [ ] Chave publicada.
- [ ] Partida agendada.
- [ ] Horario alterado.
- [ ] Chamada de jogo.
- [ ] Resultado publicado.
- [ ] Lembrete automatico antes da partida.
- [ ] Comunicados por torneio.
- [ ] Comunicados por categoria.
- [ ] Comunicados por jogador.
- [ ] WhatsApp opcional para comunicados criticos.

### 12. Ranking, Historico e Estatisticas

- [ ] Historico de torneios inscritos.
- [ ] Historico de partidas.
- [ ] Estatisticas de vitorias/derrotas.
- [ ] Estatisticas por categoria.
- [ ] Pontos por torneio.
- [ ] Regras de pontuacao por fase.
- [ ] Ranking por cidade.
- [ ] Ranking por estado.
- [ ] Ranking nacional BR Open.
- [ ] Ranking por categoria.
- [ ] Badges/conquistas.
- [ ] Perfil publico com desempenho.

### 13. Ligas e Ranking de Liga

- [ ] Criar liga.
- [ ] Editar liga.
- [ ] Definir liga publica, privada ou por convite.
- [ ] Definir cidade/estado da liga.
- [ ] Definir regulamento da liga.
- [ ] Definir categorias aceitas na liga.
- [ ] Definir temporada da liga.
- [ ] Definir regra de pontuacao da liga.
- [ ] Jogador solicitar entrada na liga.
- [ ] Gestor aprovar/reprovar membro.
- [ ] Membro sair da liga.
- [ ] Gestor suspender/remover membro.
- [ ] Ranking publico da liga.
- [ ] Ranking por temporada.
- [ ] Ranking por categoria dentro da liga.
- [ ] Pontos gerados por torneios vinculados.
- [ ] Pontos gerados por partidas vinculadas.
- [ ] Ledger/auditoria de pontos da liga.
- [ ] Criterios de desempate.
- [ ] Comunicados para membros da liga.
- [ ] Pagina publica da liga.
- [ ] Compartilhar link da liga.
- [ ] Vincular torneio a uma liga.
- [ ] Criar circuito de torneios dentro da liga.

### 14. Patrocinadores e Paginas Publicas

- [ ] Cadastro de patrocinador do torneio.
- [ ] Logo/banner de patrocinador.
- [ ] Links de patrocinador.
- [ ] Area de patrocinadores na pagina do torneio.
- [ ] Destaque de torneio patrocinado na busca.
- [ ] Pagina publica compartilhavel do torneio.
- [ ] Pagina publica compartilhavel do clube.
- [ ] Pagina publica compartilhavel da liga.

### 15. Admin e Moderacao

- [ ] Listar usuarios.
- [ ] Listar organizadores.
- [ ] Listar ligas.
- [ ] Aprovar/reprovar organizador.
- [ ] Listar clubes.
- [ ] Listar torneios.
- [ ] Desativar liga problematica.
- [ ] Desativar torneio problematico.
- [ ] Ver pagamentos.
- [ ] Ver reembolsos.
- [ ] Resolver denuncias.
- [ ] Ver auditoria de alteracoes.
- [ ] Dashboard de metricas gerais.
- [ ] Suporte interno.

### 16. Qualidade de Produto

- [ ] Tema visual BR Open.
- [ ] Componentes base com HeroUI Native.
- [ ] Tokens Uniwind.
- [ ] Estados de loading.
- [ ] Estados vazios.
- [ ] Estados de erro.
- [ ] Tratamento de permissao negada.
- [ ] Tratamento de rede indisponivel.
- [ ] Mensagens claras para pagamento pendente/falho.
- [ ] Logs de operacoes criticas.
- [ ] Testes das regras de chaveamento.
- [ ] Testes dos webhooks de pagamento.
- [ ] Testes de permissoes por role.

## Roteiro de Desenvolvimento

Este roteiro nao e um MVP. Ele e a ordem recomendada para construir o produto
completo sem embolar dependencias. Marque cada item quando a feature estiver
funcionando no app e persistindo corretamente no Convex.

### Fase 0 - Fundacao do Repo

Objetivo: deixar a base pronta para construir todas as features.

- [ ] Confirmar scripts Bun da raiz.
- [ ] Confirmar app Expo em `src`.
- [ ] Confirmar backend Convex em `convex`.
- [ ] Confirmar Expo Router.
- [ ] Confirmar Better Auth + `kitcn`.
- [ ] Confirmar `src/lib/convex/auth-client.ts`.
- [ ] Confirmar providers nativos: Better Auth, Convex, HeroUI Native e Uniwind.
- [ ] Remover ou substituir telas demo do starter.
- [ ] Reorganizar `src/app` conforme a estrutura de rotas definida.
- [ ] Criar tema base BR Open com HeroUI Native + Uniwind.
- [ ] Criar estados base: loading, vazio, erro e permissao negada.
- [ ] Criar seed inicial de usuarios, clubes, ligas, torneios e categorias.

Entrega: app abre, usuario consegue autenticar, Convex conecta, tema carrega e
rotas principais existem.

### Fase 1 - Schema Convex e Dominios Base

Objetivo: modelar o produto completo antes de criar telas demais.

- [ ] Criar tabelas de perfis.
- [ ] Criar tabelas de clubes/locais/quadras.
- [ ] Criar tabelas de torneios.
- [ ] Criar tabelas de categorias.
- [ ] Criar tabelas de inscricoes.
- [ ] Criar tabelas de pagamentos.
- [ ] Criar tabelas de chaves.
- [ ] Criar tabelas de partidas.
- [ ] Criar tabelas de agenda.
- [ ] Criar tabelas de notificacoes.
- [ ] Criar tabelas de ranking/historico.
- [ ] Criar tabelas de ligas.
- [ ] Criar tabelas de membros de liga.
- [ ] Criar tabelas de temporadas de liga.
- [ ] Criar tabelas de ranking de liga.
- [ ] Criar ledger/auditoria de pontos de liga.
- [ ] Criar tabelas de patrocinadores.
- [ ] Criar tabelas de auditoria.
- [ ] Criar indices para buscas por cidade, estado, status, organizador, gestor
      de liga, jogador, categoria e datas.

Entrega: schema completo publicado no Convex e pronto para as funcoes de
dominio.

### Fase 2 - Auth, Perfis e Roles

Objetivo: separar jogador, organizador, gestor de liga, clube e admin.

- [ ] Cadastro.
- [ ] Login.
- [ ] Logout.
- [ ] Recuperacao de senha.
- [ ] Verificacao de email.
- [ ] Completar perfil de jogador.
- [ ] Editar perfil de jogador.
- [ ] Criar perfil de organizador.
- [ ] Solicitar/verificar organizador.
- [ ] Criar perfil de gestor de liga.
- [ ] Criar perfil de clube.
- [ ] Aplicar guardas de rota por role.
- [ ] Criar tela de preferencias de notificacao.

Entrega: usuario entra no app, tem perfil completo e acessa apenas as areas
permitidas.

### Fase 3 - Shell do Jogador e Descoberta

Objetivo: construir a experiencia principal do jogador.

- [ ] Tela inicial de descoberta.
- [ ] Lista realtime de torneios publicados.
- [ ] Busca por texto.
- [ ] Filtros por cidade/estado/data/categoria/modalidade.
- [ ] Detalhe publico do torneio.
- [ ] Compartilhar link do torneio.
- [ ] Favoritar torneio.
- [ ] Tela "Meus torneios".
- [ ] Tela de descoberta de ligas.
- [ ] Detalhe publico da liga.
- [ ] Entrada em liga.
- [ ] Calendario do jogador.
- [ ] Tela de notificacoes.
- [ ] Perfil publico do jogador.

Entrega: jogador encontra torneios, entende detalhes e acompanha sua area
pessoal.

### Fase 4 - Clubes, Arenas e Quadras

Objetivo: permitir que torneios tenham locais e infraestrutura real.

- [ ] Criar local.
- [ ] Editar local.
- [ ] Cadastrar endereco e contatos.
- [ ] Cadastrar quadras.
- [ ] Definir tipo de piso.
- [ ] Marcar quadra indisponivel.
- [ ] Pagina publica do clube.
- [ ] Listar torneios do clube.
- [ ] Historico de torneios do clube.

Entrega: organizador consegue usar locais/quadras reais na criacao e agenda do
torneio.

### Fase 5 - Torneios do Organizador

Objetivo: construir o painel de criacao e gestao de torneios.

- [ ] Lista de torneios do organizador.
- [ ] Criar torneio.
- [ ] Editar torneio.
- [ ] Duplicar torneio.
- [ ] Definir local e datas.
- [ ] Definir descricao.
- [ ] Definir regulamento.
- [ ] Definir premiacao.
- [ ] Definir imagem/banner.
- [ ] Definir patrocinadores.
- [ ] Publicar/despublicar.
- [ ] Controlar status do torneio.
- [ ] Dashboard do torneio.
- [ ] Relatorios basicos do torneio.

Entrega: organizador consegue criar e publicar um torneio completo.

### Fase 6 - Categorias e Inscricoes

Objetivo: permitir que jogadores entrem em categorias corretas.

- [ ] Criar categoria.
- [ ] Editar categoria.
- [ ] Ativar/desativar categoria.
- [ ] Configurar nivel, genero, modalidade, vagas, preco e idade.
- [ ] Inscricao simples.
- [ ] Inscricao em multiplas categorias.
- [ ] Inscricao em duplas com convite de parceiro.
- [ ] Lista de espera.
- [ ] Promocao automatica da lista de espera.
- [ ] Cancelamento pelo jogador.
- [ ] Cancelamento/rejeicao pelo organizador.
- [ ] Isencao manual com auditoria.
- [ ] Tela de inscritos por categoria.

Entrega: torneio recebe, organiza e controla inscritos por categoria.

### Fase 7 - Stripe e Checkout

Objetivo: transformar inscricao em pagamento confirmado dentro do app.

- [ ] Instalar `@stripe/stripe-react-native`.
- [ ] Configurar Stripe provider no app.
- [ ] Criar modulo `stripe.ts` no Convex.
- [ ] Criar PaymentIntent ou fluxo equivalente.
- [ ] Pagar com Pix.
- [ ] Pagar com cartao.
- [ ] Configurar Apple Pay.
- [ ] Configurar Google Pay.
- [ ] Criar webhook Stripe.
- [ ] Validar assinatura do webhook.
- [ ] Atualizar `payments`.
- [ ] Atualizar `registrations`.
- [ ] Confirmar inscricao apos pagamento aprovado.
- [ ] Tratar pagamento pendente/falho/expirado.
- [ ] Implementar cupons.
- [ ] Implementar reembolso.
- [ ] Implementar taxa da plataforma.
- [ ] Implementar Stripe Connect/split.
- [ ] Criar relatorios financeiros.

Entrega: jogador paga pelo app e organizador/admin acompanham pagamentos sem
conciliacao manual como fluxo principal.

### Fase 8 - Chaves e Formatos de Disputa

Objetivo: gerar confrontos confiaveis para todos os formatos planejados.

- [ ] Motor de eliminatoria simples.
- [ ] BYE automatico.
- [ ] Sorteio aleatorio.
- [ ] Seed manual.
- [ ] Seed por ranking.
- [ ] Chave de duplas.
- [ ] Todos contra todos.
- [ ] Grupos + mata-mata.
- [ ] Consolacao.
- [ ] Tela publica da chave.
- [ ] Tela do organizador para revisar chave.
- [ ] Bloqueio de alteracao depois que partidas comecarem.
- [ ] Testes das regras de chaveamento.

Entrega: categorias geram chaves e partidas de forma previsivel e testada.

### Fase 9 - Agenda, Quadras e Chamada de Jogo

Objetivo: controlar quando e onde cada partida acontece.

- [ ] Criar slots de horario.
- [ ] Associar partida a horario.
- [ ] Associar partida a quadra.
- [ ] Detectar conflito de jogador.
- [ ] Detectar conflito de quadra.
- [ ] Aplicar descanso minimo entre partidas.
- [ ] Sugerir agenda automaticamente.
- [ ] Alterar horario com auditoria.
- [ ] Notificar jogadores sobre alteracao.
- [ ] Modo chamada de jogo.
- [ ] Pagina ao vivo/telao.

Entrega: torneio tem agenda operavel e jogadores sabem quando entram em quadra.

### Fase 10 - Partidas, Placar e Resultados

Objetivo: fazer o torneio andar ate campeao.

- [ ] Criar partidas a partir da chave.
- [ ] Alterar status da partida.
- [ ] Lancar placar.
- [ ] Validar placar.
- [ ] Definir vencedor.
- [ ] Avancar vencedor na chave.
- [ ] Tratar WO.
- [ ] Tratar partida cancelada.
- [ ] Jogador confirmar placar.
- [ ] Contestacao de resultado.
- [ ] Upload de sumula/foto.
- [ ] Finalizar categoria com campeao e vice.
- [ ] Gravar historico do jogador.

Entrega: uma categoria vai da chave inicial ate campeao com historico completo.

### Fase 11 - Notificacoes e Comunicados

Objetivo: manter jogador e organizador informados.

- [ ] Central de notificacoes.
- [ ] Registrar push token.
- [ ] Notificar inscricao.
- [ ] Notificar pagamento.
- [ ] Notificar chave publicada.
- [ ] Notificar partida agendada.
- [ ] Notificar alteracao de horario.
- [ ] Notificar chamada de jogo.
- [ ] Notificar resultado.
- [ ] Lembrete automatico antes da partida.
- [ ] Comunicados por torneio.
- [ ] Comunicados por categoria.
- [ ] WhatsApp opcional para avisos criticos.

Entrega: principais eventos do torneio geram notificacoes confiaveis.

### Fase 12 - Ranking, Historico e Perfil Publico

Objetivo: criar retencao para jogadores.

- [ ] Historico de torneios.
- [ ] Historico de partidas.
- [ ] Estatisticas de vitorias/derrotas.
- [ ] Pontuacao por fase.
- [ ] Ranking por categoria.
- [ ] Ranking por cidade.
- [ ] Ranking por estado.
- [ ] Ranking nacional.
- [ ] Badges/conquistas.
- [ ] Perfil publico com desempenho.

Entrega: jogador tem motivo para voltar ao app mesmo fora do periodo de
inscricao.

### Fase 13 - Ligas e Comunidade

Objetivo: permitir que usuarios, clubes ou organizadores criem ligas permanentes
com ranking proprio.

- [ ] Criar liga.
- [ ] Editar liga.
- [ ] Definir visibilidade publica/privada/convite.
- [ ] Definir regulamento da liga.
- [ ] Definir categorias aceitas.
- [ ] Definir temporadas.
- [ ] Definir regra de pontuacao.
- [ ] Jogador solicitar entrada.
- [ ] Gestor aprovar/reprovar membro.
- [ ] Ranking publico da liga.
- [ ] Ranking por temporada.
- [ ] Ranking por categoria.
- [ ] Vincular torneios a liga.
- [ ] Gerar pontos a partir de torneios.
- [ ] Gerar pontos a partir de partidas.
- [ ] Ledger/auditoria dos pontos.
- [ ] Comunicados da liga.
- [ ] Pagina publica compartilhavel da liga.

Entrega: BR Open tem ligas permanentes que funcionam como comunidade competitiva
e ranking proprio.

### Fase 14 - Admin, Moderacao e Operacao

Objetivo: permitir que a plataforma seja operada com seguranca.

- [ ] Dashboard administrativo.
- [ ] Gerenciar usuarios.
- [ ] Gerenciar organizadores.
- [ ] Aprovar/reprovar organizadores.
- [ ] Gerenciar clubes.
- [ ] Gerenciar ligas.
- [ ] Moderar torneios.
- [ ] Moderar ligas.
- [ ] Acompanhar pagamentos.
- [ ] Acompanhar reembolsos.
- [ ] Resolver denuncias.
- [ ] Ver auditoria.
- [ ] Ver metricas da plataforma.
- [ ] Suporte interno.

Entrega: BR Open consegue operar usuarios, organizadores, ligas, torneios e
pagamentos.

### Fase 15 - Polimento, Testes e Release

Objetivo: preparar o app para uso real.

- [ ] Revisar UX das jornadas principais.
- [ ] Revisar estados vazios/loading/erro.
- [ ] Testar auth em iOS, Android e web se web estiver ativa.
- [ ] Testar pagamento Pix.
- [ ] Testar pagamento cartao.
- [ ] Testar Apple Pay em development build.
- [ ] Testar Google Pay em development build.
- [ ] Testar webhooks Stripe.
- [ ] Testar chaveamento.
- [ ] Testar agenda e conflito de horarios.
- [ ] Testar permissoes por role.
- [ ] Configurar builds EAS.
- [ ] Preparar assets de loja.
- [ ] Preparar politica de privacidade.
- [ ] Preparar termos de uso.

Entrega: app pronto para piloto com organizadores e clubes reais.

## Ordem Recomendada de Telas

1. Login/cadastro.
2. Completar perfil.
3. Home/descobrir torneios.
4. Detalhe do torneio.
5. Inscricao no torneio.
6. Checkout/pagamento da inscricao.
7. Meus torneios.
8. Proxima partida/calendario.
9. Chave do torneio.
10. Resultados do torneio.
11. Notificacoes.
12. Perfil do jogador.
13. Area do organizador.
14. Criar/editar torneio.
15. Gerenciar categorias.
16. Gerenciar inscritos.
17. Gerenciar pagamentos.
18. Gerar/revisar chave.
19. Gerenciar agenda/quadras.
20. Gerenciar partidas/resultados.
21. Comunicados.
22. Relatorios do torneio.
23. Perfil/pagina do clube.
24. Ranking.
25. Ligas.
26. Detalhe da liga.
27. Ranking da liga.
28. Gestao da liga.
29. Admin.

## Regras de Negocio Importantes

- So torneios publicados aparecem na busca.
- So inscricoes confirmadas entram na geracao da chave.
- Em categorias pagas, a inscricao so deve virar confirmada depois de pagamento
  aprovado ou isencao/manual override.
- Chave nao deve ser alterada livremente depois que a primeira partida comecar.
- Alteracao de horario deve registrar auditoria e notificar jogadores.
- Resultado deve sempre registrar quem alterou.
- Jogador cancelado nao aparece como ativo na categoria.
- Categoria cheia deve bloquear nova inscricao ou mandar para lista de espera.
- Organizador nao deve poder editar placar de torneio finalizado sem permissao
  especial.
- Admin pode desativar torneio se houver abuso ou erro grave.
- Webhook Stripe deve ser idempotente para nao confirmar/cancelar inscricao duas
  vezes.
- Nenhuma chave deve depender de status financeiro manual quando o Stripe
  estiver ativo, exceto casos de isencao registrados em auditoria.
- Liga pode ser publica, privada ou por convite.
- Jogador so aparece no ranking da liga depois de ter membership ativo.
- Pontos de liga devem ser gerados por eventos auditaveis, nao apenas
  sobrescritos no ranking final.
- Recalculo de ranking da liga deve ser idempotente e preservar historico.
- Torneio so deve contar para uma liga se estiver explicitamente vinculado a
  ela.
- Gestor da liga nao deve poder alterar pontos manualmente sem registrar motivo
  em auditoria.

## Validacoes de Produto Durante o Desenvolvimento

Mesmo construindo o produto completo, validar com organizadores e jogadores
durante o desenvolvimento evita criar regras erradas:

- Como eles montam as categorias hoje?
- Quantos inscritos por torneio?
- Cobram por Pix, dinheiro, cartao ou outro meio?
- Quem monta as chaves?
- Quais formatos usam mais: mata-mata, grupos, todos contra todos?
- Qual maior dor: inscricao, pagamento, horario, resultado ou comunicacao?
- Eles pagariam por torneio, por inscricao ou mensalidade?
- Eles ja participam de grupos/ligas informais de tenis?
- Como essas ligas calculam ranking hoje?
- Ranking de liga deveria contar torneios, partidas avulsas ou os dois?
- Liga deveria ser gratuita, paga por inscricao ou mensalidade?

## Monetizacao Possivel

- Taxa por inscricao.
- Plano mensal para organizadores.
- Plano para clubes.
- Destaque de torneio no app.
- Pagina premium do torneio.
- Plano mensal para ligas.
- Taxa por temporada de liga.
- Pagina premium da liga.
- Patrocinadores em torneios.
- Comissao sobre pagamento integrado.

## Checklist Master do Produto Completo

### Fundacao

- [ ] Repo organizado.
- [ ] Expo Router organizado.
- [ ] Convex conectado.
- [ ] Better Auth funcionando.
- [ ] HeroUI Native funcionando.
- [ ] Uniwind funcionando.
- [ ] Tema BR Open definido.
- [ ] Schema Convex completo.
- [ ] Seeds de desenvolvimento.

### Jogador

- [ ] Conta criada.
- [ ] Perfil completo.
- [ ] Busca de torneios.
- [ ] Filtros completos.
- [ ] Favoritos.
- [ ] Busca de ligas.
- [ ] Entrada em liga.
- [ ] Inscricao em torneio.
- [ ] Pagamento de inscricao.
- [ ] Meus torneios.
- [ ] Proxima partida.
- [ ] Chave.
- [ ] Resultados.
- [ ] Historico.
- [ ] Ranking.
- [ ] Ranking de liga.
- [ ] Notificacoes.

### Organizador

- [ ] Perfil de organizador.
- [ ] Criar torneio.
- [ ] Editar torneio.
- [ ] Publicar torneio.
- [ ] Criar categorias.
- [ ] Gerenciar inscritos.
- [ ] Gerenciar pagamentos.
- [ ] Gerar chaves.
- [ ] Gerenciar agenda.
- [ ] Gerenciar quadras.
- [ ] Lancar resultados.
- [ ] Enviar comunicados.
- [ ] Ver relatorios.

### Ligas

- [ ] Criar liga.
- [ ] Editar liga.
- [ ] Definir regulamento.
- [ ] Definir categorias.
- [ ] Definir temporadas.
- [ ] Definir regra de pontuacao.
- [ ] Aprovar membros.
- [ ] Ranking da liga.
- [ ] Ranking por temporada.
- [ ] Ranking por categoria.
- [ ] Vincular torneios.
- [ ] Gerar pontos.
- [ ] Auditar pontos.
- [ ] Comunicados da liga.
- [ ] Pagina publica da liga.

### Clube

- [ ] Perfil de clube.
- [ ] Cadastro de local.
- [ ] Cadastro de quadras.
- [ ] Pagina publica.
- [ ] Torneios ativos.
- [ ] Historico de torneios.

### Pagamentos

- [ ] Stripe instalado.
- [ ] Pix funcionando.
- [ ] Cartao funcionando.
- [ ] Apple Pay funcionando em development build.
- [ ] Google Pay funcionando em development build.
- [ ] Webhook validado.
- [ ] Inscricao confirmada por pagamento.
- [ ] Reembolso.
- [ ] Cupom.
- [ ] Taxa da plataforma.
- [ ] Stripe Connect/split.

### Competicao

- [ ] Eliminatoria simples.
- [ ] BYE.
- [ ] Seed manual.
- [ ] Seed por ranking.
- [ ] Duplas.
- [ ] Grupos + mata-mata.
- [ ] Todos contra todos.
- [ ] Consolacao.
- [ ] Placar.
- [ ] WO.
- [ ] Contestacao.
- [ ] Campeao/vice.

### Plataforma

- [ ] Admin de usuarios.
- [ ] Admin de organizadores.
- [ ] Admin de clubes.
- [ ] Admin de ligas.
- [ ] Admin de torneios.
- [ ] Admin de pagamentos.
- [ ] Moderacao.
- [ ] Auditoria.
- [ ] Dashboard de metricas.
- [ ] Suporte interno.

## Fontes Tecnicas Consultadas

- Expo Router: https://docs.expo.dev/router/introduction/
- Instalacao do Expo Router: https://docs.expo.dev/router/installation/
- Convex React Native Quickstart:
  https://docs.convex.dev/quickstart/react-native
- Convex indexes: https://docs.convex.dev/database/reading-data/indexes/
- Convex scheduled functions:
  https://docs.convex.dev/scheduling/scheduled-functions
- Convex auth: https://docs.convex.dev/auth
- Better Auth: https://better-auth.com/docs
- Better Auth + Convex: https://better-auth.com/docs/integrations/convex
- Convex + Better Auth Expo:
  https://labs.convex.dev/better-auth/framework-guides/expo
- kitcn Docs: https://kitcn.dev/docs
- kitcn Concepts / File Structure: https://kitcn.dev/docs/concepts
- kitcn Server Setup / cRPC: https://kitcn.dev/docs/server/setup
- kitcn Auth Server: https://kitcn.dev/docs/auth/server
- HeroUI Native Pro: https://heroui.pro/docs/native/getting-started
- Stripe React Native no Expo: https://docs.expo.dev/versions/latest/sdk/stripe/
- Stripe Pix: https://docs.stripe.com/payments/pix
- Expo push notifications: https://docs.expo.dev/push-notifications/overview/
