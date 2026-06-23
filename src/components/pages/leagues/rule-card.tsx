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

export type RuleInfo = {
  description: string;
  title: string;
};

type RuleCardProps = {
  children: ReactNode;
  className?: string;
  info?: RuleInfo;
  variant?: ComponentProps<typeof Surface>["variant"];
};

/**
 * Surface wrapper shared by every rule/settings card. Applies the accordion
 * layout transition so children can expand/collapse smoothly. Optionally
 * renders an info trigger in the top-right corner.
 *
 * The info dialog is rendered as a sibling of the surface (not a child)
 * because `Dialog` always reserves layout space for its root view, which would
 * push the card content down. The open state lives here so the trigger (inside
 * the surface) and the dialog (outside) can share it.
 */
export function RuleCard(props: RuleCardProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <>
      <AnimatedSurface
        className={`relative ${props.className ?? "gap-4"}`}
        layout={AccordionLayoutTransition}
        variant={props.variant ?? "default"}
      >
        {props.info ? (
          <RuleInfoTrigger
            onPress={() => {
              setIsInfoOpen(true);
            }}
            title={props.info.title}
          />
        ) : null}
        {props.children}
      </AnimatedSurface>

      {props.info ? (
        <RuleInfoDialog
          info={props.info}
          isOpen={isInfoOpen}
          onOpenChange={setIsInfoOpen}
        />
      ) : null}
    </>
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
  return (
    <Animated.View
      className={props.className ?? "gap-4"}
      entering={RULE_CONTENT_ENTERING}
      exiting={RULE_CONTENT_EXITING}
      layout={AccordionLayoutTransition}
    >
      {props.children}
    </Animated.View>
  );
}

type RuleInfoTriggerProps = {
  onPress: () => void;
  title: string;
};

/**
 * Icon-only pressable that opens the info dialog. Positioned in the top-right
 * corner of a {@link RuleCard}. Does not own any dialog — the card wires the
 * open state to a sibling {@link RuleInfoDialog}.
 */
function RuleInfoTrigger(props: RuleInfoTriggerProps) {
  return (
    <PressableFeedback
      accessibilityHint="Abre uma explicação sobre esta regra."
      accessibilityLabel={`Detalhes: ${props.title}`}
      accessibilityRole="button"
      className="absolute top-2 right-2 p-1"
      onPress={props.onPress}
    >
      <HugeIcons className="size-5 text-muted" icon={InformationCircleIcon} />
    </PressableFeedback>
  );
}

type RuleInfoDialogProps = {
  info: RuleInfo;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
};

/**
 * Read-only explanatory dialog rendered as a sibling of the card surface so it
 * never affects the card layout.
 */
function RuleInfoDialog(props: RuleInfoDialogProps) {
  return (
    <Dialog isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4 p-5">
          <Dialog.Close className="absolute top-4 right-4 z-100" />
          <Dialog.Title>{props.info.title}</Dialog.Title>
          <Description>{props.info.description}</Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

type ToggleableRuleCardProps = {
  children?: ReactNode;
  description: string;
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
  return (
    <RuleCard info={props.info}>
      <RuleToggleRow
        description={props.description}
        enabled={props.enabled}
        isDisabled={props.isDisabled}
        label={props.label}
        onToggle={props.onToggle}
      />
      {props.error}

      {props.enabled && props.children ? (
        <RuleExpandableContent>{props.children}</RuleExpandableContent>
      ) : null}
    </RuleCard>
  );
}

type RuleToggleRowProps = {
  description: string;
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
  return (
    <PressableFeedback
      accessibilityLabel={props.label}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: props.enabled,
        disabled: props.isDisabled,
      }}
      className="flex-row items-center gap-3"
      isDisabled={props.isDisabled}
      onPress={() => {
        props.onToggle(!props.enabled);
      }}
    >
      <Checkbox
        className="mt-0.5"
        isDisabled={props.isDisabled}
        isSelected={props.enabled}
        pointerEvents="none"
      />
      <View className="flex-1" pointerEvents="none">
        <Label>{props.label}</Label>
        <Description className="-mt-1.5 mb-1">{props.description}</Description>
      </View>
    </PressableFeedback>
  );
}
