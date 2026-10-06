-- M6: editorial review status and source URLs on curated content.
-- Drafts can be ingested for staging; production sets CONTENT_REQUIRE_REVIEWED=true
-- (retrieval ignores drafts) and runs ingest with INGEST_REQUIRE_REVIEWED=1.

alter table public.site_content
  add column if not exists review_status text not null default 'draft'
    check (review_status in ('draft', 'reviewed')),
  add column if not exists sources text[] not null default '{}';

-- The return type changes, so the function must be dropped first.
drop function if exists public.search_curated(vector, text, text, text, integer);

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
  review_status text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id, c.site_id, s.slug, c.section, c.body, c.source_citation, c.review_status,
    1 - (c.embedding <=> p_embedding) as similarity
  from public.site_content c
  join public.sites s on s.id = c.site_id
  where c.lang = p_lang
    and (p_site_slug is null or s.slug = p_site_slug)
    and (p_section   is null or c.section = p_section)
  order by c.embedding <=> p_embedding asc
  limit p_k;
$$;
