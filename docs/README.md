# SnapDispatch docs

Planning docs for the first customer workflow. Application code is unchanged. GitHub [`Aditya369-dot/snapdispatch`](https://github.com/Aditya369-dot/snapdispatch) is the source of truth for the prototype.

## Labels

| Label | Meaning |
| --- | --- |
| **Customer-confirmed** | This customer’s business has agreed it. |
| **Workflow requirement** | The first complete workflow must do this. Not a discovered pay, handoff, receipt, or empty-return rule. |
| **Proposed** | A reversible default. Safe to build until discovery replaces it. |
| **Open** | Unanswered. Pitch behavior does not close it. |
| **Pitch default** | What the Westshore demo does. Not a production rule. |
| **Assumption** | Not proven. |
| **Future** | Out of launch: brokerage, customs, IFTA, RTS, and the other items in requirements. |

## How to read them

1. [requirements.md](./requirements.md) — customer-confirmed items, workflow requirements, proposed defaults, open questions, future scope.
2. [owner-questions.md](./owner-questions.md) — eight owner questions mapped to data, user, screen, and acceptance. GPS is separate from last reported status.
3. [discovery-checklist.md](./discovery-checklist.md) — what to collect before any customer-specific rule, especially pay, handoffs, receipt approval, and empty returns.
4. [architecture.md](./architecture.md) — modular monolith, auth, access, server validation, private files, UTC plus a customer timezone.
5. [m1-plan.md](./m1-plan.md) — first complete workflow and acceptance checks. Financial calculations stay provisional.
6. [api/v1-m1.md](./api/v1-m1.md) — draft HTTP contract.
7. [schema/m1-draft.sql](./schema/m1-draft.sql) — draft Postgres schema. Not a migration.
8. [fixtures/m1-synthetic.md](./fixtures/m1-synthetic.md) and [fixtures/m1-synthetic.json](./fixtures/m1-synthetic.json) — synthetic staging roster.
9. [production-audit.md](https://github.com/Aditya369-dot/snapdispatch/blob/main/docs/production-audit.md) — current-state audit, on `main`.

## First workflow

Create → assign → the assigned driver sees the load on another device and acknowledges → progress updates → upload receipt and POD → owner reviews.

Assignment visibility is the first checkpoint. It is not the end of the workflow. Driver pay, the handoff list, what receipt approval means for money, and whether an empty return is required stay **Open**. See [requirements.md](./requirements.md).

## Audit

[docs/production-audit.md](https://github.com/Aditya369-dot/snapdispatch/blob/main/docs/production-audit.md) is on `main`. [PR #2](https://github.com/Aditya369-dot/snapdispatch/pull/2) squash-merged it as `e1e6e8a` (“Add the SnapDispatch production-transition audit”).

Use that file for the current-state assessment and the keep-or-replace list. Its timestamp recommendation matches these docs: store event timestamps in UTC, and use a customer-configured timezone for input, display, and business-day calculations. The pitch stamps a fixed `-07:00`. Do not copy that offset forward.

## Index

| Doc | Role |
| --- | --- |
| [requirements.md](./requirements.md) | Confirmed vs open vs proposed vs future |
| [owner-questions.md](./owner-questions.md) | Eight owner questions |
| [discovery-checklist.md](./discovery-checklist.md) | Customer discovery before custom rules |
| [architecture.md](./architecture.md) | Monolith, modules, auth, storage, time |
| [m1-plan.md](./m1-plan.md) | Workflow acceptance plan |
| [api/v1-m1.md](./api/v1-m1.md) | API contract v1 |
| [schema/m1-draft.sql](./schema/m1-draft.sql) | Draft schema |
| [fixtures/m1-synthetic.md](./fixtures/m1-synthetic.md) | How to use the synthetic roster |
| [fixtures/m1-synthetic.json](./fixtures/m1-synthetic.json) | Synthetic org, people, truck, load |
| [production-audit.md](https://github.com/Aditya369-dot/snapdispatch/blob/main/docs/production-audit.md) | Audit on `main` at `e1e6e8a` |

## What the repo is today

The app on `main` is a Next.js pitch prototype. One Zustand store (`lib/store.ts`) persists to `localStorage`. Uploaded bytes go to IndexedDB (`lib/files.ts`). There is no `app/api/`. The public pitch is described in the root [README](../README.md). Westshore Drayage and its pay figures are fictional.
