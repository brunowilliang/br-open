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
      name: "Liga Centro",
      city: "Florianopolis",
      state: "SC",
      categories: ["A"],
    });

    expect(result.success).toBe(true);
  });
});
