-- Tidyo · schema
-- Multi-tenant: every business row carries company_id. Access rules live in the next migration.
-- Money is stored in integer cents (USD). Times are timestamptz; each company has its own timezone.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── Types ─────────────────────────
create type public.company_mode     as enum ('residential', 'commercial', 'both');
create type public.app_language     as enum ('pt-BR', 'en', 'es');
create type public.member_role      as enum ('owner', 'manager', 'helper');
create type public.member_status    as enum ('invited', 'active', 'suspended', 'removed');
create type public.plan_code        as enum ('essencial', 'pro', 'comercial');
create type public.billing_interval as enum ('month', 'year');
create type public.sub_status       as enum ('trialing', 'active', 'past_due', 'paused', 'canceled');
create type public.client_kind      as enum ('residential', 'commercial');
create type public.job_status       as enum ('scheduled', 'in_progress', 'completed', 'canceled', 'no_show');
create type public.rating_status    as enum ('pending', 'rated', 'auto_approved');
create type public.photo_kind       as enum ('before', 'after', 'issue', 'inspection');
create type public.expense_category as enum ('gas', 'mileage', 'supplies', 'parking', 'tolls', 'equipment', 'other');
create type public.approval_status  as enum ('pending', 'approved', 'rejected', 'reimbursed');
create type public.invoice_status   as enum ('draft', 'open', 'paid', 'void', 'uncollectible');
create type public.payment_method   as enum ('card', 'ach', 'zelle', 'venmo', 'check', 'cash', 'other');
create type public.contract_status  as enum ('proposal', 'active', 'paused', 'ended');
create type public.insight_severity as enum ('urgent', 'attention', 'info');
create type public.insight_status   as enum ('open', 'resolved', 'dismissed');
create type public.ad_format        as enum ('top_banner', 'cta_card', 'popup', 'fullscreen');
create type public.ad_status        as enum ('draft', 'scheduled', 'running', 'paused', 'ended');
create type public.ticket_status    as enum ('open', 'waiting_customer', 'resolved');

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ───────────────────────── People and companies ─────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  language    public.app_language not null default 'en',
  avatar_path text,
  marketing_opt_in_at timestamptz,          -- TCPA consent, unchecked by default in signup
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 1 and 120),
  mode             public.company_mode not null default 'residential',
  solo             boolean not null default false,   -- owner also does the cleaning: home shows "Meu dia"
  timezone         text not null default 'America/New_York',
  default_language public.app_language not null default 'en',
  state            text,                             -- US state, used for tax and breach-notice rules
  logo_path        text,
  invoice_prefix   text not null default 'INV',
  next_invoice_no  integer not null default 1001,
  stripe_customer_id         text unique,
  stripe_connect_account_id  text unique,          -- receives client payments
  -- push to team/clients is off by default and must be enabled by the owner
  allow_push_team    boolean not null default false,
  allow_push_clients boolean not null default false,
  cancellation_fee_cents integer not null default 0 check (cancellation_fee_cents >= 0),
  cancellation_window_hours integer not null default 24 check (cancellation_window_hours between 0 and 168),
  is_demo_data     boolean not null default false,  -- sample data from "Primeiros passos"
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,   -- null while invite is pending
  role        public.member_role not null,
  status      public.member_status not null default 'invited',
  display_name text not null,
  language    public.app_language not null default 'en',
  invite_token_hash text,                          -- sha256 of the WhatsApp/SMS invite link token
  invite_expires_at timestamptz,
  -- route origin (home or base) for route optimisation
  origin_address text,
  origin_lat  double precision,
  origin_lng  double precision,
  permissions jsonb not null default '{}'::jsonb,  -- fine-grained toggles shown in "Equipe e permissões"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, user_id)
);
create index on public.memberships (user_id) where status = 'active';

-- pay is visible to owners/managers only, so it lives outside memberships
create table public.member_pay_rates (
  membership_id uuid primary key references public.memberships(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  hourly_cents  integer not null check (hourly_cents >= 0),
  per_job_cents integer check (per_job_cents >= 0),
  effective_from date not null default current_date
);

create table public.subscriptions (
  company_id   uuid primary key references public.companies(id) on delete cascade,
  plan         public.plan_code not null default 'pro',
  has_commercial boolean not null default false,   -- Comercial add-on (combo = pro + commercial, 20% off)
  commercial_tier smallint check (commercial_tier between 1 and 4), -- 1: ≤5, 2: 6–15, 3: 16–40, 4: custom
  interval     public.billing_interval not null default 'month',
  status       public.sub_status not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  paused_until date,
  stripe_subscription_id text unique,
  utm          jsonb not null default '{}'::jsonb, -- acquisition source captured at signup
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── Clients and properties ─────────────────────────
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  kind         public.client_kind not null default 'residential',
  name         text not null,
  contact_name text,
  email        text,
  phone        text,
  language     public.app_language not null default 'en',
  no_translate boolean not null default false,     -- "Não traduzir": send messages as written
  portal_user_id uuid references auth.users(id) on delete set null,
  cancellation_policy_accepted_at timestamptz,
  stripe_customer_id text,
  notes        text,                               -- internal, never shown to helpers or the client
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.clients (company_id) where archived_at is null;
create index on public.clients (portal_user_id);

create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  label       text not null default 'Principal',
  address_line1 text not null,
  address_line2 text,
  city        text not null,
  state       text not null,
  zip         text not null,
  lat         double precision,
  lng         double precision,
  -- shown to the assigned helper, in the helper's language
  access_instructions  text,   -- gate code, key box, alarm
  pets                 text,
  special_instructions text,
  bedrooms    smallint,
  bathrooms   numeric(3,1),
  square_feet integer,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.properties (company_id, client_id);

-- ───────────────────────── Services and checklists ─────────────────────────
create table public.checklist_templates (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.checklist_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  room        text not null,
  task        text not null,
  position    integer not null default 0
);

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,                       -- Standard, Deep clean, Move-out, Office nightly…
  kind        public.client_kind not null default 'residential',
  default_price_cents integer not null default 0 check (default_price_cents >= 0),
  default_duration_min integer not null default 120 check (default_duration_min > 0),
  checklist_template_id uuid references public.checklist_templates(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── Commercial contracts ─────────────────────────
create table public.contracts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  status       public.contract_status not null default 'proposal',
  monthly_value_cents integer not null check (monthly_value_cents >= 0),
  hours_per_week numeric(6,2),                     -- contracted hours, compared with punched hours
  starts_on    date,
  renews_on    date,
  last_adjusted_on date,                           -- Tidy flags long periods without a price adjustment
  walkthrough  jsonb not null default '{}'::jsonb, -- rooms, sq ft, frequency used in the estimate
  geofence_radius_m integer not null default 150 check (geofence_radius_m between 25 and 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.contracts (company_id, status);

-- ───────────────────────── Scheduling ─────────────────────────
create table public.recurrences (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  service_id  uuid references public.services(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete cascade,
  rrule       text not null,                       -- RFC 5545, e.g. FREQ=WEEKLY;INTERVAL=2;BYDAY=FR
  start_time  time not null,
  duration_min integer not null check (duration_min > 0),
  starts_on   date not null,
  ends_on     date,
  price_cents integer not null default 0 check (price_cents >= 0),
  default_member_ids uuid[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  service_id    uuid references public.services(id) on delete set null,
  recurrence_id uuid references public.recurrences(id) on delete set null,
  contract_id   uuid references public.contracts(id) on delete set null,
  status        public.job_status not null default 'scheduled',
  scheduled_start timestamptz not null,
  scheduled_end   timestamptz not null,
  route_position  smallint,                        -- order in the helper's day after optimisation
  price_cents   integer not null default 0 check (price_cents >= 0),
  client_notes  text,                              -- requests from the client for this visit
  internal_notes text,                             -- owner only
  started_at    timestamptz,
  completed_at  timestamptz,
  completion_note text,
  signature_path text,                             -- optional client signature
  rating_status public.rating_status not null default 'pending',
  rating        smallint check (rating between 1 and 5),
  rating_comment text,
  rating_due_at timestamptz,                       -- completed_at + 24h, then auto-approved as positive
  canceled_at   timestamptz,
  cancellation_fee_cents integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (scheduled_end > scheduled_start)
);
create index on public.jobs (company_id, scheduled_start);
create index on public.jobs (client_id, scheduled_start desc);
create index on public.jobs (rating_due_at) where rating_status = 'pending';

create table public.job_assignments (
  job_id        uuid not null references public.jobs(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  is_lead       boolean not null default false,
  primary key (job_id, membership_id)
);
create index on public.job_assignments (membership_id);

create table public.job_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  room       text not null,
  task       text not null,
  position   integer not null default 0,
  done_at    timestamptz,
  done_by    uuid references public.memberships(id) on delete set null,
  note       text
);
create index on public.job_checklist_items (job_id);

create table public.job_photos (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  kind        public.photo_kind not null,
  room        text,
  storage_path text not null,                      -- bucket job-photos: {company_id}/{job_id}/{uuid}.jpg
  taken_at    timestamptz not null default now(),
  lat         double precision,
  lng         double precision,
  uploaded_by uuid references public.memberships(id) on delete set null
);
create index on public.job_photos (job_id);

create table public.job_issues (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  reported_by uuid references public.memberships(id) on delete set null,
  category    text not null,                       -- damage, no_access, supplies, client_request, other
  description text not null,
  photo_id    uuid references public.job_photos(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── Team time, tips and expenses ─────────────────────────
create table public.time_entries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  clock_in      timestamptz not null,
  clock_out     timestamptz,
  in_lat  double precision, in_lng  double precision,
  out_lat double precision, out_lng double precision,
  inside_geofence boolean,                         -- commercial punch check
  source        text not null default 'app' check (source in ('app', 'offline_sync', 'manual')),
  edited_by     uuid references public.memberships(id) on delete set null,
  approval      public.approval_status not null default 'pending',
  created_at    timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in)
);
create index on public.time_entries (company_id, clock_in);
create index on public.time_entries (membership_id, clock_in);
-- only one open shift per person
create unique index time_entries_one_open on public.time_entries (membership_id) where clock_out is null;

create table public.tips (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  amount_cents  integer not null check (amount_cents > 0),
  received_at   timestamptz not null default now()
);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null, -- null = company expense
  job_id        uuid references public.jobs(id) on delete set null,
  client_id     uuid references public.clients(id) on delete set null,    -- for profit per client
  category      public.expense_category not null,
  description   text,
  amount_cents  integer not null check (amount_cents > 0),
  miles         numeric(7,1),
  incurred_on   date not null default current_date,
  receipt_path  text,                              -- bucket receipts: {company_id}/{uuid}.jpg
  reimbursable  boolean not null default false,    -- paid by the helper, owed back
  status        public.approval_status not null default 'approved',
  reviewed_by   uuid references public.memberships(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.expenses (company_id, incurred_on);

-- ───────────────────────── Invoices and payments ─────────────────────────
create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete restrict,
  number       text not null,
  status       public.invoice_status not null default 'draft',
  issued_on    date,
  due_on       date,
  subtotal_cents integer not null default 0,
  tax_cents    integer not null default 0,
  total_cents  integer generated always as (subtotal_cents + tax_cents) stored,
  paid_cents   integer not null default 0,
  pass_card_fee boolean not null default false,
  stripe_payment_link text,
  last_reminder_at timestamptz,
  reminders_sent smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, number)
);
create index on public.invoices (company_id, status, due_on);

create table public.invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  job_id      uuid references public.jobs(id) on delete set null,
  description text not null,
  quantity    numeric(8,2) not null default 1 check (quantity > 0),
  unit_cents  integer not null check (unit_cents >= 0),
  amount_cents integer generated always as (round(quantity * unit_cents)::integer) stored
);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  method       public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  received_at  timestamptz not null default now(),
  reference    text,                               -- check number, Zelle confirmation…
  stripe_payment_intent_id text unique,
  recorded_by  uuid references public.memberships(id) on delete set null, -- null = Stripe webhook
  created_at   timestamptz not null default now()
);

-- ───────────────────────── Commercial quality ─────────────────────────
create table public.inspections (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  inspector_id uuid references public.memberships(id) on delete set null,
  score       smallint check (score between 0 and 100),
  items       jsonb not null default '[]'::jsonb,  -- [{area, ok, note, photo_id}]
  shared_with_client boolean not null default false,
  inspected_at timestamptz not null default now()
);

create table public.supply_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,  -- null = company stock
  name        text not null,
  unit        text not null default 'un',
  on_hand     numeric(10,2) not null default 0,
  reorder_at  numeric(10,2),
  unit_cost_cents integer,
  updated_at  timestamptz not null default now()
);

-- ───────────────────────── Communication ─────────────────────────
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id  uuid references public.clients(id) on delete cascade,   -- set for owner ↔ client threads
  job_id     uuid references public.jobs(id) on delete set null,
  title      text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index on public.conversation_participants (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  sender_id       uuid references auth.users(id) on delete set null,
  body            text not null check (length(body) between 1 and 4000),
  body_language   public.app_language,
  translations    jsonb not null default '{}'::jsonb,  -- {"en": "...", "es": "..."}; original kept in body
  attachment_path text,
  created_at      timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  kind       text not null,                        -- job_reminder, invoice_paid, tidy_insight, broadcast…
  title      text not null,
  body       text,
  link       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.message_deliveries (            -- outbound email/SMS/push log, so failed reminders are visible and retried
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,
  channel     text not null check (channel in ('email', 'sms', 'push', 'whatsapp')),
  purpose     text not null,                       -- job_reminder, invoice_reminder, invite…
  recipient   text not null,
  status      text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  attempts    smallint not null default 0,
  provider_id text,
  error       text,
  related_id  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.message_deliveries (status, created_at) where status in ('queued', 'failed');

-- ───────────────────────── Tidy assistant ─────────────────────────
create table public.tidy_insights (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  run_date    date not null default current_date,
  kind        text not null,        -- conflict, route, invoice_overdue, contract_renewal, shift_gap, punch_anomaly, hours_vs_contract, supplies, overtime…
  severity    public.insight_severity not null default 'attention',
  title       text not null,
  detail      text,
  action      jsonb not null default '{}'::jsonb,  -- what the "Resolver" button does
  savings     jsonb,                               -- measurable effect: minutes, cents
  status      public.insight_status not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.tidy_insights (company_id, status, run_date desc);

create table public.route_plans (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  plan_date     date not null,
  job_order     uuid[] not null,
  minutes_before integer,
  minutes_after  integer,
  applied_at    timestamptz,
  applied_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (membership_id, plan_date)
);

-- ───────────────────────── Platform (superadmin) ─────────────────────────
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.ad_campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  format       public.ad_format not null,
  status       public.ad_status not null default 'draft',
  media_type   text not null default 'image' check (media_type in ('image', 'video')),
  media_path   text,
  content      jsonb not null default '{}'::jsonb, -- {"pt-BR": {title, body, cta}, "en": {...}, "es": {...}}
  cta_url      text,
  utm          jsonb not null default '{}'::jsonb,
  close_after_seconds smallint,                    -- fullscreen timer
  targeting    jsonb not null default '{}'::jsonb, -- plans, modes, languages, roles
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.ad_events (
  id          bigint generated always as identity primary key,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  event       text not null check (event in ('impression', 'click', 'close')),
  created_at  timestamptz not null default now()
);
create index on public.ad_events (campaign_id, event);

create table public.broadcasts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade, -- null = sent by the platform
  audience    text not null check (audience in ('owners', 'team', 'clients', 'everyone')),
  content     jsonb not null,                      -- per language: {title, body, link}
  scheduled_at timestamptz,
  sent_at     timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,
  opened_by   uuid not null references auth.users(id) on delete cascade,
  subject     text not null,
  status      public.ticket_status not null default 'open',
  priority    smallint not null default 2 check (priority between 1 and 3),
  language    public.app_language not null default 'en',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  sender_id  uuid references auth.users(id) on delete set null,
  from_staff boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  actor_id   uuid,
  action     text not null,
  table_name text,
  row_id     uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (company_id, created_at desc);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','companies','memberships','clients','properties','contracts','jobs','invoices','subscriptions','support_tickets','message_deliveries']
  loop
    execute format('create trigger touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
