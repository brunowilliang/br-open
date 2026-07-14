import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
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
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Platform, View } from "react-native";
import { z } from "zod";

import { Image, LogoImage } from "@/components/core/image";
import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import {
  useSignInMutationOptions,
  useSignInSocialMutationOptions,
} from "@/lib/convex/auth-client";
import { getToastErrorMessage } from "@/lib/errors/toast-message";

const SignInFormSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z
    .string("Informe uma senha válida")
    .min(6, "Sua senha deve ter no mínimo 6 caracteres"),
});

type AppleIdTokenUser = {
  email?: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
};

export default function SignIn() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAppleSignInPending, setIsAppleSignInPending] = useState(false);

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

  const signInSocial = useMutation(useSignInSocialMutationOptions());

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
    signIn.isPending ||
    signInSocial.isPending ||
    form.formState.isSubmitting ||
    isAppleSignInPending;
  const handleSubmitPress = form.handleSubmit(async (values) => {
    signIn.reset();

    await signIn.mutateAsync({
      email: values.email,
      password: values.password,
      rememberMe: true,
    });
  });

  function signInWithAppleOAuth() {
    return signInSocial.mutateAsync({
      callbackURL: "/",
      provider: "apple",
    });
  }

  async function signInWithNativeApple() {
    const isAvailable = await AppleAuthentication.isAvailableAsync();

    if (!isAvailable) {
      throw new Error(
        "Login nativo com Apple indisponível neste build. Rebuild o app iOS."
      );
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("A Apple não retornou o token de autenticação.");
    }

    const appleUser: AppleIdTokenUser = {};
    const firstName = credential.fullName?.givenName ?? undefined;
    const lastName = credential.fullName?.familyName ?? undefined;

    if (credential.email) {
      appleUser.email = credential.email;
    }

    if (firstName || lastName) {
      appleUser.name = { firstName, lastName };
    }

    return signInSocial.mutateAsync({
      callbackURL: "/",
      idToken: {
        token: credential.identityToken,
        ...(Object.keys(appleUser).length > 0 ? { user: appleUser } : {}),
      },
      provider: "apple",
    });
  }

  async function handleApplePress() {
    signIn.reset();
    signInSocial.reset();
    setIsAppleSignInPending(true);

    try {
      await (Platform.OS === "ios"
        ? signInWithNativeApple()
        : signInWithAppleOAuth());
    } catch (error) {
      const isAppleSignInCanceled =
        error instanceof Error &&
        error.message === "The user canceled the authorization attempt";

      if (isAppleSignInCanceled) {
        return;
      }

      toast.show({
        description: getToastErrorMessage(
          error,
          "Não conseguimos conectar sua conta Apple. Tente novamente."
        ),
        id: "sign-in-apple-error",
        label: "Falha no login com a Apple",
        variant: "danger",
      });
    } finally {
      setIsAppleSignInPending(false);
    }
  }

  async function handleGooglePress() {
    signIn.reset();
    signInSocial.reset();

    try {
      await signInSocial.mutateAsync({
        callbackURL: "/",
        provider: "google",
      });
    } catch (error) {
      const isGoogleSignInCanceled =
        error instanceof Error &&
        error.message === "Authentication did not complete. Try again.";

      if (isGoogleSignInCanceled) {
        return;
      }

      toast.show({
        description: getToastErrorMessage(
          error,
          "Não conseguimos conectar sua conta Google. Tente novamente."
        ),
        id: "sign-in-google-error",
        label: "Falha no login com o Google",
        variant: "danger",
      });
    }
  }

  return (
    <Page>
      <Page.Header overlay>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center />
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-5 items-center justify-center px-4">
        <View className="w-full items-center">
          <Image.Background
            className="aspect-square size-25"
            source={LogoImage}
          />
          <Text variant="title">De volta pra quadra.</Text>
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
            onPress={handleApplePress}
            provider="apple"
          />
          <SocialAuthButton
            className="flex-1"
            isDisabled={isSubmitPending}
            onPress={handleGooglePress}
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
      </Page.ScrollView>
    </Page>
  );
}
