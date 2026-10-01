import {
  AppleIcon,
  GoogleIcon,
  Mail01Icon,
  ShieldUserIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { Chip, ListGroup, Separator } from "heroui-native";
import { Fragment, type ComponentProps } from "react";
import { View } from "react-native";

import { VariantSection, noop } from "@/components/pages/settings/shared";
import {
  LinkedAccountRow,
  LINKED_ACCOUNT_STATUS_CHIPS,
  type LinkedAccountStatus,
} from "@/components/pages/player/linked-account-row";
import type { HugeIcons } from "@/components/ui/huge-icons";

/**
 * A mesma linha do `/settings/security`, com o chip binário em cima do título:
 * um caso por estado, mais os extremos (rótulo longo, provedor fora da lista).
 */
const galleryLinkedAccountCases: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  id: string;
  isActionDisabled?: boolean;
  isInformational?: boolean;
  note: string;
  pendingAction?: "link" | "unlink";
  providerLabel: string;
  status: LinkedAccountStatus;
  title: string;
}[] = [
  {
    icon: AppleIcon,
    id: "conectada",
    note: "Conta conectada: chip em cima do título e ação desconectar.",
    providerLabel: "Apple",
    status: "connected",
    title: "Linha 1 | conta conectada",
  },
  {
    icon: GoogleIcon,
    id: "nao-conectada",
    note: "Conta fora: chip apagado em cima do título e ação conectar.",
    providerLabel: "Google",
    status: "disconnected",
    title: "Linha 2 | conta não conectada",
  },
  {
    icon: GoogleIcon,
    id: "conectando",
    note: "Conectar em andamento: o chip segue binário (não conectado) e só o botão conta o progresso, travado.",
    pendingAction: "link",
    providerLabel: "Google",
    status: "disconnected",
    title: "Linha 3 | botão conectando",
  },
  {
    icon: AppleIcon,
    id: "desconectando",
    note: "Desconectar em andamento: o chip segue conectado e quem conta o progresso é o botão.",
    pendingAction: "unlink",
    providerLabel: "Apple",
    status: "connected",
    title: "Linha 4 | botão desconectando",
  },
  {
    icon: GoogleIcon,
    id: "acao-travada",
    isActionDisabled: true,
    note: "Enquanto UMA conta conecta, as outras linhas ficam com a ação travada (hoje é o pendingProvider da seção).",
    providerLabel: "Google",
    status: "connected",
    title: "Linha 5 | ação travada por outra linha",
  },
  {
    icon: Mail01Icon,
    id: "informativa-conectada",
    isInformational: true,
    note: "Linha informativa: chip de status e sem ação. Alterar a senha continua na Segurança.",
    providerLabel: "E-mail e senha",
    status: "connected",
    title: "Linha 6 | informativa conectada",
  },
  {
    icon: Mail01Icon,
    id: "informativa-nao-conectada",
    isInformational: true,
    note: "A mesma informativa quando a conta não tem senha: o chip fica Não conectado e a linha esmaece, como hoje.",
    providerLabel: "E-mail e senha",
    status: "disconnected",
    title: "Linha 7 | informativa não conectada",
  },
  {
    icon: ShieldUserIcon,
    id: "rotulo-longo",
    note: "Rótulo comprido: o chip fica em cima e o título quebra sem empurrar a ação.",
    providerLabel: "Conta corporativa da Federação Paulista de Tênis",
    status: "disconnected",
    title: "Linha 8 | rótulo longo",
  },
  {
    icon: UserCircleIcon,
    id: "provedor-desconhecido",
    note: "Provedor fora dos três do app: entra por ícone e título, sem caso especial no componente.",
    providerLabel: "Discord",
    status: "connected",
    title: "Linha 9 | provedor fora da lista",
  },
];

/** Lista na ordem real da seção, para aprovar os separadores junto. */
const galleryLinkedAccountList: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  isInformational?: boolean;
  providerLabel: string;
  status: LinkedAccountStatus;
}[] = [
  {
    icon: Mail01Icon,
    isInformational: true,
    providerLabel: "E-mail e senha",
    status: "connected",
  },
  { icon: AppleIcon, providerLabel: "Apple", status: "connected" },
  { icon: GoogleIcon, providerLabel: "Google", status: "disconnected" },
];

const galleryLinkedAccountStatuses: LinkedAccountStatus[] = [
  "connected",
  "disconnected",
];

const galleryLinkedAccountChipColors = [
  "default",
  "success",
  "accent",
  "warning",
  "danger",
] as const;

const galleryLinkedAccountChipSizes: ("lg" | "md" | "sm")[] = [
  "sm",
  "md",
  "lg",
];

export function LinkedAccountRowVariantsSection() {
  return (
    <View className="gap-6">
      {galleryLinkedAccountCases.map((item) => (
        <VariantSection key={item.id} note={item.note} title={item.title}>
          <ListGroup>
            <LinkedAccountRow
              icon={item.icon}
              isActionDisabled={item.isActionDisabled}
              isInformational={item.isInformational}
              onActionPress={noop}
              status={item.status}
              title={item.providerLabel}
            />
          </ListGroup>
        </VariantSection>
      ))}

      <VariantSection
        note="Ordem e separadores como a seção monta hoje."
        title="Lista real | informativa, Apple e Google"
      >
        <ListGroup>
          {galleryLinkedAccountList.map((item, index) => (
            <Fragment key={item.providerLabel}>
              {index > 0 ? <Separator className="mx-4" /> : null}
              <LinkedAccountRow
                icon={item.icon}
                isInformational={item.isInformational}
                onActionPress={noop}
                status={item.status}
                title={item.providerLabel}
              />
            </Fragment>
          ))}
        </ListGroup>
      </VariantSection>

      <VariantSection
        note="Proposta: Conectado em success e Não conectado em default (muted), em soft. As outras cores ficam para riscar."
        title="Variantes do chip | cor"
      >
        <View className="gap-2">
          {galleryLinkedAccountStatuses.map((status) => {
            const chip = LINKED_ACCOUNT_STATUS_CHIPS[status];

            return (
              <View
                className="flex-row flex-wrap items-center gap-2"
                key={status}
              >
                {galleryLinkedAccountChipColors.map((color) => (
                  <Chip color={color} key={color} size="sm" variant="soft">
                    <Chip.Label
                      className={chip.isLabelMuted ? "text-muted" : undefined}
                    >
                      {chip.label}
                    </Chip.Label>
                  </Chip>
                ))}
              </View>
            );
          })}
        </View>
      </VariantSection>

      <VariantSection
        note="Proposta é o sm; md e lg ficam visíveis para comparar."
        title="Variantes do chip | tamanho"
      >
        <View className="flex-row flex-wrap items-center gap-2">
          {galleryLinkedAccountChipSizes.map((size) => (
            <Chip color="success" key={size} size={size} variant="soft">
              <Chip.Label>
                {LINKED_ACCOUNT_STATUS_CHIPS.connected.label}
              </Chip.Label>
            </Chip>
          ))}
        </View>
      </VariantSection>
    </View>
  );
}
