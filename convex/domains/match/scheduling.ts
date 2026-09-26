import { DEFAULT_MATCH_CONFIG, type MatchConfig } from "./contract";

/**
 * Half-open interval overlap test for [start, end) minute ranges. Two ranges
 * that only touch at an endpoint (one ends exactly when the other starts) do
 * NOT overlap.
 */
export function rangesOverlap(input: {
  leftEndMinute: number;
  leftStartMinute: number;
  rightEndMinute: number;
  rightStartMinute: number;
}) {
  return (
    input.leftStartMinute < input.rightEndMinute &&
    input.rightStartMinute < input.leftEndMinute
  );
}

/**
 * Effective end of a match's occupied court window, derived from the rules'
 * default duration instead of a client-sent endMinute — a booking can never
 * shrink itself out of a conflict.
 */
export function resolveMatchOccupiedEndMinute(input: {
  matchConfig: MatchConfig;
  startMinute: number;
}) {
  // Configs saved before this key existed may lack defaultDurationMinutes (or
  // hold an invalid one) — fall back to the shipped default instead of deriving
  // a NaN occupied window.
  const duration = input.matchConfig.defaultDurationMinutes;
  const effectiveDuration =
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration
      : DEFAULT_MATCH_CONFIG.defaultDurationMinutes;

  return input.startMinute + effectiveDuration;
}
