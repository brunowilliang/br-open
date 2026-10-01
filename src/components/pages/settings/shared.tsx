import { Alert, Button } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { WidgetAlert } from "@/components/ui/widget-alert";
import type { TournamentCategoryDraft } from "@/lib/tournaments/category-editor-derived";

/** Moldura de variante: título, conteúdo e a linha de procedência (`note`). */
export function VariantSection(props: {
  children: ReactNode;
  note?: string;
  title: string;
}) {
  return (
    <View className="gap-1">
      <Text color="muted" variant="description" weight="medium">
        {props.title}
      </Text>
      {props.children}
      {props.note ? (
        <Text color="muted" variant="description">
          {props.note}
        </Text>
      ) : null}
    </View>
  );
}

export function noop() {
  // sem ação por desenho: a galeria aprova, não executa.
}

export function LabeledBlock(props: { children: ReactNode; label: string }) {
  return (
    <View className="gap-1">
      <Text color="muted" variant="description" weight="medium">
        {props.label}
      </Text>
      {props.children}
    </View>
  );
}

/**
 * O aviso de push nos dois moldes que o app desenha; o terceiro
 * (`RNAlert.alert`) não dá para mostrar aqui.
 */
export function NoticeMoldsVariants() {
  return (
    <VariantSection
      note="Os dois fazem o mesmo trabalho no app. Os blocos a e b mostram o aviso com o CTA de uma palavra (Ajustes): o rótulo real de hoje é Abrir ajustes, com duas palavras, e fica apontado como divergência. A descrição dos dois é a copy real do aviso, mantida como estava — sem destaque: a frase não tem palavra-chave (apontado). Existe ainda um terceiro molde fora da tela, o RNAlert.alert nativo com o mesmo aviso (settings/notifications.tsx:381-395), que não dá para mostrar aqui. O `WidgetAlert` ganhou nesta rodada o `isIndicatorHidden` (o cartão de notificação usa), sem mudança de desenho para os chamadores que não passam a prop."
      title="Estilos divergentes hoje: o mesmo aviso em dois moldes"
    >
      <View className="gap-4">
        <LabeledBlock label="a) WidgetAlert, o alerta do app (ui/widget-alert.tsx)">
          <WidgetAlert
            action={{ label: "Ajustes", onPress: noop }}
            description="Habilite as notificações nos ajustes do app para receber push."
            status="warning"
            title="Notificações bloqueadas"
          />
        </LabeledBlock>

        <LabeledBlock label="b) Alert cru do HeroUI, como está hoje em Notificações">
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Notificações bloqueadas</Alert.Title>
              <Alert.Description>
                Habilite as notificações nos ajustes do app para receber push.
              </Alert.Description>
            </Alert.Content>
            <Button onPress={noop} size="sm" variant="primary">
              <Button.Label>Ajustes</Button.Label>
            </Button>
          </Alert>
        </LabeledBlock>
      </View>
    </VariantSection>
  );
}

export function buildGalleryCategory(
  overrides: Partial<TournamentCategoryDraft> & { id: string }
): TournamentCategoryDraft {
  return {
    entryFeeCents: 0,
    gender: "male",
    maxEntries: null,
    modality: "singles",
    name: "Categoria",
    ...overrides,
  };
}
