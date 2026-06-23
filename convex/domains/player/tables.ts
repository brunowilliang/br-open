import { convexTable, id, text, timestamp } from "kitcn/orm";

import * as authTables from "../auth/tables";

export const playerProfile = convexTable("playerProfile", {
  userId: id("user")
    .notNull()
    .unique()
    .references(() => authTables.user.id, { onDelete: "cascade" }),
  fullName: text(),
  nickname: text(),
  gender: text(),
  phone: text(),
  avatarStorageId: text(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
});
