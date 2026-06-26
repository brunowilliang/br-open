export const RANKING_FORM_SLOTS = 5;

export type RankingFormEntry = {
  isWin: boolean;
  finishedAt: number;
};

/**
 * Pads a membership's recent form into a fixed-length sequence for rendering.
 *
 * The source form is already ordered oldest → newest (left → right). We prepend
 * `null` slots on the left so the played games stay anchored to the right edge
 * of the indicator row — empty (grey) slots fill the space to the left.
 */
export function padRankingForm(
  form: readonly RankingFormEntry[],
  slots: number = RANKING_FORM_SLOTS
): Array<RankingFormEntry | null> {
  if (slots <= 0) {
    return [];
  }

  const played = form.slice(0, slots);
  const padded: Array<RankingFormEntry | null> = [...played];

  while (padded.length < slots) {
    padded.unshift(null);
  }

  return padded;
}

/**
 * Builds a membershipId → form lookup from the API response.
 */
export function buildRankingFormByMembership(
  forms: ReadonlyArray<{
    membershipId: string;
    form: readonly RankingFormEntry[];
  }>
): Record<string, RankingFormEntry[]> {
  const result: Record<string, RankingFormEntry[]> = {};

  for (const entry of forms) {
    result[entry.membershipId] = [...entry.form];
  }

  return result;
}
