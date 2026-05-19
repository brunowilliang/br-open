import { cn, styled, withSlots } from "better-styled";
import { Image as ExpoImage } from "expo-image";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { withUniwind } from "uniwind";

export const ImageStyled = styled(withUniwind(ExpoImage), {
  base: {
    placeholder: {
      uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
    },
    placeholderContentFit: "cover",
    transition: 300,
  },
  variants: {
    fallback: {
      blue: {
        placeholder: {
          uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
        },
      },
      green: {
        placeholder: {
          uri: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
        },
      },
    },
  },
});

const ImageBase = (props: ComponentProps<typeof ImageStyled>) => (
  <View className={cn("overflow-hidden", props.className)}>
    <ImageStyled {...props} className="flex-1" />
  </View>
);

export const Image = withSlots(ImageBase, {});
