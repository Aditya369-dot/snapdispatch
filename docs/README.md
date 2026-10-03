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
5. [m1-plan.md](./m1-plan.md) — M1 technical workflow checkpoint and acceptance checks. Not live-customer ready. Driver-pay calculations stay disabled.
6. [api/v1-m1.md](./api/v1-m1.md) — draft HTTP contract.
7. [schema/m1-draft.sql](./schema/m1-draft.sql) — **draft** Postgres sketch. Not a migration and not ready to apply. Unresolved: RLS policy details, migration strategy, indexes TBD, and enum/status finalization after discovery.
8. [fixtures/m1-synthetic.md](./fixtures/m1-synthetic.md) — how to use the minimal roster, the larger fleet (≥10 trucks), and the second-organization isolation fixture.
9. [production-audit.md](https://github.com/Aditya369-dot/snapdispatch/blob/main/docs/production-audit.md) — current-state audit, on `main`.

## First workflow

M1 is a **technical workflow checkpoint**, not a live-customer pilot. Create → assign → the assigned driver sees the load on another device and acknowledges → progress updates → upload receipt and POD → owner reviews.

Assignment visibility is the first checkpoint inside that path. It is not the end of the workflow, and the workflow is not live-customer ready. Driver-pay calculations stay **disabled** until the customer confirms them (typed amounts only; no pay-formula table executes).

**Open gates before a live pilot**, not done in M1: load completion definition, cancellation, handoffs/stage machine, and container empty returns. See [requirements.md](./requirements.md).

## Audit

[docs/production-audit.md](https://github.com/Aditya369-dot/snapdispatch/blob/main/docs/production-audit.md) is on `main`. [PR #2](https://github.com/Aditya369-dot/snapdispatch/pull/2) squash-merged it as `e1e6e8a` (“Add the SnapDispatch production-transition audit”).

[PR #4](https://github.com/Aditya369-dot/snapdispatch/pull/4) is merged on `main` at `d63db7b` (“Document the first-customer SnapDispatch workflow”). It is not an open pull request. [PR #3](https://github.com/Aditya369-dot/snapdispatch/pull/3) is merged on `main` at `e9c7347` and adds GitHub Actions CI (lint, demo check, and build). CI does not apply the draft schema.

Use that file for the current-state assessment and the keep-or-replace list. Its timestamp recommendation matches these docs: store event timestamps in UTC, and use a customer-configured timezone for input, display, and business-day calculations. The pitch stamps a fixed `-07:00`. Do not copy that offset forward.

## Index

| Doc | Role |
| --- | --- |
| [requirements.md](./requirements.md) | Confirmed vs open vs proposed vs future |
| [owner-questions.md](./owner-questions.md) | Eight owner questions |
| [discovery-checklist.md](./discovery-checklist.md) | Customer discovery before custom rules |
| [architecture.md](./architecture.md) | Monolith, modules, auth, storage, time |
| [m1-plan.md](./m1-plan.md) | Technical workflow checkpoint. Not live-customer ready |
| [api/v1-m1.md](./api/v1-m1.md) | API contract v1 |
| [schema/m1-draft.sql](./schema/m1-draft.sql) | Draft schema. Not a migration. RLS, migration strategy, indexes, and status enums are unresolved |
| [schema/m1-migration-notes.md](./schema/m1-migration-notes.md) | What the checkpoint migration applies, and which RLS and auth items stay open |
| [SETUP.md](./SETUP.md) | Local Postgres or optional Supabase env, reset guard, two-browser walkthrough |
| [m1-status.md](./m1-status.md) | Passed checks, and the customer questions this checkpoint does not close |
| [fixtures/m1-synthetic.md](./fixtures/m1-synthetic.md) | Minimal roster, fleet scale, and second-organization isolation |
| [fixtures/m1-synthetic.json](./fixtures/m1-synthetic.json) | Minimal synthetic org, people, trucks, and load |
| [fixtures/m1-fleet.json](./fixtures/m1-fleet.json) | Larger synthetic fleet, at least 10 trucks |
| [fixtures/m1-isolation.json](./fixtures/m1-isolation.json) | Two synthetic organizations for company-isolation tests |
| [production-audit.md](https://github.com/Aditya369-dot/snapdispatch/blob/main/docs/production-audit.md) | Audit on `main` at `e1e6e8a` |

## What the repo is today

The public pitch is still the Next.js prototype described in the root [README](../README.md): one Zustand store (`lib/store.ts`) in `localStorage`, uploads in IndexedDB (`lib/files.ts`), and the role switcher. Westshore Drayage and its pay figures are fictional. The checkpoint adds `/app` and `/api/v1` beside that pitch. It does not replace it.

The first-workflow docs from PR #4 are already on `main` (`d63db7b`). CI from PR #3 is already on `main` (`e9c7347`). Neither merge turns the prototype into a pilot. M1 stays a technical checkpoint until the pre-pilot gates in [requirements.md](./requirements.md) are resolved, and driver-pay calculations stay disabled until the customer confirms them.
