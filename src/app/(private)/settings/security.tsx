import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";

import { ChangePasswordDialog } from "@/components/pages/player/change-password-dialog";
import { LinkedAccountsSection } from "@/components/pages/player/linked-accounts-section";
import { ProfileSecuritySection } from "@/components/pages/player/profile-security-section";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  authAccountsQueryKey,
  type AuthAccount,
} from "@/lib/account/linked-accounts";
import { authClient } from "@/lib/convex/auth-client";
import { useQuery } from "@tanstack/react-query";

import { useState } from "react";

/**
 * Página "Login e segurança": Segurança e Contas vinculadas em ListGroups no
 * padrão de settings/index.tsx (RUL-0006: linhas com ícone no ItemPrefix,
 * título + descrição, Separator entre linhas, ações no ItemSuffix). A rota é
 * dona das queries (sessão + contas) e dos dialogs liftados.
 */
export default function SettingsSecurityRoute() {
  const session = authClient.useSession();
  const currentEmail = session.data?.user?.email;
  const accounts = useQuery({
    queryFn: async (): Promise<AuthAccount[]> => {
      const { data, error } = await authClient.listAccounts();

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    queryKey: authAccountsQueryKey,
  });
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const accountRows = accounts.data ?? [];

  return (
    <>
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Header.BackButton />
          </Page.Header.Left>
          <Page.Header.Center>
            <Page.Header.Title>Login e segurança</Page.Header.Title>
          </Page.Header.Center>
          <Page.Header.Right />
        </Page.Header>
        {accounts.isPending ? (
          <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
            <LoadingState />
          </Page.ScrollView>
        ) : accounts.isError ? (
          <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
            <ErrorState
              error={accounts.error}
              message="Não foi possível carregar suas contas."
            />
          </Page.ScrollView>
        ) : (
          <Page.ScrollView contentContainerClassName="gap-2 px-4 pb-safe-offset-4">
            <Text color="muted" variant="description">
              Segurança
            </Text>
            <ProfileSecuritySection
              accounts={accountRows}
              currentEmail={currentEmail}
              onOpenChangePassword={() => {
                setIsPasswordDialogOpen(true);
              }}
            />
            <Text color="muted" variant="description">
              Contas vinculadas
            </Text>
            <LinkedAccountsSection accounts={accountRows} />
          </Page.ScrollView>
        )}
      </Page>
      <ChangePasswordDialog
        isOpen={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />
    </>
  );
}
