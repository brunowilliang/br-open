import {
  createNavigatorFactory,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type StackNavigationState,
  type StaticConfig,
  type TypedNavigator,
  useNavigationBuilder,
} from "expo-router/react-navigation";

import {
  BottomSheetRouter,
  type BottomSheetRouterOptions,
} from "./bottom-sheet-router";
import { BottomSheetView } from "./bottom-sheet-view";
import type {
  BottomSheetActionHelpers,
  BottomSheetNavigationEventMap,
  BottomSheetNavigationOptions,
  BottomSheetNavigationProp,
  BottomSheetNavigationState,
  BottomSheetNavigatorProps,
} from "./types";

function BottomSheetNavigator({
  id,
  children,
  screenListeners,
  screenOptions,
  ...rest
}: BottomSheetNavigatorProps) {
  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder<
      BottomSheetNavigationState<ParamListBase>,
      BottomSheetRouterOptions,
      BottomSheetActionHelpers<ParamListBase>,
      BottomSheetNavigationOptions,
      BottomSheetNavigationEventMap
    >(BottomSheetRouter, {
      id,
      children,
      screenListeners,
      screenOptions,
    });

  return (
    <NavigationContent>
      <BottomSheetView
        {...rest}
        descriptors={descriptors}
        navigation={navigation}
        state={state}
      />
    </NavigationContent>
  );
}

export const createBottomSheetNavigator = <
  const ParamList extends ParamListBase,
  const NavigatorID extends string | undefined = undefined,
  const TypeBag extends NavigatorTypeBagBase = {
    ParamList: ParamList;
    NavigatorID: NavigatorID;
    State: StackNavigationState<ParamList>;
    ScreenOptions: BottomSheetNavigationOptions;
    EventMap: BottomSheetNavigationEventMap;
    NavigationList: {
      [RouteName in keyof ParamList]: BottomSheetNavigationProp<
        ParamList,
        RouteName,
        NavigatorID
      >;
    };
    Navigator: typeof BottomSheetNavigator;
  },
  const Config extends StaticConfig<TypeBag> = StaticConfig<TypeBag>,
>(
  config?: Config
): TypedNavigator<TypeBag, Config> =>
  createNavigatorFactory(BottomSheetNavigator)(config);
