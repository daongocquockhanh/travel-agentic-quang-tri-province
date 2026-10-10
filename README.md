# Quang Tri Travel Agent

Mobile-first PWA: AI travel agent for Quang Tri Province, Vietnam. Three audience tracks (war pilgrim · foreign tourist · domestic VN), 3D terrain map, location-aware history & culture stories, bilingual VI/EN voice + text chat.

See `docs/SYSTEM_DESIGN.md` for architecture and `docs/DESIGN_BRIEF.md` for UI direction.

## Stack

Next.js 15 (App Router) · Supabase (Postgres + PostGIS + pgvector) · Google Gemini (2.5 Flash-Lite, gemini-embedding-001) or OpenAI (GPT-4o-mini, Whisper, TTS-1), picked by `AI_PROVIDER` · Mapbox GL JS · Vercel AI SDK · Tailwind v4 · next-intl.

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
docs/                   System design, design brief, store release guide
ios/ android/           Capacitor app shells (capacitor.config.ts, mobile/www)
```

## Milestones

See `docs/SYSTEM_DESIGN.md` §10. All milestones M1–M7 are implemented. Before launch: content review (all sections are still drafts; see `docs/CONTENT_GUIDE.md`) and testing with real API keys on real phones (see **Ship checklist** below).

## Chat agent (M3)

- `POST /api/agent/chat` streams answers for `useChat` (Vercel AI SDK data stream). Body: `{messages, track, lang, site_slug?, lat?, lng?, intent?}`.
- `lib/agent/`: `system-prompts.ts` (per-track voice, VI/EN), `tools.ts` (`search_curated`, `get_site`, `find_nearby`), `guards.ts` (sensitive-topic detection, injection scrub, input caps), `retrieval.ts` (pgvector or local BM25), `run.ts` (agent loop).
- **Grounding is enforced server-side.** War track, war/religious sites and war/religious/ethnic questions get curated chunks retrieved _before_ the model runs. The model is limited to those chunks, and the question is refused (and logged to `content_gaps`) when there are none. Chunks never come from a different site than the one the question is about.
- Works without keys: with no Supabase it searches `content/sites/**` locally; with no AI key (`GOOGLE_GENERATIVE_AI_API_KEY` or `OPENAI_API_KEY`) it answers with cited excerpts ("offline mode").
- UI: `/chat` (also `?site=<slug>`, `?intent=arrival_story`, `?q=`). Reachable from the map ask bar, the site page "Ask about this place" button, and the geofence banner's Play button.
- Tests: `bun run test` (guards, retrieval, agent grounding/refusal, voice).

## Voice (M4)

- Hold the mic button in `/chat` to talk (Space/Enter also works). Recording stops at 30 s, and taps shorter than 0.4 s are ignored.
- `POST /api/agent/voice`: Whisper speech-to-text with a language hint plus a prompt listing Quảng Trị place names. The transcript then goes through the normal chat agent, so voice answers keep grounding and citations.
- `POST /api/agent/tts`: TTS-1 audio, cached in memory by `hash(model, voice, lang, text)`. The voice is `onyx` on the war track and `nova` elsewhere.
- The reply is spoken sentence by sentence while it streams (`lib/voice/sentences.ts`, `lib/voice/player.ts`). Every answer has a **Listen** button, and the geofence banner's Play speaks the arrival story.
- Without an AI key, speech-to-text shows a "type instead" notice. Speech-to-text uses Gemini or Whisper, whichever provider is active. TTS uses OpenAI when `OPENAI_API_KEY` is set and otherwise falls back to the browser's built-in speech.

## Itinerary + next place (M5)

- The **plan** is an ordered list of sites kept in localStorage (`lib/plan-store.ts`) and shared live by the map, site pages and chat.
- **Map → My plan** shows route cards with arrive/depart times, drive or boat legs, opening-hours warnings, reorder/remove buttons, a start time, and **Optimize order** (exact search up to 8 stops, then nearest-neighbour + 2-opt). The same route is drawn on the map with numbered stops; boat crossings are dashed.
- **Next places** (`lib/recommend.ts`): three cards with drive time and a reason ("13 min drive · continues the 17th-parallel story · open until 16:30"). They appear on site pages, after an arrival story, in the plan tab, and in chat.
- Chat agent tools `recommend_next` and `build_route` render as those same cards. "Where next?" and "plan tomorrow" work on the war track too, and offline without an AI key.
- `/map?plan=a,b,c&tab=plan` opens a shared plan (the chat route card links there).
- Drive times are estimates (straight line × 1.3 at 45 km/h) unless `MAPBOX_SECRET_TOKEN` or `NEXT_PUBLIC_MAPBOX_TOKEN` is set, in which case Mapbox Directions supplies real times and road geometry.

## Ship-readiness (M7)

- **Rate limits** (`lib/rate-limit.ts`): chat 30/min, voice 10/min, TTS 20/min, route 60/min, recommend 120/min per IP. Upstash Redis when `UPSTASH_REDIS_REST_*` is set, otherwise in-memory.
- **RLS** (`supabase/migrations/0003_rls_hardening.sql`): anonymous agent sessions are no longer readable by every client; write helpers are service-role only. `tests/rls.test.ts` checks the policies against a real Postgres 16.
- **Eval** (`lib/eval/`, `bun run eval`): 36 golden prompts (6 of them follow-ups that depend on the conversation) × 3 tracks × 2 languages = 216 cases. Checks grounding, citations (and that they come from the right site), declining out-of-scope questions, planner tool use, reply language, length, and prompt-leak resistance. Offline it gates CI; with an AI key it evaluates the real model nightly.
- **Error states**: when chat fails, the site's curated overview is shown; location is opt-in, with calm denied/unavailable/"nothing within 2 km" states; real 300 m geofence banner; bilingual error, 404 and offline pages; offline banner.
- **PWA**: icons from the logomark (including maskable), manifest shortcuts, service worker (`public/sw.js`) keeping the last 5 site pages and the map/chat shells; the last chat thread is kept in localStorage; pinch-zoom no longer disabled.
- **CI** (`.github/workflows/`): `ci.yml` (typecheck, lint, content checks, tests incl. offline eval and RLS, build); `eval.yml` (nightly live eval); `ingest.yml` (ingest on merge to main, skipped with a warning while drafts remain).

### Ship checklist

1. Editors review all content and set `review_status: reviewed` (`bun run content:check --strict` must pass).
2. Apply migrations 0001–0003; set `CONTENT_REQUIRE_REVIEWED=true` and the Upstash, AI provider (Google or OpenAI), Supabase and Mapbox env vars in production.
3. Add `GOOGLE_GENERATIVE_AI_API_KEY` (or `OPENAI_API_KEY`) as a repo secret and run the live eval (Actions → Agent eval) until it passes.
4. On-device check on a mid-range Android over 3G and on iOS Safari: load time, map frame rate, push-to-talk round-trip, install to home screen, offline.

### Deploy to Cloudflare Workers

Built with [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare); config in `wrangler.jsonc`. Curated content is bundled at build time (`bun run content:bundle` → `lib/generated/content.json`) because Workers have no project filesystem.

1. `bunx wrangler login`
2. Secrets, once per Worker: `bunx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY` (and `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `OPENAI_API_KEY`, `MAPBOX_SECRET_TOKEN`, `TAVILY_API_KEY` if used). Non-secret settings go under `vars` in `wrangler.jsonc`.
3. `NEXT_PUBLIC_*` values are inlined at build time: put them in `.env.local` (or the CI environment) before building.
4. `bun run preview` runs the Worker locally (reads secrets from `.dev.vars`); `bun run deploy` builds and deploys.

## Mobile apps (App Store / Google Play)

`ios/` and `android/` are Capacitor shells that load the deployed site and add native location, microphone access, an icon, a splash screen and an offline screen. Web deploys update both apps without a store review.

- `bun run mobile:sync`: copies `capacitor.config.ts` and plugins into the native projects (set `CAP_SERVER_URL` to target another deploy)
- `bun run mobile:android` / `bun run mobile:ios`: opens Android Studio or Xcode
- `bun run mobile:assets`: regenerates the icons and splash from `public/icon-maskable-512.png`
- `bun run store:screenshots [url]`: store screenshots in both languages

In-app pages the stores require: `/privacy`, `/terms` and `/about`. Every answer has a **Report** button, which writes to `answer_reports` (migration 0004).

The full release checklist, listing text and privacy answers are in [docs/STORE_RELEASE.md](docs/STORE_RELEASE.md).
