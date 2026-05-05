import { cn, withSlots } from "better-styled";
import type { ComponentProps } from "react";
import { createContext, useContext, useState } from "react";
import { ScrollView as RNScrollView, View } from "react-native";

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
// Compound Component
// --------------------------------------------------

export const Page = withSlots(PageRoot, {
  Header: withSlots(PageHeader, {
    ...Header,
  }),
  View: PageView,
  ScrollView: PageScrollView,
});

export type {
  PageHeaderProps,
  PageRootProps,
  PageScrollViewProps,
  PageViewProps,
};
