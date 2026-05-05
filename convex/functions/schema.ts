import {
  boolean,
  convexTable,
  defineSchema,
  index,
  json,
  text,
  timestamp,
} from "kitcn/orm";

export const userTable = convexTable(
  "user",
  {
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull(),
    image: text(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    userId: text(),
    lastActiveOrganizationId: text().references(() => organizationTable.id),
    personalOrganizationId: text().references(() => organizationTable.id),
  },
  (userTable) => [
    index("email_name").on(userTable.email, userTable.name),
    index("name").on(userTable.name),
  ]
);

export const sessionTable = convexTable(
  "session",
  {
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    ipAddress: text(),
    userAgent: text(),
    activeOrganizationId: text().references(() => organizationTable.id),
    activeTeamId: text().references(() => teamTable.id),
    userId: text()
      .notNull()
      .references(() => userTable.id),
  },
  (sessionTable) => [
    index("expiresAt").on(sessionTable.expiresAt),
    index("expiresAt_userId").on(sessionTable.expiresAt, sessionTable.userId),
    index("userId").on(sessionTable.userId),
  ]
);

export const accountTable = convexTable(
  "account",
  {
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => userTable.id),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (accountTable) => [
    index("accountId").on(accountTable.accountId),
    index("accountId_providerId").on(
      accountTable.accountId,
      accountTable.providerId
    ),
    index("providerId_userId").on(accountTable.providerId, accountTable.userId),
    index("userId").on(accountTable.userId),
  ]
);

export const verificationTable = convexTable(
  "verification",
  {
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (verificationTable) => [
    index("expiresAt").on(verificationTable.expiresAt),
    index("identifier").on(verificationTable.identifier),
  ]
);

export const jwksTable = convexTable("jwks", {
  publicKey: text().notNull(),
  privateKey: text().notNull(),
  createdAt: timestamp().notNull(),
  expiresAt: timestamp(),
});

export const playerProfileTable = convexTable("playerProfile", {
  userId: text()
    .notNull()
    .unique()
    .references(() => userTable.id),
  address: text(),
  birthDate: text(),
  city: text(),
  country: text(),
  cpf: text(),
  fullName: text(),
  gender: text(),
  nickname: text(),
  phone: text(),
  state: text(),
  zipCode: text(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
});

export const organizationTable = convexTable(
  "organization",
  {
    name: text().notNull(),
    slug: text().notNull().unique(),
    logo: text(),
    metadata: json<Record<string, unknown>>(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp(),
  },
  (organizationTable) => [index("name").on(organizationTable.name)]
);

export const memberTable = convexTable(
  "member",
  {
    organizationId: text()
      .notNull()
      .references(() => organizationTable.id),
    userId: text()
      .notNull()
      .references(() => userTable.id),
    role: text().notNull(),
    createdAt: timestamp().notNull(),
  },
  (memberTable) => [
    index("organizationId_role").on(
      memberTable.organizationId,
      memberTable.role
    ),
    index("organizationId_userId").on(
      memberTable.organizationId,
      memberTable.userId
    ),
    index("userId").on(memberTable.userId),
  ]
);

export const teamTable = convexTable(
  "team",
  {
    name: text().notNull(),
    organizationId: text()
      .notNull()
      .references(() => organizationTable.id),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp(),
  },
  (teamTable) => [index("organizationId").on(teamTable.organizationId)]
);

export const teamMemberTable = convexTable(
  "teamMember",
  {
    teamId: text()
      .notNull()
      .references(() => teamTable.id),
    userId: text()
      .notNull()
      .references(() => userTable.id),
    createdAt: timestamp(),
  },
  (teamMemberTable) => [
    index("teamId").on(teamMemberTable.teamId),
    index("userId").on(teamMemberTable.userId),
  ]
);

export const invitationTable = convexTable(
  "invitation",
  {
    organizationId: text()
      .notNull()
      .references(() => organizationTable.id),
    inviterId: text()
      .notNull()
      .references(() => userTable.id),
    email: text().notNull(),
    role: text().notNull(),
    status: text().notNull(),
    expiresAt: timestamp(),
    teamId: text().references(() => teamTable.id),
    createdAt: timestamp().notNull(),
  },
  (invitationTable) => [
    index("email").on(invitationTable.email),
    index("email_organizationId_status").on(
      invitationTable.email,
      invitationTable.organizationId,
      invitationTable.status
    ),
    index("organizationId_status").on(
      invitationTable.organizationId,
      invitationTable.status
    ),
    index("status").on(invitationTable.status),
  ]
);

export const tables = {
  user: userTable,
  session: sessionTable,
  account: accountTable,
  verification: verificationTable,
  jwks: jwksTable,
  playerProfile: playerProfileTable,
  organization: organizationTable,
  member: memberTable,
  team: teamTable,
  teamMember: teamMemberTable,
  invitation: invitationTable,
};

export default defineSchema(tables).relations((r) => ({
  user: {
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
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  organization: {
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
  },
  playerProfile: {
    user: r.one.user({
      from: r.playerProfile.userId,
      to: r.user.id,
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
    inviter: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
    }),
    team: r.one.team({
      from: r.invitation.teamId,
      to: r.team.id,
    }),
  },
}));
