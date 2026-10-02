export type DeletionCodeEmail = { html: string; subject: string };

/**
 * Copy do e-mail do código de exclusão. Espelha `otp-email-rules.ts` (mesmo
 * tom, mesma promessa de "ignore se não foi você") sem acoplar ao plugin.
 */
export function buildDeletionCodeEmail(code: string): DeletionCodeEmail {
  return {
    html: `<p>Use o código <strong>${code}</strong> para excluir sua conta no BR Open.</p><p>Se não foi você, ignore este e-mail. Sua conta continua ativa.</p>`,
    subject: "Código BR Open para excluir sua conta",
  };
}
