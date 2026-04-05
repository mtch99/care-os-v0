Generate manual curl test scripts for the API changes on the current branch.

## Steps

1. Run `git branch --show-current` to get the branch name
2. Run `git log main..HEAD --oneline` to see all commits on this branch
3. Run `git diff main..HEAD --name-only` to see changed files
4. Read the changed route files in `apps/api/src/routes/` to understand which endpoints were added or modified
5. Read the relevant Zod validation schemas in `packages/api-contract/src/` to understand request shapes
6. Read the DB schema files in `packages/db/src/schema/` for any table changes
7. Check `packages/db/src/seed.ts` to understand what data already exists in the database

## Generate

Create a directory at `scripts/test-<branch-short-name>/` where `<branch-short-name>` is the branch name with `feature/` or `fix/` prefix stripped and truncated to a reasonable length.

For each endpoint found in step 4, generate:

- One numbered `.sh` file per test case (happy path + key error cases)
- Each script captures the HTTP status code and prints it after the JSON body using this pattern:
  ```bash
  resp=$(curl -s -w '\n%{http_code}' ...)
  code=${resp##*$'\n'}
  body=${resp%$'\n'*}
  echo "$body" | jq .
  echo "HTTP $code"
  ```
- Scripts that need IDs from previous steps accept them as `$1` arguments with usage validation: `"${1:?Usage: $0 <id>}"`
- Scripts with optional parameters use defaults: `"${1:-default_value}"`
- Name format: `NN-verb-description.sh` (e.g. `01-create-template.sh`, `02-create-default-conflict.sh`)

Generate a `README.md` with:
- Prerequisites section (what needs to be running)
- A table mapping each script to its expected HTTP status and what it tests
- SQL verification queries to run in a DB explorer after testing

Make all scripts executable with `chmod +x`.

## Rules

- Base URL is `http://localhost:3000`
- Route prefix comes from how routes are mounted in `apps/api/src/index.ts`
- Use realistic test data matching the Zod schemas — not placeholder "test" strings
- Cover: happy paths, validation errors (400), not-found (404), business rule violations (409)
- Order scripts so they can be run sequentially (creates before reads, reads before updates)
- Use seed data IDs where possible to avoid depending on prior script output
- Do NOT commit these scripts — they are for local testing only
