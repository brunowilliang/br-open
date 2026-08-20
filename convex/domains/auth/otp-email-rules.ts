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
        subject: "Código para trocar seu e-mail — BR Open",
      };
    case "email-verification":
      return {
        html: `<p>Use o código <strong>${otp}</strong> para verificar seu e-mail no BR Open.</p>`,
        subject: "Seu código — BR Open",
      };
    case "forget-password":
      return {
        html: `<p>Use o código <strong>${otp}</strong> para redefinir sua senha no BR Open.</p>`,
        subject: "Código para redefinir sua senha — BR Open",
      };
    default:
      return {
        html: `<p>Seu código: <strong>${otp}</strong></p>`,
        subject: "Seu código — BR Open",
      };
  }
}
