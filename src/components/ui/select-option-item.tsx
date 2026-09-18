import type { ReactNode } from "react";

import { cn } from "better-styled";
import { Select } from "heroui-native";
import { View } from "react-native";

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
    <Select.Item disabled={isDisabled} label={label} value={value}>
      {({ isDisabled: itemIsDisabled, isSelected }) => (
        <View
          className={cn(
            "flex-1 flex-row items-center justify-between rounded-xl px-4",
            isSelected && "-my-2.5 bg-surface-secondary py-2.5",
            itemIsDisabled && "opacity-50"
          )}
        >
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
          <Select.ItemIndicator />
        </View>
      )}
    </Select.Item>
  </>
);
