import { describe, expect, it } from "bun:test";
import type { z } from "zod";

import * as playerContract from "../contract";

type PlayerMediaContract = typeof playerContract & {
  collectReplacedPlayerAvatarStorageIds?: (input: {
    next: { avatarStorageId?: null | string };
    previous?: { avatarStorageId?: null | string } | null;
  }) => string[];
  upsertPlayerProfileSchema?: z.ZodType;
};

const contract = playerContract as PlayerMediaContract;

const validProfileInput = {
  avatarStorageId: "kg2playeravatar",
  fullName: "Bruno Garcia",
  gender: "Masculino",
  nickname: "Bruno",
  phone: "",
};

describe("player profile media storage", () => {
  it("keeps avatar storage id in upsert input", () => {
    const parsedProfile =
      contract.upsertPlayerProfileSchema?.parse(validProfileInput);

    expect(parsedProfile).toMatchObject({
      avatarStorageId: "kg2playeravatar",
    });
  });

  it("returns the resolved avatar url without requiring it in upsert input", () => {
    const parsedProfile = contract.playerProfileSchema.parse({
      ...validProfileInput,
      avatarUrl: "https://example.com/avatar.jpg",
    });

    expect(parsedProfile).toMatchObject({
      avatarStorageId: "kg2playeravatar",
      avatarUrl: "https://example.com/avatar.jpg",
    });
  });

  it("requires the backend to return a generated player identity", () => {
    const parsedProfile = contract.playerProfileSchema.parse({
      avatarStorageId: null,
      avatarUrl: null,
      fullName: "Jogador#1234",
      gender: null,
      nickname: "Jogador#1234",
      phone: null,
    });

    expect(parsedProfile).toMatchObject({
      avatarStorageId: null,
      fullName: "Jogador#1234",
      gender: null,
      nickname: "Jogador#1234",
    });
  });

  it("collects previous avatar storage id when the avatar changes", () => {
    expect(
      contract.collectReplacedPlayerAvatarStorageIds?.({
        next: { avatarStorageId: "new-avatar" },
        previous: { avatarStorageId: "old-avatar" },
      })
    ).toEqual(["old-avatar"]);
  });

  it("does not collect null or unchanged avatar storage ids", () => {
    expect(
      contract.collectReplacedPlayerAvatarStorageIds?.({
        next: { avatarStorageId: "same-avatar" },
        previous: { avatarStorageId: "same-avatar" },
      })
    ).toEqual([]);

    expect(
      contract.collectReplacedPlayerAvatarStorageIds?.({
        next: { avatarStorageId: "new-avatar" },
        previous: { avatarStorageId: null },
      })
    ).toEqual([]);
  });
});
