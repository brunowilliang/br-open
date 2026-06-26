import { memo } from "react";
import { View } from "react-native";

import { Image } from "@/components/core/image";
import { Text } from "@/components/core/text";

type ScheduleCardProps = {
  challengedAvatarUrl?: string | null;
  challengedFullName: string;
  challengerAvatarUrl?: string | null;
  challengerFullName: string;
  courtName: string;
  startMinute: number;
};

function formatMinute(minute: number) {
  const hour = Math.floor(minute / 60);
  const currentMinute = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
}

function ScheduleCardImpl(props: ScheduleCardProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface-secondary p-3">
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
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-1">
          <Text className="max-w-[40%]" numberOfLines={1} variant="description">
            {props.challengerFullName}
          </Text>
          <Text className="text-muted" variant="description">
            x
          </Text>
          <Text className="max-w-[40%]" numberOfLines={1} variant="description">
            {props.challengedFullName}
          </Text>
        </View>
        <Text color="muted" numberOfLines={1} variant="description">
          {`${formatMinute(props.startMinute)} · ${props.courtName}`}
        </Text>
      </View>
    </View>
  );
}

export const ScheduleCard = memo(ScheduleCardImpl);
