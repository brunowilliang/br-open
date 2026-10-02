import { describe, expect, it } from "bun:test";

import {
  DELETION_CODE_MAX_ATTEMPTS,
  DELETION_CODE_RESEND_COOLDOWN_MS,
  DELETION_CODE_TTL_MS,
  generateDeletionCode,
  isDeletionCodeFormatValid,
  resolveDeletionCodeCheck,
  resolveDeletionCodeRequestGate,
} from "../deletion-code-rules";

describe("generateDeletionCode", () => {
  it("maps random bytes into exactly six digits", () => {
    expect(generateDeletionCode(new Uint8Array([0, 1, 9, 10, 19, 250]))).toBe(
      "019090"
    );
    expect(
      generateDeletionCode(new Uint8Array([255, 255, 255, 255, 255, 255]))
    ).toBe("555555");
    expect(
      generateDeletionCode(new Uint8Array([7, 8, 9, 3, 4, 5]))
    ).toHaveLength(6);
  });
});

describe("isDeletionCodeFormatValid", () => {
  it("accepts only six digits", () => {
    expect(isDeletionCodeFormatValid("012345")).toBe(true);
    expect(isDeletionCodeFormatValid("12345")).toBe(false);
    expect(isDeletionCodeFormatValid("1234567")).toBe(false);
    expect(isDeletionCodeFormatValid("12a456")).toBe(false);
    expect(isDeletionCodeFormatValid(" 12345")).toBe(false);
  });
});

describe("resolveDeletionCodeRequestGate", () => {
  it("lets a first request through and blocks inside the cooldown", () => {
    expect(
      resolveDeletionCodeRequestGate({ nowMs: 1000, requestedAtMs: null })
    ).toBe("allowed");
    expect(
      resolveDeletionCodeRequestGate({
        nowMs: 1000,
        requestedAtMs: 1000 - DELETION_CODE_RESEND_COOLDOWN_MS + 1,
      })
    ).toBe("cooldown");
    expect(
      resolveDeletionCodeRequestGate({
        nowMs: 1000,
        requestedAtMs: 1000 - DELETION_CODE_RESEND_COOLDOWN_MS,
      })
    ).toBe("allowed");
  });
});

describe("resolveDeletionCodeCheck", () => {
  const base = {
    attempts: 0,
    codeHash: "hash-a",
    expiresAtMs: 5000,
    nowMs: 1000,
    submittedHash: "hash-a",
  };

  it("accepts the matching hash before expiry", () => {
    expect(resolveDeletionCodeCheck(base)).toEqual({ status: "ok" });
  });

  it("treats pending send and expiry as expired", () => {
    expect(resolveDeletionCodeCheck({ ...base, codeHash: "" })).toEqual({
      status: "expired",
    });
    expect(
      resolveDeletionCodeCheck({ ...base, nowMs: base.expiresAtMs })
    ).toEqual({ status: "expired" });
    expect(DELETION_CODE_TTL_MS).toBeGreaterThan(0);
  });

  it("exhausts after the attempt cap", () => {
    expect(
      resolveDeletionCodeCheck({
        ...base,
        attempts: DELETION_CODE_MAX_ATTEMPTS,
      })
    ).toEqual({ status: "exhausted" });
  });

  it("counts a wrong hash and reports the remaining attempts", () => {
    expect(
      resolveDeletionCodeCheck({ ...base, submittedHash: "hash-b" })
    ).toEqual({
      attemptsLeft: DELETION_CODE_MAX_ATTEMPTS - 1,
      status: "invalid",
    });
    expect(
      resolveDeletionCodeCheck({
        ...base,
        attempts: DELETION_CODE_MAX_ATTEMPTS - 1,
        submittedHash: "hash-b",
      })
    ).toEqual({ attemptsLeft: 0, status: "invalid" });
  });
});
