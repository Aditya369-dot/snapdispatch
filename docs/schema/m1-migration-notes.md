# M1 migration notes

[m1-draft.sql](./m1-draft.sql) is still a draft. Do not apply it.

The checkpoint migration is [db/migrations/0001_m1_workflow.sql](../../db/migrations/0001_m1_workflow.sql). `npm run pilot:migrate` records it in `schema_migrations`. It creates only the tables and functions this checkpoint uses.

## What the migration decides

- Text status checks, not Postgres enums: `created`, `assigned`, `accepted`, `in_progress`.
- No `complete`, `cancelled`, or `empty_returned` status. Those pre-pilot gates stay open.
- Progress may store an optional `reported_stage` string. A container-return scenario uses the text `container_return`. That is not a rule and not a status.
- `assign_load` takes a transaction advisory lock on the driver and the truck, then `FOR UPDATE` on the load, so two overlapping assigns cannot both commit.
- Document upload is complete only after the server sets `app.storage_confirmed` in the same transaction. That flag is set only when the private object exists and its size matches.
- `review_document` does not change `amount_cents` and does not write a ledger.
- There is no `pay_rules` table and no `ledger_entries` table.
- `fixture_pay_examples.non_production` is constrained to true. Workflow functions do not read that table to compute pay.
- Typed expenses and mileage use idempotency keys so a repeat does not insert another row.
- `organizations.display_timezone` is required and has no default. Business-day filters convert the calendar date with that IANA name. Stored instants stay `timestamptz`.

## Still unresolved

1. **RLS.** Select policies are installed and writes have no client policies. The Next.js server connects with `DATABASE_URL`, which is a privileged role and bypasses row security. `FORCE ROW LEVEL SECURITY` is not enabled. Do not expose these tables through the Supabase Data API until a non-privileged role, grants, and forced policies are reviewed. The checkpoint enforces company and driver access inside the SQL functions and the server queries.
2. **`auth.users` foreign key.** Not created. Local sessions set `request.jwt.claim.sub` for the transaction. On Supabase, `auth.uid()` already reads that claim, so the same functions work after profiles use Auth user ids. Linking `profiles.id` to `auth.users` is still open.
3. **Storage policies.** Bytes go through the server storage adapter (local directory, or the service role against a private bucket). Bucket SQL policies are not in this migration.
4. **Indexes.** The migration adds indexes for the checkpoint queries (org/status, driver, appointment, events, documents, mileage, maintenance). A broader performance plan is still open, as the draft said.
5. **Enums and status finalization.** Left as text checks until discovery closes completion, cancellation, handoffs, and empty returns.
6. **Dispatcher.** `profiles.role` includes `dispatcher` so the synthetic staging roster can have an office login. That role can create and assign. It cannot review documents. This is a proposed extension of D5, not a customer-confirmed role.
7. **Rollback.** `schema_migrations` records the version. There is no down migration. Reset deletes synthetic rows only. It does not drop the schema.

Driver-pay calculations stay disabled until Q4. Do not add a formula to this migration to fill that gap.
