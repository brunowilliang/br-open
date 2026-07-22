import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import {
  Button,
  FieldError,
  Input,
  Label,
  Separator,
  TextField,
  useToast,
} from "heroui-native";
import { SocialAuthButton } from "heroui-native-pro";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { Image, LogoImage } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { PasswordInput } from "@/components/ui/password-input";
import {
  authClient,
  useSignUpMutationOptions,
  useSocialAuth,
} from "@/lib/convex/auth-client";
import { getToastErrorMessage } from "@/lib/errors/toast-message";

const SignUpFormSchema = z
  .object({
    email: z.email("Informe um e-mail válido."),
    name: z.string("Informe um nome válido").min(2, "Informe seu nome."),
    password: z
      .string("Informe uma senha válida.")
      .min(8, "Sua senha deve ter no mínimo 8 caracteres."),
    passwordConfirmation: z
      .string("As senhas não conferem.")
      .min(1, "Confirme sua senha."),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "As senhas não conferem.",
    path: ["passwordConfirmation"],
  });

export default function SignUp() {
  const { toast } = useToast();

  const signUp = useMutation(
    useSignUpMutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível criar sua conta. Tente novamente em instantes."
          ),
          id: "sign-up-auth-error",
          label: "Falha no cadastro",
          variant: "danger",
        });
      },
    })
  );

  const socialAuth = useSocialAuth("sign-up");

  const form = useForm({
    defaultValues: {},
    mode: "onBlur",
    resolver: zodResolver(SignUpFormSchema),
    reValidateMode: "onChange",
  });

  const isSubmitPending =
    signUp.isPending || socialAuth.isPending || form.formState.isSubmitting;
  const OTP_SEND_TIMESTAMP_KEY = "otp-send-timestamp";

  const submitForm = form.handleSubmit(async (values) => {
    signUp.reset();

    await signUp.mutateAsync({
      email: values.email,
      name: values.name,
      password: values.password,
    });

    await SecureStore.setItemAsync(
      OTP_SEND_TIMESTAMP_KEY,
      Date.now().toString()
    );

    await authClient.emailOtp.sendVerificationOtp({
      email: values.email,
      type: "email-verification",
    });
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Criar conta</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-5 centered px-4">
        <Image.Background
          className="aspect-square size-20"
          fallback="none"
          source={LogoImage}
        />

        <View className="w-full gap-2">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>Nome</Label>
                <Input
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Seu nome"
                  returnKeyType="next"
                  textContentType="name"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>E-mail</Label>
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isSubmitPending}
                  keyboardType="email-address"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="voce@email.com"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>Senha</Label>
                <PasswordInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Crie uma senha"
                  returnKeyType="next"
                  textContentType="newPassword"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={form.control}
            name="passwordConfirmation"
            render={({ field, fieldState }) => (
              <TextField isInvalid={Boolean(fieldState.error)} isRequired>
                <Label>Confirmar senha</Label>
                <PasswordInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  onSubmitEditing={handleSubmitPress}
                  placeholder="Repita sua senha"
                  returnKeyType="done"
                  textContentType="newPassword"
                  value={field.value ?? ""}
                />
                <FieldError>{fieldState.error?.message ?? ""}</FieldError>
              </TextField>
            )}
          />
        </View>

        <Button
          className="w-full"
          isDisabled={isSubmitPending}
          onPress={handleSubmitPress}
          variant="primary"
        >
          <Button.Label>
            {isSubmitPending ? "Criando..." : "Criar conta"}
          </Button.Label>
        </Button>

        <View className="mx-10 flex-row items-center gap-3">
          <Separator className="flex-1" />
          <Text className="text-muted text-sm">ou</Text>
          <Separator className="flex-1" />
        </View>

        <View className="flex-row gap-3">
          <SocialAuthButton
            className="flex-1"
            isDisabled={isSubmitPending}
            onPress={socialAuth.handleApplePress}
            provider="apple"
          />
          <SocialAuthButton
            className="flex-1"
            isDisabled={isSubmitPending}
            onPress={socialAuth.handleGooglePress}
            provider="google"
          />
        </View>
      </Page.ScrollView>
    </Page>
  );
}
