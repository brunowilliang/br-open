import { ArrowLeft01Icon, SadDizzyIcon } from "@hugeicons/core-free-icons";
import { router } from "expo-router";
import { Button, Surface } from "heroui-native";
import { EmptyState } from "heroui-native-pro";

import { getErrorMessage } from "@/lib/errors/toast-message";

import { Text } from "../core/text";
import { HugeIcons } from "./huge-icons";

type ErrorStateProps = {
  error?: unknown;
  message?: string;
};

export const ErrorState = (props: ErrorStateProps) => {
  const fallbackMessage = props.message ?? "Erro Desconhecido";
  const message = getErrorMessage(
    props.error ?? fallbackMessage,
    fallbackMessage
  );

  return (
    <EmptyState>
      <EmptyState.Header>
        <EmptyState.Media className="bg-danger-soft" variant="icon">
          <HugeIcons className="text-danger" icon={SadDizzyIcon} />
        </EmptyState.Media>
        <EmptyState.Title>Ops, algo deu errado</EmptyState.Title>
        <EmptyState.Description>
          Encontramos um problema ao processar sua ação:
        </EmptyState.Description>
        <Surface className="bg-danger-soft px-4 py-2">
          <Text className="text-danger" variant="description">
            {message || "Erro Desconhecido"}
          </Text>
        </Surface>
      </EmptyState.Header>
      <EmptyState.Content className="w-full gap-2.5">
        <Button onPress={() => router.back()} variant="outline">
          <HugeIcons icon={ArrowLeft01Icon} />
          <Button.Label>Voltar</Button.Label>
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
};
