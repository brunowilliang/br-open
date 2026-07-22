import { styled } from "better-styled";
import type { ComponentProps } from "react";
import { Text as RNText } from "react-native";

export const Text = styled(RNText, {
  base: {
    className: "text-foreground font-normal",
    // allowFontScaling defaults to true on RN; we keep Dynamic Type enabled
    // (accessibility) and cap growth so layouts don't break at the largest
    // accessibility sizes. The previous `allowFontScaling: false` silently
    // ignored the user's font-size preference, which is an a11y regression.
    maxFontSizeMultiplier: 1.5,
  },
  defaultVariants: {
    color: "foreground",
    variant: "body",
  },
  variants: {
    color: {
      accent: { className: "text-accent" },
      danger: { className: "text-danger" },
      foreground: { className: "text-foreground" },
      muted: { className: "text-muted" },
      success: { className: "text-success" },
      warning: { className: "text-warning" },
    },
    size: {
      "2xl": { className: "text-2xl" },
      "3xl": { className: "text-3xl" },
      "4xl": { className: "text-4xl" },
      base: { className: "text-base" },
      lg: { className: "text-lg" },
      sm: { className: "text-sm" },
      xl: { className: "text-xl" },
      xs: { className: "text-xs" },
    },
    variant: {
      body: { className: "text-base font-normal" },
      description: { className: "text-sm" },
      display: { className: "text-4xl font-bold tracking-tight" },
      heading: { className: "text-2xl font-semibold" },
      label: { className: "text-xs font-medium uppercase tracking-wide" },
      title: { className: "text-lg font-semibold" },
    },
    weight: {
      bold: { className: "font-bold" },
      light: { className: "font-light" },
      medium: { className: "font-medium" },
      normal: { className: "font-normal" },
      semibold: { className: "font-semibold" },
    },
  },
});

export type TextProps = ComponentProps<typeof Text>;
