import { expo } from "@better-auth/expo";
import { i18n } from "@better-auth/i18n";
import { organization } from "better-auth/plugins/organization";
import { convex } from "kitcn/auth";
import { authTranslations } from "../lib/auth-i18n";
import { getEnv } from "../lib/get-env";
import { ac, roles } from "../shared/auth-shared";
import authConfig from "./auth.config";
import { defineAuth } from "./generated/auth";

export default defineAuth(() => ({
  emailAndPassword: {
    enabled: true,
  },
  baseURL: getEnv().CONVEX_SITE_URL ?? getEnv().SITE_URL,
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
      jwks: getEnv().JWKS,
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24 * 15,
  },
  telemetry: { enabled: false },
  trustedOrigins: [getEnv().SITE_URL],
}));
