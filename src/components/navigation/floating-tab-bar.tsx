import {
  Activity01Icon,
  Home01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { cn, Tabs } from "heroui-native";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { HugeIcons } from "@/components/ui/huge-icons";

export type TabRouteName = "index" | "search" | "activity";

export type TabConfig = {
  name: TabRouteName;
  label: string;
  icon: ComponentProps<typeof HugeIcons>["icon"];
};

export const TABS: readonly TabConfig[] = [
  {
    name: "index",
    label: "Home",
    icon: Home01Icon,
  },
  {
    name: "search",
    label: "Search",
    icon: Search01Icon,
  },
  {
    name: "activity",
    label: "Activity",
    icon: Activity01Icon,
  },
];

export const FloatingTabBar = ({
  state,
  navigation,
}: BottomTabBarProps): React.ReactElement => {
  const activeRouteName = state.routes[state.index]?.name ?? "";

  const handleValueChange = (value: string): void => {
    const routeIndex = state.routes.findIndex((route) => route.name === value);
    const route = state.routes[routeIndex];

    if (route === undefined) {
      return;
    }

    const event = navigation.emit({
      canPreventDefault: true,
      target: route.key,
      type: "tabPress",
    });

    if (state.index !== routeIndex && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    <View
      className="absolute right-0 bottom-safe-offset-3 left-0 items-center"
      pointerEvents="box-none"
    >
      <Tabs
        onValueChange={handleValueChange}
        value={activeRouteName}
        variant="primary"
      >
        <Tabs.List className="rounded-full bg-default p-1.5 shadow-overlay">
          <Tabs.Indicator className="rounded-full bg-accent" />
          {state.routes.map((route) => {
            const config = TABS.find((tab) => tab.name === route.name);

            if (config === undefined) {
              return null;
            }

            return (
              <Tabs.Trigger
                accessibilityLabel={config.label}
                className="h-11 w-14 rounded-full"
                hitSlop={6}
                key={route.key}
                onLongPress={() => {
                  navigation.emit({
                    target: route.key,
                    type: "tabLongPress",
                  });
                }}
                value={route.name}
              >
                {({ isSelected }) => (
                  <HugeIcons
                    className={cn(
                      "size-5.5",
                      isSelected ? "text-accent-foreground" : "text-muted"
                    )}
                    icon={config.icon}
                  />
                )}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
      </Tabs>
    </View>
  );
};
