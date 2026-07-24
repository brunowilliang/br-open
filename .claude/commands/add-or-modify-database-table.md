---
name: add-or-modify-database-table
description: Workflow command scaffold for add-or-modify-database-table in br-open.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-modify-database-table

Use this workflow when working on **add-or-modify-database-table** in `br-open`.

## Goal

Adds new tables or modifies existing ones in the database schema, updates relations, and ensures type safety and codegen artifacts are refreshed.

## Common Files

- `convex/domains/*/tables.ts`
- `convex/domains/*/relations.ts`
- `convex/functions/schema.ts`
- `convex/functions/_generated/dataModel.ts`
- `convex/functions/generated/server.ts`
- `convex/domains/*/contract.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or create table definitions in convex/domains/*/tables.ts
- Update relations in convex/domains/*/relations.ts if needed
- Update schema.ts and dataModel.ts for schema registration
- Regenerate codegen artifacts (convex/functions/_generated/dataModel.ts, convex/functions/generated/server.ts, etc.)
- Update contract.ts/types if needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.