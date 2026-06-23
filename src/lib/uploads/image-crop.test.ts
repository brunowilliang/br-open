import { describe, expect, it } from "bun:test";

import {
  buildImageCropArea,
  buildImageCropPickerOptions,
  clamp,
  clampImageOffset,
  getImageDisplay,
  getMaskFrame,
  getMaskWidthBounds,
  getTouchDistance,
} from "./image-crop";

describe("image crop helpers", () => {
  it("builds crop coordinates from the mask over the image", () => {
    const cropArea = buildImageCropArea({
      asset: {
        height: 800,
        uri: "file://banner.jpg",
        width: 1200,
      },
      imageFrame: {
        height: 800,
        width: 1200,
        x: -300,
        y: -200,
      },
      maskFrame: {
        height: 300,
        width: 600,
        x: 0,
        y: 100,
      },
    });

    expect(cropArea).toEqual({
      height: 300,
      originX: 300,
      originY: 300,
      width: 600,
    });
  });

  it("does not rely on native picker editing for crop ratios", () => {
    const options = buildImageCropPickerOptions();

    expect(options.allowsEditing).toBe(false);
    expect(options.allowsMultipleSelection).toBe(false);
    expect(options.mediaTypes).toEqual(["images"]);
  });

  describe("clamp", () => {
    it("clamps a value inside the [min, max] range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it("falls back to the minimum when maximum < minimum (defensive)", () => {
      expect(clamp(5, 10, 0)).toBe(10);
    });
  });

  describe("getMaskWidthBounds", () => {
    it("returns the largest mask width that fits the stage and screen", () => {
      const bounds = getMaskWidthBounds({
        aspectRatio: 2,
        screenWidth: 400,
        stageHeight: 300,
        stageWidth: 400,
      });
      // screenWidth - padding = 400 - 24 = 376
      // stageWidth - padding = 376
      // stageHeight - padding = 276, * aspectRatio(2) = 552
      // min(376, 376, 552) = 376
      expect(bounds.maxWidth).toBe(376);
    });

    it("clamps to zero when there is no room", () => {
      const bounds = getMaskWidthBounds({
        aspectRatio: 2,
        screenWidth: 10,
        stageHeight: 0,
        stageWidth: 10,
      });
      expect(bounds.maxWidth).toBe(0);
    });
  });

  describe("getMaskFrame", () => {
    it("centers the mask frame inside the stage", () => {
      const frame = getMaskFrame({
        aspectRatio: 2,
        maskWidth: 200,
        stageHeight: 400,
        stageWidth: 400,
      });
      expect(frame).toEqual({ height: 100, width: 200, x: 100, y: 150 });
    });

    it("returns null when the stage or mask is empty", () => {
      expect(
        getMaskFrame({
          aspectRatio: 2,
          maskWidth: 0,
          stageHeight: 400,
          stageWidth: 400,
        })
      ).toBeNull();
      expect(
        getMaskFrame({
          aspectRatio: 2,
          maskWidth: 200,
          stageHeight: 0,
          stageWidth: 400,
        })
      ).toBeNull();
    });
  });

  describe("getImageDisplay", () => {
    it("scales the image so the shorter side covers the mask, times zoom", () => {
      const display = getImageDisplay({
        asset: { height: 400, uri: "file://x.jpg", width: 800 },
        maskFrame: { height: 200, width: 200, x: 0, y: 0 },
        zoom: 1,
      });
      // baseScale = max(200/800, 200/400) = max(0.25, 0.5) = 0.5
      // scale = 0.5 * 1 = 0.5
      expect(display).toEqual({ height: 200, width: 400 });
    });

    it("multiplies by zoom > 1 to enlarge beyond the mask", () => {
      const display = getImageDisplay({
        asset: { height: 400, uri: "file://x.jpg", width: 800 },
        maskFrame: { height: 200, width: 200, x: 0, y: 0 },
        zoom: 2,
      });
      expect(display).toEqual({ height: 400, width: 800 });
    });
  });

  describe("clampImageOffset", () => {
    it("keeps the mask inside the displayed image bounds", () => {
      const result = clampImageOffset({
        display: { height: 400, width: 400 },
        maskFrame: { height: 200, width: 200, x: 100, y: 100 },
        offset: { x: 500, y: 500 },
        stageHeight: 400,
        stageWidth: 400,
      });
      // imageBaseX = (400-400)/2 = 0
      // minX = mask.x + mask.width - imageBaseX - display.width = 100+200-0-400 = -100
      // maxX = mask.x - imageBaseX = 100
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it("allows negative offsets that keep the mask covered", () => {
      const result = clampImageOffset({
        display: { height: 400, width: 400 },
        maskFrame: { height: 200, width: 200, x: 100, y: 100 },
        offset: { x: -500, y: -500 },
        stageHeight: 400,
        stageWidth: 400,
      });
      expect(result.x).toBe(-100);
      expect(result.y).toBe(-100);
    });
  });

  describe("getTouchDistance", () => {
    it("computes the Euclidean distance between two touches", () => {
      expect(
        getTouchDistance([
          { pageX: 0, pageY: 0 },
          { pageX: 30, pageY: 40 },
        ])
      ).toBe(50);
    });

    it("returns 0 when fewer than two touches are present", () => {
      expect(getTouchDistance([{ pageX: 0, pageY: 0 }])).toBe(0);
      expect(getTouchDistance([])).toBe(0);
    });
  });
});
