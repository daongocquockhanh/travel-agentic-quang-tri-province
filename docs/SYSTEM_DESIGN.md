# System Design — Quang Tri Travel Agent

**Status:** Draft v1 · **Date:** 2026-05-10 · **Owner:** gondk

---

## 1. Overview

A mobile-first PWA that acts as a location-aware AI travel agent for Quang Tri Province (Vietnam). Three audience tracks share one app: war-history pilgrims, foreign tourists, and domestic Vietnamese tourists. Core capabilities:

1. **You-are-here storytelling** — detect the user's location and tell the history/culture of the place they're standing on.
2. **Next-place recommender** — suggest the next stop based on track, time remaining, and what's already been visited.
3. **3D terrain map** — Mapbox GL JS with terrain and satellite, POI pins, fly-to.
4. **Bilingual chat** — Vietnamese + English, text and push-to-talk voice.
5. **Grounded RAG** — curated content for sensitive topics (war, religious, ethnic), LLM + web search for generic.

## 2. Goals & non-goals

### Goals
- Accurate war/cultural narration (no hallucination on sensitive topics).
- Sub-5-second initial load on a 3G mid-range Android phone.
- Push-to-talk round-trip under 4 seconds.
- Single codebase for three audience tracks.
- Editor workflow that lets non-engineers add a site in under an hour.

### Non-goals (deferred to post-MVP)
- Hotel / tour / transport bookings.
- Native iOS / Android apps.
- Offline pre-download packs.
- AR camera overlays.
- Languages beyond VI/EN.
- User-generated content and moderation.
- B2B operator tools.

## 3. Users & key journeys

### Persona A — War pilgrim ("John, 72, US veteran")
Stands at Hien Luong bridge. Wants the historical context of the 17th-parallel split, names of units stationed nearby, and to find Vinh Moc tunnels next. Prefers English, voice-first, solemn tone.

### Persona B — Foreign tourist ("Lena, 28, German backpacker")
In Dong Ha for one day. Wants a quick overview of the province's identity, top three sights for a day trip, vegetarian food spots, and basic Vietnamese phrases. English only, text + occasional voice.

### Persona C — Domestic VN tourist ("Mai, 31, from Hanoi")
Driving with family. Wants hidden beaches near Cua Tung, opening hours, ticket prices, and travel time between stops. Vietnamese only, text-first, fast logistics-focused answers.

## 4. High-level architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Client (PWA)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ MapView  │  │ Chat UI  │  │ TrackPicker          │   │
│  │ (Mapbox) │  │ (SSE)    │  │ war/foreign/domestic │   │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘   │
│       │             │                    │               │
│       │     ┌───────┴───────┐            │               │
│       │     │ VoiceButton   │            │               │
│       │     │ (MediaRecord) │            │               │
│       │     └───────┬───────┘            │               │
│       │             │                    │               │
│       └────── lib/agent-client.ts ───────┘               │
│                     │                                    │
│              Service Worker (SW)                         │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTPS · SSE
┌─────────────────────┴────────────────────────────────────┐
│            Next.js API routes (Vercel edge)              │
│  POST /api/agent/chat    (SSE)                           │
│  POST /api/agent/voice                                   │
│  GET  /api/sites · /api/sites/[slug]                     │
│  GET  /api/nearby                                        │
│  POST /api/route                                         │
└────────────┬─────────────────────────────────┬───────────┘
             │                                 │
   ┌─────────┴────────────┐         ┌──────────┴───────────┐
   │   Supabase           │         │   OpenAI             │
   │  - Postgres          │         │  - GPT-4o-mini       │
   │  - PostGIS           │         │  - Whisper (STT)     │
   │  - pgvector          │         │  - TTS-1             │
   │  - Storage           │         │  - text-embedding-3- │
   │  - Auth              │         │    small (1536d)     │
   └──────────────────────┘         └──────────────────────┘
                      │
              ┌───────┴────────┐
              │ Web search     │
              │ (Tavily/Brave) │
              └────────────────┘
```

## 5. Component view

### 5.1 Client (Next.js 15 App Router PWA)

| Module | Responsibility |
|---|---|
| `app/(map)/page.tsx` | Main map screen. Polls geolocation (15s, throttled). Renders POI pins. Surfaces "you-are-here" banner. |
| `app/(map)/site/[slug]/page.tsx` | Site detail. Mapbox `flyTo`. Renders curated overview, hero image, audio player. |
| `app/chat/page.tsx` | Full-screen chat. Streaming SSE responses. Push-to-talk. |
| `components/TrackPicker.tsx` | Switches active track. Persists to `localStorage` and `agent_sessions`. |
| `components/VoiceButton.tsx` | `MediaRecorder` push-to-talk. POSTs webm to `/api/agent/voice`. |
| `components/ChatStream.tsx` | Consumes SSE, renders incremental tokens, plays TTS chunks. |
| `components/MapView.tsx` | Mapbox GL JS wrapper. Terrain layer, satellite, custom POI source. |
| `lib/geo.ts` | Haversine distance, geofence test, "nearest N" helpers. |
| `lib/agent-client.ts` | Wraps `fetch` + `EventSource` for SSE. |
| `lib/supabase.ts` | Browser Supabase client (anon key). |
| `lib/i18n.ts` | `next-intl` provider, locale switch. |
| `public/manifest.webmanifest` | PWA install metadata. |
| `public/service-worker.js` | Caches last 5 site pages + last chat thread. |

### 5.2 Server (Next.js API routes)

| Route | Method | Purpose |
|---|---|---|
| `/api/agent/chat` | POST | SSE streaming agent. Body: `{messages, track, lang, lat?, lng?, site_slug?, intent?}`. |
| `/api/agent/voice` | POST | Multipart audio → Whisper → chat → TTS-1. Returns `{transcript, response_text, audio_url}`. |
| `/api/sites` | GET | List sites. Query: `?track=&near=lat,lng&radius_km=`. |
| `/api/sites/[slug]` | GET | Single site row + curated content sections. |
| `/api/nearby` | GET | PostGIS distance query. Query: `?lat&lng&radius_km`. |
| `/api/route` | POST | Itinerary builder. Body: `{slugs[]}` → ordered sites + travel times via OSRM/Mapbox Directions. |

### 5.3 Agent layer (`lib/agent/`)

```
lib/agent/
  system-prompts.ts     ← per-track prompt templates (war | foreign | domestic)
  tools.ts              ← Vercel AI SDK tool definitions
  run.ts                ← main agent loop (tool-calling, streaming)
  guards.ts             ← prompt-injection scrub, citation enforcement
```

**Tools:**

| Tool | Signature | Notes |
|---|---|---|
| `search_curated` | `(query, site_slug?, section?, lang) → chunks[]` | Top-k pgvector search on `site_content`. Returns body + `source_citation`. |
| `find_nearby` | `(lat, lng, radius_km, type?) → sites[]` | PostGIS `<->` distance ordered. |
| `get_site` | `(slug) → site` | Structured row including hours, price, image. |
| `build_route` | `(slugs[]) → ordered_sites_with_times[]` | OSRM/Mapbox Directions. |
| `web_search` | `(query) → snippets[]` | Tavily/Brave. Disallowed for war/religious topics. |

**Hard rule (enforced in `guards.ts`):** if `type ∈ {war, religious}` or active `track == 'war'`, the agent must call `search_curated` first, answer only from returned chunks, and emit `source_citation`. If no chunks: refuse and log to `content_gaps` table.

### 5.4 Content pipeline

```
content/sites/<slug>/
  meta.yml                     (slug, name_vi, name_en, type, tracks, geom,
                                opening_hours, ticket_price_vnd, hero_image)
  vi/
    overview.md
    history.md       ← frontmatter requires source_citation for war/religious
    visit_tips.md
    culture_notes.md
  en/
    overview.md
    history.md
    visit_tips.md
    culture_notes.md
```

`scripts/ingest.ts`:
1. Scan `content/sites/*/meta.yml` → upsert `sites`.
2. Scan `content/sites/*/<lang>/<section>.md` → split ~500-token chunks → embed via `text-embedding-3-small` → upsert `site_content`.
3. Reject any war/religious section missing `source_citation` in frontmatter.
4. Triggered locally (`bun run ingest`) and via GitHub Action on merge to `main`.

## 6. Data model

```sql
-- extensions
create extension if not exists postgis;
create extension if not exists vector;

-- sites
create table sites (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_vi text not null,
  name_en text not null,
  type text not null check (type in ('war','cultural','religious','nature','food','city')),
  tracks text[] not null,
  geom geography(Point, 4326) not null,
  hero_image text,
  opening_hours jsonb,
  ticket_price_vnd int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index sites_geom_gix on sites using gist (geom);
create index sites_tracks_gin on sites using gin (tracks);

-- curated content + embeddings
create table site_content (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  lang text not null check (lang in ('vi','en')),
  section text not null check (section in ('overview','history','visit_tips','culture_notes')),
  body text not null,
  embedding vector(1536) not null,
  source_citation text,
  created_at timestamptz default now()
);
create index site_content_embedding_idx on site_content
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index site_content_site_lang_idx on site_content (site_id, lang, section);

-- agent sessions
create table agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  track text not null check (track in ('war','foreign','domestic')),
  lang text not null check (lang in ('vi','en')),
  started_at timestamptz default now()
);

create table agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references agent_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  audio_url text,
  created_at timestamptz default now()
);

-- gap tracking for editors
create table content_gaps (
  id uuid primary key default gen_random_uuid(),
  site_slug text,
  query text,
  track text,
  lang text,
  occurred_at timestamptz default now()
);
```

**Row-level security:**

| Table | Policy |
|---|---|
| `sites`, `site_content` | Public read. Service-role write only. |
| `agent_sessions`, `agent_messages` | `user_id = auth.uid()` for read/write. Anonymous sessions allowed (`user_id is null`). |
| `content_gaps` | Service-role only (server logs to it). |

## 7. Sequence diagrams (text form)

### 7.1 You-are-here story

```
Client                  /api/nearby      /api/agent/chat        Postgres        OpenAI
  │ poll geolocation         │                  │                  │              │
  ├──── GET ?lat&lng ───────►│                  │                  │              │
  │                          ├── PostGIS ───────────────────────►  │              │
  │                          │◄── sites within 0.3 km ──────────  │              │
  │◄── [vinh-moc] ──────────│                  │                  │              │
  │ banner: "You're at..."   │                  │                  │              │
  │                                                                              │
  │ tap → POST {intent:'arrival_story', site:'vinh-moc'}                        │
  ├─────────────────────────────────► (SSE open)                                │
  │                                  │ search_curated(vinh-moc,history,en)     │
  │                                  ├── pgvector ──────────────►              │
  │                                  │◄── top-k chunks ─────────                │
  │                                  │                            ┌────────────►
  │                                  │ stream(GPT-4o-mini)        │
  │◄─── token ── token ── token ─────│◄────── stream ─────────────│
  │ render + queue TTS per sentence  │                                          │
```

### 7.2 Voice question

```
Client (push-to-talk)        /api/agent/voice        OpenAI
  │ MediaRecorder webm              │                   │
  ├──── multipart POST ────────────►│                   │
  │                                 ├── Whisper ───────►│
  │                                 │◄── transcript ────│
  │                                 ├── chat (tools) ──►│
  │                                 │◄── response_text ─│
  │                                 ├── TTS-1 ─────────►│
  │                                 │◄── audio bytes ───│
  │                                 │ store in Storage  │
  │◄── {transcript, response_text, audio_url} ─────────│
  │ play audio + render text                            │
```

### 7.3 Track switch

```
Client                       Postgres
  │ user picks 'war'              │
  │ localStorage.set('track','war')
  │ POST agent_sessions {track:'war'}
  ├──────────────────────────────►│
  │ all subsequent /api/agent/* include track
  │ → system_prompt branch + WHERE tracks @> ARRAY['war']
```

## 8. Cross-cutting concerns

### 8.1 Error handling

| Failure mode | Behavior |
|---|---|
| GPS denied or unavailable | Manual site picker. App still usable as armchair guide. |
| Network drop | Service worker serves last 5 site pages + last chat thread. "Offline" banner. |
| LLM 5xx / timeout | One retry with backoff. On second fail, render raw `site_content.overview` so user is never stranded. |
| Whisper failure | Toast "couldn't hear, try text" + show text input. |
| TTS failure | Render text only. "Retry voice" button. |
| `find_nearby` empty | Broaden radius once (0.3 → 2 km). Then "no sites near you, browse map." |
| RAG returns no chunks for sensitive topic | Agent refuses, suggests editor add content, logs to `content_gaps`. |

### 8.2 Security

- Supabase RLS on every table.
- OpenAI key server-only. Never sent to the client.
- Mapbox token URL-restricted via referrer allowlist in Mapbox dashboard.
- Per-IP rate limits via Upstash Ratelimit: chat 30/min, voice 10/min, TTS 20/min.
- Input caps: chat message ≤ 4 000 chars; audio ≤ 30 s and ≤ 2 MB.
- Prompt-injection scrub on RAG chunks before insertion (`guards.ts`): regex strip `ignore previous`, role tokens (`<|im_start|>`, etc.), system markers.
- PII minimization: `user_id` only, no email or name in messages. Voice audio in Storage with 7-day TTL lifecycle rule.
- Content governance: war / religious / ethnic content requires PR review and mandatory `source_citation`; ingest script rejects missing citations.

### 8.3 Performance & cost

- Default model GPT-4o-mini. Per-session cap 8 000 tokens.
- TTS audio cached by `hash(text, voice, lang)` — repeat plays free.
- Embeddings: `text-embedding-3-small` (1536d). Computed once at ingest.
- Mapbox tile budget: terrain + satellite styles only; cache aggressively in SW.
- Vercel edge for API routes — colocation reduces VN latency.

### 8.4 Observability

- Logs: Vercel + Supabase log drains → Logflare.
- Analytics: PostHog. Events: `track_selected`, `site_viewed`, `chat_sent`, `voice_used`, `arrival_story_started`, `next_place_clicked`.
- Eval: golden-set agent eval (180 prompts) runs nightly via GitHub Action; PR fails on regression.

## 9. Verification plan

| Layer | Tooling | Examples |
|---|---|---|
| Unit | Vitest | `lib/geo.ts` haversine, ingest chunker, tool schema validation. |
| Component | Vitest + Testing Library | TrackPicker persists across reload. VoiceButton mic permission flow. ChatStream renders SSE chunks. |
| E2E | Playwright (mobile viewport) | (a) Track switch persists. (b) Mock geolocation at Vinh Moc → banner appears. (c) Text question → SSE renders + citation visible. (d) Voice flow with fixture audio → transcript + audio URL. (e) Network killed → last site page loads from SW. |
| Agent eval | Custom script | 30 prompts × 3 tracks × 2 langs = 180. Asserts tool used, citation present where required, language matches, length < 800 tokens. |
| Spatial sanity | SQL test | Seed 10 sites; assert `find_nearby` ordering matches haversine. |
| On-device manual | Redmi-class Android on 3G | Initial load < 5 s. Map ≥ 30 fps. Push-to-talk RTT < 4 s. |

## 10. Milestones

| # | Scope | Done when |
|---|---|---|
| M1 | Repo scaffold, Supabase migration, ingest Vinh Moc | DB + 1 site renders on map |
| M2 | Map view + `/api/nearby` + site detail | Tapping pin shows static story |
| M3 | Chat agent with RAG, 3 tracks, VI/EN | Text chat answers with citations |
| M4 | Voice loop (Whisper + TTS-1) | Push-to-talk works on phone |
| M5 | Itinerary builder + "next place" recommender | Route cards render on map |
| M6 | Curate + ingest top-10 sites | All 10 sites have VI+EN content reviewed |
| M7 | Eval suite, rate limits, RLS, error states, PWA polish | Ship-ready |

## 11. Open questions

- Auth model: anonymous-first vs sign-in required? Default plan: anonymous sessions, optional sign-in for saving favorites.
- Hosting region: Vercel `sin1` (Singapore) likely best for VN users — confirm with latency test before launch.
- Mapbox vs MapLibre: start with Mapbox for terrain quality; revisit at ~10k MAU when costs become material.
- Editor UX: plain markdown + Git PRs for v1; consider a lightweight CMS (Decap, Tina) at M6 if non-engineers struggle.

## 12. References

- Brainstorming plan file: `~/.claude/plans/i-need-to-build-quiet-pike.md`
- Mapbox GL JS terrain: https://docs.mapbox.com/mapbox-gl-js/guides/styles/use-3d-terrain/
- Supabase pgvector guide: https://supabase.com/docs/guides/ai
- Vercel AI SDK tools: https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
- OpenAI Whisper: https://platform.openai.com/docs/guides/speech-to-text
- OpenAI TTS: https://platform.openai.com/docs/guides/text-to-speech
