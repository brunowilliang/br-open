import { describe, expect, it } from "bun:test";

import {
  buildOrganizationDisplayName,
  parseOrganizationMetadata,
} from "../identity";

describe("buildOrganizationDisplayName", () => {
  it("returns the trimmed name when provided", () => {
    expect(buildOrganizationDisplayName({ name: "Clube BR Open" })).toBe(
      "Clube BR Open"
    );
  });

  it("trims whitespace from the name", () => {
    expect(buildOrganizationDisplayName({ name: "  Clube  " })).toBe("Clube");
  });

  it("returns fallback when name is null", () => {
    expect(buildOrganizationDisplayName({ name: null })).toBe("Organização");
  });

  it("returns fallback when name is undefined", () => {
    expect(buildOrganizationDisplayName({ name: undefined })).toBe(
      "Organização"
    );
  });

  it("returns fallback when name is empty", () => {
    expect(buildOrganizationDisplayName({ name: "   " })).toBe("Organização");
  });
});

describe("parseOrganizationMetadata", () => {
  it("returns empty object for null", () => {
    expect(parseOrganizationMetadata(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(parseOrganizationMetadata(undefined)).toEqual({});
  });

  it("returns empty object for non-object", () => {
    expect(parseOrganizationMetadata("string")).toEqual({});
    expect(parseOrganizationMetadata(42)).toEqual({});
  });

  it("returns the parsed metadata for a valid object", () => {
    const metadata = parseOrganizationMetadata({
      organizerType: "clube",
      sports: ["tenis"],
    });

    expect(metadata).toMatchObject({
      organizerType: "clube",
      sports: ["tenis"],
    });
  });
});
