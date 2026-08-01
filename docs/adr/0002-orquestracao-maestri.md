# ADR-0002: Orquestração de desenvolvimento via Maestri

**Date**: 2026-08-01
**Status**: accepted
**Deciders**: Bruno

## Context

O desenvolvimento do app (br-open) passou a ser orquestrado no Maestri (canvas com agentes, notas e portais). Bruno queria um time de agentes (backend, frontend, testador, designer) com revisão independente, documentação permanente de tudo (funcionalidades, escolhas, decisões) e um canal assíncrono de decisões — mantendo o controle final sobre commits e julgamento.

## Decision

Time de 4 roles — Backend Convex, Frontend Expo, UI Designer, QA Revisor — mais Security Reviewer sob demanda, todos com preset Oh My Pi. Modelo de **loop fechado por pedido**: o orquestrador recebe o pedido, esclarece requisitos com o Bruno ANTES de delegar (front-loading), decompõe em tarefas com critérios de aceite verificáveis; devs implementam em paralelo; o QA julga com comandos determinísticos (`bun run check`, `bun test`, `git diff --check`) e teste de UI no iOS via MCP agent-device (simulador/físico) + portal web. **Retry cap = 2** reprovações por entrega, depois o caso sobe para o Bruno. Julgamento final é humano: nada de commit/push sem aprovação explícita. Documentação obrigatória: ADRs (`docs/adr/`), diário de decisões e caixa de entrada no canvas.

## Alternatives Considered

### Alternative 1: Loop aberto (agentes rodando continuamente, sem endpoint)
- **Pros**: manutenção contínua (ex: testes sempre verdes), reação a mudanças
- **Cons**: sem critério de parada → risco de espiral e queima de tokens; o agente vira o juiz do próprio trabalho
- **Why not**: desenvolvimento por pedido tem "done" claro (servo). Loop aberto fica reservado para necessidades futuras reais (ex: manter a suíte verde à noite)

### Alternative 2: Time sem QA (devs se autoavaliam)
- **Pros**: menos terminais, mais velocidade
- **Cons**: juiz = réu; verificação vira "parece certo" (Goodhart: pode enfraquecer teste para passar)
- **Why not**: juiz independente e determinístico é a base do modelo

### Alternative 3: Especificador/PM como papel separado
- **Pros**: spec dedicada e revisada
- **Cons**: redundante com o orquestrador
- **Why not**: o orquestrador já faz plan + critérios de aceite; agente extra = custo sem ganho

## Consequences

### Positive
- Entregas revisadas por juiz independente, com evidência de comandos rodados
- Documentação permanente: ADRs, diário, caixa de entrada (nada se perde em conversa)
- Bruno mantém controle total: aprovação de commits, ADRs e decisões bloqueantes

### Negative
- Custo de terminais/sessões de modelo por agente recrutado
- Latência da revisão humana entre rodadas (trade-off aceito: julgamento fica com o humano)

### Risks
- Sobreposição Frontend × UI Designer nos mesmos arquivos → mitigado por regra de território (pedido funcional → Frontend; visual → Designer; orquestrador define dono por arquivo)
- Loop dev→QA sem fim → mitigado por retry cap 2 + escalada ao Bruno
- Documentação virar burocracia → mitigado: agentes reportam escolhas em 1 bloco; orquestrador consolida; ADRs curtos (2 min de leitura)
