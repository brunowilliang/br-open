import { cn } from "better-styled";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { View } from "react-native";
import { usePageContext } from "./context";

export const PageFooter = (props: ComponentProps<typeof View>) => {
  const context = usePageContext();

  useEffect(
    () => () => {
      context.setFooterHeight(0);
    },
    [context.setFooterHeight]
  );

  const handleLayout = (
    event: Parameters<NonNullable<typeof props.onLayout>>[0]
  ) => {
    context.setFooterHeight(event.nativeEvent.layout.height);
    props.onLayout?.(event);
  };

  return (
    <View
      {...props}
      className={cn(
        "absolute bottom-0 z-50 w-full flex-row gap-3 bg-linear-to-t from-background to-background/0",
        props.className
      )}
      onLayout={handleLayout}
      pointerEvents="box-none"
    >
      {props.children}
    </View>
  );
};
