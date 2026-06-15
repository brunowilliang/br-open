type PageInsetInput = {
  footerHeight: number;
  headerHeight: number;
};

type PageInsetStyle = {
  paddingBottom?: number;
  paddingTop?: number;
};

export function buildPageInsetStyle(input: PageInsetInput): PageInsetStyle {
  return {
    ...(input.headerHeight > 0 ? { paddingTop: input.headerHeight } : {}),
    ...(input.footerHeight > 0 ? { paddingBottom: input.footerHeight } : {}),
  };
}
