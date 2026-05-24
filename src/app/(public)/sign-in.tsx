import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
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
import { ScrollView, Text, View } from "react-native";
import { z } from "zod";

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
    <>
      <Stack.Screen options={{ title: "Faça seu login" }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="grow items-center justify-center px-4"
      >
        <View className="w-full items-center gap-2">
          <Text className="text-center font-semibold text-2xl text-foreground">
            BR Open
          </Text>
          <Text className="text-center text-base text-muted">
            Entre para acompanhar torneios, inscrições e resultados.
          </Text>
        </View>

        <View className="w-full gap-4">
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

          <Button
            isDisabled={isSubmitPending}
            onPress={handleSubmitPress}
            variant="primary"
          >
            <Button.Label>
              {isSubmitPending ? "Entrando..." : "Entrar"}
            </Button.Label>
          </Button>

          <View className="flex-row items-center gap-3 py-2">
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
            isDisabled={isSubmitPending}
            onPress={() => router.navigate("/sign-up")}
            variant="ghost"
          >
            <Button.Label>Criar conta</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </>
  );
}
