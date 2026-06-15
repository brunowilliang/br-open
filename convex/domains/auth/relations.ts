import type { RelationsBuilder } from "kitcn/orm";
import type { tables } from "../../functions/schema";

export const defineAuthRelations = (r: RelationsBuilder<typeof tables>) => ({
  user: {
    lastActiveOrganization: r.one.organization({
      from: r.user.lastActiveOrganizationId,
      to: r.organization.id,
      alias: "lastActiveOrganization",
    }),
    personalOrganization: r.one.organization({
      from: r.user.personalOrganizationId,
      to: r.organization.id,
      alias: "personalOrganization",
    }),
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
    members: r.many.member({
      from: r.user.id,
      to: r.member.userId,
    }),
    teamMembers: r.many.teamMember({
      from: r.user.id,
      to: r.teamMember.userId,
    }),
    invitations: r.many.invitation({
      from: r.user.id,
      to: r.invitation.inviterId,
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
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
    activeOrganization: r.one.organization({
      from: r.session.activeOrganizationId,
      to: r.organization.id,
    }),
    activeTeam: r.one.team({
      from: r.session.activeTeamId,
      to: r.team.id,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  userPreference: {
    user: r.one.user({
      from: r.userPreference.userId,
      to: r.user.id,
    }),
  },
  organization: {
    usersAsLastActiveOrganization: r.many.user({
      from: r.organization.id,
      to: r.user.lastActiveOrganizationId,
      alias: "lastActiveOrganization",
    }),
    usersAsPersonalOrganization: r.many.user({
      from: r.organization.id,
      to: r.user.personalOrganizationId,
      alias: "personalOrganization",
    }),
    sessions: r.many.session({
      from: r.organization.id,
      to: r.session.activeOrganizationId,
    }),
    members: r.many.member({
      from: r.organization.id,
      to: r.member.organizationId,
    }),
    teams: r.many.team({
      from: r.organization.id,
      to: r.team.organizationId,
    }),
    invitations: r.many.invitation({
      from: r.organization.id,
      to: r.invitation.organizationId,
    }),
    managedLeagues: r.many.league({
      from: r.organization.id,
      to: r.league.organizationId,
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
  team: {
    organization: r.one.organization({
      from: r.team.organizationId,
      to: r.organization.id,
    }),
    sessions: r.many.session({
      from: r.team.id,
      to: r.session.activeTeamId,
    }),
    members: r.many.teamMember({
      from: r.team.id,
      to: r.teamMember.teamId,
    }),
    invitations: r.many.invitation({
      from: r.team.id,
      to: r.invitation.teamId,
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
  invitation: {
    organization: r.one.organization({
      from: r.invitation.organizationId,
      to: r.organization.id,
    }),
    team: r.one.team({
      from: r.invitation.teamId,
      to: r.team.id,
    }),
    inviter: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
    }),
  },
});
