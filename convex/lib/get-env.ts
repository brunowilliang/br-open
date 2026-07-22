import { createEnv } from "kitcn/server";
import { z } from "zod";

const envSchema = z.object({
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
  DEPLOY_ENV: z.string().default("production"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  JWKS: z.string().optional(),
  RESEND_EMAIL_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("BR Open <no-reply@bropen.app>"),
  SITE_URL: z.string().default("http://localhost:3000"),
  // Woovi (OpenPix) — REST auth uses WOOVI_APP_ID verbatim (no Bearer/Basic).
  // Webhook verification uses Woovi's fixed RSA public key (no per-merchant
  // secret — see webhook-signature.ts). WOOVI_BASE_URL defaults to sandbox.
  WOOVI_APP_ID: z.string().optional(),
  WOOVI_BASE_URL: z.string().default("https://api.woovi-sandbox.com"),
  WOOVI_CLIENT_ID: z.string().optional(),
});

export const getEnv = createEnv({
  readOptionalRuntimeEnv: [
    "WOOVI_APP_ID",
    "WOOVI_BASE_URL",
    "WOOVI_CLIENT_ID",
    "APPLE_APP_BUNDLE_IDENTIFIER",
    "APPLE_CLIENT_ID",
    "APPLE_CLIENT_SECRET",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY",
    "APPLE_TEAM_ID",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "RESEND_EMAIL_API_KEY",
    "RESEND_FROM_EMAIL",
    "JWKS",
  ],
  schema: envSchema,
});
