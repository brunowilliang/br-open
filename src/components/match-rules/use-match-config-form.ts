import type { FieldError, FieldErrors, FieldValues } from "react-hook-form";

const MATCH_CONFIG_FIELDS = [
  "bestOfSets",
  "defaultDurationMinutes",
  "gamesPerSet",
  "hasTieBreak",
  "scoringMode",
  "setMustWinByTwoGames",
  "tieBreakMustWinByTwo",
  "tieBreakPoints",
] as const;

type MatchConfigField = (typeof MATCH_CONFIG_FIELDS)[number];

type MatchConfigPaths = Record<MatchConfigField, string>;

/**
 * Full RHF field paths for a matchConfig nested under `prefix` — e.g.
 * buildMatchConfigPaths("matchConfig").bestOfSets === "matchConfig.bestOfSets".
 * Lets the shared rule sections work for both the league form
 * ("ruleConfig.matchConfig") and the tournament form ("matchConfig").
 */
export function buildMatchConfigPaths(prefix: string): MatchConfigPaths {
  return Object.fromEntries(
    MATCH_CONFIG_FIELDS.map((field) => [field, `${prefix}.${field}`])
  ) as MatchConfigPaths;
}

function isFieldError(node: unknown): node is FieldError {
  return (
    node !== null &&
    typeof node === "object" &&
    "message" in (node as Record<string, unknown>)
  );
}

/**
 * Resolves a nested field error (e.g. "matchConfig.bestOfSets") from the
 * untyped form errors, since the shared sections cannot know the exact
 * screen values type.
 */
export function resolveMatchConfigFieldError(
  errors: FieldErrors<FieldValues>,
  path: string
): FieldError | undefined {
  let node: unknown = errors;

  for (const segment of path.split(".")) {
    if (!node || typeof node !== "object") {
      return;
    }
    node = (node as Record<string, unknown>)[segment] ?? null;
  }

  return isFieldError(node) ? node : undefined;
}
