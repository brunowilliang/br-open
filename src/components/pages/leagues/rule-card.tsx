import { HugeIcons } from "@/components/ui/huge-icons";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import {
  AccordionLayoutTransition,
  Checkbox,
  Description,
  Dialog,
  Label,
  PressableFeedback,
  Surface,
} from "heroui-native";
import { type ComponentProps, type ReactNode, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

/**
 * Shared form update options used by every league form field. Keeping a single
 * constant avoids drift between the rules and settings screens.
 */
export const fieldUpdateOptions = {
  shouldDirty: true,
  shouldTouch: true,
  shouldValidate: true,
} as const;

const RULE_CONTENT_ENTERING = FadeIn.duration(180);
const RULE_CONTENT_EXITING = FadeOut.duration(120);
const AnimatedSurface = Animated.createAnimatedComponent(Surface);

type RuleCardProps = {
  children: ReactNode;
  className?: string;
  info?: RuleInfo;
  variant?: ComponentProps<typeof Surface>["variant"];
};

/**
 * Surface wrapper shared by every rule/settings card. Applies the accordion
 * layout transition so children can expand/collapse smoothly. Optionally
 * renders a {@link RuleInfoButton} in the top-right corner.
 */
export function RuleCard(props: RuleCardProps) {
  const { children, className = "gap-4", info, variant = "default" } = props;

  return (
    <AnimatedSurface
      className={`relative ${className}`}
      layout={AccordionLayoutTransition}
      variant={variant}
    >
      {info ? <RuleInfoButton info={info} /> : null}
      {children}
    </AnimatedSurface>
  );
}

type RuleExpandableContentProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Animated wrapper shown when a toggle is enabled. Animates enter/exit with the
 * shared fade timing.
 */
export function RuleExpandableContent(props: RuleExpandableContentProps) {
  const { children, className = "gap-4" } = props;

  return (
    <Animated.View
      className={className}
      entering={RULE_CONTENT_ENTERING}
      exiting={RULE_CONTENT_EXITING}
      layout={AccordionLayoutTransition}
    >
      {children}
    </Animated.View>
  );
}

export type RuleInfo = {
  description: string;
  title: string;
};

type RuleInfoButtonProps = {
  info: RuleInfo;
};

/**
 * Icon-only pressable that opens an explanatory dialog. Positioned in the
 * top-right corner of a {@link RuleCard}. Self-contained: manages its own open
 * state.
 */
function RuleInfoButton(props: RuleInfoButtonProps) {
  const { info } = props;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <PressableFeedback
        accessibilityHint="Abre uma explicação sobre esta regra."
        accessibilityLabel={`Detalhes: ${info.title}`}
        accessibilityRole="button"
        className="absolute top-2 right-2 p-1"
        onPress={() => setIsOpen(true)}
      >
        <HugeIcons className="size-5 text-muted" icon={InformationCircleIcon} />
      </PressableFeedback>

      <Dialog
        isOpen={isOpen}
        onOpenChange={(nextOpen) => {
          setIsOpen(nextOpen);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="gap-4 p-5">
            <Dialog.Close className="absolute top-4 right-4 z-100" />
            <Dialog.Title>{info.title}</Dialog.Title>
            <Description>{info.description}</Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}

type ToggleableRuleCardProps = {
  children?: ReactNode;
  description: string;
  descriptionClassName?: string;
  enabled: boolean;
  error?: ReactNode;
  info?: RuleInfo;
  isDisabled?: boolean;
  label: string;
  onToggle: (nextEnabled: boolean) => void;
};

/**
 * Card with a checkbox toggle row in the header. When {@link enabled}, renders
 * its children inside a {@link RuleExpandableContent}. Use for rules that can
 * be turned on/off while preserving their last configured value.
 */
export function ToggleableRuleCard(props: ToggleableRuleCardProps) {
  const {
    children,
    description,
    descriptionClassName = "-mt-1.5",
    enabled,
    error,
    info,
    isDisabled,
    label,
    onToggle,
  } = props;

  return (
    <RuleCard info={info}>
      <RuleToggleRow
        description={description}
        descriptionClassName={descriptionClassName}
        enabled={enabled}
        isDisabled={isDisabled}
        label={label}
        onToggle={onToggle}
      />
      {error}

      {enabled && children ? (
        <RuleExpandableContent>{children}</RuleExpandableContent>
      ) : null}
    </RuleCard>
  );
}

type RuleToggleRowProps = {
  description: string;
  descriptionClassName?: string;
  enabled: boolean;
  isDisabled?: boolean;
  label: string;
  onToggle: (nextEnabled: boolean) => void;
};

/**
 * A standalone checkbox toggle row (checkbox + label + description) without a
 * card wrapper. Use inside {@link RuleExpandableContent} for nested toggles,
 * or pair with {@link RuleCard} when you need a custom layout. For the common
 * "toggleable card" pattern prefer {@link ToggleableRuleCard}.
 */
export function RuleToggleRow(props: RuleToggleRowProps) {
  const {
    description,
    descriptionClassName = "-mt-1.5 mb-1",
    enabled,
    isDisabled,
    label,
    onToggle,
  } = props;

  return (
    <PressableFeedback
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: enabled, disabled: isDisabled }}
      className="flex-row items-center gap-3"
      isDisabled={isDisabled}
      onPress={() => onToggle(!enabled)}
    >
      <Checkbox
        className="mt-0.5"
        isDisabled={isDisabled}
        isSelected={enabled}
        pointerEvents="none"
      />
      <View className="flex-1 gap-0" pointerEvents="none">
        <Label>{label}</Label>
        <Description className={descriptionClassName}>
          {description}
        </Description>
      </View>
    </PressableFeedback>
  );
}
