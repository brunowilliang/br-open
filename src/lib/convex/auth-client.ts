import { expoClient } from "@better-auth/expo/client";
import { ac, roles } from "@convex/auth-shared";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { convexClient } from "kitcn/auth/client";
import { createAuthMutations } from "kitcn/react";
import { Platform } from "react-native";

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
