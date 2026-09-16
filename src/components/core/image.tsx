import { cn, styled, withSlots } from "better-styled";
import {
  Image as ExpoImage,
  ImageBackground as ExpoImageBackground,
} from "expo-image";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { withUniwind } from "uniwind";

const blueFallback = require("../../../assets/images/fallbacks/blue.jpg");
const greenFallback = require("../../../assets/images/fallbacks/green.jpg");
const whiteFallback = require("../../../assets/images/fallbacks/white.jpg");
const blackFallback = require("../../../assets/images/fallbacks/black.jpg");
export const LogoImage = require("../../../assets/images/android-icon-foreground.png");

export const ImageStyled = styled(withUniwind(ExpoImage), {
  base: {
    placeholderContentFit: "cover",
    transition: 300,
  },
  defaultVariants: {
    fallback: "blue",
  },
  variants: {
    fallback: {
      black: {
        placeholder: blackFallback,
      },
      blue: {
        placeholder: blueFallback,
      },
      green: {
        placeholder: greenFallback,
      },
      none: {
        placeholder: undefined,
      },
      white: {
        placeholder: whiteFallback,
      },
    },
  },
});

export const ImageBackgroundStyled = styled(withUniwind(ExpoImageBackground), {
  base: {
    placeholderContentFit: "cover",
    transition: 300,
  },
  defaultVariants: {
    fallback: "blue",
  },
  variants: {
    fallback: {
      black: {
        placeholder: blackFallback,
      },
      blue: {
        placeholder: blueFallback,
      },
      green: {
        placeholder: greenFallback,
      },
      white: {
        placeholder: whiteFallback,
      },
    },
  },
});

const ImageBase = (props: ComponentProps<typeof ImageStyled>) => (
  <View
    className={cn("overflow-hidden", props.className)}
    style={{
      borderCurve: "continuous",
    }}
  >
    <ImageStyled {...props} className="flex-1" />
  </View>
);

const ImageBackgroundBase = (props: ComponentProps<typeof ImageStyled>) => (
  <View
    className={cn("overflow-hidden", props.className)}
    style={{
      borderCurve: "continuous",
    }}
  >
    <ImageStyled {...props} className="flex-1" />
  </View>
);

export const Image = withSlots(ImageBase, {
  Background: ImageBackgroundBase,
});
