# Pilot checkpoint setup

M1 is a technical workflow checkpoint on synthetic data. It is not live-customer ready. The public pitch stays on `/`. The checkpoint UI is `/app`.

Driver-pay calculations stay disabled. Completion, cancellation, handoffs, and container empty returns stay open. See [requirements.md](./requirements.md).

No Supabase project was created in this change. The server runs against Postgres with local password sessions and a private directory. Supabase Auth and private Storage are used only when the env vars below are set.

## Environment

Copy `.env.example` to `.env`. Placeholder names only. Do not commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SNAPDISPATCH_ENV` | Yes | `development`, `test`, or `staging` for fixture reset. `production` refuses reset. |
| `DATABASE_URL` | Yes | Postgres for this checkpoint. Use a database with no customer data. |
| `PILOT_SESSION_SECRET` | Staging and production | Signs session cookies. At least 16 characters. |
| `PILOT_FIXTURE_PASSWORD` | Dev/test | Shared password for `synthetic.example` accounts. Default `synthetic-dev-password`. |
| `PILOT_STORAGE_DIR` | Local storage | Private directory for receipt and POD bytes. Default `.pilot-storage`. Gitignored. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key, used only for password grant. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Server-only. Switches file storage to a private bucket. Never `NEXT_PUBLIC_`. |
| `SUPABASE_JWT_SECRET` | Optional | Verifies Supabase bearer tokens. |
| `SUPABASE_STORAGE_BUCKET` | Optional | Defaults to `load-files`. |

`npm run dev` does not read `.env` by itself. Export the variables, or start Node with `--env-file=.env`. The pilot scripts call `process.loadEnvFile()` and will load `.env` when it exists.

## Local Postgres

```bash
createdb snapdispatch_dev
export SNAPDISPATCH_ENV=development
export DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/snapdispatch_dev
export PILOT_SESSION_SECRET=replace-with-a-long-random-string
export PILOT_FIXTURE_PASSWORD=synthetic-dev-password
export PILOT_STORAGE_DIR=.pilot-storage
npm run pilot:migrate
npm run pilot:reset
npm run dev
```

`pilot:reset` loads the minimal fixture, the fleet fixture, the isolation fixture, and the generated staging roster. It refuses to run unless `SNAPDISPATCH_ENV` is development, test, or staging, and it refuses if any organization is not marked synthetic or does not start with `Synthetic`.

Reset again with `npm run pilot:reset`. That command is not for a customer database.

Backup and restore, also refused in production:

```bash
npm run pilot:backup -- pilot-backup.json
npm run pilot:restore -- pilot-backup.json
```

## Two browsers

Use separate browsers or a private window so the sessions do not share cookies. Both must open the same host.

1. Browser A: [http://127.0.0.1:43123/app/login](http://127.0.0.1:43123/app/login)
   - Staging roster owner: `owner.staging@synthetic.example`
   - Password: the value of `PILOT_FIXTURE_PASSWORD` (default `synthetic-dev-password`)
2. Open an unassigned load such as `SYN-ROSTER-001`. Assign Synthetic Roster Driver 01 and `SYN-S01`.
3. Browser B, same password: `driver.staging.01@synthetic.example`
4. The driver sees that load, acknowledges it, posts a progress note, and uploads a receipt (typed cents) and a POD.
5. Browser A refreshes. The owner approves or rejects each file. The typed amount does not change. No pay is posted.
6. Optional: the driver checks **Report container return**. That stores the text `container_return` on the progress note. It is an assumption for the test scenario. It is not a required step and it is not a status. See Q3 and Q18.

Other synthetic accounts, same password:

| Account | Email |
| --- | --- |
| Minimal owner | `owner.m1@synthetic.example` |
| Minimal driver | `driver.one@synthetic.example` |
| Minimal other driver | `driver.two@synthetic.example` |
| Fleet owner | `fleet.owner@synthetic.example` |
| Fleet driver 01 | `fleet.driver.01@synthetic.example` |
| Isolation Alpha owner | `alpha.owner@synthetic.example` |
| Isolation Bravo owner | `bravo.owner@synthetic.example` |
| Staging dispatcher | `dispatcher.staging@synthetic.example` |
| Staging drivers 01–12 | `driver.staging.01@synthetic.example` through `driver.staging.12@synthetic.example` |

The dispatcher can create and assign. The dispatcher cannot review documents. The pitch role switcher on `/` is unchanged and is not a session.

The staging roster is one fictional carrier: 10 trucks (`SYN-S01`–`SYN-S10`), 12 drivers, 1 owner, 1 dispatcher, 5 customers, and 100 loads across 30 days, plus mileage, maintenance reminders, sample receipt/POD files, and labeled non-production pay examples. `npm run pilot:reset` rebuilds it.

## What the project owner must provide for a hosted two-device demo

This repository does not contain Supabase credentials and does not buy a plan.

1. Create a Supabase project that will never hold customer freight. Keep it separate from any production project.
2. Put that project's Postgres URI in `DATABASE_URL`.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. Create a private Storage bucket named `load-files`. Do not make it public.
5. Set `PILOT_SESSION_SECRET` and `SNAPDISPATCH_ENV=staging`.
6. From a machine that can reach that database, run `npm run pilot:migrate` and `npm run pilot:reset`.
7. Deploy this app somewhere other than the pitch host `snapdispatch.vercel.app`. Point both devices at that host and sign in with the synthetic emails above.

Until those values exist, use the local Postgres steps. Login still works with the fixture password. If Supabase Auth users are created later, their user ids must equal `profiles.id` before bearer tokens resolve. The `auth.users` foreign key is not applied yet. See [schema/m1-migration-notes.md](./schema/m1-migration-notes.md).

## Tests

```bash
npm run test:pilot
npm run lint
npm run check
npm run build
```

`check` still describes the fictional Westshore book. It does not touch Postgres.
