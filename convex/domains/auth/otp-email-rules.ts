/**
 * Conteúdo dos e-mails transacionais de OTP (plugin emailOTP do Better Auth).
 *
 * O callback `sendVerificationOTP` em `convex/functions/auth.ts` delega para
 * `buildOtpEmail` — este arquivo é a fonte única de assunto/corpo por tipo,
 * puro e testável (nenhum import de better-auth aqui).
 */

export type OtpEmail = { html: string; subject: string };

export function buildOtpEmail(type: string, otp: string): OtpEmail {
  switch (type) {
    case "change-email":
      return {
        html: `<p>Use o código <strong>${otp}</strong> para trocar seu e-mail no BR Open.</p>`,
        subject: "Código BR Open para trocar seu e-mail",
      };
    case "email-verification":
      return {
        html: `<p>Use o código <strong>${otp}</strong> para verificar seu e-mail no BR Open.</p>`,
        subject: "Código BR Open para verificar seu e-mail",
      };
    case "forget-password":
      return {
        html: `<p>Use o código <strong>${otp}</strong> para redefinir sua senha no BR Open.</p>`,
        subject: "Código BR Open para redefinir sua senha",
      };
    default:
      return {
        html: `<p>Seu código: <strong>${otp}</strong></p>`,
        subject: "Código BR Open",
      };
  }
}
