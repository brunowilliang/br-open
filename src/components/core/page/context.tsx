import { createContext, useContext, useMemo, useState } from "react";
import { type SharedValue, useSharedValue } from "react-native-reanimated";

type PageContextValue = {
  contentHeight: SharedValue<number>;
  footerHeight: number;
  headerHeight: number;
  /** `true` enquanto um Page.Header (não-overlay) ainda não mediu a altura:
   *  o Page.ScrollView segura a 1ª pintura do conteúdo até o inset landar. */
  isHeaderPending: boolean;
  scrollY: SharedValue<number>;
  setFooterHeight: (height: number) => void;
  setHeaderHeight: (height: number) => void;
  setHeaderPending: (isPending: boolean) => void;
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
  const [isHeaderPending, setHeaderPending] = useState(false);

  const value = useMemo(
    () => ({
      contentHeight,
      footerHeight,
      headerHeight,
      isHeaderPending,
      scrollY,
      setFooterHeight,
      setHeaderHeight,
      setHeaderPending,
      viewportHeight,
    }),
    [
      contentHeight,
      footerHeight,
      headerHeight,
      isHeaderPending,
      scrollY,
      viewportHeight,
    ]
  );

  return (
    <PageContext.Provider value={value}>{props.children}</PageContext.Provider>
  );
};
