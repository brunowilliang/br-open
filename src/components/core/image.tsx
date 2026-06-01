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
export const LogoImage = require("../../../assets/images/android-icon-foreground.png");

export const ImageStyled = styled(withUniwind(ExpoImage), {
  base: {
    placeholderContentFit: "cover",
    transition: 300,
  },
  variants: {
    fallback: {
      blue: {
        placeholder: blueFallback,
      },
      green: {
        placeholder: greenFallback,
      },
    },
  },
  defaultVariants: {
    fallback: "blue",
  },
});

export const ImageBackgroundStyled = styled(withUniwind(ExpoImageBackground), {
  base: {
    placeholderContentFit: "cover",
    transition: 300,
  },
  variants: {
    fallback: {
      blue: {
        placeholder: blueFallback,
      },
      green: {
        placeholder: greenFallback,
      },
    },
  },
  defaultVariants: {
    fallback: "blue",
  },
});

const ImageBase = (props: ComponentProps<typeof ImageStyled>) => (
  <View className={cn("overflow-hidden", props.className)}>
    <ImageStyled {...props} className="flex-1" />
  </View>
);

const ImageBackgroundBase = (props: ComponentProps<typeof ImageStyled>) => (
  <View className={cn("overflow-hidden", props.className)}>
    <ImageStyled {...props} className="flex-1" />
  </View>
);

export const Image = withSlots(ImageBase, {
  Background: ImageBackgroundBase,
});
