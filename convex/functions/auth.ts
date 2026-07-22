import { expo } from "@better-auth/expo";
import { i18n } from "@better-auth/i18n";
import { emailOTP } from "better-auth/plugins";
import { organization } from "better-auth/plugins/organization";
import { importPKCS8, SignJWT } from "jose";
import { convex } from "kitcn/auth";
import { Resend } from "resend";
import { authTranslations } from "../lib/auth-i18n";
import { buildTrustedOrigins } from "../lib/auth-trusted-origins";
import { getEnv } from "../lib/get-env";
import { authTriggers } from "../domains/auth/triggers";
import { ac, roles } from "../shared/auth-shared";
import authConfig from "./auth.config";
import { defineAuth } from "./generated/auth";

const APPLE_CLIENT_SECRET_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

type AppleClientSecretOptions = {
  clientId: string;
  keyId: string;
  privateKey: string;
  teamId: string;
};

async function generateAppleClientSecret({
  clientId,
  keyId,
  privateKey,
  teamId,
}: AppleClientSecretOptions) {
  const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + APPLE_CLIENT_SECRET_MAX_AGE_SECONDS)
    .sign(key);
}

export default defineAuth(() => {
  const env = getEnv();
  const appleAppBundleIdentifier = env.APPLE_APP_BUNDLE_IDENTIFIER;
  const appleClientId = env.APPLE_CLIENT_ID;
  const appleClientSecret = env.APPLE_CLIENT_SECRET;
  const appleKeyId = env.APPLE_KEY_ID;
  const applePrivateKey = env.APPLE_PRIVATE_KEY;
  const appleTeamId = env.APPLE_TEAM_ID;
  const appleProvider =
    appleClientId && appleAppBundleIdentifier
      ? {
          apple: async () => {
            const generatedClientSecret =
              appleTeamId && appleKeyId && applePrivateKey
                ? await generateAppleClientSecret({
                    clientId: appleClientId,
                    keyId: appleKeyId,
                    privateKey: applePrivateKey,
                    teamId: appleTeamId,
                  })
                : "";

            return {
              appBundleIdentifier: appleAppBundleIdentifier,
              clientId: appleClientId,
              // Native iOS idToken sign-in does not use this, but Better Auth
              // requires the option to exist on the Apple provider.
              clientSecret: appleClientSecret ?? generatedClientSecret,
            };
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
      requireEmailVerification: false,
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
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (!env.RESEND_EMAIL_API_KEY) {
            return;
          }

          const resend = new Resend(env.RESEND_EMAIL_API_KEY);

          await resend.emails.send({
            from: env.RESEND_FROM_EMAIL,
            html:
              type === "email-verification"
                ? `<p>Use o código <strong>${otp}</strong> para verificar seu e-mail no BR Open.</p>`
                : `<p>Seu código: <strong>${otp}</strong></p>`,
            subject: "Seu código — BR Open",
            to: email,
          });
        },
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
    triggers: authTriggers,
  };
});
