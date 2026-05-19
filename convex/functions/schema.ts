import { defineSchema } from "kitcn/orm";

import { defineAuthRelations } from "../domains/auth/relations";
import * as authTables from "../domains/auth/tables";
import { defineLeagueRelations } from "../domains/league/relations";
import * as leagueTables from "../domains/league/tables";
import { definePlayerRelations } from "../domains/player/relations";
import * as playerTables from "../domains/player/tables";

export const tables = {
  ...authTables,
  ...leagueTables,
  ...playerTables,
};

export default defineSchema(tables).relations((r) => ({
  ...defineAuthRelations(r),
  ...defineLeagueRelations(r),
  ...definePlayerRelations(r),
}));
