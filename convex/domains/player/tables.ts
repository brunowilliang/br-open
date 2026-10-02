import { convexTable, id, text, timestamp } from "kitcn/orm";

import * as authTables from "../auth/tables";

export const playerProfile = convexTable("playerProfile", {
  avatarStorageId: text(),
  createdAt: timestamp().notNull(),
  fullName: text(),
  gender: text(),
  nickname: text(),
  phone: text(),
  // Na exclusao da conta o perfil vira "Jogador removido": `userId` sai com
  // unsetToken (null colidiria no indice unico) e `removedAt` marca a saida.
  removedAt: timestamp(),
  updatedAt: timestamp().notNull(),
  userId: id("user")
    .unique()
    .references(() => authTables.user.id, { onDelete: "set null" }),
});
