import { cn } from "better-styled";
import { Select, Tabs, useThemeColor } from "heroui-native";
import { Fragment, useState } from "react";
import { View } from "react-native";

import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import {
  buildCategorySelectTabs,
  type CategorySelectSource,
  type CategorySelectTabMode,
} from "@/lib/tournaments/category-select-derived";

type CategorySelectProps = {
  categories: readonly CategorySelectSource[];
  onChange: (categoryId: string) => void;
  /** "active" = uma aba com a seleção; "type" = uma aba por tipo. */
  tabMode?: CategorySelectTabMode;
  value: string;
};

/** Largura do painel do Select (pt): entre a aba (~160pt) e a tela inteira;
 * é o ponto do ajuste fino daqui pra frente. */
const CATEGORY_SELECT_MENU_WIDTH = 280;

/** Até 2 itens a barra divide a largura toda entre eles (1 cheio, 2 metades);
 * de 3 pra cima vale a rolagem horizontal do Tabs.ScrollView. */
const CATEGORY_SELECT_SPLIT_MAX = 2;

/** Seletor de categoria do chaveamento: barra de Tabs cujo item mostra o tipo
 * em cima e o nome embaixo; o toque abre o Select agrupado. O Select raiz usa
 * asChild: um wrapper deslocaria o eixo X que o indicador da Tabs mede. */
export function CategorySelect(props: CategorySelectProps) {
  const [openTab, setOpenTab] = useState<null | string>(null);
  const foregroundColor = useThemeColor("foreground");
  const mutedColor = useThemeColor("muted");
  const { tabs, value } = buildCategorySelectTabs({
    categories: props.categories,
    mode: props.tabMode ?? "active",
    selectedId: props.value,
  });

  if (tabs.length === 0) {
    return null;
  }

  const isSplitBar = tabs.length <= CATEGORY_SELECT_SPLIT_MAX;

  return (
    <Tabs onValueChange={setOpenTab} value={value}>
      <Tabs.List className={cn("rounded-full", isSplitBar && "w-full")}>
        <Tabs.ScrollView
          contentContainerClassName={isSplitBar ? "flex-1" : undefined}
          scrollEnabled={!isSplitBar}
        >
          <Tabs.Indicator className="rounded-full" />
          {tabs.map((tab) => (
            <Select
              asChild
              isOpen={openTab === tab.tabValue}
              key={tab.tabValue}
              onOpenChange={(open) => {
                setOpenTab(open ? tab.tabValue : null);
              }}
              onValueChange={(nextValue) => {
                if (nextValue && !Array.isArray(nextValue)) {
                  props.onChange(nextValue.value);
                }
              }}
              selectionMode="single"
              value={tab.option}
            >
              <Tabs.Trigger
                className={isSplitBar ? "flex-1" : undefined}
                value={tab.tabValue}
              >
                {({ isSelected }) => (
                  <>
                    <Select.Trigger
                      className="flex-row items-center gap-2.5 px-2"
                      variant="unstyled"
                    >
                      <View className="items-center">
                        <Tabs.Label
                          className={cn(
                            "text-sm",
                            isSelected ? "text-foreground" : "text-muted"
                          )}
                          numberOfLines={1}
                        >
                          {tab.typeLabel}
                        </Tabs.Label>
                        <Tabs.Label
                          className={cn(
                            "text-sm",
                            isSelected ? "text-foreground" : "text-muted"
                          )}
                          numberOfLines={1}
                        >
                          {tab.name}
                        </Tabs.Label>
                      </View>
                      <Select.TriggerIndicator
                        iconProps={{
                          color: isSelected ? foregroundColor : mutedColor,
                        }}
                      />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Overlay />
                      <SelectScrollContent width={CATEGORY_SELECT_MENU_WIDTH}>
                        {tab.groups.map((group) => (
                          <Fragment key={group.key}>
                            <Select.ListLabel>{group.label}</Select.ListLabel>
                            {group.items.map((item) => (
                              <SelectOptionItem
                                key={item.id}
                                label={item.name}
                                value={item.id}
                              />
                            ))}
                          </Fragment>
                        ))}
                      </SelectScrollContent>
                    </Select.Portal>
                  </>
                )}
              </Tabs.Trigger>
            </Select>
          ))}
        </Tabs.ScrollView>
      </Tabs.List>
    </Tabs>
  );
}
