import { Image } from "@/components/core/image";
import { HugeIcons } from "@/components/ui/huge-icons";
import { formatLeagueMeta } from "@/lib/leagues/presentation";
import { Add01Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { Button, Card, Chip, PressableFeedback } from "heroui-native";
import { View } from "react-native";

type CompetitionCardProps = {
  chipLabel?: string;
  city?: string | null;
  coverUrl?: string | null;
  name?: null | string;
  onEditPress?: () => void;
  onPress?: () => void;
  state?: string | null;
};

/** Card universal de competição (RUL-0005) — o chip identifica Liga ou Torneio.
 * Altura estável por linha (IBX-0021): corpo intrínseco constante de 64px de
 * conteúdo — cidade em caixa fixa de 1 linha (min-h-4) colada no título com 2
 * linhas reservadas (min-h-12, o vazio da reserva fica NO FIM do card). No
 * card de criação título e descrição ficam colados em caixas naturais,
 * centrados na mesma área de 64px de conteúdo (min-h-20 no body, que inclui o
 * py-2 de 16px — min-height no RN é border-box). O LegendList posiciona cada
 * célula com position absolute e não estica colunas como o FlatList. */
export const CompetitionCard = (props: CompetitionCardProps) => (
  <PressableFeedback onPress={props.onPress}>
    <Card className="flex-1 p-2">
      <Image
        className="aspect-16/12 w-full rounded-2xl"
        contentFit="cover"
        fallback="blue"
        source={props.coverUrl ?? undefined}
      />
      <Chip className="absolute top-3.5 left-3.5" size="sm">
        {props.chipLabel ?? "Liga"}
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
        <Card.Description className="min-h-4 text-xs" numberOfLines={1}>
          {formatLeagueMeta(props.city, props.state)}
        </Card.Description>
        <Card.Title className="min-h-12 text-base" numberOfLines={2}>
          {props.name ?? props.chipLabel ?? "Liga"}
        </Card.Title>
      </Card.Body>
      <PressableFeedback.Highlight />
    </Card>
  </PressableFeedback>
);

type CreateCompetitionCardProps = {
  description: string;
  label: string;
  onPress: () => void;
};

export const CreateCompetitionCard = (props: CreateCompetitionCardProps) => (
  <PressableFeedback onPress={props.onPress}>
    <Card className="flex-1 overflow-hidden p-2">
      <View className="aspect-16/12 w-full items-center justify-center rounded-2xl bg-surface-secondary">
        <View className="rounded-full bg-accent-soft p-2">
          <HugeIcons className="text-accent" icon={Add01Icon} />
        </View>
      </View>
      <Card.Body className="min-h-20 justify-center px-3 py-2">
        <Card.Title className="text-center text-base" numberOfLines={2}>
          {props.label}
        </Card.Title>
        <Card.Description className="text-center text-xs" numberOfLines={2}>
          {props.description}
        </Card.Description>
      </Card.Body>
      <PressableFeedback.Highlight />
    </Card>
  </PressableFeedback>
);
