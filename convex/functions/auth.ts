import { expo } from "@better-auth/expo";
import { i18n } from "@better-auth/i18n";
import { organization } from "better-auth/plugins/organization";
import { convex } from "kitcn/auth";
import { authTranslations } from "../lib/auth-i18n";
import { buildTrustedOrigins } from "../lib/auth-trusted-origins";
import { getEnv } from "../lib/get-env";
import { ac, roles } from "../shared/auth-shared";
import authConfig from "./auth.config";
import { defineAuth } from "./generated/auth";

export default defineAuth(() => {
  const env = getEnv();
  const appleProvider =
    env.APPLE_CLIENT_ID &&
    env.APPLE_CLIENT_SECRET &&
    env.APPLE_APP_BUNDLE_IDENTIFIER
      ? {
          apple: {
            appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
          },
        }
      : {};
  const googleProvider =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {};

  return {
    emailAndPassword: {
      enabled: true,
    },
    baseURL: env.BETTER_AUTH_URL ?? env.SITE_URL,
    plugins: [
      i18n({
        defaultLocale: "pt-BR",
        translations: authTranslations,
      }),
      organization({
        ac,
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        invitationExpiresIn: 48 * 60 * 60,
        membershipLimit: 100,
        organizationLimit: 5,
        roles,
        teams: { enabled: true, maximumTeams: 10 },
      }),
      expo(),
      convex({
        authConfig,
        jwks: env.JWKS,
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 15,
    },
    socialProviders: {
      ...appleProvider,
      ...googleProvider,
    },
    telemetry: { enabled: false },
    trustedOrigins: [
      ...buildTrustedOrigins({
        siteUrl: env.SITE_URL,
      }),
      "https://appleid.apple.com",
    ],
  };
});
