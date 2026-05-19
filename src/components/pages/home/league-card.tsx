import { Image } from "@/components/core/image";
import { Card, Chip, PressableFeedback } from "heroui-native";
import { formatLeagueMeta } from "@/lib/leagues/presentation";

type LeagueCardProps = {
  city?: string | null;
  name?: string;
  onPress?: () => void;
  state?: string | null;
};

export default function LeagueCard(props: LeagueCardProps) {
  return (
    <PressableFeedback onPress={props.onPress}>
      <Card className="flex-1 p-2" variant="tertiary">
        <Image
          className="aspect-square w-full rounded-2xl"
          contentFit="cover"
        />
        <Chip className="absolute top-3.5 left-3.5" size="sm">
          Liga
        </Chip>
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
}
