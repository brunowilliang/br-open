import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";

/**
 * Integração com o contrato `payment/withdraw` (DECISAO-003).
 */
export function useWithdrawApi() {
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();

  return {
    getBalanceQueryOptions: () =>
      crpc.payment.withdraw.getBalance.staticQueryOptions(),
    requestWithdrawMutationOptions: (
      opts?: Parameters<
        typeof crpc.payment.withdraw.requestWithdraw.mutationOptions
      >[0]
    ) => ({
      mutationFn: crpcClient.payment.withdraw.requestWithdraw.mutate,
      mutationKey: crpc.payment.withdraw.requestWithdraw.mutationKey(),
      ...opts,
    }),
  };
}
