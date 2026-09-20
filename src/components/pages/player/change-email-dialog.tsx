import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Text } from "@/components/core/text";
import {
  getSecurityErrorMessage,
  isSessionNotFreshError,
} from "@/lib/account/security-errors";
import {
  authClient,
  useSignOutMutationOptions,
} from "@/lib/convex/auth-client";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { maskEmail } from "@/lib/format/email";
import { formatSecondsAsMMSS } from "@/lib/format/time";
import { useOtpCooldown } from "@/lib/hooks/use-otp-cooldown";
import {
  Button,
  Dialog,
  FieldError,
  Input,
  InputOTP,
  Label,
  LinkButton,
  REGEXP_ONLY_DIGITS,
  TextField,
  useToast,
} from "heroui-native";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Keyboard, Pressable, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { z } from "zod";

const NEW_EMAIL_OTP_KEY = "otp-change-email-new-timestamp";
const OTP_COOLDOWN_SECONDS = 60;

const NewEmailSchema = z.object({
  newEmail: z.email("Informe um e-mail válido."),
});

type ChangeEmailStep = "new-email" | "new-code";

type ChangeEmailDialogProps = {
  currentEmail: string;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

/**
 * Fluxo de troca de e-mail (single-OTP, QA round 8 — `verifyCurrentEmail:
 * false`): 1. novo e-mail → `requestEmailChange({newEmail})` envia o código
 * OTP ao e-mail NOVO (prova de posse única; anti-enumeração nativa); 2.
 * código do e-mail novo → `changeEmail({newEmail, otp})` — o submit É a
 * validação (não existe pre-check consumível; erro não consome o código, 3
 * erros = TOO_MANY_ATTEMPTS). Reenvio chama `requestEmailChange` de novo
 * (código novo invalida o anterior; mesmo balde de cooldown 60s).
 */
export function ChangeEmailDialog(props: ChangeEmailDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ChangeEmailStep>("new-email");
  const [newCode, setNewCode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { refetch: refetchSession } = authClient.useSession();
  const newEmailCooldown = useOtpCooldown(
    NEW_EMAIL_OTP_KEY,
    OTP_COOLDOWN_SECONDS
  );
  const signOut = useMutation(
    useSignOutMutationOptions({
      onError: (error) => {
        toast.show({
          description: getSecurityErrorMessage(
            error,
            "Não conseguimos encerrar sua sessão. Tente novamente."
          ),
          id: "change-email-sign-out-error",
          label: "Não foi possível sair",
          variant: "danger",
        });
      },
    })
  );

  const newEmailForm = useForm({
    defaultValues: { newEmail: "" },
    mode: "onBlur",
    resolver: zodResolver(NewEmailSchema),
    reValidateMode: "onChange",
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset controlado pela abertura; handlers recriados a cada render
  useEffect(() => {
    if (!props.isOpen) {
      setStep("new-email");
      setNewCode("");
      setNewEmail("");
      newEmailForm.reset({ newEmail: "" });
    }
  }, [props.isOpen]);

  async function sendNewEmailCode(email: string) {
    try {
      const { error } = await authClient.emailOtp.requestEmailChange({
        newEmail: email,
      });

      if (error) {
        throw error;
      }
    } finally {
      // qualquer tentativa consome o bucket de rate limit (3 req/60s):
      // cooldown também na falha, senão o reenvio fica martelável após 429
      await newEmailCooldown.startCooldown();
    }
  }

  function handleSessionNotFresh() {
    props.onOpenChange(false);
    toast.show({
      description: "Por segurança, entre novamente para alterar seu e-mail.",
      id: "change-email-session-not-fresh",
      label: "Entre novamente",
      variant: "warning",
    });
    signOut.mutate();
  }

  async function handleNewEmailSubmit(values: { newEmail: string }) {
    setIsPending(true);

    try {
      await sendNewEmailCode(values.newEmail);
      setNewEmail(values.newEmail);
      setStep("new-code");
      toast.show({
        description:
          "Enviamos um código para o novo e-mail. Confira também o spam.",
        id: "change-email-new-code-sent",
        label: "Código enviado",
        variant: "success",
      });
    } catch (error) {
      if (isSessionNotFreshError(error)) {
        handleSessionNotFresh();
        return;
      }

      toast.show({
        description: getSecurityErrorMessage(
          error,
          "Não foi possível enviar o código para o novo e-mail. Tente novamente."
        ),
        id: "change-email-request-error",
        label: "Falha no envio",
        variant: "danger",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function handleNewCodeSubmit(otp: string) {
    setIsPending(true);

    try {
      const { error } = await authClient.emailOtp.changeEmail({
        newEmail,
        otp,
      });

      if (error) {
        throw error;
      }

      await refetchSession();
      props.onOpenChange(false);
      toast.show({
        description: `Seu e-mail agora é ${newEmail}.`,
        id: "change-email-success",
        label: "E-mail alterado",
        variant: "success",
      });
    } catch (error) {
      if (isSessionNotFreshError(error)) {
        handleSessionNotFresh();
        return;
      }

      setNewCode("");
      toast.show({
        description: getSecurityErrorMessage(
          error,
          "Não foi possível confirmar a troca. Tente novamente."
        ),
        id: "change-email-confirm-error",
        label: "Falha na confirmação",
        variant: "danger",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      isOpen={props.isOpen}
      onOpenChange={(nextOpen) => {
        if (isPending) {
          return;
        }

        props.onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <KeyboardAvoidingView behavior="padding">
          <Dialog.Content className="p-5">
            {isPending ? null : (
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
            )}
            {/* GOTCHA: em RN, position:absolute ancora no PAI DIRETO (não no
                ancestral posicionado como no CSS) — o DialogCloseButton absolute
                fica filho direto do Dialog.Content (padrão das referências),
                FORA deste wrapper. O Pressable só dismissa o teclado; toques
                em inputs/botões filhos vencem o responder. */}
            <Pressable className="gap-4" onPress={Keyboard.dismiss}>
              <Dialog.Title>Alterar e-mail</Dialog.Title>

              {step === "new-email" ? (
                <>
                  <Text color="muted" variant="description">
                    Qual é o novo e-mail? Vamos enviar um código para ele antes
                    de concluir a troca.
                  </Text>
                  <Controller
                    control={newEmailForm.control}
                    name="newEmail"
                    render={({ field, fieldState }) => (
                      <TextField
                        className="w-full"
                        isInvalid={Boolean(fieldState.error)}
                        isRequired
                      >
                        <Label>Novo e-mail</Label>
                        <Input
                          autoCapitalize="none"
                          autoComplete="email"
                          editable={!isPending}
                          keyboardType="email-address"
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          onSubmitEditing={Keyboard.dismiss}
                          placeholder="novo@email.com"
                          returnKeyType="done"
                          textContentType="emailAddress"
                          value={field.value ?? ""}
                          variant="secondary"
                        />
                        <FieldError>
                          {fieldState.error?.message ?? ""}
                        </FieldError>
                      </TextField>
                    )}
                  />

                  <Button
                    className="w-full"
                    isDisabled={
                      isPending ||
                      !newEmailForm.formState.isValid ||
                      newEmailCooldown.cooldown > 0
                    }
                    onPress={newEmailForm.handleSubmit((values) => {
                      handleNewEmailSubmit(values).catch(() => undefined);
                    })}
                  >
                    <Button.Label>
                      {isPending
                        ? "Enviando..."
                        : "Enviar código para o novo e-mail"}
                    </Button.Label>
                  </Button>
                  {newEmailCooldown.cooldown > 0 ? (
                    <Text
                      className="self-center"
                      color="warning"
                      variant="description"
                    >
                      {formatSecondsAsMMSS(newEmailCooldown.cooldown)}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {step === "new-code" ? (
                <>
                  <Text color="muted" variant="description">
                    Digite o código que enviamos para {maskEmail(newEmail)} para
                    concluir a troca.
                  </Text>
                  <InputOTP
                    className="self-center"
                    isDisabled={isPending}
                    maxLength={6}
                    onChange={setNewCode}
                    onComplete={(otp) => {
                      if (isPending) {
                        return;
                      }

                      handleNewCodeSubmit(otp).catch(() => undefined);
                    }}
                    pattern={REGEXP_ONLY_DIGITS}
                    value={newCode}
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
                      isDisabled={newEmailCooldown.cooldown > 0 || isPending}
                      onPress={() => {
                        sendNewEmailCode(newEmail).catch((error) => {
                          if (isSessionNotFreshError(error)) {
                            handleSessionNotFresh();
                            return;
                          }

                          toast.show({
                            description: getSecurityErrorMessage(
                              error,
                              "Não foi possível enviar o código. Tente novamente."
                            ),
                            id: "change-email-resend-error",
                            label: "Falha no envio",
                            variant: "danger",
                          });
                        });
                      }}
                      size="sm"
                    >
                      Reenviar código
                    </LinkButton>
                    {newEmailCooldown.cooldown > 0 ? (
                      <Text color="warning" variant="description">
                        {formatSecondsAsMMSS(newEmailCooldown.cooldown)}
                      </Text>
                    ) : null}
                  </View>

                  <Button
                    className="w-full"
                    isDisabled={newCode.length !== 6 || isPending}
                    onPress={() => {
                      handleNewCodeSubmit(newCode).catch(() => undefined);
                    }}
                  >
                    <Button.Label>
                      {isPending ? "Confirmando..." : "Confirmar troca"}
                    </Button.Label>
                  </Button>
                </>
              ) : null}
            </Pressable>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
