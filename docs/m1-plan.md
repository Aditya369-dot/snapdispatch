# First workflow plan

**Workflow requirement.** On synthetic staging data, one company completes this path:

1. The owner creates a load.
2. The owner assigns a driver and a truck.
3. That driver, on a separate device, sees the load and acknowledges it.
4. The driver posts progress updates. The owner sees them.
5. The driver uploads a receipt and a POD to durable private storage.
6. The owner reviews each file. The driver sees the review.

The audit’s smallest step (the driver can see the assignment) is checkpoint 3’s first half. The workflow is not done there.

**Open, and provisional where money is concerned.** Driver pay formulas, the official handoff list, what receipt approval does to a balance, and whether a container empty return is required are not customer-confirmed. The workflow stores typed amounts and review decisions. It does not calculate pay. Details: [requirements.md](./requirements.md).

**Proposed** shape: [api/v1-m1.md](./api/v1-m1.md), [schema/m1-draft.sql](./schema/m1-draft.sql), [fixtures/m1-synthetic.json](./fixtures/m1-synthetic.json). Defaults D8–D19 apply.

## In this workflow

- A pilot deployment, separate from the pitch site. Pitch `npm run check` and the public role switcher stay as they are.
- Auth, organization isolation, and driver isolation.
- Server-side checks for assign, acknowledge, progress, upload, and review.
- Private object storage for receipt and POD bytes, plus metadata in Postgres.
- UTC timestamps and a configured IANA timezone on the organization for input, display, and business day.
- Create, assign, acknowledge, progress, upload, review.

## Out of this workflow

- A production pay formula, ledger, settlement, invoice, or automatic reimbursement.
- The pitch import/export state machine and a mandatory empty-return step.
- GPS, OCR, brokerage, customs, IFTA, RTS, Excel sync, the schematic map, and the walkthrough.
- The 40-load Westshore seed and any real opening balance.
- Customer logins.

## Acceptance checks

Browsers A, B, and C do not share `localStorage` or IndexedDB. Sessions are the owner, driver D, and driver E from the synthetic fixture.

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
19. The synthetic loader refuses to run unless the target is marked staging and the organization name starts with `Synthetic`.

When these pass, widening means the fields Q2 asks for and, only after Q4 and Q5, a pay calculation. Do not fill that gap from `lib/finance.ts`.

## Draft schema

[schema/m1-draft.sql](./schema/m1-draft.sql) is a proposal. It is not applied by this repo.

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

`loads.customer_rate_cents` and `documents.amount_cents` are nullable typed amounts with no default. There is no `pay_rules` table and no `ledger_entries` table.

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

[fixtures/m1-synthetic.md](./fixtures/m1-synthetic.md) describes the roster. Pay rules are JSON `null`. `emptyReturnRequired` is `null`. The fixture timezone is labeled as test configuration.

## After this workflow

Official stages wait on Q3. Empty-return rules wait on Q3 and Q18. Receipt money waits on Q5. Driver pay waits on Q4 and starts from three real examples, not from `FLAT_PAY`. Real people replace the synthetic roster only after Q9 and Q10. Brokerage, customs, IFTA, and RTS stay **Future**.
