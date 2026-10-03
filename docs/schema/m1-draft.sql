-- =============================================================================
-- DRAFT — DO NOT APPLY
-- SnapDispatch M1 schema sketch. Not a migration. Not production-ready.
-- =============================================================================
--
-- This file is a draft illustration of a possible Postgres shape for the M1
-- technical workflow checkpoint. It is not ready to apply as a migration.
-- Do not run it against the pitch prototype, staging, or any customer database.
-- There is no migration runner, no version number, and no rollback in this repo.
--
-- Unresolved implementation requirements (still open — do not treat the SQL
-- below as the decision):
--
--   1. RLS policy details. The SELECT policies and security-definer functions
--      later in this file are a sketch. Grants, FORCE ROW LEVEL SECURITY,
--      storage-bucket policies, execute privileges, and whether writes stay
--      inside these functions are not settled.
--   2. Migration strategy. No ordered migrations, expand/contract plan, seed
--      split, or apply/rollback procedure exists. Do not paste this file into
--      a migration tool.
--   3. Indexes TBD. The indexes near the bottom are illustrative only. Which
--      indexes to keep waits on real query shapes. They are not a performance plan.
--   4. Enum and status finalization after discovery. The text checks for
--      status, event_type, and review_status are provisional workflow labels.
--      Load completion, cancellation, the handoff/stage machine, and container
--      empty returns are pre-pilot gates (docs/requirements.md). Do not freeze
--      those labels into a Postgres enum.
--
-- Driver-pay calculations are DISABLED until the customer confirms Q4.
-- No pay_rules table, no ledger, and no function in this file computes pay.
-- loads.customer_rate_cents and documents.amount_cents are typed amounts only.
-- Nothing multiplies them into earnings, contribution, or reimbursement.
--
-- Intended eventual target, once the items above are resolved: Postgres 15+
-- with Supabase Auth (auth.uid / auth.users) and a private storage bucket.
-- That target is a proposal (docs/architecture.md), not an instruction to apply
-- this draft.
--
-- Store timestamps in UTC. display_timezone is the customer-configured IANA zone
-- for input, display, and business-day math. It has no default of America/Los_Angeles.
-- See docs/requirements.md and docs/m1-plan.md.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_timezone text not null,
  synthetic_only boolean not null default false,
  created_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (length(btrim(name)) > 0),
  constraint organizations_timezone_not_blank check (length(btrim(display_timezone)) > 0)
);

comment on column organizations.display_timezone is
  'IANA zone configured for this company. Used to interpret local input and business days. Instants in other tables are UTC.';

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

-- On Supabase, also:
--   alter table profiles
--     add constraint profiles_id_auth_fkey foreign key (id) references auth.users (id);
create table profiles (
  id uuid primary key,
  organization_id uuid not null references organizations (id),
  role text not null,
  driver_id uuid references drivers (id),
  created_at timestamptz not null default now(),
  constraint profiles_role_known check (role in ('owner', 'driver')),
  constraint profiles_driver_role_link check (
    (role = 'driver' and driver_id is not null)
    or (role = 'owner' and driver_id is null)
  )
);

-- Draft index. Indexes are TBD; this one is illustrative, not a migration.
create unique index profiles_one_login_per_driver
  on profiles (organization_id, driver_id)
  where driver_id is not null;

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
  -- Draft labels only. Completion, cancellation, handoffs, and empty return
  -- are not statuses in this checkpoint. Finalize after discovery; do not enum yet.
  status text not null default 'created',
  driver_id uuid references drivers (id),
  truck_id uuid references trucks (id),
  -- Typed amount only. Driver-pay calculations are disabled until Q4.
  -- No default. No formula reads this column.
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
  'Optional owner-entered amount in cents. Typed amount only. Driver-pay calculations are disabled until the customer confirms Q4. Not a tariff and not a pay rule.';

comment on column loads.empty_return_deadline is
  'Optional typed date. Empty return is not a required status in this schema.';

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
  -- Receipt only. Typed amount. Review must not change it, compute pay, or post a ledger.
  amount_cents integer,
  upload_completed_at timestamptz,
  review_status text not null default 'pending',
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  review_note text not null default '',
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
  constraint documents_path_unique unique (storage_bucket, storage_path)
);

comment on table documents is
  'Metadata for a private object. Bytes are not stored in this table. amount_cents is a typed amount only. Driver-pay calculations are disabled. Approval does not create a reimbursement.';

-- Indexes TBD. The four statements below are an illustration, not a migration
-- and not a performance commitment. Revisit after query shapes exist.
create index loads_org_status_idx on loads (organization_id, status);
create index loads_driver_idx on loads (organization_id, driver_id);
create index load_events_load_idx on load_events (load_id, occurred_at);
create index documents_load_idx on documents (load_id);

-- Driver-pay calculations are DISABLED until the customer confirms Q4.
-- No pay_rules table. No ledger_entries table. No function executes a pay formula.
-- Typed amounts only (loads.customer_rate_cents, documents.amount_cents).
-- No invoices table and no empty-return state.

-- ---------------------------------------------------------------------------
-- Caller
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

revoke all on function app_current_profile() from public;

-- ---------------------------------------------------------------------------
-- assign_load — owner, same org.
-- Driver-pay calculations are disabled. This function does not execute a pay formula.
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
  select * into v_actor from app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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
  where id = p_driver_id
    and organization_id = v_actor.organization_id
    and active;

  if v_driver.id is null or v_driver.availability <> 'available' then
    raise exception 'driver_unavailable' using errcode = 'check_violation';
  end if;

  select * into v_truck
  from trucks
  where id = p_truck_id
    and organization_id = v_actor.organization_id
    and active;

  if v_truck.id is null then
    raise exception 'not_found' using errcode = 'no_data_found';
  end if;
  if v_truck.operational <> 'in_service' then
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

revoke all on function assign_load(uuid, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- acknowledge_load — assigned driver, idempotent after acknowledge
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
  select * into v_actor from app_current_profile();
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

revoke all on function acknowledge_load(uuid) from public;

-- ---------------------------------------------------------------------------
-- record_progress — assigned driver after acknowledge
-- Does not require an empty return or a pitch next-step.
-- ---------------------------------------------------------------------------

create or replace function record_progress(
  p_load_id uuid,
  p_note text,
  p_reported_stage text
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
begin
  select * into v_actor from app_current_profile();
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
    from_status, to_status, note, reported_stage
  ) values (
    v_load.organization_id, v_load.id, v_actor.id, 'progress',
    v_from, 'in_progress', btrim(p_note), nullif(btrim(p_reported_stage), '')
  );

  return v_load;
end;
$$;

revoke all on function record_progress(uuid, text, text) from public;

-- ---------------------------------------------------------------------------
-- register_document — assigned driver, after acknowledge.
-- Inserts metadata only. The server then signs a PUT to storage_path.
-- amount_cents is the typed receipt amount. It is not a pay rule.
-- ---------------------------------------------------------------------------

create or replace function register_document(
  p_load_id uuid,
  p_kind text,
  p_file_name text,
  p_mime_type text,
  p_byte_size integer,
  p_amount_cents integer
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
begin
  select * into v_actor from app_current_profile();
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
     or (p_kind = 'receipt' and (p_amount_cents is null or p_amount_cents < 0))
     or (p_kind = 'pod' and p_amount_cents is not null) then
    raise exception 'invalid_document' using errcode = 'check_violation';
  end if;

  v_id := gen_random_uuid();

  insert into documents (
    id, organization_id, load_id, driver_id, uploaded_by, kind,
    file_name, mime_type, byte_size, storage_bucket, storage_path, amount_cents
  ) values (
    v_id,
    v_load.organization_id,
    v_load.id,
    v_load.driver_id,
    v_actor.id,
    p_kind,
    p_file_name,
    p_mime_type,
    p_byte_size,
    'load-files',
    'org/' || v_load.organization_id || '/loads/' || v_load.id || '/' || v_id,
    p_amount_cents
  )
  returning * into v_doc;

  return v_doc;
end;
$$;

revoke all on function register_document(uuid, text, text, text, integer, integer) from public;

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
  select * into v_actor from app_current_profile();
  if v_actor.id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if v_actor.role <> 'driver' then
    raise exception 'forbidden' using errcode = '42501';
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

  return v_doc;
end;
$$;

revoke all on function complete_document_upload(uuid) from public;

-- ---------------------------------------------------------------------------
-- review_document — owner. Does not post money.
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
begin
  select * into v_actor from app_current_profile();
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

  update documents
  set review_status = p_decision,
      reviewed_by = v_actor.id,
      reviewed_at = now(),
      review_note = coalesce(btrim(p_note), '')
  where id = v_doc.id
  returning * into v_doc;

  return v_doc;
end;
$$;

revoke all on function review_document(uuid, text, text) from public;

-- ---------------------------------------------------------------------------
-- Row security — DRAFT SKETCH, not a policy set to apply
-- Unresolved: grants, FORCE ROW LEVEL SECURITY, storage-bucket policies,
-- function execute privileges, and whether these SELECT policies survive
-- discovery. Clients may read in this sketch. Status changes and reviews go
-- through the functions above. Drivers do not get an UPDATE policy on loads
-- or documents in this sketch. Do not ship these policies as-is.
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table drivers enable row level security;
alter table trucks enable row level security;
alter table customers enable row level security;
alter table places enable row level security;
alter table loads enable row level security;
alter table load_events enable row level security;
alter table documents enable row level security;

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

create policy loads_owner_read on loads
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) = 'owner'
  );

create policy loads_driver_read on loads
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and driver_id = (select driver_id from app_current_profile())
  );

create policy load_events_owner_read on load_events
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) = 'owner'
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

create policy documents_owner_read on documents
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and (select role from app_current_profile()) = 'owner'
  );

create policy documents_driver_read on documents
  for select
  using (
    organization_id = (select organization_id from app_current_profile())
    and driver_id = (select driver_id from app_current_profile())
  );
