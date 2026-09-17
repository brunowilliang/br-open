import { defineMigration } from "../generated/migrations.gen";

type TeamDoc = {
  _id: string;
  memberCount?: null | number;
};

export const migration = defineMigration({
  id: "20260917_221648_backfill_team_member_count",
  description: "backfill team memberCount from teamMember rows",
  up: {
    table: "team",
    migrateOne: async (ctx, doc) => {
      // Better Auth 1.7 team counter (IBX-0056 deployment 1). The 1.7
      // organization schema declares memberCount required with default 0,
      // so every pre-existing team row gets its real count from the
      // indexed teamId membership rows before the bump promotes the field.
      const team = doc as TeamDoc;
      if (typeof team.memberCount === "number") {
        return undefined;
      }
      const members = await ctx.db
        .query("teamMember")
        .withIndex("teamId", (query) => query.eq("teamId", team._id))
        .collect();
      return { memberCount: members.length };
    },
  },
});
