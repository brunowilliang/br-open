# Exclusão de conta — Estado atual

> Verificado em 02-10-2026 contra o código do repo (`convex/` + `src/`).
> **Exclusão de conta (02-10-2026, sem commit):** o fluxo de apagar a conta
> dentro do app está entregue de ponta a ponta — backend no domínio `account`
> (`convex/functions/account/deletion.ts` e `deletionCode.ts`) e tela em Login e
> segurança (`src/components/pages/settings/delete-account/`).

## Visão geral

Apagar a conta é um fluxo **in-app**: o usuário fecha a própria conta sem e-mail
ao suporte e sem página web (requisito da Apple, 5.1.1). A **régua inteira**
nasce no SERVIDOR (`account/deletion:status`) — o app só renderiza. O `confirm`
recheca a mesma régua na hora de apagar, então a tela nunca promete um caminho
que a execução recuse.

São **três classes** de vínculo:

1. **Bloqueios** — impedem a exclusão até o usuário resolver (só do lado
   ORGANIZAÇÃO; o lado jogador nunca bloqueia).
2. **Resoluções automáticas** — a exclusão resolve sozinha no `confirm`
   (inscrições, estornos, PIX aberto, W.O., rascunhos).
3. **Histórico** — não bloqueia e não é apagado: partidas e torneios já jogados
   ficam, com o perfil e a organização anonimizados (abaixo, "Anonimização").

## A régua (1/3) — bloqueios

| `code` | Condição | `summary` (servidor) | CTA no app |
|---|---|---|---|
| `organization_active_tournament` | organização gerida (owner/admin) com torneio em `published`, `drawn` ou `ongoing` (rascunho não conta; torneio `finished`/`cancelled` não conta) | "Você tem N torneio(s) em andamento ou por começar. Encerre ou cancele antes de excluir a conta." | "Ver torneios" — 1 torneio abre a casa dele (`/tournaments/<id>`); 2+ abrem a lista (`/competitions`). Antes de navegar o app troca o ator para a organização dona |
| `organization_money_in_flight` | saque pendente, recuperação de estorno pendente, estorno pendente ou estorno que falhou (soma por organização) | "Sua organização tem dinheiro em processamento (saque ou recolhimento pendente). Resolva antes de excluir a conta." | — (sem tela que resolva) |
| `organization_locked_balance` | saldo de subconta > 0 | "Sua organização ainda tem saldo. Saque o valor antes de excluir a conta." | "Sacar" → `/withdraw` |
| `organization_other_members` | organização com outros membros além do usuário | "Sua organização tem outros membros. Transfira a gestão antes de excluir a conta." | — (sem tela que resolva) |

Só o bloqueio de torneio carrega ids: `tournamentIds` e `organizationIds`,
**alinhados por índice** (`organizationIds[i]` é a organização dona de
`tournamentIds[i]`) — é o que permite o CTA abrir o torneio na visão do
organizador certo. Os demais devolvem listas vazias.

O bloqueio é do lado ORGANIZAÇÃO porque o que trava é dinheiro/gestão/torneio
da organização. O jogador que só tem inscrições, partidas ou histórico **não
tem bloqueio nenhum** — o que ele tem são resoluções.

## A régua (2/3) — resoluções automáticas

| `code` | O que a exclusão resolve | `summary` (servidor) |
|---|---|---|
| `entries_cancelled` | inscrições vivas que saem inteiras: torneio `published`/`drawn` (qualquer inscrição viva) ou `ongoing` sem partida pendente — status `cancelled`, ativos limpos, vaga liberada na chave (quando publicada/sorteada) e estorno do que foi pago | "N inscrição(ões) sem partidas será(ão) cancelada(s) e as vagas liberadas." |
| `entries_refunded` | pagamentos PAID das inscrições canceladas que aceitam estorno (`canRequestRefund`) — o estorno é iniciado | "N pagamento(s) será(ão) estornado(s)." |
| `pix_cancelled` | cobranças PENDING de QUALQUER inscrição viva — canceladas no provedor | "N cobrança(s) PIX aberta(s) será(ão) cancelada(s)." |
| `matches_walkover` | partidas pendentes (não publicadas) de inscrição viva em torneio `ongoing` — decididas por W.O. a favor do adversário | "N partida(s) pendente(s) será(ão) decidida(s) por W.O. e o adversário avança." |
| `drafts_deleted` | rascunhos sem NENHUMA inscrição de organizações geridas — linha do torneio e arquivos apagados | "N rascunho(s) sem inscrições será(ão) apagado(s)." |

A tela mostra cada `summary` numa linha sob "Ao excluir, isto acontece
automaticamente:". Cada frase conta os casos do seu tipo — número e concordância
(singular/plural) montados no servidor.

**Vaga esperando adversário.** Uma inscrição que sai pode estar numa partida que
ainda não tem os dois lados (ela venceu a rodada e a próxima espera o vencedor
do outro jogo): a partida não é decidível na hora, então ela conta como
`entries_cancelled` — e, **quando o segundo lado chega**, o confronto resolve
por W.O. na hora, no mesmo caminho e com os mesmos avisos do W.O. da exclusão. A
vaga nunca fica apontando para a inscrição cancelada.

### A régua (3/3) — o que NÃO bloqueia e NÃO é apagado

- **Partidas já disputadas** ficam com o resultado; quem olha o histórico vê o
  perfil anonimizado ("Jogador removido") no lugar de nome/avatar.
- **Torneios encerrados da organização** continuam existindo — a organização
  fica com o nome "Organizador removido".
- **O perfil vira uma linha anônima** (não é apagado): o histórico mantém a
  marca de que aquele jogador existiu. A CONTA (login) morre de fato.
- **Convites e propostas de dupla** ligados a inscrições que saem são
  cancelados pela resolução 1 — não sobra convite vivo para ninguém.

## Contrato — `account/deletion`

- **Procedures** (`convex/functions/account/deletion.ts`):
  - `status` — `authQuery`, sem input → `{ blockers, canDelete, resolutions }`
    (`accountDeletionStatusSchema`, `convex/domains/account/contract.ts`).
    `canDelete = blockers.length === 0`.
  - `requestCode` — `authMutation`, sem input → `{ sentAt }` (epoch ms) e o
    código segue por e-mail (abaixo).
  - `confirm` — `authMutation`, input `{ code }` (6 dígitos, `trim` +
    `/^\d{6}$/`) → **union de retorno** (abaixo).
  - `execute` — `privateMutation` interna (não é chamada pelo app): recheca a
    régua e roda a cascata; lança `CONFLICT` ("Ainda há pendências para resolver
    antes de excluir a conta.") se algo apareceu no meio. É DEFESA — na tela o
    caminho é o `confirm`.
- **Shape do blocker:** `{ code, count, scope, summary, tournamentIds,
  organizationIds }`; o da resolução: `{ code, count, scope, summary }`. Todo
  `summary` e os ids nascem prontos no servidor (o app não monta frase nem
  decide destino).
- **`confirm` — union `accountDeletionConfirmResultSchema`** (discriminado por
  `status`):

  | `status` | Quando | Payload extra |
  |---|---|---|
  | `invalid_code` | código errado | `attemptsLeft` |
  | `code_expired` | sem linha, envio ainda em voo ou TTL vencido | — |
  | `too_many_attempts` | 5 tentativas estouradas | — |
  | `blocked` | o código estava certo, mas a régua rechecada acusou bloqueio | `blockers` frescos |
  | `deleted` | executou a exclusão | — |

- **Por que union e não CRPCError:** a checagem do código GRAVA a tentativa
  (`attempts + 1`) e mutation que lança perde as próprias escritas — o erro
  esperado precisa viajar no retorno para a tentativa sobreviver.
- **Autorização:** `authQuery`/`authMutation` — o usuário vem da sessão
  (`ctx.userId`), nunca por input; chamada anônima é rejeitada.
- **Leitura compartilhada:** `status` e `execute` usam a MESMA leitura
  (`collectAccountDeletionPlan`, `convex/domains/account/deletion-reads.ts`) — e
  o `execute` recheca e executa a cascata na MESMA transação, então
  bloqueio/resolução nunca divergem entre tela e execução. O `status` roda
  quando o fluxo abre e o "Atualizar" da tela o refaz.

## Código por e-mail (OTP próprio)

O código da exclusão vive em **tabela própria**, fora do plugin de OTP do
Better Auth (a troca de e-mail não é afetada):

- **Tabela `accountDeletionCode`** (`convex/domains/account/tables.ts`): 1 linha
  por usuário (índice único), `codeHash` (sha256 — o código nunca é gravado em
  claro), `attempts`, `expiresAt`, `requestedAt`, `sentAt`, `createdAt`,
  `updatedAt` e `userId` FK `onDelete: "cascade"` (a linha morre com a conta).
- **Constantes** (`convex/domains/account/deletion-code-rules.ts`): 6 dígitos,
  TTL de 10 min, máximo de 5 tentativas, cooldown de reenvio de 60 s.
- **Ciclo:**
  1. `requestCode`: gate de cooldown (dentro dos 60 s →
     `TOO_MANY_REQUESTS` "Aguarde um instante para pedir um novo código.");
     grava/regrava a linha (`attempts` zerado, `codeHash` vazio, novo TTL) e
     agenda o envio.
  2. `send` (action, `convex/functions/account/deletionCode.ts`): lê a linha e
     não faz nada se o hash já saiu (guarda de corrida); gera os 6 dígitos com
     `crypto.getRandomValues`; grava o HASH **antes** de enviar; envia pelo
     Resend. Falha do envio (ou `RESEND_EMAIL_API_KEY` ausente): a linha é
     descartada — o cooldown zera e o usuário pode pedir de novo na hora.
  3. `confirm`: a ordem das recusas importa — hash vazio ou TTL vencido →
     `code_expired` (a linha só é apagada quando havia código de verdade; envio
     em voo NÃO é derrubado); estourado → `too_many_attempts` (linha apagada);
     errado → grava a tentativa e devolve `invalid_code` com `attemptsLeft`;
     certo → régua rechecada → `deleted` ou `blocked`.
- **E-mail** (`convex/domains/account/deletion-email-rules.ts`): assunto
  "Código BR Open para excluir sua conta" e corpo "Use o código {código} para
  excluir sua conta no BR Open." + "Se não foi você, ignore este e-mail. Sua
  conta continua ativa."

## Execução — a cascata do `execute`

Na ordem em que roda:

1. **Inscrições que saem inteiras** → canceladas em lote
   (`internal.tournament.entries.cancelEntriesForAccountRemoval`): status
   `cancelled`, ativos limpos, vaga liberada na chave (publicado/sorteado),
   estorno do pago (`scheduleEntryRefund`) e avisos: gestores pelo evento
   `tournament.entry.cancelled`, parceiro convidado pelo
   `tournament.partner.invite_cancelled` e dupla já aceita pelo
   `tournament.player.removed` (audiência `partner`, "cancelled").
2. **PIX aberto de qualquer inscrição viva** → cancelado
   (`internal.payment.charge.cancelPendingChargesForSource`): inscrição que sai
   não deixa cobrança pagável; um pagamento que chegue depois vira estorno,
   nunca dinheiro parado.
3. **Partidas pendentes** → W.O. via `applyMatchResult` (`walkover: true`,
   vencedor = adversário): o confronto vira resultado oficial, o adversário
   avança, e o aviso genérico de resultado sai pela própria escrita. O MESMO
   caminho decide a vaga de um lado só quando o segundo lado chega: o confronto
   resolve na hora e o aviso de "próximo jogo" não sai (não há jogo a marcar).
4. **Rascunhos sem inscrição** → arquivos (`deleteStorageIds`) e linha do
   torneio apagados.
5. **Perfil do jogador** → arquivo do avatar apagado; linha ANONIMIZADA (nunca
   apagada): `fullName`, `nickname`, `phone`, `avatarStorageId` e `userId` saem
   com **unset** (campo ausente, nunca `null` — `null` colidiria no índice
   único) e `removedAt` marca a saída.
6. **Organizações geridas** → arquivo da logo apagado; a organização vira
   "Organizador removido" (nome trocado, logo unset).
7. **A conta** → linha do `user` apagada (cascata do Better Auth: sessões,
   contas, verificações — e a linha do código de exclusão). O login deixa de
   existir.

### Notificações novas

Dois eventos nasceram com a exclusão (catálogo em
`convex/shared/notifications/protocol.ts`, templates em
`convex/domains/notification/definitions.ts`), ambos **informativos** (sem item
de ação na central):

- **`tournament.player.removed`** — para o adversário ("O adversário da sua
  partida em {torneio} excluiu a conta. A partida foi decidida por W.O. e você
  avança.") e para o parceiro de dupla ("Seu parceiro de dupla excluiu a
  conta..." — com a variação de W.O. ou de inscrição cancelada). Deep-linka o
  confronto; também é ele que avisa o lado que avança quando uma vaga de um lado
  só é decidida na chegada do adversário.
- **`tournament.entry.player_removed`** — para os gestores da organização:
  "Um jogador excluiu a conta e saiu de {torneio}. As vagas e partidas
  pendentes dele já foram resolvidas." Deep-linka o torneio.

## Anonimização ("removido", D1)

- **`playerProfile.userId` deixou de ser obrigatório**: `id("user").unique()
  .references(user, { onDelete: "set null" })` + coluna `removedAt`
  (`convex/domains/player/tables.ts`). Quem sai leva a REFERÊNCIA; a linha do
  perfil fica para o histórico.
- **Leitura:** toda superfície que resolve o nome de um perfil passa o `removed`
  (`Boolean(removedAt)`) para `buildPlayerDisplayName`
  (`convex/domains/player/identity.ts`) → "Jogador removido"
  (`PLAYER_REMOVED_NAME`). Isso vale no perfil (`player/profile`), no dashboard,
  nas pendências, nos acertos, nos avisos de partida, no cache de inscrições e
  no card do torneio (`serializePlayerCard`, que também zera avatar, nickname e
  username). A busca de parceiro ignora perfil removido.
- **Organização:** `ORGANIZER_REMOVED_NAME` = "Organizador removido" — torneios
  e histórico da organização seguem de pé, sem dono visível.
- **Consequência de contrato:** leitura que pareia `playerProfile.userId` com
  `user` precisa tolerar `null` (o removido perdeu a conta; sem `userId` não há
  foto nem `user.name` para buscar). Onde o repo lia o par, foi ajustado.

## Arquivos no storage

`deleteStorageIds` (`convex/shared/media-rules.ts`) apaga, na hora da exclusão:
o **avatar do perfil**, a **logo de cada organização gerida** e o **avatar/capa
dos rascunhos** que serão apagados. É o cumprimento da promessa de remoção dos
dados: o arquivo sai junto com a conta, não só quando o usuário troca de foto.

## Limites declarados

Toda varredura da régua tem cap (`deletion-reads.ts`): membros 100; por
organização 50 torneios (mais recentes), 10 rascunhos inspecionados e 100 linhas
por varredura de dinheiro (saques/recuperações/estornos); por jogador 100
inscrições por lado, 300 partidas e 300 cobranças. Diferente do contrato de
pendências, aqui **não há sinal de saturação**: numa conta muito grande o
número/lista pode ser subestimado silenciosamente.

## UI — Login e segurança

- **Entrada:** item "Login e segurança" do menu de configurações
  (`src/app/(private)/settings/index.tsx`) → rota `/settings/security`
  (`src/app/(private)/settings/security.tsx`), abaixo de "Segurança" e "Contas
  vinculadas". A seção só aparece com e-mail na sessão.
- **Card de entrada:** superfície danger-soft "Apagar conta" — "Remove
  permanentemente a sua conta e tudo o que é seu." — botão "Apagar conta".
- **Passos** (`real.tsx` orquestra, `flow.tsx` desenha):
  1. **Riscos:** lista do que acontece + aviso de irreversibilidade; o botão
     "Apagar conta" fica travado até a rolagem chegar ao fim (chip "Role até o
     fim para continuar", que sai com fade). Botões "Cancelar" / "Apagar
     conta".
  2. **Régua:** `status` roda quando o fluxo abre. `LoadingState` enquanto
     carrega; erro → "Não foi possível verificar seus bloqueios." + "Atualizar";
     liberado → "Isso remove sua conta e tudo o que é seu, permanentemente." +
     "Apagar conta"; bloqueado → "Antes de apagar, resolva isto:" + um cartão
     danger-soft por bloqueio (título do mapa `presentDeletionBlocker`:
     "Torneios em andamento ou por começar", "Saldo na organização", "Dinheiro
     em processamento", "Outras pessoas na gestão") + "Ao excluir, isto acontece
     automaticamente:" + resoluções + "Atualizar" (refaz o status). O CTA do
     bloqueio executa o que ele promete: "Ver torneios" troca o ator para a
     organização dona (`organizationIds[0]`) e navega — sem a troca não navega
     (toast "Modo não alterado"); "Sacar" abre `/withdraw`.
  3. **Código:** abre já pedindo o código; `InputOTP` de 6 dígitos — "Enviamos
     um código de 6 dígitos para {e-mail mascarado}. Digite para confirmar a
     exclusão." — "Reenviar código" com cooldown MM:SS (60 s, espelho do
     servidor, também disparado quando o envio falha) e "Confirmar
     exclusão"/"Confirmando...".
  4. **Resultado:** `deleted` → toast "Conta apagada" / "Sua conta e seus dados
     foram removidos." e logout (a sessão já morreu no servidor); `blocked` →
     volta à régua com os bloqueios rechecados; `invalid_code`/`code_expired`/
     `too_many_attempts` → toast "Falha na confirmação" com a copy do mapa de
     segurança ("Código inválido. Confira os dígitos e tente novamente." +
     "Resta 1 tentativa."/"Restam N tentativas." quando ainda resta alguma).
- **Copy dos riscos** (`flow.tsx`): "Seu perfil e seus dados saem do app e não
  voltam.", "Torneios que você organiza precisam ser concluídos ou passados
  para outra pessoa.", "Valores a recolher de torneios que você organizou
  precisam ser regularizados.", "Inscrições e partidas em andamento são
  encerradas e saem do seu histórico.", "Seu histórico de partidas sai do seu
  perfil. Os adversários mantêm os resultados deles.", "Sua posição nas
  classificações e no ranking some com a conta.", "Convites e propostas de
  duplas pendentes são cancelados.", "Você sai das listas de espera e deixa de
  receber convites e notificações.".
- **Cooldown espelhado:** `src/lib/account/delete-account.ts`
  (`ACCOUNT_DELETION_CODE_COOLDOWN_SECONDS = 60`) — o app conta o tempo por UX;
  quem decide é o servidor.

## Decisões e apontamentos

- **A régua é do SERVIDOR e uma só leitura serve tela e execução.** O app nunca
  deriva bloqueio/resolução nem decide rótulo de resolução — só renderiza os
  `summary` e liga os CTAs pelo `code` do blocker.
- **`confirm` devolve union em vez de lançar** (ver "Contrato"): as escritas da
  tentativa precisam sobreviver ao código errado.
- **Bloqueio é só de organização; jogador nunca bloqueia.** Quem só tem
  inscrição/partida/histórico apaga a conta direto, com as resoluções
  automáticas.
- **`organizationIds` alinhado por índice** com `tournamentIds` (aditivo feito
  para o deep link): o app troca o ator para a organização dona antes de abrir o
  torneio — sem isso, com 2+ organizações o CTA cairia na organização errada.
- **OTP fora do plugin do Better Auth:** tabela própria e ciclo próprio
  (cooldown/limite/TTL) para não acoplar o OTP de e-mail ao fluxo de exclusão.
- **Hash antes do envio, linha descartada na falha:** o cooldown zera quando o
  envio não saiu (inclusive sem chave do Resend), para o usuário não ficar
  esperando um código que nunca chegou. Envio em voo não derruba a linha no
  `code_expired` (senão o action fecharia sem código nenhum).
- **Sem migration:** tabela nova e `userId` que virou opcional são mudanças
  compatíveis — o `migrations/manifest.ts` não ganhou entrada.
- **Índice na coluna filha é obrigatório para a cascata:** a ORM exige índice
  para aplicar `set null` no delete do `user`; o corte adicionou os que faltavam
  (`tournamentEntry.partnerUserId`, `tournamentMatch.scheduledById`,
  `tournamentMatchEdit.editedByUserId`, `tournamentMatchAgreement.proposedByUserId`,
  `tournamentMatchAgreementEvent.actorUserId`,
  `tournamentUnavailability.createdByUserId`) — sem eles a exclusão estoura
  `Foreign key ... requires index`.
- **O que a exclusão NÃO faz:** não apaga partidas, resultados nem torneios já
  disputados — a história fica; o que sai é a identidade (anonimização) e a
  conta.
