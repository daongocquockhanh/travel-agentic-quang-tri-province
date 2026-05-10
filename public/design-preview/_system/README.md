# Quang Tri Travel — Design System

A design system for a mobile-first PWA that acts as a **location-aware AI travel agent for Quang Tri Province, Vietnam**. Three audience tracks share one product: war-history pilgrims, foreign tourists, and domestic Vietnamese tourists.

> _"Quiet dignity. Trustworthy local guide. Mist over the Truong Son range."_

---

## Sources

| Source | Path | Status |
|---|---|---|
| Design brief | `docs/DESIGN_BRIEF.md` (mounted) | Read ✅ |
| System design | `docs/SYSTEM_DESIGN.md` (mounted) | Read ✅ |
| Repo: `daongocquockhanh/travel-agentic-quang-tri-province` | GitHub `main` / `master` | **Empty repo (409).** No source code or assets to lift from. |

Because the repo is empty, this system is derived **entirely from the written brief**. All visual design (colors, type, components) is a fresh interpretation of the brief's "atmosphere" guidance — there are no production screens to mimic. Flag for the user: when real screens exist, this system should be reconciled against them.

---

## Product context

A single PWA with three audience "tracks":

1. **War-history pilgrims** — DMZ, Vinh Moc tunnels, Khe Sanh, Truong Son cemetery. Solemn, respectful tone. Citations mandatory.
2. **Foreign tourists** — 1–3 day discovery. Curious, exploratory tone. Bilingual.
3. **Domestic Vietnamese tourists** — practical logistics, hidden spots, family travel. Friendly, efficient tone.

Core capabilities: 3D terrain map · "you-are-here" geo-anchored stories · "next place" recommender · bilingual chat (VI / EN) · push-to-talk voice · grounded RAG.

The product is **one app**, not three. Track choice tints small accents (chip, banner edge) — it does **not** repaint the UI.

---

## Index

| File | What's inside |
|---|---|
| `README.md` | This document. Brand context, content & visual foundations, iconography. |
| `colors_and_type.css` | All design tokens — color, type, spacing, radius, shadow, motion. |
| `fonts/` | Local fallbacks. Primary fonts loaded via Google Fonts CDN. |
| `assets/` | Logo lockups, track icons, placeholder imagery. |
| `preview/` | Cards rendered into the Design System tab. |
| `ui_kits/pwa/` | The single product UI kit — track picker, map home, site detail, chat, components. |
| `SKILL.md` | Cross-compatible Agent Skill front matter for download/reuse. |

There are no slide templates in the source materials, so `slides/` is intentionally absent.

---

## CONTENT FUNDAMENTALS

The brief defines tone explicitly per track. The shared spine across all tracks:

### Voice
- **Trustworthy local guide, not a chatbot mascot.** Confident, knowledgeable, soft-spoken.
- **Never gamified, never carnival-bright.** No "🎉 Welcome adventurer!" energy. No exclamation marks except in genuinely warm moments.
- **Pronouns:** "you" addresses the traveller. The agent narrates in first person sparingly ("I can take you there next") — it is a guide, not a friend.

### Tone per track
| Track | Tone | Example opener |
|---|---|---|
| War | Solemn, factual, precise with names and dates. Always cited. | _"You are standing on the southern bank of the Ben Hai River. From 1954 to 1972, this was the dividing line."_ |
| Foreign | Curious, contextual, lightly explanatory. | _"Quang Tri is small but layered — most people pass through in a day. Here are three places worth slowing down for."_ |
| Domestic | Direct, practical, logistics first. | _"Cua Tung lúc sáng sớm vắng nhất. Bãi tắm mở từ 5h, vé 30.000đ, bãi gửi xe ngay cổng."_ |

### Casing & punctuation
- **Sentence case** for all UI strings. Never Title Case For Buttons.
- **No emoji in product copy.** Emoji feel performative against the brief's "quiet dignity". Reserved exceptions: nothing.
- **No exclamation marks** in system messages, error states, or war-track content. Permitted sparingly in foreign / domestic copy when genuinely warm.
- Vietnamese diacritics are sacred — never strip, never substitute (`Quảng Trị` not `Quang Tri` in product strings).
- Bilingual blocks: VI primary, EN secondary, separated by ` · ` or stacked. Example:
  > **Địa đạo Vĩnh Mốc**
  > _Vinh Moc Tunnels_

### Length
- **Banner / chip / button:** ≤ 24 chars VI, ≤ 28 chars EN.
- **Site quick fact:** ≤ 60 chars per row.
- **Chat answer:** target 2–4 short paragraphs. War-track refusals are one sentence.
- **Citation chips:** show source name only (e.g. "Bảo tàng Quảng Trị · 2019"), full URL on tap.

### Examples — DO / DON'T

| Don't | Do |
|---|---|
| "Welcome to Quang Tri! 🇻🇳 Ready to explore?" | "Quảng Trị · Quang Tri. Pick where you want to start." |
| "Oops! We couldn't find your location 😅" | "Location unavailable. You can browse the map manually." |
| "Check out this AWESOME war tunnel!" | "Vinh Moc Tunnels — built 1965–1966, sheltered ~600 villagers." |
| "Hey there! What can I help with today?" | "Ask about a place, a route, or a piece of history." |

---

## VISUAL FOUNDATIONS

### Atmosphere
Mist over the Truong Son range. Weathered concrete of Vinh Moc tunnels. Hien Luong bridge yellow + blue contrast. La Vang basilica off-white. Thach Han river greens. **Avoid**: beach-resort kitsch, war-tourism shock imagery, red-lantern / dragon "Asian travel app" clichés, bluish-purple gradients.

### Color
- **Primary** — Deep teal `#0F4C5C` (Thach Han river, Truong Son shadows).
- **Secondary** — Warm sand `#E5D5B7` (DMZ earth, La Vang stucco).
- **Accent** — Hien Luong yellow `#F2A73A` (used sparingly; war-track ribbon and key CTAs only).
- **Ink** — Charcoal `#1F2428`. **Paper** — Off-white `#F7F4EE`.
- **Track tints** — War: ochre `#B07A2A` · Foreign: teal `#0F4C5C` · Domestic: leaf green `#3F6B3A`. Used as 2 px chip border, banner edge, and citation chip key — never as full background.
- **Imagery vibe:** warm, slightly desaturated, soft grain. **No pure black, no pure white.** Photos should feel like they're held in fog, not strobe-lit.

### Type
- **Display / titles:** **Newsreader** (serif). Restrained, with full Vietnamese diacritic support. Used for site names, screen titles, and large metadata.
- **Body / UI:** **Be Vietnam Pro** (humanist sans). Designed for VN diacritics; tested at body sizes against `Việt Nam · Quảng Trị · Vĩnh Mốc · Hội An · Đông Hà`.
- **Mono:** **JetBrains Mono**. Citations, timestamps, geofence coordinates only.
- **Scale:** see `colors_and_type.css`. Body 16 px / 1.55 line-height. Display tracks slightly tight (`-0.01em`).
- **Bilingual stacks:** VI in display weight, EN below in body italic at 0.85× size.

### Spacing
4 px base. Tokens at 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80. Mobile gutters 16 px. Bottom-sheet snap points are spacing-aware — `peek = 96 px`, `half = 50vh`, `full = calc(100vh - 56px)`.

### Backgrounds
**No gradients.** Flat off-white `#F7F4EE` is the default. Map screens are full-bleed Mapbox terrain. Hero images bleed to the edge with a 24 px protection gradient at the bottom only (`linear-gradient(to top, rgba(31,36,40,0.55), transparent)`) — never on top, never on sides. **No repeating patterns, no textures, no decorative imagery.** The brief is explicit: dignity comes from restraint.

### Animation
- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` (slow ease-out). One easing across the system.
- **Durations:** 180 ms (micro — chip select, button press), 240 ms (small — banner slide), 360 ms (medium — sheet snap, page transition), 600 ms (large — map fly-to). Nothing longer.
- **No spring bounces. No scale-up enters.** Banners slide up 12 px and fade. Sheets snap. Cards fade-and-translate-4 px.
- **Voice button** is the one exception: idle has a 1.6 s breathing pulse (opacity 1 → 0.7 → 1) so the user knows mic is ready.

### Hover / press / focus
- **Hover (pointer devices):** background darkens 4% (`color-mix(in oklch, var(--bg-card) 96%, var(--ink))`). No translation, no shadow change.
- **Press:** background darkens 8% AND scale 0.98 for 100 ms. No ripple.
- **Focus:** 2 px ring at `--accent`, offset 2 px. Always visible, never `outline: none`.
- **Disabled:** 40% opacity, no pointer events. Never gray out and lock.

### Borders, radii, shadows
- **Radius scale:** `2 / 6 / 10 / 16 / 24 / 999`. Cards `10`. Buttons `999` (pill) for primary, `10` for secondary. Bottom sheet `24` (top corners only). Chips `999`.
- **Borders:** `1px solid color-mix(in oklch, var(--ink) 12%, transparent)`. Track chips use 2 px borders in their track tint.
- **Shadows:** two-tier system. `--shadow-soft` for resting cards (very subtle, 8 px y-offset, 24 px blur, 6% ink). `--shadow-lift` for popovers, voice button, and the bottom sheet (16 px y, 40 px blur, 12% ink). **No drop-shadow on map pins** — pins use a 2 px white halo instead.
- Never use both border AND heavy shadow on the same element. Bordered cards lay flat; shadowed cards are borderless.

### Transparency & blur
- Used **only** for the geofence banner (`backdrop-filter: blur(12px)` over the map) and the bottom sheet handle area. Everywhere else uses solid fills. Translucency over photography is the rare exception, never a default.

### Layout rules
- **Fixed elements:** track chip top-left (16 px from edges), language toggle top-right, push-to-talk button bottom-center (centered, 24 px from bottom, 64 px diameter).
- **Bottom sheet** is the dominant pattern on map and site detail. Three snap points: peek / half / full.
- **Safe areas:** every fixed element respects `env(safe-area-inset-*)`. Mocks should show this.
- **Single-column on phone** (390 px design width). Tablet+ layouts are out of scope per the brief.

### Cards
Flat off-white `#F7F4EE`, 1 px hairline border, 10 px radius, 16 px padding. Hero image (if any) bleeds to the card edges and inherits the radius. **No card shadow at rest** — shadow appears only on the focused / dragged card in the bottom-sheet list.

### Capsules vs. protection gradients
- **Capsules** (pill backgrounds) are used for chips, citation marks, quick-reply pills, and language toggles.
- **Protection gradients** are used over photography only (bottom-edge fade as described above). They do not appear over flat color.

### Imagery direction
Warm but desaturated. Slight grain. No saturation pumping. Subjects: landscape over architecture, architecture over people, people only when contextually necessary (and never centered). The brief is clear: no shock imagery from war sites. Use wide environmental shots, not graphic close-ups.

---

## ICONOGRAPHY

The repo is empty, so there is no in-house icon system to lift. Substitute documented below.

### System
**Lucide** (CDN), 1.5 px stroke, rounded line-cap, currentColor.
- Justification: thin, neutral, secular — fits "quiet dignity" without religious or military connotations.
- Loaded inline via SVG (the kit copies the specific icons it uses into `assets/icons/` so the system is self-contained).
- **Track icons** are bespoke — see below.

### Track icons (custom)
Three small, abstract glyphs to mark each track. Stroke 1.75 px, 24×24, single color. They are **not literal** (no helmet, no backpack, no rice bowl):

| Track | Glyph |
|---|---|
| War | A horizon line bisected by a vertical bar — the 17th-parallel split. |
| Foreign | A compass-rose 8-point asterisk, simplified. |
| Domestic | A roof-and-road glyph — pitched roof over a horizontal line. |

Stored as SVG in `assets/icons/track-*.svg`. They carry the track tint as `currentColor`.

### Logo
A wordmark + monogram lockup created for this system (no brand mark exists in the brief). `assets/logo/` contains:
- `logomark.svg` — the "QT" monogram, deep teal.
- `wordmark.svg` — `Quảng Trị` in Newsreader medium, lockup with subtitle `travel agent`.
- `lockup.svg` — both side by side, the default app-bar usage.

Flag for the user: replace these with the official mark when one exists.

### Emoji & unicode
**Emoji are not used** in product copy or UI. Unicode separators are used: ` · ` (middle dot, U+00B7) for inline meta, `↗` (U+2197) for external citation links, `→` for "next place" affordances. That's the whole set — no other unicode glyphs appear in UI.

### Photography / illustration
No illustrations in the system. Hero imagery is photography only (warm, desaturated, grainy — see Visual Foundations). Placeholder gradients use `--ink-12` flat blocks with the site name in Newsreader, never decorative SVG fillers.

---

## Font substitutions — flag for user

| Role | Used | Brief asked for | Status |
|---|---|---|---|
| Display | **Newsreader** (Google Fonts) | "Source Serif, Newsreader, Tinos" | ✅ exact match |
| Body | **Be Vietnam Pro** (Google Fonts) | "Inter, IBM Plex Sans VN, Be Vietnam Pro" | ✅ exact match |
| Mono | **JetBrains Mono** (Google Fonts) | _unspecified_ | ✅ acceptable, has VN diacritics |

All three load from Google Fonts CDN. If you want them self-hosted, drop the `.woff2` files in `fonts/` and update the `@font-face` block at the top of `colors_and_type.css`.

---

## File index

```
.
├── README.md                     ← you are here
├── SKILL.md                      ← Agent Skill front matter (cross-compatible)
├── colors_and_type.css           ← all design tokens
├── fonts/                        ← (empty — fonts loaded from Google Fonts CDN)
├── assets/
│   ├── logo/{logomark, wordmark, lockup}.svg
│   └── icons/
│       ├── sprite.svg            ← Lucide icons used by the kit
│       └── track-{war, foreign, domestic}.svg
├── preview/                      ← cards rendered into the Design System tab
│   ├── brand-logo.html
│   ├── colors-{brand, ink-paper, track-tints, semantic}.html
│   ├── type-{display, body, vietnamese}.html
│   ├── spacing-scale.html  ·  radii-and-shadow.html  ·  motion.html
│   ├── iconography.html
│   └── components-{buttons, track-chips, citation, voice-button, site-card, chat, geofence-banner, inputs, quick-facts}.html
└── ui_kits/
    └── pwa/
        ├── index.html            ← clickable prototype (toolbar switches screens)
        ├── README.md
        ├── components.jsx        ← TrackChip, Btn, Bilingual, VoiceButton, SiteCard, Citation, Bubble, Pill, GeofenceBanner
        ├── screens.jsx           ← TrackPicker, MapHome, SiteDetail, Chat
        └── ios-frame.jsx         ← device shell
```

There are no `slides/` because the brief did not include slide templates.

