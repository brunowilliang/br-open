import { createContext, useContext, useMemo, useState } from "react";
import { type SharedValue, useSharedValue } from "react-native-reanimated";

type PageContextValue = {
  contentHeight: SharedValue<number>;
  footerHeight: number;
  headerHeight: number;
  scrollY: SharedValue<number>;
  setFooterHeight: (height: number) => void;
  setHeaderHeight: (height: number) => void;
  viewportHeight: SharedValue<number>;
};

const PageContext = createContext<PageContextValue | null>(null);

export function usePageContext() {
  const context = useContext(PageContext);

  if (context === null) {
    throw new Error("Core Page components must be rendered inside <Page>.");
  }

  return context;
}

type PageRootProps = {
  children: React.ReactNode;
};

export const PageRoot = (props: PageRootProps) => {
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);

  const value = useMemo(
    () => ({
      contentHeight,
      footerHeight,
      headerHeight,
      scrollY,
      setFooterHeight,
      setHeaderHeight,
      viewportHeight,
    }),
    [contentHeight, footerHeight, headerHeight, scrollY, viewportHeight]
  );

  return (
    <PageContext.Provider value={value}>{props.children}</PageContext.Provider>
  );
};
