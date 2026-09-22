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
      // Better Auth 1.7 declara memberCount required (default 0) no schema de
      // organização: sem o backfill a linha antiga sobe com 0 em vez do
      // tamanho real do time.
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
