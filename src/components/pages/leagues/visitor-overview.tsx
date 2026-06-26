import type { ApiOutputs } from "@convex/shared/api";
import { Card, Separator } from "heroui-native";
import { Fragment } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  buildPreviewFeatures,
  type PreviewFeature,
} from "@/lib/leagues/league-preview-features";

type LeagueOverview = ApiOutputs["league"]["discovery"]["getById"];

function PreviewIcon(props: { icon: PreviewFeature["icon"] }) {
  return (
    <View className="centered size-10 rounded-2xl bg-accent-soft">
      <HugeIcons className="size-5 text-accent" icon={props.icon} />
    </View>
  );
}

export function VisitorOverview(props: { league: LeagueOverview }) {
  const { league } = props;
  const features = buildPreviewFeatures(league.ruleConfig);

  return (
    <View className="gap-4">
      {league.description ? <Text>{league.description}</Text> : null}

      <Card className="flex-1 gap-2 p-2">
        {features.map((feature, index) => (
          <Fragment key={feature.title}>
            {index > 0 ? <Separator className="mx-3" /> : null}
            <View>
              <Card.Header className="flex-row gap-2 p-2">
                <PreviewIcon icon={feature.icon} />
                <View className="flex-1">
                  <Text weight="medium">{feature.title}</Text>
                  <Text color="muted" variant="description">
                    {feature.description}
                  </Text>
                </View>
              </Card.Header>
            </View>
          </Fragment>
        ))}
      </Card>
    </View>
  );
}
