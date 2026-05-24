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
      {({ isDisabled: itemIsDisabled, isSelected }) => {
        let itemLabelClassName = "font-normal text-foreground";

        if (itemIsDisabled) {
          itemLabelClassName = "font-normal text-muted";
        }

        if (isSelected) {
          itemLabelClassName = "font-semibold text-accent";
        }

        return (
          <View
            className={cn(
              "flex-1 flex-row items-center rounded-xl px-5 py-3.5",
              isSelected && "bg-surface-secondary",
              itemIsDisabled && "opacity-50"
            )}
          >
            <View className="flex-1">
              <Select.ItemLabel className={itemLabelClassName} />
              {description ? (
                <Select.ItemDescription>{description}</Select.ItemDescription>
              ) : null}
            </View>
            <Select.ItemIndicator />
          </View>
        );
      }}
    </Select.Item>
  </>
);
