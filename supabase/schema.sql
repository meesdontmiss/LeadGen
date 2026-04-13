create extension if not exists pgcrypto;
create extension if not exists citext;

create type lead_status as enum (
  'new',
  'qualified',
  'draft_ready',
  'sent',
  'replied',
  'interested',
  'booked',
  'won',
  'lost',
  'do_not_contact'
);

create type offer_type as enum (
  'free_prototype_site',
  'free_video_photo_concept',
  'free_teardown_brief'
);

create type email_status as enum (
  'draft',
  'approved',
  'sent',
  'replied',
  'bounced',
  'suppressed'
);

create type email_direction as enum ('outbound', 'inbound');
create type suppression_reason as enum ('bounce', 'opt_out', 'reply', 'manual', 'complaint_risk');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  normalized_name text not null,
  domain citext,
  website_url text,
  phone text,
  phone_normalized text,
  vertical text not null,
  neighborhood text,
  city text not null,
  state text not null default 'CA',
  owner_name text,
  premium_fit numeric(5,2) not null default 0 check (premium_fit between 0 and 100),
  contactability numeric(5,2) not null default 0 check (contactability between 0 and 100),
  lead_status lead_status not null default 'new',
  source text not null,
  social_links jsonb not null default '{}'::jsonb,
  enrichment jsonb not null default '{}'::jsonb,
  notes text
);

create unique index if not exists companies_domain_unique on companies (domain) where domain is not null;
create unique index if not exists companies_phone_unique on companies (phone_normalized) where phone_normalized is not null;
create index if not exists companies_vertical_idx on companies (vertical);
create index if not exists companies_lead_status_idx on companies (lead_status);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null,
  title text,
  email citext,
  phone text,
  linkedin_url text,
  source text not null,
  confidence numeric(5,2) not null default 0 check (confidence between 0 and 100),
  is_primary boolean not null default false,
  do_not_contact boolean not null default false
);

create index if not exists contacts_company_idx on contacts (company_id);
create index if not exists contacts_email_idx on contacts (email);

create table if not exists site_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid not null references companies(id) on delete cascade,
  captured_at timestamptz not null default now(),
  screenshot_desktop_path text,
  screenshot_mobile_path text,
  nav_summary jsonb not null default '[]'::jsonb,
  headings jsonb not null default '[]'::jsonb,
  cta_summary jsonb not null default '[]'::jsonb,
  form_summary jsonb not null default '[]'::jsonb,
  premium_fit numeric(5,2) not null check (premium_fit between 0 and 100),
  presentation_gap numeric(5,2) not null check (presentation_gap between 0 and 100),
  visual_quality numeric(5,2) not null check (visual_quality between 0 and 100),
  cta_quality numeric(5,2) not null check (cta_quality between 0 and 100),
  trust_signals numeric(5,2) not null check (trust_signals between 0 and 100),
  mobile_quality numeric(5,2) not null check (mobile_quality between 0 and 100),
  seo_basics numeric(5,2) not null check (seo_basics between 0 and 100),
  weaknesses jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  hook text,
  recommended_offer_type offer_type,
  audit_payload jsonb not null default '{}'::jsonb
);

create index if not exists site_audits_company_idx on site_audits (company_id, captured_at desc);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references companies(id) on delete cascade,
  offer_type offer_type not null,
  summary text,
  rationale text,
  homepage_brief jsonb not null default '[]'::jsonb,
  teaser_page_json jsonb not null default '{}'::jsonb,
  preview_url text,
  created_by text not null default 'openclaw'
);

create index if not exists offers_company_idx on offers (company_id);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  status lead_status not null default 'new',
  assigned_to text,
  offer_type offer_type,
  send_domain citext,
  started_at timestamptz not null default now(),
  last_touch_at timestamptz,
  next_touch_at timestamptz,
  stop_reason text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists campaigns_company_idx on campaigns (company_id);
create index if not exists campaigns_status_idx on campaigns (status);

create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  gmail_thread_id text,
  gmail_draft_id text,
  subject text,
  subject_variants jsonb not null default '[]'::jsonb,
  body_text text,
  body_html text,
  direction email_direction not null default 'outbound',
  status email_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  reply_detected_at timestamptz,
  compliance_footer jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists emails_company_idx on emails (company_id, created_at desc);
create index if not exists emails_thread_idx on emails (gmail_thread_id);

create table if not exists suppression_list (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  email citext,
  domain citext,
  reason suppression_reason not null,
  source text not null,
  expires_at timestamptz,
  notes text
);

create index if not exists suppression_email_idx on suppression_list (email);
create index if not exists suppression_domain_idx on suppression_list (domain);

create table if not exists domain_health (
  domain citext primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('healthy', 'warming', 'attention')),
  spf boolean not null default false,
  dkim boolean not null default false,
  dmarc boolean not null default false,
  inbox_placement numeric(5,2) not null default 0 check (inbox_placement between 0 and 100),
  complaint_rate numeric(5,2) not null default 0 check (complaint_rate between 0 and 100),
  daily_volume integer not null default 0,
  max_daily_volume integer not null default 0,
  last_warmup_at timestamptz,
  notes jsonb not null default '[]'::jsonb
);

create table if not exists worker_status (
  worker_key text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  label text not null,
  state text not null check (state in ('healthy', 'busy', 'attention')),
  queue_depth integer not null default 0,
  throughput_per_hour integer not null default 0,
  last_run_at timestamptz,
  next_action text not null
);

create table if not exists activity_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  company_id uuid references companies(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  actor text not null,
  event_type text not null,
  event_summary text not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists activity_logs_company_idx on activity_logs (company_id, created_at desc);
create index if not exists activity_logs_campaign_idx on activity_logs (campaign_id, created_at desc);

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

create index if not exists rate_limits_reset_at_idx on rate_limits (reset_at);

create trigger companies_updated_at
before update on companies
for each row execute function set_updated_at();

create trigger contacts_updated_at
before update on contacts
for each row execute function set_updated_at();

create trigger offers_updated_at
before update on offers
for each row execute function set_updated_at();

create trigger campaigns_updated_at
before update on campaigns
for each row execute function set_updated_at();

create trigger emails_updated_at
before update on emails
for each row execute function set_updated_at();

create trigger domain_health_updated_at
before update on domain_health
for each row execute function set_updated_at();

create trigger worker_status_updated_at
before update on worker_status
for each row execute function set_updated_at();

create or replace function calculate_outreach_score(
  premium_fit numeric,
  presentation_gap numeric,
  contactability numeric
)
returns numeric
language sql
immutable
as $$
  select round((premium_fit * 0.4) + (presentation_gap * 0.35) + (contactability * 0.25), 2);
$$;

create or replace view lead_queue_view as
with latest_audit as (
  select distinct on (company_id)
    company_id,
    premium_fit,
    presentation_gap,
    visual_quality,
    cta_quality,
    trust_signals,
    mobile_quality,
    seo_basics,
    recommended_offer_type,
    hook,
    captured_at
  from site_audits
  order by company_id, captured_at desc
)
select
  c.id as company_id,
  c.name,
  c.domain,
  c.vertical,
  c.neighborhood,
  c.city,
  c.owner_name,
  c.lead_status,
  c.premium_fit,
  c.contactability,
  la.presentation_gap,
  la.visual_quality,
  la.cta_quality,
  la.trust_signals,
  la.mobile_quality,
  la.seo_basics,
  la.recommended_offer_type,
  la.hook,
  calculate_outreach_score(c.premium_fit, la.presentation_gap, c.contactability) as outreach_score
from companies c
left join latest_audit la on la.company_id = c.id;
