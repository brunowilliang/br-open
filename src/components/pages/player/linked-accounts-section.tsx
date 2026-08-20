import { HugeIcons } from "@/components/ui/huge-icons";
import {
  getSecurityErrorMessage,
  isSessionNotFreshError,
  isSocialAuthCanceledError,
} from "@/lib/account/security-errors";
import {
  authAccountsQueryKey,
  buildLinkedAccountRows,
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
import { Button, ListGroup, Separator, useToast } from "heroui-native";
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
 * Acordeão "Contas Vinculadas": e-mail+senha é linha INFORMATIVA (status
 * "Conectado./Não conectado.", sem ação — alterar senha vive na Segurança);
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

  async function refreshAccounts() {
    await queryClient.invalidateQueries({ queryKey: authAccountsQueryKey });
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
    const { error } = await authClient.linkSocial({
      callbackURL: "/settings/player/profile",
      provider: "apple",
    });

    if (error) {
      throw error;
    }
  }

  async function linkGoogle() {
    const { error } = await authClient.linkSocial({
      callbackURL: "/settings/player/profile",
      provider: "google",
    });

    if (error) {
      throw error;
    }
  }

  async function handleLinkPress(provider: "apple" | "google") {
    setPendingProvider(provider);

    try {
      if (provider === "apple" && Platform.OS === "ios") {
        await linkAppleNative();
      } else if (provider === "apple") {
        await linkAppleOAuth();
      } else {
        await linkGoogle();
      }

      await refreshAccounts();
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
      const { error } = await authClient.unlinkAccount({
        providerId: provider,
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
            {provider === "credential" ? (
              <ListGroup.Item
                className={row.isLinked ? undefined : "opacity-50"}
                disabled
              >
                <ListGroup.ItemPrefix>
                  <HugeIcons icon={PROVIDER_ICONS[provider]} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>
                    {PROVIDER_LABELS[provider]}
                  </ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {row.isLinked ? "Conectado." : "Não conectado."}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            ) : (
              <ListGroup.Item>
                <ListGroup.ItemPrefix>
                  <HugeIcons icon={PROVIDER_ICONS[provider]} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>
                    {PROVIDER_LABELS[provider]}
                  </ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {row.isLinked ? "Conectado." : "Não conectado."}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix className="items-center">
                  {row.isLinked ? (
                    <Button
                      isDisabled={pendingProvider !== null || signOut.isPending}
                      onPress={() => {
                        handleUnlinkPress(provider).catch(() => undefined);
                      }}
                      size="sm"
                      variant="danger-soft"
                    >
                      <Button.Label>
                        {pendingProvider === provider
                          ? "Desconectando..."
                          : "Desconectar"}
                      </Button.Label>
                    </Button>
                  ) : (
                    <Button
                      isDisabled={pendingProvider !== null || signOut.isPending}
                      onPress={() => {
                        handleLinkPress(provider).catch(() => undefined);
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      <Button.Label>
                        {pendingProvider === provider
                          ? "Conectando..."
                          : "Conectar"}
                      </Button.Label>
                    </Button>
                  )}
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            )}
          </Fragment>
        );
      })}
    </ListGroup>
  );
}
