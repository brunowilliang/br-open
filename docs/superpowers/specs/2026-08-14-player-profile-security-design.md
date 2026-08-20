# Design — Perfil do Jogador: acordeons, Segurança e Contas Vinculadas (IBX-0007)

Aprovado pelo usuário em 14/08/2026 (escopo + design). Fonte do briefing para Backend, Frontend e Code Review.

> **ADENDO (20-08-2026) — trechos superseded no QA round 8:** este doc é histórico, mantido como aprovado em 14/08. A troca de e-mail NÃO saiu como o fluxo duplo aqui descrito (código no e-mail atual, `verifyCurrentEmail: true`, + código no e-mail novo): o implementado é **single-OTP** — `verifyCurrentEmail: false`, código único enviado apenas ao e-mail NOVO, dialog em 2 passos. E "esqueci minha senha" deixou de ser atalho ao fluxo público: virou dialog LOGADO com OTP, sem sair da sessão. Fonte de verdade atual: [`docs/spec/auth.md`](../../spec/auth.md).

## Escopo aprovado

- **Detalhes**: reorganizar apenas — avatar, nome completo, apelido, gênero, telefone (nenhum campo novo).
- **Senha**: trocar senha logado (senha atual + nova) E atalho para o fluxo "esqueci minha senha" já existente (`(public)/forgot-password.tsx`).
- **E-mail**: troca com verificação OTP — código no e-mail ATUAL (prova de posse) + código no e-mail NOVO.
- **Contas vinculadas**: listar + conectar/desconectar Apple e Google; e-mail+senha é linha fixa (não desconecta).

## Não-escopo (YAGNI)

Definir senha para contas só-sociais, excluir conta, 2FA, mudança de freshAge global, novas tabelas/migrations/procedures.

## Fundamentação técnica (validada em node_modules: better-auth@1.6.24, @better-auth/expo@1.6.24, kitcn@0.15.15)

Toda a Segurança/Contas usa API **nativa** do `authClient` (src/lib/convex/auth-client.ts) — zero procedure CRPC nova:

| Função | API | Notas |
|---|---|---|
| Trocar senha | `authClient.changePassword({currentPassword, newPassword, revokeOtherSessions: true})` | Exige senha atual (`INVALID_PASSWORD`); conta só-social → `CREDENTIAL_ACCOUNT_NOT_FOUND`; devolve novo token de sessão quando `revokeOtherSessions` |
| Pedir troca de e-mail | `authClient.emailOtp.requestEmailChange({newEmail, otp})` | `otp` = código do e-mail ATUAL (exigido porque `verifyCurrentEmail: true`). Anti-enumeração: responde success SEM enviar se o novo e-mail já existe |
| Confirmar troca de e-mail | `authClient.emailOtp.changeEmail({newEmail, otp})` | `otp` = código do e-mail NOVO. Erros explícitos: "Email already in use", `OTP_EXPIRED`, `INVALID_OTP`, `TOO_MANY_ATTEMPTS` (3) |
| Listar contas | `authClient.listAccounts()` | Retorna `{providerId, accountId, ...}` sem segredos |
| Desconectar | `authClient.unlinkAccount({providerId})` | Bloqueia última conta (`FAILED_TO_UNLINK_LAST_ACCOUNT`); sessão criada há ≥24h → `SESSION_NOT_FRESH` |
| Conectar Apple | `authClient.linkSocial({provider: "apple", idToken: {token, nonce?}})` | idToken nativo via `expo-apple-authentication` (mesmo fluxo de `useSocialAuth.appleNative`); fallback OAuth web |
| Conectar Google | `authClient.linkSocial({provider: "google", callbackURL})` | OAuth web via proxy do expoClient (`Browser.openAuthSessionAsync`) |

Rate limit do emailOTP: 3 req/60s por endpoint; 3 tentativas de OTP — tratar no reenvio.

## UX da tela

Rota: `src/app/(private)/settings/player/profile.tsx` (existe, form plano). Replicar o padrão da org: `Accordion` heroui-native `selectionMode="single"` `variant="surface"` + helper `ExpandableSection` (ver `src/components/pages/organization/organization-form-fields.tsx`) + `Animated.View layout={AccordionLayoutTransition}` (ver `settings/organization/profile.tsx`).

1. **Detalhes** (default aberto, `defaultValue`): form atual completo (avatar + campos + validações zod existentes). `?firstRun=true` continua funcionando (título "Complete seu perfil" → `router.replace("/")`).
2. **Segurança** (ações, fora do form de detalhes):
   - *Alterar senha* — só aparece se `listAccounts()` contém `providerId === "credential"`; sheet: senha atual + nova + confirmação; validação client igual ao sign-up; sucesso → feedback + limpar campos.
   - *Alterar e-mail* — fluxo em passos: (1) código OTP no e-mail atual; (2) digitar novo e-mail; (3) código OTP no novo e-mail; (4) sucesso → refetch da sessão (e-mail novo visível). Copy neutra no passo de envio (anti-enumeração); "e-mail já em uso" aparece só na confirmação.
   - *Esqueci minha senha* — atalho para o fluxo público existente.
3. **Contas Vinculadas**:
   - E-mail+senha: linha fixa, status, sem botão.
   - Apple / Google: linha com status conectada/não + **Conectar**/**Desconectar** (RUL-0003: Card HeroUI + `PressableFeedback`, `Highlight` último filho; ícones de lib).

### Mapa de erros (UX)

- `INVALID_PASSWORD` → "senha atual incorreta"
- `FAILED_TO_UNLINK_LAST_ACCOUNT` → "essa é sua última forma de login — conecte outra antes de remover"
- `SESSION_NOT_FRESH` (unlink) → re-login guiado: sign-out + navegação ao sign-in com aviso "por segurança, entre novamente para desconectar" (NÃO mexer no freshAge global)
- `LINKING_DIFFERENT_EMAILS_NOT_ALLOWED` (Apple Hide My Email) → "esse Apple ID usa um e-mail privado diferente do e-mail da sua conta; use o Apple ID do mesmo e-mail" (mantemos o bloqueio padrão — decisão de segurança)
- OTP: `OTP_EXPIRED` / `INVALID_OTP` / `TOO_MANY_ATTEMPTS` / cooldown de reenvio (60s)

## Backend (única mudança de servidor — sem migration)

1. `convex/functions/auth.ts`: no plugin `emailOTP`, adicionar `changeEmail: {enabled: true, verifyCurrentEmail: true}`. Sem isso os endpoints respondem 400 "Change email with OTP is disabled".
2. `sendVerificationOTP` (Resend): branch para `type === "change-email"` com assunto pt-BR próprio (ex.: "Código para trocar seu e-mail"), mesmo layout dos existentes.
3. Criar `docs/spec/auth.md` (novo domínio Auth/Conta) documentando o estado final: métodos de login, troca de senha, troca de e-mail OTP, contas vinculadas (link/unlink + proteções), config exigida, edge cases (anti-enumeração, Hide My Email, sessão fresca, rate limits). Registrar no índice do `docs/spec/README.md`.

## Frontend

1. Refatorar `settings/player/profile.tsx` nos 3 acordeons (acima), preservando todo comportamento atual de Detalhes.
2. Componentes novos em `src/components/pages/player/`, kebab-case, sem barrel (padrão do repo).
3. Toda ação de segurança/contas via `authClient` nativo; `useSocialAuth` de `src/lib/convex/auth-client.ts` é referência para Apple nativa.
4. RUL-0003 em tudo que for clicável (Card heroui-native, nunca View simulando card).
5. Testes co-located `*.test.ts` (regras puras: mapa de erros, visibilidade do item senha, estados das contas).
6. Fluxo de troca de e-mail retorna 400 até o Backend ligar a flag (trabalho em paralelo) — não bloquear o resto por isso.

## Entrega e qualidade

- Paralelo: Backend (flag + e-mail + spec) e Frontend (tela). Code Review obrigatório depois (toca segurança). QA: usuário no app (RUL-0002) com checklist do orquestrador.
- Checks: `bun run check` + `bun test` (escopo tocado). **Proibido commit/push/deploy sem aprovação explícita do usuário.**

## Checklist de QA (usuário, no app — RUL-0002)

**Detalhes (não pode regredir nada):**
- [ ] Acordeons abrem/fecham com animação, um aberto por vez; "Detalhes" abre por padrão
- [ ] Avatar: trocar com crop, salvar, recarregar a tela — persiste
- [ ] Nome/apelido obrigatórios, gênero e telefone salvam como antes
- [ ] `?firstRun=true` (onboarding): título "Complete seu perfil" e redirect para `/` após salvar continuam funcionando

**Segurança:**
- [ ] Conta com e-mail+senha: "Alterar senha" aparece; trocar com senha errada mostra erro claro; com senha certa troca e as outras sessões caem (`revokeOtherSessions`) — se logar em outro device, ele cai
- [ ] Conta só-social (Apple/Google sem senha): item de senha NÃO aparece
- [ ] "Alterar e-mail": pede código do e-mail atual → novo e-mail → código do e-mail novo → e-mail da sessão atualiza na tela
- [ ] E-mail novo já cadastrado: confirmação mostra "e-mail já em uso" (o envio do código não denuncia — anti-enumeração)
- [ ] "Esqueci minha senha" leva ao fluxo público existente

**Contas Vinculadas:**
- [ ] Lista mostra e-mail+senha (fixo, sem desconectar) + Apple + Google com status certo
- [ ] Conectar Google: abre OAuth web, volta pro app, status vira conectado
- [ ] Conectar Apple: fluxo nativo, status vira conectado (Apple ID com "Hide My Email" → mensagem explicando o bloqueio de e-mail privado)
- [ ] Desconectar funciona; última conta restante é bloqueada com mensagem
- [ ] Sessão com mais de 24h ao desconectar → re-login guiado (aviso "por segurança, entre novamente")

**E-mails (Resend):**
- [ ] Código "trocar seu e-mail" chega no e-mail NOVO com assunto próprio (não o template de verificação genérico)
