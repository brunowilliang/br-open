import {
  BottomSheetModal,
  type BottomSheetModalProps,
  BottomSheetModalProvider,
  BottomSheetView as RNBottomSheetView,
} from "@gorhom/bottom-sheet";
import { type ParamListBase, useTheme } from "expo-router/react-navigation";
import * as React from "react";
import { Platform, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import type {
  BottomSheetDescriptorMap,
  BottomSheetNavigationConfig,
  BottomSheetNavigationHelpers,
  BottomSheetNavigationProp,
  BottomSheetNavigationState,
} from "./types";

type BottomSheetModalScreenProps = BottomSheetModalProps & {
  navigation: BottomSheetNavigationProp<ParamListBase>;
};

function Overlay({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "ios") {
    return (
      <FullWindowOverlay>
        <SafeAreaProvider style={styles.safeAreaProvider}>
          {children}
        </SafeAreaProvider>
      </FullWindowOverlay>
    );
  }
  return children;
}

function BottomSheetModalScreen({
  index,
  navigation,
  enableDynamicSizing,
  children,
  ...props
}: BottomSheetModalScreenProps) {
  const ref = React.useRef<BottomSheetModal>(null);
  const lastIndexRef = React.useRef(index);

  // Present on mount.
  React.useEffect(() => {
    ref.current?.present();
  }, []);

  const isMounted = React.useRef(true);
  React.useEffect(
    () => () => {
      isMounted.current = false;
    },
    []
  );

  React.useEffect(() => {
    if (index != null && lastIndexRef.current !== index) {
      ref.current?.snapToIndex(index);
    }
  }, [index]);

  const onChange = React.useCallback(
    (newIndex: number) => {
      const currentIndex = lastIndexRef.current;
      lastIndexRef.current = newIndex;
      if (newIndex >= 0 && newIndex !== currentIndex) {
        navigation.snapTo(newIndex);
      }
    },
    [navigation]
  );

  const onDismiss = React.useCallback(() => {
    // BottomSheetModal will call onDismiss on unmount, be we do not want that since
    // we already popped the screen.
    if (isMounted.current) {
      navigation.goBack();
    }
  }, [navigation]);

  return (
    <BottomSheetModal
      enableDynamicSizing={enableDynamicSizing}
      index={index}
      onChange={onChange}
      onDismiss={onDismiss}
      ref={ref}
      {...props}
    >
      {enableDynamicSizing ? (
        <RNBottomSheetView>{children as React.ReactNode}</RNBottomSheetView>
      ) : (
        children
      )}
    </BottomSheetModal>
  );
}

const DEFAULT_SNAP_POINTS = ["66%"];

type Props = BottomSheetNavigationConfig & {
  state: BottomSheetNavigationState<ParamListBase>;
  navigation: BottomSheetNavigationHelpers;
  descriptors: BottomSheetDescriptorMap;
};

export function BottomSheetView({ state, descriptors, baseRouteName }: Props) {
  const { colors } = useTheme();
  const themeBackgroundStyle = React.useMemo(
    () => ({
      backgroundColor: colors.card,
    }),
    [colors.card]
  );
  const themeHandleIndicatorStyle = React.useMemo(
    () => ({
      backgroundColor: colors.border,
    }),
    [colors.border]
  );

  const baseRoute = baseRouteName
    ? state.routes.find((route) => route.name === baseRouteName)
    : state.routes[0];
  const sheetRoutes = baseRouteName
    ? state.routes.filter((route) => route.name !== baseRouteName)
    : state.routes.slice(1);
  const baseScreen = baseRoute ? descriptors[baseRoute.key] : undefined;

  if (!(baseScreen || sheetRoutes.length > 0)) {
    return null;
  }

  return (
    <>
      {baseScreen?.render()}
      <Overlay>
        {sheetRoutes.length > 0 && (
          <BottomSheetModalProvider>
            {sheetRoutes.map((route) => {
              const descriptor = descriptors[route.key];

              if (!descriptor) {
                return null;
              }

              const { options, navigation, render } = descriptor;
              const {
                index,
                backgroundStyle,
                handleIndicatorStyle,
                snapPoints,
                enableDynamicSizing,
                ...sheetProps
              } = options;

              return (
                <BottomSheetModalScreen
                  backgroundStyle={[themeBackgroundStyle, backgroundStyle]}
                  enableDynamicSizing={enableDynamicSizing}
                  handleIndicatorStyle={[
                    themeHandleIndicatorStyle,
                    handleIndicatorStyle,
                  ]}
                  // Make sure index is in range, it could be out if snapToIndex is persisted
                  // and snapPoints is changed.
                  index={Math.min(
                    route.snapToIndex ?? index ?? 0,
                    snapPoints == null ? 0 : snapPoints.length - 1
                  )}
                  key={route.key}
                  navigation={navigation}
                  snapPoints={
                    snapPoints == null && !enableDynamicSizing
                      ? DEFAULT_SNAP_POINTS
                      : snapPoints
                  }
                  {...sheetProps}
                >
                  {render()}
                </BottomSheetModalScreen>
              );
            })}
          </BottomSheetModalProvider>
        )}
      </Overlay>
    </>
  );
}

const styles = StyleSheet.create({
  safeAreaProvider: { flex: 1, pointerEvents: "box-none" },
});
