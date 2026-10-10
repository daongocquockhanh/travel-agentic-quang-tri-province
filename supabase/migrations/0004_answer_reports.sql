-- =============================================================
-- answer_reports: travellers flag a guide answer as wrong or offensive
-- (Google Play's AI-generated content policy requires an in-app way to
-- report AI output). Reviewed by editors alongside content_gaps.
-- =============================================================
create table if not exists public.answer_reports (
  id          uuid primary key default gen_random_uuid(),
  reason      text not null check (reason in ('wrong', 'offensive', 'other')),
  note        text,
  question    text not null,
  answer      text not null,
  track       text,
  lang        text,
  site_slug   text,
  created_at  timestamptz not null default now()
);

create index if not exists answer_reports_created_at_idx on public.answer_reports (created_at desc);

-- RLS on with no policies: written and read by the service role only.
alter table public.answer_reports enable row level security;
