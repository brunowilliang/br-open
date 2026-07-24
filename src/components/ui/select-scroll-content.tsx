import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import { ScrollShadow } from "@/components/ui/scroll-shadow";
import { Select } from "heroui-native";

type SelectScrollContentProps = {
  /** Optional heading rendered above the scrollable list (Select.ListLabel). */
  label?: ReactNode;
  /** Max height of the scrollable area before it starts scrolling. */
  maxHeight?: number;
  /** Width strategy forwarded to Select.Content (defaults to "trigger"). */
  width?: "content-fit" | "full" | "trigger" | number;
  /** Select option items (usually SelectOptionItem list). */
  children: ReactNode;
};

/**
 * Standard scrollable Select.Content used across the app.
 *
 * Mirrors the pattern from the challenge time picker: wraps the options in a
 * ScrollShadow + ScrollView so long lists scroll internally instead of
 * overflowing the popover. Short lists simply render without a scrollbar.
 */
export function SelectScrollContent({
  label,
  maxHeight = 450,
  width = "trigger",
  children,
}: SelectScrollContentProps) {
  return (
    <Select.Content className="w-full" presentation="popover" width={width}>
      {label ? (
        <Select.ListLabel className="mb-2">{label}</Select.ListLabel>
      ) : null}
      <ScrollShadow color="surface" style={{ maxHeight }}>
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </ScrollShadow>
    </Select.Content>
  );
}
