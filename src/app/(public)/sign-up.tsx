import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  Button,
  FieldError,
  Input,
  Label,
  TextField,
  useToast,
} from "heroui-native";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, Text, View } from "react-native";
import { z } from "zod";

import { useSignUpMutationOptions } from "@/lib/convex/auth-client";
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
  const router = useRouter();
  const { toast } = useToast();

  const signUp = useMutation(
    useSignUpMutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível criar sua conta."
          ),
          id: "sign-up-auth-error",
          label: "Não foi possível cadastrar",
          variant: "danger",
        });
      },
    })
  );

  const form = useForm({
    defaultValues: {},
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(SignUpFormSchema),
  });

  const isSubmitPending = signUp.isPending || form.formState.isSubmitting;
  const submitForm = form.handleSubmit(async (values) => {
    signUp.reset();

    await signUp.mutateAsync({
      email: values.email,
      name: values.name,
      password: values.password,
    });

    router.replace("/");
  });

  function handleSubmitPress() {
    submitForm().catch(() => undefined);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Criar conta" }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="grow items-center justify-center px-4"
      >
        <View className="w-full items-center gap-2">
          <Text className="text-center font-semibold text-2xl text-foreground">
            BR Open
          </Text>
          <Text className="text-center text-base text-muted">
            Crie sua conta para acompanhar torneios, ligas e resultados.
          </Text>
        </View>

        <View className="w-full gap-4">
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
                <Input
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Crie uma senha"
                  returnKeyType="next"
                  secureTextEntry
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
                <Input
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!isSubmitPending}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  onSubmitEditing={handleSubmitPress}
                  placeholder="Repita sua senha"
                  returnKeyType="done"
                  secureTextEntry
                  textContentType="newPassword"
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
              {isSubmitPending ? "Criando..." : "Criar conta"}
            </Button.Label>
          </Button>

          <Button
            isDisabled={isSubmitPending}
            onPress={() => router.back()}
            variant="ghost"
          >
            <Button.Label>Já tenho conta</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </>
  );
}
