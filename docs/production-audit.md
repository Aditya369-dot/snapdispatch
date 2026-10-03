# SnapDispatch production-transition audit

Date: 2026-10-03. Scope is read-only. The application code was not changed. This document is a recommendation for a first customer of about ten or more trucks. It is not a claim that the prototype is ready to hold real freight, pay, or documents.

Labels used below:

- **VERIFIED** — checked against this repo, a command run here, or a public page fetched for this audit.
- **OBSERVATION** — what the code does, including behavior that is fine for a pitch and wrong as a system of record.
- **ASSUMPTION** — not proven by the repo. Called out so it is not treated as a fact.
- **RECOMMENDATION** — proposed next design. Not an implemented business rule.

## 1. Current-state assessment

### What this repo is

**VERIFIED.** SnapDispatch is a Next.js App Router pitch prototype for a fictional Oakland carrier, Westshore Drayage. `README.md` says there is no login, database, payment processor, or GPS account, that tracking and Excel sync are simulated, and that edits stay in the browser until demo reset. The code matches that description.

**VERIFIED.** On 2026-10-03 the GitHub remote named `origin` was compared by SHA. Local `main` and `origin/main` are the same commit `711d566d8d060a9a276cc752aba6c386d82bad78` (“Add Spanish/English toggle and per-truck date, gallons, miles, expenses”). Its parent on that remote is `4bb2d8b` (“Initial SnapDispatch pitch prototype”). `gh repo view Aditya369-dot/snapdispatch` reported the repo public and `updatedAt` `2026-10-02T21:14:46Z`. That comparison covers GitHub only.

**OBSERVATION.** Inside that same GitHub repo, `origin/cursor/es-toggle-unit-costs-687a` was at `593a0b1e820aecb0ae80e19e873a719334fa8f1a`. `git merge-base --is-ancestor` of that SHA against `711d566` was false. Commits reachable from the branch and not from `main`: `593a0b1`, `acafe21`. Commits reachable from `main` and not from the branch: `711d566`. That is GitHub branch history with unique commits on each side. It is not a comparison to Origin.

**ASSUMPTION.** Origin repository `aditya-b/snapdispatch` was not compared. The Origin CLI returned “Not authenticated,” and no Origin HEAD SHA or commit list was retrieved. Match, mismatch, and divergence between Origin and GitHub are all unproven. If those HEADs later differ, call that a repository mismatch until commit history proves ancestry.

**VERIFIED.** `https://snapdispatch.vercel.app/` responded `200` with `server: Vercel`, `x-nextjs-prerender: 1`, and `x-vercel-cache: HIT` (age about 25 hours at fetch time). The HTML title is `SnapDispatch · Westshore Drayage` and the splash text is `Opening Westshore Drayage`, the same strings as `app/layout.tsx` and `lib/i18n/copy.ts`. That is strong evidence the public site is this client shell. It is not a byte-for-byte proof of the deployed commit.

### Framework, dependencies, deploy

**VERIFIED.** `package.json` depends on `next` `16.3.8`, `react` / `react-dom` `19.2.8`, `zustand` `^5.0.15`, `xlsx` `^0.18.5`, `radix-ui`, `shadcn`, Tailwind 4, and `lucide-react`. There is no Supabase, Prisma, Drizzle, auth library, test runner, or payment SDK.

**VERIFIED.** `npm install`, `npm run build`, `npm run check`, and `npm run lint` all exited 0 in this environment (Node `v22.14.0`). The production build compiled, finished TypeScript, and emitted 13 app routes. `check` printed `problems: []`. A green build only means the prototype compiles and the seeded book satisfies `scripts/check-demo.ts`. It does not mean the workflows are safe for a real carrier.

**VERIFIED.** Deploy config is thin. `vercel.json` sets `buildCommand` to `next build`. `next.config.ts` only sets `allowedDevOrigins` for local dev. The build completed with no environment variables present.

**VERIFIED.** `npm audit` reported 9 high-severity issues and no critical issues. Eight are the `shadcn` CLI chain (`fast-glob` → `micromatch` → `braces`) and the ESLint-config chain that depends on it. `xlsx` is high with no `fixAvailable`: the audit titles are prototype pollution and a regular-expression denial of service. `lib/excel.ts` only writes workbooks (`XLSX.utils` and `XLSX.writeFile`). It never calls `XLSX.read`. The parsing advisories are latent unless a later change starts reading uploaded spreadsheets. `shadcn` is listed under `dependencies` even though the UI is already generated under `components/ui/`.

**RECOMMENDATION.** Keep the generated UI components. Move the `shadcn` CLI to devDependencies, or drop it from the production install, when someone next touches dependencies. Do not add an Excel import on top of npm `xlsx` `0.18.5` without replacing that parser.

### Routes and screens

**VERIFIED.** There is no `app/api/`, no `middleware.ts`, and no `.github/` workflow. Every page file under `app/` starts with `"use client"`. `app/layout.tsx` is the server shell (fonts, metadata, `AppFrame`).

**VERIFIED.** `next build` route table:

| Path | Build output | What the user sees |
| --- | --- | --- |
| `/` | static | Owner overview |
| `/dispatch` | static | Dispatch board and create-load dialog |
| `/loads`, `/loads/[id]` | static / dynamic | Load list and load detail |
| `/fleet` | static | Schematic map |
| `/drivers`, `/drivers/[id]` | static / dynamic | Driver list and pay ledger |
| `/expenses` | static | Expense approval queue |
| `/trucks`, `/trucks/[id]` | static / dynamic | Trucks and maintenance |
| `/documents` | static | Document review |
| `/reports` | static | Performance |
| `/excel` | static | Spreadsheet preview, download, simulated sync |

Dynamic routes are dynamic because the client pages call `useParams`. They do not load server data.

**OBSERVATION.** The driver phone is not a route. `components/app-frame.tsx` swaps the whole main area to `components/driver-app.tsx` when `view === "driver"`. The URL stays on whatever owner page was open. Owner navigation is hidden until the view switches back.

**VERIFIED.** Owner navigation in `AppFrame` is Overview, Dispatch, Loads, Fleet, Drivers, Expenses, Trucks, Documents, Reports, Excel. The driver phone tabs, from `components/driver-app.tsx`, are Today, My Loads, Expenses, Earnings, and Profile.

### Components and modules

**OBSERVATION.** Product UI, apart from shadcn primitives in `components/ui/`, is:

- `app-frame.tsx` — shell, role switch, demo reset, walkthrough
- `assign-sheet.tsx` — driver and truck assignment
- `driver-app.tsx` — phone workflow
- `load-detail.tsx` — load timeline, documents, financials
- `expense-sheet.tsx` — receipt capture
- `document-preview.tsx` — sample SVG or IndexedDB blob
- `fleet-map.tsx` plus `lib/fleet.ts` — schematic positions
- `unit-figures.tsx` plus `lib/units.ts` — gallons, period miles, unit cost
- `language-switch.tsx` plus `lib/i18n/` — English and Spanish

Domain logic lives in `lib/`, not in route handlers:

- `lib/types.ts` — the data model
- `lib/store.ts` — the only mutator
- `lib/flow.ts` — import and export status machines
- `lib/finance.ts` — pay, contribution, assignment checks, ledger heal
- `lib/seed.ts` — the fictional company
- `lib/files.ts` — IndexedDB blobs
- `lib/excel.ts` — client-side workbook
- `lib/metrics.ts`, `lib/format.ts`, `lib/reference.ts`, `lib/walkthrough.ts`

### Tests

**VERIFIED.** The only automated check is `scripts/check-demo.ts` via `npm run check`. It asserts the seed: 40 loads, 16 drivers, 12 trucks, unique containers, the unassigned pitch load `LD-10440` / `TCLU4829137`, one out-of-service truck, maintenance tones, per-truck fuel figures, driver balances equal to `TARGET_BALANCES`, reimbursement rows match approved driver-paid expenses, open loads do not overlap appointments, overview metrics, the pitch assignment of Rosa Delgado and `WS-119` is allowed, and contribution on `LD-10401` matches `revenue - driverCost - approvedOperating`. ESLint is configured and passed with no findings. There is no unit test of `assignLoad`, `driverAction`, `reviewExpense`, or `recordPayment`, and no browser test.

### Mock data

**VERIFIED.** `lib/seed.ts` `buildSeed()` throws if it does not build 40 loads. A summary run against that function produced:

- Loads by status: complete 24, created 5, assigned 4, empty_return_pending 2, at_customer 2, and one each of at_port, picked_up, accepted. Import 30, export 10.
- People and equipment: 16 drivers (12 flat pay, 2 percentage at 27%, 2 hourly at $34 and $36), 12 trucks, 8 customers in `lib/reference.ts`.
- Money documents: 22 expenses (18 approved, 2 awaiting approval, 1 correction requested, 1 rejected), 64 documents (17 POD, 16 empty return, 7 gate receipt, 4 BOL, 20 expense receipts; review counts 59 approved, 4 pending, 1 rejected), 78 ledger rows.
- `npm run check` figures for that same seed: 16 active loads (not complete), 5 unassigned, 3 completed on the frozen demo day, week revenue `$7,755`, outstanding driver balances `$8,485`, service units `WS-107`, `WS-110`, `WS-122`.

**VERIFIED.** Identifiers are fictional: phones are `(510) 555-…`, emails are `@westshore.example`, VINs look like `1WS…DEMO…`, and `lib/reference.ts` uses MC `948221` and USDOT `3122488` next to a 555 company phone. Places are real Oakland-area terminal and warehouse addresses used as map scenery, with hand-placed `x`/`y` coordinates.

**OBSERVATION.** The demo clock is frozen. `lib/format.ts` sets `DEMO_NOW` to `2026-10-01T09:40:00-07:00`. Each mutation in `lib/store.ts` advances that clock by one minute. “Today” on the overview uses the constant `DEMO_DAY`, not the wall clock. `toPacificIso` formats a Pacific wall time and always appends `-07:00`. New loads created in the dialog also stamp `-07:00`. That offset is prototype behavior, not a production timestamp rule.

### State and persistence

**VERIFIED.** One Zustand store, `useDemo` in `lib/store.ts`, is persisted under `localStorage` key `snapdispatch-demo-v1`. The persisted slice includes drivers, trucks, loads, expenses, documents, ledger, activity, service records, issues, thresholds, the demo clock, the fake Excel sync stamp, settlement approvals, counters, the owner/driver view, the acting driver, language, walkthrough, and tour flags.

**VERIFIED.** Uploaded file bytes go to IndexedDB database `snapdispatch-demo`, object store `files` (`lib/files.ts`). The Zustand document row stores a `blobId`. Sample receipts and the blue POD are generated SVG data URLs (`lib/samples.ts`) and are not stored as bytes. `resetDemo` and `startWalkthrough` call `clearFiles()` and replace the store with `buildSeed()`, keeping the current language.

**OBSERVATION.** Two browsers do not share a load. Assignment on a laptop is invisible on a phone. Clearing site data, or using a private window, returns the fictional book. That is the blocker for the first real assignment.

**OBSERVATION.** `useHydrated` in `lib/store.ts` marks the app ready on persist hydration or after 400ms, whichever comes first. If hydration loses the race, the UI can paint the seed and then replace it. Locally this is usually fast. It is a bad pattern to copy into a real session.

### Backend

**VERIFIED.** There is no backend. No server actions, no route handlers, no database client, no auth callback. `createLoad`, `assignLoad`, `driverAction`, expense review, document review, settlement approval, and payment recording all mutate the Zustand store in the browser.

### Load lifecycle

**VERIFIED.** Status machines are `IMPORT_FLOW` and `EXPORT_FLOW` in `lib/flow.ts`.

Import: created → assigned → accepted → at_port → picked_up → at_customer → delivered → empty_return_pending → empty_returned → complete.

Export: created → assigned → accepted → at_customer → picked_up → at_port → gated_in → complete.

`delivered` exists on the type union but is not an export step. `gated_in` is not an import step. `nextDriverAction` exposes one forward button. `driverAction` rejects a click that is not that next step. Delivering an import writes both `delivered` and, one minute later, `empty_return_pending`, so delivery does not close the load. The driver phone shows that empty-return requirement (`EmptyReturn` in `driver-app.tsx`).

**VERIFIED.** `createLoad` checks a container against `^[A-Z]{4}\d{7}$`, requires customer, pickup, destination, appointment, and a rate above zero, then inserts status `created`. It does not check for a duplicate container. The create dialog in `app/dispatch/page.tsx` does not send last free day, empty-return deadline, cutoff, or accessorials, even though the store input type allows the first three. Appointment end is always start plus 180 minutes. `estimatedHours` is hardcoded to 6 for export and 5.5 for import. Accessorial charges exist on some seed loads and on the financials panel, and `createLoad` always sets `additionalCharges` to `[]`. There is no editor for them.

**VERIFIED.** `validateAssignment` in `lib/finance.ts` requires the load, driver, and truck; blocks a complete load; blocks a move to a different driver after an earning has posted; blocks an out-of-service truck; blocks a driver marked off; and blocks another open load that shares the driver or the truck and overlaps the appointment window. Overdue maintenance does not block. The driver’s home truck is not required. `openLoadWarning` adds a non-blocking warning when that driver or truck already has any other open load, even outside the window. The assign sheet presets Rosa and `WS-119` only during walkthrough step 0 or 1 on the pitch load.

**OBSERVATION.** Reassignment before an earning posts keeps the current status. A load already `picked_up` can move to another driver and stay `picked_up`. The new driver inherits the in-progress step. Pay, when it later posts, uses the driver on the load at heal time.

**OBSERVATION.** The driver phone’s Today card uses `currentLoad`, which picks the open load with the highest flow index. A second open load is on My Loads, not the primary button.

### Financial calculations

**VERIFIED.** These rules are implemented in `lib/finance.ts` and applied by `ensureLedger` on every commit and on rehydrate.

- Revenue on a load is `customerRate` plus accessorials. The load financials panel shows that total even before delivery. Company “week revenue” in `lib/metrics.ts` counts a load only after import delivery or export gate-in, using `countsAsRevenue`.
- Flat pay (`FLAT_PAY` in `lib/reference.ts`): import posts `$185` at delivery and `$95` at empty return; export posts `$250` at gate-in.
- Hourly pay posts `rate * estimatedHours` once, at empty return for import and at gate-in for export. Hours are the estimate, not a clock.
- Percentage pay posts `percent` of linehaul (`customerRate` only, not accessorials), at delivery for import and at gate-in for export.
- An approved expense paid by the driver with reimbursement requested adds one positive ledger row. Company-card and company-cash expenses do not. `scripts/check-demo.ts` asserts company fuel `EX-3101` creates no reimbursement.
- Load contribution is `revenue - expected driver pay - approved operating expenses`. Pending and correction-requested receipts are excluded. The on-screen hint says the reimbursement is not subtracted a second time. The formula matches that: the expense is in operating cost once, and the reimbursement figure is display plus driver balance, not a second deduction.
- Driver balance is the sum of that driver’s ledger. Seed balances are forced to `TARGET_BALANCES` by synthesized payments inside `buildSeed`.
- Copy on the driver page states that customer payment is not required before earnings post, and that pay follows the move, not the invoice.

**VERIFIED.** There is no invoice, no accounts receivable, no customer payment, and no QuickBooks client. `additionalCharges` cannot be added from the UI. Pay profiles cannot be edited. Drivers, trucks, and customers cannot be created. Settlement approval is a single `{ driverId, at }` flag (`approveSettlement`). It does not snapshot an amount or a period. `recordPayment` then allows any positive amount up to the live balance, as ACH, check, or cash, and writes a negative ledger row. The driver page defaults the amount to `400` and the reference to `DEMO-400`, and the page says the payment only updates the demo.

**OBSERVATION.** `ensureLedger` only inserts missing earning and reimbursement ids. It never removes or amends them. `reviewExpense` does not check the previous status. The expenses page only shows approve / correct / reject while status is `awaiting_approval` or `correction_requested`, so a user cannot reject an already approved expense from that screen. A later server port that calls the same functions out of order would leave a reimbursement in the ledger after a rejection. Earning ids are `earn-{loadId}-{leg}` with no driver id and no amount, so a pay-rate change after posting would not rewrite the posted row. Nothing in the UI edits pay rates today.

### File uploads

**VERIFIED.** The expense sheet and the POD sheet accept a generated sample, a file input (`image/*` or PDF), or a camera capture (`capture="environment"`). Bytes are stored with `putFile` before the expense or document row is committed. There is no size limit in `addLocal`. Preview uses an image tag, or an iframe for `application/pdf` (`components/document-preview.tsx`). If the blob is missing, the preview says so. Samples are not private files; they are redrawn from `sampleKey` and `sampleParams`.

**OBSERVATION.** Documents are per-browser. A POD uploaded on the driver phone in this demo is the same browser as the owner, because both views share one store. A second device has neither the metadata nor the blob.

### Auth and validation gaps

**VERIFIED.** The owner/driver switch and the driver picker call `setView`. There is no password. `driverAction` checks `load.driverId === actingDriverId` only when `view === "driver"`. The expenses, documents, settlement, and payment actions do not check a role. Any visitor to the public site can operate the fictional company in their own browser, or drive the store from developer tools.

**VERIFIED.** Every validation rule cited above runs in the client bundle. There is no second check on a server. Container format is a regex, not an ISO 6346 check digit. Appointment overlap uses the stored window, which new loads set to three hours.

### Defects and blockers

These are blockers for the first real customer, not polish on the pitch:

1. **VERIFIED.** No shared system of record. Cross-device assignment is impossible.
2. **VERIFIED.** No accounts and no authorization. The public Vercel app must not receive real customer, driver, or rate data.
3. **VERIFIED.** No private file storage, no retention, no access control on documents.
4. **VERIFIED.** Office users cannot add a driver, truck, or customer. The fleet is the seed.
5. **VERIFIED.** Settlement is a demo flag plus a ledger row. Nothing is sent to a bank. There is no customer bill.
6. **VERIFIED.** Time, “today,” and the Excel sync stamp are simulated.
7. **OBSERVATION.** The domain rules are worth keeping, and they are one browser crash or cleared site data away from disappearing.

The pitch path itself is coherent: walkthrough steps in `lib/walkthrough.ts` assign Rosa and `WS-119`, accept and pick up, submit a `$45` driver-paid toll, approve it, show contribution, deliver, upload the sample POD, record the empty return, record a partial payment, and open the Excel preview. `check` confirms the pitch load starts unassigned and that the Rosa / `WS-119` pair is allowed.

### Credential exposure

**VERIFIED.** `git ls-files` has no env, pem, secret, credential, or key filenames. `.gitignore` ignores `.env*` and `*.pem`. No `.env` file is in the working tree. Source searches found no `SUPABASE`, `service_role`, `sk_live`, or `AKIA` strings. The only “secrets” in product code are the fictional MC, DOT, and 555 numbers above. No secret values are repeated here. `npm audit` findings are dependency advisories, not committed credentials.

## 2. Keep, refactor, or replace

| Piece | Decision | Why |
| --- | --- | --- |
| Next.js 16 App Router, React 19, TypeScript | Keep | The UI the customer has seen is already this app. The hole is a server boundary, not a new framework. |
| Route map and screen layout (owner board, load detail, driver phone) | Keep, then split the driver phone onto a real session | Dispatchers and drivers already have a place to look. The phone must stop being a view toggle. |
| English / Spanish copy in `lib/i18n/` | Keep | Large, already wired through the UI. Confirm with the customer that drivers need Spanish on day one. |
| shadcn / Radix components already in `components/ui/` | Keep | They are the design system. The `shadcn` CLI package does not need to ship in production. |
| `lib/flow.ts` status machines | Refactor onto the server | The import empty-return split and the export gate-in path are the lifecycle. Enforce them in one module the client cannot skip. |
| `lib/finance.ts` pay, contribution, assignment checks | Refactor onto the server, inside a transaction | The rules are explicit and `check` already locks the contribution formula. Add reversal rules before real money. Do not leave `ensureLedger` as an append-only client heal. |
| `lib/types.ts` | Refactor into a Postgres schema | Same nouns: load, driver, truck, expense, document, ledger. Add organization, profile, and later settlement period. Drop demo counters. |
| Load, expense, and document screens | Refactor to read and write server data | Keep the forms and the one-big-button driver step. |
| Zustand store as the system of record, `localStorage` persist | Replace | Correct for a single-browser pitch. Cannot assign across devices or survive a new phone. |
| IndexedDB `lib/files.ts` and sample SVG receipts | Replace for real documents | Samples can stay in the pitch demo. Real PODs and receipts need private object storage and a size and type limit. |
| `lib/seed.ts`, walkthrough, demo reset, role switcher | Keep on the public pitch deploy only | Do not point this book at a real carrier. The pilot deploy should not include “act as any driver.” |
| Schematic fleet map `lib/fleet.ts` | Keep as a status picture, replace the idea that it is tracking | Positions are functions of status and fixed coordinates. GPS is out of scope until the customer asks. |
| Excel page | Refactor later into an export | Download of the same rows is useful. `simulateExcelSync` writes a local stamp and sends nothing. There is no import. |
| `xlsx` on npm `0.18.5` | Replace before any untrusted parse | Write-only use is limited risk. The audit has no fix in this package line. A CSV export is enough for the first pilot. |
| Client-only validation and the 400ms hydration shortcut | Replace | Rules move server-side. Sessions should wait for the server, not for a timer. |
| Frozen demo clock and hardcoded `-07:00` | Replace | **OBSERVATION:** the prototype freezes the clock, and `toPacificIso` always appends `-07:00`. **RECOMMENDATION:** store event timestamps in UTC. Use a customer-configured timezone for input, display, and business-day calculations. Do not hardcode `America/Los_Angeles` or a fixed offset. |
| Settlement boolean and “record payment” | Replace in M4 | A period, a snapshotted amount, and a recorded payout method. Still not a bank integration unless they ask. |
| Customer invoicing | Not in the product today | Add only after the customer says billing means accounts receivable. |
| Brokerage, BorderConnect, ACE/ACI, RTS, IFTA, OCR | Leave out | Out of scope for the first customer. The expense form already has a camera photo; that is not OCR. |

## 3. Proposed architecture

**RECOMMENDATION.** Build a modular monolith in this Next.js app. One TypeScript codebase, one deploy, one Postgres database. No microservices, no Kubernetes, and no AI platform.

Reasons:

- The product surface is one dispatcher UI and one driver UI over one company. A network of services would add failure modes a ten-truck fleet will not use.
- Next.js is already the UI, and it can host typed route handlers or server actions beside the domain modules. The current pages are client components, so the first milestone adds a server write path without throwing away the screens.
- The rules worth saving (`lib/flow.ts`, `lib/finance.ts`) are pure TypeScript. They should run on the server in the same transaction as the row write. The React components should display the result, not be the authority.
- Managed Postgres gives one system of record and row security. Supabase Auth plus private Storage fits that database without a second vendor for login and files, provided the customer accepts email login or brings an SMS vendor. Database backup and object-storage copies are a later pilot requirement. They are not implemented in this prototype.
- The public pitch site can keep today’s Zustand demo. It may stay on Vercel Hobby only while it is non-customer, non-commercial pitch content with no real carrier data. The pilot is a separate deployment on a commercial-eligible plan, such as Vercel Pro, with real auth. Do not migrate Westshore fiction into the customer’s database, and do not put the customer’s loads on `snapdispatch.vercel.app`.

Suggested shape, still one app:

- `lib/domain/` — status machine, assignment checks, earning and reimbursement posting, copied from `flow.ts` and `finance.ts` and made reversible where money requires it.
- Server mutations — one function per command (`createLoad`, `assignLoad`, `advanceLoad`, `submitExpense`, `reviewExpense`, `addDocument`). Each checks the session, then writes.
- Postgres tables — `organizations`, `profiles` (auth user, role `owner` or `driver`), `drivers`, `trucks`, `customers`, `places`, `loads`, `load_events`, `expenses`, `documents`, `ledger_entries`. Add `settlement_periods` in M4, not in M1.
- Row security — every row carries `organization_id`. Owners read and write the org. Drivers select loads, expenses, and documents tied to their driver profile. Drivers do not assign loads and do not approve their own expenses.
- Storage — a private bucket. The app stores the object path and metadata in `documents`. Reads go through a short-lived signed URL or an authorized route. Enforce type and size before upload. The service-role key stays on the server only.
- Timestamps — **RECOMMENDATION:** store event timestamps in UTC. Use a customer-configured timezone for input, display, and business-day calculations. Do not hardcode a zone or a fixed offset such as `-07:00`.
- Recovery — **RECOMMENDATION, not implemented:** before a pilot, backups must cover database records and uploaded receipts and POD files in object storage. A documented restore test must show that both a database row and a stored file can be recovered. Vendor backup features do not count as that test until someone runs it and writes down the result.
- Client — the existing screens, reading from the server. Zustand may cache a screen. It must not be the copy that survives a new device.

**ASSUMPTION.** The first customer is a single company. The schema should still have `organization_id` so a second carrier does not require a rewrite. The pilot does not need a self-serve signup flow.

### Recurring cost

Prices below were read from public pages on 2026-10-03. They are list prices, not a quote, and nothing was purchased. Recheck before buying.

**VERIFIED.** [Supabase pricing](https://supabase.com/pricing) and [pricing.md](https://supabase.com/pricing.md): Free is `$0` with 500 MB database per project and projects pause after a week of inactivity. Pro is from `$25` per month per organization, with 8 GB disk per project, `$10` of compute credit that the pricing page says covers one Micro instance, 100,000 monthly active users then `$0.00325` each, 100 GB file storage then `$0.0213` per GB, 250 GB egress then `$0.09` per GB, and 7-day daily backups. The pricing page also lists a single database-only Micro project at `$25` per month before overages. [Billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase) list storage overage as `$0.021` per GB. Use the pricing page number and expect the invoice to follow Supabase’s current meter.

**VERIFIED.** [Vercel pricing](https://vercel.com/pricing) and the [Pro plan docs](https://vercel.com/docs/plans/pro-plan): Hobby is `$0`. Pro is `$20` per month, includes one deploying seat and `$20` of usage credit, and extra deploying seats are `$20` each. [Fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) say Hobby is non-commercial personal use and commercial use requires Pro or Enterprise. A carrier paying for this product is commercial use.

**VERIFIED.** Phone sign-in is a different line from the `$75` Advanced MFA Phone add-on. [Phone login docs](https://supabase.com/docs/guides/auth/phone-login) require an SMS provider (Twilio, MessageBird, Vonage, or TextLocal). [Advanced MFA Phone](https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone) is `$75` per month for the first project and is not required for ordinary phone OTP. [Twilio’s public messaging page](https://www.twilio.com/en-us/pricing/messaging) lists US SMS starting at `$0.0083` per segment plus carrier fees, and phone-number fees starting at `$1.15` per month. That starting rate is not a commitment.

**ASSUMPTION.** A pilot of about 10 trucks and under 30 people who sign in during a month stays inside Supabase Pro’s database, storage, egress, and auth quotas, and inside Vercel Pro’s `$20` credit, if photos are normal phone images and nobody turns on point-in-time recovery, extra seats, or phone MFA. Expected platform bill: about `$45` per month (`$25` Supabase Pro + `$20` Vercel Pro) before tax. Email magic links or passwords do not add an SMS bill. Phone OTP adds the SMS vendor on top, likely a few dollars to a few tens of dollars at a couple of messages per driver per work day, plus the number fee. Custom domains, error tracking, and email delivery (if auth mail should not come from Supabase’s default sender) are extra and were not priced here.

**RECOMMENDATION.** Any customer pilot or other commercial deployment uses a commercial-eligible host, for example Vercel Pro, plus Supabase Pro so the database is not paused for inactivity. Vercel Hobby is allowed only for a non-customer, non-commercial pitch that holds no real carrier data. The fictional Westshore demo may stay on Hobby under that limit. A paying customer, real carrier data, or other commercial use on that deployment requires Pro or Enterprise. This audit did not verify whether `snapdispatch.vercel.app` is currently Hobby or Pro. Skip Team plan, PITR, SAML, and Advanced MFA Phone until a requirement appears.

## 4. Implementation backlog

Work is ordered inside each milestone. Later milestones depend on the server-owned load from M1. Dollar figures are not repeated here.

### M1 — Foundation and assignment

1. Separate the pilot deployment from `https://snapdispatch.vercel.app/`. The pitch keeps Zustand. The pilot host must be a commercial-eligible plan. Hobby is allowed only for the non-commercial fictional pitch with no real carrier data.
2. Create the organization, profile, driver, truck, customer, place, and load tables, with `organization_id` and row security.
3. Auth for one owner and one driver. Role lives in `profiles`, not in a header the browser can flip.
4. Owner can create a load with the fields dispatch already collects, plus last free day or cutoff when the customer says those matter.
5. `assignLoad` runs the `validateAssignment` rules on the server and writes `driver_id`, `truck_id`, and status `assigned`.
6. The signed-in driver, on another device, can read that load and cannot read other drivers’ loads or call assign.
7. Office basics the seed currently freezes: add and edit driver, truck, and customer, or a written agreement that the implementer loads them for the pilot. That choice is a customer question below.

### M2 — Driver lifecycle

1. Move `nextDriverAction` / `driverAction` to the server. One forward step. The driver on the load is the only caller.
2. Persist the timeline as `load_events` with real timestamps stored in UTC. Display and business-day boundaries use the customer-configured timezone.
3. Keep the single primary button, delay note, and the import empty-return stop.
4. Decide offline behavior before building a queue. If the port has no signal, M2 grows a local outbox. If the yard can live with “submit when online,” do not build sync.
5. Leave the schematic map as a status view. Do not add a GPS vendor in this milestone.

### M3 — Expenses and documents

1. Private bucket, max size, allowed types (`jpeg`, `png`, `pdf` unless they ask for more), and an authorized preview.
2. Expense submit and the approval state machine on the server. Reject and correction must not leave a reimbursement behind.
3. Driver sees approved, rejected, or correction-requested on the phone, and can resubmit a correction.
4. POD and other load documents use the same storage path. Sample SVG receipts stay in the pitch demo only.

### M4 — Financial workflow

1. Post earnings from the server rules: flat split, hourly on agreed hours, percentage base agreed with the customer. Do not invent accessorial pay.
2. Post reimbursements only for approved driver-paid expenses, in the same transaction as approval, and reverse them if approval is undone.
3. Replace the settlement flag with a period: which loads and expenses, the total, who approved it, and payments up to that snapshot.
4. Recording a payment still means “the office says this ACH, check, or cash happened.” No payment processor unless they ask.
5. Customer invoicing only if section 5 says billing means accounts receivable. Otherwise export the load rate, accessorials, and status.
6. Export CSV (or a maintained spreadsheet library) of loads, expenses, and the ledger. Delete simulated Excel sync.

### M5 — Pilot readiness

1. Load the real fleet, drivers, pay rules, and customers into the pilot project. Keep fiction out.
2. Remove the role switcher, walkthrough, and demo reset from the pilot build.
3. Confirm Spanish on the driver phone if required.
4. **RECOMMENDATION, not implemented.** Recovery must cover database records and uploaded receipts and POD files in object storage. Write the restore steps and run a documented restore test that brings back both a load row and a stored file. Supabase Pro’s published daily database backups are a vendor feature to use, not evidence that a restore has been tested, and they do not restore the file bucket by themselves. Add an admin way to correct a bad status or a bad expense with an audit row.
5. Smoke-test two phones and one office browser on the real assignment, status, photo, and balance path.
6. `npm run check` remains the seed test for the pitch. Add tests that call the server rules for assign, illegal status jumps, reimbursement reversal, and “driver A cannot read driver B.”

### M6 — Controlled pilot

1. One company, the agreed trucks, a short window, and a named person who can fix a stuck load.
2. Success is operational: an assignment made in the office appears on the driver’s phone; a photo is still there the next day; a settlement total matches a hand tally of the ledger.
3. No brokerage, customs, fuel-card, IFTA, or OCR work in this window.
4. After the pilot, decide whether customer invoicing, GPS, or a real spreadsheet import is the next project. Those are new scopes.

## 5. Customer questions that block decisions

Each question blocks the decision named on it. The prototype’s behavior is not a substitute for the answer.

1. **Who signs in during the pilot, and how many office people?** Blocks the M1 role model. One owner account is enough to start. Dispatchers who are not drivers need an `owner` or `dispatcher` role before the second office login.
2. **How will a driver prove who they are?** Blocks the auth provider. Email magic link or password stays inside the Supabase MAU quota. Phone OTP needs a Twilio-class account and a per-message bill. The `$75` phone MFA add-on is a separate product and should stay off unless they ask for SMS as a second factor.
3. **Personal phones, or a shared truck tablet?** Blocks whether a login is per driver or per truck. Shared tablets need a fast switch that is still a real sign-out, not today’s dropdown.
4. **Does the driver have to work with no signal at the terminal?** Blocks M2. Online-only is a normal web app. Offline needs a queue and conflict rules.
5. **What does “billing” mean for this customer?** Blocks M4’s schema. The prototype bills nobody. It computes a load contribution and a driver balance, and the UI says pay follows the move, not the invoice. If they need customer invoices, that is a new table and a new screen. If they need driver settlements plus an export, M4 should not grow an invoice module.
6. **What are the real pay rules?** Blocks how `earningPlan` is ported. The demo has flat `$185` / `$95` / `$250`, hourly times estimated hours, and 27% of linehaul. Detention in the seed is a manual ledger adjustment, not a calculated accessorial. Using the demo numbers for the customer would be an invented pay rule.
7. **Can one driver hold two open loads the same day?** Blocks assignment. The demo allows it when appointment windows do not overlap, and only warns. Some fleets want a hard stop at one open load.
8. **Does an out-of-service or overdue truck get a hard block?** Blocks assignment. Today only `out_of_service` is blocked. Overdue `WS-107` can still be dispatched.
9. **Who may add drivers, trucks, and customers?** Blocks M1 scope. Without that CRUD, or a one-time data load by the implementer, the pilot cannot leave the fictional roster.
10. **Which spreadsheet or accounting file must the export match?** Blocks M4’s columns. The Excel page is a generated view of the demo, not a sync to a Microsoft account, and nothing in the repo describes the customer’s real workbook.
11. **Is Spanish required for drivers on the first day?** Blocks whether `lib/i18n` ships in the pilot or waits. The copy is already there.
12. **What timezone should the office see?** Blocks input, display, and business-day boundaries. It does not block the storage format. **RECOMMENDATION:** store events in UTC and apply a customer-configured timezone for those calculations. **OBSERVATION:** the prototype stamps `-07:00`. Do not copy that offset forward.
13. **How long must PODs and receipts be kept, and may a customer ever see them?** Blocks storage retention and whether a customer login exists. Default recommendation until they answer: private to the company, no customer portal.
14. **Is the pilot allowed to replace the morning dispatch sheet, or must it run beside it?** Blocks how strict M6 is. Beside-the-sheet is safer. Replacement requires the settlement and document checks in M5 to pass first.

## 6. First small milestone

**RECOMMENDATION.** The first engineering step is not “add Supabase to the prototype.” It is a thin, server-owned assignment path that two sessions can see, with the pitch demo left on `localStorage`.

Smallest step: one owner, one driver, one truck, one load, in a dev Supabase project, written by a Next.js server mutation, read by the driver on a second browser.

Do not port expenses, the ledger, Excel, the map, the walkthrough, or the 40-load seed in this step.

### Acceptance checks

1. The pitch site and `npm run check` still describe the fictional book. `npm run build` still passes. The public demo’s role switcher is unchanged.
2. The pilot path refuses anonymous reads. A logged-out browser does not receive the load, the driver, or the truck.
3. On browser A, the owner signs in and assigns driver D and truck T to a load that is `created`. The row’s status becomes `assigned`, and `driver_id` and `truck_id` are set.
4. On browser B, a different user signed in as driver D refreshes and sees that container and status. Browser B does not share `localStorage` or IndexedDB with browser A.
5. A second driver, signed in on browser C, does not see that load.
6. Driver D cannot assign or reassign. Calling the assign mutation with D’s session fails.
7. The server, not the React button, rejects an out-of-service truck, an off driver, a complete load, and an appointment overlap. Those four cases already exist in `validateAssignment` and should be rechecked against the database.
8. Reloading browser B after the assignment still shows it. Clearing site data on B and signing in again still shows it.
9. No service-role key is present in client code or in the repository. Driver file uploads are not part of this step.
10. The load uses a real `created_at` / `assigned_at` stored in UTC. It does not use `DEMO_NOW` and does not append a hardcoded `-07:00`.

When those ten checks pass, M1 can widen to real create-load fields and a short roster of the customer’s drivers and trucks. Until they pass, the rest of the backlog is design only.
