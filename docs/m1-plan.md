# First workflow plan

**M1 is a technical workflow checkpoint. It is not live-customer ready.** The checks below prove a synthetic path. They do not authorize a live pilot, and they do not make [schema/m1-draft.sql](./schema/m1-draft.sql) ready to apply.

**Workflow requirement.** On synthetic staging data, one company completes this path:

1. The owner creates a load.
2. The owner assigns a driver and a truck.
3. That driver, on a separate device, sees the load and acknowledges it.
4. The driver posts progress updates. The owner sees them.
5. The driver uploads a receipt and a POD to durable private storage.
6. The owner reviews each file. The driver sees the review.

The audit’s smallest step (the driver can see the assignment) is checkpoint 3’s first half. The workflow is not done there.

**Driver-pay calculations are disabled** until the customer confirms Q4. No pay-formula table executes. The workflow stores typed amounts and review decisions only. It does not calculate pay. The official handoff list, what receipt approval does to a balance, and whether a container empty return is required are not customer-confirmed. Details: [requirements.md](./requirements.md).

**Proposed** shape: [api/v1-m1.md](./api/v1-m1.md), [schema/m1-draft.sql](./schema/m1-draft.sql), and the three fixtures in [fixtures/m1-synthetic.md](./fixtures/m1-synthetic.md). Defaults D8–D19 apply. The schema file is a draft illustration, not a migration.

## In this workflow

- A pilot deployment, separate from the pitch site. Pitch `npm run check` and the public role switcher stay as they are.
- Auth, organization isolation, and driver isolation.
- Server-side checks for assign, acknowledge, progress, upload, and review.
- Private object storage for receipt and POD bytes, plus metadata in Postgres.
- UTC timestamps and a configured IANA timezone on the organization for input, display, and business day.
- Create, assign, acknowledge, progress, upload, review.

## Out of this workflow

- Any executing pay formula, pay-formula table, ledger, settlement, invoice, or automatic reimbursement. Driver-pay calculations stay disabled. Typed amounts only.
- The pitch import/export state machine and a mandatory empty-return step.
- GPS, OCR, brokerage, customs, IFTA, RTS, Excel sync, the schematic map, and the walkthrough.
- The 40-load Westshore seed and any real opening balance.
- Customer logins.
- A live pilot. Completion, cancellation, the handoff/stage machine, and container empty returns are pre-pilot gates, not M1 work.

## Open gates before a live pilot

Not done in M1. Resolve these with the customer before a live pilot. Question ids and the same table live in [requirements.md](./requirements.md).

| Gate | M1 behavior |
| --- | --- |
| Load completion definition | No `complete` status. The checkpoint ends at progress, upload, and review. |
| Cancellation | No cancel action and no cancelled status. |
| Handoffs / stage machine | Progress is a note plus an optional reported stage string. The pitch chain is not enforced. |
| Container empty returns | Not required. A request that omits an empty return succeeds. |

Driver-pay calculations stay **disabled** until customer confirmation (Q4). A checkpoint run that shows a computed driver earning, or that inserts a pay-formula row, is a failure.

## Acceptance checks

Checks 1–19 use the minimal fixture [fixtures/m1-synthetic.json](./fixtures/m1-synthetic.json). Checks 20–22 use the fleet fixture [fixtures/m1-fleet.json](./fixtures/m1-fleet.json). Checks 23–25 use the isolation fixture [fixtures/m1-isolation.json](./fixtures/m1-isolation.json), which adds a second organization. Browsers A, B, and C do not share `localStorage` or IndexedDB. Sessions for checks 1–19 are the owner, driver D, and driver E from the minimal fixture.

1. The pitch repo still builds. `npm run check` still describes the fictional book. The pitch role switcher is unchanged.
2. Anonymous calls to load and document routes return 401 and no row bodies or file bytes.
3. On browser A, the owner creates a load. Status is `created`. A `created` event stores the actor and a UTC `occurred_at`. The pitch clock `DEMO_NOW` is not used.
4. The owner assigns driver D and truck `SYN-01`. Status becomes `assigned`. An `assigned` event is stored. The response has no earnings line and no ledger id.
5. On browser B, driver D sees that load’s reference and status `assigned`.
6. On browser C, driver E does not see the load. Fetching it by id returns 404. Fetching its documents returns 404.
7. Driver D cannot assign. The assign call returns 403.
8. Driver D acknowledges. Status becomes `accepted`. An `acknowledged` event records D and the time. A second acknowledge returns the same state and does not insert another event.
9. Browser A refreshes and sees `accepted` and that event. Browser A did not submit it.
10. Driver D posts a progress note. Status becomes `in_progress`. The owner sees the note, the actor, and the UTC time. A second note appends another event. Neither call requires an empty-return stage. A request that omits empty return succeeds.
11. The server refuses progress from the owner’s session and from driver E.
12. Driver D uploads a receipt (typed `amountCents`, file bytes) and a POD. Both objects are in the private bucket. A direct unauthenticated fetch of the object URL fails. After reload and a new sign-in, both files are still there.
13. The owner approves one file and rejects the other, with a note on the rejection. Driver D sees both decisions. The database still has no ledger, no pay rule, and no reimbursement. `amountCents` is unchanged by the review.
14. Driver D cannot review a document. Driver E cannot download D’s files.
15. The server refuses an out-of-service truck (`SYN-02`), an off driver, assignment after acknowledge, and an appointment overlap. Each refusal uses a stable error code from the API doc.
16. A business-day filter uses `organizations.display_timezone`. Stored events remain UTC. The API does not persist a fixed `-07:00` offset.
17. Reloading browser B, and signing in again after clearing site data, still shows the load, the progress notes, and the files.
18. No service-role key is in client code or in git. A search of the staging database after the fixture load finds no pay rule of `18500`, `9500`, `25000`, or `27`.
19. The synthetic loader refuses to run unless the target is marked staging and every organization name starts with `Synthetic`. That rule applies to the minimal fixture, the fleet fixture, and both organizations in the isolation fixture.
20. Loading [fixtures/m1-fleet.json](./fixtures/m1-fleet.json) creates `Synthetic Fleet Carrier` with at least 10 trucks (`SYN-F01` through `SYN-F12`). The owner can list all of them. `payRules` is null. No pay-formula row is inserted.
21. The same create → assign → acknowledge → progress → upload → review path runs on `SYN-FLEET-001` with Synthetic Fleet Driver 01 and `SYN-F01`. Review leaves `amountCents` unchanged and writes no ledger and no pay formula.
22. Assigning `SYN-F12` on the fleet fixture expects `truck_out_of_service`. Assigning Synthetic Fleet Driver Off expects `driver_unavailable`.
23. Loading [fixtures/m1-isolation.json](./fixtures/m1-isolation.json) creates two organizations, `Synthetic Isolation Alpha` and `Synthetic Isolation Bravo`, each with its own owner, driver, truck, and load.
24. Alpha’s owner lists only Alpha’s load. Fetching Bravo’s load by id returns 404. Assigning Bravo’s driver or truck from Alpha’s session returns `not_found` and does not write a row in Bravo.
25. Bravo’s driver does not see Alpha’s load. Alpha’s driver does not see Bravo’s load. Each truck list stays inside its organization. Neither organization has a pay formula.

When these pass, the technical checkpoint is done. It is not a live pilot. Completion, cancellation, handoffs, and empty returns stay open. Driver pay still waits on Q4 and three real examples. Do not fill that gap from `lib/finance.ts`.

## Draft schema

[schema/m1-draft.sql](./schema/m1-draft.sql) is a **draft**. It is not a migration, and it is not ready to apply to staging or to a customer database. Unresolved implementation requirements are listed in the file header: RLS policy details, migration strategy, indexes TBD, and enum/status finalization after discovery (completion, cancellation, handoffs, empty returns). The statements in the file illustrate the checkpoint shape. They are not an apply script.

```text
organizations 1──* profiles
organizations 1──* drivers 1──0..1 profiles
organizations 1──* trucks
organizations 1──* customers
organizations 1──* places
loads *──1 customers, *──0..1 drivers, *──0..1 trucks
loads *──1 places (pickup) and *──1 places (destination)
loads 1──* load_events
loads 1──* documents
```

Status values are `created`, `assigned`, `accepted`, and `in_progress`. There is no `empty_returned` state and no pitch enum.

Driver-pay calculations are disabled. `loads.customer_rate_cents` and `documents.amount_cents` are nullable typed amounts with no default. There is no `pay_rules` table, no `ledger_entries` table, and no function that executes a pay formula.

`organizations.display_timezone` is required. The column does not default to `America/Los_Angeles`.

## API

[api/v1-m1.md](./api/v1-m1.md) is contract `v1`, status draft.

- `POST /api/v1/loads`
- `GET /api/v1/loads`
- `GET /api/v1/loads/:id`
- `POST /api/v1/loads/:id/assign`
- `POST /api/v1/loads/:id/acknowledge`
- `POST /api/v1/loads/:id/progress`
- `POST /api/v1/loads/:id/documents`
- `POST /api/v1/documents/:id/complete`
- `GET /api/v1/documents/:id/file`
- `POST /api/v1/documents/:id/review`

## Authorization

| Action | Owner | Assigned driver | Other driver | Anonymous |
| --- | --- | --- | --- | --- |
| Create, assign, review | Allow | 403 | 403 | 401 |
| List and get own loads | All loads in the org | Assigned loads | 404 by id | 401 |
| Acknowledge, progress, upload | 403 | Allow on their load | 404 | 401 |
| Download file | Allow in org | Allow on their load | 404 | 401 |

The pitch `setView` control is not a session. It stays on the pitch deploy.

`assign_load`, `acknowledge_load`, `record_progress`, `register_document`, `complete_document_upload`, and `review_document` are database functions that read the caller from the session and write in one transaction. The client cannot set `status` or `review_status` by patching a row. The server checks the object exists before `complete_document_upload`.

File bytes are uploaded to a private path `org/{organizationId}/loads/{loadId}/{documentId}` using a short-lived URL minted after the row exists. The service-role key stays on the server.

## Time

- Persist `occurred_at`, `acknowledged_at`, `uploaded_at`, and `reviewed_at` as UTC.
- Interpret a business-day query and any local datetime the UI submits with `display_timezone`.
- Return offsets in API bodies as `Z` (UTC). Clients format with the org zone.

## Synthetic fixtures

[fixtures/m1-synthetic.md](./fixtures/m1-synthetic.md) describes three staging files. Pay rules are JSON `null` in each. `emptyReturnRequired` is `null`. Fixture timezones are test configuration. No pay formula executes.

| File | Role | Used by |
| --- | --- | --- |
| [fixtures/m1-synthetic.json](./fixtures/m1-synthetic.json) | Minimal roster: one organization, two trucks, one workflow load | Checks 1–19 |
| [fixtures/m1-fleet.json](./fixtures/m1-fleet.json) | Larger synthetic fleet: 12 trucks, first-customer scale (at least 10) | Checks 20–22 |
| [fixtures/m1-isolation.json](./fixtures/m1-isolation.json) | Second organization beside a first, for company-isolation tests | Checks 23–25 |

## After this workflow

M1 remains a technical checkpoint. Before a live pilot, resolve load completion, cancellation, the handoff/stage machine, and container empty returns. Official stages wait on Q3. Empty-return rules wait on Q3 and Q18. Receipt money waits on Q5. Driver-pay calculations stay disabled until Q4, and any later formula starts from three real examples, not from `FLAT_PAY`. Real people replace the synthetic roster only after Q9 and Q10. Brokerage, customs, IFTA, and RTS stay **Future**.
