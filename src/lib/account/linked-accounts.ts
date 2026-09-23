/**
 * Derivação pura do estado das contas vinculadas a partir da resposta de
 * `authClient.listAccounts()`, mais a regra do link social verificado.
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

type LinkAccountVerifiedParams = {
  /** Dispara o link no provider (Apple nativa com idToken, ou browser). */
  link: () => Promise<unknown>;
  provider: LinkedAccountProvider;
  /** Lista FRESCA de contas: a mesma leitura que atualiza a tela. */
  readAccounts: () => Promise<AuthAccount[]>;
};

/**
 * O link social só vale como conectado com o provider confirmado na lista
 * fresca: o plugin expo do better-auth resolve SEM erro quando o callback
 * recusa, porque só lê o `cookie` do deep link (@better-auth/expo, onSuccess).
 * Sem confirmação, quem chamou cai no caminho de erro em vez do toast de
 * sucesso.
 */
export async function linkAccountVerified(
  params: LinkAccountVerifiedParams
): Promise<AuthAccount[]> {
  await params.link();

  const accounts = await params.readAccounts();
  const isLinked = accounts.some(
    (account) => account.providerId === params.provider
  );

  if (!isLinked) {
    throw new Error("Social link not confirmed by the account list");
  }

  return accounts;
}
