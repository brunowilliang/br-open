import type { InferSelectModel } from "kitcn/orm";
import type { AuthenticatedCtx } from "../../../lib/crpc";
import type {
  MutationCtx,
  QueryCtx,
} from "../../../functions/generated/server";
import type {
  league,
  leagueChallenge,
  leagueChallengeProposal,
  leagueChallengeResultSubmission,
  leagueMembership,
} from "../../../domains/league/tables";

export type LeagueRecord = InferSelectModel<typeof league>;
export type LeagueChallengeRecord = InferSelectModel<typeof leagueChallenge>;
export type LeagueChallengeProposalRecord = InferSelectModel<
  typeof leagueChallengeProposal
>;
export type LeagueChallengeResultSubmissionRecord = InferSelectModel<
  typeof leagueChallengeResultSubmission
>;
export type LeagueMembershipRecord = InferSelectModel<typeof leagueMembership>;
export type OrmCtx = AuthenticatedCtx<QueryCtx | MutationCtx>;
export type OrmMutationCtx = AuthenticatedCtx<MutationCtx>;
