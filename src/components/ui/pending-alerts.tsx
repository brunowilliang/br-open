import type {
  PendingItem,
  PendingSurface,
} from "@convex/domains/pendings/contract";
import { Fragment } from "react";
import { View } from "react-native";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";

import { ErrorMessage } from "@/components/ui/error-state";
import {
  WidgetAlert,
  type WidgetAlertSwipeClassNames,
} from "@/components/ui/widget-alert";
import {
  PENDING_ALERT_STATUS,
  resolvePendingAction,
} from "@/lib/pendings/pendings-view";
import { usePendingActionRunner } from "@/lib/pendings/use-pending-action-runner";

type PendingAlertsProps = {
  dismissSurface?: PendingSurface;
  isError?: boolean;
  isLoading?: boolean;
  isSwipeEnabled?: boolean;
  items: PendingItem[];
  onActionPerformed?: () => Promise<void> | void;
  /** Par espelhado do gutter do pai, para o sangramento do gesto. */
  swipeClassNames?: WidgetAlertSwipeClassNames;
};

export function PendingAlerts(props: PendingAlertsProps) {
  const { dismissPendingItem, isActionPending, runAction } =
    usePendingActionRunner({ onPerformed: props.onActionPerformed });
  // Const local: o narrowing da prop precisa sobreviver ao closure do handler.
  const dismissSurface = props.dismissSurface;

  if (props.isLoading || props.items.length === 0) {
    return null;
  }

  if (props.isError) {
    return (
      <ErrorMessage message="Não foi possível carregar suas pendências." />
    );
  }

  return (
    <View className="gap-3">
      {props.items.map((item) => {
        const primary = resolvePendingAction(item);
        const secondary = item.secondaryAction
          ? resolvePendingAction({ ...item, action: item.secondaryAction })
          : null;
        // Cada botão resolve a SUA ação: o Recusar já mandou `accept: true`.
        const button = (label?: string | null, resolution?: typeof primary) =>
          label && resolution
            ? {
                isDisabled: isActionPending(resolution),
                label,
                onPress: () => runAction(resolution),
              }
            : undefined;

        const card = (
          <WidgetAlert
            action={button(item.actionLabel, primary)}
            description={item.description}
            dismissAction={
              dismissSurface
                ? {
                    isDisabled: dismissPendingItem.isPending,
                    onPress: () => {
                      dismissPendingItem.mutate({
                        itemId: item.id,
                        surface: dismissSurface,
                      });
                    },
                  }
                : undefined
            }
            isSwipeEnabled={props.isSwipeEnabled}
            secondaryAction={button(item.secondaryActionLabel, secondary)}
            status={PENDING_ALERT_STATUS[item.severity]}
            swipeClassNames={props.swipeClassNames}
            title={item.title}
          />
        );

        // Sem superfície de dispensa a casa não anima nada: o item sai como saía.
        if (!dismissSurface) {
          return <Fragment key={item.id}>{card}</Fragment>;
        }

        return (
          // Fade no item que sai; os irmãos sobem pelo layout. Só o layout mexe no espaço.
          <Animated.View
            exiting={FadeOut.duration(180)}
            key={item.id}
            layout={LinearTransition}
          >
            {card}
          </Animated.View>
        );
      })}
    </View>
  );
}
