import { ArrowLeft01Icon, SadDizzyIcon } from "@hugeicons/core-free-icons";
import { Button, Surface } from "heroui-native";
import { EmptyState } from "heroui-native-pro";
import { HugeIcons } from "./huge-icons";
import { Text } from "./text";

type ErrorStateProps = {
  message?: string;
};

export const ErrorState = (props: ErrorStateProps) => (
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
          {props.message || "Erro Desconhecido"}
        </Text>
      </Surface>
    </EmptyState.Header>
    <EmptyState.Content className="w-full gap-2.5">
      <Button variant="outline">
        <HugeIcons className="text-accent-foreground" icon={ArrowLeft01Icon} />
        <Button.Label>Voltar</Button.Label>
      </Button>
    </EmptyState.Content>
  </EmptyState>
);
