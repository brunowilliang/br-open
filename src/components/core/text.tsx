import { styled } from "better-styled";
import type { ComponentProps } from "react";
import { Text as RNText } from "react-native";

export const Text = styled(RNText, {
  base: {
    className: "text-foreground font-normal",
    allowFontScaling: false,
    adjustsFontSizeToFit: false,
    maxFontSizeMultiplier: 1.5,
    minimumFontScale: 0.5,
  },
  variants: {
    variant: {
      display: { className: "text-4xl font-bold tracking-tight" },
      heading: { className: "text-2xl font-semibold" },
      title: { className: "text-lg font-semibold" },
      body: { className: "text-base font-normal" },
      description: { className: "text-sm" },
      label: { className: "text-xs font-medium uppercase tracking-wide" },
    },
    size: {
      xs: { className: "text-xs" },
      sm: { className: "text-sm" },
      base: { className: "text-base" },
      lg: { className: "text-lg" },
      xl: { className: "text-xl" },
      "2xl": { className: "text-2xl" },
      "3xl": { className: "text-3xl" },
      "4xl": { className: "text-4xl" },
    },
    weight: {
      light: { className: "font-light" },
      normal: { className: "font-normal" },
      medium: { className: "font-medium" },
      semibold: { className: "font-semibold" },
      bold: { className: "font-bold" },
    },
    color: {
      foreground: { className: "text-foreground" },
      muted: { className: "text-muted" },
      accent: { className: "text-accent" },
      success: { className: "text-success" },
      warning: { className: "text-warning" },
      danger: { className: "text-danger" },
    },
  },
  defaultVariants: {
    variant: "body",
    color: "foreground",
  },
});

export type TextProps = ComponentProps<typeof Text>;
