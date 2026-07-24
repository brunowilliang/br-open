```markdown
# br-open Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you how to contribute effectively to the `br-open` codebase, a TypeScript/React project with a backend powered by Convex. You'll learn the project's coding conventions, how to implement new features or APIs, manage database schema changes, refactor code, and follow domain-driven and test-driven development workflows. The guide also covers code generation, payment provider integration, notification system extensions, and frontend refactoring patterns.

## Coding Conventions

- **File Naming:** Use camelCase for files and folders.
  - Example: `userProfile.ts`, `paymentProvider.tsx`
- **Import Style:** Use relative imports.
  - Example:
    ```ts
    import { getUser } from '../lib/user';
    ```
- **Export Style:** Use named exports.
  - Example:
    ```ts
    // Good
    export function calculateTotal() { ... }
    export const PAYMENT_STATUS = { ... };

    // Avoid default exports
    ```
- **Commit Messages:** Follow conventional commits with prefixes like `feat`, `fix`, `refactor`.
  - Example: `feat: add user profile editing modal`
- **Component Organization:** Large components are split into smaller files or sections, often using folders like `_sections/` or `shared.ts`.

## Workflows

### Add or Modify Database Table
**Trigger:** When introducing a new entity or changing existing backend data structure  
**Command:** `/new-table`

1. Edit or create table definitions in `convex/domains/*/tables.ts`.
2. Update relations in `convex/domains/*/relations.ts` if needed.
3. Update `schema.ts` and `dataModel.ts` for schema registration.
4. Regenerate codegen artifacts:
    ```sh
    bun run codegen
    ```
5. Update `contract.ts`/types if needed.
6. Write or update tests for the new/changed tables.

**Example:**
```ts
// convex/domains/user/tables.ts
export const users = defineTable({
  id: v.string(),
  name: v.string(),
  email: v.string(),
});
```

---

### Add or Update API Endpoint
**Trigger:** When exposing new backend functionality  
**Command:** `/new-api-endpoint`

1. Create or update a function in `convex/functions/*/*.ts` (mutation/query).
2. Add supporting code in `convex/domains/*/*.ts` if needed.
3. Regenerate codegen artifacts.
4. Update or add tests in `convex/domains/*/tests/*.test.ts` or `convex/functions/*/*.test.ts`.

**Example:**
```ts
// convex/functions/user/createUser.ts
export const createUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => { ... }
});
```

---

### Feature Development with TDD
**Trigger:** When adding new business features or domain logic  
**Command:** `/new-feature`

1. Define or update contract/types in `convex/domains/*/contract.ts`.
2. Implement logic in `convex/domains/*/*.ts` and/or `convex/functions/*/*.ts`.
3. Write or update tests in `convex/domains/*/tests/*.test.ts`.
4. Update documentation/specs/plans if needed.

---

### Refactor, Consolidate, or Extract Helpers
**Trigger:** When reducing code duplication or clarifying logic/constants  
**Command:** `/refactor-helpers`

1. Identify duplicated or scattered helpers/types/constants.
2. Extract to a new shared file (e.g., `convex/shared/*.ts`, `src/lib/*`).
3. Update all call sites to use the new shared helper.
4. Delete old/duplicated code.
5. Run tests to ensure no regressions.

**Example:**
```ts
// Before: duplicated in multiple files
export function formatCurrency(amount: number) { ... }

// After: extracted to src/lib/formatters.ts
export function formatCurrency(amount: number) { ... }
```

---

### Frontend UI Migration or Split
**Trigger:** When improving frontend maintainability or fixing routing issues  
**Command:** `/split-component`

1. Identify large/problematic component files (>500 LOC or routing issues).
2. Split into smaller files (e.g., `_sections/`, `shared.ts`, hooks).
3. Move files if needed to avoid routing conflicts.
4. Update imports and usage throughout the codebase.
5. Delete old/legacy files.

---

### Payment Provider Integration or Pivot
**Trigger:** When adding/changing payment provider integration  
**Command:** `/payment-provider`

1. Add or update payment provider client (e.g., `convex/functions/payment/woovi-client.ts`).
2. Update domain contract, tables, and rules for provider-specific fields.
3. Update or add webhook handler.
4. Update env var handling (`convex/lib/get-env.ts`, `.env`).
5. Update frontend payment flows (e.g., `src/app/(private)/checkout`).
6. Regenerate codegen artifacts.
7. Update or add tests for provider logic.

---

### Notification System Extension
**Trigger:** When extending notification capabilities  
**Command:** `/extend-notification`

1. Update notificationFeed schema (`convex/domains/notification/tables.ts`, `contract.ts`).
2. Add or update notification orchestration logic.
3. Add new notification event types or delivery states.
4. Wire up notification triggers in relevant domain logic.
5. Update or add tests for notification logic.

---

### Codegen Verification and Regeneration
**Trigger:** When changing schema, API, or domain logic impacting generated files  
**Command:** `/regenerate-codegen`

1. Run codegen command:
    ```sh
    bun run codegen
    ```
2. Check for uncommitted changes in `_generated/` and `generated/`.
3. Update generated files if needed.
4. Commit regenerated files.
5. Optionally, update CI workflow to enforce codegen checks.

---

## Testing Patterns

- **Framework:** Jest
- **Test File Pattern:** `*.test.ts`
- **Location:** Usually in `convex/domains/*/tests/` or alongside functions.
- **Example:**
    ```ts
    // convex/domains/user/tests/createUser.test.ts
    import { createUser } from '../createUser';

    test('creates a user with valid data', async () => {
      const result = await createUser({ name: 'Alice', email: 'alice@example.com' });
      expect(result).toHaveProperty('id');
    });
    ```

## Commands

| Command                | Purpose                                                      |
|------------------------|--------------------------------------------------------------|
| /new-table             | Add or modify a database table and update related artifacts  |
| /new-api-endpoint      | Implement or update a backend API endpoint                   |
| /new-feature           | Add a new business feature with TDD                          |
| /refactor-helpers      | Refactor or consolidate helpers/types/constants              |
| /split-component       | Migrate or split large frontend components                   |
| /payment-provider      | Integrate or pivot payment provider logic                    |
| /extend-notification   | Extend notification system capabilities                      |
| /regenerate-codegen    | Verify and regenerate codegen artifacts                      |
```
