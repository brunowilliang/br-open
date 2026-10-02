import { Alert02Icon } from "@hugeicons/core-free-icons";
import {
  Button,
  Chip,
  Dialog,
  InputOTP,
  LinkButton,
  REGEXP_ONLY_DIGITS,
  Surface,
} from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Text } from "@/components/core/text";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { ErrorMessage } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollShadow } from "@/components/ui/scroll-shadow";
import type { WidgetAlertDescriptionLine } from "@/components/ui/widget-alert";
import { maskEmail } from "@/lib/format/email";
import { formatSecondsAsMMSS } from "@/lib/format/time";

export type DeleteAccountStep = "code" | "gate" | "risks";

const DELETE_ACCOUNT_RISKS = [
  "Seu perfil e seus dados saem do app e não voltam.",
  "Torneios que você organiza precisam ser concluídos ou passados para outra pessoa.",
  "Valores a recolher de torneios que você organizou precisam ser regularizados.",
  "Inscrições e partidas em andamento são encerradas e saem do seu histórico.",
  "Seu histórico de partidas sai do seu perfil. Os adversários mantêm os resultados deles.",
  "Sua posição nas classificações e no ranking some com a conta.",
  "Convites e propostas de duplas pendentes são cancelados.",
  "Você sai das listas de espera e deixa de receber convites e notificações.",
] as const;

const NOTICE_FADE_DURATION = 180;

/** O fade do ScrollShadow é pintado com zIndex 10; o aviso precisa de z
 * maior e elevation para ficar na frente dele também no Android. */
const styles = StyleSheet.create({
  notice: { elevation: 20, zIndex: 20 },
});

/** O contrato pode mandar trechos com destaque; o card desenha texto puro. */
function formatAlertDescription(
  description: string | WidgetAlertDescriptionLine[]
): string {
  if (typeof description === "string") {
    return description;
  }

  return description
    .map((line) => line.parts.map((part) => part.text).join(""))
    .join(" ");
}

/** Molde do card Deletar torneio (superfície danger-soft, Alert02Icon, textos
 * em danger) com a ação do lado, como as pendências. Surface estática e sem
 * layout transition de propósito: o card não pode animar de entrada na tela. */
export function DangerSoftActionCard(props: {
  actionLabel?: string;
  description: string | WidgetAlertDescriptionLine[];
  onPress?: () => void;
  title: string;
}) {
  return (
    <Surface
      animation="disable-all"
      className="gap-3 border border-danger-soft bg-danger-soft"
    >
      <View className="flex-col items-center gap-1">
        <View className="flex-row items-center gap-2">
          <HugeIcons className="text-danger" icon={Alert02Icon} />
          <Text className="flex-1" color="danger" weight="medium">
            {props.title}
          </Text>
        </View>
        <Text color="danger" variant="description">
          {formatAlertDescription(props.description)}
        </Text>
      </View>
      {props.actionLabel && props.onPress ? (
        <Button
          className="self-end"
          onPress={props.onPress}
          size="sm"
          variant="danger"
        >
          <Button.Label>{props.actionLabel}</Button.Label>
        </Button>
      ) : null}
    </Surface>
  );
}

/** Passo 2: os riscos, com o botão travado até a rolagem chegar ao fim. */
export function DeleteRisksDialog(props: {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const noticeOpacity = useSharedValue(1);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [isNoticeGone, setIsNoticeGone] = useState(false);

  // Conteúdo que cabe inteiro não tem fim para rolar: libera direto.
  function revealEndIfContentFits() {
    if (
      contentHeightRef.current > 0 &&
      viewportHeightRef.current > 0 &&
      contentHeightRef.current <= viewportHeightRef.current + 1
    ) {
      setHasReachedEnd(true);
    }
  }

  // Reabrir sempre começa do topo e com o botão travado de novo.
  useEffect(() => {
    if (!props.isOpen) {
      return;
    }
    setHasReachedEnd(false);
    setIsNoticeGone(false);
    noticeOpacity.value = 1;
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [props.isOpen, noticeOpacity]);

  // O Portal do Dialog monta em overlay de janela: layout transition e exiting
  // do Reanimated não rodam aí. O aviso é overlay absoluto (sem reflow) e sai
  // com fade imperativo; o nó só desmonta quando a animação acaba.
  useEffect(() => {
    if (!hasReachedEnd) {
      return;
    }
    noticeOpacity.value = withTiming(
      0,
      { duration: NOTICE_FADE_DURATION },
      (finished) => {
        if (finished) {
          scheduleOnRN(setIsNoticeGone, true);
        }
      }
    );
  }, [hasReachedEnd, noticeOpacity]);

  const noticeStyle = useAnimatedStyle(() => ({
    opacity: noticeOpacity.value,
  }));

  // O ScrollShadow compõe o onScroll do filho como worklet: o fim do scroll
  // precisa voltar pra JS thread via scheduleOnRN.
  const handleScroll = useAnimatedScrollHandler((event) => {
    const reached =
      event.contentOffset.y + event.layoutMeasurement.height >=
      event.contentSize.height - 8;
    if (reached) {
      scheduleOnRN(setHasReachedEnd, true);
    }
  });

  return (
    <Dialog
      isOpen={props.isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          props.onCancel();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          <DialogCloseButton className="absolute top-4 right-4 z-100" />
          <Dialog.Title>Apagar conta</Dialog.Title>

          <View className="relative">
            <ScrollShadow className="h-fit max-h-80" color="surface" size={90}>
              <ScrollView
                onContentSizeChange={(_width, height) => {
                  contentHeightRef.current = height;
                  revealEndIfContentFits();
                }}
                onLayout={(event) => {
                  viewportHeightRef.current = event.nativeEvent.layout.height;
                  revealEndIfContentFits();
                }}
                onScroll={handleScroll}
                ref={scrollRef}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
              >
                <View className="gap-3">
                  <Text color="muted" variant="description">
                    Apagar a conta é permanente. Antes de continuar, veja o que
                    acontece com o que é seu:
                  </Text>
                  {DELETE_ACCOUNT_RISKS.map((risk) => (
                    <View className="flex-row gap-2" key={risk}>
                      <Text color="muted" variant="description">
                        •
                      </Text>
                      <Text
                        className="flex-1"
                        color="muted"
                        variant="description"
                      >
                        {risk}
                      </Text>
                    </View>
                  ))}
                  <Text color="muted" variant="description">
                    Depois de apagar, você sai do app e não consegue mais entrar
                    com este login. A conta não pode ser recuperada.
                  </Text>
                </View>
              </ScrollView>
            </ScrollShadow>

            {isNoticeGone ? null : (
              <Animated.View
                className="absolute right-0 -bottom-3.5 left-0"
                pointerEvents="none"
                style={[noticeStyle, styles.notice]}
              >
                <Chip className="self-center" color="default" size="sm">
                  <Chip.Label className="text-muted">
                    Role até o fim para continuar
                  </Chip.Label>
                </Chip>
              </Animated.View>
            )}
          </View>

          <View className="flex-row gap-2 self-end pt-1.5">
            <Button onPress={props.onCancel} size="sm" variant="secondary">
              <Button.Label>Cancelar</Button.Label>
            </Button>
            <Button
              isDisabled={!hasReachedEnd}
              onPress={props.onConfirm}
              size="sm"
              variant="danger"
            >
              <Button.Label>Apagar conta</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

/** Passo 3: a régua; bloqueios e resoluções chegam prontos de quem monta o
 * fluxo e o Atualizar recheca o status. */
export type DeleteGateBlocker = {
  actionLabel?: string;
  description: string | WidgetAlertDescriptionLine[];
  onPress?: () => void;
  title: string;
};

export function DeleteGateDialog(props: {
  blockers: DeleteGateBlocker[];
  canDelete: boolean;
  isError: boolean;
  isLoading: boolean;
  isOpen: boolean;
  isRefreshing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRefresh: () => void;
  resolutions: string[];
}) {
  return (
    <Dialog
      isOpen={props.isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          props.onCancel();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          <DialogCloseButton className="absolute top-4 right-4 z-100" />
          <Dialog.Title>Apagar conta</Dialog.Title>

          {props.isLoading ? (
            <LoadingState />
          ) : props.isError ? (
            <>
              <ErrorMessage message="Não foi possível verificar seus bloqueios." />
              <View className="self-end">
                <Button
                  isDisabled={props.isRefreshing}
                  onPress={props.onRefresh}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>
                    {props.isRefreshing ? "Atualizando..." : "Atualizar"}
                  </Button.Label>
                </Button>
              </View>
            </>
          ) : props.canDelete ? (
            <>
              <Text color="muted" variant="description">
                Isso remove sua conta e tudo o que é seu, permanentemente.
              </Text>
              <View className="self-end">
                <Button onPress={props.onConfirm} size="sm" variant="danger">
                  <Button.Label>Apagar conta</Button.Label>
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text color="muted" variant="description">
                Antes de apagar, resolva isto:
              </Text>
              <View className="gap-3">
                {props.blockers.map((blocker) => (
                  <DangerSoftActionCard
                    actionLabel={blocker.actionLabel}
                    description={blocker.description}
                    key={blocker.title}
                    onPress={blocker.onPress}
                    title={blocker.title}
                  />
                ))}
              </View>
              {props.resolutions.length > 0 ? (
                <View className="gap-1.5">
                  <Text color="muted" variant="description">
                    Ao excluir, isto acontece automaticamente:
                  </Text>
                  {props.resolutions.map((resolution) => (
                    <View className="flex-row gap-1" key={resolution}>
                      <Text color="muted" variant="description">
                        •
                      </Text>
                      <Text
                        className="flex-1"
                        color="muted"
                        variant="description"
                      >
                        {resolution}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View className="self-end">
                <Button
                  isDisabled={props.isRefreshing}
                  onPress={props.onRefresh}
                  size="sm"
                  variant="secondary"
                >
                  <Button.Label>
                    {props.isRefreshing ? "Atualizando..." : "Atualizar"}
                  </Button.Label>
                </Button>
              </View>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

/** Passo 4: código de 6 dígitos no e-mail, no molde do Alterar e-mail. */
export function DeleteCodeDialog(props: {
  cooldown: number;
  email: string;
  isOpen: boolean;
  isPending: boolean;
  onCancel: () => void;
  onResend: () => void;
  onSubmit: (code: string) => void;
  onValueChange: (code: string) => void;
  value: string;
}) {
  return (
    <Dialog
      isOpen={props.isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          props.onCancel();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <KeyboardAvoidingView behavior="padding">
          <Dialog.Content className="p-5">
            <DialogCloseButton className="absolute top-4 right-4 z-100" />

            <View className="gap-4">
              <View className="gap-2">
                <Dialog.Title>Confirme o código</Dialog.Title>
                <Text color="muted" variant="description">
                  Enviamos um código de 6 dígitos para {maskEmail(props.email)}.
                  Digite para confirmar a exclusão.
                </Text>
              </View>

              <InputOTP
                className="self-center"
                isDisabled={props.isPending}
                maxLength={6}
                onChange={props.onValueChange}
                onComplete={(otp) => {
                  if (props.isPending) {
                    return;
                  }

                  props.onSubmit(otp);
                }}
                pattern={REGEXP_ONLY_DIGITS}
                value={props.value}
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} variant="secondary" />
                  <InputOTP.Slot index={1} variant="secondary" />
                  <InputOTP.Slot index={2} variant="secondary" />
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group>
                  <InputOTP.Slot index={3} variant="secondary" />
                  <InputOTP.Slot index={4} variant="secondary" />
                  <InputOTP.Slot index={5} variant="secondary" />
                </InputOTP.Group>
              </InputOTP>

              <View className="flex-row flex-wrap items-center gap-1 self-center">
                <Text color="muted" variant="description">
                  Não recebeu o código?
                </Text>
                <LinkButton
                  isDisabled={props.cooldown > 0 || props.isPending}
                  onPress={props.onResend}
                  size="sm"
                >
                  Reenviar código
                </LinkButton>
                {props.cooldown > 0 ? (
                  <Text color="warning" variant="description">
                    {formatSecondsAsMMSS(props.cooldown)}
                  </Text>
                ) : null}
              </View>

              <Button
                className="w-full"
                isDisabled={props.value.length !== 6 || props.isPending}
                onPress={() => {
                  props.onSubmit(props.value);
                }}
              >
                <Button.Label>
                  {props.isPending ? "Confirmando..." : "Confirmar exclusão"}
                </Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
