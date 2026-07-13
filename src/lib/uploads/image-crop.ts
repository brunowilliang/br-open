import { createElement, Fragment, useEffect, useMemo, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

export type ImageCropArea = {
  height: number;
  originX: number;
  originY: number;
  width: number;
};

export type ImageCropAsset = {
  height: number;
  uri: string;
  width: number;
};

export type CroppedImage = {
  height: number;
  mimeType: string;
  uri: string;
  width: number;
};

export type ImageCropFrame = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type ImageCropperProps = {
  aspectRatio: number | null;
  asset: ImageCropAsset | null;
  cancelLabel?: string;
  description?: string;
  isProcessing?: boolean;
  onCancel: () => void;
  onConfirm: (cropArea: ImageCropArea) => void;
  processingLabel?: string;
  saveLabel?: string;
  title?: string;
};

type Offset = {
  x: number;
  y: number;
};

const DEFAULT_CANCEL_LABEL = "Cancelar";
const DEFAULT_DESCRIPTION = "Arraste a foto e pince para dar zoom.";
const DEFAULT_PROCESSING_LABEL = "Salvando...";
const DEFAULT_SAVE_LABEL = "Salvar";
const DEFAULT_TITLE = "Ajustar imagem";
const MAX_ZOOM = 4;
const MIN_STAGE_PADDING = 24;
const MIN_ZOOM = 1;
const OVERLAY_CLASS_NAME = "absolute bg-black/75";

function getImageCropRuntime() {
  const { Button } = require("heroui-native") as typeof import("heroui-native");
  const { Text } =
    require("@/components/core/text") as typeof import("@/components/core/text");
  const {
    Image: NativeImage,
    Modal,
    useWindowDimensions,
    View,
  } = require("react-native") as typeof import("react-native");
  const { Gesture, GestureDetector, GestureHandlerRootView } =
    require("react-native-gesture-handler") as typeof import("react-native-gesture-handler");
  const { createAnimatedComponent, useAnimatedStyle, useSharedValue } =
    require("react-native-reanimated") as typeof import("react-native-reanimated");

  return {
    createAnimatedComponent,
    Button,
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
    Modal,
    NativeImage,
    Text,
    useAnimatedStyle,
    useSharedValue,
    useWindowDimensions,
    View,
  };
}

import { clamp } from "@/lib/numbers";

export function getMaskWidthBounds(input: {
  aspectRatio: number;
  screenWidth: number;
  stageHeight: number;
  stageWidth: number;
}) {
  const maxByScreenWidth = input.screenWidth - MIN_STAGE_PADDING;
  const maxByStageWidth = input.stageWidth - MIN_STAGE_PADDING;
  const maxByStageHeight =
    input.stageHeight > 0
      ? (input.stageHeight - MIN_STAGE_PADDING) * input.aspectRatio
      : maxByScreenWidth;
  const maxWidth = Math.max(
    0,
    Math.min(maxByScreenWidth, maxByStageWidth, maxByStageHeight)
  );

  return {
    maxWidth,
  };
}

export function getMaskFrame(input: {
  aspectRatio: number;
  maskWidth: number;
  stageHeight: number;
  stageWidth: number;
}): ImageCropFrame | null {
  if (!(input.maskWidth > 0 && input.stageHeight > 0 && input.stageWidth > 0)) {
    return null;
  }

  const height = input.maskWidth / input.aspectRatio;

  return {
    height,
    width: input.maskWidth,
    x: (input.stageWidth - input.maskWidth) / 2,
    y: (input.stageHeight - height) / 2,
  };
}

export function getImageDisplay(input: {
  asset: ImageCropAsset;
  maskFrame: ImageCropFrame;
  zoom: number;
}) {
  const baseScale = Math.max(
    input.maskFrame.width / input.asset.width,
    input.maskFrame.height / input.asset.height
  );
  const scale = baseScale * input.zoom;

  return {
    height: input.asset.height * scale,
    width: input.asset.width * scale,
  };
}

export function clampImageOffset(input: {
  display: { height: number; width: number };
  maskFrame: ImageCropFrame;
  offset: Offset;
  stageHeight: number;
  stageWidth: number;
}) {
  const imageBaseX = (input.stageWidth - input.display.width) / 2;
  const imageBaseY = (input.stageHeight - input.display.height) / 2;
  const minX =
    input.maskFrame.x +
    input.maskFrame.width -
    imageBaseX -
    input.display.width;
  const maxX = input.maskFrame.x - imageBaseX;
  const minY =
    input.maskFrame.y +
    input.maskFrame.height -
    imageBaseY -
    input.display.height;
  const maxY = input.maskFrame.y - imageBaseY;

  return {
    x: clamp(input.offset.x, minX, maxX),
    y: clamp(input.offset.y, minY, maxY),
  };
}

export function buildImageCropArea(input: {
  asset: ImageCropAsset;
  imageFrame: ImageCropFrame;
  maskFrame: ImageCropFrame;
}): ImageCropArea {
  const scaleX = input.asset.width / input.imageFrame.width;
  const scaleY = input.asset.height / input.imageFrame.height;
  const originX = clamp(
    (input.maskFrame.x - input.imageFrame.x) * scaleX,
    0,
    input.asset.width
  );
  const originY = clamp(
    (input.maskFrame.y - input.imageFrame.y) * scaleY,
    0,
    input.asset.height
  );

  return {
    height: clamp(
      input.maskFrame.height * scaleY,
      1,
      input.asset.height - originY
    ),
    originX,
    originY,
    width: clamp(
      input.maskFrame.width * scaleX,
      1,
      input.asset.width - originX
    ),
  };
}

export function buildImageCropPickerOptions(): import("expo-image-picker").ImagePickerOptions {
  return {
    allowsEditing: false,
    allowsMultipleSelection: false,
    mediaTypes: ["images"],
    quality: 1,
  };
}

export async function pickImageCropAsset() {
  const ImagePicker = await import("expo-image-picker");
  const result = await ImagePicker.launchImageLibraryAsync(
    buildImageCropPickerOptions()
  );

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset) {
    return null;
  }

  return {
    height: asset.height,
    uri: asset.uri,
    width: asset.width,
  } satisfies ImageCropAsset;
}

export async function cropImage(input: {
  cropArea: ImageCropArea;
  sourceUri: string;
  target: {
    width: number;
  };
}): Promise<CroppedImage> {
  const { ImageManipulator, SaveFormat } = await import(
    "expo-image-manipulator"
  );
  const context = ImageManipulator.manipulate(input.sourceUri);

  context
    .crop({
      height: Math.round(input.cropArea.height),
      originX: Math.round(input.cropArea.originX),
      originY: Math.round(input.cropArea.originY),
      width: Math.round(input.cropArea.width),
    })
    .resize({
      width: input.target.width,
    });

  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: 0.92,
    format: SaveFormat.JPEG,
  });

  context.release();
  image.release();

  return {
    height: result.height,
    mimeType: "image/jpeg",
    uri: result.uri,
    width: result.width,
  };
}

export function ImageCropper(props: ImageCropperProps) {
  const {
    Button,
    createAnimatedComponent,
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
    Modal,
    NativeImage,
    Text,
    useAnimatedStyle,
    useSharedValue,
    useWindowDimensions,
    View,
  } = getImageCropRuntime();

  const AnimatedView = useMemo(
    () => createAnimatedComponent(View),
    [createAnimatedComponent, View]
  );

  const { width: screenWidth } = useWindowDimensions();
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const isVisible = Boolean(props.asset && props.aspectRatio);
  const isInteractionLocked = Boolean(props.isProcessing);
  const aspectRatio = props.aspectRatio ?? 1;

  const maskWidthBounds = useMemo(
    () =>
      getMaskWidthBounds({
        aspectRatio,
        screenWidth,
        stageHeight: stageSize.height,
        stageWidth: stageSize.width || screenWidth,
      }),
    [aspectRatio, screenWidth, stageSize.height, stageSize.width]
  );
  const currentMaskWidth =
    maskWidthBounds.maxWidth > 0 ? maskWidthBounds.maxWidth : 0;
  const maskFrame = useMemo(
    () =>
      getMaskFrame({
        aspectRatio,
        maskWidth: currentMaskWidth,
        stageHeight: stageSize.height,
        stageWidth: stageSize.width,
      }),
    [aspectRatio, currentMaskWidth, stageSize.height, stageSize.width]
  );
  const baseDisplay = useMemo(
    () =>
      props.asset && maskFrame
        ? getImageDisplay({
            asset: props.asset,
            maskFrame,
            zoom: MIN_ZOOM,
          })
        : null,
    [maskFrame, props.asset]
  );
  const selectedAssetUri = props.asset?.uri;

  const scale = useSharedValue(MIN_ZOOM);
  const savedScale = useSharedValue(MIN_ZOOM);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const maskX = useSharedValue(0);
  const maskY = useSharedValue(0);
  const maskW = useSharedValue(0);
  const maskH = useSharedValue(0);
  const stageW = useSharedValue(0);
  const stageH = useSharedValue(0);
  const baseW = useSharedValue(0);
  const baseH = useSharedValue(0);

  if (maskFrame) {
    maskX.value = maskFrame.x;
    maskY.value = maskFrame.y;
    maskW.value = maskFrame.width;
    maskH.value = maskFrame.height;
  }
  stageW.value = stageSize.width;
  stageH.value = stageSize.height;
  if (baseDisplay) {
    baseW.value = baseDisplay.width;
    baseH.value = baseDisplay.height;
  }

  useEffect(() => {
    if (isVisible && selectedAssetUri && maskWidthBounds.maxWidth > 0) {
      scale.value = MIN_ZOOM;
      savedScale.value = MIN_ZOOM;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [
    isVisible,
    maskWidthBounds.maxWidth,
    selectedAssetUri,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
  ]);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const pinchGesture = Gesture.Pinch()
    .enabled(!isInteractionLocked)
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value =
        next < MIN_ZOOM ? MIN_ZOOM : next > MAX_ZOOM ? MAX_ZOOM : next;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const s = scale.value;
      const dw = baseW.value * s;
      const dh = baseH.value * s;
      const bx = (stageW.value - dw) / 2;
      const by = (stageH.value - dh) / 2;
      const minX = maskX.value + maskW.value - bx - dw;
      const maxX = maskX.value - bx;
      const minY = maskY.value + maskH.value - by - dh;
      const maxY = maskY.value - by;
      translateX.value =
        translateX.value < minX
          ? minX
          : translateX.value > maxX
            ? maxX
            : translateX.value;
      translateY.value =
        translateY.value < minY
          ? minY
          : translateY.value > maxY
            ? maxY
            : translateY.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .enabled(!isInteractionLocked)
    .onUpdate((e) => {
      const s = scale.value;
      const dw = baseW.value * s;
      const dh = baseH.value * s;
      const bx = (stageW.value - dw) / 2;
      const by = (stageH.value - dh) / 2;
      const minX = maskX.value + maskW.value - bx - dw;
      const maxX = maskX.value - bx;
      const minY = maskY.value + maskH.value - by - dh;
      const maxY = maskY.value - by;
      const rawX = savedTranslateX.value + e.translationX;
      const rawY = savedTranslateY.value + e.translationY;
      translateX.value = rawX < minX ? minX : rawX > maxX ? maxX : rawX;
      translateY.value = rawY < minY ? minY : rawY > maxY ? maxY : rawY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  function handleStageLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;

    setStageSize({ height, width });
  }

  function handleRequestClose() {
    if (!props.isProcessing) {
      props.onCancel();
    }
  }

  function handleConfirm() {
    if (props.isProcessing || !(props.asset && maskFrame && baseDisplay)) {
      return;
    }

    const currentZoom = scale.value;
    const effectiveDisplay = {
      height: baseDisplay.height * currentZoom,
      width: baseDisplay.width * currentZoom,
    };
    const baseX = (stageSize.width - baseDisplay.width) / 2;
    const baseY = (stageSize.height - baseDisplay.height) / 2;
    const imageFrame: ImageCropFrame = {
      height: effectiveDisplay.height,
      width: effectiveDisplay.width,
      x: baseX + translateX.value,
      y: baseY + translateY.value,
    };

    props.onConfirm(
      buildImageCropArea({
        asset: props.asset,
        imageFrame,
        maskFrame,
      })
    );
  }

  const baseLeft = baseDisplay ? (stageSize.width - baseDisplay.width) / 2 : 0;
  const baseTop = baseDisplay ? (stageSize.height - baseDisplay.height) / 2 : 0;

  return createElement(
    Modal,
    {
      animationType: "fade",
      onRequestClose: handleRequestClose,
      visible: isVisible,
    },
    createElement(
      GestureHandlerRootView,
      { style: { flex: 1 } },
      createElement(
        View,
        { className: "flex-1 bg-black pt-safe-offset-4 pb-safe-offset-4" },
        createElement(
          View,
          { className: "px-4 py-3" },
          createElement(
            Text,
            { className: "text-center text-white", variant: "title" },
            props.title ?? DEFAULT_TITLE
          ),
          createElement(
            Text,
            {
              className: "mt-1 text-center text-white/60",
              variant: "description",
            },
            props.description ?? DEFAULT_DESCRIPTION
          )
        ),
        createElement(
          GestureDetector,
          { gesture: composedGesture },
          createElement(
            View,
            {
              className: "flex-1 overflow-hidden",
              onLayout: handleStageLayout,
              pointerEvents: isInteractionLocked ? "none" : "auto",
            },
            baseDisplay && props.asset
              ? createElement(
                  AnimatedView,
                  {
                    pointerEvents: "none",
                    style: [
                      {
                        height: baseDisplay.height,
                        left: baseLeft,
                        position: "absolute",
                        top: baseTop,
                        width: baseDisplay.width,
                      },
                      animatedImageStyle,
                    ],
                  },
                  createElement(NativeImage, {
                    resizeMode: "cover",
                    source: { uri: props.asset.uri },
                    style: {
                      height: "100%",
                      width: "100%",
                    },
                  })
                )
              : null,
            maskFrame
              ? createElement(
                  Fragment,
                  null,
                  createElement(View, {
                    className: OVERLAY_CLASS_NAME,
                    pointerEvents: "none",
                    style: { height: maskFrame.y, left: 0, right: 0, top: 0 },
                  }),
                  createElement(View, {
                    className: OVERLAY_CLASS_NAME,
                    pointerEvents: "none",
                    style: {
                      bottom: 0,
                      left: 0,
                      right: 0,
                      top: maskFrame.y + maskFrame.height,
                    },
                  }),
                  createElement(View, {
                    className: OVERLAY_CLASS_NAME,
                    pointerEvents: "none",
                    style: {
                      height: maskFrame.height,
                      left: 0,
                      top: maskFrame.y,
                      width: maskFrame.x,
                    },
                  }),
                  createElement(View, {
                    className: OVERLAY_CLASS_NAME,
                    pointerEvents: "none",
                    style: {
                      height: maskFrame.height,
                      left: maskFrame.x + maskFrame.width,
                      right: 0,
                      top: maskFrame.y,
                    },
                  }),
                  createElement(View, {
                    className: "absolute border-2 border-white/90",
                    pointerEvents: "none",
                    style: {
                      height: maskFrame.height,
                      left: maskFrame.x,
                      top: maskFrame.y,
                      width: maskFrame.width,
                    },
                  })
                )
              : null
          )
        ),
        createElement(
          View,
          { className: "gap-3 px-4 pt-4" },
          createElement(
            View,
            { className: "flex-row gap-3" },
            createElement(
              Button,
              {
                className: "flex-1",
                isDisabled: props.isProcessing,
                onPress: props.onCancel,
                variant: "secondary",
              },
              props.cancelLabel ?? DEFAULT_CANCEL_LABEL
            ),
            createElement(
              Button,
              {
                className: "flex-1",
                isDisabled: props.isProcessing,
                onPress: handleConfirm,
              },
              props.isProcessing
                ? (props.processingLabel ?? DEFAULT_PROCESSING_LABEL)
                : (props.saveLabel ?? DEFAULT_SAVE_LABEL)
            )
          )
        )
      )
    )
  );
}
