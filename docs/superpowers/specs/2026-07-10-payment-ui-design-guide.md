# Payment Management UI Design Guide

> Compiled research and recommendations for the BR-Open tennis league app.
> Grounded in patterns from Apple Subscriptions, Google Play, Stripe Dashboard,
> Carbon Design System, Shopify Subscription UX, Brazilian PIX fintech patterns,
> and the existing Woovi split payment architecture.

## Context

The app collects league subscription fees via PIX (Woovi split between organizer
and BR-Open). Two distinct user perspectives need payment UI:

- **Player** — joins a paid league, pays a PIX charge, sees their payment history,
  renews when the cycle expires.
- **Organizer** — connects a Woovi subaccount, sees incoming revenue, checks who
  has paid vs. who's overdue.

Payment statuses in the data model (`paymentCharge.status`):
`pending_payment` → `paid` | `expired` | `failed`

---

## 1. Subscription Management UI Patterns (Player Perspective)

### 1.1 Active Subscriptions List

**What research shows:** Apple Subscriptions, Google Play, and Stripe Customer
Portal all use a **card-per-subscription** layout with the service name as the
primary anchor, the amount + interval as the secondary line, and a status pill
in the card header. The "next billing date" is always visible — never buried
behind a tap.

**Recommendation — "Meus Pagamentos" screen:**

```
┌─────────────────────────────────────┐
│  Liga Sábado Masculino              │  ← ListGroup.ItemTitle
│  R$ 50,00 / mês                     │  ← ListGroup.ItemDescription
│                          [● Ativa]  │  ← Chip color="success"
│  Próximo vencimento: 15 Jul         │  ← secondary line, prominent
└─────────────────────────────────────┘
```

- Use `ListGroup` with `Avatar` prefix (league icon) and `Chip` suffix (status).
- Group by status: **overdue/expiring first**, then active, then history.
- Each item navigates to a detail screen.

**HeroUI mapping:**
```tsx
<ListGroup>
  <PressableFeedback onPress={openDetail}>
    <PressableFeedback.Scale>
      <ListGroup.Item disabled>
        <ListGroup.ItemPrefix>
          <Avatar size="sm"><Avatar.Fallback>SM</Avatar.Fallback></Avatar>
        </ListGroup.ItemPrefix>
        <ListGroup.ItemContent>
          <ListGroup.ItemTitle>Liga Sábado Masculino</ListGroup.ItemTitle>
          <ListGroup.ItemDescription>
            R$ 50,00 / mês • Próximo vencimento: 15 Jul
          </ListGroup.ItemDescription>
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix>
          <Chip color="success" size="sm">
            <Chip.Label>Ativa</Chip.Label>
          </Chip>
        </ListGroup.ItemSuffix>
      </ListGroup.Item>
    </PressableFeedback.Scale>
  </PressableFeedback>
</ListGroup>
```

### 1.2 Per-Subscription Detail with Billing History

**What research shows:** Stripe Customer Portal separates detail into three
sections: (1) current plan summary, (2) next charge info, (3) invoice/payment
history. Shopify's guidelines emphasize showing the selling plan name clearly
and never burying price changes. Apple shows each past charge with date + amount
+ status badge.

**Recommendation — "Detalhe do Pagamento" screen:**

```
┌──────────────────────────────────┐
│  [Header Card]                   │
│  Liga Sábado Masculino           │
│  R$ 50,00 / mês                  │
│  [● Ativa]  • Renova em 15 Jul   │
├──────────────────────────────────┤
│  [Alert: próxima cobrança]       │  ← Alert status="accent"
│  "Sua mensalidade renova em 3    │
│   dias via PIX."                 │
├──────────────────────────────────┤
│  Histórico de pagamentos         │
│  ┌────────────────────────────┐  │
│  │ 15 Jun 2026                │  │
│  │ R$ 50,00        [✓ Pago]   │  │
│  ├────────────────────────────┤  │
│  │ 15 Mai 2026                │  │
│  │ R$ 50,00        [✓ Pago]   │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

- Top section: a `Card` with the league name, price, status `Chip`, and next
  renewal date — this is the "at a glance" answer to "am I paid up?"
- Middle: conditional `Alert` when renewal is within 3 days.
- Bottom: billing history as a `ListGroup` of past charges, each with date,
  amount, and a status `Chip`.
- The most recent payment is expanded or highlighted; older ones collapse.

### 1.3 Cancel / Leave Flow

**What research shows:** Apple and Google both require the cancel flow to be
honest (no dark patterns post-regulatory pressure in 2023-2024). Stripe combined
cancel + refund into one dialog because "subscription cancellations are often
followed immediately by a refund." The Stripe Dashboard now lets you refund from
the same dialog with a single click.

**Recommendation for BR-Open (leaving a paid league = ending the subscription):**

- Present the cancel option as "Sair da liga" (leave league) — don't use
  separate "cancel subscription" and "leave league" concepts.
- Use a `Dialog` or `BottomSheet` with clear options:
  1. Primary destructive: "Sair e cancelar cobranças" (danger button).
  2. Secondary: "Ficar na liga" (ghost button).
- Be honest about what happens: "Você não será mais cobrado. Seu acesso à liga
  termina em [data]."
- **No retention screens / guilt screens.** If the league is free-to-leave, say
  so plainly. Don't add friction steps.
- If the player already paid for the current cycle, communicate that the access
  continues until the cycle end date.

**HeroUI mapping:**
```tsx
<Dialog>
  <Dialog.Trigger>
    <Button variant="ghost" color="danger">Sair da liga</Button>
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Sair da Liga Sábado Masculino?</Dialog.Title>
      <Dialog.Description>
        Você não será mais cobrado. Seu acesso termina em 15 Jul 2026.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="ghost" onPress={close}>Ficar na liga</Button>
      <Button variant="primary" color="danger" onPress={confirmLeave}>
        Sair e cancelar cobranças
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog>
```

### 1.4 Failed Payment States

**What research shows:** Stripe surfaces failed payments with a red `Alert` at
the top of the subscription detail, plus a persistent banner in the list. The
failed invoice row shows a retry CTA. Failed payments are the **highest
attention** status (Carbon Design System: red = high attention = immediate
action required).

**Recommendation:**
- In the subscriptions list, a failed/overdue item gets sorted to the **top**
  with a `Chip color="danger"` and a direct "Tentar novamente" action.
- In the detail screen, show an `Alert status="danger"` at the top:
  ```
  Pagamento falhou
  Não foi possível processar seu último PIX. Gere um novo para manter
  sua inscrição ativa.
  [Gerar novo PIX]
  ```
- Never silently hide a failed payment from the player. If a charge fails,
  the membership stays `pending` — the player must see this prominently.
- Map `failed` and `expired` states to the same urgency tier visually, but use
  different copy (failed = "algo deu errado"; expired = "tempo esgotou").

### 1.5 "Next Billing Date" Prominence

**What research shows:** This is the **#1 most-sought** piece of information in
subscription management apps. Apple puts it in the list item itself. Google Play
puts it in the detail header. Stripe's customer portal shows it next to the
status badge. It is never behind a tap.

**Recommendation:**
- Always show the next billing date (or renewal date) in the subscription list
  item description, not in the detail screen only.
- For BR-Open with manual renewal (Phase 1), this is actually "expira em" rather
  than "próxima cobrança em" — but treat it with the same prominence.
- Format: relative + absolute is best: "Expira em 3 dias (15 Jul)".
- When the date has passed, show a renewal banner instead of the date.

---

## 2. Revenue Dashboard Patterns (Organizer Perspective)

### 2.1 Revenue Summary Cards

**What research shows:** Stripe Dashboard shows aggregate stats on customer
pages: total amount spent, monthly recurring revenue (MRR). The Stripe blog
specifically calls out that these stats "surface the most useful customer
information." Mercado Pago Vendedores leads with a balance card and a
"receber" (receive) summary.

**Recommendation — "Financeiro" section on the organizer's league/organization
view:**

Phase 1 (current spec scope): The organizer dashboard is intentionally minimal
(refunds, payouts, and transaction details live in the Woovi dashboard). But a
lightweight overview card is valuable:

```
┌─────────────────────────────────────┐
│ Receita da liga (este mês)          │
│ R$ 1.250,00                         │  ← Large, prominent
│ 25 jogadores ativos                 │  ← Secondary metric
│ [Ver no painel Woovi →]             │  ← Deep link to Woovi dashboard
└─────────────────────────────────────┘
```

- Use a `Card` with `Card.Header` (label) and `Card.Body` (big number).
- Keep it simple: total collected this cycle + active payer count.
- Link to the full Woovi dashboard for detailed breakdown — don't rebuild it.

Phase 3 (future spec): Full organizer-facing transactions/payouts view with
filterable transaction list, MRR trend chart, and per-league fee override.

**HeroUI mapping:**
```tsx
<Card variant="default">
  <Card.Header>
    <Text className="text-sm text-muted">Receita da liga (este mês)</Text>
  </Card.Header>
  <Card.Body>
    <Card.Title className="text-2xl">R$ 1.250,00</Card.Title>
    <Card.Description>25 jogadores ativos</Card.Description>
  </Card.Body>
  <Card.Footer>
    <LinkButton size="sm" variant="ghost">
      Ver no painel Woovi
    </LinkButton>
  </Card.Footer>
</Card>
```

### 2.2 Player Payment Status (Who's Paid, Who's Overdue)

**What research shows:** Stripe's customer analytics lets merchants "quickly
find and sort customers based on their transaction history." The customer page
shows aggregate stats and payment method status. This is critical for organizers
who need to know who to chase for payment.

**Recommendation — "Jogadores" list with payment status:**

```
┌──────────────────────────────────────┐
│  [JD] João da Silva                  │
│       [● Pago]  15 Jun              │  ← sorted: paid first
│  [MS] Maria Santos                   │
│       [● Pago]  15 Jun              │
│  [PR] Pedro Rocha                    │
│       [⚠ Vencido] Gerar novo PIX   │  ← overdue sorted next
│  [AC] Ana Costa                      │
│       [○ Aguardando]                 │  ← pending payment
└──────────────────────────────────────┘
```

- Sort: overdue/expired first (needs action), then pending_payment, then paid.
- Use `Chip` color coding: `success` = paid, `warning` = pending, `danger` =
  overdue/expired.
- Tap an overdue player to send a reminder notification (via the existing
  notification orchestrator).
- The organizer can generate a new PIX charge on behalf of the player if needed.

### 2.3 Refund Management

**What research shows:** Stripe found that "subscription cancellations are often
followed immediately by a refund" and combined them into one flow. They also
show refund status prominently in the transaction list.

**Recommendation for BR-Open (Phase 1):**
- Refunds are handled manually in the Woovi dashboard (per the spec non-goal).
- The app should still show refund state if/when Woovi sends a webhook. Map
  `refunded` to a distinct `Chip` (neutral/muted color, not green/yellow/red).
- When a player requests a refund, the organizer gets a notification with a link
  to the Woovi dashboard charge.

Phase 3: In-app refund initiation with a confirmation dialog.

---

## 3. Brazilian PIX-Specific UI Patterns

### 3.1 PIX QR Code Display

**What research shows:** Every Brazilian fintech and merchant app follows the
same pattern: a large, centered QR code image with a "Copia e cola" code block
directly below it. The QR code must be large enough to scan from another phone
(minimum ~240px on mobile). The code block has a copy button that copies the
BR Code string to the clipboard.

**The BR-Open checkout already implements this** (per the spec, the checkout
route renders `pixQrCodeUrl` and `pixBrCode`). Key refinements:

- The QR image is an HTTPS URL from Woovi (`qrCodeImage` field), not base64.
  Use `<Image>` directly.
- Center the QR code in a white `Surface` (white background improves scan
  contrast, especially in dark mode).
- Minimum size: `w-64 h-64` (256px) — large enough to scan from a second phone.

```tsx
<Surface className="bg-white rounded-2xl p-6 items-center self-center">
  <Image
    source={{ uri: payment.qrCodeImage }}
    className="w-64 h-64"
    resizeMode="contain"
  />
</Surface>
```

### 3.2 "Copia e Cola" UX

**What research shows:** The "copia e cola" pattern is universal in Brazil.
The code block is always:
- A bordered container with the BR Code partially visible (truncated, mono font).
- A prominent "Copiar código" button (or the entire block is tappable).
- Visual feedback on copy: button changes to "Copiado!" with a checkmark for
  2-3 seconds.

**Recommendation:**
```tsx
<PressableFeedback onPress={copyBrCode}>
  <PressableFeedback.Scale>
    <Surface variant="secondary" className="flex-row items-center justify-between rounded-xl p-4">
      <Text className="font-mono text-sm text-muted" numberOfLines={1}>
        {copied ? "Código copiado!" : truncateBrCode(payment.brCode)}
      </Text>
      <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} />
    </Surface>
  </PressableFeedback.Scale>
</PressableFeedback>
```

- Use a monospace font for the code text.
- Truncate with `numberOfLines={1}` — the full BR Code is unreadable to humans
  anyway; the copy action is what matters.
- Show a `Toast` on successful copy: "Código PIX copiado".
- Provide the copy button as the primary interaction, not just a secondary
  action.

### 3.3 PIX Recorrente / Pix Automático Authorization Flow (Phase 2)

**What research shows (Stripe + EBANX + Recurly docs):**
Pix Automático (launched June 2025) supports recurring payments through
**mandates**. The flow is:
1. Customer authorizes an amount + billing cycle during the initial payment
   (scans QR or provides bank details).
2. The customer's bank sends a **pre-debit notification** 3 days before each
   charge, with the exact amount and an option to cancel.
3. The charge is automatic — no QR scan needed for renewals.
4. The mandate persists until cancelled or expired.

**UX implications for BR-Open Phase 2:**

During checkout, offer two paths:
```
┌─────────────────────────────────────┐
│ Como você quer pagar?               │
│                                     │
│ (●) PIX único                       │
│     Pague a cobrança agora. Você    │
│     precisará gerar um novo PIX a   │
│     cada renovação.                 │
│                                     │
│ ( ) PIX Automático                  │
│     Autorize uma vez e as próximas  │
│     cobranças saem automaticamente. │
│     Seu banco avisa 3 dias antes.   │
└─────────────────────────────────────┘
```

- Use `RadioGroup` for the choice.
- For PIX Automático, show the mandate terms clearly: max amount per cycle,
  billing frequency, how to cancel ("Você pode cancelar a qualquer momento no
  app do seu banco").
- After authorization, the subscription detail shows "PIX Automático ativo"
  with the mandate info, and the renewal flow becomes transparent (no QR code
  needed for subsequent charges).

**Status display for Pix Automático:**
- Active mandate: `Chip color="success"` with "Renovação automática".
- Pre-debit pending (3-day window): `Alert status="accent"` with the exact
  amount and date: "Sua conta será debitada de R$ 50,00 em 12 Jul. Você pode
  cancelar no app do seu banco."
- Mandate cancelled/expired: revert to manual renewal flow.

### 3.4 Status Communication for PIX Charges

**The app's status model maps to PIX states:**

| `paymentCharge.status` | PIX meaning | Display copy (pt-BR) | Chip color |
|---|---|---|---|
| `pending_payment` | Charge created, waiting for PIX payment | "Aguardando pagamento" | `warning` |
| `paid` | PIX received and confirmed via webhook | "Pago" | `success` |
| `expired` | Charge expired (30 min TTL, unpaid) | "Expirado" | `danger` |
| `failed` | Charge creation or capture failed | "Falhou" | `danger` |

**Critical UX rule:** The app must **never** self-report `paid`. Payment
confirmation comes exclusively from the Woovi webhook. The checkout screen
subscribes to the `paymentCharge` live query and transitions when the webhook
flips the status.

---

## 4. Payment Status Design System

### 4.1 Color Coding

Based on Carbon Design System's severity levels and accessibility guidelines
(WCAG 2.2 Use of Color), with HeroUI Native's theme tokens:

| Status | HeroUI token | Hex (light) | Hex (dark) | Use for |
|---|---|---|---|---|
| Paid / Active | `success` | `oklch(0.7329 0.1935 150.81)` | `oklch(0.7329 0.1935 150.81)` | Confirmed payments, active subscriptions |
| Pending / Awaiting | `warning` | `oklch(0.7819 0.1585 72.33)` | `oklch(0.8203 0.1388 76.34)` | Waiting for payment, KYC pending |
| Failed / Overdue / Expired | `danger` | `oklch(0.6532 0.2328 25.74)` | `oklch(0.594 0.1967 24.63)` | Failed charges, expired charges, overdue |
| Informational | `accent` | `oklch(0.6204 0.195 253.83)` | `oklch(0.6204 0.195 253.83)` | Pre-debit notice, general info |
| Neutral / Refunded | `default` | `oklch(94% 0.001 286.375)` | `oklch(27.4% 0.006 286.033)` | Refunded, historical, no action needed |

**Accessibility rule (from Carbon Design System):** Never rely on color alone.
Every status indicator must use **at least two** of: color, icon, text label.
HeroUI's `Chip` with `Chip.Label` satisfies this (color + text). Add icons for
stronger differentiation:

```tsx
// Paid — green + checkmark + text
<Chip color="success" size="sm">
  <Ionicons name="checkmark-circle" size={12} />
  <Chip.Label>Pago</Chip.Label>
</Chip>

// Pending — yellow + clock + text
<Chip color="warning" size="sm">
  <Ionicons name="time-outline" size={12} />
  <Chip.Label>Aguardando</Chip.Label>
</Chip>

// Failed/Expired — red + alert + text
<Chip color="danger" size="sm">
  <Ionicons name="alert-circle" size={12} />
  <Chip.Label>Expirado</Chip.Label>
</Chip>
```

### 4.2 Status Badge / Pill Component

Create a reusable `PaymentStatusChip` component to centralize the mapping:

```tsx
import { Chip } from 'heroui-native';

const STATUS_CONFIG = {
  pending_payment: { color: 'warning', icon: 'time-outline', label: 'Aguardando pagamento' },
  paid: { color: 'success', icon: 'checkmark-circle', label: 'Pago' },
  expired: { color: 'danger', icon: 'alert-circle', label: 'Expirado' },
  failed: { color: 'danger', icon: 'close-circle', label: 'Falhou' },
} as const;

type PaymentStatusChipProps = {
  status: keyof typeof STATUS_CONFIG;
  size?: 'sm' | 'md';
};

export function PaymentStatusChip({ status, size = 'sm' }: PaymentStatusChipProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Chip color={config.color} size={size}>
      <Ionicons name={config.icon} size={12} />
      <Chip.Label>{config.label}</Chip.Label>
    </Chip>
  );
}
```

### 4.3 Progress Indicators for Multi-Step Payment Flows

**What research shows:** Carbon Design System uses progress indicators with
"incomplete" (blue), "in progress" (blue, animated), and "complete"
(green/checkmark) states. For mobile, a vertical step indicator or a horizontal
progress bar works best.

**For the checkout flow (join → charge → pay → confirm):**

```
  ●─────●─────●─────○
  Solicitar  Pagar   Confirmar  Ativo
  cobrança   PIX
```

- Step 1 (complete ✓): Membership requested.
- Step 2 (current): PIX charge generated — show QR.
- Step 3 (pending): Waiting for payment confirmation.
- Step 4 (pending): Membership activated.

Use a simple 3-dot or 4-dot progress indicator. When the webhook confirms
payment, the remaining dots fill instantly. This gives the player visual
confidence that the system is working even though confirmation is async.

### 4.4 Empty States

**What research shows (NN/G, Mobbin, Toptal):** Empty states must: (1) explain
why it's empty, (2) suggest a next step, (3) optionally include a CTA. Never
show a blank screen.

**For "Meus Pagamentos" empty state:**

```
┌─────────────────────────────────────┐
│                                     │
│         [tennis racket icon]        │
│                                     │
│    Nenhum pagamento ainda           │
│    Quando você se inscrever em uma  │
│    liga paga, seus pagamentos       │
│    aparecerão aqui.                 │
│                                     │
│    [Explorar ligas]                 │
│                                     │
└─────────────────────────────────────┘
```

- Use a centered `View` with an icon, title (`Text` bold), description (`Text`
  muted), and a `Button`.
- For the organizer's "Jogadores" empty state: "Nenhum jogador inscrito ainda.
  Compartilhe o link da liga."

### 4.5 Loading States with Skeleton

**What research shows:** Skeleton screens reduce perceived wait time by 30%
versus spinners (NN/G research). They should mimic the content layout.

**For payment lists:**
```tsx
<SkeletonGroup>
  <Skeleton className="h-16 w-full rounded-xl" />
  <Skeleton className="h-16 w-full rounded-xl" />
  <Skeleton className="h-16 w-full rounded-xl" />
</SkeletonGroup>
```

- Use `Skeleton` with `variant="shimmer"` for payment cards.
- Match the height of the actual content (`h-16` for a list item).
- For the checkout screen, skeleton the QR code area while the charge is being
  created.

---

## 5. Information Hierarchy

### 5.1 "Meus Pagamentos" Screen (Player Perspective)

**Priority order (top to bottom):**

1. **Actionable items first** — any expired/failed charges with a "Gerar novo
   PIX" or "Tentar novamente" CTA. These are the highest urgency (red, danger).
2. **Expiring soon** — charges/memberships expiring within 3 days. Medium
   urgency (yellow/accent alert).
3. **Active subscriptions** — currently paid memberships with next renewal date.
   Informational (green chip).
4. **Payment history** — past paid charges. Collapsible, lowest priority.

**Screen structure:**
```
[Conditional: overdue alert banner — Alert status="danger"]
[Conditional: expiring soon banner — Alert status="warning"]

[Section: Minhas inscrições]
  ListGroup of active memberships with status chips

[Section: Histórico]
  ListGroup of past payments, most recent first
```

### 5.2 "Pagamentos" Screen (Organizer Perspective)

**Priority order (top to bottom):**

1. **Woovi account status** — if not connected or pending, this is the blocker.
   Show prominently at the top with an action button.
2. **Revenue summary** — total collected this cycle, active payers count.
3. **Player payment status** — who's paid, who's overdue, who's pending.
4. **Link to Woovi dashboard** — for detailed financial management.

**Screen structure:**
```
[Card: Woovi account status — connects / pending / active]
[Card: Revenue summary — this cycle's total + active payers]
[Section: Status dos jogadores]
  ListGroup of players with payment status chips, sorted by urgency
[LinkButton: Ver painel completo na Woovi]
```

### 5.3 Checkout / Payment Authorization Screen

**Priority order (top to bottom):**

1. **Amount + what it covers** — "R$ 50,00 — Inscrição Liga Sábado Masculino /
   mês". This must be the most prominent text.
2. **QR code** — large, centered, scannable.
3. **Copia e cola** — copyable code block.
4. **Countdown timer** — to `expiresAt` (30 min TTL). Creates urgency.
5. **Instructions** — "Abra o app do seu banco e pague este PIX." Simple, plain
   language. No deep link.
6. **Status feedback** — live query updates. When paid, show success animation
   + navigate back. When expired, show "Gerar novo PIX".

**Screen structure:**
```
[Header: League name + amount — Card.Title, large]

[QR code — centered, white background, w-64 h-64]

[Copia e cola block — PressableFeedback, mono font]

[Countdown — Text, centered, prominent]
  "Expira em 29:45"

[Instructions — Alert status="accent"]
  "Abra o app do seu banco e escaneie o QR code ou cole o código."

[Status indicator — auto-updating via live query]
  Pending: Spinner + "Aguardando pagamento..."
  Paid:    ✓ "Pagamento confirmado!" → auto-navigate
  Expired: Alert status="danger" + "Gerar novo PIX" button
```

**Key UX principle (from Stripe checkout UI research):** Visual hierarchy means
creating an intentional flow of attention so users always know what to do next.
The QR code is the focal point; everything else supports it.

---

## 6. Component Inventory (HeroUI Native → Payment UI)

| Payment UI element | HeroUI Native component | Key props |
|---|---|---|
| Subscription list item | `ListGroup.Item` + `Avatar` + `Chip` | prefix=avatar, suffix=chip |
| Status badge | `Chip` | `color`, `size="sm"`, icon + label |
| Revenue summary card | `Card` + `Card.Header/Body/Footer` | `variant="default"` |
| Failed payment alert | `Alert` | `status="danger"`, action button |
| Expiring soon notice | `Alert` | `status="warning"` |
| Pre-debit notice | `Alert` | `status="accent"` |
| Payment method selector | `RadioGroup` | for PIX único vs. PIX Automático |
| Leave league confirmation | `Dialog` | destructive button variant |
| Copy copia-e-cola | `PressableFeedback` + `Surface` | ripple + scale animation |
| Loading payment list | `Skeleton` / `SkeletonGroup` | `variant="shimmer"` |
| Checkout timer | `Text` (custom countdown hook) | mono font, prominent |
| QR code display | `Image` (from RN) in `Surface` | white bg for contrast |
| Empty state | `View` + `Text` + `Button` | centered, icon, CTA |
| Tabs (My payments / History) | `Tabs` | two-tab split |
| Transaction detail row | `ListGroup.Item` | date + amount + status chip |
| Renewal banner | `Alert` or `Card` | action="Renovar inscrição" |
| Player avatar in lists | `Avatar` | `size="sm"`, image or initials fallback |
| Loading spinner (inline) | `Spinner` | inside Alert for processing state |
| Copy success feedback | `Toast` | "Código PIX copiado" |

---

## 7. Summary of Key Recommendations

1. **Never rely on color alone** — every status uses color + icon + text label
   (WCAG 2.2 compliance).
2. **Next billing date is always visible** — in the list item, not just the
   detail screen.
3. **Sort by urgency** — overdue/expired items appear first in every list.
4. **Webhook is the source of truth** — the UI never self-reports payment
   confirmation; it reacts to the live query.
5. **QR code on white background** — even in dark mode, for scan contrast.
6. **Copia e cola with toast feedback** — copy action + visual confirmation.
7. **No dark patterns in cancel flows** — honest, one-step leave process.
8. **Skeleton screens over spinners** — for perceived performance.
9. **Pix Automático is Phase 2** — design the radio group now, implement the
   mandate flow when Woovi supports it.
10. **Organizer dashboard stays light** — link to Woovi for full financial
    management; don't rebuild their dashboard.

---

## Sources

- Shopify Subscription UX Guidelines (shopify.dev)
- Carbon Design System — Status Indicator Pattern (carbondesignsystem.com)
- Stripe Dashboard blog post — "New Dashboard features to save you time" (stripe.com)
- Stripe Customer Portal docs (docs.stripe.com)
- Stripe Pix Automático docs (docs.stripe.com)
- EBANX — "Pix Automático: the new functionality to power recurring payments"
- PPRO — Pix Automatico payment method overview
- Recurly — Pix Automático documentation
- Adyen — Recurring payments with Pix
- Carbon Design System — Accessibility (WCAG 2.2 Use of Color)
- NN/G — Mobile Checkout Experience, Empty State Interface Design
- Mobbin — Empty State glossary
- Baymard — Checkout Flow UX Optimization
- Stripe — Checkout UI strategies for faster transactions
