import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Button,
  Description,
  FieldError,
  Input,
  InputOTP,
  Label,
  LinkButton,
  REGEXP_ONLY_DIGITS,
  TextField,
  useToast,
} from "heroui-native";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/convex/auth-client";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { maskEmail } from "@/lib/format/email";
import { formatSecondsAsMMSS } from "@/lib/format/time";
import { useOtpCooldown } from "@/lib/hooks/use-otp-cooldown";

const OTP_RESET_TIMESTAMP_KEY = "otp-password-reset-timestamp";

const EmailSchema = z.object({
  email: z.email("Informe um e-mail válido."),
});

const PasswordSchema = z
  .object({
    password: z
      .string("Informe uma senha válida.")
      .min(8, "Sua senha deve ter no mínimo 8 caracteres."),
    confirmPassword: z
      .string("As senhas não conferem.")
      .min(1, "Confirme sua senha."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

type Step = "email" | "code" | "password";

export default function ForgotPassword() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [emailValue, setEmailValue] = useState("");
  const [code, setCode] = useState("");
  const { cooldown, startCooldown, clearCooldown } = useOtpCooldown(
    OTP_RESET_TIMESTAMP_KEY
  );

  const emailForm = useForm({
    defaultValues: { email: "" },
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(EmailSchema),
  });

  const passwordForm = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(PasswordSchema),
  });

  const sendOtp = useMutation({
    mutationFn: async (targetEmail: string) => {
      const { error } = await authClient.emailOtp.requestPasswordReset({
        email: targetEmail,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      await startCooldown();
      setStep("code");
      toast.show({
        description: "Confira sua caixa de entrada e a pasta de spam.",
        id: "forgot-password-otp-sent",
        label: "Código enviado",
        variant: "success",
      });
    },
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível enviar o código. Tente novamente."
        ),
        id: "forgot-password-otp-error",
        label: "Falha no envio",
        variant: "danger",
      });
    },
  });

  const resendOtp = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.emailOtp.requestPasswordReset({
        email: emailValue,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => startCooldown(),
  });

  const verifyOtp = useMutation({
    mutationFn: async (otp: string) => {
      const { error } = await authClient.emailOtp.checkVerificationOtp({
        email: emailValue,
        otp,
        type: "forget-password",
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      setStep("password");
    },
    onError: (error) => {
      setCode("");
      toast.show({
        description: getToastErrorMessage(
          error,
          "Código inválido ou expirado. Tente novamente."
        ),
        id: "forgot-password-verify-error",
        label: "Código inválido",
        variant: "danger",
      });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (input: { password: string }) => {
      const { error } = await authClient.emailOtp.resetPassword({
        email: emailValue,
        otp: code,
        password: input.password,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      await clearCooldown();
      toast.show({
        description: "Sua senha foi redefinida. Faça login com a nova senha.",
        id: "forgot-password-success",
        label: "Senha redefinida",
        variant: "success",
      });
      router.back();
    },
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível redefinir a senha. Tente novamente."
        ),
        id: "forgot-password-error",
        label: "Falha na redefinição",
        variant: "danger",
      });
    },
  });

  const isPending =
    sendOtp.isPending ||
    resendOtp.isPending ||
    verifyOtp.isPending ||
    resetPassword.isPending;

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton
            onPress={() => {
              if (step === "code") {
                setStep("email");
                setCode("");
              } else if (step === "password") {
                setStep("code");
                setCode("");
                passwordForm.reset();
              } else {
                router.back();
              }
            }}
          />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>
            {step === "email"
              ? "Redefinir sua senha"
              : step === "code"
                ? "Código de verificação"
                : "Crie a sua nova senha"}
          </Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-5 items-center justify-center px-4">
        {step === "email" && (
          <View className="w-full gap-3">
            <View className="mb-3 px-1">
              <Label>Esqueceu sua senha?</Label>
              <Description>
                Digite o endereço de e-mail associado à sua conta e enviaremos
                um código para você redefinir sua senha.
              </Description>
            </View>

            <Controller
              control={emailForm.control}
              name="email"
              render={({ field, fieldState }) => (
                <TextField
                  className="w-full"
                  isInvalid={Boolean(fieldState.error)}
                  isRequired
                >
                  <Label>E-mail</Label>
                  <Input
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!isPending}
                    keyboardType="email-address"
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    onSubmitEditing={emailForm.handleSubmit((values) => {
                      setEmailValue(values.email);
                      sendOtp.mutate(values.email);
                    })}
                    placeholder="voce@email.com"
                    returnKeyType="done"
                    textContentType="emailAddress"
                    value={field.value ?? ""}
                  />
                  <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                </TextField>
              )}
            />

            <Button
              className="mt-2 w-full"
              isDisabled={isPending || !emailForm.formState.isValid}
              onPress={emailForm.handleSubmit((values) => {
                setEmailValue(values.email);
                sendOtp.mutate(values.email);
              })}
              variant="primary"
            >
              <Button.Label>Continuar</Button.Label>
            </Button>
          </View>
        )}

        {step === "code" && (
          <View>
            <View className="mb-3 px-1">
              <Label>Verifique seu e-mail</Label>
              <Description>{`Enviamos um código para ${maskEmail(emailValue)}`}</Description>
            </View>
            <InputOTP
              isDisabled={isPending}
              maxLength={6}
              onChange={setCode}
              onComplete={(otp) => verifyOtp.mutate(otp)}
              pattern={REGEXP_ONLY_DIGITS}
              value={code}
            >
              <InputOTP.Group>
                <InputOTP.Slot index={0} />
                <InputOTP.Slot index={1} />
                <InputOTP.Slot index={2} />
              </InputOTP.Group>
              <InputOTP.Separator />
              <InputOTP.Group>
                <InputOTP.Slot index={3} />
                <InputOTP.Slot index={4} />
                <InputOTP.Slot index={5} />
              </InputOTP.Group>
            </InputOTP>
            <View className="mt-2 flex-row flex-wrap items-center gap-1 px-1">
              <Description>Não recebeu o código?</Description>
              <LinkButton
                isDisabled={cooldown > 0 || resendOtp.isPending}
                onPress={() => resendOtp.mutate()}
                size="sm"
              >
                Reenviar código
              </LinkButton>
              {cooldown > 0 ? (
                <Text className="ml-2 text-warning" variant="description">
                  {formatSecondsAsMMSS(cooldown)}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {step === "password" && (
          <>
            <Controller
              control={passwordForm.control}
              name="password"
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
                  />
                  <FieldError>{fieldState.error?.message ?? ""}</FieldError>
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
                  />
                  <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                </TextField>
              )}
            />

            <Button
              className="w-full"
              isDisabled={isPending || !passwordForm.formState.isValid}
              onPress={passwordForm.handleSubmit((values) =>
                resetPassword.mutate({ password: values.password })
              )}
              variant="primary"
            >
              <Button.Label>
                {resetPassword.isPending ? "Redefinindo..." : "Redefinir senha"}
              </Button.Label>
            </Button>
          </>
        )}
      </Page.ScrollView>
    </Page>
  );
}
