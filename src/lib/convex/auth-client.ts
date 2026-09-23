import { useMutation } from "@tanstack/react-query";
import { expoClient } from "@better-auth/expo/client";
import { ac, roles } from "@convex/auth-shared";
import {
  emailOTPClient,
  organizationClient,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { useToast } from "heroui-native";
import { convexClient } from "kitcn/auth/client";
import {
  AUTH_SESSION_SYNC_GRACE_MS,
  createAuthMutations,
  decodeJwtExp,
  useAuthStore,
} from "kitcn/react";
import { useState } from "react";
import { Platform } from "react-native";

import { isSocialAuthCanceledError } from "@/lib/account/security-errors";
import { getToastErrorMessage } from "@/lib/errors/toast-message";

const scheme = Constants.expoConfig?.scheme as string;

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL!,
  // O plugin expo do better-auth só manda `expo-origin` quando o corpo NÃO tem
  // idToken; no link da Apple nativa ele manda o cookie de sessão sem o header
  // e o gate de CSRF do servidor responde 403 MISSING_OR_NULL_ORIGIN. Como o
  // scheme do app já é trusted origin, completamos o header nós mesmos.
  fetchOptions: {
    onRequest: (request) => {
      if (Platform.OS === "web" || request.headers.has("expo-origin")) {
        return;
      }

      request.headers.set("expo-origin", Linking.createURL("", { scheme }));
    },
  },
  plugins: [
    convexClient(),
    organizationClient({ ac, roles, teams: { enabled: true } }),
    emailOTPClient(),
    usernameClient(),
    ...(Platform.OS === "web"
      ? []
      : [
          expoClient({
            scheme,
            storage: SecureStore,
            storagePrefix: scheme,
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
      if (isSocialAuthCanceledError(error)) {
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
      if (isSocialAuthCanceledError(error)) {
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

  return { handleApplePress, handleGooglePress, isPending, reset };
}

// ---------------------------------------------------------------------------
// Change password (logged in) — native better-auth endpoint.
// ---------------------------------------------------------------------------

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

/**
 * Troca a senha logado com `revokeOtherSessions: true`: o servidor revoga
 * TODAS as sessões e devolve um token novo para a sessão atual — sem semear
 * esse token no authStore do kitcn o usuário cairia da sessão (mesmo
 * tratamento que `createAuthMutations` aplica nos sign-in).
 */
export function useChangePassword() {
  const authStore = useAuthStore();
  const [isChangePasswordPending, setIsChangePasswordPending] = useState(false);

  async function changePassword(input: ChangePasswordInput) {
    setIsChangePasswordPending(true);

    try {
      const { data, error } = await authClient.changePassword({
        ...input,
        revokeOtherSessions: true,
      });

      if (error) {
        throw error;
      }

      if (data?.token) {
        authStore.set("token", data.token);
        authStore.set("expiresAt", decodeJwtExp(data.token));
        authStore.set(
          "sessionSyncGraceUntil",
          Date.now() + AUTH_SESSION_SYNC_GRACE_MS
        );
      }
    } finally {
      setIsChangePasswordPending(false);
    }
  }

  return { changePassword, isChangePasswordPending };
}
