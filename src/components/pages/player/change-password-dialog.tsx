import { zodResolver } from "@hookform/resolvers/zod";
import { DialogCloseButton } from "@/components/ui/dialog-close-button";
import { PasswordInput } from "@/components/ui/password-input";
import { useChangePassword } from "@/lib/convex/auth-client";
import { getSecurityErrorMessage } from "@/lib/account/security-errors";
import {
  Button,
  Description,
  Dialog,
  FieldError,
  Label,
  TextField,
  useToast,
} from "heroui-native";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Keyboard, Pressable } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { z } from "zod";

const ChangePasswordSchema = z
  .object({
    confirmPassword: z
      .string("As senhas não conferem.")
      .min(1, "Confirme sua senha."),
    currentPassword: z
      .string("Informe a senha atual.")
      .min(1, "Digite sua senha atual."),
    newPassword: z
      .string("Informe uma senha válida.")
      .min(8, "Sua nova senha deve ter no mínimo 8 caracteres."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

type ChangePasswordValues = z.input<typeof ChangePasswordSchema>;

const defaultValues: ChangePasswordValues = {
  confirmPassword: "",
  currentPassword: "",
  newPassword: "",
};

type ChangePasswordDialogProps = {
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

/**
 * Dialog "Alterar senha" (logado): senha atual + nova + confirmação,
 * validação client igual ao sign-up. `revokeOtherSessions: true` desloga os
 * outros dispositivos — a copy avisa.
 */
export function ChangePasswordDialog(props: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const { changePassword, isChangePasswordPending } = useChangePassword();

  const form = useForm<ChangePasswordValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(ChangePasswordSchema),
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (!props.isOpen) {
      form.reset(defaultValues);
    }
  }, [form, props.isOpen]);

  async function handleSubmit() {
    try {
      await changePassword({
        currentPassword: form.getValues("currentPassword"),
        newPassword: form.getValues("newPassword"),
      });

      props.onOpenChange(false);
      form.reset(defaultValues);
      toast.show({
        description:
          "Sua senha foi alterada e outros dispositivos foram desconectados.",
        id: "change-password-success",
        label: "Senha alterada",
        variant: "success",
      });
    } catch (error) {
      toast.show({
        description: getSecurityErrorMessage(
          error,
          "Não foi possível alterar sua senha. Tente novamente."
        ),
        id: "change-password-error",
        label: "Falha ao alterar senha",
        variant: "danger",
      });
    }
  }

  const submit = form.handleSubmit(() => {
    handleSubmit().catch(() => undefined);
  });

  return (
    <Dialog
      isOpen={props.isOpen}
      onOpenChange={(nextOpen) => {
        if (isChangePasswordPending) {
          return;
        }

        props.onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <KeyboardAvoidingView behavior="padding">
          <Dialog.Content className="p-5">
            {isChangePasswordPending ? null : (
              <DialogCloseButton className="absolute top-4 right-4 z-100" />
            )}
            {/* GOTCHA: em RN, position:absolute ancora no PAI DIRETO (não no
                ancestral posicionado como no CSS) — o DialogCloseButton absolute
                fica filho direto do Dialog.Content (padrão das referências),
                FORA deste wrapper. O Pressable só dismissa o teclado; toques
                em inputs/botões filhos vencem o responder. */}
            <Pressable className="gap-4" onPress={Keyboard.dismiss}>
              <Dialog.Title>Alterar senha</Dialog.Title>
              <Description>
                Você continua logado neste dispositivo; outros dispositivos
                serão desconectados.
              </Description>

              <Controller
                control={form.control}
                name="currentPassword"
                render={({ field, fieldState }) => (
                  <TextField
                    className="w-full"
                    isInvalid={Boolean(fieldState.error)}
                    isRequired
                  >
                    <Label>Senha atual</Label>
                    <PasswordInput
                      autoCapitalize="none"
                      autoComplete="current-password"
                      editable={!isChangePasswordPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="Sua senha atual"
                      returnKeyType="next"
                      textContentType="password"
                      value={field.value ?? ""}
                      variant="secondary"
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
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
                      editable={!isChangePasswordPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="Crie uma nova senha"
                      returnKeyType="next"
                      textContentType="newPassword"
                      value={field.value ?? ""}
                      variant="secondary"
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
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
                      editable={!isChangePasswordPending}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      onSubmitEditing={submit}
                      placeholder="Repita a nova senha"
                      returnKeyType="done"
                      textContentType="newPassword"
                      value={field.value ?? ""}
                      variant="secondary"
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />

              <Button
                className="w-full"
                isDisabled={isChangePasswordPending || !form.formState.isValid}
                onPress={submit}
              >
                <Button.Label>
                  {isChangePasswordPending ? "Alterando..." : "Alterar senha"}
                </Button.Label>
              </Button>
            </Pressable>
          </Dialog.Content>
        </KeyboardAvoidingView>
      </Dialog.Portal>
    </Dialog>
  );
}
