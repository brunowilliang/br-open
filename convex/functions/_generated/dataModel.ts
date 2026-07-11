/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
  AnyDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like `queryGeneric` and
 * `mutationGeneric` to make them type-safe.
 */

export type DataModel = {
  account: {
    document: {
      accessToken?: null | string;
      accessTokenExpiresAt?: null | number;
      accountId: string;
      createdAt: number;
      idToken?: null | string;
      password?: null | string;
      providerId: string;
      refreshToken?: null | string;
      refreshTokenExpiresAt?: null | number;
      scope?: null | string;
      updatedAt: number;
      userId: Id<"user">;
      _id: Id<"account">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accessToken"
      | "accessTokenExpiresAt"
      | "accountId"
      | "createdAt"
      | "idToken"
      | "password"
      | "providerId"
      | "refreshToken"
      | "refreshTokenExpiresAt"
      | "scope"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      accountId: ["accountId", "_creationTime"];
      accountId_providerId: ["accountId", "providerId", "_creationTime"];
      providerId_userId: ["providerId", "userId", "_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_bucket: {
    document: {
      count: number;
      indexName: string;
      keyHash: string;
      keyParts: Array<null | any>;
      nonNullCountValues: Record<string, number>;
      sumValues: Record<string, number>;
      tableKey: string;
      updatedAt: number;
      _id: Id<"aggregate_bucket">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "count"
      | "indexName"
      | "keyHash"
      | "keyParts"
      | "nonNullCountValues"
      | `nonNullCountValues.${string}`
      | "sumValues"
      | `sumValues.${string}`
      | "tableKey"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_table_index: ["tableKey", "indexName", "_creationTime"];
      by_table_index_hash: [
        "tableKey",
        "indexName",
        "keyHash",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_extrema: {
    document: {
      count: number;
      fieldName: string;
      indexName: string;
      keyHash: string;
      sortKey: string;
      tableKey: string;
      updatedAt: number;
      value: any;
      valueHash: string;
      _id: Id<"aggregate_extrema">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "count"
      | "fieldName"
      | "indexName"
      | "keyHash"
      | "sortKey"
      | "tableKey"
      | "updatedAt"
      | "value"
      | "valueHash";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_table_index: ["tableKey", "indexName", "_creationTime"];
      by_table_index_hash_field_sort: [
        "tableKey",
        "indexName",
        "keyHash",
        "fieldName",
        "sortKey",
        "_creationTime",
      ];
      by_table_index_hash_field_value: [
        "tableKey",
        "indexName",
        "keyHash",
        "fieldName",
        "valueHash",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_member: {
    document: {
      docId: string;
      extremaValues: Record<string, null | any>;
      indexName: string;
      keyHash: string;
      keyParts: Array<null | any>;
      kind: string;
      nonNullCountValues: Record<string, number>;
      rankKey?: null | any;
      rankNamespace?: null | any;
      rankSumValue?: null | number;
      sumValues: Record<string, number>;
      tableKey: string;
      updatedAt: number;
      _id: Id<"aggregate_member">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "docId"
      | "extremaValues"
      | `extremaValues.${string}`
      | "indexName"
      | "keyHash"
      | "keyParts"
      | "kind"
      | "nonNullCountValues"
      | `nonNullCountValues.${string}`
      | "rankKey"
      | "rankNamespace"
      | "rankSumValue"
      | "sumValues"
      | `sumValues.${string}`
      | "tableKey"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_kind_table_index: ["kind", "tableKey", "indexName", "_creationTime"];
      by_kind_table_index_doc: [
        "kind",
        "tableKey",
        "indexName",
        "docId",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_rank_node: {
    document: {
      aggregate?: null | { count: number; sum: number };
      items: Array<{ k: null | any; s: number; v: null | any }>;
      subtrees: Array<string>;
      _id: Id<"aggregate_rank_node">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "aggregate"
      | "aggregate.count"
      | "aggregate.sum"
      | "items"
      | "subtrees";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_rank_tree: {
    document: {
      aggregateName: string;
      maxNodeSize: number;
      namespace?: null | any;
      root: Id<"aggregate_rank_node">;
      _id: Id<"aggregate_rank_tree">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "aggregateName"
      | "maxNodeSize"
      | "namespace"
      | "root";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_aggregate_name: ["aggregateName", "_creationTime"];
      by_namespace: ["namespace", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  aggregate_state: {
    document: {
      completedAt?: null | number;
      cursor?: null | string;
      indexName: string;
      keyDefinitionHash: string;
      kind: string;
      lastError?: null | string;
      metricDefinitionHash: string;
      processed: number;
      startedAt: number;
      status: string;
      tableKey: string;
      updatedAt: number;
      _id: Id<"aggregate_state">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "completedAt"
      | "cursor"
      | "indexName"
      | "keyDefinitionHash"
      | "kind"
      | "lastError"
      | "metricDefinitionHash"
      | "processed"
      | "startedAt"
      | "status"
      | "tableKey"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_kind_status: ["kind", "status", "_creationTime"];
      by_kind_table_index: ["kind", "tableKey", "indexName", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  invitation: {
    document: {
      createdAt: number;
      email: string;
      expiresAt?: null | number;
      inviterId: Id<"user">;
      organizationId: Id<"organization">;
      role: string;
      status: string;
      teamId?: null | Id<"team">;
      _id: Id<"invitation">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "email"
      | "expiresAt"
      | "inviterId"
      | "organizationId"
      | "role"
      | "status"
      | "teamId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      email: ["email", "_creationTime"];
      email_organizationId_status: [
        "email",
        "organizationId",
        "status",
        "_creationTime",
      ];
      inviterId: ["inviterId", "_creationTime"];
      organizationId_status: ["organizationId", "status", "_creationTime"];
      status: ["status", "_creationTime"];
      teamId: ["teamId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  jwks: {
    document: {
      createdAt: number;
      expiresAt?: null | number;
      privateKey: string;
      publicKey: string;
      _id: Id<"jwks">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "expiresAt"
      | "privateKey"
      | "publicKey";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  league: {
    document: {
      approvalMode?: null | string;
      avatarStorageId?: null | string;
      categories: any;
      city: string;
      courts?: null | any;
      coverStorageId?: null | string;
      createdAt: number;
      description?: null | string;
      gracePeriodDays?: null | number;
      locationNotes?: null | string;
      maxPlayers?: null | number;
      mode: string;
      monthlyPriceCents?: null | number;
      name: string;
      organizationId: Id<"organization">;
      priceBillingInterval?: null | string;
      reminderDaysBefore?: null | number;
      ruleConfig: any;
      state: string;
      updatedAt: number;
      visibility: string;
      _id: Id<"league">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "approvalMode"
      | "avatarStorageId"
      | "categories"
      | "city"
      | "courts"
      | "coverStorageId"
      | "createdAt"
      | "description"
      | "gracePeriodDays"
      | "locationNotes"
      | "maxPlayers"
      | "mode"
      | "monthlyPriceCents"
      | "name"
      | "organizationId"
      | "priceBillingInterval"
      | "reminderDaysBefore"
      | "ruleConfig"
      | "state"
      | "updatedAt"
      | "visibility";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      organizationId: ["organizationId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  leagueChallenge: {
    document: {
      cancellationRequestedAt?: null | number;
      cancellationRequestedByMembershipId?: null | Id<"leagueMembership">;
      cancelledAt?: null | number;
      challengeValidationMode: string;
      challengedMembershipId: Id<"leagueMembership">;
      challengerMembershipId: Id<"leagueMembership">;
      confirmedAt?: null | number;
      createdAt: number;
      currentProposalId?: null | string;
      finishedAt?: null | number;
      invalidatedAt?: null | number;
      leagueId: Id<"league">;
      lockedAt?: null | number;
      matchConfigSnapshot: any;
      rankingAppliedAt?: null | number;
      rankingSnapshotAfterResult?: null | any;
      rankingSnapshotBeforeResult?: null | any;
      resultValidationMode: string;
      status: string;
      updatedAt: number;
      _id: Id<"leagueChallenge">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "cancellationRequestedAt"
      | "cancellationRequestedByMembershipId"
      | "cancelledAt"
      | "challengedMembershipId"
      | "challengerMembershipId"
      | "challengeValidationMode"
      | "confirmedAt"
      | "createdAt"
      | "currentProposalId"
      | "finishedAt"
      | "invalidatedAt"
      | "leagueId"
      | "lockedAt"
      | "matchConfigSnapshot"
      | "rankingAppliedAt"
      | "rankingSnapshotAfterResult"
      | "rankingSnapshotBeforeResult"
      | "resultValidationMode"
      | "status"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      cancellationRequestedByMembershipId: [
        "cancellationRequestedByMembershipId",
        "_creationTime",
      ];
      challengedMembershipId_status: [
        "challengedMembershipId",
        "status",
        "_creationTime",
      ];
      challengerMembershipId_status: [
        "challengerMembershipId",
        "status",
        "_creationTime",
      ];
      currentProposalId: ["currentProposalId", "_creationTime"];
      leagueId_status: ["leagueId", "status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  leagueChallengeOrganizerAction: {
    document: {
      action: string;
      challengeId: Id<"leagueChallenge">;
      createdAt: number;
      fromStatus: string;
      performedByUserId?: null | Id<"user">;
      reason?: null | string;
      toStatus: string;
      _id: Id<"leagueChallengeOrganizerAction">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "action"
      | "challengeId"
      | "createdAt"
      | "fromStatus"
      | "performedByUserId"
      | "reason"
      | "toStatus";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      challengeId: ["challengeId", "_creationTime"];
      performedByUserId: ["performedByUserId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  leagueChallengeProposal: {
    document: {
      challengeId: Id<"leagueChallenge">;
      courtId: string;
      createdAt: number;
      endMinute: number;
      matchDate: string;
      proposedByMembershipId: Id<"leagueMembership">;
      responseDeadlineAt: number;
      revisionNumber: number;
      startMinute: number;
      status: string;
      _id: Id<"leagueChallengeProposal">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "challengeId"
      | "courtId"
      | "createdAt"
      | "endMinute"
      | "matchDate"
      | "proposedByMembershipId"
      | "responseDeadlineAt"
      | "revisionNumber"
      | "startMinute"
      | "status";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      challengeId_revisionNumber: [
        "challengeId",
        "revisionNumber",
        "_creationTime",
      ];
      courtId_matchDate: ["courtId", "matchDate", "_creationTime"];
      proposedByMembershipId: ["proposedByMembershipId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  leagueChallengeResultSubmission: {
    document: {
      challengeId: Id<"leagueChallenge">;
      confirmedAt?: null | number;
      confirmedByMembershipId?: null | Id<"leagueMembership">;
      organizerReviewedByUserId?: null | Id<"user">;
      reviewAction?: null | string;
      reviewedAt?: null | number;
      score: any;
      submittedAt: number;
      submittedByMembershipId: Id<"leagueMembership">;
      winnerMembershipId?: null | Id<"leagueMembership">;
      _id: Id<"leagueChallengeResultSubmission">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "challengeId"
      | "confirmedAt"
      | "confirmedByMembershipId"
      | "organizerReviewedByUserId"
      | "reviewAction"
      | "reviewedAt"
      | "score"
      | "submittedAt"
      | "submittedByMembershipId"
      | "winnerMembershipId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      challengeId_submittedAt: ["challengeId", "submittedAt", "_creationTime"];
      confirmedByMembershipId: ["confirmedByMembershipId", "_creationTime"];
      organizerReviewedByUserId: ["organizerReviewedByUserId", "_creationTime"];
      submittedByMembershipId: ["submittedByMembershipId", "_creationTime"];
      winnerMembershipId: ["winnerMembershipId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  leagueMembership: {
    document: {
      createdAt: number;
      lastRenewalReminderSentAt?: null | number;
      leagueId: Id<"league">;
      playerProfileId: Id<"playerProfile">;
      rankingPosition?: null | number;
      reviewedAt?: null | number;
      status: string;
      updatedAt: number;
      _id: Id<"leagueMembership">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "lastRenewalReminderSentAt"
      | "leagueId"
      | "playerProfileId"
      | "rankingPosition"
      | "reviewedAt"
      | "status"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      leagueId_playerProfileId: [
        "leagueId",
        "playerProfileId",
        "_creationTime",
      ];
      leagueId_rankingPosition: [
        "leagueId",
        "rankingPosition",
        "_creationTime",
      ];
      leagueId_status: ["leagueId", "status", "_creationTime"];
      playerProfileId_status: ["playerProfileId", "status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  member: {
    document: {
      createdAt: number;
      organizationId: Id<"organization">;
      role: string;
      userId: Id<"user">;
      _id: Id<"member">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "organizationId"
      | "role"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      organizationId_role: ["organizationId", "role", "_creationTime"];
      organizationId_userId: ["organizationId", "userId", "_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  migration_run: {
    document: {
      allowDrift: boolean;
      cancelRequested: boolean;
      completedAt?: null | number;
      currentIndex: number;
      direction: string;
      dryRun: boolean;
      lastError?: null | string;
      migrationIds: Array<string>;
      runId: string;
      startedAt: number;
      status: string;
      updatedAt: number;
      _id: Id<"migration_run">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "allowDrift"
      | "cancelRequested"
      | "completedAt"
      | "currentIndex"
      | "direction"
      | "dryRun"
      | "lastError"
      | "migrationIds"
      | "runId"
      | "startedAt"
      | "status"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_run_id: ["runId", "_creationTime"];
      by_status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  migration_state: {
    document: {
      applied: boolean;
      checksum: string;
      completedAt?: null | number;
      cursor?: null | string;
      direction?: null | string;
      lastError?: null | string;
      migrationId: string;
      processed: number;
      runId?: null | string;
      startedAt?: null | number;
      status: string;
      updatedAt: number;
      writeMode: string;
      _id: Id<"migration_state">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "applied"
      | "checksum"
      | "completedAt"
      | "cursor"
      | "direction"
      | "lastError"
      | "migrationId"
      | "processed"
      | "runId"
      | "startedAt"
      | "status"
      | "updatedAt"
      | "writeMode";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_migration_id: ["migrationId", "_creationTime"];
      by_status: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  notificationDelivery: {
    document: {
      attempts: number;
      deliveredAt?: null | number;
      deviceId: Id<"notificationDevice">;
      errorMessage?: null | string;
      expoPushToken: string;
      feedId: Id<"notificationFeed">;
      lastAttemptAt?: null | number;
      responseId?: null | string;
      state:
        | "awaiting_delivery"
        | "in_progress"
        | "delivered"
        | "needs_retry"
        | "failed"
        | "maybe_delivered"
        | "unable_to_deliver";
      _id: Id<"notificationDelivery">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "attempts"
      | "deliveredAt"
      | "deviceId"
      | "errorMessage"
      | "expoPushToken"
      | "feedId"
      | "lastAttemptAt"
      | "responseId"
      | "state";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      deviceId: ["deviceId", "_creationTime"];
      feedId: ["feedId", "_creationTime"];
      state: ["state", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  notificationDeliveryLock: {
    document: {
      claimedAt: number;
      expiresAt: number;
      key: string;
      _id: Id<"notificationDeliveryLock">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "claimedAt" | "expiresAt" | "key";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      key: ["key", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  notificationDevice: {
    document: {
      disabledAt?: null | number;
      expoPushToken: string;
      lastSeenAt: number;
      permissionStatus: string;
      platform: string;
      registeredAt: number;
      userId: Id<"user">;
      _id: Id<"notificationDevice">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "disabledAt"
      | "expoPushToken"
      | "lastSeenAt"
      | "permissionStatus"
      | "platform"
      | "registeredAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      expoPushToken: ["expoPushToken", "_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  notificationFeed: {
    document: {
      actorUserId?: null | Id<"user">;
      body: string;
      data: any;
      eventType: string;
      isRead: boolean;
      occurredAt: number;
      readAt?: null | number;
      recipientActorKind: string;
      recipientOrganizationId?: null | Id<"organization">;
      recipientPlayerProfileId?: null | Id<"playerProfile">;
      recipientUserId: Id<"user">;
      retractedAt?: null | number;
      sourceEntityId?: null | string;
      sourceEntityType?: null | string;
      status?: null | "active" | "retracted";
      title: string;
      _id: Id<"notificationFeed">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "actorUserId"
      | "body"
      | "data"
      | "eventType"
      | "isRead"
      | "occurredAt"
      | "readAt"
      | "recipientActorKind"
      | "recipientOrganizationId"
      | "recipientPlayerProfileId"
      | "recipientUserId"
      | "retractedAt"
      | "sourceEntityId"
      | "sourceEntityType"
      | "status"
      | "title";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      actorUserId: ["actorUserId", "_creationTime"];
      eventType: ["eventType", "_creationTime"];
      recipientOrganizationId_occurredAt: [
        "recipientOrganizationId",
        "occurredAt",
        "_creationTime",
      ];
      recipientPlayerProfileId_occurredAt: [
        "recipientPlayerProfileId",
        "occurredAt",
        "_creationTime",
      ];
      recipientUserId_actorKind_isRead: [
        "recipientUserId",
        "recipientActorKind",
        "isRead",
        "_creationTime",
      ];
      recipientUserId_actorKind_occurredAt: [
        "recipientUserId",
        "recipientActorKind",
        "occurredAt",
        "_creationTime",
      ];
      recipientUserId_isRead: ["recipientUserId", "isRead", "_creationTime"];
      recipientUserId_occurredAt: [
        "recipientUserId",
        "occurredAt",
        "_creationTime",
      ];
      sourceEntity: ["sourceEntityType", "sourceEntityId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  notificationPreference: {
    document: {
      pushEnabled: boolean;
      updatedAt: number;
      userId: Id<"user">;
      _id: Id<"notificationPreference">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "pushEnabled"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  organization: {
    document: {
      createdAt: number;
      logo?: null | string;
      metadata?: null | any;
      name: string;
      paymentAccount?: null | any;
      slug: string;
      updatedAt?: null | number;
      _id: Id<"organization">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "logo"
      | "metadata"
      | "name"
      | "paymentAccount"
      | "slug"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      name: ["name", "_creationTime"];
      organization_slug_unique: ["slug", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  paymentCharge: {
    document: {
      amountCents: number;
      brCode?: null | string;
      correlationId: string;
      createdAt: number;
      expiresAt?: null | number;
      organizationId: Id<"organization">;
      paidAt?: null | number;
      playerProfileId: Id<"playerProfile">;
      providerChargeId?: null | string;
      providerTransactionId?: null | string;
      qrCodeImage?: null | string;
      sourceId: string;
      sourceLabel?: null | string;
      sourceType: string;
      splitConfig?: null | any;
      status: string;
      updatedAt: number;
      _id: Id<"paymentCharge">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "amountCents"
      | "brCode"
      | "correlationId"
      | "createdAt"
      | "expiresAt"
      | "organizationId"
      | "paidAt"
      | "playerProfileId"
      | "providerChargeId"
      | "providerTransactionId"
      | "qrCodeImage"
      | "sourceId"
      | "sourceLabel"
      | "sourceType"
      | "splitConfig"
      | "status"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      correlationId: ["correlationId", "_creationTime"];
      playerProfileId_status: ["playerProfileId", "status", "_creationTime"];
      sourceType_sourceId_status: [
        "sourceType",
        "sourceId",
        "status",
        "_creationTime",
      ];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  playerProfile: {
    document: {
      avatarStorageId?: null | string;
      createdAt: number;
      fullName?: null | string;
      gender?: null | string;
      nickname?: null | string;
      phone?: null | string;
      updatedAt: number;
      userId: Id<"user">;
      _id: Id<"playerProfile">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "avatarStorageId"
      | "createdAt"
      | "fullName"
      | "gender"
      | "nickname"
      | "phone"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      playerProfile_userId_unique: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  session: {
    document: {
      activeOrganizationId?: null | Id<"organization">;
      activeTeamId?: null | Id<"team">;
      createdAt: number;
      expiresAt: number;
      ipAddress?: null | string;
      token: string;
      updatedAt: number;
      userAgent?: null | string;
      userId: Id<"user">;
      _id: Id<"session">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "activeOrganizationId"
      | "activeTeamId"
      | "createdAt"
      | "expiresAt"
      | "ipAddress"
      | "token"
      | "updatedAt"
      | "userAgent"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      activeOrganizationId: ["activeOrganizationId", "_creationTime"];
      activeTeamId: ["activeTeamId", "_creationTime"];
      expiresAt: ["expiresAt", "_creationTime"];
      expiresAt_userId: ["expiresAt", "userId", "_creationTime"];
      session_token_unique: ["token", "_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  team: {
    document: {
      createdAt: number;
      name: string;
      organizationId: Id<"organization">;
      updatedAt?: null | number;
      _id: Id<"team">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "name"
      | "organizationId"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      organizationId: ["organizationId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  teamMember: {
    document: {
      createdAt?: null | number;
      teamId: Id<"team">;
      userId: Id<"user">;
      _id: Id<"teamMember">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "createdAt" | "teamId" | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      teamId: ["teamId", "_creationTime"];
      userId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  user: {
    document: {
      createdAt: number;
      email: string;
      emailVerified: boolean;
      image?: null | string;
      lastActiveOrganizationId?: null | Id<"organization">;
      name: string;
      personalOrganizationId?: null | Id<"organization">;
      updatedAt: number;
      userId?: null | string;
      _id: Id<"user">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "email"
      | "emailVerified"
      | "image"
      | "lastActiveOrganizationId"
      | "name"
      | "personalOrganizationId"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      email_name: ["email", "name", "_creationTime"];
      lastActiveOrganizationId: ["lastActiveOrganizationId", "_creationTime"];
      name: ["name", "_creationTime"];
      personalOrganizationId: ["personalOrganizationId", "_creationTime"];
      user_email_unique: ["email", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  userPreference: {
    document: {
      activeActorKind: string;
      activeOrganizationId?: null | Id<"organization">;
      createdAt: number;
      updatedAt: number;
      userId: Id<"user">;
      _id: Id<"userPreference">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "activeActorKind"
      | "activeOrganizationId"
      | "createdAt"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      activeOrganizationId: ["activeOrganizationId", "_creationTime"];
      userPreference_userId_unique: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  verification: {
    document: {
      createdAt: number;
      expiresAt: number;
      identifier: string;
      updatedAt: number;
      value: string;
      _id: Id<"verification">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "expiresAt"
      | "identifier"
      | "updatedAt"
      | "value";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      expiresAt: ["expiresAt", "_creationTime"];
      identifier: ["identifier", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
};

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using `db.get(tableName, id)` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;
