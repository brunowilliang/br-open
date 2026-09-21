import { Alert, Button } from "heroui-native";
import { type GestureResponderEvent, View } from "react-native";

import { Text } from "@/components/core/text";

type WidgetAlertAction = {
  isDisabled?: boolean;
  label: string;
  /** Recebe o evento do toque: quem aninha o alerta num touchable usa para
   * parar a propagação (o cartão de notificação faz isso nos dois botões). */
  onPress: (event: GestureResponderEvent) => void;
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
  /**
   * Classes do `Alert.Content`. Existe pelo cartão da central (IBX-0077 r2): o
   * gatilho do menu ⋮ é ABSOLUTO no canto do cartão e o conteúdo precisa
   * reservar essa faixa (`pr-*`) para o texto nunca passar por baixo dele.
   */
  contentClassName?: string;
  /** Frase simples (string) OU linhas com trechos destacados (IBX-0076 r4). */
  description?: WidgetAlertDescriptionLine[] | string;
  /**
   * Corte da descrição em N linhas (`numberOfLines` do texto). No caminho de
   * LINHAS vale POR linha — o cartão da central (IBX-0077) manda uma linha só e
   * usa isto para manter o corte de 2 linhas que o feed já tinha.
   */
  descriptionNumberOfLines?: number;
  /**
   * SEM o indicador de status. O `Alert.Indicator` do HeroUI Native é uma PARTE
   * composta (anatomia `Alert > Alert.Indicator + Alert.Content`), não uma prop:
   * a doc bundled (`node_modules/heroui-native/lib/module/components/alert/alert.md`)
   * e a API do componente não expõem nenhum jeito de escondê-lo — o mecanismo
   * oficial é justamente OMITIR a parte, e o layout se mantém (o
   * `alert__content` é quem tem `flex: 1`, `alert.css:21-23`). O cartão de
   * notificação (IBX-0077) é o usuário disto: layout do alerta só com título,
   * descrição e botões.
   */
  isIndicatorHidden?: boolean;
  /** Ação de menor hierarquia, DENTRO da superfície do alerta (IBX-0076). */
  secondaryAction?: WidgetAlertAction;
  status?: "accent" | "danger" | "default" | "success" | "warning";
  title: string;
  /** Corte do título em N linhas (`numberOfLines` do texto). */
  titleNumberOfLines?: number;
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
 * (pages/tournaments/player-overview.tsx:175-196, recusar antes de aceitar).
 * O MENU ⋮ do cartão de notificação usa a ordem INVERSA (principal →
 * secundária) de propósito: são desenhos diferentes, com réguas próprias (o
 * alerta empilha botões, o menu é uma lista de comandos) — ver
 * `buildNotificationMenuItems` em `lib/notifications/notification-view.ts`.
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
      {props.isIndicatorHidden ? null : <Alert.Indicator />}
      <Alert.Content className={props.contentClassName}>
        <Alert.Title numberOfLines={props.titleNumberOfLines}>
          {props.title}
        </Alert.Title>
        {typeof props.description === "string" ? (
          <Alert.Description numberOfLines={props.descriptionNumberOfLines}>
            {props.description}
          </Alert.Description>
        ) : null}
        {Array.isArray(props.description) ? (
          <View className="gap-0.5">
            {props.description.map((line, lineIndex) => (
              <Text
                color="muted"
                key={lineIndex}
                numberOfLines={props.descriptionNumberOfLines}
                variant="description"
              >
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
