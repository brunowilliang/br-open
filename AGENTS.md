## Project Overview

`br-open` is an Expo Router + React Native app backed by Convex and `kitcn`.
Domain code is organized under `convex/domains/*` and composed in
`convex/functions/schema.ts`.

## Core Commands

- Install deps: `bun install`
- Start app: `bun run dev`
- Start Convex/codegen loop: `bun convex:dev`
- Regenerate kitcn artifacts: `bun run codegen`
- Typecheck: `bun run typecheck`
- Repo checks: `bun run check`
- Diff hygiene: `git diff --check`

## Convex and kitcn

- `convex/functions/schema.ts` is the composition root only. Keep it importing
  and combining domain tables/relations from `convex/domains/*`.
- Domain tables and relations are the source of truth:
  - auth: `convex/domains/auth/*`
  - league: `convex/domains/league/*`
  - player: `convex/domains/player/*`

## Auth Schema Workflow

- The preferred auth ownership path in this repo is `convex/domains/auth/`.
- If `kitcn` auth scaffolding is needed, the CLI command is:
  - `bunx kitcn add auth --schema --yes`
- Important: this command may inject auth tables and relations directly into
  `convex/functions/schema.ts`.
- When that happens, do not keep the inline generated auth blocks there.

Required reconciliation flow:

1. Compare generated auth tables/relations in `convex/functions/schema.ts`
   against:
   - `convex/domains/auth/tables.ts`
   - `convex/domains/auth/relations.ts`
2. Copy only the useful differences into the domain files. Examples:
   - useful new indexes
   - useful new relations for org/team flows
3. Do not blindly accept generated regressions. Watch for:
   - `text().references(...)` replacing `id(...).references(...)`
   - weaker/nullability-changed fields
   - `json(...)` fields downgraded to `text()`
   - duplicate auth tables in `schema.ts`
4. After reconciling, delete the inline generated auth tables/relations from
   `convex/functions/schema.ts`.
5. Leave `convex/functions/schema.ts` back in composition-only form.

## plugins.lock.json

- `convex/functions/plugins.lock.json` can still point auth ownership at
  `convex/functions/schema.ts`.
- Treat it as a generated/internal file.
- Do not assume its ownership metadata matches the preferred repo structure.
- If codegen drifts because of it, preserve the domain-first structure and
  verify generated outputs after cleanup.

## Data and Migrations

- When changing Convex table shapes, account for legacy documents already in the
  deployment.
- Prefer migrations for field removal/renames/data reshaping.
- If old docs would fail schema validation during boot, temporarily keep schema
  compatibility until the migration can clear old fields.

## Validation Before Handoff

Before saying work is ready, run the relevant checks for the touched scope:

- minimum: `git diff --check`
- usually: `bun run typecheck`
- when Convex schema/contracts changed: `bun run codegen` and then
  `bun run typecheck`

## Repo-Specific Notes

- Use the names/routes that exist in the current tree. Do not reuse stale
  feature names.
- For UI/form work, preserve the patterns already used in this repo unless
  explicitly changing them.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code
quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npm exec -- ultracite fix`
- **Check for issues**: `npm exec -- ultracite check`
- **Diagnose setup**: `npm exec -- ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most
issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**.
Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance
  clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants
  with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property
  access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return
  value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array
  indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client
  Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and
   types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability
   considerations
6. **Documentation** - Add comments for complex logic, but prefer
   self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run
`npm exec -- ultracite fix` before committing to ensure compliance.
