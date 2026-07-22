/**
 * Shared media-storage helpers — consolidates 3 sets of duplicated helpers
 * that lived in `player/contract.ts`, `organization/contract.ts`,
 * `league/contract.ts`, and the per-domain `functions` profile modules.
 *
 * Pure module — no Convex runtime imports, safe to import from anywhere.
 */

import type { Id } from "../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../functions/generated/server";

/**
 * Computes which storage ids are no longer referenced and should be deleted.
 *
 * Generic over the field name so it works for single-field (player avatar,
 * organization logo) and multi-field (league avatar + cover) cases.
 *
 * For multi-field: pass an array of field names; the helper collects all
 * previous values across fields, removes any that still appear in `next`,
 * and dedupes.
 *
 * `isDeletable` filters out ids that should never be deleted (e.g. legacy
 * default placeholders). Defaults to "any non-empty string is deletable".
 */
export function collectReplacedStorageIds<K extends string>(
  fields: K | readonly K[],
  input: {
    next: { [P in K]?: null | string | undefined };
    previous?: { [P in K]?: null | string | undefined } | null;
  },
  opts?: { isDeletable?: (id: string) => boolean }
): string[] {
  const isDeletable = opts?.isDeletable ?? ((id: string) => Boolean(id));
  const fieldList = (Array.isArray(fields) ? fields : [fields]) as readonly K[];

  const nextIds = new Set<string>();
  for (const field of fieldList) {
    const id = input.next[field];
    if (id && isDeletable(id)) {
      nextIds.add(id);
    }
  }

  const previousIds: string[] = [];
  if (input.previous) {
    for (const field of fieldList) {
      const id = input.previous[field];
      if (id && isDeletable(id)) {
        previousIds.push(id);
      }
    }
  }

  return [...new Set(previousIds)].filter((id) => !nextIds.has(id));
}

/**
 * Deletes a list of storage ids. Best-effort: errors on individual deletes
 * are swallowed (logged to ctx if available) so one missing id doesn't
 * block the rest. Mirrors the prior per-domain loops.
 */
export async function deleteStorageIds(
  ctx: MutationCtx,
  storageIds: string[]
): Promise<void> {
  for (const storageId of storageIds) {
    try {
      await ctx.storage.delete(storageId as Id<"_storage">);
    } catch {
      // Id may already be deleted or unreachable; skip silently.
    }
  }
}

/**
 * Resolves a storage id to a URL, returning null when the id is missing,
 * not deletable (per `isDeletable`), or the underlying `getUrl` call
 * fails. Mirrors the 6 per-domain `resolve*Url` helpers.
 */
export async function resolveStorageUrl(
  ctx: MutationCtx | QueryCtx,
  storageId: null | string | undefined,
  opts?: { isDeletable?: (id: string) => boolean }
): Promise<null | string> {
  if (!storageId) {
    return null;
  }
  if (opts?.isDeletable && !opts.isDeletable(storageId)) {
    return null;
  }
  try {
    return await ctx.storage.getUrl(storageId as Id<"_storage">);
  } catch {
    return null;
  }
}
