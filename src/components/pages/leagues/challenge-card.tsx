import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import { Button, Card, Chip, Menu } from "heroui-native";
import { memo } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import type { ChallengeMenuAction } from "@/lib/leagues/challenge-menu-actions";

type ChallengeStatusChip = {
  color: "accent" | "danger" | "default" | "success" | "warning";
  label: string;
  variant: "primary" | "secondary" | "soft" | "tertiary";
};

type ChallengeCardScoreSummary = {
  challengerScore: string;
  challengedScore: string;
  setsSummary?: string | null;
};

type ChallengeCardProps = {
  challengedFullName: string;
  challengedScoreClass: string;
  challengerFullName: string;
  challengerScoreClass: string;
  challengedAvatarUrl?: string | null;
  challengerAvatarUrl?: string | null;
  isMenuDisabled: boolean;
  menuActions: ChallengeMenuAction[];
  proposalSummary: string;
  scoreSummary?: ChallengeCardScoreSummary | null;
  statusChip: ChallengeStatusChip;
  winnerChallenged: boolean;
  winnerChallenger: boolean;
};

function ChallengeCardImpl(props: ChallengeCardProps) {
  return (
    <Card className="p-3">
      <View className="flex-row items-center gap-3">
        <View className="relative h-13 w-12">
          <Image
            className="absolute top-0 left-0 size-8.5 rounded-full border border-separator"
            fallback="green"
            source={props.challengerAvatarUrl}
          />
          <Image
            className="absolute right-0 bottom-0 size-8.5 rounded-full border border-separator"
            fallback="blue"
            source={props.challengedAvatarUrl}
          />
        </View>
        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row items-center justify-between gap-3">
            <Chip
              color={props.statusChip.color}
              variant={props.statusChip.variant}
            >
              {props.statusChip.label}
            </Chip>
            {props.menuActions.length > 0 ? (
              <Menu>
                <Menu.Trigger asChild>
                  <Button
                    className="size-7"
                    isDisabled={props.isMenuDisabled}
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                  >
                    <HugeIcons className="size-4.5" icon={MoreVerticalIcon} />
                  </Button>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Overlay className="bg-backdrop" />
                  <Menu.Content presentation="popover" width={240}>
                    {props.menuActions.map((action) => (
                      <Menu.Item key={action.id} onPress={action.onPress}>
                        <Menu.ItemTitle
                          className={
                            action.isDanger ? "text-danger" : undefined
                          }
                        >
                          {action.label}
                        </Menu.ItemTitle>
                        <HugeIcons
                          className={cn(
                            "size-4.5",
                            action.isDanger ? "text-danger" : ""
                          )}
                          icon={action.icon}
                        />
                      </Menu.Item>
                    ))}
                  </Menu.Content>
                </Menu.Portal>
              </Menu>
            ) : null}
          </View>

          <View className="gap-1">
            <View className="flex-row items-center gap-1">
              <Text
                className={cn(
                  "max-w-[40%]",
                  props.winnerChallenger ? "font-semibold text-accent" : ""
                )}
                numberOfLines={1}
                variant="description"
              >
                {props.challengerFullName}
              </Text>
              <Text
                className={cn(props.challengerScoreClass)}
                variant="description"
              >
                {props.scoreSummary?.challengerScore ?? "-"}
              </Text>
              <Text className="text-muted" variant="description">
                x
              </Text>
              <Text
                className={cn(props.challengedScoreClass)}
                variant="description"
              >
                {props.scoreSummary?.challengedScore ?? "-"}
              </Text>
              <Text
                className={cn(
                  "max-w-[40%]",
                  props.winnerChallenged ? "font-semibold text-accent" : ""
                )}
                numberOfLines={1}
                variant="description"
              >
                {props.challengedFullName}
              </Text>
            </View>
            {props.scoreSummary?.setsSummary ? (
              <Text className="text-muted" variant="description">
                {props.scoreSummary.setsSummary}
              </Text>
            ) : null}
          </View>

          <Text color="muted" numberOfLines={2} variant="description">
            {props.proposalSummary}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export const ChallengeCard = memo(ChallengeCardImpl);
