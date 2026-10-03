# Requirements

Labels: **Customer-confirmed**, **Workflow requirement**, **Proposed**, **Open**, **Pitch default**, **Assumption**, **Future**. See [README](./README.md).

**Customer-confirmed** means this customer’s business has agreed the rule. **Workflow requirement** means the product must provide the capability for the first complete workflow. A workflow requirement is not a discovered pay formula, handoff list, approval policy, or empty-return rule.

Prototype behavior is a **Pitch default**. The Canada–US rate confirmation is a reference document. It does not establish this customer’s lanes, milestones, accessorials, or customs steps.

Question ids (Q1–Q18) are stable. [discovery-checklist.md](./discovery-checklist.md) is how they get answered.

## Customer-confirmed requirements

Source is the production brief for this effort. The list is short on purpose.

1. The first customer is a small trucking company with at least 10 trucks.
2. The people in scope are the owner and the drivers, completing the load lifecycle.
3. Brokerage, customs (including BorderConnect, ACE, and ACI), IFTA, and RTS are **Future**. They are not launch scope.
4. The Canada–US rate confirmation is not proof of this customer’s workflow.
5. Guessed financial rules must not ship as production defaults. Pitch flat `$185` / `$95` / `$250`, 27% of linehaul, and the hourly rates in `lib/seed.ts` are demo data.

**Customer-confirmed** repository facts, not operating rules:

- `main` at `711d566` is the pitch prototype: Zustand, `localStorage`, IndexedDB, no API, no auth, no database. GitHub `Aditya369-dot/snapdispatch` is the source of truth for that code.
- The production audit is open [PR #2](https://github.com/Aditya369-dot/snapdispatch/pull/2) and is not on `main`.

### Not customer-confirmed

These four are **Open**. Pitch behavior is listed so it is not copied forward as a requirement.

| Topic | Status | Pitch default, not a customer rule |
| --- | --- | --- |
| Driver pay | **Open** (Q4) | `earningPlan` in `lib/finance.ts`: flat `$185` delivery + `$95` empty on import, `$250` on export, hourly × estimated hours, or 27% of linehaul. Earnings post from load status. “Pay follows the move, not the invoice.” |
| Load handoffs | **Open** (Q3, Q17) | `lib/flow.ts` import and export chains, one forward button, delivery of an import also writing `empty_return_pending`. |
| Receipt approval | **Open** (Q5) | Statuses `awaiting_approval`, `approved`, `rejected`, `correction_requested`. Approved + driver-paid + reimbursement requested posts a ledger line. |
| Container empty returns | **Open** (Q3, Q18) | After delivery, an import stays open until empty return, then a separate complete step. Last-free-day and empty-deadline warnings use the frozen demo day. |

Freight type, document checklists, billing, GPS, opening balances, and the exact deadline list are also **Open**. They are in the matrix below.

## Workflow requirements

Source is the owner follow-up on this documentation. These bind the first build. They do not close the four open topics above.

1. **First complete workflow.** Create a load → assign driver and truck → the assigned driver sees it on a separate device and acknowledges → the driver posts progress updates → the driver uploads a receipt and a POD → the owner reviews those files. The earlier audit slice that stopped at “driver sees the assignment” is a checkpoint inside this workflow, not the finish line.
2. **Auth.** Every pilot action requires a signed-in user. An anonymous client receives no loads, roster, or files.
3. **Company and driver access.** A session stays inside its organization. A driver reads and updates only loads assigned to them, and only their own uploads. A driver cannot assign, cannot review documents, and cannot read another driver’s load or file. The owner reads and reviews the company’s loads and files. The pitch role switcher is not this control.
4. **Server-side validation.** Assign, acknowledge, progress, upload, and review are enforced on the server. Client checks are not the authority.
5. **Durable private file storage.** Receipt and POD bytes live in private object storage that survives a new device. The database stores the object key and metadata. Browser IndexedDB is not the system of record. Downloads are authorized and short-lived.
6. **Timestamps.** Store every timestamp in UTC (`timestamptz`). Each organization has a customer-configured IANA timezone. That zone is used for typed input, for display, and for the business day (“today”, the appointment day). The pitch helper that always appends `-07:00` does not meet this rule. Which zone the customer selects is configuration (Q11). The storage and conversion rule is already decided.
7. **Financial calculations stay provisional.** The workflow may store a rate or a receipt amount the user typed. It must not compute driver pay, contribution, or reimbursement until the customer confirms pay rules (Q4, Q5). Approving a receipt records the review. It does not post money.
8. **Synthetic staging** is the data for this build. Real opening balances wait on Q9 and Q10.

Progress updates are in the workflow. The stage names that count as a handoff are **Open**. Empty return is not a required step of this workflow. Receipt and POD upload plus owner review are in the workflow. The approval policy and any money effect are **Open**.

## Proposed defaults

Reversible. They are not customer-confirmed. Replace them when the named question is answered.

| Id | Proposed default | Replaced by |
| --- | --- | --- |
| D1 | One company per pilot database. Every row carries `organization_id`. | A second-carrier requirement |
| D2 | Two deploys. The pitch site keeps Zustand and fictional data. The pilot is a separate host and database. | Q10 |
| D3 | Modular monolith: this Next.js app, TypeScript server handlers, one Postgres database. | A constraint against Postgres or a single deploy |
| D4 | Supabase Auth and private Storage if email magic link or password is acceptable. Phone OTP waits on an SMS vendor. | Q8 |
| D5 | Roles for the first workflow are `owner` and `driver`. A dispatcher login waits until a second office user exists. | Q8, Q13 |
| D6 | One login per driver. | Q8 |
| D7 | Online-only until they say the terminal must work offline. | Q8 |
| D8 | After acknowledge, progress is an append-only event with the driver’s note and an optional reported stage string. The first progress event sets load status to `in_progress`. There is no required empty-return transition and no copy of `IMPORT_FLOW` / `EXPORT_FLOW` as a check constraint. | Q3, Q17 |
| D9 | The owner types the load. No inbox and no OCR. | Q2 |
| D10 | Owner-supplied reference is the display id. Container number is optional text. No ISO check-digit rule. | Q1 |
| D11 | Deadline dates may be stored if typed. No warning job until Q18, including empty-return warnings. | Q18 |
| D12 | `customer_rate_cents` and a receipt’s `amount_cents` may be stored as typed. No default. Nothing multiplies them into pay. | Q4, Q6 |
| D13 | No pay-rule table and no ledger in this workflow. Review does not create a reimbursement. | Q4, Q5 |
| D14 | Assignment refuses an out-of-service truck, an off driver, a load that is not `created` or `assigned`, and an appointment overlap on the same driver or truck. | Q12 |
| D15 | Reassign is allowed while status is `assigned`. It is refused after acknowledge. | Q12, Q17 |
| D16 | UTC in the database. `organizations.display_timezone` is a required IANA name. Business-day filters use that zone. Synthetic tests set the zone in the fixture. Do not hardcode `-07:00`. | Q11 sets the customer’s value |
| D17 | Synthetic roster only. No Westshore rows. No invented opening balances. | Q9, Q10 |
| D18 | English on the pilot path. Spanish stays on the pitch until they ask. | Q14 |
| D19 | Document kinds in this workflow are `receipt` and `pod`. Review is `pending`, `approved`, or `rejected`. Allowed types `jpeg`, `png`, `pdf`. Max size 10 MB. Private bucket. No customer login. | Q5, Q6, Q15 |
| D20 | The pilot runs beside the current dispatch sheet. | Q16 |
| D21 | No GPS vendor and no spreadsheet sync in this workflow. | Q7 |

**Assumption.** A fleet of about ten trucks fits one Postgres database and one web app. That supports D3. It is not a claim about their terminals, ELD, or accountant.

## Unanswered questions

“Reversible default?” means the named default can stay in place until the answer arrives. “No” means inventing the answer would pretend the customer already decided.

### Driver pay — Open

| | |
| --- | --- |
| Id | Q4 |
| Question | How are drivers paid? Collect three real calculations: inputs, rule in their words, and the amount they actually paid. |
| Blocks | Any earning formula, “what do I owe each driver?”, treating a load’s typed rate as driver cost |
| Reversible default? | Yes |
| Default | D12 and D13. Store typed amounts. Compute nothing. No `$185` / `$95` / `$250` / 27% / hourly default. |
| Work that proceeds | The full file-and-review workflow, with pay figures shown as not configured |

### Load handoffs — Open

| | |
| --- | --- |
| Id | Q3, Q17 |
| Question | Which stages are required, who may advance them, and does acknowledge mean the pitch “Accept Load” action? When is the job complete? |
| Blocks | A production status machine, the meaning of complete, which progress labels are official |
| Reversible default? | Yes |
| Default | D8. Acknowledge, then free progress notes. Pitch chains stay in the demo. |
| Work that proceeds | Create, assign, acknowledge, and progress events the owner can read. Server does not require the next pitch step. |

### Receipt approval — Open

| | |
| --- | --- |
| Id | Q5 |
| Question | Who approves, what a rejection means, whether correction exists, and whether an approved driver-paid receipt becomes money owed. |
| Blocks | Ledger reimbursements, the pitch four-state machine, “approval means pay the driver” |
| Reversible default? | Yes |
| Default | D13 and D19. Owner can approve or reject. No reimbursement row. No `correction_requested` state until they describe it. |
| Work that proceeds | Upload, private storage, and owner review with no money side effect |

### Container empty returns — Open

| | |
| --- | --- |
| Id | Q3, Q18 |
| Question | Is an empty return a required handoff, a deadline, or absent from this customer’s work? What clears it? |
| Blocks | A mandatory `empty_return_pending` step, empty-return deadlines, calling a load complete at delivery versus at empty return |
| Reversible default? | Yes |
| Default | D8 and D11. The workflow succeeds with no empty-return event. A driver may mention a return in a progress note. That note does not change the rules. |
| Work that proceeds | Progress updates and POD upload without an empty-return gate |

### Rest of the matrix

| Id | Question | Blocks | Reversible default? | Default | Work that proceeds |
| --- | --- | --- | --- | --- | --- |
| Q1 | Port containers, van freight, or both? | Identifiers and document set | Yes | D10 | Workflow using a reference. Container number optional. |
| Q2 | How do orders arrive? Need redacted examples. | Intake beyond manual create | Yes | D9 | Owner-typed loads |
| Q6 | Which delivery documents are required, and how does customer billing work? | A required-doc checklist, accounts receivable | Yes | D19 stores receipt and POD because the workflow asks for those uploads. It does not declare them universally required, and it does not invoice. | Upload and review. Owner question 6 stays open. |
| Q7 | GPS/ELD, spreadsheets, accounting tools | Map vendor, export columns | Yes | D21 | Reported progress, not GPS |
| Q8 | Roles, personal phones versus a shared tablet, offline | Auth method, shared device, offline queue | Yes | D4–D7. Email or password, per-driver login, online-only. | Workflow on those defaults |
| Q9 | Opening balances and records to migrate | Historical ledger and roster | Yes | D17 | Synthetic fixtures |
| Q10 | Day-one bar and named pilot people | Go-live | No | Do not invent participants or a date. | Schema, auth, synthetic workflow |
| Q11 | Which IANA timezone should this customer’s org use? | The value in their row | Yes | D16. Mechanism is UTC plus a configured zone. Synthetic fixture sets its own zone and labels it as fixture data. | Workflow tests |
| Q12 | Two open loads? Hard-block an overdue truck? | Assign policy | Yes | D14, D15 | Assignment function |
| Q13 | Who may add drivers, trucks, and customers? | CRUD versus a fixture load | Yes | D17 | Owner creates loads against the fixture roster |
| Q14 | Spanish on day one? | Pilot i18n | Yes | D18 | English API |
| Q15 | Retention, and whether a customer may see files | Storage lifecycle, customer portal | Yes | D19. Private to the company. | Private bucket |
| Q16 | Replace the dispatch sheet or run beside it? | Pilot strictness | Yes | D20 | Workflow |
| Q18 | Which deadlines matter, and how early is the warning? | Attention rules, including last free day and empty return | Yes | D11 | Dates stored, no alerts |

## Future scope

**Future.** Not part of the first workflow. Do not add vendors or tables for these unless a later decision promotes one.

| Item | Why it stays future |
| --- | --- |
| Brokerage | Named as future. Launch is the carrier’s owner and drivers. |
| Customs, BorderConnect, ACE, ACI | Named as future. A border mention on a reference rate confirmation is not a filing requirement. |
| IFTA | Named as future. Pitch fuel gallons are a synthetic snapshot. |
| RTS | Named as future. The brief does not define the vendor or the workflow. |
| OCR | A stored photo is not text extraction. |
| Continuous GPS | Last reported progress is the workflow signal. A coordinate feed is a later decision (Q7). |
| Fuel-card feeds | Outside this workflow. |
| Payment processor | Recording that a payment happened can wait until Q4. A processor is a separate decision. |
| Spreadsheet bi-directional sync | Pitch Excel sync writes a local stamp and sends nothing. |

Customer invoicing stays under Q6. It is omitted here, and it is not declared future.
