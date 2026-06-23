import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { cn, Tabs } from "heroui-native";
import { Badge } from "heroui-native-pro";
import { useEffect, useState, type ComponentProps } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Uniwind } from "uniwind";

import { HugeIcons } from "@/components/ui/huge-icons";

export type FloatingTabBarItem = {
  badgeCount?: number;
  label: string;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  value: string;
};

type FloatingTabBarRouteParams =
  BottomTabBarProps["state"]["routes"][number]["params"];

type FloatingTabBarProps = BottomTabBarProps & {
  getNavigationParams?: (input: {
    routeName: string;
    routeParams: FloatingTabBarRouteParams;
    value: string;
  }) => FloatingTabBarRouteParams;
  items: readonly FloatingTabBarItem[];
  resolveValueFromRouteName?: (routeName: string) => null | string;
  routeNames?: Readonly<Partial<Record<string, string>>>;
  triggerClassName?: string;
};

const FLOATING_TAB_BAR_BOTTOM_GAP = 12;
const FLOATING_TAB_BAR_THEMES = ["light", "dark"] as const;

type FloatingTabBarCSSVariables = {
  "--floating-tab-bar-bottom-offset": number;
  "--floating-tab-bar-height": number;
  "--spacing-floating-tab-bar": number;
};

function normalizeLayoutValue(value: number) {
  return Math.ceil(Math.max(value, 0));
}

function buildFloatingTabBarCSSVariables(input: {
  bottomInset: number;
  height: number;
}): FloatingTabBarCSSVariables {
  const height = normalizeLayoutValue(input.height);
  const bottomOffset =
    normalizeLayoutValue(input.bottomInset) + FLOATING_TAB_BAR_BOTTOM_GAP;

  return {
    "--floating-tab-bar-bottom-offset": bottomOffset,
    "--floating-tab-bar-height": height,
    "--spacing-floating-tab-bar": height + bottomOffset,
  };
}

function updateFloatingTabBarCSSVariables(input: {
  bottomInset: number;
  height: number;
}) {
  const variables = buildFloatingTabBarCSSVariables(input);

  for (const theme of FLOATING_TAB_BAR_THEMES) {
    Uniwind.updateCSSVariables(theme, variables);
  }
}

function FloatingTabBarRoot(
  props: ComponentProps<typeof View>
): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [tabBarHeight, setTabBarHeight] = useState(0);

  useEffect(() => {
    updateFloatingTabBarCSSVariables({
      bottomInset: insets.bottom,
      height: tabBarHeight,
    });
  }, [insets.bottom, tabBarHeight]);

  return (
    <View
      {...props}
      className={cn(
        "absolute right-0 bottom-safe-offset-3 left-0 z-50 items-center",
        props.className
      )}
      onLayout={(event) => {
        setTabBarHeight(event.nativeEvent.layout.height);
        props.onLayout?.(event);
      }}
      pointerEvents={props.pointerEvents ?? "box-none"}
    >
      {props.children}
    </View>
  );
}

type FloatingTabBarContentProps = {
  items: readonly FloatingTabBarItem[];
  onItemLongPress?: (value: string) => void;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  value: null | string;
};

function FloatingTabBarContent(props: FloatingTabBarContentProps) {
  return (
    <Tabs
      onValueChange={(value) => {
        props.onValueChange(value);
      }}
      value={props.value ?? ""}
      variant="primary"
    >
      <Tabs.List className="rounded-full bg-default p-1.5 shadow-overlay">
        <Tabs.Indicator className="rounded-full bg-accent" />
        {props.items.map((item) => (
          <Tabs.Trigger
            accessibilityLabel={
              item.badgeCount && item.badgeCount > 0
                ? `${item.label}, ${item.badgeCount} novos`
                : item.label
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: props.value === item.value }}
            className={cn("h-11 w-14 rounded-full", props.triggerClassName)}
            hitSlop={6}
            key={item.value}
            onLongPress={() => {
              props.onItemLongPress?.(item.value);
            }}
            value={item.value}
          >
            {({ isSelected }) => (
              <Badge.Anchor className="centered">
                <HugeIcons
                  className={cn(
                    "size-5.5",
                    isSelected ? "text-accent-foreground" : "text-muted"
                  )}
                  icon={item.icon}
                />
                {item.badgeCount && item.badgeCount > 0 ? (
                  <Badge
                    className="translate-x-1.5 -translate-y-1.5"
                    color="danger"
                    size="sm"
                  >
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </Badge>
                ) : null}
              </Badge.Anchor>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

function getRouteNameForValue(props: FloatingTabBarProps, value: string) {
  return props.routeNames?.[value] ?? value;
}

function getVisibleItems(props: FloatingTabBarProps) {
  return props.items.filter((item) => {
    const routeName = getRouteNameForValue(props, item.value);

    return props.state.routes.some((route) => route.name === routeName);
  });
}

function getSelectedValue(
  props: FloatingTabBarProps,
  items: readonly FloatingTabBarItem[]
) {
  const activeRouteName = props.state.routes[props.state.index]?.name;

  if (activeRouteName === undefined) {
    return null;
  }

  const value = props.resolveValueFromRouteName
    ? props.resolveValueFromRouteName(activeRouteName)
    : activeRouteName;

  if (value === null) {
    return null;
  }

  return items.some((item) => item.value === value) ? value : null;
}

export const FloatingTabBar = (props: FloatingTabBarProps) => {
  const items = getVisibleItems(props);
  const selectedValue = getSelectedValue(props, items);

  if (items.length === 0 || selectedValue === null) {
    return null;
  }

  const handleValueChange = (value: string): void => {
    const routeName = getRouteNameForValue(props, value);
    const routeIndex = props.state.routes.findIndex(
      (route) => route.name === routeName
    );
    const route = props.state.routes[routeIndex];

    if (route === undefined) {
      return;
    }

    const event = props.navigation.emit({
      canPreventDefault: true,
      target: route.key,
      type: "tabPress",
    });

    if (props.state.index !== routeIndex && !event.defaultPrevented) {
      const routeParams =
        props.getNavigationParams?.({
          routeName,
          routeParams: route.params,
          value,
        }) ?? route.params;

      props.navigation.navigate(route.name, routeParams);
    }
  };

  const handleItemLongPress = (value: string): void => {
    const routeName = getRouteNameForValue(props, value);
    const route = props.state.routes.find((item) => item.name === routeName);

    if (route === undefined) {
      return;
    }

    props.navigation.emit({
      target: route.key,
      type: "tabLongPress",
    });
  };

  return (
    <FloatingTabBarRoot>
      <FloatingTabBarContent
        items={items}
        onItemLongPress={handleItemLongPress}
        onValueChange={handleValueChange}
        triggerClassName={props.triggerClassName}
        value={selectedValue}
      />
    </FloatingTabBarRoot>
  );
};
