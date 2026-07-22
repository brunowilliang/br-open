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
    createdAt: timestamp().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull(),
    image: text(),
    lastActiveOrganizationId: id("organization").references(
      () => organization.id
    ),
    name: text().notNull(),
    personalOrganizationId: id("organization").references(
      () => organization.id
    ),
    updatedAt: timestamp().notNull(),
    userId: text(),
  },
  (user) => [
    index("email_name").on(user.email, user.name),
    index("name").on(user.name),
    index("lastActiveOrganizationId").on(user.lastActiveOrganizationId),
    index("personalOrganizationId").on(user.personalOrganizationId),
  ]
);

export const userPreference = convexTable(
  "userPreference",
  {
    activeActorKind: text().notNull(),
    activeOrganizationId: id("organization").references(() => organization.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    userId: id("user")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (userPreference) => [
    index("activeOrganizationId").on(userPreference.activeOrganizationId),
  ]
);

export const session = convexTable(
  "session",
  {
    activeOrganizationId: id("organization").references(() => organization.id),
    activeTeamId: id("team").references(() => team.id),
    createdAt: timestamp().notNull(),
    expiresAt: timestamp().notNull(),
    ipAddress: text(),
    token: text().notNull().unique(),
    updatedAt: timestamp().notNull(),
    userAgent: text(),
    userId: id("user")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    accessToken: text(),
    accessTokenExpiresAt: timestamp(),
    accountId: text().notNull(),
    createdAt: timestamp().notNull(),
    idToken: text(),
    password: text(),
    providerId: text().notNull(),
    refreshToken: text(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    updatedAt: timestamp().notNull(),
    userId: id("user")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    createdAt: timestamp().notNull(),
    expiresAt: timestamp().notNull(),
    identifier: text().notNull(),
    updatedAt: timestamp().notNull(),
    value: text().notNull(),
  },
  (verification) => [
    index("expiresAt").on(verification.expiresAt),
    index("identifier").on(verification.identifier),
  ]
);

export const jwks = convexTable("jwks", {
  createdAt: timestamp().notNull(),
  expiresAt: timestamp(),
  privateKey: text().notNull(),
  publicKey: text().notNull(),
});

export const organization = convexTable(
  "organization",
  {
    createdAt: timestamp().notNull(),
    logo: text(),
    metadata: json<Record<string, unknown>>(),
    name: text().notNull(),
    // Embedded payment account (PIX key, status, etc.) — mirrors the
    // metadata pattern: raw JSON here, validated by `paymentAccountSchema`
    // in convex/domains/payment/contract.ts. Null until the org onboards.
    paymentAccount: json<Record<string, unknown>>(),
    slug: text().notNull().unique(),
    updatedAt: timestamp(),
  },
  (organization) => [index("name").on(organization.name)]
);

export const member = convexTable(
  "member",
  {
    createdAt: timestamp().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => organization.id),
    role: text().notNull(),
    userId: id("user")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
    createdAt: timestamp().notNull(),
    name: text().notNull(),
    organizationId: id("organization")
      .notNull()
      .references(() => organization.id),
    updatedAt: timestamp(),
  },
  (team) => [index("organizationId").on(team.organizationId)]
);

export const teamMember = convexTable(
  "teamMember",
  {
    createdAt: timestamp(),
    teamId: id("team")
      .notNull()
      .references(() => team.id),
    userId: id("user")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (teamMember) => [
    index("teamId").on(teamMember.teamId),
    index("userId").on(teamMember.userId),
  ]
);

export const invitation = convexTable(
  "invitation",
  {
    createdAt: timestamp().notNull(),
    email: text().notNull(),
    expiresAt: timestamp(),
    inviterId: id("user")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: id("organization")
      .notNull()
      .references(() => organization.id),
    role: text().notNull(),
    status: text().notNull(),
    teamId: id("team").references(() => team.id),
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
