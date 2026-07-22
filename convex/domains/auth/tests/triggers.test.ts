import { describe, expect, it } from "bun:test";
import type { Id } from "../../../functions/_generated/dataModel";

import {
  buildInitialPlayerProfileValues,
  ensureInitialPlayerProfile,
  ensureInitialUserPreference,
} from "../triggers";

type EnsureInitialPlayerProfileCtx = Parameters<
  typeof ensureInitialPlayerProfile
>[0];

describe("auth triggers", () => {
  it("uses the auth user name as the initial player name when available", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");

    expect(
      buildInitialPlayerProfileValues({
        name: "  Bruno Garcia  ",
        now,
        userId: "user_123",
      })
    ).toEqual({
      avatarStorageId: null,
      createdAt: now,
      fullName: "Bruno Garcia",
      nickname: "Bruno Garcia",
      updatedAt: now,
      userId: "user_123",
    });
  });

  it("builds a stable player fallback when the auth name is missing", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");

    const result = buildInitialPlayerProfileValues({
      name: " ",
      now,
      userId: "user_456",
    });
    const repeatedResult = buildInitialPlayerProfileValues({
      name: null,
      now,
      userId: "user_456",
    });

    expect(result).toEqual({
      avatarStorageId: null,
      createdAt: now,
      fullName: "Jogador#1761",
      nickname: "Jogador#1761",
      updatedAt: now,
      userId: "user_456",
    });
    expect(repeatedResult.fullName).toBe(result.fullName);
    expect(repeatedResult.nickname).toBe(result.nickname);
  });

  it("does not insert another player profile when one already exists", async () => {
    let wasInsertCalled = false;
    let wasUpdateCalled = false;
    const existingPlayerProfile = {
      fullName: "Bruno Garcia",
      id: "playerProfile_123",
      nickname: "Bruno",
    } as unknown as Awaited<ReturnType<typeof ensureInitialPlayerProfile>>;
    const ctx = {
      orm: {
        insert: () => {
          wasInsertCalled = true;
          throw new Error("Insert should not run for an existing profile.");
        },
        query: {
          playerProfile: {
            findFirst: async () => existingPlayerProfile,
          },
        },
        update: () => {
          wasUpdateCalled = true;
          throw new Error("Update should not run for a complete profile.");
        },
      },
    } as unknown as EnsureInitialPlayerProfileCtx;

    const result = await ensureInitialPlayerProfile(ctx, {
      id: "user_123" as Id<"user">,
      name: "Bruno Garcia",
    });

    expect(result).toBe(existingPlayerProfile);
    expect(wasInsertCalled).toBe(false);
    expect(wasUpdateCalled).toBe(false);
  });

  it("fills missing names when the player profile already exists", async () => {
    let updatedValues: Record<string, unknown> | null = null;
    const existingPlayerProfile = {
      fullName: null,
      id: "playerProfile_123",
      nickname: "",
      userId: "user_456",
    };
    const updatedPlayerProfile = {
      ...existingPlayerProfile,
      fullName: "Jogador#1761",
      nickname: "Jogador#1761",
    } as unknown as Awaited<ReturnType<typeof ensureInitialPlayerProfile>>;
    const ctx = {
      orm: {
        insert: () => {
          throw new Error("Insert should not run for an existing profile.");
        },
        query: {
          playerProfile: {
            findFirst: async () => existingPlayerProfile,
          },
        },
        update: () => ({
          set: (values: Record<string, unknown>) => {
            updatedValues = values;

            return {
              returning: async () => [updatedPlayerProfile],
              where: () => ({
                returning: async () => [updatedPlayerProfile],
              }),
            };
          },
        }),
      },
    } as unknown as EnsureInitialPlayerProfileCtx;

    const result = await ensureInitialPlayerProfile(ctx, {
      id: "user_456" as Id<"user">,
      name: "",
    });

    expect(result).toBe(updatedPlayerProfile);
    expect(updatedValues).toMatchObject({
      fullName: "Jogador#1761",
      nickname: "Jogador#1761",
    });
  });

  it("creates a default player preference for new users", async () => {
    let insertedValues: Record<string, unknown> | null = null;
    const createdPreference = {
      id: "userPreference_123",
    } as unknown as Awaited<ReturnType<typeof ensureInitialUserPreference>>;
    const ctx = {
      orm: {
        insert: () => ({
          values: (values: Record<string, unknown>) => {
            insertedValues = values;

            return {
              returning: async () => [createdPreference],
            };
          },
        }),
        query: {
          userPreference: {
            findFirst: async () => null,
          },
        },
      },
    } as unknown as EnsureInitialPlayerProfileCtx;

    const result = await ensureInitialUserPreference(
      ctx,
      "user_123" as Id<"user">
    );

    expect(result).toBe(createdPreference);
    expect(insertedValues).toMatchObject({
      activeActorKind: "player",
      activeOrganizationId: null,
      userId: "user_123",
    });
  });
});
