import { Children, type ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";

export function RulesItemCard(props: { label: string; value: string }) {
  // flex-1 preenche a coluna dentro de cada linha do RulesGrid (sempre 2 por linha).
  return (
    <View className="flex-1 rounded-2xl bg-surface-secondary px-4 py-3">
      <Text numberOfLines={1} weight="medium">
        {props.label}
      </Text>
      <Text color="muted" numberOfLines={4} variant="description">
        {props.value}
      </Text>
    </View>
  );
}

/**
 * Distribui os filhos em linhas de exatamente 2 colunas (item | item),
 * sem depender de flex-wrap ou calc — cada par vira uma `flex-row gap-2` e as
 * linhas são empilhadas verticalmente. Garante grid 2xN estável em qualquer
 * largura de tela.
 */
export function RulesGrid(props: { children: ReactNode }) {
  const items = Children.toArray(props.children);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }
  return (
    <View className="gap-2">
      {rows.map((row, rowIndex) => (
        <View className="flex-row gap-2" key={`rules-row-${rowIndex}`}>
          {row.map((item) => item)}
        </View>
      ))}
    </View>
  );
}
