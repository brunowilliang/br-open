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
import { View } from "react-native";
import { z } from "zod";

import { Image, LogoImage } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import {
  useSignInMutationOptions,
  useSocialAuth,
} from "@/lib/convex/auth-client";
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
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Verifique seu e-mail e senha e tente novamente."
          ),
          id: "sign-in-auth-error",
          label: "Não foi possível entrar",
          variant: "danger",
        });
      },
    })
  );

  const socialAuth = useSocialAuth("sign-in");

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(SignInFormSchema),
  });

  const isSubmitPending =
    signIn.isPending || socialAuth.isPending || form.formState.isSubmitting;
  const handleSubmitPress = form.handleSubmit(async (values) => {
    signIn.reset();

    await signIn.mutateAsync({
      email: values.email,
      password: values.password,
      rememberMe: true,
    });
  });

  function handleSocialApple() {
    signIn.reset();
    socialAuth.handleApplePress();
  }

  function handleSocialGoogle() {
    signIn.reset();
    socialAuth.handleGooglePress();
  }

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Entrar</Page.Header.Title>
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

        <View className="mx-10 flex-row items-center gap-3">
          <Separator className="flex-1" />
          <Text className="text-muted text-sm">ou</Text>
          <Separator className="flex-1" />
        </View>

        <View className="flex-row gap-3">
          <SocialAuthButton
            className="flex-1"
            isDisabled={isSubmitPending}
            onPress={handleSocialApple}
            provider="apple"
            // variant="tertiary"
          />
          <SocialAuthButton
            className="flex-1"
            isDisabled={isSubmitPending}
            onPress={handleSocialGoogle}
            provider="google"
            // variant="tertiary"
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
      </Page.ScrollView>
    </Page>
  );
}
