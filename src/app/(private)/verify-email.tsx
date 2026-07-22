import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Description,
  InputOTP,
  Label,
  LinkButton,
  REGEXP_ONLY_DIGITS,
  useToast,
} from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { useOtpCooldown } from "@/lib/hooks/use-otp-cooldown";
import { maskEmail } from "@/lib/format/email";
import { formatSecondsAsMMSS } from "@/lib/format/time";
import { authClient } from "@/lib/convex/auth-client";
import { getToastErrorMessage } from "@/lib/errors/toast-message";

const OTP_SEND_TIMESTAMP_KEY = "otp-send-timestamp";

export default function VerifyEmail() {
  const router = useRouter();
  const { toast } = useToast();
  const { refetch: refetchSession } = authClient.useSession();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const [code, setCode] = useState("");
  const { cooldown, startCooldown, clearCooldown } = useOtpCooldown(
    OTP_SEND_TIMESTAMP_KEY
  );

  const sendOtp = useMutation({
    mutationFn: async () => {
      if (!email) {
        throw new Error("E-mail não encontrado.");
      }
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => startCooldown(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível enviar o código. Tente novamente."
        ),
        id: "verify-email-otp-error",
        label: "Falha no envio",
        variant: "danger",
      });
    },
  });

  const verifyEmail = useMutation({
    mutationFn: async (otp: string) => {
      if (!email) {
        throw new Error("E-mail não encontrado.");
      }
      const { error } = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      await clearCooldown();
      toast.show({
        description: "Seu e-mail foi verificado com sucesso.",
        id: "verify-email-success",
        label: "E-mail verificado",
        variant: "success",
      });
      await refetchSession();
      router.replace("/");
    },
    onError: (error) => {
      setCode("");
      toast.show({
        description: getToastErrorMessage(
          error,
          "Código inválido ou expirado. Tente novamente."
        ),
        id: "verify-email-error",
        label: "Falha na verificação",
        variant: "danger",
      });
    },
  });

  const isPending = sendOtp.isPending || verifyEmail.isPending;

  return (
    <Page>
      <Page.ScrollView contentContainerClassName="centered">
        <View>
          <View className="mb-3 px-1">
            <Label>Verifique sua conta</Label>
            <Description>
              {`Enviamos um código para ${maskEmail(email ?? "")}`}
            </Description>
          </View>
          <InputOTP
            isDisabled={isPending}
            maxLength={6}
            onChange={setCode}
            onComplete={(otp) => verifyEmail.mutate(otp)}
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
              isDisabled={cooldown > 0 || sendOtp.isPending}
              onPress={() => sendOtp.mutate()}
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
      </Page.ScrollView>
    </Page>
  );
}
