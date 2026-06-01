import {
  createElement,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type TouchPoint = {
  pageX: number;
  pageY: number;
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
    PanResponder,
    useWindowDimensions,
    View,
  } = require("react-native") as typeof import("react-native");

  return {
    Button,
    Modal,
    NativeImage,
    PanResponder,
    Text,
    useWindowDimensions,
    View,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function getMaskWidthBounds(input: {
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

function getMaskFrame(input: {
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

function getImageDisplay(input: {
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

function getImageFrame(input: {
  display: { height: number; width: number };
  offset: Offset;
  stageHeight: number;
  stageWidth: number;
}): ImageCropFrame {
  return {
    height: input.display.height,
    width: input.display.width,
    x: (input.stageWidth - input.display.width) / 2 + input.offset.x,
    y: (input.stageHeight - input.display.height) / 2 + input.offset.y,
  };
}

function clampImageOffset(input: {
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

function isSameOffset(firstOffset: Offset, secondOffset: Offset) {
  return firstOffset.x === secondOffset.x && firstOffset.y === secondOffset.y;
}

function getTouchDistance(touches: TouchPoint[]) {
  const [firstTouch, secondTouch] = touches;

  if (!(firstTouch && secondTouch)) {
    return 0;
  }

  return Math.hypot(
    secondTouch.pageX - firstTouch.pageX,
    secondTouch.pageY - firstTouch.pageY
  );
}

function getPrimaryTouchOffset(touches: TouchPoint[]): Offset | null {
  const [primaryTouch] = touches;

  if (!primaryTouch) {
    return null;
  }

  return {
    x: primaryTouch.pageX,
    y: primaryTouch.pageY,
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
    Modal,
    NativeImage,
    PanResponder,
    Text,
    useWindowDimensions,
    View,
  } = getImageCropRuntime();
  const { width: screenWidth } = useWindowDimensions();
  const [imageOffset, setImageOffset] = useState<Offset>({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const dragStartTouchRef = useRef<Offset | null>(null);
  const dragStartRef = useRef<Offset>({ x: 0, y: 0 });
  const imageOffsetRef = useRef<Offset>({ x: 0, y: 0 });
  const pinchStartRef = useRef({ distance: 0, zoom: MIN_ZOOM });
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
  const imageDisplay = useMemo(
    () =>
      props.asset && maskFrame
        ? getImageDisplay({
            asset: props.asset,
            maskFrame,
            zoom,
          })
        : null,
    [maskFrame, props.asset, zoom]
  );
  const imageFrame = useMemo(
    () =>
      imageDisplay && maskFrame
        ? getImageFrame({
            display: imageDisplay,
            offset: imageOffset,
            stageHeight: stageSize.height,
            stageWidth: stageSize.width,
          })
        : null,
    [imageDisplay, imageOffset, maskFrame, stageSize.height, stageSize.width]
  );
  const selectedAssetUri = props.asset?.uri;

  useEffect(() => {
    if (isVisible && selectedAssetUri && maskWidthBounds.maxWidth > 0) {
      const resetOffset = { x: 0, y: 0 };

      imageOffsetRef.current = resetOffset;
      setImageOffset(resetOffset);
      setZoom(MIN_ZOOM);
    }
  }, [isVisible, maskWidthBounds.maxWidth, selectedAssetUri]);

  useEffect(() => {
    if (!(imageDisplay && maskFrame)) {
      return;
    }

    setImageOffset((currentOffset) => {
      const nextOffset = clampImageOffset({
        display: imageDisplay,
        maskFrame,
        offset: currentOffset,
        stageHeight: stageSize.height,
        stageWidth: stageSize.width,
      });

      const resolvedOffset = isSameOffset(currentOffset, nextOffset)
        ? currentOffset
        : nextOffset;

      imageOffsetRef.current = resolvedOffset;
      return resolvedOffset;
    });
  }, [imageDisplay, maskFrame, stageSize.height, stageSize.width]);

  const imagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isInteractionLocked &&
          (_.nativeEvent.touches.length >= 2 ||
            Math.abs(gestureState.dx) > 2 ||
            Math.abs(gestureState.dy) > 2),
        onMoveShouldSetPanResponderCapture: () => !isInteractionLocked,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches as TouchPoint[];

          dragStartRef.current = imageOffsetRef.current;
          dragStartTouchRef.current = getPrimaryTouchOffset(touches);
          pinchStartRef.current = {
            distance: getTouchDistance(touches),
            zoom,
          };
        },
        onPanResponderMove: (event, gestureState) => {
          if (!(imageDisplay && maskFrame) || isInteractionLocked) {
            return;
          }

          const touches = event.nativeEvent.touches as TouchPoint[];

          if (touches.length >= 2) {
            const distance = getTouchDistance(touches);

            if (pinchStartRef.current.distance <= 0) {
              pinchStartRef.current = { distance, zoom };
            }

            const nextZoom = clamp(
              pinchStartRef.current.zoom *
                (distance / pinchStartRef.current.distance),
              MIN_ZOOM,
              MAX_ZOOM
            );
            const nextDisplay = props.asset
              ? getImageDisplay({
                  asset: props.asset,
                  maskFrame,
                  zoom: nextZoom,
                })
              : imageDisplay;

            setZoom(nextZoom);
            setImageOffset((currentOffset) => {
              const nextOffset = clampImageOffset({
                display: nextDisplay,
                maskFrame,
                offset: currentOffset,
                stageHeight: stageSize.height,
                stageWidth: stageSize.width,
              });

              imageOffsetRef.current = nextOffset;
              return nextOffset;
            });
            return;
          }

          const currentTouchOffset = getPrimaryTouchOffset(touches);
          const dragStartTouch = dragStartTouchRef.current;
          const dragDelta =
            currentTouchOffset && dragStartTouch
              ? {
                  x: currentTouchOffset.x - dragStartTouch.x,
                  y: currentTouchOffset.y - dragStartTouch.y,
                }
              : {
                  x: gestureState.dx,
                  y: gestureState.dy,
                };
          const nextOffset = clampImageOffset({
            display: imageDisplay,
            maskFrame,
            offset: {
              x: dragStartRef.current.x + dragDelta.x,
              y: dragStartRef.current.y + dragDelta.y,
            },
            stageHeight: stageSize.height,
            stageWidth: stageSize.width,
          });

          imageOffsetRef.current = nextOffset;
          setImageOffset(nextOffset);
        },
        onPanResponderRelease: () => {
          dragStartTouchRef.current = null;
          pinchStartRef.current = { distance: 0, zoom };
        },
        onPanResponderTerminate: () => {
          dragStartTouchRef.current = null;
          pinchStartRef.current = { distance: 0, zoom };
        },
        onStartShouldSetPanResponder: () => !isInteractionLocked,
        onStartShouldSetPanResponderCapture: () => !isInteractionLocked,
      }),
    [
      imageDisplay,
      isInteractionLocked,
      maskFrame,
      PanResponder.create,
      props.asset,
      stageSize.height,
      stageSize.width,
      zoom,
    ]
  );

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
    if (props.isProcessing || !(props.asset && imageFrame && maskFrame)) {
      return;
    }

    props.onConfirm(
      buildImageCropArea({
        asset: props.asset,
        imageFrame,
        maskFrame,
      })
    );
  }

  return createElement(
    Modal,
    {
      animationType: "fade",
      onRequestClose: handleRequestClose,
      visible: isVisible,
    },
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
        View,
        {
          className: "flex-1 overflow-hidden",
          onLayout: handleStageLayout,
          pointerEvents: isInteractionLocked ? "none" : "auto",
          ...imagePanResponder.panHandlers,
        },
        props.asset && imageFrame
          ? createElement(
              View,
              {
                pointerEvents: "none",
                style: {
                  height: imageFrame.height,
                  left: imageFrame.x,
                  position: "absolute",
                  top: imageFrame.y,
                  width: imageFrame.width,
                },
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
  );
}
