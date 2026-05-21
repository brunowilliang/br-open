import { Add01Icon, ListChevronsDownUpIcon } from "@hugeicons/core-free-icons";
import type { HugeiconsProps } from "@hugeicons/react-native";
import { Button } from "heroui-native";
import { EmptyState as HEmptyState } from "heroui-native-pro";
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import { HugeIcons } from "./huge-icons";

type EmptyStateProps = {
  buttonIcon?: ComponentProps<typeof HugeIcons>["icon"] | null;
  buttonIsDisabled?: boolean;
  buttonLabel?: string;
  buttonOnPress?: () => void;
  buttonSize?: ComponentProps<typeof Button>["size"];
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  children?: ReactNode;
  description: string;
  icon?: HugeiconsProps["icon"] | null;
  title: string;
};

export const EmptyState = (props: EmptyStateProps) => {
  const {
    buttonIcon = Add01Icon,
    buttonIsDisabled,
    buttonLabel,
    buttonOnPress,
    buttonSize,
    buttonVariant,
    children,
    description,
    icon = ListChevronsDownUpIcon,
    title,
  } = props;

  return (
    <HEmptyState className="gap-3.5 p-2">
      {icon ? (
        <HEmptyState.Media variant="icon">
          <HugeIcons icon={icon} />
        </HEmptyState.Media>
      ) : null}
      <View>
        <HEmptyState.Title>{title}</HEmptyState.Title>
        <HEmptyState.Description>{description}</HEmptyState.Description>
      </View>
      {children}
      {buttonLabel ? (
        <HEmptyState.Content className="mt-2 w-full gap-2.5">
          <Button
            isDisabled={buttonIsDisabled}
            onPress={buttonOnPress}
            size={buttonSize}
            variant={buttonVariant}
          >
            <Button.Label>{buttonLabel}</Button.Label>
            {buttonIcon ? (
              <HugeIcons className="text-accent-foreground" icon={buttonIcon} />
            ) : null}
          </Button>
        </HEmptyState.Content>
      ) : null}
    </HEmptyState>
  );
};
