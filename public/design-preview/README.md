# Design Preview

Browseable design assets, served by the Next.js dev server.

## How to view

1. Run dev server: `bun run dev`
2. Open: http://localhost:3001/design-preview/

## Layout

```
public/design-preview/
  index.html              ← navigation hub
  README.md               ← this file
  _system/                ← imported Claude Design system (tokens, components, kit)
    README.md
    SKILL.md
    colors_and_type.css
    assets/
    preview/              ← static HTML token & component previews
    ui_kits/pwa/          ← clickable PWA prototype (React via Babel-standalone)
```

## Add a per-screen export later

Drop a folder + `index.html` (and any CSS/PNG assets) here, then add a card to `index.html`. Example:

```
public/design-preview/
  map-home/
    index.html
    style.css
```

Linked from the hub at `/design-preview/map-home/`.

## Note

This folder is intentionally inside `public/` so the Next.js dev server serves it during development. Before production, gate behind a middleware redirect or move to a separate static host.
