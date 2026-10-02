import type { ApiOutputs } from "@convex/shared/api";
import { Location06Icon } from "@hugeicons/core-free-icons";
import { Chip } from "heroui-native";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { Image } from "@/components/core/image";
import { usePageContext } from "@/components/core/page/context";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { TournamentStatusChip } from "@/components/ui/tournament-status-chip";
import { formatCompetitionMeta } from "@/lib/format/competition";

/**
 * Stretch banner: reage ao scroll da página (SharedValue da UI thread) com o
 * efeito "stretch to zoom" no overscroll: a posição do scroll dirigindo a
 * escala do banner.
 */
export function TournamentBanner(props: {
  tournament: ApiOutputs["tournament"]["discovery"]["getById"];
}) {
  const { tournament } = props;
  const context = usePageContext();
  const bannerHeight = useSharedValue(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    bannerHeight.value = event.nativeEvent.layout.height;
  };

  const bannerAnimatedStyle = useAnimatedStyle(() => {
    const height = bannerHeight.value;

    if (height === 0) {
      return {};
    }

    const scrollY = context.scrollY.value;

    if (scrollY >= 0) {
      return {};
    }

    return {
      transform: [
        {
          translateY: interpolate(
            scrollY,
            [-height, 0],
            [-height / 2, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            scrollY,
            [-height, 0],
            [2, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <View className="h-90" onLayout={handleLayout}>
      <Animated.View className="absolute inset-0" style={bannerAnimatedStyle}>
        <Image
          className="absolute h-full w-full"
          contentFit="cover"
          fallback="blue"
          source={tournament.coverUrl ?? undefined}
          transition={250}
        />
        <View className="absolute h-full w-full bg-linear-to-t from-0 from-background" />
      </Animated.View>

      {/* Bloco do título como filho ABSOLUTO da base da capa: sobe pelo próprio
          tamanho sem medir altura — o marginTop medido pintava um frame com ele
          abaixo da capa (e o resto da página deslocado) antes de subir. */}
      <View className="absolute right-0 bottom-0 left-0 flex-row items-center gap-2 px-4">
        <Image
          className="size-28 rounded-3xl border-2 border-white/80 bg-surface"
          fallback="green"
          source={tournament.avatarUrl ?? undefined}
        />
        <View className="flex-1 gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Chip color="accent" size="sm" variant="primary">
              <Chip.Label>Torneio</Chip.Label>
            </Chip>
            <TournamentStatusChip
              registrationDeadlineAt={tournament.registrationDeadlineAt}
              status={tournament.status}
            />
          </View>
          <Text numberOfLines={2} variant="title">
            {tournament.name}
          </Text>
          <Chip color="default" size="sm">
            <HugeIcons className="size-3 text-muted" icon={Location06Icon} />
            <Chip.Label className="text-muted">
              {formatCompetitionMeta(tournament.city, tournament.state)}
            </Chip.Label>
          </Chip>
        </View>
      </View>
    </View>
  );
}
