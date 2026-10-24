# Operations runbook

How the app is deployed and kept running. For first-time setup see the README;
for writing content see [CONTENT_GUIDE.md](CONTENT_GUIDE.md).

**Production:** https://quang-tri-travel-agent.dnqkhanhhcmiu.workers.dev (Cloudflare Workers, built with OpenNext)

## How a change ships

1. Open a pull request. CI (`.github/workflows/ci.yml`) runs typecheck, lint, content checks, tests and a build.
2. If those pass, the **preview** job uploads a Worker version that is not deployed and links it on the PR as
   `https://pr-<number>-quang-tri-travel-agent.dnqkhanhhcmiu.workers.dev`. Production traffic never sees it.
   Previews share production's secrets and Gemini quota.
3. Merge to `main`. The **deploy** job builds, runs `bun run deploy`, then `scripts/smoke-test.sh` against production.

A deploy that fails its smoke test is already live, so roll it back (below). Fork PRs get no secrets and skip the preview.

## Roll back

```sh
bunx wrangler deployments list      # recent versions, newest first
bunx wrangler rollback              # back to the previous version
bunx wrangler rollback <version-id> # or to a specific one
```

Then fix forward with a new PR. A rollback doesn't revert `main`, so the next merge redeploys whatever `main` holds.

## Deploy by hand (rarely needed)

```sh
bunx wrangler login     # once per machine
bun run preview         # build and run the Worker locally (reads .dev.vars)
bun run deploy          # build and deploy to production
```

`NEXT_PUBLIC_*` values are inlined at build time, so a hand deploy uses whatever is in `.env.local`.

## Where configuration lives

| What | Where | Notes |
|---|---|---|
| API keys and tokens | Cloudflare Worker secrets (`bunx wrangler secret put <NAME>`) | Survive deploys. List them with `bunx wrangler secret list`. |
| Non-secret runtime settings | `vars` in `wrangler.jsonc` | `AI_PROVIDER`, `GOOGLE_CHAT_MODEL`, `CONTENT_REQUIRE_REVIEWED`, `RATE_LIMIT`. Changing one means a deploy. |
| `NEXT_PUBLIC_*` (Mapbox, Supabase URL/anon key, PostHog) | GitHub → Settings → Secrets and variables → Actions → **Variables** | Inlined at build. |
| CI secrets | GitHub Actions **Secrets** | `CLOUDFLARE_API_TOKEN` (deploy, preview); `GOOGLE_GENERATIVE_AI_API_KEY` (nightly eval, ingest); `SUPABASE_SERVICE_ROLE_KEY` (ingest). |
| Local development | `.env.local` (Next) and `.dev.vars` (Worker preview) | Both are gitignored. Never commit keys, and never paste them into chat or issues. |

Worker secrets in use: `GOOGLE_GENERATIVE_AI_API_KEY`. Bindings: `DB` (D1) and `RL_*` (rate limits), both in
`wrangler.jsonc`. Optional, not needed to stay free: `OPENAI_API_KEY` (server TTS; paid), `UPSTASH_REDIS_REST_TOKEN`,
`SUPABASE_SERVICE_ROLE_KEY`, `MAPBOX_SECRET_TOKEN`, `TAVILY_API_KEY`.

## Rotate a key

Gemini (do this whenever a key may have been exposed):

1. https://aistudio.google.com/apikey: create a new key, then delete the old one.
2. `bunx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY` and paste the new key. It takes effect immediately; no deploy needed.
3. Update the GitHub Actions secret of the same name, and your `.env.local` / `.dev.vars`.

Cloudflare API token (used by CI): create a new token from the "Edit Cloudflare Workers" template at
https://dash.cloudflare.com/profile/api-tokens, run `gh secret set CLOUDFLARE_API_TOKEN`, then delete the old token.

## When something goes wrong

| Symptom | Likely cause | What to do |
|---|---|---|
| Chat says "The guide is having trouble right now" | Gemini error. Check `bunx wrangler tail --format json` for the message. | See the rows below. |
| `quota exceeded` / 429 in the logs | Gemini free-tier limit | Nothing breaks: the visitor is told the free allowance is used up, and later questions get curated excerpts ("The AI guide has reached its free limit for now") until Google's retry time passes (10 minutes if it gives none). Full answers resume by themselves. Enabling billing on the Gemini key removes the limit, but then it costs money. |
| `User location is not supported for the API use` | The Worker ran somewhere Gemini rejects | Check `placement` in `wrangler.jsonc` is still `{ "mode": "targeted", "region": "gcp:us-central1" }`. |
| Answers are "offline mode" excerpts | No AI key reached the Worker | `bunx wrangler secret list` should show `GOOGLE_GENERATIVE_AI_API_KEY`. |
| Map shows no tiles | `NEXT_PUBLIC_MAPBOX_TOKEN` was missing at build | Set the GitHub variable, then redeploy (merge, or re-run the deploy job). |
| Someone is draining the quota | Too many requests from one place | Per-IP limits run on Cloudflare's free rate-limit bindings (below); tighten them in `wrangler.jsonc`. |
| A deploy broke production | | Roll back (above), then fix forward. |

Live logs: `bunx wrangler tail` (add `--format json` for full error details).

## Everything runs on free tiers

| Piece | Free service | What happens at the limit |
|---|---|---|
| Hosting | Cloudflare Workers (100,000 requests/day, 10 ms CPU each) | Requests fail; no bill on the free plan |
| AI answers | Gemini API free tier, no billing account | Curated excerpts instead of model answers (see above) |
| Rate limiting | Cloudflare rate-limit bindings (`RL_*` in `wrangler.jsonc`) | Visitors over a limit get 429 for up to a minute |
| Feedback storage | Cloudflare D1 `quang-tri-feedback` (5 GB, 100,000 writes/day) | Inserts fail and are logged instead |
| Photos, scripts, styles | Cloudflare static assets | Not counted against request limits |
| CI and previews | GitHub Actions (public repo) | — |

Nothing here has a payment method attached, so none of it can produce a bill. Upstash, Supabase, Mapbox, OpenAI
and PostHog are supported by the code but **not** needed; leave their keys unset to stay free.

## Rate limiting

Per-IP limits (`lib/rate-limit.ts`) use Cloudflare's free rate-limit bindings: one binding per endpoint in
`wrangler.jsonc` (`RL_CHAT`, `RL_VOICE`, …), counted per minute and keyed on Cloudflare's `cf-connecting-ip`,
which callers can't spoof. Keep the numbers in `wrangler.jsonc` and `LIMITS` in step. Upstash is used instead
only if `UPSTASH_REDIS_REST_URL` is set.

## Editor feedback (D1)

The Report button and unanswerable questions are stored in the free D1 database `quang-tri-feedback`
(schema in `migrations/d1`). Read them with:

```sh
bunx wrangler d1 execute quang-tri-feedback --remote --command \
  "SELECT created_at, reason, site_slug, question, note FROM answer_reports ORDER BY created_at DESC LIMIT 20"
bunx wrangler d1 execute quang-tri-feedback --remote --command \
  "SELECT occurred_at, site_slug, lang, query FROM content_gaps ORDER BY occurred_at DESC LIMIT 20"
```

A schema change is a new file in `migrations/d1`, applied with
`bunx wrangler d1 migrations apply quang-tri-feedback --remote` (add `--local` for `bun run preview`).

## Content, quizzes and photos

- **Content review:** sections, tours and quizzes ship as `review_status: draft`. To publish one, set it to
  `reviewed` in a PR. With `CONTENT_REQUIRE_REVIEWED=true` in `wrangler.jsonc`, drafts are hidden from production:
  the agent ignores draft sections, and draft quizzes don't appear. Turn it on once the content you need is reviewed.
- **Quizzes:** `content/sites/<slug>/quiz.yml`. `bun run content:check` validates them; every answer must be stated
  in the `source` section.
- **Photos:** set `photo.file` (an exact Wikimedia Commons file name) in `lib/sample-sites.ts`, then run
  `bun run photos:fetch`. It refuses licences that don't allow reuse (NC, ND, GFDL) and writes
  `public/photos/<slug>-{480,1200}.webp` plus `lib/photo-credits.json`. Commit both. `bun run photos:fetch --force`
  re-fetches everything.
- **Search index (Supabase):** after content changes, the "Ingest content" workflow re-embeds on `main` when its
  secrets are set and all content is reviewed. Switching AI provider changes the embedding space, so re-ingest then too.

## Checks worth running before a release

```sh
bun run typecheck && bunx eslint app components lib scripts tests && bun run content:check && bun run test
bun run eval --tracks war --langs vi   # live answers; uses Gemini quota
```
