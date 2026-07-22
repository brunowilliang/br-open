# League Payment — Woovi Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect a real league subscription fee from players, split automatically between the organizer and BR-Open at payment time via Woovi, and gate the membership on webhook-confirmed payment.

**Architecture:** A new `payment` domain mirrors the existing `league`/`organization` domain layout (`tables.ts` + `contract.ts` + `relations.ts` + `tests/`). A server-side Woovi client (`fetch` to `https://api.woovi.com/`) creates the subaccount and the split charges. A `publicRoute` webhook verifies an HMAC signature, resolves the charge idempotently by `wooviChargeId`, and promotes the `pending` membership to `active`. The notification orchestrator is generalized so a payment confirmation can fire a push the same way league events do.

**Tech Stack:** Convex + kitcn (CRPC + ORM), Hono for HTTP, zod for contracts, `bun:test` for unit tests, Woovi Subaccount + Split + Webhook APIs.

**Spec:** `docs/superpowers/specs/2026-06-28-league-payment-woovi-split-design.md`

---

## File Structure

**New files — `convex/domains/payment/` (the domain layer):**
- `convex/domains/payment/tables.ts` — `organizationWooviAccount` + `leaguePayment` tables.
- `convex/domains/payment/contract.ts` — zod schemas, enums, split math helper, `correlationId` builder.
- `convex/domains/payment/relations.ts` — relations into `organization`, `league`, `leagueMembership`, `playerProfile`.
- `convex/domains/payment/tests/contract.test.ts` — contract + split-math + correlationId tests.
- `convex/domains/payment/tests/webhook-signature.test.ts` — HMAC verify tests.

**New files — `convex/functions/payment/` (the functions layer):**
- `convex/functions/payment/woovi-client.ts` — typed `fetch` wrappers (`createSubaccount`, `createChargeWithSplit`, `getCharge`) and the webhook signature verifier.
- `convex/functions/payment/onboarding.ts` — `payment.onboarding.start` mutation.
- `convex/functions/payment/charge.ts` — `payment.charge.createForMembership` mutation.
- `convex/functions/payment/webhook.ts` — `publicRoute` HTTP handler.
- `convex/functions/payment/identity.ts` — serializers (output parsers) for `organizationWooviAccount` + `leaguePayment`.

**Modified files:**
- `convex/lib/get-env.ts` — add `WOOVI_*` env vars.
- `convex/functions/schema.ts` — register the payment domain (composition-only).
- `convex/functions/http.ts` — register the webhook route (codegen marker).
- `convex/shared/notifications/protocol.ts` — add payment event types.
- `convex/domains/notification/definitions.ts` — add payment templates.
- `convex/functions/notification/orchestrator.ts` — generalize `createForRecipients` to accept an optional `paymentId` (decouple from `leagueId`).
- `convex/functions/league/membership.ts` — `requestJoin` creates a `pending` membership for paid leagues without auto-approving; expose a `payment.confirmed`-driven activation path.

**New files — frontend:**
- `src/app/(private)/leagues/[id]/checkout.tsx` — PIX checkout screen.
- `src/lib/payments/payment-store.ts` — TanStack store for the checkout screen state.

**Modified files — frontend:**
- `src/components/pages/leagues/league-join-footer.tsx` — branch into checkout for paid leagues.
- `src/app/(private)/settings/organization/profile.tsx` — add the "Pagamentos" card.

---

## Task 1: Payment domain contract + split math (TDD, pure)

**Files:**
- Create: `convex/domains/payment/contract.ts`
- Create: `convex/domains/payment/tests/contract.test.ts`

- [ ] **Step 1: Write the failing test for split math**

Create `convex/domains/payment/tests/contract.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  computeSplit,
  buildPaymentCorrelationId,
  LeaguePaymentStatusOptions,
} from "../contract";

describe("payment contract", () => {
  describe("computeSplit", () => {
    it("splits the amount by the platform fee percent, rounding to cents", () => {
      expect(computeSplit({ amountCents: 5000, platformFeePercent: 10 })).toEqual({
        brOpenCents: 500,
        organizerCents: 4500,
      });
    });

    it("floors the platform cut to avoid overcharging the organizer", () => {
      // 33% of 1001 = 330.33 -> 330, organizer gets 671
      expect(computeSplit({ amountCents: 1001, platformFeePercent: 33 })).toEqual({
        brOpenCents: 330,
        organizerCents: 671,
      });
    });

    it("assigns the whole amount to the organizer when the fee is 0%", () => {
      expect(computeSplit({ amountCents: 5000, platformFeePercent: 0 })).toEqual({
        brOpenCents: 0,
        organizerCents: 5000,
      });
    });

    it("throws on a negative amount or percent", () => {
      expect(() => computeSplit({ amountCents: -1, platformFeePercent: 10 })).toThrow();
      expect(() => computeSplit({ amountCents: 100, platformFeePercent: -1 })).toThrow();
    });
  });

  describe("buildPaymentCorrelationId", () => {
    it("is deterministic for a membership + cycle anchor", () => {
      expect(
        buildPaymentCorrelationId({
          leagueMembershipId: "mem-1",
          cycleAnchor: "2026-07-01",
        }),
      ).toBe("mem:mem-1:2026-07-01");
    });
  });

  describe("LeaguePaymentStatusOptions", () => {
    it("lists the four lifecycle states", () => {
      expect(LeaguePaymentStatusOptions).toEqual([
        "pending_payment",
        "paid",
        "expired",
        "failed",
      ]);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test convex/domains/payment/tests/contract.test.ts`
Expected: FAIL with "Cannot find module '../contract'".

- [ ] **Step 3: Implement the contract**

Create `convex/domains/payment/contract.ts`:

```ts
import { z } from "zod";

export const LeaguePaymentStatusOptions = [
  "pending_payment",
  "paid",
  "expired",
  "failed",
] as const;
export type LeaguePaymentStatus = (typeof LeaguePaymentStatusOptions)[number];

export const OrganizationWooviAccountStatusOptions = [
  "pending",
  "active",
  "rejected",
] as const;
export type OrganizationWooviAccountStatus =
  (typeof OrganizationWooviAccountStatusOptions)[number];

export const WOOVI_SUBACCOUNT_STATUS_ENUM = z.enum(
  OrganizationWooviAccountStatusOptions,
);
export const WOOVI_PAYMENT_STATUS_ENUM = z.enum(LeaguePaymentStatusOptions);

const BILLING_INTERVALS = ["week", "month", "quarter", "year"] as const;
export const BillingIntervalSchema = z.enum(BILLING_INTERVALS);
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const splitConfigSchema = z.object({
  recipient: z.string().min(1),
  percent: z.number().min(0).max(100),
  brOpenCents: z.number().int().min(0),
  organizerCents: z.number().int().min(0),
});
export type SplitConfig = z.infer<typeof splitConfigSchema>;

/**
 * Splits a charge amount between BR-Open (platform fee) and the organizer.
 * The platform cut is floored to the cent so the organizer is never
 * overcharged by rounding; the organizer gets the remainder.
 */
export function computeSplit(args: {
  amountCents: number;
  platformFeePercent: number;
}): { brOpenCents: number; organizerCents: number } {
  if (args.amountCents < 0 || args.platformFeePercent < 0) {
    throw new Error("amount and percent must be non-negative");
  }
  if (args.platformFeePercent > 100) {
    throw new Error("percent must be at most 100");
  }
  const brOpenCents = Math.floor(
    (args.amountCents * args.platformFeePercent) / 100,
  );
  return {
    brOpenCents,
    organizerCents: args.amountCents - brOpenCents,
  };
}

/**
 * Deterministic correlationID for a membership + billing cycle so retries
 * are idempotent at the Woovi layer (same correlationID = same charge).
 */
export function buildPaymentCorrelationId(args: {
  leagueMembershipId: string;
  cycleAnchor: string;
}): string {
  return `mem:${args.leagueMembershipId}:${args.cycleAnchor}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test convex/domains/payment/tests/contract.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/domains/payment/contract.ts convex/domains/payment/tests/contract.test.ts
git commit -m "feat(payment): add contract with split math and correlationId helper"
```

---

## Task 2: Payment domain tables

**Files:**
- Create: `convex/domains/payment/tables.ts`

- [ ] **Step 1: Create the tables file**

Create `convex/domains/payment/tables.ts`. Follow the pattern from
`convex/domains/league/tables.ts` (`convexTable`, `id().references()`, index
array as 3rd arg). Import auth tables for the `organization` FK.

```ts
import { convexTable, id, index, integer, json, text, timestamp } from "kitcn/orm";
import * as authTables from "../auth/tables";
import type { SplitConfig } from "./contract";

export const organizationWooviAccount = convexTable(
  "organizationWooviAccount",
  {
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    wooviAccountId: text().notNull(),
    wooviWalletId: text(),
    status: text().notNull(),
    onboardedAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (t) => [index("by_organization").on(t.organizationId)],
);

export const leaguePayment = convexTable(
  "leaguePayment",
  {
    leagueId: id("league")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    leagueMembershipId: id("leagueMembership")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    organizationId: id("organization")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    playerProfileId: id("playerProfile")
      .notNull()
      .references(() => authTables.organization.id, { onDelete: "cascade" }),
    wooviChargeId: text().notNull(),
    correlationId: text().notNull(),
    amountCents: integer().notNull(),
    billingInterval: text().notNull(),
    splitConfig: json<SplitConfig>().notNull(),
    pixBrCode: text(),
    pixQrCodeUrl: text(),
    status: text().notNull(),
    paidAt: timestamp(),
    expiresAt: timestamp(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (t) => [
    index("by_membership_status").on(t.leagueMembershipId, t.status),
    index("by_player_status").on(t.playerProfileId, t.status),
    index("by_charge").on(t.wooviChargeId),
  ],
);
```

> **Note on the FK targets:** the `.references(() => authTables.organization.id)`
> shown above is a placeholder shape. The real FKs must point at the
> *owning* table for each entity: `league`, `leagueMembership`, `organization`,
> `playerProfile` are exported by their respective `tables.ts` files (not all
> under `authTables`). Fix each `.references(...)` to import from the correct
> domain: `league` from `../league/tables`, `playerProfile` from
> `../player/tables`, and `organization` from `../auth/tables`. Mirror exactly
> how `convex/domains/league/tables.ts` references `organization` and how
> `leagueMembership` references `league`/`playerProfile`.

- [ ] **Step 2: Fix the FK references**

Open `convex/domains/league/tables.ts` and read how `leagueMembership`
references `league` and `playerProfile` (it imports both tables directly, not
via `authTables`). Apply the same import pattern to
`convex/domains/payment/tables.ts`:

```ts
import * as authTables from "../auth/tables";
import * as leagueTables from "../league/tables";
import * as playerTables from "../player/tables";
```

And set:
- `leagueId` → `.references(() => leagueTables.league.id, { onDelete: "cascade" })`
- `leagueMembershipId` → `.references(() => leagueTables.leagueMembership.id, { onDelete: "cascade" })`
- `organizationId` → `.references(() => authTables.organization.id, { onDelete: "cascade" })`
- `playerProfileId` → `.references(() => playerTables.playerProfile.id, { onDelete: "cascade" })`

- [ ] **Step 3: Commit**

```bash
git add convex/domains/payment/tables.ts
git commit -m "feat(payment): add organizationWooviAccount and leaguePayment tables"
```

---

## Task 3: Payment domain relations + schema registration

**Files:**
- Create: `convex/domains/payment/relations.ts`
- Modify: `convex/functions/schema.ts`

- [ ] **Step 1: Write the relations file**

Create `convex/domains/payment/relations.ts`. Follow the signature pattern from
`convex/domains/league/relations.ts` (`defineXxxRelations(r: RelationsBuilder<typeof tables>)`).

```ts
import type { RelationsBuilder } from "kitcn/orm";
import { tables } from "../../functions/schema";

export const definePaymentRelations = (
  r: RelationsBuilder<typeof tables>,
) => ({
  organization: {
    wooviAccount: r.one(organizationWooviAccount, {
      from: r.organization.id,
      to: r.organizationWooviAccount.organizationId,
    }),
  },
  organizationWooviAccount: {
    organization: r.one(organization, {
      from: r.organizationWooviAccount.organizationId,
      to: r.organization.id,
    }),
  },
  leaguePayment: {
    league: r.one(league, { from: r.leaguePayment.leagueId, to: r.league.id }),
    membership: r.one(leagueMembership, {
      from: r.leaguePayment.leagueMembershipId,
      to: r.leagueMembership.id,
    }),
    organization: r.one(organization, {
      from: r.leaguePayment.organizationId,
      to: r.organization.id,
    }),
    playerProfile: r.one(playerProfile, {
      from: r.leaguePayment.playerProfileId,
      to: r.playerProfile.id,
    }),
  },
});
```

> Import `organizationWooviAccount`, `leaguePayment`, `organization`,
> `league`, `leagueMembership`, `playerProfile` from `tables` (the
> composition export) rather than re-declaring. Inspect
> `convex/domains/league/relations.ts` for the exact import style the repo
> uses (some access via `tables.X`, others via direct import) and match it.

- [ ] **Step 2: Register the domain in the schema**

Modify `convex/functions/schema.ts` (composition-only, mirror how
`league`/`organization` are added):

```ts
import { definePaymentRelations } from "../domains/payment/relations";
import * as paymentTables from "../domains/payment/tables";

// In `tables`:
export const tables = {
  ...authTables,
  ...leagueTables,
  ...notificationTables,
  ...playerTables,
  ...paymentTables, // <- add
};

// In `.relations(...)`:
export default defineSchema(tables).relations((r) => ({
  ...defineAuthRelations(r),
  ...defineLeagueRelations(r),
  ...defineNotificationRelations(r),
  ...definePlayerRelations(r),
  ...definePaymentRelations(r), // <- add
}));
```

- [ ] **Step 3: Regenerate codegen and typecheck**

Run:
```bash
bun run codegen
bun run typecheck
```
Expected: typecheck PASS. Codegen picks up the new tables.

- [ ] **Step 4: Commit**

```bash
git add convex/domains/payment/relations.ts convex/functions/schema.ts convex/functions/_generated/
git commit -m "feat(payment): register payment domain tables and relations"
```

---

## Task 4: Woovi env vars

**Files:**
- Modify: `convex/lib/get-env.ts`

- [ ] **Step 1: Add the env vars**

Modify `convex/lib/get-env.ts`. In `envSchema` (a `z.object`), add:

```ts
WOOVI_APP_ID: z.string().optional(),
WOOVI_APP_TOKEN: z.string().optional(),
WOOVI_WEBHOOK_SECRET: z.string().optional(),
WOOVI_PLATFORM_FEE_PERCENT: z.string().default("10"),
```

In the `readOptionalRuntimeEnv` array (server-only secrets read at runtime),
add:

```ts
"WOOVI_APP_ID",
"WOOVI_APP_TOKEN",
"WOOVI_WEBHOOK_SECRET",
```

`WOOVI_PLATFORM_FEE_PERCENT` has a `.default(...)` so it is inlined and does
not go in `readOptionalRuntimeEnv`.

- [ ] **Step 2: Add the values to `convex/.env` (local, gitignored)**

Ask the user for their real Woovi credentials and add:
```
WOOVI_APP_ID=<their app id>
WOOVI_APP_TOKEN=<their app token>
WOOVI_WEBHOOK_SECRET=<generated secret>
WOOVI_PLATFORM_FEE_PERCENT=10
```

- [ ] **Step 3: Commit**

```bash
git add convex/lib/get-env.ts
git commit -m "feat(payment): add WOOVI env vars for client, webhook, and fee"
```

---

## Task 5: Woovi client — signature verification (TDD)

**Files:**
- Create: `convex/domains/payment/tests/webhook-signature.test.ts`
- Create: `convex/functions/payment/woovi-client.ts` (signature part only)

- [ ] **Step 1: Write the failing test**

Create `convex/domains/payment/tests/webhook-signature.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyWooviWebhookSignature } from "../../functions/payment/woovi-client";

const SECRET = "test-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("verifyWooviWebhookSignature", () => {
  it("accepts a valid HMAC signature over the raw body", () => {
    const body = JSON.stringify({ event: "OPENPIX:CHARGE_COMPLETED" });
    expect(verifyWooviWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a signature computed over a different body", () => {
    expect(
      verifyWooviWebhookSignature(
        JSON.stringify({ event: "tampered" }),
        sign(JSON.stringify({ original: true })),
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects an empty or malformed signature", () => {
    expect(verifyWooviWebhookSignature("{}", "", SECRET)).toBe(false);
  });

  it("returns false (never throws) on any error", () => {
    expect(() =>
      verifyWooviWebhookSignature("{}", "not-hex!!", SECRET),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test convex/domains/payment/tests/webhook-signature.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the signature verifier**

Create `convex/functions/payment/woovi-client.ts` (signature part first; the
HTTP client is added in Task 6):

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies an inbound Woovi webhook signature. Woovi signs the raw request
 * body with HMAC-SHA256 using the shared webhook secret and sends the hex
 * digest in the signature header. Returns false (never throws) so the caller
 * can map any failure to a 401.
 */
export function verifyWooviWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

> **Verify the exact header name.** The repo has no prior webhook to copy.
> Confirm against Woovi's webhook docs that the header is `x-webhook-signature`
> (hex HMAC-SHA256 of the raw body). If Woovi uses a different scheme
> (e.g. base64, or a different header name), adjust both this function's
> signature-name assumptions in the webhook handler (Task 9) and the test.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test convex/domains/payment/tests/webhook-signature.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/domains/payment/tests/webhook-signature.test.ts convex/functions/payment/woovi-client.ts
git commit -m "feat(payment): add Woovi webhook signature verifier"
```

---

## Task 6: Woovi client — HTTP calls

**Files:**
- Modify: `convex/functions/payment/woovi-client.ts`

- [ ] **Step 1: Add the typed HTTP wrappers**

Append to `convex/functions/payment/woovi-client.ts`. Auth is HTTP Basic with
`WOOVI_APP_ID:WOOVI_APP_TOKEN`. Base URL is `https://api.woovi.com`. Read
secrets from `getEnv()`.

```ts
import { getEnv } from "../lib/get-env";

const WOOVI_BASE_URL = "https://api.woovi.com";

function wooviAuthHeader(): string {
  const { WOOVI_APP_ID, WOOVI_APP_TOKEN } = getEnv();
  if (!WOOVI_APP_ID || !WOOVI_APP_TOKEN) {
    throw new Error("WOOVI_APP_ID and WOOVI_APP_TOKEN must be configured");
  }
  const token = `${WOOVI_APP_ID}:${WOOVI_APP_TOKEN}`;
  return `Basic ${Buffer.from(token).toString("base64")}`;
}

export type WooviSubaccount = {
  accountId: string;
  walletId: string;
};

export type WooviCharge = {
  chargeId: string;
  status: string; // "ACTIVE" | "COMPLETED" | "EXPIRED"
  brCode: string;
  pixQrCodeUrl: string;
  value: number;
};

/**
 * Creates a Woovi subaccount for an organization. Woovi runs KYC
 * asynchronously; the returned account is `pending` until the
 * ACCOUNT_REGISTER_APPROVED webhook fires.
 */
export async function createSubaccount(args: {
  name: string;
  email: string;
  phone: string;
  taxId?: string;
}): Promise<WooviSubaccount> {
  const res = await fetch(`${WOOVI_BASE_URL}/api/v1/subaccount`, {
    method: "POST",
    headers: {
      Authorization: wooviAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: args.name,
      email: args.email,
      phone: args.phone,
      taxId: args.taxId,
    }),
  });
  if (!res.ok) {
    throw new Error(`Woovi createSubaccount failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  // Confirm field names against the live response; Woovi nests under "subAccount".
  return {
    accountId: json.subAccount?.id ?? json.id,
    walletId: json.subAccount?.walletId ?? json.walletId ?? json.subAccount?.id,
  };
}

/**
 * Creates a PIX charge split between the organization (subaccount) and
 * BR-Open (platform fee). `expiresIn` is in seconds.
 */
export async function createChargeWithSplit(args: {
  correlationId: string;
  amountCents: number;
  comment: string;
  recipientWalletId: string;
  brOpenPercent: number;
  expiresInSeconds: number;
}): Promise<WooviCharge> {
  const res = await fetch(`${WOOVI_BASE_URL}/api/v1/charge`, {
    method: "POST",
    headers: {
      Authorization: wooviAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      correlationID: args.correlationId,
      value: args.amountCents,
      comment: args.comment,
      expiresIn: args.expiresInSeconds,
      additionalInformation: [
        {
          key: "Dedicado a",
          value: args.comment,
        },
      ],
      splits: [
        {
          recipient: { walletId: args.recipientWalletId },
          value: Math.round(
            (args.amountCents * (100 - args.brOpenPercent)) / 100,
          ),
          // organizer gets (100 - brOpenPercent); BR-Open keeps the rest of the charge
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Woovi createCharge failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const charge = json.charge ?? json;
  return {
    chargeId: charge.correlationID,
    status: charge.status,
    brCode: charge.brCode,
    pixQrCodeUrl: charge.paymentLinkUrl,
    value: charge.value,
  };
}
```

> **Confirm the split payload shape.** Woovi's split API accepts either a fixed
> `value` per recipient or a percentage. The shape above sends an explicit
> `value` (cents) to the organizer's `walletId` and lets BR-Open keep the
> remainder as the charge owner. Cross-check with
> https://developers.woovi.com/en/docs/charge/how-to-create-charge-with-split-to-subbaccount-using-api
> before running against the sandbox, and adjust the `splits` array if the
> field is `percentage` instead of `value`.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS (no runtime calls yet, just wiring).

- [ ] **Step 3: Commit**

```bash
git add convex/functions/payment/woovi-client.ts
git commit -m "feat(payment): add Woovi HTTP client (subaccount + split charge)"
```

---

## Task 7: Payment identity serializers

**Files:**
- Create: `convex/functions/payment/identity.ts`

- [ ] **Step 1: Write the serializers**

Create `convex/functions/payment/identity.ts`. Follow the
`serializeOrganization` pattern from
`convex/domains/organization/identity.ts`: parse the DB row through a zod
output schema, omit secrets. The wallet id is not secret but the `taxId` (if
stored) is — do not expose it.

```ts
import { z } from "zod";

export const wooviAccountOutputSchema = z.object({
  organizationId: z.string(),
  status: z.enum(["pending", "active", "rejected"]),
  onboardedAt: z.string().nullable(),
});

export type WooviAccountOutput = z.infer<typeof wooviAccountOutputSchema>;

export function serializeWooviAccount(
  row: {
    organizationId: string;
    status: string;
    onboardedAt: number | null;
  } | null,
): WooviAccountOutput | null {
  if (!row) return null;
  return wooviAccountOutputSchema.parse({
    organizationId: row.organizationId,
    status: row.status as WooviAccountOutput["status"],
    onboardedAt: row.onboardedAt ? new Date(row.onboardedAt).toISOString() : null,
  });
}

export const leaguePaymentOutputSchema = z.object({
  id: z.string(),
  status: z.enum(["pending_payment", "paid", "expired", "failed"]),
  amountCents: z.number(),
  billingInterval: z.string(),
  pixBrCode: z.string().nullable(),
  pixQrCodeUrl: z.string().nullable(),
  expiresAt: z.string().nullable(),
  paidAt: z.string().nullable(),
});

export type LeaguePaymentOutput = z.infer<typeof leaguePaymentOutputSchema>;

export function serializeLeaguePayment(
  row: {
    id: string;
    status: string;
    amountCents: number;
    billingInterval: string;
    pixBrCode: string | null;
    pixQrCodeUrl: string | null;
    expiresAt: number | null;
    paidAt: number | null;
  },
): LeaguePaymentOutput {
  return leaguePaymentOutputSchema.parse({
    id: row.id,
    status: row.status as LeaguePaymentOutput["status"],
    amountCents: row.amountCents,
    billingInterval: row.billingInterval,
    pixBrCode: row.pixBrCode,
    pixQrCodeUrl: row.pixQrCodeUrl,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/functions/payment/identity.ts
git commit -m "feat(payment): add output serializers for woovi account and payment"
```

---

## Task 8: Notification event types + templates for payment

**Files:**
- Modify: `convex/shared/notifications/protocol.ts`
- Modify: `convex/domains/notification/definitions.ts`
- Modify: `convex/functions/notification/orchestrator.ts`

- [ ] **Step 1: Add payment event types**

Modify `convex/shared/notifications/protocol.ts`. Extend the
`NOTIFICATION_EVENT_TYPES` array with:

```ts
"payment.confirmed",
"payment.expired",
```

Add the derived `NotificationEventType` already picks these up automatically
since it is `(typeof NOTIFICATION_EVENT_TYPES)[number]`.

- [ ] **Step 2: Add templates**

Modify `convex/domains/notification/definitions.ts`. Add entries to the
`definitions` map (mirror the structure of an existing league entry):

```ts
"payment.confirmed": {
  template: (input) => ({
    title: "Pagamento confirmado",
    body: `Sua inscrição foi confirmada. Você já pode participar da liga.`,
  }),
},
"payment.expired": {
  template: (input) => ({
    title: "Pagamento expirado",
    body: `O PIX da sua inscrição expirou. Gere um novo para continuar.`,
  }),
},
```

- [ ] **Step 3: Generalize the orchestrator input**

Modify `convex/functions/notification/orchestrator.ts`. The
`createForRecipientsSchema` currently requires `leagueId`. Decouple so payment
events can fire without a league context:

- Change `leagueId: z.string().min(1)` to `leagueId: z.string().optional()`.
- Change `paymentId: z.string().optional()` if not present, add it to the
  schema.
- In the actor-resolution branch that keys off `eventType === "league.membership.requested"`,
  add the payment events to a separate branch that resolves the recipient as
  the player (the payment notification always goes to the player who paid).
  Mirror the existing `getPlayerProfileUserId` resolution.

If the orchestrator's branching is too coupled to generalize safely, instead
create a sibling private mutation `createForPaymentRecipients` in the same
file that reuses `buildNotificationContent` + the delivery insert logic but
skips the league/org actor resolution.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS. Fix any narrowing errors from making `leagueId` optional.

- [ ] **Step 5: Commit**

```bash
git add convex/shared/notifications/protocol.ts convex/domains/notification/definitions.ts convex/functions/notification/orchestrator.ts
git commit -m "feat(notification): add payment.confirmed and payment.expired events"
```

---

## Task 9: Onboarding mutation — connect Woovi subaccount

**Files:**
- Create: `convex/functions/payment/onboarding.ts`

- [ ] **Step 1: Write the mutation**

Create `convex/functions/payment/onboarding.ts`. Follow the
`organization.profile.upsert` pattern: `authMutation`, guard with
`requireActiveManager`, read the active organization, validate it has the
contact fields the subaccount needs, call the Woovi client, insert the row.

```ts
import { eq } from "kitcn/orm";
import { CRPCError } from "../../lib/crpc";
import { authMutation } from "../../lib/crpc";
import { organizationMetadataSchema } from "../organization/contract";
import { organization } from "../../domains/auth/tables";
import { organizationWooviAccount } from "../../domains/payment/tables";
import { serializeWooviAccount } from "./identity";
import { createSubaccount } from "./woovi-client";
import { requireActiveManager } from "../viewer/context";
import { z } from "zod";

const startOnboardingInput = z.object({
  taxId: z.string().optional(),
});

export const start = authMutation
  .input(startOnboardingInput)
  .mutation(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);
    const now = new Date();

    // Idempotent: if a row already exists, return it.
    const existing = await ctx.orm.query.organizationWooviAccount.findFirst({
      where: { organizationId },
    });
    if (existing) {
      return serializeWooviAccount(existing);
    }

    const org = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });
    if (!org) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Organização não encontrada." });
    }
    const metadata = organizationMetadataSchema.parse(org.metadata ?? {});
    if (!metadata.contactEmail || !metadata.phone) {
      throw new CRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Complete o perfil da organização com e-mail e telefone antes de conectar o pagamento.",
      });
    }

    const sub = await createSubaccount({
      name: org.name,
      email: metadata.contactEmail,
      phone: metadata.phone,
      taxId: input.taxId,
    }).catch((err) => {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Falha ao criar conta na Woovi: ${err.message}`,
      });
    });

    const [row] = await ctx.orm
      .insert(organizationWooviAccount)
      .values({
        organizationId,
        wooviAccountId: sub.accountId,
        wooviWalletId: sub.walletId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return serializeWooviAccount(row);
  });
```

> The `.meta({ auth: "required" })` is implied by `authMutation`. Confirm the
> exact `requireActiveManager` import path from
> `convex/functions/viewer/context.ts` (used in `organization/profile.ts`).

- [ ] **Step 2: Codegen + typecheck**

Run:
```bash
bun run codegen
bun run typecheck
```
Expected: PASS. `api.payment.onboarding.start` is now generated.

- [ ] **Step 3: Commit**

```bash
git add convex/functions/payment/onboarding.ts convex/functions/_generated/
git commit -m "feat(payment): add onboarding.start mutation to connect Woovi subaccount"
```

---

## Task 10: Charge mutation — create PIX charge with split

**Files:**
- Create: `convex/functions/payment/charge.ts`

- [ ] **Step 1: Write the mutation**

Create `convex/functions/payment/charge.ts`. The caller is the player actor.
Server-side: verify the membership belongs to the caller and is `pending`,
the league is paid, the org has an `active` subaccount, no valid
`pending_payment` charge already exists. Then call the Woovi client and insert
the row.

```ts
import { and, eq, gt } from "kitcn/orm";
import { z } from "zod";
import { CRPCError, authMutation } from "../../lib/crpc";
import { league, leagueMembership } from "../../domains/league/tables";
import { organizationWooviAccount, leaguePayment } from "../../domains/payment/tables";
import { computeSplit, buildPaymentCorrelationId } from "../../domains/payment/contract";
import { serializeLeaguePayment } from "./identity";
import { createChargeWithSplit } from "./woovi-client";
import { requireActivePlayerProfile } from "../viewer/context";
import { getEnv } from "../../lib/get-env";

const CHARGE_TTL_SECONDS = 30 * 60; // 30 minutes

const createForMembershipInput = z.object({
  leagueMembershipId: z.string().min(1),
});

export const createForMembership = authMutation
  .input(createForMembershipInput)
  .mutation(async ({ ctx, input }) => {
    const playerProfileId = await requireActivePlayerProfile(ctx);

    const membership = await ctx.orm.query.leagueMembership.findFirst({
      where: { id: input.leagueMembershipId },
    });
    if (!membership) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Inscrição não encontrada." });
    }
    if (membership.playerProfileId !== playerProfileId) {
      throw new CRPCError({ code: "FORBIDDEN", message: "Inscrição não pertence ao jogador." });
    }
    if (membership.status !== "pending") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Inscrição não está aguardando pagamento.",
      });
    }

    const currentLeague = await ctx.orm.query.league.findFirst({
      where: { id: membership.leagueId },
    });
    if (!currentLeague || !currentLeague.monthlyPriceCents || currentLeague.monthlyPriceCents <= 0) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Esta liga é gratuita." });
    }

    const account = await ctx.orm.query.organizationWooviAccount.findFirst({
      where: { organizationId: currentLeague.organizationId },
    });
    if (!account || account.status !== "active" || !account.wooviWalletId) {
      throw new CRPCError({
        code: "PRECONDITION_FAILED",
        message: "Esta liga ainda não está recebendo pagamentos.",
      });
    }

    // Reuse a still-valid pending charge instead of creating a duplicate.
    const now = new Date();
    const existingCharge = await ctx.orm.query.leaguePayment.findFirst({
      where: {
        leagueMembershipId: membership.id,
        status: "pending_payment",
        expiresAt: gt(leaguePayment.expiresAt, now),
      },
    });
    if (existingCharge) {
      return serializeLeaguePayment(existingCharge);
    }

    const cycleAnchor = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const correlationId = buildPaymentCorrelationId({
      leagueMembershipId: membership.id,
      cycleAnchor,
    });

    const platformFeePercent = Number(getEnv().WOOVI_PLATFORM_FEE_PERCENT ?? "10");
    const split = computeSplit({
      amountCents: currentLeague.monthlyPriceCents,
      platformFeePercent,
    });

    const wooviCharge = await createChargeWithSplit({
      correlationId,
      amountCents: currentLeague.monthlyPriceCents,
      comment: `Inscrição — ${currentLeague.name}`,
      recipientWalletId: account.wooviWalletId,
      brOpenPercent: platformFeePercent,
      expiresInSeconds: CHARGE_TTL_SECONDS,
    }).catch((err) => {
      throw new CRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Falha ao gerar cobrança: ${err.message}`,
      });
    });

    const [row] = await ctx.orm
      .insert(leaguePayment)
      .values({
        leagueId: membership.leagueId,
        leagueMembershipId: membership.id,
        organizationId: currentLeague.organizationId,
        playerProfileId,
        wooviChargeId: wooviCharge.chargeId,
        correlationId,
        amountCents: currentLeague.monthlyPriceCents,
        billingInterval: currentLeague.priceBillingInterval ?? "month",
        splitConfig: {
          recipient: account.wooviWalletId,
          percent: platformFeePercent,
          brOpenCents: split.brOpenCents,
          organizerCents: split.organizerCents,
        },
        pixBrCode: wooviCharge.brCode,
        pixQrCodeUrl: wooviCharge.pixQrCodeUrl,
        status: "pending_payment",
        expiresAt: new Date(now.getTime() + CHARGE_TTL_SECONDS * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return serializeLeaguePayment(row);
  });
```

> Confirm the ORM comparator import. The repo uses `eq` from `kitcn/orm`; a
> `gt` (greater-than) comparator must exist or be imported from the same
> package. If `kitcn/orm` does not export `gt`, filter in-memory after a query
> by `leagueMembershipId + status` instead.

- [ ] **Step 2: Codegen + typecheck**

Run:
```bash
bun run codegen
bun run typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/functions/payment/charge.ts convex/functions/_generated/
git commit -m "feat(payment): add charge.createForMembership with Woovi split"
```

---

## Task 11: Webhook handler

**Files:**
- Create: `convex/functions/payment/webhook.ts`
- Modify: `convex/functions/http.ts`

- [ ] **Step 1: Write the webhook handler**

Create `convex/functions/payment/webhook.ts`. This is the first `publicRoute`
in the repo; follow the kitcn route pattern (`.post(path).mutation(...)`).
Read the raw body, verify the signature, parse the event, resolve the charge
idempotently, and on `OPENPIX:CHARGE_COMPLETED` flip the payment to `paid`
and promote the membership to `active`.

```ts
import { eq } from "kitcn/orm";
import { publicRoute } from "../../lib/crpc";
import { getEnv } from "../../lib/get-env";
import { leaguePayment } from "../../domains/payment/tables";
import { leagueMembership } from "../../domains/league/tables";
import { verifyWooviWebhookSignature } from "./woovi-client";
import {
  resolveApprovedMembershipRankingPosition,
} from "../../domains/league/membership-rules";

type WooviEvent = {
  event: string; // "OPENPIX:CHARGE_COMPLETED" | "OPENPIX:CHARGE_EXPIRED"
  charge?: {
    correlationID: string;
    status: string;
  };
};

export const wooviWebhook = publicRoute
  .post("/api/webhooks/woovi")
  .mutation(async ({ ctx, input }) => {
    const raw = typeof input === "string" ? input : JSON.stringify(input ?? {});
    const secret = getEnv().WOOVI_WEBHOOK_SECRET;
    // The signature header name is confirmed in Task 5; read from request headers.
    // kitcn publicRoute exposes headers via ctx.request.headers.
    const signature = ctx.request.headers.get("x-webhook-signature") ?? "";

    if (!verifyWooviWebhookSignature(raw, signature, secret ?? "")) {
      return new Response("invalid signature", { status: 401 });
    }

    const payload = JSON.parse(raw) as WooviEvent;
    const correlationId = payload.charge?.correlationID;
    if (!correlationId) {
      return new Response("ok", { status: 200 }); // not ours
    }

    const payment = await ctx.orm.query.leaguePayment.findFirst({
      where: { correlationId },
    });
    if (!payment) {
      return new Response("ok", { status: 200 }); // unknown charge, ignore
    }

    if (payment.status === "paid") {
      return new Response("ok", { status: 200 }); // idempotent
    }

    const now = new Date();

    if (payload.event === "OPENPIX:CHARGE_COMPLETED") {
      await ctx.orm
        .update(leaguePayment)
        .set({ status: "paid", paidAt: now, updatedAt: now })
        .where(eq(leaguePayment.id, payment.id));

      // Promote the membership to active using the existing ranking rule.
      const membership = await ctx.orm.query.leagueMembership.findFirst({
        where: { id: payment.leagueMembershipId },
      });
      if (membership && membership.status === "pending") {
        const rankingPosition = resolveApprovedMembershipRankingPosition({
          currentRankingPosition: membership.rankingPosition,
          highestRankingPosition: await getHighestRankingPosition(ctx, membership.leagueId),
        });
        await ctx.orm
          .update(leagueMembership)
          .set({ status: "active", rankingPosition, updatedAt: now })
          .where(eq(leagueMembership.id, membership.id));
      }

      // Fire payment.confirmed notification (added in Task 8).
      await ctx.scheduler.runAfter(0, internal.notification.orchestrator.createForRecipients, {
        eventType: "payment.confirmed",
        actorUserId: membership ? await getPlayerProfileUserId(ctx, membership.playerProfileId) : "",
        recipientUserIds: membership ? [await getPlayerProfileUserId(ctx, membership.playerProfileId)] : [],
        paymentId: payment.id,
      });

      return new Response("ok", { status: 200 });
    }

    if (payload.event === "OPENPIX:CHARGE_EXPIRED") {
      await ctx.orm
        .update(leaguePayment)
        .set({ status: "expired", updatedAt: now })
        .where(eq(leaguePayment.id, payment.id));
      return new Response("ok", { status: 200 });
    }

    return new Response("ok", { status: 200 }); // unhandled event, ack so Woovi doesn't retry
  });
```

> **Resolve these helpers before running:**
> - `getHighestRankingPosition(ctx, leagueId)` and `getPlayerProfileUserId(ctx, playerProfileId)`:
>   these already exist as internal helpers in
>   `convex/functions/league/membership.ts` (used by `approve`). Either export
>   them or replicate the one-line query. Do not duplicate logic.
> - `internal.notification.orchestrator.createForRecipients`: import the
>   generated internal reference from `convex/functions/_generated/api`.
> - `ctx.request` and `ctx.scheduler`: confirm the kitcn `publicRoute` ctx
>   shape. If headers are on a different object (e.g. `ctx.req`), adjust.

- [ ] **Step 2: Register the route in http.ts**

Modify `convex/functions/http.ts`. The kitcn codegen fills the
`// __KITCN_HTTP_ROUTES__` marker. Run codegen so the route is wired, then
verify the generated block references `wooviWebhook`:

```bash
bun run codegen
```

- [ ] **Step 3: Codegen + typecheck**

Run:
```bash
bun run codegen
bun run typecheck
```
Expected: PASS. Fix any ctx/header shape issues.

- [ ] **Step 4: Commit**

```bash
git add convex/functions/payment/webhook.ts convex/functions/http.ts convex/functions/_generated/
git commit -m "feat(payment): add Woovi webhook with HMAC verification and idempotent activation"
```

---

## Task 12: Wire `requestJoin` for paid leagues

**Files:**
- Modify: `convex/functions/league/membership.ts`

- [ ] **Step 1: Read the current `requestJoin`**

Read `convex/functions/league/membership.ts:328-435`. Today it creates the
membership in `pending` and (for the approval flow) the organizer later
approves. For a paid league, the membership must stay `pending` and NOT be
auto-approved; the payment webhook is what promotes it.

- [ ] **Step 2: Ensure paid-league memberships stay pending**

The current code already creates `status: "pending"`, so no change is needed
to the insert itself. Verify that the approval path (`approve` at `:491`) is
the only path that moves a membership to `active`, and that there is no
auto-approve for public leagues. If public leagues auto-approve on join,
add a guard: when `currentLeague.monthlyPriceCents > 0`, the membership must
stay `pending` regardless of visibility. Keep free leagues' behavior
unchanged.

```ts
// Inside requestJoin, after building the membership record, before any auto-activate logic:
const isPaidLeague = (currentLeague.monthlyPriceCents ?? 0) > 0;
if (isPaidLeague) {
  // Paid leagues never auto-activate; the payment webhook promotes to active.
  // Ensure the created/updated membership status is "pending".
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Run existing league tests**

Run: `bun test convex/domains/league`
Expected: all green (no behavior change for free leagues).

- [ ] **Step 5: Commit**

```bash
git add convex/functions/league/membership.ts
git commit -m "feat(league): keep paid-league memberships pending until webhook confirms"
```

---

## Task 13: Frontend — checkout screen + store

**Files:**
- Create: `src/lib/payments/payment-store.ts`
- Create: `src/app/(private)/leagues/[id]/checkout.tsx`

- [ ] **Step 1: Write the store**

Create `src/lib/payments/payment-store.ts`. TanStack-style store mirroring an
existing store in `src/lib/leagues/`. It manages: creating the charge,
holding the current payment row, polling the live query, and exposing a
"regenerate" action.

```ts
import { createContext, useContext } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@convex/api";

export type CheckoutState = {
  status: "loading" | "pending_payment" | "paid" | "expired" | "failed";
  pixBrCode: string | null;
  pixQrCodeUrl: string | null;
  expiresAt: string | null;
};

export function useCheckout(leagueMembershipId: string) {
  const createCharge = useMutation(
    api.payment.charge.createForMembership.useMutation(),
  );
  // Live query the payment row by membership id; see how src/lib/leagues does it.
  return { createCharge };
}
```

> Mirror the exact TanStack Query + Convex hook wiring used in
> `src/lib/leagues/league-form-store.ts` (read it first). The Convex hook
> shape (`api.payment.charge.createForMembership.useMutation()`) is generated
> by codegen; confirm after `bun run codegen`.

- [ ] **Step 2: Write the checkout screen**

Create `src/app/(private)/leagues/[id]/checkout.tsx`. On mount, call
`createCharge`. Render the QR image, the copia-e-cola block with a copy
button, the countdown to `expiresAt`, and a plain informational line. On
`paid`, navigate back to the league. On `expired`, show "Gerar novo PIX".

Follow the component patterns in `src/components/pages/leagues/` (HeroUI
Native components, uniwind classes). Do not deep-link to a bank; the payment
is completed in the player's own bank.

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Card, Button } from "@heroui/..."; // match existing imports
import { useCheckout } from "@/lib/payments/payment-store";
import { formatLeaguePriceParts } from "@/lib/leagues/presentation";

export default function CheckoutScreen() {
  const { id, membershipId } = useLocalSearchParams<{ id: string; membershipId: string }>();
  const router = useRouter();
  const checkout = useCheckout(membershipId);
  // ... state, effects, render
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/payments/ src/app/(private)/leagues/[id]/checkout.tsx
git commit -m "feat(payment): add PIX checkout screen and store"
```

---

## Task 14: Frontend — join footer branch + organizer card

**Files:**
- Modify: `src/components/pages/leagues/league-join-footer.tsx`
- Modify: `src/app/(private)/settings/organization/profile.tsx`

- [ ] **Step 1: Branch the join footer**

Modify `src/components/pages/leagues/league-join-footer.tsx`. After
`requestJoin` succeeds, check if the league is paid
(`monthlyPriceCents > 0`); if so, navigate to
`/leagues/[id]/checkout?membershipId=...` instead of staying put.

```tsx
const onJoin = async () => {
  const membership = await requestJoin.mutateAsync({ leagueId });
  if ((league.monthlyPriceCents ?? 0) > 0) {
    router.push({
      pathname: "/leagues/[id]/checkout",
      params: { id: leagueId, membershipId: membership.id },
    });
  }
};
```

- [ ] **Step 2: Add the organizer "Pagamentos" card**

Modify `src/app/(private)/settings/organization/profile.tsx`. Add a card that:
- Shows "Conectar conta de pagamento" when no `organizationWooviAccount` exists.
- Shows "Validando conta na Woovi…" when `status === "pending"`.
- Shows "Conta conectada" when `status === "active"`.
- Calls `api.payment.onboarding.start` on connect. Disabled when the org
  profile lacks `contactEmail`/`phone`.

Use the HeroUI card + button variants already used elsewhere in that file.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/pages/leagues/league-join-footer.tsx src/app/(private)/settings/organization/profile.tsx
git commit -m "feat(payment): route paid joins to checkout and add organizer payments card"
```

---

## Task 15: Renewal reminder cron

**Files:**
- Create: `convex/functions/payment/cron.ts`

> The spec defines: 3 days before a paid payment's next due date -> send a
> push reminder; past due with no newer paid payment -> suspend the
> membership. This task implements that scheduled job.

- [ ] **Step 1: Write the cron mutation**

Create `convex/functions/payment/cron.ts`. A `privateMutation` (internal,
called by the Convex cron) that scans paid `leaguePayment` rows and acts on
each.

```ts
import { and, eq, lt, lte } from "kitcn/orm";
import { privateMutation } from "../../lib/crpc";
import { leaguePayment } from "../../domains/payment/tables";
import { leagueMembership } from "../../domains/league/tables";

const REMINDER_WINDOW_DAYS = 3;

function addInterval(from: Date, interval: string): Date {
  const d = new Date(from);
  switch (interval) {
    case "week": d.setDate(d.getDate() + 7); break;
    case "month": d.setMonth(d.getMonth() + 1); break;
    case "quarter": d.setMonth(d.getMonth() + 3); break;
    case "year": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export const runRenewalSweep = privateMutation
  .mutation(async ({ ctx }) => {
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const paidPayments = await ctx.orm.query.leaguePayment.findMany({
      where: { status: "paid" },
    });

    for (const payment of paidPayments) {
      if (!payment.paidAt) continue;
      const nextDue = addInterval(new Date(payment.paidAt), payment.billingInterval);

      // Already renewed (a newer paid payment exists for this membership)?
      const newer = await ctx.orm.query.leaguePayment.findFirst({
        where: {
          leagueMembershipId: payment.leagueMembershipId,
          status: "paid",
        },
      });
      if (newer && new Date(newer.paidAt ?? 0) > new Date(payment.paidAt)) {
        continue;
      }

      if (nextDue <= reminderThreshold && nextDue > now) {
        // Reminder: due within 3 days.
        await ctx.scheduler.runAfter(0, internal.notification.orchestrator.createForRecipients, {
          eventType: "payment.confirmed", // reuse a "reminder" event if added to protocol; else add payment.renewal_due
          actorUserId: "",
          recipientUserIds: [/* resolve player's userId */],
          paymentId: payment.id,
        });
      } else if (nextDue <= now) {
        // Past due: suspend the membership.
        await ctx.orm
          .update(leagueMembership)
          .set({ status: "suspended", updatedAt: now })
          .where(eq(leagueMembership.id, payment.leagueMembershipId));
      }
    }
  });
```

> **Resolve before running:**
> - Register the cron in the Convex cron config (check if `convex/cron.ts`
>   exists; if not, follow Convex's `crons` export pattern). Run it daily.
> - The reminder currently reuses `payment.confirmed` as a stand-in. Add a
>   dedicated `"payment.renewal_due"` event to
>   `convex/shared/notifications/protocol.ts` and a template to
>   `definitions.ts` so the copy reads "Sua inscrição vence em breve".
> - Resolve the player's `userId` from `playerProfileId` via the same helper
>   used in Task 11.
> - `findMany` + `status` filter: confirm the kitcn ORM supports compound
>   where on a single column; if not, query by index and filter in memory.

- [ ] **Step 2: Register the cron**

Find or create the Convex cron registration (typically `convex/cron.ts` or
inside `convex/functions/`). Register `internal.payment.cron.runRenewalSweep`
to run once daily:

```ts
crons: {
  "0 9 * * *": cronDaily(internal.payment.cron.runRenewalSweep),
}
```

- [ ] **Step 3: Codegen + typecheck**

Run:
```bash
bun run codegen
bun run typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/functions/payment/cron.ts convex/functions/_generated/
git commit -m "feat(payment): add daily renewal sweep cron (reminder + suspend)"
```

---

## Task 16: Full validation gate

**Files:** none (validation only)

- [ ] **Step 1: Codegen**

Run: `bun run codegen`
Expected: no errors.

- [ ] **Step 2: Lint + typecheck**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Tests**

Run: `bun test`
Expected: all green (new payment tests + existing league/notification tests).

- [ ] **Step 4: Diff hygiene**

Run: `git diff --check`
Expected: clean.

- [ ] **Step 5: Manual sandbox end-to-end**

With the user's real Woovi sandbox credentials in `convex/.env`:
1. Connect an organization subaccount -> reaches `pending` -> `active`.
2. Create a paid league (R$50/month).
3. As a player, join -> land on checkout -> see QR + copia e cola.
4. Pay the PIX in the sandbox -> webhook fires -> membership flips to `active`
   within seconds, split lands in both accounts.

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore(payment): final fixes from sandbox validation"
```

---

## Success Criteria (from the spec)

- An organization owner can connect a Woovi subaccount from the organization
  profile and reach `active`.
- A player joining a paid league is taken to a PIX checkout (QR + copia e
  cola) instead of being instantly approved.
- When the player pays in their bank, the webhook promotes the membership to
  `active` within seconds, with the split landing in both the organizer's and
  BR-Open's Woovi accounts.
- Free leagues are unaffected.
- No IAP, no External Purchase Link Entitlement, and no money passes through
  BR-Open's own accounts.
