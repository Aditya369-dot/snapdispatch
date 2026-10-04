# Hosted staging walkthrough

The checkpoint UI is `/app`. The public pitch stays on `/` and does not read the pilot database. Driver-pay calculations stay disabled. Completion, cancellation, handoffs, and container empty returns stay open. See [requirements.md](./requirements.md).

The walkthrough is a laptop and a phone, both pointed at one Vercel URL. It does not need Postgres installed on either device.

No Supabase project and no Vercel project were created for this change. Do not buy a plan from these steps. Do not put secret values in the repo, in this file, or in a pull request.

## Auth path

Staging login is the existing **password session** against synthetic `profiles`.

1. Open `/app/login` on the staging host.
2. Submit a synthetic email and the fixture password.
3. The server checks `pilot_credentials` (scrypt) and sets an HttpOnly cookie named `sd_pilot`.
4. Later requests send that cookie, or an `Authorization: Bearer` token from the same login response.

Supabase is **Postgres and a private Storage bucket only**. It is not the login system for this walkthrough.

Setting `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or any other Supabase variable does **not** create users. `npm run pilot:reset` hashes `PILOT_FIXTURE_PASSWORD` into `pilot_credentials` for each synthetic profile. It does not insert `auth.users` rows. Do not create Supabase Auth users for staging. A bearer JWT is not required, and it does not work unless that Auth user id already equals `profiles.id`. The `auth.users` foreign key is not applied. See [schema/m1-migration-notes.md](./schema/m1-migration-notes.md).

Leave `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_JWT_SECRET` unset. They are not part of this path.

## Environment variable names

Values stay in Supabase, Vercel, and GitHub Actions secrets. This file lists names only.

| Name | Where | What it is |
| --- | --- | --- |
| `SNAPDISPATCH_ENV` | Vercel and the reset job | Set to `staging`. Do not set `production`. Reset refuses `production`. |
| `DATABASE_URL` | Vercel and the reset job | Session-pooler Postgres URI for the new Supabase project. |
| `PILOT_SESSION_SECRET` | Vercel | Signs `sd_pilot` and the staging-access cookie. At least 16 characters. |
| `PILOT_FIXTURE_PASSWORD` | Reset job only | Unique password, at least 16 characters. Hashed into synthetic profiles at reset. Not a Vercel runtime variable. |
| `STAGING_ACCESS_CODE` | Vercel | Shared code for `/app` and `/api/v1`. The pitch at `/` ignores it. |
| `SUPABASE_URL` | Vercel and the reset job | Project URL, `https://<project-ref>.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel and the reset job | Server-only. Never `NEXT_PUBLIC_`. |
| `SUPABASE_STORAGE_BUCKET` | Vercel and the reset job | `load-files`. |

`PILOT_FIXTURE_PASSWORD` on staging must be non-empty, at least 16 characters, and must not be the local development default. Choose it yourself and store it outside the repo. The people on the laptop and phone type that same password at `/app/login`.

## 1. Supabase project

Use a new project that will never hold customer freight. Do not reuse a production project.

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Pick the organization. If you have a project that already stores customer data, do not select that project. This is a separate project.
4. Set the project name (for example `snapdispatch-staging`). The name is not a secret.
5. Generate a database password and store it in a password manager. Do not paste it into git.
6. Choose a region near the people who will open the walkthrough.
7. Leave the plan on Free. Click **Create new project**. Wait until the project status is healthy. A free project can pause after inactivity; wake it from the dashboard before the walkthrough. This step does not upgrade the plan.
8. Click **Connect** at the top of the project.
9. Choose the **Session pooler** URI (IPv4, port `5432` on the pooler host). Vercel and GitHub-hosted runners are IPv4. The direct host `db.<ref>.supabase.co` is often IPv6-only, so do not use it for this walkthrough. Do not use the transaction pooler on port `6543`; migrate runs a multi-statement script and the app uses transaction-scoped session settings.
10. If the URI still contains a password placeholder, replace only that placeholder with the database password you stored. The finished URI is the secret named `DATABASE_URL`. Keep the `sslmode=require` parameter from the dialog.
11. In the left sidebar, open **Storage**.
12. Click **New bucket**.
13. Name the bucket `load-files`.
14. Leave **Public bucket** off. Do not create a public bucket and do not add a public policy.
15. Create the bucket.
16. Open **Project Settings** (gear) → **Data API** (or the project home) and copy the project URL. That value is the secret named `SUPABASE_URL`.
17. Open **Project Settings** → **API Keys**. Copy the **service_role** key. That value is the secret named `SUPABASE_SERVICE_ROLE_KEY`. Do not copy the anon or publishable key into the app.

Do not enable the Data API for these tables. The Next.js server connects with `DATABASE_URL`, which is a privileged role. Row security in the migration is not the access check for this checkpoint. See [schema/m1-migration-notes.md](./schema/m1-migration-notes.md).

Creating the project does not create SnapDispatch users.

## 2. Vercel project

Use a new Vercel project. Do not deploy this checkpoint onto the pitch host `snapdispatch.vercel.app`.

1. Open [https://vercel.com/new](https://vercel.com/new) and sign in.
2. Import the Git repository `Aditya369-dot/snapdispatch`.
3. If Vercel offers the existing project that serves `snapdispatch.vercel.app`, do not update that project. Create a separate project.
4. Set the project name to a new name (for example `snapdispatch-staging`). The resulting host will look like `https://<project-name>.vercel.app`. Confirm it is not `https://snapdispatch.vercel.app`.
5. Framework preset: Next.js. Root directory: repository root. Do not change the build command.
6. Open **Environment Variables** before the first deploy. Add each name from the table above except `PILOT_FIXTURE_PASSWORD` (reset only). Set `SNAPDISPATCH_ENV` to `staging` and `SUPABASE_STORAGE_BUCKET` to `load-files`. Put the secret values in the value fields. Apply them to this project's Production environment. That deployment is still staging: `SNAPDISPATCH_ENV` stays `staging`.
7. Also add the same variables to Preview if you will open a preview URL.
8. Click **Deploy**. Wait until the deployment is Ready. Copy the deployment URL. Do not attach the pitch domain.

To change a value later: project → **Settings** → **Environment Variables** → edit → redeploy.

## 3. Migrate and reset from CI

Run this once, after the Supabase project and the private bucket exist, and before the walkthrough. The command uses the remote `DATABASE_URL`. It does not install or start Postgres on a laptop.

Reset refuses to run unless `SNAPDISPATCH_ENV` is `development`, `test`, or `staging`. It refuses `production` and any other value. It also refuses when any organization already in the database is not marked synthetic or has a name that does not start with `Synthetic` (`assert_can_reset_synthetic` in the migration, and the same checks on every fixture file). An empty database is allowed. Do not point it at customer freight.

On staging, reset also refuses an empty `PILOT_FIXTURE_PASSWORD`, a value shorter than 16 characters, and the well-known local default. It then hashes the password you set into `pilot_credentials` for every synthetic profile. It does not create Supabase Auth users. It writes sample receipt and POD bytes into the private `load-files` bucket when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. It does not delete the bucket. Create the bucket first. If the upload fails, fix the bucket or the service-role key and run reset again.

GitHub Actions, from a browser:

1. Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Create `DATABASE_URL`, `PILOT_FIXTURE_PASSWORD`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Use the same values the Vercel app uses, except the fixture password, which only the reset job needs.
3. Open **Actions** → **Pilot staging reset** → **Run workflow** on `main` (after this change is merged). The workflow sets `SNAPDISPATCH_ENV` to `staging` and `SUPABASE_STORAGE_BUCKET` to `load-files`.
4. Wait until the job succeeds. The log must not print the password or the database URI. The success line says synthetic fixtures were reset and Supabase Auth users were not created.

The same scripts can run in any cloud shell that has Node 22, this repo, and those variables exported. Example shape, with values coming from the secret store rather than from this file:

```bash
npm ci
npm run pilot:migrate
npm run pilot:reset
```

`pilot:migrate` applies `db/migrations/0001_m1_workflow.sql` and records it in `schema_migrations`. `pilot:reset` runs migrate, then replaces rows with the synthetic fixtures.

## 4. Two devices

Use the Vercel URL from step 2. Use a normal window on the laptop and a private window or the phone so the two sessions do not share cookies. Each device unlocks, then signs in.

1. Open `https://<your-staging-project>.vercel.app/`. The Westshore pitch loads. No access code and no login.
2. Open `https://<your-staging-project>.vercel.app/app`. The staging gate redirects to `/staging-access`.
3. Enter `STAGING_ACCESS_CODE`. The browser stores HttpOnly cookie `sd_staging` for 12 hours. It does not store the raw code. On the HTTPS Vercel host that cookie is also marked Secure.
4. Sign in at `/app/login`.
   - Owner: `owner.staging@synthetic.example`
   - Password: the `PILOT_FIXTURE_PASSWORD` you stored for the reset job
5. Open an unassigned load such as `SYN-ROSTER-001`. Assign Synthetic Roster Driver 01 and `SYN-S01`.
6. On the phone, repeat the unlock with the same access code, then sign in as `driver.staging.01@synthetic.example` with the same fixture password.
7. The driver sees that load, acknowledges it, posts a progress note, and uploads a receipt (typed cents) and a POD.
8. The laptop refreshes. The owner approves or rejects each file. The typed amount does not change. No pay is posted.
9. Optional: the driver checks **Report container return**. That stores the text `container_return` on the progress note. It is an assumption for the test scenario. It is not a required step and it is not a status. See Q3 and Q18.

API calls from a script can send header `x-staging-access` with the access code, or HTTP Basic with username `staging` and the access code as the password. Example shape:

```bash
curl -u staging:YOUR_ACCESS_CODE https://YOUR-STAGING-PROJECT.vercel.app/api/v1/health
```

Replace the placeholders outside this repo. A session call still needs the profile password after the gate. Basic auth here is the staging gate, not the profile login.

Other synthetic accounts use the same fixture password:

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

If `STAGING_ACCESS_CODE` is unset, the gate stays off even when `SNAPDISPATCH_ENV` is staging. Set it before sharing the URL. In development and test the gate stays off even if the variable is present.

## What is still blocked until the project exists

This repository cannot finish a hosted check. The owner still has to create the Supabase project, the private bucket, and the separate Vercel project, then store the secret values and run **Pilot staging reset**. Until that job succeeds, `/app` on a new Vercel deployment has no profiles and no files.

## Optional local Postgres

Developers can run the same checkpoint against Postgres on a workstation. This is not required for the hosted walkthrough. Development and test may use the local fixture password `synthetic-dev-password` when `PILOT_FIXTURE_PASSWORD` is unset or set to that value. Staging refuses that value.

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

`npm run dev` does not read `.env` by itself. Export the variables, or start Node with `--env-file=.env`. The pilot scripts call `process.loadEnvFile()` and will load `.env` when it exists.

Local sign-in is [http://127.0.0.1:43123/app/login](http://127.0.0.1:43123/app/login). Leave `STAGING_ACCESS_CODE` unset so the gate stays off. The password field starts empty. Type the fixture password. The pitch remains [http://127.0.0.1:43123/](http://127.0.0.1:43123/).

Backup and restore, also refused in production:

```bash
npm run pilot:backup -- pilot-backup.json
npm run pilot:restore -- pilot-backup.json
```

## Tests

```bash
npm run test:pilot
npm run lint
npm run check
npm run build
```

`check` still describes the fictional Westshore book. It does not touch Postgres.
