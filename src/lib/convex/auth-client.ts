import { useMutation } from "@tanstack/react-query";
import { expoClient } from "@better-auth/expo/client";
import { ac, roles } from "@convex/auth-shared";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useToast } from "heroui-native";
import { convexClient } from "kitcn/auth/client";
import { createAuthMutations } from "kitcn/react";
import { useState } from "react";
import { Platform } from "react-native";

import { getToastErrorMessage } from "@/lib/errors/toast-message";

const scheme = Constants.expoConfig?.scheme as string;

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL!,
  plugins: [
    convexClient(),
    organizationClient({ ac, roles, teams: { enabled: true } }),
    ...(Platform.OS === "web"
      ? []
      : [
          expoClient({
            scheme,
            storagePrefix: scheme,
            storage: SecureStore,
          }),
        ]),
  ],
});

export const {
  useSignInMutationOptions,
  useSignInSocialMutationOptions,
  useSignOutMutationOptions,
  useSignUpMutationOptions,
} = createAuthMutations(authClient);

type SocialAuthMode = "sign-in" | "sign-up";

type AppleIdTokenUser = {
  email?: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
};

export function useSocialAuth(mode: SocialAuthMode) {
  const { toast } = useToast();
  const signInSocial = useMutation(useSignInSocialMutationOptions());
  const [isApplePending, setIsApplePending] = useState(false);

  const isPending = signInSocial.isPending || isApplePending;
  const actionLabel = mode === "sign-in" ? "login" : "cadastro";

  function reset() {
    signInSocial.reset();
  }

  function appleOAuth() {
    return signInSocial.mutateAsync({
      callbackURL: "/",
      provider: "apple",
    });
  }

  async function appleNative() {
    const isAvailable = await AppleAuthentication.isAvailableAsync();

    if (!isAvailable) {
      throw new Error(
        "Login nativo com Apple indisponível neste build. Rebuild o app iOS."
      );
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("A Apple não retornou o token de autenticação.");
    }

    const appleUser: AppleIdTokenUser = {};
    const firstName = credential.fullName?.givenName ?? undefined;
    const lastName = credential.fullName?.familyName ?? undefined;

    if (credential.email) {
      appleUser.email = credential.email;
    }

    if (firstName || lastName) {
      appleUser.name = { firstName, lastName };
    }

    return signInSocial.mutateAsync({
      callbackURL: "/",
      idToken: {
        token: credential.identityToken,
        ...(Object.keys(appleUser).length > 0 ? { user: appleUser } : {}),
      },
      provider: "apple",
    });
  }

  async function handleApplePress() {
    signInSocial.reset();
    setIsApplePending(true);

    try {
      await (Platform.OS === "ios" ? appleNative() : appleOAuth());
    } catch (error) {
      const isCanceled =
        error instanceof Error &&
        error.message === "The user canceled the authorization attempt";

      if (isCanceled) {
        return;
      }

      toast.show({
        description: getToastErrorMessage(
          error,
          "Não conseguimos conectar sua conta Apple. Tente novamente."
        ),
        id: `${mode}-apple-error`,
        label: `Falha no ${actionLabel} com a Apple`,
        variant: "danger",
      });
    } finally {
      setIsApplePending(false);
    }
  }

  async function handleGooglePress() {
    signInSocial.reset();

    try {
      await signInSocial.mutateAsync({
        callbackURL: "/",
        provider: "google",
      });
    } catch (error) {
      const isCanceled =
        error instanceof Error &&
        error.message === "Authentication did not complete. Try again.";

      if (isCanceled) {
        return;
      }

      toast.show({
        description: getToastErrorMessage(
          error,
          "Não conseguimos conectar sua conta Google. Tente novamente."
        ),
        id: `${mode}-google-error`,
        label: `Falha no ${actionLabel} com o Google`,
        variant: "danger",
      });
    }
  }

  return { isPending, handleApplePress, handleGooglePress, reset };
}
