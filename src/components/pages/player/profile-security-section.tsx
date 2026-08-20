import { ChangeEmailDialog } from "@/components/pages/player/change-email-dialog";
import { ForgotPasswordDialog } from "@/components/pages/player/forgot-password-dialog";
import { HugeIcons } from "@/components/ui/huge-icons";
import type { AuthAccount } from "@/lib/account/linked-accounts";
import { hasCredentialAccount } from "@/lib/account/linked-accounts";
import { Key02Icon, LockKeyIcon, Mail01Icon } from "@hugeicons/core-free-icons";
import { ListGroup, PressableFeedback, Separator } from "heroui-native";
import { useState } from "react";

type ProfileSecuritySectionProps = {
  accounts: AuthAccount[];
  currentEmail?: string;
  /** Abre o dialog de troca de senha (instância liftada para a rota — o
   * mesmo dialog é compartilhado com a linha "E-mail e senha" das contas). */
  onOpenChangePassword: () => void;
};

/**
 * Conteúdo do acordeão "Segurança": cada ação é uma linha clicável no padrão
 * das linhas de settings/index.tsx (RUL-0006: ícone direto no ItemPrefix,
 * título + descrição, Highlight último filho) — alterar senha (contas com
 * e-mail+senha), alterar e-mail (código único no e-mail novo) e "esqueci
 * minha senha" (dialog de redefinição por OTP logado — sem sair da sessão).
 * A descrição da seção vive no card do acordeão.
 */
export function ProfileSecuritySection(props: ProfileSecuritySectionProps) {
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isForgotPasswordDialogOpen, setIsForgotPasswordDialogOpen] =
    useState(false);
  const canChangePassword = hasCredentialAccount(props.accounts);

  return (
    <>
      <ListGroup>
        {canChangePassword ? (
          <>
            <PressableFeedback
              animation={false}
              onPress={props.onOpenChangePassword}
            >
              <ListGroup.Item disabled>
                <ListGroup.ItemPrefix>
                  <HugeIcons icon={LockKeyIcon} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Alterar senha</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    Desconecta outros dispositivos.
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
              <PressableFeedback.Highlight />
            </PressableFeedback>
            <Separator className="mx-4" />
          </>
        ) : null}

        <PressableFeedback
          animation={false}
          onPress={() => {
            if (props.currentEmail) {
              setIsEmailDialogOpen(true);
            }
          }}
        >
          <ListGroup.Item disabled>
            <ListGroup.ItemPrefix>
              <HugeIcons icon={Mail01Icon} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>Alterar e-mail</ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                Código no novo e-mail para confirmar.
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
          </ListGroup.Item>
          <PressableFeedback.Highlight />
        </PressableFeedback>

        <Separator className="mx-4" />

        <PressableFeedback
          animation={false}
          onPress={() => {
            if (props.currentEmail) {
              setIsForgotPasswordDialogOpen(true);
            }
          }}
        >
          <ListGroup.Item disabled>
            <ListGroup.ItemPrefix>
              <HugeIcons icon={Key02Icon} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>Esqueci minha senha</ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                Redefine por código no e-mail.
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
          </ListGroup.Item>
          <PressableFeedback.Highlight />
        </PressableFeedback>
      </ListGroup>

      {props.currentEmail ? (
        <>
          <ChangeEmailDialog
            currentEmail={props.currentEmail}
            isOpen={isEmailDialogOpen}
            onOpenChange={setIsEmailDialogOpen}
          />
          <ForgotPasswordDialog
            currentEmail={props.currentEmail}
            isOpen={isForgotPasswordDialogOpen}
            onOpenChange={setIsForgotPasswordDialogOpen}
          />
        </>
      ) : null}
    </>
  );
}
