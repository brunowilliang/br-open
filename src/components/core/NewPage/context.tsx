import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  cancelAnimation,
  type SharedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { BLUR_RESTORE_FADE_DURATION } from "./constants";

type PageContextValue = {
  blurOpacity: SharedValue<number>;
  blurViewKey: number;
  contentHeight: SharedValue<number>;
  footerHeight: number;
  headerHeight: number;
  isBlurMounted: boolean;
  scrollY: SharedValue<number>;
  setFooterHeight: (height: number) => void;
  setHeaderHeight: (height: number) => void;
  viewportHeight: SharedValue<number>;
};

const PageContext = createContext<PageContextValue | null>(null);

export function usePageContext() {
  const context = useContext(PageContext);

  if (context === null) {
    throw new Error("Core Page components must be rendered inside <Page>.");
  }

  return context;
}

function isBackgroundAppState(status: AppStateStatus) {
  return status === "background" || status === "inactive";
}

type PageRootProps = {
  children: React.ReactNode;
};

export const PageRoot = (props: PageRootProps) => {
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const blurOpacity = useSharedValue(
    isBackgroundAppState(AppState.currentState) ? 0 : 1
  );
  const appState = useRef(AppState.currentState);
  const [blurViewKey, setBlurViewKey] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [isBlurMounted, setIsBlurMounted] = useState(
    !isBackgroundAppState(AppState.currentState)
  );
  const [isBlurRestorePending, setIsBlurRestorePending] = useState(false);
  const unmountBlur = useCallback(() => {
    setIsBlurMounted(false);
  }, []);

  // Temporary workaround for @sbaiahmed1/react-native-blur#111.
  // Remove this remount flow when the library preserves ProgressiveBlurView
  // masks correctly across app background/foreground transitions.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const previousAppState = appState.current;
      appState.current = nextAppState;

      if (isBackgroundAppState(nextAppState)) {
        setIsBlurRestorePending(false);
        cancelAnimation(blurOpacity);
        blurOpacity.value = withTiming(
          0,
          { duration: BLUR_RESTORE_FADE_DURATION },
          (finished) => {
            if (finished) {
              scheduleOnRN(unmountBlur);
            }
          }
        );
        return;
      }

      cancelAnimation(blurOpacity);
      if (isBackgroundAppState(previousAppState)) {
        blurOpacity.value = 0;
        setBlurViewKey((currentValue) => currentValue + 1);
        setIsBlurRestorePending(true);
        setIsBlurMounted(true);
        return;
      }

      setIsBlurMounted(true);
      blurOpacity.value = withTiming(1, {
        duration: BLUR_RESTORE_FADE_DURATION,
      });
    });

    return () => {
      subscription.remove();
    };
  }, [blurOpacity, unmountBlur]);

  useEffect(() => {
    if (!(isBlurMounted && isBlurRestorePending)) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      blurOpacity.value = withTiming(1, {
        duration: BLUR_RESTORE_FADE_DURATION,
      });
      setIsBlurRestorePending(false);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [blurOpacity, isBlurMounted, isBlurRestorePending]);

  const value = useMemo(
    () => ({
      blurOpacity,
      blurViewKey,
      contentHeight,
      footerHeight,
      headerHeight,
      isBlurMounted,
      scrollY,
      setFooterHeight,
      setHeaderHeight,
      viewportHeight,
    }),
    [
      blurOpacity,
      blurViewKey,
      contentHeight,
      footerHeight,
      headerHeight,
      isBlurMounted,
      scrollY,
      viewportHeight,
    ]
  );

  return (
    <PageContext.Provider value={value}>{props.children}</PageContext.Provider>
  );
};
