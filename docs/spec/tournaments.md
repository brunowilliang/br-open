# Tournaments — Design aprovado

> **Status: NÃO IMPLEMENTADO.** Design aprovado pelo usuário em 22-08-2026
> (brainstorming de escopo fechado; nenhuma linha de código existe ainda).
> Este doc é o contrato do design: a implementação move as seções para
> "implementado" conforme cada slice fecha, no padrão dos demais docs.

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
  (formato de partida da liga reutilizado; default: melhor de 3 sets com
  super tiebreak).
- **`tournamentCategory`** — `tournamentId`, `modality: singles|doubles`,
  `gender: male|female|mixed` (validação: `singles` não aceita `mixed`),
  nome gerado a partir do par (ex.: "Duplas Mistas"), `entryFeeCents`
  opcional (0/undefined = grátis), `maxEntries` opcional.
- **`tournamentEntry`** — `categoryId`, jogadores: 1 (simples) ou
  `playerAId`/`playerBId` (duplas), `createdByUserId` (quem paga),
  `seedRank` opcional (cabeça de chave marcado pelo organizador),
  status `pending_partner|pending_approval|awaiting_payment|active|rejected|cancelled`
  (duplas nascem `pending_partner` até o convite ser aceito; depois seguem
  para `awaiting_payment` ou `pending_approval` conforme a categoria).
  Em `mixed`, valida 1 homem + 1 mulher pelo gênero do perfil dos dois
  jogadores (exige gênero definido nos dois).
- **`tournamentMatch`** — `categoryId`, `round`, `slotInRound`,
  `entryAId`/`entryBId` (nullable = a definir/bye), `winnerEntryId`, placar
  com o schema de score da liga (sets + super tiebreak), agendamento opcional
  (data + horário + quadra, padrão da liga), `walkover` boolean.

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
  Sorteio é aleatório por padrão — o organizador apenas marca/desmarca seeds
  nas inscrições antes de sortear.
- `drawn` (preparação): chave sorteada, inscritos fechados. A chave é
  PRIVADA do organizador — ele ajusta (troca de slots, ver abaixo) na
  janela entre o sorteio e o início (ex.: inscrições até 22, torneio
  dia 25 — ajustes de 22 a 25). Jogadores veem placeholder
  "chave disponível a partir de {startDate}". Sem cron: o organizador
  toca **iniciar** (dia 25) e a chave vira pública.
- **Ajuste manual da chave (pós-sorteio)**: o organizador pode trocar as
  entradas de posição entre DOIS slots da 1ª rodada da categoria (incluindo
  slots de bye) enquanto as partidas afetadas ainda não têm resultado —
  partida com placar/avanço trava. Rodadas seguintes derivam dos
  vencedores, então a troca de slot na 1ª rodada é o único ajuste
  necessário. UI: ação "trocar posição" em duas inscrições da chave (sem
  drag na v1).
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
  chips de categoria; tabs **Chave · Agenda · Inscrições**; access model
  `guest|player|organizer` da liga; store Legend-State por bucket, React
  Query dono do servidor.
- **Chave (bracket)**: scroll horizontal por rodada; card de confronto com
  jogadores/avatares (dupla = 2 avatares), placar, chip de status
  (vocabulário do challenge-card). Organizador toca no confronto → dialog de
  placar (molde `challenge-result-dialog`) ou agenda data/hora/quadra (molde
  `challenge-proposal-dialog`). Disputa de 3º lugar não existe (fora de
  escopo); final destaca campeão.
- **Agenda**: programação por dia/período (molde `schedule.tsx`), confrontos
  de todas as categorias juntos.
- **Inscrição do jogador**: escolhe categoria(s); simples confirma; duplas
  convidam parceiro por username; pagamento via checkout quando a categoria
  tem taxa; join footer no molde da liga.
- **Painel do organizador**: alertas de inscrições pendentes
  (`WidgetAlert`), inscrições com aceitar/recusar (molde `requests.tsx`),
  marcar seeds, fechar inscrições + sortear, lançar placares.

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
- **Sorteio aleatório com seeds opcionais** — organizador marca cabeças de
  chave nas inscrições; byes priorizados para seeds (22-08, usuário).
- **Parceiro por username** — exige habilitar username no app antes do
  convite de dupla (22-08, usuário).
- **Misto exige gênero definido** nos dois perfis (consequência do modelo).
- **Ajuste manual da chave pós-sorteio** — organizador troca entradas entre
  dois slots da 1ª rodada (incluindo byes) enquanto as partidas afetadas
  não têm resultado (22-08, usuário).
- **Estorno automático no cancelamento** — fluxo de reembolso (Woovi)
  nasce no torneio e depois se aplica às ligas (BAC-0002) (22-08, usuário).
- **Mapa de notificações** — 12 eventos `tournament.*` com destinatário por
  evento; notificação é do jogador, pendência do organizador vive no painel
  (22-08, usuário).

## Fora do escopo (v1)

Níveis A/B/C e faixa de idade (cabe depois como campo da categoria) ·
grupos/todos-contra-todos · prazos por rodada · ordenação manual completa do
seeding (drag) · disputa de 3º lugar · W.O. automático por cron · push
nativo · convite por link externo · login por username (campo existe, login
segue por e-mail).

## Próximos passos (slices)

1. **Username no app**: plugin Better Auth (server+client) + migration +
   campo no perfil + checagem de disponibilidade.
2. **Contrato backend**: domínio `tournament/` (tabelas, contrato Zod, regras
   puras de bracket/sorteio/validação), procedures CRPC, `sourceType`
   `tournament_entry` no pagamento + **fluxo de reembolso (refund Woovi) no
   cancelamento**, eventos de notificação (`tournament.*`). Codegen.
3. **Frontend**: wizard de criação, descoberta, cluster de detalhe com
   bracket, inscrições + convite de parceiro, agenda, painel do organizador.
4. Code review → QA do usuário (RUL-0002) → specs consolidadas.
