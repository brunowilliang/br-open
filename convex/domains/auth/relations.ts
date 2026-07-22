import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const defineAuthRelations = (r: RelationsBuilder<typeof tables>) => ({
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  invitation: {
    inviter: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
    }),
    organization: r.one.organization({
      from: r.invitation.organizationId,
      to: r.organization.id,
    }),
    team: r.one.team({
      from: r.invitation.teamId,
      to: r.team.id,
    }),
  },
  member: {
    organization: r.one.organization({
      from: r.member.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({
      from: r.member.userId,
      to: r.user.id,
    }),
  },
  organization: {
    invitations: r.many.invitation({
      from: r.organization.id,
      to: r.invitation.organizationId,
    }),
    managedLeagues: r.many.league({
      from: r.organization.id,
      to: r.league.organizationId,
    }),
    members: r.many.member({
      from: r.organization.id,
      to: r.member.organizationId,
    }),
    sessions: r.many.session({
      from: r.organization.id,
      to: r.session.activeOrganizationId,
    }),
    teams: r.many.team({
      from: r.organization.id,
      to: r.team.organizationId,
    }),
    usersAsLastActiveOrganization: r.many.user({
      alias: "lastActiveOrganization",
      from: r.organization.id,
      to: r.user.lastActiveOrganizationId,
    }),
    usersAsPersonalOrganization: r.many.user({
      alias: "personalOrganization",
      from: r.organization.id,
      to: r.user.personalOrganizationId,
    }),
  },
  session: {
    activeOrganization: r.one.organization({
      from: r.session.activeOrganizationId,
      to: r.organization.id,
    }),
    activeTeam: r.one.team({
      from: r.session.activeTeamId,
      to: r.team.id,
    }),
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  team: {
    invitations: r.many.invitation({
      from: r.team.id,
      to: r.invitation.teamId,
    }),
    members: r.many.teamMember({
      from: r.team.id,
      to: r.teamMember.teamId,
    }),
    organization: r.one.organization({
      from: r.team.organizationId,
      to: r.organization.id,
    }),
    sessions: r.many.session({
      from: r.team.id,
      to: r.session.activeTeamId,
    }),
  },
  teamMember: {
    team: r.one.team({
      from: r.teamMember.teamId,
      to: r.team.id,
    }),
    user: r.one.user({
      from: r.teamMember.userId,
      to: r.user.id,
    }),
  },
  user: {
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
    invitations: r.many.invitation({
      from: r.user.id,
      to: r.invitation.inviterId,
    }),
    lastActiveOrganization: r.one.organization({
      alias: "lastActiveOrganization",
      from: r.user.lastActiveOrganizationId,
      to: r.organization.id,
    }),
    members: r.many.member({
      from: r.user.id,
      to: r.member.userId,
    }),
    notificationDevices: r.many.notificationDevice({
      from: r.user.id,
      to: r.notificationDevice.userId,
    }),
    notificationFeed: r.many.notificationFeed({
      from: r.user.id,
      to: r.notificationFeed.recipientUserId,
    }),
    notificationFeedAsActor: r.many.notificationFeed({
      alias: "actor",
      from: r.user.id,
      to: r.notificationFeed.actorUserId,
    }),
    personalOrganization: r.one.organization({
      alias: "personalOrganization",
      from: r.user.personalOrganizationId,
      to: r.organization.id,
    }),
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
    teamMembers: r.many.teamMember({
      from: r.user.id,
      to: r.teamMember.userId,
    }),
  },
  userPreference: {
    user: r.one.user({
      from: r.userPreference.userId,
      to: r.user.id,
    }),
  },
});
