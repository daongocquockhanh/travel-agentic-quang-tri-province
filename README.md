# Quang Tri Travel Agent

Mobile-first PWA: AI travel agent for Quang Tri Province, Vietnam. Three audience tracks (war pilgrim · foreign tourist · domestic VN), 3D terrain map, location-aware history & culture stories, bilingual VI/EN voice + text chat.

See `docs/SYSTEM_DESIGN.md` for architecture and `docs/DESIGN_BRIEF.md` for UI direction.

## Stack

Next.js 15 (App Router) · Supabase (Postgres + PostGIS + pgvector) · OpenAI (GPT-4o-mini, Whisper, TTS-1) · Mapbox GL JS · Vercel AI SDK · Tailwind v4 · next-intl.

## Setup

```bash
bun install
cp .env.example .env.local   # fill in keys
# apply migration via Supabase CLI or dashboard:
#   supabase/migrations/0001_init.sql
bun run ingest               # ingests content/sites/* into DB
bun run dev
```

## Repo layout

```
app/                    Next.js App Router
components/             React components
lib/                    Shared libs (geo, supabase, agent, i18n)
content/sites/<slug>/   Curated markdown per site (meta.yml + vi/, en/)
scripts/ingest.ts       Markdown -> embeddings -> Supabase
supabase/migrations/    SQL migrations
messages/               i18n strings (vi.json, en.json)
docs/                   System design + design brief
```

## Milestones

See `docs/SYSTEM_DESIGN.md` §10. Currently at **M3: chat agent with RAG** (M1 scaffold and M2 map + site detail are done).

## Chat agent (M3)

- `POST /api/agent/chat` streams answers for `useChat` (Vercel AI SDK data stream). Body: `{messages, track, lang, site_slug?, lat?, lng?, intent?}`.
- `lib/agent/`: `system-prompts.ts` (per-track voice, VI/EN), `tools.ts` (`search_curated`, `get_site`, `find_nearby`), `guards.ts` (sensitive-topic detection, injection scrub, input caps), `retrieval.ts` (pgvector or local BM25), `run.ts` (agent loop).
- **Grounding is enforced server-side.** War track, war/religious sites and war/religious/ethnic questions get curated chunks retrieved *before* the model runs. The model is limited to those chunks, and the question is refused (and logged to `content_gaps`) when there are none. Chunks never come from a different site than the one the question is about.
- Works without keys: with no Supabase it searches `content/sites/**` locally; with no `OPENAI_API_KEY` it answers with cited excerpts ("offline mode").
- UI: `/chat` (also `?site=<slug>`, `?intent=arrival_story`, `?q=`). Reachable from the map ask bar, the site page "Ask about this place" button, and the geofence banner's Play button.
- Tests: `bun run test` (guards, retrieval, agent grounding/refusal).
