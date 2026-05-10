-- Quang Tri Travel Agent — initial schema
-- Run via Supabase CLI: `supabase db push`
-- Or paste into SQL editor in Supabase dashboard.

-- Extensions
create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pgcrypto;

-- =============================================================
-- sites
-- =============================================================
create table if not exists public.sites (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name_vi       text not null,
  name_en       text not null,
  type          text not null check (type in ('war','cultural','religious','nature','food','city')),
  tracks        text[] not null default '{}',
  geom          geography(Point, 4326) not null,
  hero_image    text,
  opening_hours jsonb,
  ticket_price_vnd integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sites_geom_gix on public.sites using gist (geom);
create index if not exists sites_tracks_gin on public.sites using gin (tracks);
create index if not exists sites_type_idx on public.sites (type);

-- =============================================================
-- site_content (curated narrative chunks + embeddings)
-- =============================================================
create table if not exists public.site_content (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  lang            text not null check (lang in ('vi','en')),
  section         text not null check (section in ('overview','history','visit_tips','culture_notes')),
  body            text not null,
  embedding       vector(1536) not null,
  source_citation text,
  chunk_index     integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists site_content_embedding_idx
  on public.site_content
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists site_content_site_lang_section_idx
  on public.site_content (site_id, lang, section);

-- =============================================================
-- agent sessions + messages
-- =============================================================
create table if not exists public.agent_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  track       text not null check (track in ('war','foreign','domestic')),
  lang        text not null check (lang in ('vi','en')),
  started_at  timestamptz not null default now()
);

create table if not exists public.agent_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.agent_sessions(id) on delete cascade,
  role        text not null check (role in ('user','assistant','tool','system')),
  content     text not null,
  audio_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists agent_messages_session_idx on public.agent_messages (session_id, created_at);

-- =============================================================
-- content_gaps: log when agent is asked about a topic with no curated content
-- =============================================================
create table if not exists public.content_gaps (
  id          uuid primary key default gen_random_uuid(),
  site_slug   text,
  query       text not null,
  track       text,
  lang        text,
  occurred_at timestamptz not null default now()
);

-- =============================================================
-- helper: nearby sites by distance (PostGIS)
-- =============================================================
create or replace function public.find_nearby_sites(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  double precision default 2,
  p_track      text default null,
  p_type       text default null
)
returns table (
  id uuid,
  slug text,
  name_vi text,
  name_en text,
  type text,
  tracks text[],
  hero_image text,
  distance_m double precision
)
language sql
stable
as $$
  select
    s.id, s.slug, s.name_vi, s.name_en, s.type, s.tracks, s.hero_image,
    st_distance(s.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) as distance_m
  from public.sites s
  where st_dwithin(
          s.geom,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_radius_km * 1000
        )
    and (p_track is null or p_track = any (s.tracks))
    and (p_type  is null or s.type = p_type)
  order by distance_m asc
  limit 50;
$$;

-- =============================================================
-- helper: top-k curated content via cosine similarity
-- =============================================================
create or replace function public.search_curated(
  p_embedding vector(1536),
  p_lang      text,
  p_site_slug text default null,
  p_section   text default null,
  p_k         integer default 5
)
returns table (
  id uuid,
  site_id uuid,
  site_slug text,
  section text,
  body text,
  source_citation text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id, c.site_id, s.slug, c.section, c.body, c.source_citation,
    1 - (c.embedding <=> p_embedding) as similarity
  from public.site_content c
  join public.sites s on s.id = c.site_id
  where c.lang = p_lang
    and (p_site_slug is null or s.slug = p_site_slug)
    and (p_section   is null or c.section = p_section)
  order by c.embedding <=> p_embedding asc
  limit p_k;
$$;

-- =============================================================
-- helper: upsert site (handles PostGIS geography from lat/lng)
-- =============================================================
create or replace function public.upsert_site(
  p_slug             text,
  p_name_vi          text,
  p_name_en          text,
  p_type             text,
  p_tracks           text[],
  p_lat              double precision,
  p_lng              double precision,
  p_hero_image       text default null,
  p_opening_hours    jsonb default null,
  p_ticket_price_vnd integer default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.sites (
    slug, name_vi, name_en, type, tracks, geom,
    hero_image, opening_hours, ticket_price_vnd
  )
  values (
    p_slug, p_name_vi, p_name_en, p_type, p_tracks,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_hero_image, p_opening_hours, p_ticket_price_vnd
  )
  on conflict (slug) do update set
    name_vi          = excluded.name_vi,
    name_en          = excluded.name_en,
    type             = excluded.type,
    tracks           = excluded.tracks,
    geom             = excluded.geom,
    hero_image       = excluded.hero_image,
    opening_hours    = excluded.opening_hours,
    ticket_price_vnd = excluded.ticket_price_vnd
  returning id into v_id;

  return v_id;
end;
$$;

-- =============================================================
-- helper: replace all curated content for a site (idempotent ingest)
-- =============================================================
create or replace function public.replace_site_content(
  p_site_id uuid,
  p_lang    text
)
returns void
language sql
as $$
  delete from public.site_content
  where site_id = p_site_id and lang = p_lang;
$$;

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.sites          enable row level security;
alter table public.site_content   enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.agent_messages enable row level security;
alter table public.content_gaps   enable row level security;

-- public read for sites + site_content
drop policy if exists "sites_public_read" on public.sites;
create policy "sites_public_read" on public.sites
  for select using (true);

drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read" on public.site_content
  for select using (true);

-- agent_sessions: user can read/write their own; anonymous (user_id is null) allowed for anyone
drop policy if exists "agent_sessions_select_own" on public.agent_sessions;
create policy "agent_sessions_select_own" on public.agent_sessions
  for select using (user_id is null or user_id = auth.uid());

drop policy if exists "agent_sessions_insert_own" on public.agent_sessions;
create policy "agent_sessions_insert_own" on public.agent_sessions
  for insert with check (user_id is null or user_id = auth.uid());

-- agent_messages: scoped by session ownership
drop policy if exists "agent_messages_select_own" on public.agent_messages;
create policy "agent_messages_select_own" on public.agent_messages
  for select using (
    exists (
      select 1 from public.agent_sessions s
      where s.id = agent_messages.session_id
        and (s.user_id is null or s.user_id = auth.uid())
    )
  );

drop policy if exists "agent_messages_insert_own" on public.agent_messages;
create policy "agent_messages_insert_own" on public.agent_messages
  for insert with check (
    exists (
      select 1 from public.agent_sessions s
      where s.id = agent_messages.session_id
        and (s.user_id is null or s.user_id = auth.uid())
    )
  );

-- content_gaps: server-side service role only (no policies for anon/authenticated)

-- =============================================================
-- trigger: bump updated_at on sites
-- =============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sites_touch_updated_at on public.sites;
create trigger sites_touch_updated_at
  before update on public.sites
  for each row execute function public.touch_updated_at();
