import type { HugeIcons } from "@/components/ui/huge-icons";
import { LinkedAccountRow } from "@/components/pages/player/linked-account-row";
import {
  getSecurityErrorMessage,
  isSessionNotFreshError,
  isSocialAuthCanceledError,
} from "@/lib/account/security-errors";
import {
  authAccountsQueryKey,
  buildLinkedAccountRows,
  linkAccountVerified,
  type AuthAccount,
  type LinkedAccountProvider,
} from "@/lib/account/linked-accounts";
import {
  authClient,
  useSignOutMutationOptions,
} from "@/lib/convex/auth-client";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import * as AppleAuthentication from "expo-apple-authentication";
import { AppleIcon, GoogleIcon, Mail01Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListGroup, Separator, useToast } from "heroui-native";
import { Fragment, useState, type ComponentProps } from "react";
import { Platform } from "react-native";

const PROVIDER_LABELS: Record<LinkedAccountProvider, string> = {
  apple: "Apple",
  credential: "E-mail e senha",
  google: "Google",
};

const PROVIDER_ICONS: Record<
  LinkedAccountProvider,
  ComponentProps<typeof HugeIcons>["icon"]
> = {
  apple: AppleIcon,
  credential: Mail01Icon,
  google: GoogleIcon,
};

type LinkedAccountsSectionProps = {
  accounts: AuthAccount[];
};

/**
 * ListGroup "Contas vinculadas" da página "Login e segurança"
 * (/settings/security): e-mail+senha é linha INFORMATIVA (chip de status, sem
 * ação — alterar senha vive na Segurança);
 * Apple e Google conectam (linkSocial — Apple nativa com idToken no iOS,
 * Google via OAuth web) e desconectam (unlinkAccount). Sessão não fresca no
 * unlink → sign-out guiado (freshAge global intocado por decisão de
 * segurança).
 */
export function LinkedAccountsSection(props: LinkedAccountsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingProvider, setPendingProvider] = useState<
    null | "apple" | "google"
  >(null);

  const rows = buildLinkedAccountRows(props.accounts);

  const signOut = useMutation(
    useSignOutMutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não conseguimos encerrar sua sessão. Tente novamente."
          ),
          id: "linked-accounts-sign-out-error",
          label: "Não foi possível sair",
          variant: "danger",
        });
      },
    })
  );

  async function refreshAccounts(): Promise<AuthAccount[]> {
    await queryClient.invalidateQueries({ queryKey: authAccountsQueryKey });

    return queryClient.getQueryData<AuthAccount[]>(authAccountsQueryKey) ?? [];
  }

  async function linkAppleNative() {
    // mesmo guard do useSocialAuth.appleNative: sem isso o signInAsync falha
    // com erro genérico em builds sem o módulo Apple
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

    const { error } = await authClient.linkSocial({
      idToken: { token: credential.identityToken },
      provider: "apple",
    });

    if (error) {
      throw error;
    }
  }

  async function linkAppleOAuth() {
    // Sem errorCallbackURL a recusa do callback cai na pagina de erro do
    // backend (/error) e o app nunca sabe do erro; com ele o erro volta pro
    // deep link do app.
    const { error } = await authClient.linkSocial({
      callbackURL: "/settings/security",
      errorCallbackURL: "/settings/security",
      provider: "apple",
    });

    if (error) {
      throw error;
    }
  }

  async function linkGoogle() {
    const { error } = await authClient.linkSocial({
      callbackURL: "/settings/security",
      errorCallbackURL: "/settings/security",
      provider: "google",
    });

    if (error) {
      throw error;
    }
  }

  async function handleLinkPress(provider: "apple" | "google") {
    setPendingProvider(provider);

    try {
      await linkAccountVerified({
        link: async () => {
          if (provider === "apple" && Platform.OS === "ios") {
            await linkAppleNative();
          } else if (provider === "apple") {
            await linkAppleOAuth();
          } else {
            await linkGoogle();
          }
        },
        provider,
        readAccounts: refreshAccounts,
      });

      toast.show({
        description: `Sua conta ${PROVIDER_LABELS[provider]} foi conectada.`,
        id: "link-account-success",
        label: "Conta conectada",
        variant: "success",
      });
    } catch (error) {
      if (isSocialAuthCanceledError(error)) {
        return;
      }

      toast.show({
        description: getSecurityErrorMessage(
          error,
          `Não conseguimos conectar sua conta ${PROVIDER_LABELS[provider]}. Tente novamente.`
        ),
        id: "link-account-error",
        label: "Falha ao conectar",
        variant: "danger",
      });
    } finally {
      setPendingProvider(null);
    }
  }

  async function handleUnlinkPress(provider: "apple" | "google") {
    setPendingProvider(provider);

    try {
      // Better Auth 1.7: o seletor de unlinkAccount é o id LOCAL da row de
      // account (listAccounts), nunca o accountId do provider.
      const account = props.accounts.find((row) => row.providerId === provider);
      const { error } = await authClient.unlinkAccount({
        accountId: account?.id ?? "",
      });

      if (error) {
        throw error;
      }

      await refreshAccounts();
      toast.show({
        description: `Sua conta ${PROVIDER_LABELS[provider]} foi desconectada.`,
        id: "unlink-account-success",
        label: "Conta desconectada",
        variant: "success",
      });
    } catch (error) {
      if (isSessionNotFreshError(error)) {
        toast.show({
          description:
            "Por segurança, entre novamente para desconectar a conta.",
          id: "unlink-session-not-fresh",
          label: "Entre novamente",
          variant: "warning",
        });
        signOut.mutate();
        return;
      }

      toast.show({
        description: getSecurityErrorMessage(
          error,
          `Não conseguimos desconectar sua conta ${PROVIDER_LABELS[provider]}. Tente novamente.`
        ),
        id: "unlink-account-error",
        label: "Falha ao desconectar",
        variant: "danger",
      });
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <ListGroup>
      {rows.map((row, index) => {
        const provider = row.provider;

        return (
          <Fragment key={provider}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <LinkedAccountRow
              icon={PROVIDER_ICONS[provider]}
              isActionDisabled={pendingProvider !== null || signOut.isPending}
              isInformational={provider === "credential"}
              onActionPress={
                provider === "credential"
                  ? undefined
                  : () => {
                      if (row.isLinked) {
                        handleUnlinkPress(provider).catch(() => undefined);
                      } else {
                        handleLinkPress(provider).catch(() => undefined);
                      }
                    }
              }
              pendingAction={
                pendingProvider === provider
                  ? row.isLinked
                    ? "unlink"
                    : "link"
                  : undefined
              }
              status={row.isLinked ? "connected" : "disconnected"}
              title={PROVIDER_LABELS[provider]}
            />
          </Fragment>
        );
      })}
    </ListGroup>
  );
}
