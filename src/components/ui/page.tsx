import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { LegendListRef } from "@legendapp/list/react-native";
import {
  AnimatedLegendList,
  type AnimatedLegendListProps,
} from "@legendapp/list/reanimated";
import { cn, withSlots } from "better-styled";
import { router } from "expo-router";
import { Button } from "heroui-native";
import type { ComponentProps } from "react";
import { createContext, useContext, useState } from "react";
import { ScrollView as RNScrollView, View } from "react-native";
import {
  type KeyboardAwareScrollViewProps,
  KeyboardAwareScrollView as RNKeyboardAwareScrollView,
} from "react-native-keyboard-controller";
import { Header } from "./header";

// --------------------------------------------------
// Context
// --------------------------------------------------

type PageContextValue = {
  headerHeight: number;
  setHeaderHeight: (height: number) => void;
  footerHeight: number;
  setFooterHeight: (height: number) => void;
};

const PageContext = createContext<PageContextValue>({
  headerHeight: 0,
  setHeaderHeight: () => {},
  footerHeight: 0,
  setFooterHeight: () => {},
});

// --------------------------------------------------
// Page Root
// --------------------------------------------------

type PageRootProps = {
  children: React.ReactNode;
};

const PageRoot = (props: PageRootProps) => {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);

  return (
    <PageContext.Provider
      value={{ headerHeight, setHeaderHeight, footerHeight, setFooterHeight }}
    >
      {props.children}
    </PageContext.Provider>
  );
};

// --------------------------------------------------
// Page.Header
// --------------------------------------------------

type PageHeaderProps = ComponentProps<typeof Header>;

const PageHeader = (props: PageHeaderProps) => {
  const ctx = useContext(PageContext);

  const handleLayout = (
    e: Parameters<NonNullable<typeof props.onLayout>>[0]
  ) => {
    ctx.setHeaderHeight(e.nativeEvent.layout.height);
    props.onLayout?.(e);
  };

  return (
    <Header
      {...props}
      className={cn("absolute z-50 pt-safe-offset-4", props.className)}
      onLayout={handleLayout}
    >
      {props.children}
    </Header>
  );
};

// --------------------------------------------------
// Page.ScrollView
// --------------------------------------------------

type PageScrollViewProps = ComponentProps<typeof RNScrollView>;

const PageScrollView = (props: PageScrollViewProps) => {
  const ctx = useContext(PageContext);

  return (
    <RNScrollView
      {...props}
      className={cn("bg-background", props.className)}
      contentContainerClassName={cn("grow", props.contentContainerClassName)}
      contentContainerStyle={[
        {
          paddingTop: ctx.headerHeight,
          ...(ctx.footerHeight > 0 && { paddingBottom: ctx.footerHeight }),
        },
        props.contentContainerStyle,
      ]}
    >
      {props.children}
    </RNScrollView>
  );
};

// --------------------------------------------------
// Page.KeyboardAwareScrollView
// --------------------------------------------------

const PageKeyboardAwareScrollView = (props: KeyboardAwareScrollViewProps) => {
  const ctx = useContext(PageContext);

  return (
    <RNKeyboardAwareScrollView
      {...props}
      bottomOffset={100}
      className={cn("bg-background", props.className)}
      contentContainerClassName={cn("grow", props.contentContainerClassName)}
      contentContainerStyle={[
        {
          paddingTop: ctx.headerHeight,
          ...(ctx.footerHeight > 0 && { paddingBottom: ctx.footerHeight }),
        },
        props.contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {props.children}
    </RNKeyboardAwareScrollView>
  );
};

// --------------------------------------------------
// Page.AnimatedLegendList
// --------------------------------------------------

const PageAnimatedLegendList = <T,>(
  props: AnimatedLegendListProps<T> & { ref?: React.Ref<LegendListRef> }
) => {
  const { ListHeaderComponent, ListFooterComponent, ...rest } = props;
  const ctx = useContext(PageContext);

  return (
    <AnimatedLegendList<T>
      ListFooterComponent={
        <>
          <View style={{ height: ctx.footerHeight }} />
          {ListFooterComponent}
        </>
      }
      ListHeaderComponent={
        <>
          <View style={{ height: ctx.headerHeight }} />
          {ListHeaderComponent}
        </>
      }
      maintainVisibleContentPosition={false}
      ref={props.ref}
      {...rest}
      className={cn("bg-background", rest.className)}
      contentContainerClassName={cn("grow", rest.contentContainerClassName)}
    />
  );
};

// --------------------------------------------------
// Page.View
// --------------------------------------------------

type PageViewProps = ComponentProps<typeof View>;

const PageView = (props: PageViewProps) => {
  const ctx = useContext(PageContext);

  return (
    <View
      style={{
        paddingTop: ctx.headerHeight,
        paddingBottom: ctx.footerHeight,
      }}
      {...props}
    >
      {props.children}
    </View>
  );
};

// --------------------------------------------------
// Page.Header.BackButton
// --------------------------------------------------

const BackButton = (props: ComponentProps<typeof Button>) => (
  <Button
    isIconOnly
    onPress={() => router.back()}
    size="sm"
    variant="ghost"
    {...props}
  >
    <Header.Icon icon={ArrowLeft01Icon} />
  </Button>
);

// --------------------------------------------------
// Page.Footer
// --------------------------------------------------

type PageFooterProps = ComponentProps<typeof View>;

const PageFooter = (props: PageFooterProps) => {
  const ctx = useContext(PageContext);

  const handleLayout = (
    e: Parameters<NonNullable<typeof props.onLayout>>[0]
  ) => {
    ctx.setFooterHeight(e.nativeEvent.layout.height);
    props.onLayout?.(e);
  };

  return (
    <View
      {...props}
      className={cn(
        "absolute bottom-0 z-50 w-full flex-row gap-3 bg-linear-to-t px-4 pt-4 pb-safe-offset-2",
        "from-0% from-background",
        "to-100% to-background/0",
        props.className
      )}
      onLayout={handleLayout}
    >
      {props.children}
    </View>
  );
};

// --------------------------------------------------
// Compound Component
// --------------------------------------------------

export const Page = withSlots(PageRoot, {
  Header: withSlots(PageHeader, {
    ...Header,
    BackButton,
  }),
  Footer: PageFooter,
  View: PageView,
  ScrollView: PageScrollView,
  LegendList: PageAnimatedLegendList,
  KeyboardAwareScrollView: PageKeyboardAwareScrollView,
});

export type {
  PageHeaderProps,
  PageRootProps,
  PageScrollViewProps,
  PageViewProps,
};
