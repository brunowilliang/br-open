import { createEnv } from "kitcn/server";
import { z } from "zod";

const envSchema = z.object({
  DEPLOY_ENV: z.string().default("production"),
  SITE_URL: z.string().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  JWKS: z.string().optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  WOOVI_APP_ID: z.string().optional(),
  WOOVI_BASE_URL: z.string().default("https://api.woovi-sandbox.com"),
  WOOVI_WEBHOOK_SECRET: z.string().optional(),
  WOOVI_PLATFORM_FEE_PERCENT: z.string().default("10"),
});

export const getEnv = createEnv({
  readOptionalRuntimeEnv: [
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
    "JWKS",
    "WOOVI_APP_ID",
    "WOOVI_WEBHOOK_SECRET",
  ],
  schema: envSchema,
});
