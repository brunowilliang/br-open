# League Courts Design

## Goal

Add the first working `Quadras` slice to league editing in `br-open`.

The organizer should be able to:

1. Open league edit
2. Access a dedicated `Quadras` tab
3. Create courts using only a court name
4. Configure weekly availability per court
5. Add multiple availability ranges per day
6. Save courts together with the existing league edit flow

This slice is only about registering courts and their base weekly availability.

## Product Constraints

- `Quadras` belongs to the league edit flow.
- `Quadras` must be a dedicated tab in the existing edit screen.
- Courts belong to the league itself and are not shared across leagues.
- Court data must not be stored inside `ruleConfig`.
- Save remains the same single save action already used by league edit.
- Each court starts with only `name`.
- Availability is weekly and recurring.
- Availability is modeled as explicit available ranges.
- Everything outside the configured ranges is unavailable.
- Days without ranges are fully unavailable.
- Time input is restricted to `30` minute steps.

## Out of Scope

- Slot generation for challenges
- Date-specific exceptions
- Occupancy reasons like training or maintenance
- Shared courts across leagues
- Reservations
- Public display of court availability
- Automatic challenge scheduling
- Court metadata like surface type or covered status

## Functional Design

### Tab Structure

League edit gains a new tab:

- `Quadras`

This tab stays inside the same shared edit screen structure already used by league edit.

### Court Creation

At the top of `Quadras`, the organizer can:

- type the court name
- tap `Adicionar quadra`

When a court is created:

- it receives an internal `id`
- it stores the typed `name`
- it starts with empty availability for every day of the week

### Court List

Courts are rendered as an `Accordion`.

Each accordion item represents one court:

- title: court name
- action: remove court

If there are no courts yet, show `EmptyState`.

### Availability Editing

Inside each court accordion:

- show tabs for `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sab`, `Dom`
- the selected day displays the registered availability ranges for that day

For the selected day:

- show a list of saved ranges
- each range shows `hora inicial - hora final`
- each range can be removed
- there is an action to add a new range

### Range Entry

Each range is entered using:

- `hora inicial`
- `hora final`

Both values must use `30` minute increments only.

Examples:

- valid: `18:00-19:00`
- valid: `19:00-20:30`
- invalid: `18:10-19:00`

## Data Design

Court data is stored in a dedicated league field:

- `league.courts`

It must not be added to `ruleConfig`.

Recommended shape:

```ts
type LeagueCourtRange = {
  startMinute: number;
  endMinute: number;
};

type LeagueCourtAvailability = {
  mon: LeagueCourtRange[];
  tue: LeagueCourtRange[];
  wed: LeagueCourtRange[];
  thu: LeagueCourtRange[];
  fri: LeagueCourtRange[];
  sat: LeagueCourtRange[];
  sun: LeagueCourtRange[];
};

type LeagueCourt = {
  id: string;
  name: string;
  availability: LeagueCourtAvailability;
};
```

Example:

```ts
[
  {
    id: "court_1",
    name: "Quadra 1",
    availability: {
      mon: [
        { startMinute: 720, endMinute: 960 },
        { startMinute: 1080, endMinute: 1320 },
      ],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    },
  },
];
```

## Validation Rules

### Court Rules

- `courts` may start empty
- `name` is required
- court names must be unique within the same league
- name uniqueness should be checked using trimmed and case-insensitive comparison

Examples:

- `Quadra 1` and `quadra 1` are duplicates
- ` Quadra 2 ` and `Quadra 2` are duplicates

### Range Rules

- `startMinute` and `endMinute` must be integers
- both values must be multiples of `30`
- values must stay within the day range from `0` to `1440`
- `startMinute < endMinute`
- ranges must not overlap within the same day and same court
- touching ranges are allowed

Examples:

- valid:
  - `18:00-19:00`
  - `19:00-20:00`
- invalid:
  - `18:00-19:30`
  - `19:00-20:00`

### Normalization

Before save:

- trim court names
- sort each day's ranges by `startMinute`

## Save Behavior

- `Quadras` uses the same league edit form
- court data is sent together with the rest of the league payload
- there is no separate save button for the courts tab

## Future Compatibility

This shape is intentionally small, but leaves room for later additions:

- slot generation from availability
- date-specific exceptions
- blocked intervals
- occupancy reasons
- reservation records
- challenge scheduling against selected court availability

## Success Criteria

- organizer can create one or more courts
- organizer can add multiple ranges to the same day
- organizer can configure different days independently
- organizer cannot save duplicate court names
- organizer cannot save overlapping ranges in the same day
- organizer can save the whole league including courts in one flow
