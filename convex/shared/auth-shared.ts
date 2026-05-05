import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

const tournamentPermissions = [
  "create",
  "read",
  "update",
  "delete",
  "publish",
  "manageRegistrations",
  "manageDraws",
  "manageSchedule",
  "manageResults",
] as const;

const leaguePermissions = [
  "create",
  "read",
  "update",
  "delete",
  "manageMembers",
  "manageRanking",
  "linkTournament",
] as const;

const venuePermissions = ["create", "read", "update", "delete"] as const;

const statement = {
  ...defaultStatements,
  league: leaguePermissions,
  tournament: tournamentPermissions,
  venue: venuePermissions,
} as const;

export const ac = createAccessControl(statement);

const member = ac.newRole({
  ...memberAc.statements,
  league: ["read"],
  tournament: ["read"],
  venue: ["read"],
});

const owner = ac.newRole({
  ...ownerAc.statements,
  league: leaguePermissions,
  tournament: tournamentPermissions,
  venue: venuePermissions,
});

const admin = ac.newRole({
  ...adminAc.statements,
  league: leaguePermissions,
  tournament: tournamentPermissions,
  venue: venuePermissions,
});

const tournamentManager = ac.newRole({
  ...memberAc.statements,
  invitation: ["create", "cancel"],
  member: ["create", "update"],
  tournament: tournamentPermissions,
  venue: ["read"],
});

const leagueManager = ac.newRole({
  ...memberAc.statements,
  invitation: ["create", "cancel"],
  league: leaguePermissions,
  member: ["create", "update"],
  tournament: ["read"],
});

const clubManager = ac.newRole({
  ...memberAc.statements,
  invitation: ["create", "cancel"],
  member: ["create", "update"],
  tournament: ["create", "read", "update"],
  venue: venuePermissions,
});

export const roles = {
  admin,
  club_manager: clubManager,
  league_manager: leagueManager,
  member,
  owner,
  tournament_manager: tournamentManager,
};
