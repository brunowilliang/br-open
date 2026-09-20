import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { PasswordInput } from "@/components/ui/password-input";
import { Text } from "@/components/core/text";
import { shouldSendOtpOnOpen } from "@/lib/account/otp-open-send";
import {
  getSecurityErrorMessage,
  isSessionNotFreshError,
} from "@/lib/account/security-errors";
import {
  authClient,
  useSignOutMutationOptions,
} from "@/lib/convex/auth-client";
import { maskEmail } from "@/lib/format/email";
import { formatSecondsAsMMSS } from "@/lib/format/time";
import { useOtpCooldown } from "@/lib/hooks/use-otp-cooldown";
import {
  Button,
  Dialog,
  FieldError,
  InputOTP,
  Label,
  LinkButton,
  REGEXP_ONLY_DIGITS,
  TextField,
  useToast,
} from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Keyboard, Pressable, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { z } from "zod";
import * as SecureStore from "expo-secure-store";

const FORGOT_PASSWORD_OTP_KEY = "otp-forgot-password-timestamp";
const OTP_COOLDOWN_SECONDS = 60;

const NewPasswordSchema = z
  .object({
    confirmPassword: z
      .string("As senhas não conferem.")
      .min(1, "Confirme sua senha."),
    newPassword: z
      .string("Informe uma senha válida.")
      .min(8, "Sua nova senha deve ter no mínimo 8 caracteres.")
      .max(128, "Sua nova senha deve ter no máximo 128 caracteres."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

type NewPasswordValues = z.input<typeof NewPasswordSchema>;

const defaultValues: NewPasswordValues = {
  confirmPassword: "",
  newPassword: "",
};

type ForgotPasswordStep = "code" | "new-password";

type ForgotPasswordDialogProps = {
  currentEmail: string;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

/**
 * "Esqueci minha senha" LOGADO (sem sair da sessão):
 * 1. código OTP `forget-password` para o e-mail ATUAL
 *    (`requestPasswordReset` — anti-enumeração nativa);
 * 2. gate de UX `checkVerificationOtp` (não consome o código);
 * 3. `resetPassword` consome o OTP e troca o hash (8–128);
 * 4. `revokeOtherSessions` SEMPRE — se falhar, a senha já foi trocada
 *    (aviso, sem rollback); `SESSION_NOT_FRESH` aqui → sign-out guiado.
 *
 * A sessão atual é mantida em todos os passos (usuário continua logado).
 */
export function ForgotPasswordDialog(props: ForgotPasswordDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ForgotPasswordStep>("code");
  const [code, setCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const cooldown = useOtpCooldown(
    FORGOT_PASSWORD_OTP_KEY,
    OTP_COOLDOWN_SECONDS
  );
  const hasSentOnOpenRef = useRef(false);
  const signOut = useMutation(
    useSignOutMutationOptions({
      onError: (error) => {
        toast.show({
          description: getSecurityErrorMessage(
            error,
            "Não conseguimos encerrar sua sessão. Tente novamente."
          ),
          id: "forgot-password-sign-out-error",
          label: "Não foi possível sair",
          variant: "danger",
        });
      },
    })
  );

  const passwordForm = useForm({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(NewPasswordSchema),
    reValidateMode: "onChange",
  });

  async function sendPasswordResetOtp() {
    try {
      const { error } = await authClient.emailOtp.requestPasswordReset({
        email: props.currentEmail,
      });

      if (error) {
        throw error;
      }
    } finally {
      // qualquer tentativa consome o bucket de rate limit (3 req/60s):
      // cooldown também na falha, senão o reenvio fica martelável após 429
      await cooldown.startCooldown();
    }
  }

  /** Abertura e reenvio compartilham o balde de cooldown: com cooldown
   * ativo o código anterior ainda é válido — não empilha envio (o timer
   * já está correndo no bloco de reenvio). */
  async function sendOtpOnOpen() {
    const persistedAt = await SecureStore.getItemAsync(FORGOT_PASSWORD_OTP_KEY);

    if (!shouldSendOtpOnOpen(OTP_COOLDOWN_SECONDS, persistedAt)) {
      return;
    }

    await sendPasswordResetOtp();
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: dispara uma vez por abertura; handlers recriados a cada render
  useEffect(() => {
    if (!props.isOpen) {
      hasSentOnOpenRef.current = false;
      setStep("code");
      setCode("");
      passwordForm.reset(defaultValues);
      return;
    }

    if (hasSentOnOpenRef.current) {
      return;
    }

    hasSentOnOpenRef.current = true;
    sendOtpOnOpen().catch((error) => {
      toast.show({
        description: getSecurityErrorMessage(
          error,
          "Não foi possível enviar o código. Tente novamente."
        ),
        id: "forgot-password-send-error",
        label: "Falha no envio",
        variant: "danger",
      });
    });
  }, [props.isOpen]);

  async function handleCodeComplete(otp: string) {
    setIsPending(true);

    try {
      // gate de UX: valida sem consumir o código (o consumo é no resetPassword)
      const { error } = await authClient.emailOtp.checkVerificationOtp({
        email: props.currentEmail,
        otp,
        type: "forget-password",
      });

      if (error) {
        throw error;
      }

      setStep("new-password");
    } catch (error) {
      setCode("");
      toast.show({
        description: getSecurityErrorMessage(
          error,
          "Não foi possível verificar o código. Tente novamente."
        ),
        id: "forgot-password-verify-error",
        label: "Código inválido",
        variant: "danger",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function handleRevokeOtherSessions(): Promise<
    "revoked" | "sign-out" | "warned"
  > {
    try {
      await authClient.revokeOtherSessions();
      return "revoked";
    } catch (error) {
      // senha já foi trocada (passo 3 consumiu o OTP) — sem rollback.
      if (isSessionNotFreshError(error)) {
        toast.show({
          description:
            "Senha alterada. Por segurança, entre novamente para desconectar outros dispositivos.",
          id: "forgot-password-session-not-fresh",
          label: "Entre novamente",
          variant: "warning",
        });
        signOut.mutate();
        return "sign-out";
      }

      toast.show({
        description:
          "Senha alterada, mas não desconectamos outros dispositivos. Verifique depois nas configurações.",
        id: "forgot-password-revoke-warning",
        label: "Atenção",
        variant: "warning",
      });
      return "warned";
    }
  }

  async function handlePasswordSubmit(values: NewPasswordValues) {
    setIsPending(true);

    try {
      const { error } = await authClient.emailOtp.resetPassword({
        email: props.currentEmail,
        otp: code,
        password: values.newPassword,
      });

      if (error) {
        throw error;
      }

      const revokeOutcome = await handleRevokeOtherSessions();
      props.onOpenChange(false);

      if (revokeOutcome === "revoked") {
        toast.show({
          description:
            "Sua senha foi alterada e outros dispositivos foram desconectados.",
          id: "forgot-password-success",
          label: "Senha alterada",
          variant: "success",
        });
      }
    } catch (error) {
      toast.show({
        description: getSecurityErrorMessage(
          error,
          "Não foi possível redefinir sua senha. Tente novamente."
        ),
        id: "forgot-password-reset-error",
        label: "Falha ao redefinir",
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
              <Dialog.Title>Redefinir senha</Dialog.Title>
              {step === "code" ? (
                <>
                  <Text color="muted" variant="description">
                    Enviamos um código para {maskEmail(props.currentEmail)}.
                    Digite para confirmar que é você.
                  </Text>
                  <InputOTP
                    className="self-center"
                    isDisabled={isPending}
                    maxLength={6}
                    onChange={setCode}
                    onComplete={(otp) => {
                      if (isPending) {
                        return;
                      }

                      handleCodeComplete(otp).catch(() => undefined);
                    }}
                    pattern={REGEXP_ONLY_DIGITS}
                    value={code}
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
                      isDisabled={cooldown.cooldown > 0 || isPending}
                      onPress={() => {
                        sendPasswordResetOtp().catch((error) => {
                          toast.show({
                            description: getSecurityErrorMessage(
                              error,
                              "Não foi possível enviar o código. Tente novamente."
                            ),
                            id: "forgot-password-resend-error",
                            label: "Falha no envio",
                            variant: "danger",
                          });
                        });
                      }}
                      size="sm"
                    >
                      Reenviar código
                    </LinkButton>
                    {cooldown.cooldown > 0 ? (
                      <Text color="warning" variant="description">
                        {formatSecondsAsMMSS(cooldown.cooldown)}
                      </Text>
                    ) : null}
                  </View>

                  <Button
                    className="w-full"
                    isDisabled={code.length !== 6 || isPending}
                    onPress={() => {
                      handleCodeComplete(code).catch(() => undefined);
                    }}
                  >
                    <Button.Label>
                      {isPending ? "Verificando..." : "Continuar"}
                    </Button.Label>
                  </Button>
                </>
              ) : null}

              {step === "new-password" ? (
                <>
                  <Text color="muted" variant="description">
                    Escolha a nova senha da sua conta. Você continua logado
                    neste dispositivo; outros dispositivos serão desconectados.
                  </Text>
                  <Controller
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field, fieldState }) => (
                      <TextField
                        className="w-full"
                        isInvalid={Boolean(fieldState.error)}
                        isRequired
                      >
                        <Label>Nova senha</Label>
                        <PasswordInput
                          autoCapitalize="none"
                          autoComplete="new-password"
                          editable={!isPending}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          placeholder="Crie uma nova senha"
                          returnKeyType="next"
                          textContentType="newPassword"
                          value={field.value ?? ""}
                          variant="secondary"
                        />
                        <FieldError>
                          {fieldState.error?.message ?? ""}
                        </FieldError>
                      </TextField>
                    )}
                  />

                  <Controller
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field, fieldState }) => (
                      <TextField
                        className="w-full"
                        isInvalid={Boolean(fieldState.error)}
                        isRequired
                      >
                        <Label>Repetir nova senha</Label>
                        <PasswordInput
                          autoCapitalize="none"
                          autoComplete="new-password"
                          editable={!isPending}
                          onBlur={field.onBlur}
                          onChangeText={field.onChange}
                          placeholder="Repita a nova senha"
                          returnKeyType="done"
                          textContentType="newPassword"
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
                    isDisabled={isPending || !passwordForm.formState.isValid}
                    onPress={passwordForm.handleSubmit((values) => {
                      handlePasswordSubmit(values).catch(() => undefined);
                    })}
                  >
                    <Button.Label>
                      {isPending ? "Redefinindo..." : "Redefinir senha"}
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
