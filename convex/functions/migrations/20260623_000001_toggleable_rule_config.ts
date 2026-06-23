import { defineMigration } from "../generated/migrations.gen";

const TOGGLEABLE_RULE_FIELDS = [
  "maxChallengeDistance",
  "maxActiveChallengesPerPlayer",
  "maxChallengesPerMonth",
  "responseDeadlineHours",
] as const;

const SCORING_FIELDS = ["scoringMode", "finalSetScoringMode"] as const;

function isPlainNumber(value: unknown): value is number {
  return typeof value === "number";
}

function wrapToggleableRules(
  ruleConfig: Record<string, unknown>
): Record<string, unknown> | null {
  let changed = false;
  const next: Record<string, unknown> = { ...ruleConfig };

  for (const field of TOGGLEABLE_RULE_FIELDS) {
    const current = next[field];

    // Already migrated: skip.
    if (
      current !== null &&
      typeof current === "object" &&
      "enabled" in (current as Record<string, unknown>)
    ) {
      continue;
    }

    if (isPlainNumber(current)) {
      next[field] = { enabled: true, value: current };
      changed = true;
    }
  }

  return changed ? next : null;
}

export function renameScoringValues(
  matchConfig: unknown
): Record<string, unknown> | null {
  if (matchConfig === null || typeof matchConfig !== "object") {
    return null;
  }

  const next = { ...(matchConfig as Record<string, unknown>) };
  let changed = false;

  for (const field of SCORING_FIELDS) {
    if (next[field] === "no_ad") {
      next[field] = "no_advantage";
      changed = true;
    }
  }

  return changed ? next : null;
}

export const migration = defineMigration({
  id: "20260623_000001_toggleable_rule_config",
  description: "toggleable_rule_config",
  up: {
    table: "league",
    migrateOne: (ctx, doc) => {
      const record = doc as Record<string, unknown>;
      const ruleConfig = record.ruleConfig as
        | Record<string, unknown>
        | undefined;
      if (!ruleConfig) {
        return;
      }

      const nextRuleConfig: Record<string, unknown> = { ...ruleConfig };
      let changed = false;

      const wrapped = wrapToggleableRules(ruleConfig);
      if (wrapped) {
        Object.assign(nextRuleConfig, wrapped);
        changed = true;
      }

      const renamedMatchConfig = renameScoringValues(ruleConfig.matchConfig);
      if (renamedMatchConfig) {
        nextRuleConfig.matchConfig = renamedMatchConfig;
        changed = true;
      }

      if (!changed) {
        return;
      }

      return ctx.db.patch(record._id as Parameters<typeof ctx.db.patch>[0], {
        ruleConfig: nextRuleConfig,
      });
    },
  },
});
