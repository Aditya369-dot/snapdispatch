# Owner questions

The owner of a small fleet needs the product to answer eight questions. This page maps each one to the data it needs, who is responsible, which screen is relevant, and what acceptance looks like.

Four topics stay **Open**. Pitch screens are not customer confirmation:

- Driver pay formulas (questions 4 and 5).
- Load handoffs and when a job is done (question 2).
- What receipt approval means for money (questions 3 and 5).
- Whether a container empty return is required (questions 2 and 8).

The first workflow still includes progress updates, receipt and POD upload, and owner review. Those are capabilities. They do not close the four topics. Financial totals stay provisional until pay rules are customer-confirmed. See [requirements.md](./requirements.md).

Two location ideas stay separate in every row:

- **Last reported status** is the operational stage a person submitted: assigned, acknowledged, a progress note, and any stage text they typed. It has an actor and a UTC timestamp. The first workflow records acknowledge and later progress notes. The official list of stages is **Open**.
- **GPS location** is a coordinate from a device, ELD, or ping vendor. The pitch map is neither of these. `lib/fleet.ts` places a truck on a drawing from load status and hand-set coordinates. `staleLocation` is a seeded flag. Continuous GPS is **Future**.

**Pitch default** screens exist in the demo. Production screens are not built. Paths below are the pitch pages a later UI can follow. This document does not change them.

Pay, the meaning of receipt approval, empty returns, receivables, and deadline warnings depend on open questions in [requirements.md](./requirements.md). Acceptance for those rows can be tested after discovery. The first workflow does not pretend those rules already exist.

## 1. What needs dispatching today?

| | |
| --- | --- |
| Label | The owner will ask this. Which loads count is **Open** until Q1 and Q3. The business day uses the customer-configured timezone (**Workflow requirement**). |
| Required data | Loads whose appointment intersects the local calendar day in `organizations.display_timezone`. Instants are stored in UTC. For each load: reference, customer, pickup, destination, appointment start and end, status, driver, truck. Unassigned means status `created`. |
| Responsible user | Owner creates and assigns. Drivers do not build this list. |
| Relevant screens | Pitch overview “today” table (`app/page.tsx`, `todayLoads`). Pitch dispatch (`/dispatch`), including `scope=active` and `assignment=unassigned`. |
| Acceptance | On a chosen business day in the org timezone, the owner sees that day’s loads, can tell unassigned from assigned, can open one, and can assign a driver and a truck. The assigned load leaves the unassigned list and appears for that driver on another device. |
| GPS vs status | This question is the work list. It does not ask where the truck is. Status on the row is the last reported stage. |

**Pitch default.** `todayLoads` keeps loads whose appointment start falls on `DEMO_DAY` (`2026-10-01`), not the wall clock. Production stores UTC and evaluates the day in the org’s configured IANA zone. The synthetic fixture sets a zone for tests and labels it as fixture data. The customer’s zone is Q11.

## 2. Where is each driver, what stage is the load at, and what is holding it up?

| | |
| --- | --- |
| Label | The workflow includes progress updates the owner can read. The official handoff list, including empty return, is **Open** (Q3). GPS is **Future**. |
| Required data | Last reported status: current `status`, and `load_events` with type, actor, and `occurred_at`. A delay, when the milestone list includes one, stores a reason code and a note on the event. Driver `availability` (`available` or `off`) is an office flag, not a location. GPS, if it is ever added, is a separate reading: lat, lng, source, device time, received time. |
| Responsible user | The assigned driver submits acknowledge and progress. The owner reads them. A later correction by the office needs an audit event. That correction path is not in the first workflow. |
| Relevant screens | Pitch load timeline (`/loads/[id]`). Pitch driver phone Today and My Loads (`components/driver-app.tsx`). Pitch activity feed on the overview. Pitch fleet page (`/fleet`) and the overview map. |
| Acceptance | The driver acknowledges on device B. The owner on device A sees status `accepted`, the driver, and the event time in UTC, displayed in the org zone. The driver then posts a progress note. The owner sees that note without an empty-return step. A second driver does not see the load. The screen calls this a reported stage. |
| GPS vs status | The pitch map’s pin, ETA, and “stale” badge are layout. They are not a GPS fix. The first workflow has no map requirement. A future GPS row, if Q7 names a vendor, keeps its own timestamp and is never copied into `status`. |

**Pitch default.** Import and export stages after `accepted`, including `empty_return_pending` written automatically at delivery, are demo steps in `lib/flow.ts`. They are not customer-confirmed handoffs. Delay reasons in `lib/types.ts` are demo vocabulary. Both wait on Q3.

## 3. Which completed jobs are missing paperwork?

| | |
| --- | --- |
| Label | The owner will ask this. The first workflow stores a receipt and a POD and lets the owner review them. Which files are required, and whether an empty-return document exists, are **Open** (Q3, Q6). Approval does not post pay (Q5). |
| Required data | A definition of complete (Q3). The document types required for that freight type (Q6). For each required type: absent, pending review, rejected, or approved, with file metadata and reviewer. |
| Responsible user | Driver uploads. Owner reviews. |
| Relevant screens | Pitch overview attention items for a missing or rejected POD. Pitch documents (`/documents` and `/documents?load=`). Load detail documents. Reports POD rate, which counts imports only. |
| Acceptance | The assigned driver can upload a receipt and a POD on another device, the files are still there the next day, and the owner’s review is visible to that driver. Until Q6, a missing empty-return scan is not a failure, and “POD required” is not a rule. Until Q5, an approved receipt does not change a balance. |
| GPS vs status | Paperwork is tied to the load and its last reported stage (for example, delivered). It is not tied to a coordinate. |

**Pitch default.** `attentionItems` flags an import that has reached `delivered` without an approved `pod`. Exports are not in that check. Sample SVG pods stay in the demo.

## 4. What did each load earn and cost?

| | |
| --- | --- |
| Label | The owner will ask this. Formulas are **Open** (Q4, Q5, Q6). The workflow may store a typed customer rate and a typed receipt amount. Calculations are provisional: no earnings are posted. |
| Required data | Entered customer rate and any entered accessorials. The agreed driver-pay rule id and its inputs (Q4), once they exist. Approved operating expenses attached to the load (Q5). The rule text that produced the driver-cost figure. |
| Responsible user | Owner enters the rate. Driver submits expenses after that module exists. Owner approves them. The server posts earnings from the agreed rule. |
| Relevant screens | Pitch load Financials tab. Overview week chart and `/loads?revenue=week`. |
| Acceptance | Until Q4, the load shows the typed rate, or a blank rate, and driver earnings as “not configured.” Reviewing a receipt does not fill that gap. No screen defaults to `$185`, `$95`, `$250`, or 27%. When Q4 is answered, the load shows entered revenue, driver earnings from the named rule, and approved expenses, and the contribution figure states that overhead and tax are outside it. |
| GPS vs status | Cost is money on the load. It does not use a map position. Pitch revenue starts counting at a status (`delivered` for import, `gated_in` for export). That posting point is a **Pitch default** and waits on Q4. |

## 5. What do I owe each driver?

| | |
| --- | --- |
| Label | The owner will ask this. Ledger rules are **Open** (Q4, Q5). The first workflow does not show a balance. Pitch approval-to-reimbursement is not a customer rule. |
| Required data | Posted earnings, reimbursements, adjustments, advances, and payments for that driver. A settlement period: which rows, the total, who approved it, and payments recorded against it. Opening balance only if Q9 supplies one. |
| Responsible user | Owner approves expenses and records that a payment happened. Driver reads their own balance. |
| Relevant screens | Pitch `/drivers`, `/drivers?balance=outstanding`, `/drivers/[id]`. Pitch driver phone Earnings. |
| Acceptance | After Q4 and Q5, the balance equals the sum of that driver’s ledger rows, and a settlement matches a hand tally of the rows in that period. Rejected receipts add nothing. Until those answers, the workflow shows no balance and posts nothing when a receipt is approved. |
| GPS vs status | The balance follows agreed pay events and approved reimbursements. It does not follow GPS. |

**Pitch default.** `driverBalance` sums the demo ledger. Positive means owed to the driver. Settlement is a timestamp flag (`SettlementApproval`), not a period. `TARGET_BALANCES` in `lib/seed.ts` are fictional targets so the seed balances match. Recorded pay methods are ACH, check, and cash, typed by the office. There is no payment processor.

## 6. Who still owes me money?

| | |
| --- | --- |
| Label | The owner will ask this. Whether SnapDispatch is the receivables system is **Open** (Q6). The prototype has no customer-invoice model. |
| Required data | If billing means accounts receivable: invoices, due dates, and customer receipts, per customer. If billing stays in their accounting tool: an export of completed loads and entered rates, and this question is answered outside the app. |
| Responsible user | Owner, or whoever Q8 names for billing. Drivers do not see other customers’ balances. |
| Relevant screens | None in the pitch. Driver balances and shop invoices are different questions. Shop invoices on the truck page are maintenance costs. |
| Acceptance | If Q6 chooses receivables, the owner can list customers with open amount equal to invoices minus recorded receipts. If Q6 chooses an external book, the app exports the agreed columns and does not show an invented “owed to me” number. The first workflow does neither. |
| GPS vs status | Receivables follow billing status. They do not follow a truck coordinate or a driver stage, except where Q6 says a document or a stage is what makes a load billable. |

**Pitch default.** Driver copy says customer payment is not required before earnings post. That sentence is demo copy. It is not a decision about this customer’s invoices.

## 7. Which truck needs attention?

| | |
| --- | --- |
| Label | The owner will ask this. The attention rule is **Open** (Q7, Q12). The workflow stores in-service versus out-of-service because assignment uses that flag (D14). |
| Required data | Unit id, operational status, and, once Q7 and Q12 define them: next service date, next service miles, odometer source, open issues, and the warning thresholds. Fuel and period miles only if they name a log to import. |
| Responsible user | Owner maintains the record. Who may open a defect is part of Q13. |
| Relevant screens | Pitch `/trucks`, `/trucks/[id]`, overview service count, overview attention list. |
| Acceptance | A truck the agreed rule marks out of service, overdue, or due soon appears on the owner list. Assignment refuses an out-of-service truck. An overdue truck hard-blocks only if Q12 says so. The synthetic truck `SYN-02` covers the out-of-service refusal. |
| GPS vs status | “Needs attention” is maintenance and availability. A last GPS ping is not a service status. The pitch `staleLocation` flag is demo scenery. |

**Pitch default.** `maintenanceTone` uses odometer, next service date, and thresholds, compared with `DEMO_DAY`. Overdue unit `WS-107` can still be dispatched. Only `out_of_service` is refused.

## 8. What deadline am I about to miss?

| | |
| --- | --- |
| Label | The owner will ask this. Which deadlines exist, including a container empty return, is **Open** (Q18, Q3). The workflow may store dates and does not alert (D11). Empty return is not a required handoff. |
| Required data | The deadline kinds the customer uses, the timestamp or date for each load, the status that clears the deadline, and the lead time. Candidates the pitch already has fields for: appointment end, last free day, empty-return deadline, cutoff. Using those fields in production waits on Q18. |
| Responsible user | Owner watches the list. The assigned driver is the person who clears a deadline by reporting the matching stage. |
| Relevant screens | Pitch overview attention. Pitch load detail fields for last free day, empty return, and cutoff. |
| Acceptance | After Q18, a load inside the warning window appears once, with the deadline kind, the UTC instant displayed in the org zone, and the last reported stage. It clears when that stage is reached or the owner records the exception they asked for. Until Q18, stored dates raise no alert, and a load with no empty-return event is still valid. |
| GPS vs status | A deadline is a time on the load. Clearing it is a reported stage (or an office action), not a geofence. |

**Pitch default.** Last free day warns if the import is not yet `picked_up` and the date is `DEMO_DAY` (late) or exactly `2026-10-02` (soon). Empty return warns when status is `empty_return_pending` and the deadline is on or before `DEMO_DAY`. That empty-return warning is a demo rule, not a customer requirement. Cutoff is stored and is not in `attentionItems`.
