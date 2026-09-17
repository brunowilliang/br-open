/**
 * Derivação pura do estado das contas vinculadas a partir da resposta de
 * `authClient.listAccounts()`.
 */

export type AuthAccount = {
  /** Id LOCAL da row em `account` (seletor exigido pelo Better Auth 1.7). */
  id?: string;
  accountId?: string;
  providerId: string;
};

export type LinkedAccountProvider = "apple" | "credential" | "google";

export type LinkedAccountRowState = {
  isLinked: boolean;
  provider: LinkedAccountProvider;
};

/** Chave de query compartilhada pela tela de perfil e pelas seções de conta. */
export const authAccountsQueryKey = ["auth", "list-accounts"] as const;

const ROW_PROVIDERS: LinkedAccountProvider[] = [
  "credential",
  "apple",
  "google",
];

/** O item "Alterar senha" só existe para contas com e-mail+senha. */
export function hasCredentialAccount(accounts: AuthAccount[]): boolean {
  return accounts.some((account) => account.providerId === "credential");
}

/**
 * Linhas fixas da seção Contas Vinculadas: credential (sem ação de
 * conectar/desconectar), apple e google — sempre na mesma ordem.
 */
export function buildLinkedAccountRows(
  accounts: AuthAccount[]
): LinkedAccountRowState[] {
  return ROW_PROVIDERS.map((provider) => ({
    isLinked: accounts.some((account) => account.providerId === provider),
    provider,
  }));
}
