import { Add01Icon, ListChevronsDownUpIcon } from "@hugeicons/core-free-icons";
import type { HugeiconsProps } from "@hugeicons/react-native";
import { cn } from "better-styled";
import { Button } from "heroui-native";
import { EmptyState as HEmptyState } from "heroui-native-pro";
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import { HugeIcons } from "./huge-icons";

type EmptyStateProps = {
  className?: string;
  buttonIcon?: ComponentProps<typeof HugeIcons>["icon"] | null;
  buttonIsDisabled?: boolean;
  buttonLabel?: string;
  buttonOnPress?: () => void;
  buttonSize?: ComponentProps<typeof Button>["size"];
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  children?: ReactNode;
  description: string;
  descriptionClassName?: string;
  icon?: HugeiconsProps["icon"] | null;
  iconClassName?: string;
  /** Classes da bolha do ícone (cor de fundo por estado, ex.: `bg-success-soft`). */
  mediaClassName?: string;
  title: string;
  titleClassName?: string;
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
    descriptionClassName,
    icon = ListChevronsDownUpIcon,
    iconClassName,
    mediaClassName,
    title,
    titleClassName,
  } = props;

  return (
    <HEmptyState className={cn("gap-3.5 p-2", props.className)}>
      {icon ? (
        <HEmptyState.Media className={mediaClassName} variant="icon">
          <HugeIcons className={iconClassName} icon={icon} />
        </HEmptyState.Media>
      ) : null}
      <View>
        <HEmptyState.Title className={titleClassName}>
          {title}
        </HEmptyState.Title>
        <HEmptyState.Description className={descriptionClassName}>
          {description}
        </HEmptyState.Description>
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
