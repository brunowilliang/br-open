import { buildOrganizerConclusionPendings } from "@convex/domains/tournament/pendings-rules";
import { Button } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import {
  LabeledBlock,
  VariantSection,
  noop,
} from "@/components/pages/settings/shared";
import { WidgetAlert } from "@/components/ui/widget-alert";
import { ACCOUNT_DELETION_CODE_COOLDOWN_SECONDS } from "@/lib/account/delete-account";
import { useOtpCooldown } from "@/lib/hooks/use-otp-cooldown";

import {
  DangerSoftActionCard,
  type DeleteAccountStep,
  DeleteCodeDialog,
  DeleteGateDialog,
  type DeleteGateBlocker,
  DeleteRisksDialog,
} from "./flow";

/** E-mail de fachada: o mock não tem sessão, então o destino do código é fixo. */
const GALLERY_ACCOUNT_EMAIL = "jogador@exemplo.com";

/** Bloqueios de fachada da régua: o de concluir vem do builder REAL do
 * servidor; o de valores a recolher é copy proposta. */
const GALLERY_DELETE_CONCLUSION_PENDING = buildOrganizerConclusionPendings({
  tournaments: [
    {
      canConclude: true,
      tournamentId: "gallery-delete-conclusion",
      tournamentName: "Circuito de Outubro",
    },
  ],
})[0];

const GALLERY_DELETE_RECEIVABLE = {
  actionLabel: "Ver",
  description:
    "Regularize os valores de torneios que você organizou para liberar a exclusão.",
  title: "R$ 45 a recolher",
} as const;

type GalleryGateState = "locked" | "unlocked";

const REFRESH_MOCK_DELAY_MS = 800;

/** Mock dev do fluxo de exclusão de conta: navega de ponta a ponta e não executa nada. */
export function DeleteAccountVariantsSection() {
  const [gateState, setGateState] = useState<GalleryGateState>("locked");
  const [step, setStep] = useState<DeleteAccountStep | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [code, setCode] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const cooldown = useOtpCooldown(
    "otp-gallery-delete-account-timestamp",
    ACCOUNT_DELETION_CODE_COOLDOWN_SECONDS
  );

  useEffect(() => {
    if (step === "gate") {
      return;
    }
    setIsRefreshing(false);
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = undefined;
  }, [step]);

  useEffect(
    () => () => {
      clearTimeout(refreshTimerRef.current);
    },
    []
  );

  function handleRefresh() {
    setIsRefreshing(true);
    refreshTimerRef.current = setTimeout(() => {
      setIsRefreshing(false);
      refreshTimerRef.current = undefined;
    }, REFRESH_MOCK_DELAY_MS);
  }

  function openFlow() {
    setIsDone(false);
    setCode("");
    setStep("risks");
  }

  function closeFlow() {
    setCode("");
    setStep(null);
  }

  const blockers: DeleteGateBlocker[] = [
    {
      actionLabel: GALLERY_DELETE_CONCLUSION_PENDING.actionLabel ?? "Concluir",
      description: GALLERY_DELETE_CONCLUSION_PENDING.description,
      onPress: noop,
      title: GALLERY_DELETE_CONCLUSION_PENDING.title,
    },
    {
      actionLabel: GALLERY_DELETE_RECEIVABLE.actionLabel,
      description: GALLERY_DELETE_RECEIVABLE.description,
      onPress: noop,
      title: GALLERY_DELETE_RECEIVABLE.title,
    },
  ];

  return (
    <View className="gap-6">
      <VariantSection
        note="Estrutura das pendências (título, descrição e ação do lado) com a identidade do card Deletar torneio (settings/tournaments/[mode]/settings.tsx:246-262): superfície danger-soft, Alert02Icon e textos em danger. A copy é a proposta do fluxo de exclusão de conta; a ação abre o passo 2."
        title="Card | Apagar conta"
      >
        <DangerSoftActionCard
          actionLabel="Apagar conta"
          description="Remove permanentemente a sua conta e tudo o que é seu."
          onPress={openFlow}
          title="Apagar conta"
        />
      </VariantSection>

      <VariantSection
        note="Demonstração do fluxo inteiro: riscos com a rolagem travando o botão (o chip de aviso encolhe e some com animação ao chegar no fim), régua nos dois estados (os bloqueios seguem o card Deletar torneio e o de concluir traz título, CTA e descrição do builder real do servidor) e código de 6 dígitos no e-mail. Nada executa de verdade (handlers noop, sem chamada de servidor); o alternador escolhe o estado da régua no passo 3."
        title="Fluxo | Passo a passo (interativo)"
      >
        <View className="gap-3">
          <LabeledBlock label="Régua da exclusão (passo 3):">
            <View className="flex-row gap-2">
              <Button
                onPress={() => {
                  setGateState("locked");
                }}
                size="sm"
                variant={gateState === "locked" ? "primary" : "secondary"}
              >
                <Button.Label>Travado</Button.Label>
              </Button>
              <Button
                onPress={() => {
                  setGateState("unlocked");
                }}
                size="sm"
                variant={gateState === "unlocked" ? "primary" : "secondary"}
              >
                <Button.Label>Liberado</Button.Label>
              </Button>
            </View>
          </LabeledBlock>
          <Button className="self-start" onPress={openFlow}>
            <Button.Label>Começar demonstração</Button.Label>
          </Button>
        </View>
      </VariantSection>

      {isDone ? (
        <VariantSection
          note="Desfecho mock do passo 4: no app real, aqui a conta seria apagada e a sessão encerrada. Nada foi apagado nesta demonstração."
          title="Fim | Depois do código"
        >
          <WidgetAlert
            action={{ label: "Rodar de novo", onPress: openFlow }}
            description="No app real, sua conta seria apagada e você sairia do app. Esta é uma demonstração."
            status="success"
            title="Demonstração concluída"
          />
        </VariantSection>
      ) : null}

      <DeleteRisksDialog
        isOpen={step === "risks"}
        onCancel={closeFlow}
        onConfirm={() => {
          setStep("gate");
        }}
      />
      <DeleteGateDialog
        blockers={blockers}
        canDelete={gateState === "unlocked"}
        isError={false}
        isLoading={false}
        isOpen={step === "gate"}
        isRefreshing={isRefreshing}
        onCancel={closeFlow}
        onConfirm={() => {
          setStep("code");
        }}
        onRefresh={handleRefresh}
        resolutions={[]}
      />
      <DeleteCodeDialog
        cooldown={cooldown.cooldown}
        email={GALLERY_ACCOUNT_EMAIL}
        isOpen={step === "code"}
        isPending={false}
        onCancel={closeFlow}
        onResend={() => {
          cooldown.startCooldown().catch(() => undefined);
        }}
        onSubmit={() => {
          setIsDone(true);
          setStep(null);
        }}
        onValueChange={setCode}
        value={code}
      />
    </View>
  );
}
