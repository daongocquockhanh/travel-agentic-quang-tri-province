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

Worker secrets in use: `GOOGLE_GENERATIVE_AI_API_KEY`. Optional: `OPENAI_API_KEY` (enables server TTS),
`UPSTASH_REDIS_REST_TOKEN` (with `UPSTASH_REDIS_REST_URL` in `vars`), `SUPABASE_SERVICE_ROLE_KEY`, `MAPBOX_SECRET_TOKEN`, `TAVILY_API_KEY`.

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
| `quota exceeded` / 429 in the logs | Gemini free-tier limit (per minute or per day) | Wait for the window to reset. For lasting relief, enable billing on the Gemini key, or switch model with `GOOGLE_CHAT_MODEL` in `wrangler.jsonc`. |
| `User location is not supported for the API use` | The Worker ran somewhere Gemini rejects | Check `placement` in `wrangler.jsonc` is still `{ "mode": "targeted", "region": "gcp:us-central1" }`. |
| Answers are "offline mode" excerpts | No AI key reached the Worker | `bunx wrangler secret list` should show `GOOGLE_GENERATIVE_AI_API_KEY`. |
| Map shows no tiles | `NEXT_PUBLIC_MAPBOX_TOKEN` was missing at build | Set the GitHub variable, then redeploy (merge, or re-run the deploy job). |
| Someone is draining the quota | No shared rate limit | Set up Upstash (below). Without it, limits only count per Worker isolate. |
| A deploy broke production | | Roll back (above), then fix forward. |

Live logs: `bunx wrangler tail` (add `--format json` for full error details).

## Rate limiting (Upstash)

Without Upstash, `lib/rate-limit.ts` counts in memory per Worker isolate, which is not a real limit on Cloudflare.
To enable it: create a free Redis database at https://upstash.com, add `UPSTASH_REDIS_REST_URL` to `vars` in
`wrangler.jsonc`, run `bunx wrangler secret put UPSTASH_REDIS_REST_TOKEN`, and deploy. Limits key on Cloudflare's
`cf-connecting-ip`, which callers can't spoof.

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
