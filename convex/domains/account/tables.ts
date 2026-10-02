import { convexTable, id, integer, text, timestamp } from "kitcn/orm";

import * as authTables from "../auth/tables";

/**
 * Uma linha por usuário: o código de 6 dígitos da exclusão. `codeHash` fica
 * vazio entre o pedido e o envio, e a linha morre junto com o usuário (cascade).
 */
export const accountDeletionCode = convexTable("accountDeletionCode", {
  attempts: integer().notNull(),
  codeHash: text().notNull(),
  createdAt: timestamp().notNull(),
  expiresAt: timestamp().notNull(),
  requestedAt: timestamp().notNull(),
  sentAt: timestamp(),
  updatedAt: timestamp().notNull(),
  userId: id("user")
    .notNull()
    .unique()
    .references(() => authTables.user.id, { onDelete: "cascade" }),
});
