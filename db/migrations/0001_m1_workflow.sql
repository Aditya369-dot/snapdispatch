-- SnapDispatch M1 technical workflow checkpoint.
-- This is a real migration for the workflow implemented in this repo.
-- It is not a live-customer schema and it is not the draft in docs/schema/m1-draft.sql.
--
-- Pre-pilot requirements still open (docs/requirements.md). Do not treat this
-- file as closing them:
--   * Load completion is not a status. There is no "complete".
--   * Cancellation is not a status and there is no cancel action.
--   * Handoffs / the stage machine are not enforced. Progress is a note plus
--     an optional reported stage string.
--   * Container empty returns are not required. A progress note may mention a
--     return. That note does not change the rules. There is no empty_returned
--     status.
--
-- Driver-pay calculations are DISABLED until the customer confirms Q4.
-- No pay_rules table. No ledger_entries table. No function here executes a
-- pay formula. loads.customer_rate_cents, documents.amount_cents, and
-- expenses.amount_cents are typed amounts only.
-- fixture_pay_examples holds labeled non-production assumptions for the
-- synthetic staging roster. Workflow functions do not read that table.
--
-- Unresolved items that remain (see docs/schema/m1-migration-notes.md):
--   * RLS is enabled with SELECT policies, but the Next.js server connects as
--     a privileged role and enforces ACL inside these functions and queries.
--     FORCE ROW LEVEL SECURITY, PostgREST exposure, and storage-bucket SQL
--     policies are not settled.
--   * auth.users foreign key is not applied. Local sessions set
--     request.jwt.claim.sub. On Supabase, auth.uid() already reads that claim.
--   * Status values stay text checks, not Postgres enums, until discovery.
--   * Indexes below match the checkpoint queries. A broader performance plan
--     is still open.

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

-- Local Postgres has no Supabase auth schema. On Supabase, auth.uid() already
-- exists and also reads request.jwt.claim.sub, so this block does nothing.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create schema if not exists auth;
    execute $fn$
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $body$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $body$
    $fn$;
  end if;
end $$;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_timezone text not null,
  synthetic_only boolean not null default false,
  created_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (length(btrim(name)) > 0),
  constraint organizations_timezone_not_blank check (length(btrim(display_timezone)) > 0)
);

create or replace function organizations_reject_unknown_timezone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.display_timezone) then
    raise exception 'invalid_timezone' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger organizations_timezone_known
  before insert or update of display_timezone on organizations
  for each row
  execute function organizations_reject_unknown_timezone();

comment on column organizations.display_timezone is
  'IANA zone for input, display, and business day. Instants in other tables are UTC. No default zone.';

comment on table organizations is
  'M1 checkpoint tenant. synthetic_only rows are fixture data. Completion, cancellation, handoffs, and empty returns remain pre-pilot requirements.';

create table drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  display_name text not null,
  phone text,
  email text,
  availability text not null default 'available',
  availability_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint drivers_availability_known check (availability in ('available', 'off')),
  constraint drivers_name_not_blank check (length(btrim(display_name)) > 0)
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  unit text not null,
  operational text not null default 'in_service',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint trucks_operational_known check (operational in ('in_service', 'out_of_service')),
  constraint trucks_unit_unique unique (organization_id, unit)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  created_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(btrim(name)) > 0)
);

create table places (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  address_line text,
  created_at timestamptz not null default now(),
  constraint places_name_not_blank check (length(btrim(name)) > 0)
);

-- profiles.id is the session subject. It matches auth.users.id only after a
-- Supabase project is linked. That foreign key is intentionally not created.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  role text not null,
  driver_id uuid references drivers (id),
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_role_known check (role in ('owner', 'driver', 'dispatcher')),
  constraint profiles_driver_role_link check (
    (role = 'driver' and driver_id is not null)
    or (role in ('owner', 'dispatcher') and driver_id is null)
  ),
  constraint profiles_name_not_blank check (length(btrim(display_name)) > 0)
);

comment on column profiles.role is
  'owner and driver are the workflow roles. dispatcher is a proposed office login for the synthetic staging roster: create and assign, not document review. Not a customer-confirmed role (D5).';

create unique index profiles_one_login_per_driver
  on profiles (organization_id, driver_id)
  where driver_id is not null;

-- Local password sessions. Supabase Auth can replace this when configured.
-- The service-role key is never stored here.
create table pilot_credentials (
  profile_id uuid primary key references profiles (id),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  constraint pilot_credentials_email_not_blank check (length(btrim(email)) > 0)
);

create unique index pilot_credentials_email_unique on pilot_credentials (lower(email));

create table loads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  reference text not null,
  container_number text,
  external_reference text,
  customer_id uuid not null references customers (id),
  pickup_place_id uuid not null references places (id),
  destination_place_id uuid not null references places (id),
  appointment_start timestamptz not null,
  appointment_end timestamptz not null,
  last_free_day date,
  empty_return_deadline date,
  cutoff timestamptz,
  -- Provisional labels only. No complete, cancelled, or empty_returned.
  status text not null default 'created',
  driver_id uuid references drivers (id),
  truck_id uuid references trucks (id),
  -- Typed amount only. No default. No formula reads this column.
  customer_rate_cents integer,
  notes text not null default '',
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loads_reference_unique unique (organization_id, reference),
  constraint loads_status_workflow check (
    status in ('created', 'assigned', 'accepted', 'in_progress')
  ),
  constraint loads_appointment_order check (appointment_end > appointment_start),
  constraint loads_rate_unset_or_nonnegative check (
    customer_rate_cents is null or customer_rate_cents >= 0
  ),
  constraint loads_assignment_matches_status check (
    (status = 'created' and driver_id is null and truck_id is null and acknowledged_at is null)
    or (status = 'assigned' and driver_id is not null and truck_id is not null and acknowledged_at is null)
    or (status in ('accepted', 'in_progress') and driver_id is not null and truck_id is not null and acknowledged_at is not null)
  )
);

comment on column loads.customer_rate_cents is
  'Optional owner-entered cents. Typed amount only. Driver-pay calculations are disabled until Q4.';

comment on column loads.empty_return_deadline is
  'Optional typed date. Empty return is not a required status. Q3 and Q18 are open.';

comment on column loads.status is
  'created, assigned, accepted, in_progress only. Completion, cancellation, handoffs, and empty return are pre-pilot requirements and are not statuses.';

create table load_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  load_id uuid not null references loads (id),
  actor_profile_id uuid not null references profiles (id),
  event_type text not null,
  from_status text,
  to_status text not null,
  occurred_at timestamptz not null default now(),
  note text not null default '',
  reported_stage text,
  idempotency_key text,
  constraint load_events_type_workflow check (
    event_type in ('created', 'assigned', 'acknowledged', 'progress')
  ),
  constraint load_events_to_status_workflow check (
    to_status in ('created', 'assigned', 'accepted', 'in_progress')
  ),
  constraint load_events_stage_length check (
    reported_stage is null or char_length(reported_stage) <= 80
  )
);

create unique index load_events_idempotency_idx
  on load_events (organization_id, actor_profile_id, idempotency_key)
  where idempotency_key is not null;

create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  load_id uuid not null references loads (id),
  driver_id uuid not null references drivers (id),
  uploaded_by uuid not null references profiles (id),
  kind text not null,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_bucket text not null,
  storage_path text not null,
  -- Receipt only. Typed amount. Review must not change it or post a ledger.
  amount_cents integer,
  upload_completed_at timestamptz,
  review_status text not null default 'pending',
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  review_note text not null default '',
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint documents_kind_workflow check (kind in ('receipt', 'pod')),
  constraint documents_mime_workflow check (
    mime_type in ('image/jpeg', 'image/png', 'application/pdf')
  ),
  constraint documents_size_workflow check (byte_size between 1 and 10485760),
  constraint documents_review_workflow check (review_status in ('pending', 'approved', 'rejected')),
  constraint documents_amount_by_kind check (
    (kind = 'receipt' and amount_cents is not null and amount_cents >= 0)
    or (kind = 'pod' and amount_cents is null)
  ),
  constraint documents_path_unique unique (storage_bucket, storage_path),
  constraint documents_file_name_not_blank check (length(btrim(file_name)) > 0)
);

create unique index documents_idempotency_idx
  on documents (organization_id, uploaded_by, idempotency_key)
  where idempotency_key is not null;

comment on table documents is
  'Metadata for a private object. Bytes are not stored here. amount_cents is a typed amount. Approval does not create a reimbursement. Upload is not complete until the server has confirmed the object.';

-- Typed amounts only. Not earnings. Review does not insert into this table.
create table expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  load_id uuid references loads (id),
  driver_id uuid references drivers (id),
  document_id uuid unique references documents (id),
  created_by uuid not null references profiles (id),
  amount_cents integer not null,
  corrected_amount_cents integer,
  memo text not null default '',
  source text not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint expenses_amount_nonnegative check (amount_cents >= 0),
  constraint expenses_corrected_nonnegative check (
    corrected_amount_cents is null or corrected_amount_cents >= 0
  ),
  constraint expenses_source_known check (source in ('receipt', 'typed'))
);

create unique index expenses_idempotency_idx
  on expenses (organization_id, created_by, idempotency_key)
  where idempotency_key is not null;

comment on table expenses is
  'Typed amounts only. Not driver earnings. Repeated submissions with the same idempotency key do not insert another row. Driver-pay calculations are disabled.';

create table expense_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  expense_id uuid not null references expenses (id),
  actor_profile_id uuid not null references profiles (id),
  previous_amount_cents integer not null,
  amount_cents integer not null,
  note text not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint expense_corrections_amount_nonnegative check (amount_cents >= 0),
  constraint expense_corrections_note_not_blank check (length(btrim(note)) > 0)
);

create unique index expense_corrections_idempotency_idx
  on expense_corrections (expense_id, idempotency_key)
  where idempotency_key is not null;

comment on table expense_corrections is
  'Append-only correction of a typed amount. Does not post pay, does not change documents.amount_cents, and does not create a ledger. Q4 and Q5 are open.';

create table mileage_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  truck_id uuid not null references trucks (id),
  driver_id uuid not null references drivers (id),
  load_id uuid references loads (id),
  miles numeric(10, 1) not null,
  reported_on date not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint mileage_reports_miles_range check (miles >= 0 and miles <= 2000),
  constraint mileage_reports_idempotency unique (organization_id, driver_id, idempotency_key)
);

comment on table mileage_reports is
  'Driver-reported miles. Not an ELD feed. Repeated submissions with the same key do not insert another row.';

create table maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  truck_id uuid not null references trucks (id),
  title text not null,
  due_on date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint maintenance_reminders_title_not_blank check (length(btrim(title)) > 0)
);

comment on table maintenance_reminders is
  'Synthetic reminders for the staging roster. Not a maintenance program and not IFTA.';

-- Labeled assumptions for the staging roster display. non_production cannot be false.
create table fixture_pay_examples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  label text not null,
  assumption_note text not null,
  example_amount_cents integer,
  non_production boolean not null default true,
  created_at timestamptz not null default now(),
  constraint fixture_pay_examples_must_be_non_production check (non_production),
  constraint fixture_pay_examples_amount_nonnegative check (
    example_amount_cents is null or example_amount_cents >= 0
  )
);

comment on table fixture_pay_examples is
  'Fixture-only pay illustrations. Not a pay formula. No workflow function reads this table to compute pay. Disabled until the customer confirms Q4.';

-- Indexes for the checkpoint queries. Not a finished performance plan.
create index loads_org_status_idx on loads (organization_id, status);
create index loads_driver_idx on loads (organization_id, driver_id);
create index loads_appointment_idx on loads (organization_id, appointment_start, appointment_end);
create index load_events_load_idx on load_events (load_id, occurred_at);
create index documents_load_idx on documents (load_id);
create index mileage_truck_idx on mileage_reports (organization_id, truck_id);
create index maintenance_due_idx on maintenance_reminders (organization_id, due_on);

-- ---------------------------------------------------------------------------
-- Caller. Reads the session subject set by the server for this transaction.
-- ---------------------------------------------------------------------------

create or replace function app_current_profile()
returns profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from profiles p
  where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- create_load — owner or dispatcher, same organization.
-- Does not compute pay. Does not require an empty return.
-- ---------------------------------------------------------------------------

create or replace function create_load(
  p_reference text,
  p_container_number text,
  p_external_reference text,
  p_customer_id uuid,
  p_pickup_place_id uuid,
  p_destination_place_id uuid,
  p_appointment_start timestamptz,
  p_appointment_end timestamptz,
  p_last_free_day date,
  p_empty_return_deadline date,
  p_cutoff timestamptz,
  p_customer_rate_cents integer,
  p_notes text
)
returns loads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_load loads;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role not in ('owner', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reference is null or length(btrim(p_reference)) = 0
     or p_customer_id is null
     or p_pickup_place_id is null
     or p_destination_place_id is null
     or p_appointment_start is null
     or p_appointment_end is null
     or p_appointment_end <= p_appointment_start then
    raise exception 'invalid_load' using errcode = 'check_violation';
  end if;
  if p_customer_rate_cents is not null and p_customer_rate_cents < 0 then
    raise exception 'invalid_rate' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from customers
    where id = p_customer_id and organization_id = v_actor.organization_id
  ) or not exists (
    select 1 from places
    where id = p_pickup_place_id and organization_id = v_actor.organization_id
  ) or not exists (
    select 1 from places
    where id = p_destination_place_id and organization_id = v_actor.organization_id
  ) then
    raise exception 'invalid_load' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from loads
    where organization_id = v_actor.organization_id and reference = btrim(p_reference)
  ) then
    raise exception 'duplicate_reference' using errcode = 'unique_violation';
  end if;

  insert into loads (
    organization_id, reference, container_number, external_reference,
    customer_id, pickup_place_id, destination_place_id,
    appointment_start, appointment_end, last_free_day, empty_return_deadline,
    cutoff, status, customer_rate_cents, notes
  ) values (
    v_actor.organization_id,
    btrim(p_reference),
    nullif(btrim(p_container_number), ''),
    nullif(btrim(p_external_reference), ''),
    p_customer_id,
    p_pickup_place_id,
    p_destination_place_id,
    p_appointment_start,
    p_appointment_end,
    p_last_free_day,
    p_empty_return_deadline,
    p_cutoff,
    'created',
    p_customer_rate_cents,
    coalesce(p_notes, '')
  )
  returning * into v_load;

  insert into load_events (
    organization_id, load_id, actor_profile_id, event_type, from_status, to_status, occurred_at
  ) values (
    v_load.organization_id, v_load.id, v_actor.id, 'created', null, 'created', v_load.created_at
  );

  return v_load;
end;
$$;

-- ---------------------------------------------------------------------------
-- assign_load — owner or dispatcher.
-- Locks the driver and the truck for this transaction, then locks the load.
-- That closes the overlap race the draft's single-row lock left open.
-- Does not execute a pay formula and does not write a ledger.
-- Reassign is allowed while status is assigned. Refused after acknowledge.
-- ---------------------------------------------------------------------------

create or replace function assign_load(
  p_load_id uuid,
  p_driver_id uuid,
  p_truck_id uuid
)
returns loads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_load loads;
  v_driver drivers;
  v_truck trucks;
  v_from text;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role not in ('owner', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('driver:' || p_driver_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('truck:' || p_truck_id::text, 0));

  select * into v_load
  from loads
  where id = p_load_id and organization_id = v_actor.organization_id
  for update;

  if v_load.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if v_load.status not in ('created', 'assigned') then
    raise exception 'load_not_assignable' using errcode = 'check_violation';
  end if;

  select * into v_driver
  from drivers
  where id = p_driver_id and organization_id = v_actor.organization_id;

  if v_driver.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if (not v_driver.active) or v_driver.availability <> 'available' then
    raise exception 'driver_unavailable' using errcode = 'check_violation';
  end if;

  select * into v_truck
  from trucks
  where id = p_truck_id and organization_id = v_actor.organization_id;

  if v_truck.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if (not v_truck.active) or v_truck.operational <> 'in_service' then
    raise exception 'truck_out_of_service' using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from loads other
    where other.organization_id = v_load.organization_id
      and other.id <> v_load.id
      and other.status in ('assigned', 'accepted', 'in_progress')
      and (other.driver_id = p_driver_id or other.truck_id = p_truck_id)
      and v_load.appointment_start < other.appointment_end
      and other.appointment_start < v_load.appointment_end
  ) then
    raise exception 'appointment_overlap' using errcode = 'exclusion_violation';
  end if;

  v_from := v_load.status;

  update loads
  set driver_id = p_driver_id,
      truck_id = p_truck_id,
      status = 'assigned',
      updated_at = now()
  where id = v_load.id
  returning * into v_load;

  insert into load_events (
    organization_id, load_id, actor_profile_id, event_type, from_status, to_status
  ) values (
    v_load.organization_id, v_load.id, v_actor.id, 'assigned', v_from, 'assigned'
  );

  return v_load;
end;
$$;

-- ---------------------------------------------------------------------------
-- acknowledge_load — assigned driver. Idempotent after the first acknowledge.
-- ---------------------------------------------------------------------------

create or replace function acknowledge_load(p_load_id uuid)
returns loads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_load loads;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'driver' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_load
  from loads
  where id = p_load_id and organization_id = v_actor.organization_id
  for update;

  if v_load.id is null or v_load.driver_id is distinct from v_actor.driver_id then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;

  if v_load.status in ('accepted', 'in_progress') then
    return v_load;
  end if;
  if v_load.status <> 'assigned' then
    raise exception 'not_acknowledged' using errcode = 'check_violation';
  end if;

  update loads
  set status = 'accepted',
      acknowledged_at = now(),
      updated_at = now()
  where id = v_load.id
  returning * into v_load;

  insert into load_events (
    organization_id, load_id, actor_profile_id, event_type, from_status, to_status, occurred_at
  ) values (
    v_load.organization_id,
    v_load.id,
    v_actor.id,
    'acknowledged',
    'assigned',
    'accepted',
    v_load.acknowledged_at
  );

  return v_load;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_progress — assigned driver after acknowledge.
-- Does not require an empty return or a pitch next-step.
-- reported_stage is free text, including an optional container-return label.
-- That label is not a status change. A second call without an idempotency key
-- appends another event. The same key returns the existing state.
-- ---------------------------------------------------------------------------

create or replace function record_progress(
  p_load_id uuid,
  p_note text,
  p_reported_stage text,
  p_idempotency_key text
)
returns loads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_load loads;
  v_from text;
  v_existing uuid;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'driver' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'invalid_progress' using errcode = 'check_violation';
  end if;
  if p_reported_stage is not null and char_length(p_reported_stage) > 80 then
    raise exception 'invalid_progress' using errcode = 'check_violation';
  end if;

  select * into v_load
  from loads
  where id = p_load_id and organization_id = v_actor.organization_id
  for update;

  if v_load.id is null or v_load.driver_id is distinct from v_actor.driver_id then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    select id into v_existing
    from load_events
    where organization_id = v_actor.organization_id
      and actor_profile_id = v_actor.id
      and idempotency_key = btrim(p_idempotency_key);
    if v_existing is not null then
      return v_load;
    end if;
  end if;

  if v_load.status not in ('accepted', 'in_progress') then
    raise exception 'not_ready' using errcode = 'check_violation';
  end if;

  v_from := v_load.status;

  update loads
  set status = 'in_progress',
      updated_at = now()
  where id = v_load.id
  returning * into v_load;

  insert into load_events (
    organization_id, load_id, actor_profile_id, event_type,
    from_status, to_status, note, reported_stage, idempotency_key
  ) values (
    v_load.organization_id,
    v_load.id,
    v_actor.id,
    'progress',
    v_from,
    'in_progress',
    btrim(p_note),
    nullif(btrim(p_reported_stage), ''),
    nullif(btrim(p_idempotency_key), '')
  );

  return v_load;
end;
$$;

-- ---------------------------------------------------------------------------
-- register_document — assigned driver, after acknowledge.
-- Metadata only. The server signs a PUT after this row exists.
-- The same idempotency key returns the existing row and does not insert again.
-- ---------------------------------------------------------------------------

create or replace function register_document(
  p_load_id uuid,
  p_kind text,
  p_file_name text,
  p_mime_type text,
  p_byte_size integer,
  p_amount_cents integer,
  p_idempotency_key text
)
returns documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_load loads;
  v_doc documents;
  v_id uuid;
  v_key text;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'driver' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_load
  from loads
  where id = p_load_id and organization_id = v_actor.organization_id
  for update;

  if v_load.id is null or v_load.driver_id is distinct from v_actor.driver_id then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if v_load.status not in ('accepted', 'in_progress') then
    raise exception 'not_ready' using errcode = 'check_violation';
  end if;
  if p_kind not in ('receipt', 'pod')
     or p_mime_type not in ('image/jpeg', 'image/png', 'application/pdf')
     or p_byte_size is null
     or p_byte_size < 1
     or p_byte_size > 10485760
     or p_file_name is null
     or length(btrim(p_file_name)) = 0
     or p_file_name like '%/%'
     or p_file_name like '%\%'
     or (p_kind = 'receipt' and (p_amount_cents is null or p_amount_cents < 0))
     or (p_kind = 'pod' and p_amount_cents is not null) then
    raise exception 'invalid_document' using errcode = 'check_violation';
  end if;

  v_key := nullif(btrim(p_idempotency_key), '');
  if v_key is not null then
    select * into v_doc
    from documents
    where organization_id = v_actor.organization_id
      and uploaded_by = v_actor.id
      and idempotency_key = v_key;
    if v_doc.id is not null then
      if v_doc.load_id is distinct from p_load_id
         or v_doc.kind is distinct from p_kind
         or v_doc.mime_type is distinct from p_mime_type
         or v_doc.byte_size is distinct from p_byte_size
         or v_doc.amount_cents is distinct from p_amount_cents
         or v_doc.file_name is distinct from btrim(p_file_name) then
        raise exception 'idempotency_conflict' using errcode = 'unique_violation';
      end if;
      return v_doc;
    end if;
  end if;

  v_id := gen_random_uuid();

  insert into documents (
    id, organization_id, load_id, driver_id, uploaded_by, kind,
    file_name, mime_type, byte_size, storage_bucket, storage_path,
    amount_cents, idempotency_key
  ) values (
    v_id,
    v_load.organization_id,
    v_load.id,
    v_load.driver_id,
    v_actor.id,
    p_kind,
    btrim(p_file_name),
    p_mime_type,
    p_byte_size,
    'load-files',
    'org/' || v_load.organization_id || '/loads/' || v_load.id || '/' || v_id,
    p_amount_cents,
    v_key
  )
  returning * into v_doc;

  return v_doc;
end;
$$;

-- Marks the row stored only when the server has set app.storage_confirmed
-- in this transaction after checking the private object. Does not review
-- and does not post pay. A receipt inserts one typed expense row.
create or replace function complete_document_upload(p_document_id uuid)
returns documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_doc documents;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'driver' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if current_setting('app.storage_confirmed', true) is distinct from 'on' then
    raise exception 'upload_missing' using errcode = 'no_data_found';
  end if;

  select * into v_doc
  from documents
  where id = p_document_id
    and organization_id = v_actor.organization_id
    and driver_id = v_actor.driver_id
  for update;

  if v_doc.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;

  update documents
  set upload_completed_at = coalesce(upload_completed_at, now())
  where id = v_doc.id
  returning * into v_doc;

  if v_doc.kind = 'receipt' and not exists (
    select 1 from expenses where document_id = v_doc.id
  ) then
    insert into expenses (
      organization_id, load_id, driver_id, document_id, created_by,
      amount_cents, memo, source
    ) values (
      v_doc.organization_id,
      v_doc.load_id,
      v_doc.driver_id,
      v_doc.id,
      v_actor.id,
      v_doc.amount_cents,
      'Receipt',
      'receipt'
    );
  end if;

  return v_doc;
end;
$$;

-- ---------------------------------------------------------------------------
-- review_document — owner only. Does not change amount_cents and does not
-- insert an expense, a correction, a ledger row, or a pay example.
-- ---------------------------------------------------------------------------

create or replace function review_document(
  p_document_id uuid,
  p_decision text,
  p_note text
)
returns documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_doc documents;
  v_amount integer;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_document' using errcode = 'check_violation';
  end if;
  if p_decision = 'rejected' and (p_note is null or length(btrim(p_note)) = 0) then
    raise exception 'invalid_document' using errcode = 'check_violation';
  end if;

  select * into v_doc
  from documents
  where id = p_document_id and organization_id = v_actor.organization_id
  for update;

  if v_doc.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if v_doc.upload_completed_at is null then
    raise exception 'not_ready' using errcode = 'check_violation';
  end if;

  v_amount := v_doc.amount_cents;

  update documents
  set review_status = p_decision,
      reviewed_by = v_actor.id,
      reviewed_at = now(),
      review_note = coalesce(btrim(p_note), '')
  where id = v_doc.id
  returning * into v_doc;

  if v_doc.amount_cents is distinct from v_amount then
    raise exception 'invalid_document' using errcode = 'check_violation';
  end if;

  return v_doc;
end;
$$;

-- Typed expense. Idempotent per actor and key. Not earnings.
create or replace function create_typed_expense(
  p_amount_cents integer,
  p_memo text,
  p_load_id uuid,
  p_idempotency_key text
)
returns expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_expense expenses;
  v_key text;
  v_driver uuid;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role not in ('owner', 'driver', 'dispatcher') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_key := nullif(btrim(p_idempotency_key), '');
  if v_key is null or p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid_expense' using errcode = 'check_violation';
  end if;
  if p_load_id is not null and not exists (
    select 1 from loads
    where id = p_load_id
      and organization_id = v_actor.organization_id
      and (
        v_actor.role in ('owner', 'dispatcher')
        or driver_id = v_actor.driver_id
      )
  ) then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;

  select * into v_expense
  from expenses
  where organization_id = v_actor.organization_id
    and created_by = v_actor.id
    and idempotency_key = v_key;
  if v_expense.id is not null then
    if v_expense.amount_cents is distinct from p_amount_cents
       or v_expense.load_id is distinct from p_load_id then
      raise exception 'idempotency_conflict' using errcode = 'unique_violation';
    end if;
    return v_expense;
  end if;

  v_driver := case when v_actor.role = 'driver' then v_actor.driver_id else null end;

  insert into expenses (
    organization_id, load_id, driver_id, created_by, amount_cents, memo, source, idempotency_key
  ) values (
    v_actor.organization_id,
    p_load_id,
    v_driver,
    v_actor.id,
    p_amount_cents,
    coalesce(btrim(p_memo), ''),
    'typed',
    v_key
  )
  returning * into v_expense;

  return v_expense;
end;
$$;

-- Owner correction of a typed amount. Does not change documents.amount_cents
-- and does not post pay. The same idempotency key does not insert twice.
create or replace function correct_expense(
  p_expense_id uuid,
  p_amount_cents integer,
  p_note text,
  p_idempotency_key text
)
returns expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_expense expenses;
  v_previous integer;
  v_key text;
  v_existing expense_corrections;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < 0
     or p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'invalid_correction' using errcode = 'check_violation';
  end if;

  select * into v_expense
  from expenses
  where id = p_expense_id and organization_id = v_actor.organization_id
  for update;

  if v_expense.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;

  v_key := nullif(btrim(p_idempotency_key), '');
  if v_key is not null then
    select * into v_existing
    from expense_corrections
    where expense_id = v_expense.id and idempotency_key = v_key;
    if v_existing.id is not null then
      if v_existing.amount_cents is distinct from p_amount_cents then
        raise exception 'idempotency_conflict' using errcode = 'unique_violation';
      end if;
      return v_expense;
    end if;
  end if;

  v_previous := coalesce(v_expense.corrected_amount_cents, v_expense.amount_cents);

  insert into expense_corrections (
    organization_id, expense_id, actor_profile_id, previous_amount_cents,
    amount_cents, note, idempotency_key
  ) values (
    v_expense.organization_id,
    v_expense.id,
    v_actor.id,
    v_previous,
    p_amount_cents,
    btrim(p_note),
    v_key
  );

  update expenses
  set corrected_amount_cents = p_amount_cents
  where id = v_expense.id
  returning * into v_expense;

  return v_expense;
end;
$$;

create or replace function record_mileage(
  p_truck_id uuid,
  p_load_id uuid,
  p_miles numeric,
  p_reported_on date,
  p_idempotency_key text
)
returns mileage_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor profiles;
  v_row mileage_reports;
  v_key text;
begin
  v_actor := app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'driver' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_key := nullif(btrim(p_idempotency_key), '');
  if v_key is null or p_miles is null or p_miles < 0 or p_miles > 2000 or p_reported_on is null then
    raise exception 'invalid_mileage' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from trucks
    where id = p_truck_id and organization_id = v_actor.organization_id
  ) then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if p_load_id is not null and not exists (
    select 1 from loads
    where id = p_load_id
      and organization_id = v_actor.organization_id
      and driver_id = v_actor.driver_id
  ) then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;

  select * into v_row
  from mileage_reports
  where organization_id = v_actor.organization_id
    and driver_id = v_actor.driver_id
    and idempotency_key = v_key;
  if v_row.id is not null then
    if v_row.miles is distinct from p_miles or v_row.truck_id is distinct from p_truck_id then
      raise exception 'idempotency_conflict' using errcode = 'unique_violation';
    end if;
    return v_row;
  end if;

  insert into mileage_reports (
    organization_id, truck_id, driver_id, load_id, miles, reported_on, idempotency_key
  ) values (
    v_actor.organization_id,
    p_truck_id,
    v_actor.driver_id,
    p_load_id,
    p_miles,
    p_reported_on,
    v_key
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Refuses fixture reset unless the server explicitly armed this transaction
-- and every organization already stored is synthetic. Production data that
-- fails the name check cannot be truncated by the loader.
create or replace function assert_can_reset_synthetic()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.allow_reset', true) is distinct from 'yes' then
    raise exception 'staging_refused' using errcode = '42501';
  end if;
  if exists (
    select 1 from organizations
    where synthetic_only is distinct from true
       or name not like 'Synthetic%'
  ) then
    raise exception 'staging_refused' using errcode = '42501';
  end if;
end;
$$;

revoke all on function auth.uid() from public;
revoke all on function app_current_profile() from public;
revoke all on function create_load(text, text, text, uuid, uuid, uuid, timestamptz, timestamptz, date, date, timestamptz, integer, text) from public;
revoke all on function assign_load(uuid, uuid, uuid) from public;
revoke all on function acknowledge_load(uuid) from public;
revoke all on function record_progress(uuid, text, text, text) from public;
revoke all on function register_document(uuid, text, text, text, integer, integer, text) from public;
revoke all on function complete_document_upload(uuid) from public;
revoke all on function review_document(uuid, text, text) from public;
revoke all on function create_typed_expense(integer, text, uuid, text) from public;
revoke all on function correct_expense(uuid, integer, text, text) from public;
revoke all on function record_mileage(uuid, uuid, numeric, date, text) from public;
revoke all on function assert_can_reset_synthetic() from public;

-- Row security is installed so a future non-privileged role cannot read
-- across companies. The checkpoint server does not rely on these policies:
-- it connects with a privileged DATABASE_URL and calls the functions above.
-- See docs/schema/m1-migration-notes.md. Do not expose these tables through
-- the Supabase Data API until that note is resolved.

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table drivers enable row level security;
alter table trucks enable row level security;
alter table customers enable row level security;
alter table places enable row level security;
alter table loads enable row level security;
alter table load_events enable row level security;
alter table documents enable row level security;
alter table expenses enable row level security;
alter table expense_corrections enable row level security;
alter table mileage_reports enable row level security;
alter table maintenance_reminders enable row level security;
alter table fixture_pay_examples enable row level security;
alter table pilot_credentials enable row level security;

create policy organizations_member_read on organizations
  for select
  using (id = (select organization_id from app_current_profile()));

create policy profiles_member_read on profiles
  for select
  using (organization_id = (select organization_id from app_current_profile()));

create policy drivers_member_read on drivers
  for select
  using (organization_id = (select organization_id from app_current_profile()));

create policy trucks_member_read on trucks
  for select
  using (organization_id = (select organization_id from app_current_profile()));

create policy customers_member_read on customers
  for select
  using (organization_id = (select organization_id from app_current_profile()));

create policy places_member_read on places
  for select
  using (organization_id = (select organization_id from app_current_profile()));

create policy loads_office_read on loads
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) in ('owner', 'dispatcher')
  );

create policy loads_driver_read on loads
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and driver_id = (select driver_id from app_current_profile())
  );

create policy load_events_office_read on load_events
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) in ('owner', 'dispatcher')
  );

create policy load_events_driver_read on load_events
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and exists (
      select 1
      from loads
      where loads.id = load_events.load_id
        and loads.driver_id = (select driver_id from app_current_profile())
    )
  );

create policy documents_office_read on documents
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) in ('owner', 'dispatcher')
  );

create policy documents_driver_read on documents
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and driver_id = (select driver_id from app_current_profile())
  );

create policy expenses_office_read on expenses
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) in ('owner', 'dispatcher')
  );

create policy expenses_driver_read on expenses
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (
      driver_id = (select driver_id from app_current_profile())
      or created_by = (select id from app_current_profile())
    )
  );

create policy expense_corrections_office_read on expense_corrections
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) in ('owner', 'dispatcher')
  );

create policy mileage_member_read on mileage_reports
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (
      (select role from app_current_profile()) in ('owner', 'dispatcher')
      or driver_id = (select driver_id from app_current_profile())
    )
  );

create policy maintenance_member_read on maintenance_reminders
  for select
  using (organization_id = (select organization_id from app_current_profile()));

create policy pay_examples_member_read on fixture_pay_examples
  for select
  using (organization_id = (select organization_id from app_current_profile()));

-- No policy on pilot_credentials. Password hashes are server-only.
-- No INSERT, UPDATE, or DELETE policies. Clients cannot patch status.

revoke all on all tables in schema public from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all functions in schema public from authenticated';
  end if;
end $$;
