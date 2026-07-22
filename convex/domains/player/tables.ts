import { convexTable, id, text, timestamp } from "kitcn/orm";

import * as authTables from "../auth/tables";

export const playerProfile = convexTable("playerProfile", {
  avatarStorageId: text(),
  createdAt: timestamp().notNull(),
  fullName: text(),
  gender: text(),
  nickname: text(),
  phone: text(),
  updatedAt: timestamp().notNull(),
  userId: id("user")
    .notNull()
    .unique()
    .references(() => authTables.user.id, { onDelete: "cascade" }),
});
