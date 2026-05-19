import {
  boolean,
  convexTable,
  id,
  index,
  json,
  text,
  timestamp,
} from "kitcn/orm";

export const user = convexTable(
  "user",
  {
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull(),
    image: text(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    userId: text(),
    lastActiveOrganizationId: id("organization").references(
      () => organization.id
    ),
    personalOrganizationId: id("organization").references(
      () => organization.id
    ),
  },
  (user) => [
    index("email_name").on(user.email, user.name),
    index("name").on(user.name),
    index("lastActiveOrganizationId").on(user.lastActiveOrganizationId),
    index("personalOrganizationId").on(user.personalOrganizationId),
  ]
);

export const session = convexTable(
  "session",
  {
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    ipAddress: text(),
    userAgent: text(),
    activeOrganizationId: id("organization").references(() => organization.id),
    activeTeamId: id("team").references(() => team.id),
    userId: id("user")
      .notNull()
      .references(() => user.id),
  },
  (session) => [
    index("expiresAt").on(session.expiresAt),
    index("expiresAt_userId").on(session.expiresAt, session.userId),
    index("userId").on(session.userId),
    index("activeOrganizationId").on(session.activeOrganizationId),
    index("activeTeamId").on(session.activeTeamId),
  ]
);

export const account = convexTable(
  "account",
  {
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: id("user")
      .notNull()
      .references(() => user.id),
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
  (account) => [
    index("accountId").on(account.accountId),
    index("accountId_providerId").on(account.accountId, account.providerId),
    index("providerId_userId").on(account.providerId, account.userId),
    index("userId").on(account.userId),
  ]
);

export const verification = convexTable(
  "verification",
  {
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (verification) => [
    index("expiresAt").on(verification.expiresAt),
    index("identifier").on(verification.identifier),
  ]
);

export const jwks = convexTable("jwks", {
  publicKey: text().notNull(),
  privateKey: text().notNull(),
  createdAt: timestamp().notNull(),
  expiresAt: timestamp(),
});

export const organization = convexTable(
  "organization",
  {
    name: text().notNull(),
    slug: text().notNull().unique(),
    logo: text(),
    metadata: json<Record<string, unknown>>(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp(),
  },
  (organization) => [index("name").on(organization.name)]
);

export const member = convexTable(
  "member",
  {
    organizationId: id("organization")
      .notNull()
      .references(() => organization.id),
    userId: id("user")
      .notNull()
      .references(() => user.id),
    role: text().notNull(),
    createdAt: timestamp().notNull(),
  },
  (member) => [
    index("organizationId_role").on(member.organizationId, member.role),
    index("organizationId_userId").on(member.organizationId, member.userId),
    index("userId").on(member.userId),
  ]
);

export const team = convexTable(
  "team",
  {
    name: text().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => organization.id),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp(),
  },
  (team) => [index("organizationId").on(team.organizationId)]
);

export const teamMember = convexTable(
  "teamMember",
  {
    teamId: id("team")
      .notNull()
      .references(() => team.id),
    userId: id("user")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp(),
  },
  (teamMember) => [
    index("teamId").on(teamMember.teamId),
    index("userId").on(teamMember.userId),
  ]
);

export const invitation = convexTable(
  "invitation",
  {
    organizationId: id("organization")
      .notNull()
      .references(() => organization.id),
    inviterId: id("user")
      .notNull()
      .references(() => user.id),
    email: text().notNull(),
    role: text().notNull(),
    status: text().notNull(),
    expiresAt: timestamp(),
    teamId: id("team").references(() => team.id),
    createdAt: timestamp().notNull(),
  },
  (invitation) => [
    index("email").on(invitation.email),
    index("email_organizationId_status").on(
      invitation.email,
      invitation.organizationId,
      invitation.status
    ),
    index("organizationId_status").on(
      invitation.organizationId,
      invitation.status
    ),
    index("status").on(invitation.status),
    index("teamId").on(invitation.teamId),
    index("inviterId").on(invitation.inviterId),
  ]
);
