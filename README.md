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
#   supabase/migrations/0001_init.sql, 0002_content_review.sql
bun run content:check        # editorial checks (add --strict for production)
bun run ingest               # checks, then ingests content/sites/* into DB
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

See `docs/SYSTEM_DESIGN.md` §10. Currently at **M6: curate + ingest the top 10 sites** (M1–M5 are done). All ten sites have VI + EN drafts awaiting editorial review; see `docs/CONTENT_GUIDE.md`.

## Chat agent (M3)

- `POST /api/agent/chat` streams answers for `useChat` (Vercel AI SDK data stream). Body: `{messages, track, lang, site_slug?, lat?, lng?, intent?}`.
- `lib/agent/`: `system-prompts.ts` (per-track voice, VI/EN), `tools.ts` (`search_curated`, `get_site`, `find_nearby`), `guards.ts` (sensitive-topic detection, injection scrub, input caps), `retrieval.ts` (pgvector or local BM25), `run.ts` (agent loop).
- **Grounding is enforced server-side.** War track, war/religious sites and war/religious/ethnic questions get curated chunks retrieved *before* the model runs. The model is limited to those chunks, and the question is refused (and logged to `content_gaps`) when there are none. Chunks never come from a different site than the one the question is about.
- Works without keys: with no Supabase it searches `content/sites/**` locally; with no `OPENAI_API_KEY` it answers with cited excerpts ("offline mode").
- UI: `/chat` (also `?site=<slug>`, `?intent=arrival_story`, `?q=`). Reachable from the map ask bar, the site page "Ask about this place" button, and the geofence banner's Play button.
- Tests: `bun run test` (guards, retrieval, agent grounding/refusal, voice).

## Voice (M4)

- Hold the mic button in `/chat` to talk (Space/Enter also works). Recording stops at 30 s, and taps shorter than 0.4 s are ignored.
- `POST /api/agent/voice`: Whisper speech-to-text with a language hint plus a prompt listing Quảng Trị place names. The transcript then goes through the normal chat agent, so voice answers keep grounding and citations.
- `POST /api/agent/tts`: TTS-1 audio, cached in memory by `hash(model, voice, lang, text)`. The voice is `onyx` on the war track and `nova` elsewhere.
- The reply is spoken sentence by sentence while it streams (`lib/voice/sentences.ts`, `lib/voice/player.ts`). Every answer has a **Listen** button, and the geofence banner's Play speaks the arrival story.
- Without `OPENAI_API_KEY`, speech-to-text shows a "type instead" notice and TTS falls back to the browser's built-in speech.

## Itinerary + next place (M5)

- The **plan** is an ordered list of sites kept in localStorage (`lib/plan-store.ts`) and shared live by the map, site pages and chat.
- **Map → My plan** shows route cards with arrive/depart times, drive or boat legs, opening-hours warnings, reorder/remove buttons, a start time, and **Optimize order** (exact search up to 8 stops, then nearest-neighbour + 2-opt). The same route is drawn on the map with numbered stops; boat crossings are dashed.
- **Next places** (`lib/recommend.ts`): three cards with drive time and a reason ("13 min drive · continues the 17th-parallel story · open until 16:30"). They appear on site pages, after an arrival story, in the plan tab, and in chat.
- Chat agent tools `recommend_next` and `build_route` render as those same cards. "Where next?" and "plan tomorrow" work on the war track too, and offline without an OpenAI key.
- `/map?plan=a,b,c&tab=plan` opens a shared plan (the chat route card links there).
- Drive times are estimates (straight line × 1.3 at 45 km/h) unless `MAPBOX_SECRET_TOKEN` or `NEXT_PUBLIC_MAPBOX_TOKEN` is set, in which case Mapbox Directions supplies real times and road geometry.
