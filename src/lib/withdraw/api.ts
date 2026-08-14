import { useCRPC } from "@/lib/convex/crpc";

/**
 * Integração com o contrato `payment/withdraw` (DECISAO-003).
 */
export function useWithdrawApi() {
  const crpc = useCRPC();

  return {
    getBalanceQueryOptions: () =>
      crpc.payment.withdraw.getBalance.queryOptions(),
    requestWithdrawMutationOptions: (
      opts?: Parameters<
        typeof crpc.payment.withdraw.requestWithdraw.mutationOptions
      >[0]
    ) => crpc.payment.withdraw.requestWithdraw.mutationOptions(opts),
  };
}
