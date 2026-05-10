# PWA UI kit — Quang Tri Travel

The single product surface: a mobile PWA with three audience tracks (war, foreign, domestic).

## Files
- `index.html` — interactive prototype with screen toolbar
- `components.jsx` — `TrackChip`, `Btn`, `Bilingual`, `VoiceButton`, `SiteCard`, `Citation`, `Bubble`, `Pill`, `GeofenceBanner`, `Icon`, `TrackIcon`
- `screens.jsx` — `TrackPicker`, `MapHome`, `SiteDetail`, `Chat`, sample `SITES` data
- `ios-frame.jsx` — device shell

## Screens covered
1. Onboarding — track picker
2. Map home — full-bleed terrain, top chrome (track + language), geofence banner, three-snap bottom sheet with nearby list
3. Site detail — hero with protection gradient, quick facts, tabs, body, citations, sticky "ask"
4. Chat — bilingual header, streaming bubbles + tool trace, citation chips, quick-reply pills, push-to-talk voice button with all states

## Caveats
- Map is rendered as a stylised SVG, not a real Mapbox tile.
- Site imagery is gradient placeholders — copy in real photos as `assets/sites/<slug>.jpg`.
- Tabs in `SiteDetail` are visual only; "History" is hardcoded as the active tab.
