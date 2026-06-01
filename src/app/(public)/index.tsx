import { Text } from "@/components/core/text";
import { cn } from "better-styled";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  View,
} from "react-native";

export const Page1 = () => (
  <View className="centered size-full overflow-hidden rounded-[50px] bg-surface p-0">
    <Text className="px-4 text-center" color="accent" variant="heading">
      {"Torneios, copas e ligas\nno ritmo do seu jogo."}
    </Text>
  </View>
);

export const Page2 = () => (
  <View className="centered size-full overflow-hidden rounded-[50px] bg-surface p-0">
    <View className="centered w-full flex-1">
      <Text
        className="px-4 text-center md:mb-40"
        color="accent"
        variant="heading"
      >
        {"Descubra.\nInscreva-se.\nAcompanhe."}
      </Text>
      <Text className="px-4 text-center text-muted/70 md:mt-20">
        Encontre competições por cidade, categoria e data. Veja chaves,
        horários, quadras e resultados sem perder o próximo jogo.
      </Text>
    </View>
    <Text className="absolute bottom-4 px-4 text-muted/40" size="xs">
      Do primeiro saque ao último ponto
    </Text>
  </View>
);

export const Page3 = () => (
  <View className="centered size-full gap-4 rounded-[50px] bg-surface px-4">
    <Text className="text-center" color="accent" variant="heading">
      Para jogadores, clubes e organizadores
    </Text>
    <Text className="text-center text-muted/70">
      O{" "}
      <Text color="accent" weight="semibold">
        BR Open
      </Text>{" "}
      conecta quem joga com quem organiza: inscrições, rankings, notificações e
      gestão de competições em uma experiência mobile.
    </Text>
    <Button
      className="w-full"
      onPress={() => router.navigate("/sign-in")}
      testID="get-started"
    >
      Começe a jogar agora
    </Button>
  </View>
);

const onboardingData = [
  <Page1 key={0} />,
  <Page2 key={1} />,
  <Page3 key={2} />,
];

export default function Onboarding() {
  const { width } = Dimensions.get("window");

  const ref = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const itemPadding = 30;
  const itemWidth = width - itemPadding * 2;
  const itemMargin = 5;

  const updateIndex = useCallback((newIndex: number) => {
    setActiveIndex(newIndex);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / itemWidth);
      if (index !== activeIndex) {
        updateIndex(index);
      }
    },
    [activeIndex, itemWidth, updateIndex]
  );

  const nextPage = (newIndex: number = activeIndex + 1) => {
    if (newIndex < onboardingData.length) {
      ref.current?.scrollToIndex({
        index: newIndex,
        animated: true,
        viewOffset: itemPadding - itemMargin,
      });
    }
  };

  const prevPage = (newIndex: number = activeIndex - 1) => {
    if (newIndex >= 0 && newIndex < onboardingData.length) {
      ref.current?.scrollToIndex({
        index: newIndex,
        animated: true,
        viewOffset: itemPadding - itemMargin,
      });
    }
  };

  return (
    <View className="flex-1 bg-background pt-safe-offset-2">
      <FlatList
        bounces={false}
        contentContainerClassName={"pt-4 pb-7 items-center"}
        contentContainerStyle={{
          paddingHorizontal: itemPadding - itemMargin,
        }}
        data={onboardingData}
        decelerationRate={"fast"}
        disableIntervalMomentum
        horizontal
        keyExtractor={(_item, index) => index.toString()}
        onScroll={onScroll}
        overScrollMode={"never"}
        pagingEnabled
        ref={ref}
        renderItem={({ item, index }) => (
          <Pressable
            disabled={index === activeIndex}
            onPress={() => {
              if (index === activeIndex) {
                return null;
              }
              if (index < activeIndex) {
                prevPage(index);
              } else {
                nextPage(index);
              }
            }}
            style={{
              width: itemWidth,
              marginHorizontal: itemMargin,
            }}
          >
            {item}
          </Pressable>
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToAlignment={"start"}
        snapToInterval={itemWidth + itemMargin * 2}
      />
      {/* dots */}
      <View className="mb-safe-offset-2 flex-row justify-center gap-2">
        {onboardingData.map((_, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              className={cn(
                "h-3.5 rounded-full transition-all duration-300",
                isActive ? "w-10 bg-accent" : "w-3.5 bg-accent-soft"
              )}
              disabled={isActive}
              key={index}
              onPress={() => {
                nextPage(index);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
