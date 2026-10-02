import { describe, expect, it } from "bun:test";

import { buildDeletionCodeEmail } from "../deletion-email-rules";

describe("buildDeletionCodeEmail", () => {
  it("embeds the code and never leaves it out of the subject/body pair", () => {
    const email = buildDeletionCodeEmail("123456");

    expect(email.subject).toBe("Código BR Open para excluir sua conta");
    expect(email.html).toContain("<strong>123456</strong>");
    expect(email.html).toContain("excluir sua conta");
    expect(email.html).not.toContain("—");
  });
});
