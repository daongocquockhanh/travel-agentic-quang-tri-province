# Content guide — curating Quảng Trị sites

The agent answers war, religious and ethnic questions **only** from the files in
`content/sites/`. This guide is for the editors who write and review them.

## Layout

```
content/sites/<slug>/
  meta.yml            names, type, tracks, coordinates, hours (must match lib/sample-sites.ts)
  vi/overview.md      required
  vi/history.md       required
  vi/visit_tips.md    required
  vi/culture_notes.md optional (etiquette, rituals, food)
  vi/tour.md          optional audio tour script (see "Audio tours")
  en/…                the same sections as vi/
```

## Frontmatter

```yaml
---
section: history # must match the file name
lang: en # must match the folder
source_citation: "Human-readable citation shown on the citation chip."
sources: # the URLs behind the citation (first one is linked)
  - https://…
review_status: draft # draft | reviewed
last_verified: 2026-10-06 # when the facts were last checked against the sources
---
```

`source_citation` is **required** on `overview`, `history` and `culture_notes` for
`war` and `religious` sites.

## Review workflow

1. Open a PR that changes or adds content. Run `bun run content:check` locally.
2. A reviewer checks each fact against the listed `sources`, in **both** languages,
   and checks tone (see below).
3. The reviewer sets `review_status: reviewed` and updates `last_verified` in the
   same PR. War, religious and ethnic content needs a reviewer other than the author.
4. Production ingest runs with `INGEST_REQUIRE_REVIEWED=1`, which refuses to ingest
   while any section is a draft, and the app runs with
   `CONTENT_REQUIRE_REVIEWED=true`, so drafts never reach the agent.

Until then, drafts are shown in the app with a **Draft / Bản nháp** label, and
citations drawn from them are marked "draft" in chat.

## Tone and accuracy

- Neutral and respectful. Acknowledge loss on all sides; no glorifying, no "sides" framing.
- Attribute contested figures ("according to Vietnamese sources…"); don't state them as fact.
  Casualty and bombing totals in particular differ between sources.
- Frame religious accounts as belief ("according to Catholic tradition…") without
  passing judgement on them.
- Avoid prices and exact opening hours in prose; they live in `meta.yml` and change.
- Use the current administrative geography: since 1 July 2025 Quảng Trị includes the
  former Quảng Bình, the provincial centre is Đồng Hới, and districts no longer exist
  ("the former Vĩnh Linh district").
- Where sources disagree (e.g. the length of Hiền Lương Bridge), leave the detail out
  or give a rounded figure.

## Audio tours

Every place has an audio tour (`/site/<slug>/tour`). Without a script, the tour
reads the sections aloud: overview, history one paragraph at a time, customs,
then visit tips. A `tour.md` script replaces that with narration written for
listening on the spot:

```markdown
---
section: tour
lang: en
review_status: draft
based_on: [overview, history, visit_tips] # the sections this script retells
---

## A village that moved underground

> At the entrance, by the small museum

You are standing on a low bluff above the East Sea…
```

- Each `## ` heading is a stop. The optional `>` line under it says where to
  stand, and the app shows it with a pin.
- Aim for 4–6 stops of 60–120 words each. Write for the ear: short sentences,
  "you", and the present tense.
- **Retell only what the `based_on` sections say.** The script has no sources of
  its own. The tour shows the citations of the sections it is based on, so a new
  fact belongs in those sections first, with its source.
- Write the script in both languages, with the same number of stops.
- A tour counts as reviewed only when the script and every section it is based
  on are reviewed. Check the script against those sections, not just for tone.
- Scripts are not embedded for the chat agent (ingest skips `tour.md`), because
  their facts are already in the sections.

## Status (M6)

All ten MVP sites have VI + EN drafts. They were researched from the sources listed
in each file (via search summaries; the pages themselves were not opened), and **none
has been editorially reviewed yet**. `bun run content:check` prints the review status
per site.
