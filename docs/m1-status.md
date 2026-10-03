# M1 checkpoint status

Date: 2026-10-03. Technical workflow checkpoint. Not live-customer ready.

## Passed locally

`npm run test:pilot` against local Postgres 16. `npm run lint`, `npm run check`, and `npm run build` also passed. CI runs the same commands with a Postgres 16 service.

| Check | Result |
| --- | --- |
| Pitch role switcher still on `/`; pilot code does not call pitch pay helpers | Pass |
| Anonymous load and file calls return 401 and no row or file bodies | Pass |
| Owner create stores a UTC `created` event; business day uses the org IANA zone, including a January instant that distinguishes Pacific Standard Time from a fixed `-07:00` | Pass |
| Assign, reassign before acknowledge, refuse after acknowledge, driver cannot assign, other driver gets 404 | Pass |
| Out-of-service truck, off driver, and appointment overlap return the stable error codes | Pass |
| Two concurrent overlapping assigns: one succeeds, the other returns `appointment_overlap` | Pass |
| Acknowledge is idempotent; progress does not require an empty return | Pass |
| Optional `container_return` progress note stays `in_progress` and does not add a status | Pass |
| Upload is not complete until the private object is stored; review before that returns `not_ready` | Pass |
| Owner approve/reject leaves `amountCents` unchanged and writes no ledger and no pay rule | Pass |
| Repeated expense, correction, mileage, document, and progress keys do not duplicate rows | Pass |
| Fleet fixture: 12 trucks, workflow on `SYN-FLEET-001`, `SYN-F12` and the off driver refused | Pass |
| Isolation fixture: Alpha cannot read or assign Bravo; truck lists stay inside each company | Pass |
| Staging roster: 10 trucks, 12 drivers, 5 customers, 100 loads, 30 distinct appointment dates, mileage, maintenance reminders, non-production pay examples | Pass |
| Dispatcher can create and assign and cannot review | Pass |
| Backup, wipe, and restore return the synthetic rows and a private file | Pass |
| Reset refuses `SNAPDISPATCH_ENV=production` | Pass |
| No stored amount of 18500, 9500, 25000, or 27 in the typed-amount columns | Pass |

## Failures

None in that local run.

Hosted two-device Supabase was not executed. No Supabase credentials are in this environment, and none were purchased. The local session and private directory are the path the tests run. [SETUP.md](./SETUP.md) lists what the project owner must set before a hosted demo.

## Unresolved customer questions and assumed rules

Still open, from [requirements.md](./requirements.md). This checkpoint does not close them.

| Topic | Status here |
| --- | --- |
| Load completion (Q3, Q17) | No `complete` status. |
| Cancellation | No cancel action and no cancelled status. |
| Handoffs / stage machine (Q3, Q17) | Progress is a note plus optional reported text. The pitch chain is not enforced. |
| Container empty returns (Q3, Q18) | Not required. One staging load and the UI offer a `container_return` note as a labeled assumption. |
| Driver pay (Q4) | Disabled. Fixture examples are marked non-production. No formula runs. |
| Receipt money (Q5) | Review stores approved or rejected. It does not post pay. A typed correction changes `corrected_amount_cents` only. |
| Dispatcher (D5) | Present on the synthetic roster as a proposed office login. Not customer-confirmed. |
| Timezone value (Q11) | Mechanism is UTC plus `display_timezone`. Fixture zones are test configuration. |
| RLS, `auth.users`, storage policies, enum freeze | Still open. See [schema/m1-migration-notes.md](./schema/m1-migration-notes.md). |
