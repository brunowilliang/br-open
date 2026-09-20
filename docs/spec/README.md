# docs/spec — Estado atual do app

Documentação viva do que está **implementado** no br-open: features, decisões
de arquitetura e próximos passos. Cada doc descreve o estado real verificado
no código (`src/`, `convex/`), não intenções de design.

## Por que este diretório existe

O conhecimento do produto é um registro contínuo: **o que está feito, como
funciona e por quê** — o suficiente para um agente novo (ou o humano) entender
o app sem perguntar nada. Estes arquivos são versionados: sobrevivem a troca
de CLI, de máquina e de agente.

## Regras de manutenção

1. **Quem atualiza:** o executor da feature, como parte do critério de pronto
   — quem implementou atualiza o doc do domínio na MESMA entrega, antes de
   reportar. Em feature full-stack, quem fecha (Frontend) consolida o doc. O
   Code Reviewer confere a atualização na revisão; o Orquestrador só fecha o
   card com a spec atualizada.
2. **1 domínio = 1 arquivo.** Feature pequena não ganha doc novo: atualize o
   existente.
3. **Verifique no código antes de escrever** — nunca descreva intenção.
4. **Auto-contido:** estes arquivos não referenciam fontes externas (pasta de
   specs/plans antigas, docs locais não versionados). Estado atual + decisões,
   sem rastro de onde a intenção veio.
5. Referencie arquivos reais (`src/...`, `convex/...`).
6. Anote decisões e divergências (por que assim, e não X).
7. `arquitetura.md` guarda decisões globais; os demais, as do domínio.
8. **Datas de implementação** (formato DD-MM-YYYY) = primeiro commit do
   arquivo principal da feature (`git log --follow`); sem commit (feature em
   andamento), marque "em andamento".

## Índice

| Doc | Cobre |
|-----|-------|
| [arquitetura.md](arquitetura.md) | Stack, estrutura de pastas, backend (kitcn/CRPC), frontend, nomenclatura, gates de verificação |
| [leagues.md](leagues.md) | Liga inteira: criação, edição, quadras, regras, desafios, agenda, ranking, detalhe, overviews, mídia, descoberta |
| [auth.md](auth.md) | Auth/Conta: login (e-mail+senha, Apple, Google), senha, troca de e-mail OTP, contas vinculadas, e-mails Resend |
| [tournaments.md](tournaments.md) | Torneios (implementado — domínio, CRPC e telas): eliminatória direta, categorias modalidade × gênero, duplas com convite por username, chave navegável, inscrições, agenda, checkout |
| [organization.md](organization.md) | Organização, ator ativo (auth de domínio), padronização executada |
| [payments.md](payments.md) | Payments: mensalidade de liga via PIX com split Woovi, checkout, webhook, renovação com carência, dashboard do organizador, hub do jogador, saque (withdraw) |
| [dashboard.md](dashboard.md) | Dashboards por persona: dash pessoal do jogador (próximos jogos, V/D, posição por liga, categorias, parceiro) e séries de receita da organização — contratos de leitura do IBX-0071 |
