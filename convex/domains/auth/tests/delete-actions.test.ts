import { describe, expect, it } from "bun:test";

import * as authTables from "../tables";
import * as leagueTables from "../../league/tables";
import * as notificationTables from "../../notification/tables";
import * as playerTables from "../../player/tables";

type ForeignKeyAction = "cascade" | "set null";

type ColumnWithForeignKeyConfig = {
  config?: {
    foreignKeyConfigs?: Array<{
      config?: {
        onDelete?: ForeignKeyAction;
      };
    }>;
  };
};

function getOnDeleteAction(column: unknown) {
  const columnWithForeignKeyConfig = column as ColumnWithForeignKeyConfig;

  return columnWithForeignKeyConfig.config?.foreignKeyConfigs?.[0]?.config
    ?.onDelete;
}

describe("user delete foreign key actions", () => {
  it("cascades private account data owned by the deleted user", () => {
    expect(getOnDeleteAction(authTables.session.userId)).toBe("cascade");
    expect(getOnDeleteAction(authTables.account.userId)).toBe("cascade");
    expect(getOnDeleteAction(authTables.userPreference.userId)).toBe("cascade");
    expect(getOnDeleteAction(playerTables.playerProfile.userId)).toBe(
      "cascade"
    );
    expect(
      getOnDeleteAction(notificationTables.notificationPreference.userId)
    ).toBe("cascade");
    expect(
      getOnDeleteAction(notificationTables.notificationDevice.userId)
    ).toBe("cascade");
  });

  it("cascades user-owned league data for dev reset deletes", () => {
    expect(getOnDeleteAction(leagueTables.league.organizationId)).toBe(
      "cascade"
    );
    expect(
      getOnDeleteAction(leagueTables.leagueMembership.playerProfileId)
    ).toBe("cascade");
    expect(
      getOnDeleteAction(notificationTables.notificationFeed.recipientUserId)
    ).toBe("cascade");
  });

  it("keeps historical records by nulling audit actor references", () => {
    expect(
      getOnDeleteAction(notificationTables.notificationFeed.actorUserId)
    ).toBe("set null");
    expect(
      getOnDeleteAction(
        leagueTables.leagueChallengeResultSubmission.adminReviewedByUserId
      )
    ).toBe("set null");
    expect(
      getOnDeleteAction(
        leagueTables.leagueChallengeAdminAction.performedByUserId
      )
    ).toBe("set null");
  });
});
