-- M7: row-level security hardening.
--
-- 1. Anonymous agent sessions were readable by anyone. 0001 allowed
--    `user_id is null or user_id = auth.uid()`, so any client holding the
--    public anon key could list every anonymous session and its messages.
--    Anonymous sessions are now reachable only through the server (service
--    role); signed-in users can read, write and delete only their own rows.
-- 2. Write helpers (upsert_site, replace_site_content) were executable by
--    anon/authenticated via RPC. RLS already blocked their writes; now the
--    functions themselves are service-role only.
-- 3. Functions get a fixed search_path (Supabase linter:
--    function_search_path_mutable).

-- ── agent_sessions ───────────────────────────────────────────────
drop policy if exists "agent_sessions_select_own" on public.agent_sessions;
drop policy if exists "agent_sessions_insert_own" on public.agent_sessions;

create policy "agent_sessions_select_own" on public.agent_sessions
  for select to authenticated
  using (user_id = auth.uid());

create policy "agent_sessions_insert_own" on public.agent_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "agent_sessions_delete_own" on public.agent_sessions
  for delete to authenticated
  using (user_id = auth.uid());

-- ── agent_messages ───────────────────────────────────────────────
drop policy if exists "agent_messages_select_own" on public.agent_messages;
drop policy if exists "agent_messages_insert_own" on public.agent_messages;

create policy "agent_messages_select_own" on public.agent_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.agent_sessions s
      where s.id = agent_messages.session_id and s.user_id = auth.uid()
    )
  );

create policy "agent_messages_insert_own" on public.agent_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.agent_sessions s
      where s.id = agent_messages.session_id and s.user_id = auth.uid()
    )
  );

-- Deleting a session cascades to its messages; no direct message delete needed.

-- ── public catalogue: read-only for clients ──────────────────────
drop policy if exists "sites_public_read" on public.sites;
create policy "sites_public_read" on public.sites
  for select to anon, authenticated
  using (true);

drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read" on public.site_content
  for select to anon, authenticated
  using (true);

-- content_gaps keeps RLS enabled with no policies: service role only.

-- ── functions ────────────────────────────────────────────────────
revoke execute on function public.upsert_site(text, text, text, text, text[], double precision, double precision, text, jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.replace_site_content(uuid, text)
  from public, anon, authenticated;
grant execute on function public.upsert_site(text, text, text, text, text[], double precision, double precision, text, jsonb, integer)
  to service_role;
grant execute on function public.replace_site_content(uuid, text)
  to service_role;

alter function public.find_nearby_sites(double precision, double precision, double precision, text, text)
  set search_path = public, extensions;
alter function public.search_curated(vector, text, text, text, integer)
  set search_path = public, extensions;
alter function public.upsert_site(text, text, text, text, text[], double precision, double precision, text, jsonb, integer)
  set search_path = public, extensions;
alter function public.replace_site_content(uuid, text)
  set search_path = public;
alter function public.touch_updated_at()
  set search_path = public;
