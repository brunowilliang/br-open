import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useToast } from "heroui-native";
import { useState } from "react";

import { applyViewerContextToClientState } from "@/lib/convex/actor-scoped-cache";
import { useSignOutMutationOptions } from "@/lib/convex/auth-client";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";

import {
  ACCOUNT_DELETION_CODE_COOLDOWN_SECONDS,
  type AccountDeletionBlocker,
  type DeletionBlockerAction,
  presentDeletionBlocker,
  readDeletionCodeOutcome,
} from "@/lib/account/delete-account";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { useOtpCooldown } from "@/lib/hooks/use-otp-cooldown";

import {
  DangerSoftActionCard,
  type DeleteAccountStep,
  DeleteCodeDialog,
  DeleteGateDialog,
  type DeleteGateBlocker,
  DeleteRisksDialog,
} from "./flow";

const DELETE_ACCOUNT_OTP_KEY = "otp-delete-account-timestamp";

/** Fluxo real de exclusão de conta: o card abre os riscos e os passos seguintes
 * batem no contrato `account/deletion` (status -> requestCode -> confirm). */
export function DeleteAccountSection(props: { email: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const [step, setStep] = useState<DeleteAccountStep | null>(null);
  const [code, setCode] = useState("");
  const [recheckedBlockers, setRecheckedBlockers] = useState<
    AccountDeletionBlocker[] | null
  >(null);
  const cooldown = useOtpCooldown(
    DELETE_ACCOUNT_OTP_KEY,
    ACCOUNT_DELETION_CODE_COOLDOWN_SECONDS
  );

  // Status só quando o fluxo abre; o confirm recheca por conta própria e o
  // Atualizar refaz esta query.
  const statusQuery = useQuery({
    ...crpc.account.deletion.status.staticQueryOptions(),
    enabled: step !== null,
  });
  const requestCode = useMutation({
    mutationFn: crpcClient.account.deletion.requestCode.mutate,
    mutationKey: crpc.account.deletion.requestCode.mutationKey(),
  });
  const confirm = useMutation({
    mutationFn: crpcClient.account.deletion.confirm.mutate,
    mutationKey: crpc.account.deletion.confirm.mutationKey(),
  });
  // A conta (e a sessão no servidor) já morreu no confirm; o gate de auth do
  // kitcn vira antes da chamada, então erro de signOut não vira toast.
  const signOut = useMutation(useSignOutMutationOptions());
  const viewerContext = useQuery(crpc.viewer.context.get.staticQueryOptions());
  const setActiveActor = useMutation({
    mutationFn: crpcClient.viewer.context.setActiveActor.mutate,
    mutationKey: crpc.viewer.context.setActiveActor.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível alternar entre os modos. Tente novamente."
        ),
        id: "delete-account-set-active-actor-error",
        label: "Modo não alterado",
        variant: "danger",
      });
    },
  });

  function openFlow() {
    setCode("");
    setRecheckedBlockers(null);
    setStep("risks");
  }

  function closeFlow() {
    setStep(null);
  }

  async function invalidateActorScopedQueries(
    nextViewerContext?: typeof viewerContext.data
  ) {
    if (nextViewerContext) {
      applyViewerContextToClientState({
        queryClient,
        viewerContext: nextViewerContext,
        viewerContextFilter: crpc.viewer.context.get.queryFilter(),
      });
    }

    await Promise.all([
      queryClient.invalidateQueries(crpc.viewer.context.get.queryFilter()),
      queryClient.invalidateQueries(
        crpc.notification.settings.status.queryFilter()
      ),
    ]);
  }

  async function switchToOrganization(organizationId: string) {
    try {
      const nextContext = await setActiveActor.mutateAsync({
        actorKind: "organization",
        organizationId,
      });
      await invalidateActorScopedQueries(nextContext);
      return true;
    } catch {
      // Sem a troca o torneio abriria na visão errada; o onError já avisou.
      return false;
    }
  }

  /** O CTA do torneio abre a visão do organizador só com a org dona ativa
   * (`organizationIds[0]` do blocker); sem ela, cai no primeiro ator de
   * organização como antes. Sem a troca não navega (o erro já vira toast). */
  function ensureOrganizerActor(targetOrganizationId?: string) {
    const context = viewerContext.data;

    if (!context) {
      return true;
    }

    if (targetOrganizationId) {
      const isTargetActive =
        context.activeActor.kind === "organization" &&
        context.activeActor.id === targetOrganizationId;

      return isTargetActive ? true : switchToOrganization(targetOrganizationId);
    }

    if (context.activeActor.kind === "organization") {
      return true;
    }

    const organizationActor = context.availableActors.find(
      (actor) => actor.kind === "organization"
    );

    return organizationActor
      ? switchToOrganization(organizationActor.id)
      : true;
  }

  async function handleBlockerPress(action: DeletionBlockerAction) {
    // A tela de settings fica montada atrás: fecha a régua antes de navegar.
    closeFlow();

    if (
      action.requiresOrganizerActor &&
      !(await ensureOrganizerActor(action.organizationId))
    ) {
      return;
    }

    router.navigate(action.href as Href);
  }

  function sendCode() {
    requestCode.mutate(
      {},
      {
        onError: (error) => {
          // Qualquer tentativa consome o bucket do servidor: cooldown também
          // na falha, senão o reenvio fica martelável após 429.
          cooldown.startCooldown().catch(() => undefined);
          toast.show({
            description: getToastErrorMessage(
              error,
              "Não foi possível enviar o código. Tente novamente."
            ),
            id: "delete-account-code-request-error",
            label: "Falha no envio",
            variant: "danger",
          });
        },
        onSuccess: () => {
          cooldown.startCooldown().catch(() => undefined);
        },
      }
    );
  }

  function handleConfirmCode(otp: string) {
    if (confirm.isPending) {
      return;
    }

    confirm.mutate(
      { code: otp },
      {
        onError: (error) => {
          setCode("");
          toast.show({
            description: getToastErrorMessage(
              error,
              "Não foi possível confirmar a exclusão. Tente novamente."
            ),
            id: "delete-account-confirm-error",
            label: "Falha na confirmação",
            variant: "danger",
          });
        },
        onSuccess: (result) => {
          const outcome = readDeletionCodeOutcome(result);

          if (outcome.kind === "deleted") {
            setStep(null);
            toast.show({
              description: "Sua conta e seus dados foram removidos.",
              id: "delete-account-deleted",
              label: "Conta apagada",
              variant: "success",
            });
            signOut.mutate();
            return;
          }

          setCode("");

          if (outcome.kind === "blocked") {
            setRecheckedBlockers(outcome.blockers);
            setStep("gate");
            return;
          }

          toast.show({
            description: outcome.message,
            id: "delete-account-code-error",
            label: "Falha na confirmação",
            variant: "danger",
          });
        },
      }
    );
  }

  function handleRefreshGate() {
    statusQuery.refetch().then(() => {
      setRecheckedBlockers(null);
    });
  }

  const blockers: DeleteGateBlocker[] = (
    recheckedBlockers ??
    statusQuery.data?.blockers ??
    []
  ).map((blocker) => {
    const presented = presentDeletionBlocker(blocker);
    const action = presented.action;

    return {
      actionLabel: action?.label,
      description: presented.summary,
      onPress: action
        ? () => {
            handleBlockerPress(action).catch(() => undefined);
          }
        : undefined,
      title: presented.title,
    };
  });
  const canDelete =
    recheckedBlockers === null && statusQuery.data?.canDelete === true;

  return (
    <>
      <DangerSoftActionCard
        actionLabel="Apagar conta"
        description="Remove permanentemente a sua conta e tudo o que é seu."
        onPress={openFlow}
        title="Apagar conta"
      />

      <DeleteRisksDialog
        isOpen={step === "risks"}
        onCancel={closeFlow}
        onConfirm={() => {
          setStep("gate");
        }}
      />
      <DeleteGateDialog
        blockers={blockers}
        canDelete={canDelete}
        isError={statusQuery.isError}
        isLoading={statusQuery.isPending}
        isOpen={step === "gate"}
        isRefreshing={statusQuery.isRefetching}
        onCancel={closeFlow}
        onConfirm={() => {
          setCode("");
          setStep("code");
          sendCode();
        }}
        onRefresh={handleRefreshGate}
        resolutions={(statusQuery.data?.resolutions ?? []).map(
          (resolution) => resolution.summary
        )}
      />
      <DeleteCodeDialog
        cooldown={cooldown.cooldown}
        email={props.email}
        isOpen={step === "code"}
        isPending={confirm.isPending}
        onCancel={closeFlow}
        onResend={sendCode}
        onSubmit={handleConfirmCode}
        onValueChange={setCode}
        value={code}
      />
    </>
  );
}
