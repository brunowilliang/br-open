# Architecture Decision Records (br-open)

Registro permanente das decisões de arquitetura do app — o "porquê" de cada escolha, para qualquer pessoa (ou agente) entender o formato do código sem caçar em conversa. Formato Nygard: Contexto / Decisão / Alternativas consideradas / Consequências.

> Mapa geral de toda a documentação (features, specs, plans, ADRs): [`docs/README.md`](../README.md).

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [0001](0001-pix-woovi.md) | Pagamentos PIX via Woovi/OpenPix | accepted | 2026-07-03 (backfill) |
| [0002](0002-orquestracao-maestri.md) | Orquestração de desenvolvimento via Maestri | accepted | 2026-08-01 |

## Regras

- Decisão de arquitetura vira ADR — aprovado pelo Bruno antes de ser escrito.
- Backfill (decisão passada) registra a data original + nota "backfilled".
- Ciclo de vida: `proposed` → `accepted` → `deprecated` | `superseded by ADR-NNNN`.
- ADR se lê em 2 minutos: contexto curto, alternativas reais, consequências honestas.
- Quem alterar o comportamento descrito num ADR deve atualizá-lo (ou supersedê-lo).
