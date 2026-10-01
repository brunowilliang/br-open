import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { Button, Tabs } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { VariantSection } from "@/components/pages/settings/shared";
import { HugeIcons } from "@/components/ui/huge-icons";
import { SortableCardList } from "@/components/ui/sortable-card-list";
import {
  StandingsCard,
  type StandingsCardItem,
  type StandingsFormSlot,
} from "@/components/ui/standings-card";

/**
 * Uma das pontas é o jogador do viewer: o card sai em accent e é o único com a
 * fileira de forma preenchida — as outras ficam com as casas neutras do
 * fallback, que é o que a peça desenha sem dado de forma.
 */
const galleryStandingsViewerId = "diego-nakamura-alves";

/**
 * Mistura de exemplo da fileira: ganha, ganha, perdida, perdida, ganha. A
 * bolinha tem só as duas cores (verde ganha, vermelha perdida).
 */
const galleryStandingsForm: StandingsFormSlot[] = [
  { outcome: "win" },
  { outcome: "win" },
  { outcome: "loss" },
  { outcome: "loss" },
  { outcome: "win" },
];

const galleryStandingsItems: StandingsCardItem[] = [
  {
    avatarUrl: null,
    id: "marina-costa",
    name: "Marina Costa",
    nickname: "marina.costa",
    position: 1,
  },
  {
    avatarUrl: null,
    id: "diego-nakamura-alves",
    name: "Diego Nakamura Alves",
    nickname: "diego.nakamura",
    position: 2,
  },
  {
    avatarUrl: null,
    id: "rafael-de-souza-lima",
    name: "Rafael de Souza Lima",
    nickname: "rafael.lima",
    position: 3,
  },
  {
    avatarUrl: null,
    id: "bruno-william-garcia",
    name: "Bruno William Garcia",
    nickname: "bruno.garcia",
    position: 4,
  },
];

/**
 * O seletor manda: as duas variantes existem para quem está olhando, sem
 * depender de papel nenhum. Só o arrasto da primeira muda o estado local.
 */
export function StandingsCardVariantsSection() {
  const [items, setItems] = useState(galleryStandingsItems);
  const [variant, setVariant] = useState("drag");

  function handleOrderChange(reorderedItems: StandingsCardItem[]) {
    setItems(
      reorderedItems.map((item, index) => ({
        ...item,
        position: index + 1,
      }))
    );
  }

  return (
    <Tabs onValueChange={setVariant} value={variant}>
      <Tabs.List className="w-full">
        <Tabs.ScrollView>
          <Tabs.Indicator />
          <Tabs.Trigger className="flex-1" value="drag">
            <Tabs.Label>Com drag</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger className="flex-1" value="static">
            <Tabs.Label>Sem drag</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.ScrollView>
      </Tabs.List>

      <Tabs.Content className="pt-4" value="drag">
        <VariantSection
          note="Segure a alça à esquerda do avatar e arraste: quem reordena é o estado local, sem servidor nem query. No item em accent (o jogador do viewer) a forma traz a mistura de exemplo (ganha, ganha, perdida, perdida, ganha); nas outras pontas saem as casas cinzas do fallback sem dado."
          title="Lista reordenável | com a alça"
        >
          <View className="h-96">
            <SortableCardList
              data={items}
              fillAvailableHeight
              itemGap={8}
              onOrderChange={handleOrderChange}
              renderItem={({ dragHandle, isActive, item }) => (
                <StandingsCard
                  dragHandle={dragHandle(
                    <Button
                      isDisabled={isActive}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                    >
                      <HugeIcons
                        className="text-muted"
                        icon={DragDropVerticalIcon}
                      />
                    </Button>
                  )}
                  form={
                    item.id === galleryStandingsViewerId
                      ? galleryStandingsForm
                      : undefined
                  }
                  isDragging={isActive}
                  isViewer={item.id === galleryStandingsViewerId}
                  item={item}
                />
              )}
            />
          </View>
        </VariantSection>
      </Tabs.Content>

      <Tabs.Content className="pt-4" value="static">
        <VariantSection
          note="A mesma lista sem a alça: posição, avatar, nome e nickname, só leitura. A mistura de exemplo da forma segue no item em accent."
          title="Lista estática | sem a alça"
        >
          <View className="gap-2">
            {items.map((item) => (
              <StandingsCard
                form={
                  item.id === galleryStandingsViewerId
                    ? galleryStandingsForm
                    : undefined
                }
                isViewer={item.id === galleryStandingsViewerId}
                item={item}
                key={item.id}
              />
            ))}
          </View>
        </VariantSection>
      </Tabs.Content>
    </Tabs>
  );
}
