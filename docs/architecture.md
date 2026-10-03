# Architecture

**Proposed.** One modular monolith for the pilot. One Next.js TypeScript codebase, one deploy, one Postgres database. Server handlers own every write.

**Workflow requirement.** The first complete workflow needs real auth, organization and driver access restrictions, server-side validation, and durable private file storage. Financial calculations stay provisional until pay rules are customer-confirmed. See [requirements.md](./requirements.md).

**Pitch default.** The app on `main` is Zustand plus IndexedDB, with no login and with fictional Westshore data. See the root [README](../README.md). GitHub [`Aditya369-dot/snapdispatch`](https://github.com/Aditya369-dot/snapdispatch) is the source of truth. The current-state write-up is [docs/production-audit.md](https://github.com/Aditya369-dot/snapdispatch/blob/main/docs/production-audit.md) on `main` (`e1e6e8a`, squash-merged from PR #2).

## Why one deploy

**Assumption.** The first pilot is a single carrier, about ten or more trucks, with an owner and drivers sharing one set of loads. A network of services would add failure modes that fleet will not use.

`organization_id` is on every tenant row (**Proposed**, D1) so a second company later is a new row. The pilot has no self-serve signup.

## Pitch deploy and pilot deploy

| | Pitch | Pilot |
| --- | --- | --- |
| Purpose | Sales walkthrough | Staging, then a later trial with real people |
| Data | Westshore seed in the browser | Postgres. Staging uses [fixtures/m1-synthetic.json](./fixtures/m1-synthetic.json) only |
| Auth | Role switcher in `components/app-frame.tsx` | Real sessions. Role on the server |
| Files | IndexedDB `snapdispatch-demo` | Private object storage |
| Host | `https://snapdispatch.vercel.app/` at the time of the audit | A different project. Customer loads do not go on the pitch host |
| Money | `lib/finance.ts` demo math | Typed amounts only. No formula until Q4 and Q5 |

**Proposed.** Vercel for the app and Supabase for Postgres, Auth, and private Storage, if email magic link or password is acceptable (D4). Re-check the audit’s price notes before anyone buys a plan. Phone OTP adds an SMS vendor. The pitch can stay on its current hobby-style deploy because it holds no customer data.

If Supabase is a poor fit after Q8, keep the same Postgres tables and swap the auth provider. The schema draft comments the `auth.users` dependency. The private-bucket requirement stays either way.

## Time

**Workflow requirement.**

- Persist instants as UTC (`timestamptz`).
- Store an IANA timezone on the organization. The customer configures it. Forms use it when a person types a local time. The UI uses it to display times. Business-day queries (“today”, a chosen appointment day) use it.
- Do not copy `toPacificIso` or any writer that always appends `-07:00`. That pitch behavior is wrong for Pacific Standard Time and is the wrong model even when the customer’s zone is Pacific: the zone belongs in configuration, and the row stores UTC.

Q11 asks which zone string to put on the customer’s organization. It does not reopen UTC storage.

## Where code lives

Pages under `app/` are client components. There is no `app/api/`. The pilot adds a server write path. This documentation does not change the pitch UI. A later pilot UI should call [api/v1-m1.md](./api/v1-m1.md).

Before writing Next.js handlers, read `node_modules/next/dist/docs/`. This repo’s Next.js is 16.3.8.

`lib/flow.ts` and `lib/finance.ts` remain the pitch implementation. They are not the production handoff list or the production pay rules. New pilot checks live in server modules, in the same transaction as the row write.

## Module boundaries

Brokerage, customs (BorderConnect, ACE, ACI), IFTA, and RTS stay outside the monolith’s launch surface. They are **Future**.

| Module | In the first workflow? | Owns | Leaves out |
| --- | --- | --- | --- |
| Identity | Yes | Organization, profile, session, role | A client-supplied role header |
| Directory | Yes, via fixture | Driver, truck, customer, place | Self-serve admin until Q13 |
| Dispatch | Yes | Create, assign, acknowledge | A mandatory empty-return state |
| Progress | Yes | Append-only progress events and optional reported stage text | The pitch import/export chain as a constraint |
| Files | Yes | Private receipt and POD objects, owner review | OCR, a customer portal, reimbursement posting |
| Driver pay | Provisional | A place to show “not configured” | Any formula, including `FLAT_PAY` |
| Customer billing | No | — | Invoices, until Q6 |
| Fleet care | No, except the out-of-service flag used at assign time | — | ELD, IFTA, service schedules |
| Export | No | — | Simulated Excel sync |
| Pitch shell | Stays on the pitch deploy | Walkthrough, demo reset, role switcher, schematic map | Any read of the pilot database |

Server commands for the workflow: `createLoad`, `assignLoad`, `acknowledgeLoad`, `recordProgress`, `registerDocument`, `completeDocumentUpload`, `reviewDocument`. The file commands do not post pay.

## Authorization

**Workflow requirement.**

- The session identifies the user. `profiles.role` is `owner` or `driver`.
- Every tenant table has `organization_id`. A session cannot read another company.
- Owners read and write the company’s loads and reviews.
- Drivers read loads where `driver_id` is theirs. They acknowledge, post progress, and upload on those loads only. They do not assign, review, or read another driver’s files.
- Unknown or hidden ids return 404 to a driver so the id is not an oracle.
- The service-role key stays on the server. It is not in client code, `NEXT_PUBLIC_*` variables, or git.
- `assign_load`, `acknowledge_load`, `record_progress`, and `review_document` re-check `auth.uid()` inside the database. A table-wide driver update policy is too wide.

## Files

**Workflow requirement.** Receipt and POD bytes go to a private bucket. The `documents` row stores bucket, object key, mime, size, kind, and review state. The object key is `org/{organizationId}/loads/{loadId}/{documentId}`. Reads and writes use short-lived authorized URLs. IndexedDB is the pitch store only.

**Proposed** limits, reversible under Q6: JPEG, PNG, PDF, 10 MB. Kinds in this workflow are `receipt` and `pod`.

Review records `approved` or `rejected`. It does not insert a ledger line. Whether approval should pay the driver is **Open** (Q5).

## Validation

**Workflow requirement.** The server, not the React button, enforces:

- the caller’s organization and role
- assignment rules in D14 and D15
- acknowledge only by the assigned driver, and only from `assigned`
- progress only after acknowledge, with a non-blank note
- document kind, mime, size, and receipt amount present when the kind is `receipt`
- review only by the owner, and only after the upload has completed

The server does not enforce the pitch next-step function, an empty-return gate, or a pay formula.

## What stays on the pitch

The role switcher, the frozen demo clock, client-only validation as the only check, the schematic map, IndexedDB blobs, simulated Excel sync, the settlement flag, and the pitch earning formulas. Those are **Pitch defaults**.
