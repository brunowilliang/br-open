import { describe, expect, it } from "bun:test";

import { buildCreateLeagueDefaultValues } from "./form-defaults";

import { LeagueSchema } from "./form-schema";
describe("LeagueSchema", () => {
  it("keeps the create-league defaults aligned with the expected blank-form validation state", () => {
    const result = LeagueSchema.safeParse(buildCreateLeagueDefaultValues());

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected create league defaults to require user input.");
    }

    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual([
      "name",
      "city",
      "state",
      "categories",
    ]);
  });

  it("accepts a valid filled league payload", () => {
    const createLeagueDefaultValues = buildCreateLeagueDefaultValues();
    const result = LeagueSchema.safeParse({
      ...createLeagueDefaultValues,
      avatarStorageId: "avatar-storage-id",
      coverStorageId: "cover-storage-id",
      name: "Liga Centro",
      city: "Florianopolis",
      state: "SC",
      categories: ["A"],
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected valid league payload to parse.");
    }

    expect(result.data.avatarStorageId).toBe("avatar-storage-id");
    expect(result.data.coverStorageId).toBe("cover-storage-id");
  });

  it("accepts null media storage ids when the league uses local fallbacks", () => {
    const createLeagueDefaultValues = buildCreateLeagueDefaultValues();
    const result = LeagueSchema.safeParse({
      ...createLeagueDefaultValues,
      avatarStorageId: null,
      coverStorageId: null,
      name: "Liga Centro",
      city: "Florianopolis",
      state: "SC",
      categories: ["A"],
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected valid league payload with fallbacks to parse.");
    }

    expect(result.data.avatarStorageId).toBeNull();
    expect(result.data.coverStorageId).toBeNull();
  });

  it("rejects an even best-of set format", () => {
    const createLeagueDefaultValues = buildCreateLeagueDefaultValues();
    const result = LeagueSchema.safeParse({
      ...createLeagueDefaultValues,
      name: "Liga Centro",
      city: "Florianopolis",
      state: "SC",
      categories: ["A"],
      ruleConfig: {
        ...createLeagueDefaultValues.ruleConfig,
        matchConfig: {
          ...createLeagueDefaultValues.ruleConfig.matchConfig,
          bestOfSets: 2,
        },
      },
    });

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected even best-of format to be rejected.");
    }

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["ruleConfig", "matchConfig", "bestOfSets"],
      })
    );
  });

  it("uses null media storage ids in the create-league defaults", () => {
    const createLeagueDefaultValues = buildCreateLeagueDefaultValues();

    expect(createLeagueDefaultValues.avatarStorageId).toBeNull();
    expect(createLeagueDefaultValues.coverStorageId).toBeNull();
  });
});
