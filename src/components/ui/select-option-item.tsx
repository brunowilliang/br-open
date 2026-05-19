import type { ReactNode } from "react";
import { View } from "react-native";

import { cn } from "better-styled";
import { Select } from "heroui-native";

export type SelectOptionItemProps = {
  description?: ReactNode;
  label: string;
  value: string;
};

export const SelectOptionItem = ({
  description,
  label,
  value,
}: SelectOptionItemProps) => (
  <>
    <Select.Item className="p-0" label={label} value={value}>
      {({ isSelected }) => (
        <View
          className={cn(
            "flex-1 flex-row items-center rounded-xl px-5 py-3.5",
            isSelected && "bg-surface-secondary"
          )}
        >
          <View className="flex-1">
            <Select.ItemLabel
              className={
                isSelected
                  ? "font-semibold text-accent"
                  : "font-normal text-foreground"
              }
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
