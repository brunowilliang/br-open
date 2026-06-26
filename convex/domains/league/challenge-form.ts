/**
 * Computes the recent "form" (last finished games) for each league membership.
 *
 * A finished challenge contributes one entry per side: the winner gets
 * `{ isWin: true }`, the loser gets `{ isWin: false }`. Entries are grouped by
 * membership, sorted most-recent-first, trimmed to `maxEntries`, and finally
 * reversed to the **oldest → newest** order so callers can render left-to-right.
 */

export const FORM_MAX_ENTRIES = 5;

export type FormFinishedChallenge = {
  challengerMembershipId: string;
  challengedMembershipId: string;
  winnerMembershipId: string;
  finishedAt: number;
};

export type FormEntry = {
  isWin: boolean;
  finishedAt: number;
};

/**
 * Returns one `FormEntry[]` (oldest → newest, at most `maxEntries`) for every
 * membership that appears in at least one finished challenge. Memberships with
 * no finished games are omitted from the result.
 */
export function resolveMembershipForms(
  challenges: readonly FormFinishedChallenge[],
  maxEntries: number = FORM_MAX_ENTRIES
): Map<string, FormEntry[]> {
  const grouped = new Map<string, FormEntry[]>();

  for (const challenge of challenges) {
    if (
      !(Number.isFinite(challenge.finishedAt) && challenge.finishedAt >= 0) ||
      (challenge.winnerMembershipId !== challenge.challengerMembershipId &&
        challenge.winnerMembershipId !== challenge.challengedMembershipId)
    ) {
      // Ignore challenges without a usable timestamp or a valid winner on one
      // of the two sides (e.g. unresolved/invalidated results).
      continue;
    }

    appendEntry(grouped, challenge.challengerMembershipId, {
      finishedAt: challenge.finishedAt,
      isWin: challenge.winnerMembershipId === challenge.challengerMembershipId,
    });
    appendEntry(grouped, challenge.challengedMembershipId, {
      finishedAt: challenge.finishedAt,
      isWin: challenge.winnerMembershipId === challenge.challengedMembershipId,
    });
  }

  const result = new Map<string, FormEntry[]>();

  for (const [membershipId, entries] of grouped) {
    const sorted = [...entries].sort(
      (left, right) => right.finishedAt - left.finishedAt
    );
    // Most-recent-first slice, then reverse to oldest → newest for rendering.
    const trimmed = sorted.slice(0, maxEntries).reverse();
    result.set(membershipId, trimmed);
  }

  return result;
}

function appendEntry(
  grouped: Map<string, FormEntry[]>,
  membershipId: string,
  entry: FormEntry
) {
  const entries = grouped.get(membershipId);

  if (entries) {
    entries.push(entry);
    return;
  }

  grouped.set(membershipId, [entry]);
}
