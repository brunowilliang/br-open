import { eq } from "kitcn/orm";
import { Resend } from "resend";
import { z } from "zod";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  DELETION_CODE_LENGTH,
  generateDeletionCode,
} from "../../domains/account/deletion-code-rules";
import { buildDeletionCodeEmail } from "../../domains/account/deletion-email-rules";
import { sha256Hex } from "../../domains/account/sha256";
import { accountDeletionCode } from "../../domains/account/tables";
import { getEnv } from "../../lib/get-env";
import { privateAction, privateMutation, privateQuery } from "../../lib/crpc";

export const readPending = privateQuery
  .input(z.object({ userId: z.string().min(1) }))
  .output(
    z
      .object({
        codeHash: z.string(),
        email: z.string(),
        requestedAtMs: z.number(),
        rowId: z.string(),
      })
      .nullable()
  )
  .query(async ({ ctx, input }) => {
    const row = await ctx.orm.query.accountDeletionCode.findFirst({
      where: { userId: input.userId as Id<"user"> },
    });
    if (!row) {
      return null;
    }
    const user = await ctx.orm.query.user.findFirst({
      where: { id: row.userId },
    });
    if (!user) {
      return null;
    }
    return {
      codeHash: row.codeHash,
      email: user.email,
      requestedAtMs: row.requestedAt.getTime(),
      rowId: row.id as string,
    };
  });

export const storeSentCode = privateMutation
  .input(
    z.object({
      codeHash: z.string().min(1),
      rowId: z.string().min(1),
      sentAtMs: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const now = new Date(input.sentAtMs);
    await ctx.orm
      .update(accountDeletionCode)
      .set({ codeHash: input.codeHash, sentAt: now, updatedAt: now })
      .where(
        eq(accountDeletionCode.id, input.rowId as Id<"accountDeletionCode">)
      );
  });

export const discardCode = privateMutation
  .input(z.object({ userId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    // Linha fora = cooldown zerado: o usuario pode pedir codigo novo na hora.
    await ctx.orm
      .delete(accountDeletionCode)
      .where(eq(accountDeletionCode.userId, input.userId as Id<"user">));
  });

/**
 * Envio do codigo em action: a geracao aleatoria (getRandomValues) e o e-mail
 * (Resend) sao efeito externo; o hash do codigo vira escrita via privateMutation.
 */
export const send = privateAction
  .input(z.object({ userId: z.string().min(1) }))
  .action(async ({ ctx, input }) => {
    const pending = await ctx.runQuery(
      internal.account.deletionCode.readPending,
      {
        userId: input.userId,
      }
    );
    if (!pending || pending.codeHash.length > 0) {
      return;
    }

    const env = getEnv();
    if (!env.RESEND_EMAIL_API_KEY) {
      console.error(
        `[accountDeletion] RESEND_EMAIL_API_KEY não configurada: código não enviado para ${pending.email}`
      );
      await ctx.runMutation(internal.account.deletionCode.discardCode, {
        userId: input.userId,
      });
      throw new Error(
        "[accountDeletion] RESEND_EMAIL_API_KEY não configurada."
      );
    }

    const randomBytes = new Uint8Array(DELETION_CODE_LENGTH);
    crypto.getRandomValues(randomBytes);
    const code = generateDeletionCode(randomBytes);
    const nowMs = Date.now();
    await ctx.runMutation(internal.account.deletionCode.storeSentCode, {
      codeHash: sha256Hex(code),
      rowId: pending.rowId,
      sentAtMs: nowMs,
    });

    const resend = new Resend(env.RESEND_EMAIL_API_KEY);
    const { html, subject } = buildDeletionCodeEmail(code);
    try {
      const { data, error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        html,
        subject,
        to: pending.email,
      });
      if (error) {
        throw new Error(`${error.name}: ${error.message}`);
      }
      console.log(
        `[accountDeletion] Código enviado para ${pending.email} (id: ${data?.id ?? "?"})`
      );
    } catch (error) {
      await ctx.runMutation(internal.account.deletionCode.discardCode, {
        userId: input.userId,
      });
      console.error(
        `[accountDeletion] Falha no envio para ${pending.email}:`,
        error
      );
      throw error;
    }
  });
