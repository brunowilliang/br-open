# ADR-0001: Pagamentos PIX via Woovi/OpenPix

**Date**: 2026-07-03 (backfilled em 2026-08-01 a partir do git log)
**Status**: accepted
**Deciders**: Bruno

## Context

O app (ligas esportivas amadoras) precisava cobrar inscrições via PIX com split automático: taxa da plataforma (brOpen) + valor do organizador. O primeiro provedor avaliado foi Woovi (cliente HTTP criado em 2026-07-01), mas o checkout inicial foi construído com AbacatePay (2026-07-02). Em 2026-07-03 o projeto pivotou de volta para Woovi com endurecimento ("Onda D hardening") após review findings.

## Decision

Usamos Woovi/OpenPix como provedor de pagamentos PIX: subconta (subaccount) por organização, split automático (`SPLIT_SUB_ACCOUNT`), charge com QR PNG + brCode, e webhooks assinados RSA-SHA256 (header `x-webhook-signature`, chave pública fixa da Woovi). O webhook sempre responde 200 (evita retries da Woovi) e o estado local é reconciliado por cron (charges expiradas viram `EXPIRED`, notificando o jogador a gerar um novo PIX). Idempotência via `correlationID` da Woovi.

## Alternatives Considered

### Alternative 1: AbacatePay
- **Pros**: checkout inicial mais simples de integrar
- **Cons**: menos robusto; review findings exigiram endurecimento (Onda D)
- **Why not**: projeto pivotou de volta para Woovi em 2026-07-03; eventos `transparent.*` foram substituídos por `OPENPIX:*`

### Alternative 2: Woovi/OpenPix (escolha final)
- **Pros**: SDK oficial, eventos `OPENPIX:TRANSACTION_RECEIVED / CHARGE_EXPIRED / CHARGE_COMPLETED / CHARGE_REFUNDED`, split por subconta, idempotência por correlationID
- **Cons**: integração mais trabalhosa — assinatura RSA, schema zod dos payloads, `subAccount` em camelCase na resposta da API (corrigido em 9ae92a7)
- **Why not**: não foi rejeitada — é a decisão vigente

## Consequences

### Positive
- Split automático: organizador recebe direto na subconta dele
- Webhook com verificação de assinatura (segurança) e estado reconciliado por cron (confiabilidade)
- Charge polimórfica (`sourceType`/`sourceId`) — pronta para outros pagáveis (eventos, torneios)

### Negative
- Dependência do provedor (branding Woovi removido da UI — 3fc683b)
- Webhook exige cuidado: schema zod + sempre-200; fluxos manuais (reembolso) reconciliados por webhook

### Risks
- Charge expirada sem webhook → coberto pelo cron `expire-stale-charges` (spam de notificação mitigado pela expiração local)
- Resíduos da era AbacatePay → limpos em 2026-07-06 (`polymorphic paymentCharge` + woovi cleanup)
- Chave PIX errada no onboarding → validação `pixKeyType` + PR review (532fc81)

## Timeline (git log)

- 2026-07-01 — Woovi client (subaccount + split charge), branch `feat/league-payment-woovi`
- 2026-07-02 — Pivot AbacatePay com checkout flow
- 2026-07-03 — Pivot Woovi + Onda D hardening; fixes: webhook zod + sempre-200, subaccount camelCase, branding, debug de subaccount
- 2026-07-06 — `approvalMode` (auto/manual), player payments hub; checkout genérico + `paymentCharge` polimórfica + cleanup Woovi
- 2026-07-11 — Grace period + organizer dashboard + reliability layer
- 2026-07-22/23 — Fee por liga; onboarding coleta chave PIX; hide "Gerar novo Pix" quando não chargeable; botão simulate-payment em dev
- 2026-07-24 — PR review fixes + 7 bugs (UI, pagamentos, onboarding)
