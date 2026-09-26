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

const venuePermissions = ["create", "read", "update", "delete"] as const;

const statement = {
  ...defaultStatements,
  tournament: tournamentPermissions,
  venue: venuePermissions,
} as const;

export const ac = createAccessControl(statement);

const member = ac.newRole({
  ...memberAc.statements,
  tournament: ["read"],
  venue: ["read"],
});

const owner = ac.newRole({
  ...ownerAc.statements,
  tournament: tournamentPermissions,
  venue: venuePermissions,
});

const admin = ac.newRole({
  ...adminAc.statements,
  tournament: tournamentPermissions,
  venue: venuePermissions,
});

export const roles = {
  admin,
  member,
  owner,
};
