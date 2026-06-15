import { useNavigation } from "expo-router";
import type { ParamListBase } from "expo-router/react-navigation";
import { useCallback } from "react";

import { BottomSheetActions } from "./bottom-sheet-router";
import type { BottomSheetNavigationProp } from "./types";

export function useBottomSheetNavigation<
  T extends ParamListBase = ParamListBase,
>(): BottomSheetNavigationProp<T> {
  const navigation = useNavigation<BottomSheetNavigationProp<T>>();

  const snapTo = useCallback(
    (index: number) => {
      navigation.dispatch(BottomSheetActions.snapTo(index));
    },
    [navigation]
  );

  return {
    ...navigation,
    snapTo,
  } as BottomSheetNavigationProp<T>;
}
