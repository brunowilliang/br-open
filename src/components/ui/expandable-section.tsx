import { Text } from "@/components/core/text";
import { Accordion } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

type ExpandableSectionProps = {
  children: ReactNode;
  /** Classes extras pro Accordion.Content (ex.: "pb-0" quando o último filho
   * já tem o próprio respiro — o padrão da lib adiciona padding-bottom). */
  contentClassName?: string;
  description?: string;
  sectionKey: string;
  title: string;
};

/**
 * Card de seção de acordeão (RUL-0005: componente global compartilhado — usado
 * por organization e player). Deve ser renderizado dentro de um `<Accordion>`
 * com `selectionMode="single"` para só um card ficar expandido por vez.
 */
export function ExpandableSection(props: ExpandableSectionProps) {
  return (
    <View>
      <Accordion.Item value={props.sectionKey}>
        <Accordion.Trigger>
          <View className="flex-1">
            <Text className="font-medium text-base">{props.title}</Text>
            {props.description ? (
              <Text color="muted" variant="description">
                {props.description}
              </Text>
            ) : null}
          </View>
          <Accordion.Indicator />
        </Accordion.Trigger>
        <Accordion.Content
          className={["gap-3", props.contentClassName]
            .filter(Boolean)
            .join(" ")}
        >
          {props.children}
        </Accordion.Content>
      </Accordion.Item>
    </View>
  );
}
