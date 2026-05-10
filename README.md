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

See `docs/SYSTEM_DESIGN.md` §10. Currently at **M1: scaffold + Vinh Moc seed**.
