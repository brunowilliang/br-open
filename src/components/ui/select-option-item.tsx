import type { ReactNode } from "react";
import { View } from "react-native";

import { cn } from "better-styled";
import { Select } from "heroui-native";

export type SelectOptionItemProps = {
  description?: ReactNode;
  isDisabled?: boolean;
  label: string;
  value: string;
};

export const SelectOptionItem = ({
  description,
  isDisabled,
  label,
  value,
}: SelectOptionItemProps) => (
  <>
    <Select.Item
      className="p-0"
      disabled={isDisabled}
      label={label}
      value={value}
    >
      {({ isDisabled: itemIsDisabled, isSelected }) => (
        <View
          className={cn(
            "flex-1 flex-row items-center rounded-xl px-4",
            isSelected && "-my-2.5 bg-surface-secondary py-2.5",
            itemIsDisabled && "opacity-50"
          )}
        >
          <View className="flex-1">
            <Select.ItemLabel
              className={cn(
                "font-normal text-foreground",
                itemIsDisabled && "text-muted",
                isSelected && "font-semibold text-accent"
              )}
            />
            {description ? (
              <Select.ItemDescription>{description}</Select.ItemDescription>
            ) : null}
          </View>
          <Select.ItemIndicator />
        </View>
      )}
    </Select.Item>
  </>
);
