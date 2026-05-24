# League Challenges Design

## Goal

Add the first working `Desafios` slice to leagues in `br-open`.

This feature must let:

1. one player challenge another player in the same league
2. the challenge include a complete match proposal
3. both players negotiate only `data`, `horário`, and `quadra`
4. the league decide whether challenge approval is `automática` or `manual`
5. the league decide whether result validation is `automática` or `manual`
6. the admin monitor all challenges and intervene when needed

## Product Constraints

- This is a league feature, not a tournament feature.
- Match configuration comes from the league and is read-only inside the challenge.
- Players cannot edit:
  - sets
  - games
  - tie-break
  - duration
- Players can only negotiate:
  - date
  - time
  - court
- Negotiation is structured as proposals and counterproposals, not free chat.
- There is always only one active proposal at a time.
- Every counterproposal resets the response deadline.
- Once both players agree, the proposal is locked.
- If the league requires manual challenge validation, the admin validates only after both players agree.
- While a challenge is waiting for admin validation, its court/date/time stays blocked.

## Out of Scope

- Free-text chat between players
- Editing match rules inside the challenge
- Automatic slot generation from court availability
- Rematch flows
- Date-specific court exceptions
- Payments or court fees
- Push notifications
- Automatic walkover resolution after silence
- Full implementation of score-entry UI details

## Functional Design

### Challenge Creation

The challenger creates a challenge against another active league member.

The challenge is created with:

- challenger
- challenged player
- league
- match configuration snapshot from the league
- first scheduling proposal:
  - date
  - time
  - court

This first proposal is already complete enough for acceptance or counterproposal.

### Negotiation Flow

The challenged player can:

- accept
- decline
- edit and resend

The challenger can also receive a counterproposal and then:

- accept
- decline
- edit and resend again

This can happen multiple times.

The negotiation model must work like this:

- there is only one active proposal
- every new proposal replaces the previous active one
- older proposals remain visible in history
- every new proposal restarts the response timer

### Lock Rule

When the current proposal is accepted by the receiving player:

- the scheduling proposal becomes locked
- if challenge validation is `automatic`, the match becomes confirmed immediately
- if challenge validation is `manual`, the challenge goes to admin validation

After lock:

- players cannot change date, time, or court anymore
- players can only continue into result flow or cancellation rules

### Challenge Validation Modes

The league must configure:

- `challengeValidationMode`
  - `automatic`
  - `manual`
- `resultValidationMode`
  - `automatic`
  - `manual`

#### Automatic Challenge Validation

When both players agree:

- the challenge becomes confirmed immediately

#### Manual Challenge Validation

When both players agree:

- the challenge moves to admin review
- the court/date/time remains blocked while waiting
- only after admin approval does it become officially confirmed

### Result Flow

After a confirmed challenge is played:

1. one player submits the score
2. the other player confirms the score
3. the admin validates if the league requires manual result validation

This is the accepted v1 rule:

- one player sends the score
- the other confirms
- admin validates depending on league settings

#### Automatic Result Validation

After one player submits the score and the other confirms:

- the result is approved automatically
- the ranking effect is applied immediately

#### Manual Result Validation

After one player submits the score and the other confirms:

- the result goes to admin review

The admin can then:

- approve result
- request correction
- invalidate match

If the admin requests correction:

- the challenge returns to a result-correction state
- players can submit the score again

If the admin invalidates the match:

- the challenge is closed without ranking effect

### Silence and Pending Cases

#### No response within deadline

If the receiving player does not answer within the deadline:

- the challenge does not auto-expire into a final outcome
- it goes to admin decision

#### Match date passes without score

If the scheduled date/time passes and no result is submitted:

- the match becomes `pending result`
- the admin can decide what to do later

This avoids automatic walkover decisions in v1.

### Cancellation Rules

Before scheduled date/time:

- either player can cancel
- admin can also cancel

After scheduled date/time:

- players cannot cancel anymore
- only the admin can cancel or intervene

### Admin Capabilities

The admin must be able to:

- view all league challenges
- filter by state
- open challenge details
- cancel challenges
- approve or reject manual challenge validation
- approve result
- request result correction
- invalidate match
- decide cases with no response in time
- decide cases where the match became pending without result

### Player History

Players must be able to see challenge history.

At minimum, each player should see:

- outgoing challenges
- incoming challenges
- active challenges
- past challenges

## Permissions

### Challenger

Can:

- create challenge
- send proposal
- send counterproposal
- accept counterproposal
- decline counterproposal
- cancel before scheduled date/time
- submit score
- confirm score
- see history

Cannot:

- edit league match rules
- cancel after scheduled date/time
- self-approve admin-gated transitions

### Challenged Player

Can:

- accept proposal
- decline proposal
- edit and resend proposal
- cancel before scheduled date/time
- submit score
- confirm score
- see history

Cannot:

- edit league match rules
- cancel after scheduled date/time
- self-approve admin-gated transitions

### Admin

Can:

- view all challenges
- cancel any challenge
- validate challenge when manual mode is enabled
- validate result when manual mode is enabled
- request result correction
- invalidate match
- decide time-expired cases

## Lifecycle

Recommended status model:

- `pending_opponent_response`
- `pending_creator_reapproval`
- `pending_admin_challenge_validation`
- `confirmed`
- `pending_result_submission`
- `pending_result_confirmation`
- `pending_admin_result_validation`
- `pending_result_correction`
- `pending_admin_decision`
- `finished`
- `declined`
- `cancelled`
- `invalidated`

Recommended transitions:

1. challenger creates challenge
   - `pending_opponent_response`
2. challenged player counterproposes
   - `pending_creator_reapproval`
3. challenger counterproposes again
   - `pending_opponent_response`
4. receiving side accepts
   - `pending_admin_challenge_validation` or `confirmed`
5. match time arrives
   - `pending_result_submission` once relevant in queries or jobs
6. one side submits score
   - `pending_result_confirmation`
7. other side confirms
   - `pending_admin_result_validation` or `finished`
8. admin requests correction
   - `pending_result_correction`
9. corrected score is resubmitted and reconfirmed
   - `pending_admin_result_validation`
10. admin approves
   - `finished`
11. admin invalidates
   - `invalidated`

## Court Blocking Rules

The selected `court + date + time` must be blocked for other challenges when the challenge is in any state that represents an active claim on that slot.

Minimum blocking states:

- `pending_opponent_response`
- `pending_creator_reapproval`
- `pending_admin_challenge_validation`
- `confirmed`
- `pending_result_submission`
- `pending_result_confirmation`
- `pending_admin_result_validation`
- `pending_result_correction`
- `pending_admin_decision`

If a challenge is:

- `declined`
- `cancelled`
- `invalidated`
- `finished`

the slot is no longer blocked by that challenge.

## Rule Config Additions

The league rules model must gain two new fields inside the challenge rules section:

```ts
type ChallengeValidationMode = "automatic" | "manual";
type ResultValidationMode = "automatic" | "manual";
```

Recommended `ruleConfig` additions:

```ts
{
  challengeValidationMode: "automatic" | "manual";
  resultValidationMode: "automatic" | "manual";
}
```

UI placement:

- `Regras > Desafios`
- `Validação do desafio`
- `Validação do resultado`

## Data Design

The feature should be modeled around one main challenge entity, plus proposal and result history.

Recommended shape:

```ts
type LeagueChallenge = {
  id: string;
  leagueId: string;
  challengerMembershipId: string;
  challengedMembershipId: string;
  status:
    | "pending_opponent_response"
    | "pending_creator_reapproval"
    | "pending_admin_challenge_validation"
    | "confirmed"
    | "pending_result_submission"
    | "pending_result_confirmation"
    | "pending_admin_result_validation"
    | "pending_result_correction"
    | "pending_admin_decision"
    | "finished"
    | "declined"
    | "cancelled"
    | "invalidated";
  currentProposalId: string;
  challengeValidationMode: "automatic" | "manual";
  resultValidationMode: "automatic" | "manual";
  matchConfigSnapshot: LeagueMatchConfig;
  lockedAt?: number | null;
  confirmedAt?: number | null;
  finishedAt?: number | null;
  cancelledAt?: number | null;
  invalidatedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

type LeagueChallengeProposal = {
  id: string;
  challengeId: string;
  proposedByMembershipId: string;
  courtId: string;
  matchDate: string; // YYYY-MM-DD
  startMinute: number;
  endMinute: number;
  responseDeadlineAt: number;
  revisionNumber: number;
  status: "active" | "accepted" | "replaced" | "declined" | "cancelled";
  createdAt: number;
};

type LeagueChallengeResultSubmission = {
  id: string;
  challengeId: string;
  submittedByMembershipId: string;
  confirmedByMembershipId?: string | null;
  adminReviewedByUserId?: string | null;
  reviewAction?: "approved" | "correction_requested" | "invalidated" | null;
  score: unknown;
  winnerMembershipId?: string | null;
  submittedAt: number;
  confirmedAt?: number | null;
  reviewedAt?: number | null;
};
```

### Score Design Constraint

The score payload must follow the league match configuration snapshot.

This means:

- score entry is driven by the stored league match rules
- result interpretation does not depend on later edits to league settings
- historical challenges keep the rules they were created with

## Validation Rules

### Challenge Creation Rules

- challenger and challenged player must both be active league members
- challenger cannot challenge themselves
- challenge must respect the league challenge rules already configured
- selected court must belong to the same league
- selected court must be available for the proposed date/time window
- selected court/date/time must not be blocked by another active challenge

### Proposal Rules

- only `date`, `time`, and `court` can change in counterproposals
- match rules are immutable inside the challenge
- each new proposal creates a history row
- each new proposal replaces the active proposal
- each new proposal resets the response deadline

### Acceptance Rules

- only the receiving side of the active proposal can accept it
- after acceptance, proposal data is locked

### Result Rules

- result cannot be submitted before the challenge is confirmed
- one player submits the result
- the other player confirms the result
- ranking changes only happen after the final valid approval state
- invalidated matches never affect ranking

## UI Design

### Player Surfaces

Recommended player views:

- `Desafios recebidos`
- `Desafios enviados`
- `Ativos`
- `Histórico`

Each challenge card should show at minimum:

- opponent
- date
- time
- court
- status
- whether admin validation is pending
- who proposed the current schedule

For counterproposal history:

- show a simple chronological list
- each item shows proposer and proposal summary
- no free-text thread is needed in v1

### Admin Surfaces

Recommended admin views:

- all challenges
- pending challenge validations
- pending result validations
- pending admin decisions
- history

Admin detail should show:

- both players
- current proposal
- proposal history
- match config snapshot
- result submission state
- available admin actions for that status

## Success Criteria

- a player can challenge another player with a complete proposal
- players can exchange multiple counterproposals
- only date, time, and court are editable during negotiation
- every counterproposal resets the response deadline
- once accepted, the proposal locks
- admin can require manual challenge validation
- admin can require manual result validation
- blocked court/date/time cannot be reused by another active challenge
- players can cancel only before scheduled time
- after scheduled time, only admin can cancel or decide
- players can see challenge history
- admin can view and manage all challenges
