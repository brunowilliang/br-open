import { describe, expect, it } from "bun:test";

import { buildOtpEmail } from "../otp-email-rules";

describe("buildOtpEmail", () => {
  it("usa copy dedicada para troca de e-mail", () => {
    expect(buildOtpEmail("change-email", "123456")).toEqual({
      html: "<p>Use o código <strong>123456</strong> para trocar seu e-mail no BR Open.</p>",
      subject: "Código para trocar seu e-mail — BR Open",
    });
  });

  it("usa copy dedicada para verificação de e-mail", () => {
    expect(buildOtpEmail("email-verification", "234567")).toEqual({
      html: "<p>Use o código <strong>234567</strong> para verificar seu e-mail no BR Open.</p>",
      subject: "Seu código — BR Open",
    });
  });

  it("usa copy dedicada para redefinição de senha", () => {
    expect(buildOtpEmail("forget-password", "345678")).toEqual({
      html: "<p>Use o código <strong>345678</strong> para redefinir sua senha no BR Open.</p>",
      subject: "Código para redefinir sua senha — BR Open",
    });
  });

  it("cai no copy genérico para tipos sem copy dedicada (ex.: sign-in)", () => {
    expect(buildOtpEmail("sign-in", "456789")).toEqual({
      html: "<p>Seu código: <strong>456789</strong></p>",
      subject: "Seu código — BR Open",
    });
  });

  it("interpola o OTP sem escapá-lo e mantém o código em <strong>", () => {
    const { html } = buildOtpEmail("forget-password", "000001");
    expect(html).toContain("<strong>000001</strong>");
  });
});
