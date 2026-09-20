import { InformationCircleIcon, Key01Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Dialog, useToast } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { Amount } from "@/components/pages/withdraw/keyboard/amount";
import { Keyboard } from "@/components/pages/withdraw/keyboard/keyboard";
import { useAmountInputController } from "@/components/pages/withdraw/keyboard/use-amount-input-controller";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatCurrencyCents } from "@/lib/format/currency";
import { useWithdrawApi } from "@/lib/withdraw/api";
import {
  computeLiquidAmountCents,
  computeWithdrawFeeCents,
  validateWithdrawAmountCents,
} from "@/lib/withdraw/calculations";
import {
  isMissingPaymentAccountError,
  isWithdrawConflictError,
} from "@/lib/withdraw/errors";
import { useWithdrawIdempotencyKey } from "@/lib/withdraw/idempotency";
import { buildWithdrawFeeLines } from "@/lib/withdraw/info";

export default function WithdrawScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { getBalanceQueryOptions, requestWithdrawMutationOptions } =
    useWithdrawApi();

  const balanceQuery = useQuery(getBalanceQueryOptions());

  const { amountInCents, parts, isEmpty, handleKeyPress, setAmountCents } =
    useAmountInputController();

  // Chave estável por tentativa (BUG-0005): preservada entre erros/retries
  // para o backend fazer replay da reserva em vez de um 2º POST.
  const { attemptKey, confirmed } = useWithdrawIdempotencyKey();

  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const balance = balanceQuery.data;
  const feeCents =
    balance === undefined
      ? 0
      : computeWithdrawFeeCents({
          amountCents: amountInCents,
          feeTiers: balance.feeTiers,
          freeFromCents: balance.freeFromCents,
        });
  const liquidCents = computeLiquidAmountCents(amountInCents, feeCents);
  const validation =
    isEmpty || balance === undefined
      ? null
      : validateWithdrawAmountCents(amountInCents, {
          balanceCents: balance.balanceCents,
          minWithdrawCents: balance.minWithdrawCents,
        });
  const isFree = feeCents === 0;
  // Destino do saque vem do getBalance (IBX-0002): pixKey já mascarada pelo
  // backend e accountName null para chaves legadas → rótulo "Chave PIX".
  const pixKey = balance?.pixKey ?? null;
  const accountName = balance?.accountName ?? null;

  const requestWithdraw = useMutation(
    requestWithdrawMutationOptions({
      onError: (error) => {
        // CONFLICT = replay de linha failed (falha DEFINITIVA do provedor):
        // a chave estável já cumpriu seu papel (impediu o 2º POST) — libera
        // para o retry nascer com chave nova, senão a tela fica presa em
        // CONFLICT eterno (BUG-0005, review finding 3).
        if (isWithdrawConflictError(error)) {
          confirmed();
        }
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível solicitar o saque. Tente novamente."
          ),
          id: "withdraw-request-error",
          label: "Saque falhou",
          variant: "danger",
        });
      },
      onSuccess: (result) => {
        // Sucesso confirmado: a próxima tentativa ganha chave nova (BUG-0005).
        confirmed();
        toast.show({
          description: `Você receberá ${formatCurrencyCents(
            result.liquidAmountCents
          )} na sua chave PIX.`,
          id: "withdraw-request-success",
          label: "Saque solicitado",
          variant: "success",
        });
        router.back();
      },
    })
  );

  const canConfirm =
    balance !== undefined &&
    validation?.ok === true &&
    liquidCents > 0 &&
    !requestWithdraw.isPending;

  const hasValue = !isEmpty;

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Sacar</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      {balanceQuery.isError ? (
        isMissingPaymentAccountError(balanceQuery.error) ? (
          <EmptyState
            buttonLabel="Cadastrar chave PIX"
            buttonOnPress={() => {
              router.navigate("/settings/organization/profile");
            }}
            buttonVariant="secondary"
            description="Para sacar, conecte a chave PIX da sua organização no perfil."
            icon={Key01Icon}
            title="Conta de pagamento não configurada"
          />
        ) : (
          <ErrorState
            error={balanceQuery.error}
            message="Não foi possível carregar o saldo."
          />
        )
      ) : (
        <>
          {/* Centro: valor animado + ações + taxa */}
          <Page.View className="flex-1 justify-center px-4">
            <View className="items-center gap-4">
              <Amount
                decimal={parts.decimal}
                error={validation?.ok === false}
                errorMessage={
                  validation?.ok === false ? validation.message : null
                }
                integer={parts.integer}
                isEmpty={isEmpty}
              />

              {/* Sacar tudo + info */}
              <View className="flex-row items-center gap-1">
                <Button
                  isDisabled={!balance || balance.balanceCents <= 0}
                  onPress={() => {
                    setAmountCents(balance?.balanceCents ?? 0);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Sacar tudo
                </Button>

                <Button
                  accessibilityHint="Detalhes do saque"
                  accessibilityLabel="Detalhes do saque"
                  accessibilityRole="button"
                  isIconOnly
                  onPress={() => setIsInfoOpen(true)}
                  size="sm"
                  variant="ghost"
                >
                  <HugeIcons
                    className="size-5 text-muted"
                    icon={InformationCircleIcon}
                  />
                </Button>
              </View>

              {/* Taxa ao vivo quando há valor digitado */}
              {hasValue && balance !== undefined ? (
                <View className="gap-0.5 pt-2">
                  <View className="flex-row items-center gap-2">
                    <Text color="muted" variant="description">
                      Taxa de saque
                    </Text>
                    <Text size="sm" weight="medium">
                      {isFree ? "Grátis" : formatCurrencyCents(feeCents)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text color="muted" variant="description">
                      Você recebe
                    </Text>
                    <Text
                      color={liquidCents > 0 ? undefined : "danger"}
                      size="sm"
                      weight="medium"
                    >
                      {formatCurrencyCents(liquidCents)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </Page.View>

          {/* Teclado + confirmação */}
          <View className="gap-4 px-4 pb-safe-offset-4">
            <Keyboard isEmpty={isEmpty} onKeyPress={handleKeyPress} />
            <Button
              className="w-full"
              isDisabled={!canConfirm}
              onPress={() => {
                if (balance === undefined) {
                  return;
                }
                requestWithdraw.mutate({
                  amountCents: amountInCents,
                  idempotencyKey: attemptKey(),
                });
              }}
            >
              <Button.Label>
                {requestWithdraw.isPending
                  ? "Solicitando..."
                  : "Confirmar saque"}
              </Button.Label>
            </Button>
          </View>
        </>
      )}

      {/* Dialog: destino PIX + mínimo + tabela de taxas */}
      <Dialog isOpen={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />
            <Dialog.Title>Detalhes do saque</Dialog.Title>

            {pixKey ? (
              <View className="gap-0.5">
                <Text color="muted" variant="description">
                  Destino
                </Text>
                <Text weight="semibold">{accountName ?? "Chave PIX"}</Text>
                <Text color="muted" size="sm">
                  {pixKey}
                </Text>
              </View>
            ) : (
              <View className="gap-1">
                <Text weight="semibold">Nenhuma chave PIX cadastrada</Text>
                <Text color="muted" variant="description">
                  Cadastre a chave PIX antes de sacar.
                </Text>
                <Button
                  onPress={() => {
                    setIsInfoOpen(false);
                    router.navigate("/settings/organization/profile");
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cadastrar chave PIX
                </Button>
              </View>
            )}

            {balance === undefined ? null : (
              <View className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text color="muted" variant="description">
                    Mínimo de saque
                  </Text>
                  <Text size="sm" weight="medium">
                    {formatCurrencyCents(balance.minWithdrawCents)}
                  </Text>
                </View>
                {buildWithdrawFeeLines(balance).map((line) => (
                  <View
                    className="flex-row items-center justify-between"
                    key={line.label}
                  >
                    <Text color="muted" variant="description">
                      {line.label}
                    </Text>
                    <Text size="sm" weight="medium">
                      {line.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Page>
  );
}
