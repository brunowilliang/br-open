import { convexTable, id, text, timestamp } from "kitcn/orm";

import * as authTables from "../auth/tables";

export const playerProfile = convexTable("playerProfile", {
  userId: id("user")
    .notNull()
    .unique()
    .references(() => authTables.user.id),
  fullName: text(),
  nickname: text(),
  birthDate: text(),
  gender: text(),
  cpf: text(),
  phone: text(),
  address: text(),
  city: text(),
  state: text(),
  zipCode: text(),
  country: text(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
});
