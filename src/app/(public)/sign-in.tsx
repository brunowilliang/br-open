import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
import { ScrollView, View } from "react-native";
import { z } from "zod";

import { Image, LogoImage } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { useSignInMutationOptions } from "@/lib/convex/auth-client";
import { getToastErrorMessage } from "@/lib/errors/toast-message";

const SignInFormSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z
    .string("Informe uma senha válida")
    .min(6, "Sua senha deve ter no mínimo 6 caracteres"),
});

export default function SignIn() {
  const router = useRouter();
  const { toast } = useToast();

  const signIn = useMutation(
    useSignInMutationOptions({
      onSuccess: () => router.replace("/"),
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível autenticar."
          ),
          id: "sign-in-auth-error",
          label: "Não foi possível entrar",
          variant: "danger",
        });
      },
    })
  );

  const form = useForm({
    defaultValues: {
      email: "bruno@bruno.com",
      password: "123123123",
    },
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(SignInFormSchema),
  });

  const isSubmitPending = signIn.isPending || form.formState.isSubmitting;
  const submitForm = form.handleSubmit(async (values) => {
    signIn.reset();

    await signIn.mutateAsync({
      email: values.email,
      password: values.password,
      rememberMe: true,
    });
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  function handleSocialPress() {
    signIn.reset();
    toast.show({
      description: "Login social ainda precisa dos providers no Better Auth.",
      id: "sign-in-social-error",
      label: "Login social indisponível",
      variant: "warning",
    });
  }

  return (
    <ScrollView
      className="bg-background"
      contentContainerClassName="grow gap-5 items-center justify-center px-4"
    >
      <View className="w-full items-center">
        <Image.Background
          className="aspect-square size-25"
          source={LogoImage}
        />
        <Text variant="title">Faça seu Login</Text>
      </View>

      <View className="w-full gap-2">
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
              <Input
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!isSubmitPending}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                onSubmitEditing={handleSubmitPress}
                placeholder="Sua senha"
                returnKeyType="done"
                secureTextEntry
                textContentType="password"
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
          {isSubmitPending ? "Entrando..." : "Entrar"}
        </Button.Label>
      </Button>

      <View className="mx-15 flex-row items-center gap-3">
        <Separator className="flex-1" />
        <Text className="text-muted text-sm">ou</Text>
        <Separator className="flex-1" />
      </View>

      <View className="flex-row gap-3">
        <SocialAuthButton
          className="flex-1"
          isDisabled={isSubmitPending}
          onPress={handleSocialPress}
          provider="apple"
        />
        <SocialAuthButton
          className="flex-1"
          isDisabled={isSubmitPending}
          onPress={handleSocialPress}
          provider="google"
        />
      </View>

      <Button
        className="w-full"
        isDisabled={isSubmitPending}
        onPress={() => router.navigate("/sign-up")}
        variant="ghost"
      >
        <Button.Label>Criar conta</Button.Label>
      </Button>
    </ScrollView>
  );
}
