import { Image } from "@/components/core/image";
import { HugeIcons } from "@/components/ui/huge-icons";
import { formatLeagueMeta } from "@/lib/leagues/presentation";
import { Add01Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { router } from "expo-router";
import { Button, Card, Chip, PressableFeedback } from "heroui-native";
import { View } from "react-native";

type LeagueCardProps = {
  city?: string | null;
  coverUrl?: string | null;
  name?: string;
  onEditPress?: () => void;
  onPress?: () => void;
  state?: string | null;
};

export const LeagueCard = (props: LeagueCardProps) => (
  <PressableFeedback onPress={props.onPress}>
    <Card className="flex-1 p-2" variant="tertiary">
      <Image
        className="aspect-16/12 w-full rounded-2xl"
        contentFit="cover"
        fallback="blue"
        source={props.coverUrl ?? undefined}
      />
      <Chip className="absolute top-3.5 left-3.5" size="sm">
        Liga
      </Chip>
      {props.onEditPress ? (
        <Button
          className="absolute top-3.5 right-3.5"
          isIconOnly
          onPress={(event) => {
            event.stopPropagation();
            props.onEditPress?.();
          }}
          size="sm"
          variant="tertiary"
        >
          <HugeIcons className="size-4.5" icon={Edit02Icon} />
        </Button>
      ) : null}
      <Card.Body className="px-3 py-2">
        <Card.Title className="text-base" numberOfLines={2}>
          {props.name ?? "Liga"}
        </Card.Title>
        <Card.Description className="text-xs" numberOfLines={1}>
          {formatLeagueMeta(props.city, props.state)}
        </Card.Description>
      </Card.Body>
      <PressableFeedback.Highlight />
    </Card>
  </PressableFeedback>
);

export const CreateLeagueCard = () => (
  <PressableFeedback onPress={() => router.navigate("/settings/leagues/new")}>
    <Card className="flex-1 p-2" variant="tertiary">
      <View className="aspect-16/12 w-full opacity-0" />
      <Card.Body className="px-3 py-2 opacity-0">
        <Card.Title className="text-base" numberOfLines={2}>
          Nova liga
        </Card.Title>
        <Card.Description className="text-xs" numberOfLines={1}>
          Toque para criar uma nova liga
        </Card.Description>
      </Card.Body>
      <View className="absolute inset-2 items-center justify-center rounded-2xl bg-surface-secondary px-4">
        <View className="rounded-full bg-accent-soft p-2">
          <HugeIcons className="text-accent" icon={Add01Icon} />
        </View>
        <Card.Title className="pt-2 text-center text-base" numberOfLines={2}>
          Nova liga
        </Card.Title>
        <Card.Description className="text-center text-xs" numberOfLines={2}>
          Toque para criar uma nova liga
        </Card.Description>
      </View>
      <PressableFeedback.Highlight />
    </Card>
  </PressableFeedback>
);
