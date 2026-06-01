import { describe, expect, it } from "bun:test";

import { buildImageCropArea, buildImageCropPickerOptions } from "./image-crop";

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
});
