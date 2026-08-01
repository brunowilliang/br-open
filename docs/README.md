# Documentação do br-open — índice único

Porta de entrada para **toda** a documentação do projeto. Se uma feature não está aqui, ela não foi documentada (ou você precisa atualizar este índice).

## Como a documentação se organiza

| Tipo | Onde | Responde a |
|---|---|---|
| Specs + Plans de features | `docs/superpowers/` | O QUÊ e o COMO de cada feature |
| ADRs (decisões de arquitetura) | `docs/adr/` | O POR QUÊ o código é assim |
| Diário de decisões + caixa de entrada | notas no canvas Maestri | O que foi decidido/feito e o que está pendente |
| Código | `src/`, `convex/` | A verdade final — se conflitar com a doc, o código vence e a doc deve ser corrigida |

## Features

| Feature | Spec | Plan | ADR |
|---|---|---|---|
| Challenge ladder (modo liga) | — | [2026-05-05](superpowers/plans/2026-05-05-challenge-ladder-league.md) | — |
| League: create | [spec](superpowers/specs/2026-05-09-league-create-slice-design.md) | [plan](superpowers/plans/2026-05-09-league-create-slice.md) | — |
| League: edit | [spec](superpowers/specs/2026-05-09-league-edit-slice-design.md) | [plan](superpowers/plans/2026-05-09-league-edit-slice.md) | — |
| League: courts (quadras) | [spec](superpowers/specs/2026-05-20-league-courts-design.md) | [plan](superpowers/plans/2026-05-20-league-courts.md) | — |
| League: challenges (desafios) | [spec](superpowers/specs/2026-05-21-league-challenges-design.md) | [plan](superpowers/plans/2026-05-21-league-challenges.md) | — |
| League editor: organização | — | [plan](superpowers/plans/2026-05-24-league-editor-organization.md) | — |
| League: media upload | [spec](superpowers/specs/2026-05-25-league-media-upload-design.md) | [plan](superpowers/plans/2026-05-25-league-media-upload.md) | — |
| Active actor: refactor organização | [spec](superpowers/specs/2026-06-01-active-actor-architecture-design.md) | [plan](superpowers/plans/2026-06-01-active-actor-organization-refactor.md) | — |
| League details: route/store refactor | [spec](superpowers/specs/2026-06-08-league-details-route-store-refactor-design.md) | [plan](superpowers/plans/2026-06-08-league-details-route-store-refactor.md) | — |
| League: toggleable rules | [spec](superpowers/specs/2026-06-23-league-toggleable-rules-design.md) | [plan](superpowers/plans/2026-06-23-league-toggleable-rules.md) | — |
| Admin: overview cards | [spec](superpowers/specs/2026-06-26-admin-overview-cards-design.md) | [plan](superpowers/plans/2026-06-26-admin-overview-cards.md) | — |
| League: schedule/agenda | [spec](superpowers/specs/2026-06-26-league-schedule-agenda-design.md) | [plan](superpowers/plans/2026-06-26-league-schedule-agenda.md) | — |
| Player profile: upload cleanup | [spec](superpowers/specs/2026-06-26-player-profile-upload-cleanup-design.md) | [plan](superpowers/plans/2026-06-26-player-profile-upload-cleanup.md) | — |
| Organization profile | [spec](superpowers/specs/2026-06-28-organization-profile-design.md) | [plan](superpowers/plans/2026-06-28-organization-profile.md) | — |
| Pagamentos: Woovi split (PIX) | [spec](superpowers/specs/2026-06-28-league-payment-woovi-split-design.md) | [plan](superpowers/plans/2026-06-29-league-payment-woovi-split.md) | [0001](adr/0001-pix-woovi.md) |
| Woovi POC: resultados | [spec](superpowers/specs/2026-07-02-woovi-poc-results.md) | — | [0001](adr/0001-pix-woovi.md) |
| Payment system v2 | [spec](superpowers/specs/2026-07-10-payment-system-v2-design.md) | [plan](superpowers/plans/2026-07-10-payment-system-v2.md) | [0001](adr/0001-pix-woovi.md) |
| Payment UI design guide | [spec](superpowers/specs/2026-07-10-payment-ui-design-guide.md) | — | — |
| Standardization plan | — | [plan](superpowers/plans/2026-07-11-standardization-plan.md) | — |

## Decisões de arquitetura (ADRs)

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [0001](adr/0001-pix-woovi.md) | Pagamentos PIX via Woovi/OpenPix | accepted | 2026-07-03 (backfill) |
| [0002](adr/0002-orquestracao-maestri.md) | Orquestração de desenvolvimento via Maestri | accepted | 2026-08-01 |

## Regras

- Feature nova → spec + plan em `docs/superpowers/<data>-<feature>.md`, ADR se houver decisão de arquitetura, e linha nesta tabela.
- O Orquestrador atualiza este índice a cada pedido concluído (documentação obrigatória do fluxo).
- Backfill (decisão/feature antiga) registra a data original + nota "backfilled".
- Limpeza: arquivos duplicados (" 2") — ver caixa de entrada no canvas.
