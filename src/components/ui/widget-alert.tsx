import { Alert, Button } from "heroui-native";
import { View } from "react-native";

import { Text } from "@/components/core/text";

type WidgetAlertAction = {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
};

/** Trecho da descrição: texto + flag de destaque (IBX-0076 r4). */
export type WidgetAlertDescriptionPart = {
  isHighlighted?: boolean;
  text: string;
};

/**
 * UMA linha da descrição, com as suas partes (IBX-0076 r4). Alerta que agrega
 * mais de um tipo de pendência usa uma linha por tipo — nunca um separador no
 * meio da frase.
 */
export type WidgetAlertDescriptionLine = {
  parts: WidgetAlertDescriptionPart[];
};

type WidgetAlertProps = {
  action?: WidgetAlertAction;
  /** Frase simples (string) OU linhas com trechos destacados (IBX-0076 r4). */
  description?: WidgetAlertDescriptionLine[] | string;
  /** Ação de menor hierarquia, DENTRO da superfície do alerta (IBX-0076). */
  secondaryAction?: WidgetAlertAction;
  status?: "accent" | "danger" | "default" | "success" | "warning";
  title: string;
};

/**
 * O padrão do HeroUI Native para ação dentro do alerta (`alert.md` da versão
 * instalada, seção "With Action Buttons" e o exemplo): `Button size="sm"` com
 * `variant="primary"` e `variant="danger"` quando o status do alerta é danger.
 * O componente não tem slot de ação.
 */
function WidgetAlertButton(props: {
  action: WidgetAlertAction;
  variant: "danger" | "primary" | "secondary";
}) {
  return (
    <Button
      isDisabled={props.action.isDisabled}
      onPress={props.action.onPress}
      size="sm"
      variant={props.variant}
    >
      <Button.Label>{props.action.label}</Button.Label>
    </Button>
  );
}

/**
 * Com DUAS ações (IBX-0076 r3), elas vão para uma linha no rodapé do alerta,
 * dentro da superfície: a secundária primeiro e a principal por último, a
 * mesma ordem do molde do app no convite do torneio
 * (pages/tournaments/player-overview.tsx:188-209, recusar antes de aceitar).
 * Com UMA ação, ela segue no slot irmão do conteúdo, o layout que as telas
 * vivas já usam.
 *
 * A descrição em LINHAS (IBX-0076 r4) é empilhada dentro do `Alert.Content`
 * com o gap das linhas empilhadas do app (molde requests.tsx:189): a parte
 * destacada é o MESMO texto da descrição com o peso `bold`, por isso repete
 * `color`/`variant` — o Text do app aplica as classes base (`text-foreground
 * font-normal`) e sem isso a parte sairia maior e na cor padrão. As partes sem
 * destaque ficam sem wrapper e herdam o estilo da linha.
 */
export function WidgetAlert(props: WidgetAlertProps) {
  const primaryVariant = props.status === "danger" ? "danger" : "primary";

  return (
    <Alert status={props.status}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{props.title}</Alert.Title>
        {typeof props.description === "string" ? (
          <Alert.Description>{props.description}</Alert.Description>
        ) : null}
        {Array.isArray(props.description) ? (
          <View className="gap-0.5">
            {props.description.map((line, lineIndex) => (
              <Text color="muted" key={lineIndex} variant="description">
                {line.parts.map((part, partIndex) =>
                  part.isHighlighted ? (
                    <Text
                      color="muted"
                      key={partIndex}
                      variant="description"
                      weight="bold"
                    >
                      {part.text}
                    </Text>
                  ) : (
                    part.text
                  )
                )}
              </Text>
            ))}
          </View>
        ) : null}
        {props.secondaryAction ? (
          <View className="mt-1.5 flex-row items-center gap-2 self-end">
            <WidgetAlertButton
              action={props.secondaryAction}
              variant="secondary"
            />
            {props.action ? (
              <WidgetAlertButton
                action={props.action}
                variant={primaryVariant}
              />
            ) : null}
          </View>
        ) : null}
      </Alert.Content>
      {props.action && !props.secondaryAction ? (
        <WidgetAlertButton action={props.action} variant={primaryVariant} />
      ) : null}
    </Alert>
  );
}
