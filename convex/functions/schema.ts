import { defineSchema } from "kitcn/orm";

import { defineAuthRelations } from "../domains/auth/relations";
import * as authTables from "../domains/auth/tables";
import { defineLeagueRelations } from "../domains/league/relations";
import * as leagueTables from "../domains/league/tables";
import { defineNotificationRelations } from "../domains/notification/relations";
import * as notificationTables from "../domains/notification/tables";
import { definePaymentRelations } from "../domains/payment/relations";
import * as paymentTables from "../domains/payment/tables";
import { definePlayerRelations } from "../domains/player/relations";
import * as playerTables from "../domains/player/tables";

export const tables = {
  ...authTables,
  ...leagueTables,
  ...notificationTables,
  ...paymentTables,
  ...playerTables,
};

export default defineSchema(tables).relations((r) => ({
  ...defineAuthRelations(r),
  ...defineLeagueRelations(r),
  ...defineNotificationRelations(r),
  ...definePaymentRelations(r),
  ...definePlayerRelations(r),
}));
