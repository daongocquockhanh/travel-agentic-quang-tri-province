# Design Brief — Quang Tri Travel Agent

Paste this into Claude Design (https://claude.ai/design) to generate UI mockups and a design system for the app.

---

## Product summary

A mobile-first PWA that acts as a location-aware AI travel agent for **Quang Tri Province, Vietnam**. Three audience tracks share one app:

1. **War-history pilgrims** — visit DMZ, Vinh Moc tunnels, Khe Sanh, Truong Son cemetery. Solemn, respectful tone.
2. **Foreign tourists** — discover the province in 1–3 days. Curious, exploratory tone.
3. **Domestic Vietnamese tourists** — practical logistics, hidden spots, family travel. Friendly, efficient tone.

Core capabilities: 3D terrain map · "you-are-here" geo-anchored stories · "next place" recommender · bilingual chat (VI / EN) · push-to-talk voice · grounded RAG agent.

## Brand & emotional direction

- **Atmosphere:** quiet dignity. The province carries deep history (war, religion, ethnic minorities). The UI should feel respectful, never gamified, never carnival-bright.
- **Personality:** trustworthy local guide, not a chatbot mascot. Confident, knowledgeable, soft-spoken.
- **Aesthetic anchors:** mist over the Truong Son range · weathered concrete of Vinh Moc tunnels · Hien Luong bridge yellow + blue contrast · La Vang basilica off-white · Thach Han river greens · DMZ minimalism.
- **Avoid:** beach-resort kitsch, war-tourism shock imagery, generic "Asian travel app" clichés (red lanterns, dragon motifs).

## Color direction (proposal — let Claude Design refine)

| Role | Color | Notes |
|---|---|---|
| Primary | Deep teal `#0F4C5C` | Thach Han river, Truong Son shadows |
| Secondary | Warm sand `#E5D5B7` | DMZ earth, La Vang stucco |
| Accent | Hien Luong yellow `#F2A73A` | Bridge, ribbon for war-track |
| Neutral dark | Charcoal `#1F2428` | Body text |
| Neutral light | Off-white `#F7F4EE` | Background |
| Track tints | War: ochre · Foreign: teal · Domestic: green-leaf |

## Typography direction

- **Display / titles:** a serif with restraint (e.g., Source Serif, Newsreader, Tinos) — historical gravity without being a museum plaque.
- **Body:** humanist sans (Inter, IBM Plex Sans VN, Be Vietnam Pro) — must support full Vietnamese diacritics cleanly.
- **Mono:** for citations and timestamps only.
- **Vietnamese:** test all type with `Việt Nam · Quảng Trị · Vĩnh Mốc · Hội An · Đông Hà` — diacritics must not collide.

## Screens to mock up (priority order)

1. **Onboarding / track picker.** Three large cards: war pilgrim · foreign tourist · domestic VN. Each card has a hero image, one-line value prop in VI + EN, and a "Begin" CTA.
2. **Map home.** Full-screen Mapbox 3D terrain. Bottom sheet collapses/expands. Top: track chip (switch tracks). Bottom sheet: list of nearby sites, "ask anything" chat input, voice button.
3. **You-are-here banner.** When user enters a site geofence (~300 m), a banner slides up: "You're at Vinh Moc Tunnels — tap to hear the story." Two CTAs: "Play" and "Read".
4. **Site detail.** Hero image. Site name VI + EN. Quick facts row (open hours, ticket price, drive time). Tabs: Overview · History · Visit tips · Culture notes. Each section ends with citation chip(s). Floating "Ask about this place" voice button.
5. **Chat (full-screen).** Streaming bubbles. Citation chips inline. Push-to-talk button (large, bottom-center). Track chip top-left. Language toggle top-right. Quick-reply pills above input ("Plan tomorrow", "Find food nearby", "Tell me about the war here").
6. **Itinerary cards.** After a story, three "next place" suggestion cards with: thumbnail, title, drive time, why-this-fits-you reason, "Add to plan" button.
7. **Settings / language.** VI ↔ EN toggle. Voice picker (Vietnamese male/female, English male/female). Track switch. Privacy note about location.
8. **Empty / offline / error states.** Friendly, not alarmed. Includes "GPS denied", "Offline", "No nearby sites within 2 km".

## Components needed

- Track chip (3 colors, with icon)
- Citation chip (clickable, opens source)
- Voice button states: idle · recording · transcribing · speaking · error
- Geofence banner (slide-up)
- Bottom sheet (3 snap points: peek, half, full)
- Site card (used in nearby list and itinerary)
- Chat bubble (user / assistant / tool / citation)
- Quick-reply pill row
- Bilingual title block (VI primary + EN secondary, or swap by setting)

## Interaction notes

- Voice is first-class. Push-to-talk button must be reachable with thumb on a 6.7" phone.
- Citations are not buried. War/religious answers always show source chip(s).
- Track choice colors small accents (chip, banner edge) — do **not** repaint the whole UI per track.
- Typography must hold Vietnamese diacritics in headlines without crashing into stacked accents.
- Animation: gentle. No spring bounces. Slow ease-out fades.

## Out of scope for first design pass

- Hotel/tour booking flows.
- AR camera overlays.
- Native iOS/Android navigation patterns (this is PWA).
- French / Korean / Chinese / Japanese.

---

## How to use this in Claude Design

1. Open https://claude.ai/design in browser (signed in, Pro / Max / Team / Enterprise).
2. New project → paste this brief into the prompt.
3. Pick `?setup=design-system` flow.
4. Upload reference photos if you have them: Vinh Moc tunnels, Hien Luong bridge, Truong Son cemetery, Thach Han river, La Vang basilica.
5. Generate design system (colors, type, components).
6. Generate screens 1–8 in order.
7. Iterate.
8. Export: HTML or share link. Save the system as `docs/DESIGN.md` or a Figma link in this repo.
9. Pass exported HTML/CSS back to Claude Code — I implement in Next.js (Tailwind + shadcn/ui) for M2.
