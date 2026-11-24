# Gloomhaven Initiative Tracker

A small browser-based initiative tracker for **Gloomhaven (1st edition)**, inspired by the physical initiative tracker in Frosthaven.

- Enter character names and pick one of the 95 scenarios. The scenario's monster types appear as nameplates in the inactive area.
- Drag nameplates to set the initiative order. On touch screens, drag by the dotted grip. The ↑ ↓ buttons and keyboard work too.
- Park defeated or not-yet-revealed nameplates in the inactive area. Add summons or spawned monsters by name.
- The game state is saved in your browser, so it survives a refresh or a closed tab.
- It works offline after the first visit. No install, no account and no backend: it's a static page of about 10 KB gzipped, plus 3.4 KB of scenario data.

Design notes are in [ARCHITECTURE.md](ARCHITECTURE.md), and the data research is in [DATA_SOURCES.md](DATA_SOURCES.md).

## Run locally

There is no build step and there are no dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. A server is needed because browsers block ES modules on `file://`.

Offline support (`sw.js`) is switched off on localhost so you always get fresh files. Open http://localhost:8000/?sw to test it.

## Tests

The state logic has unit tests that run with Node's built-in test runner (Node 20 or later):

```bash
npm test
```

## Regenerating scenario data

`data/scenarios.json` is generated from [Gloomhaven Secretariat](https://github.com/Lurkars/gloomhavensecretariat) and committed to the repo. To rebuild it, for example after upstream fixes:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Lurkars/gloomhavensecretariat.git vendor/ghs
git -C vendor/ghs sparse-checkout set data/gh
npm run build:data
```

The script reads only `data/gh` (1st edition) and stops with an error if any file isn't 1st edition or if scenarios 1–95 aren't all present. `vendor/` is git-ignored.

## Releasing

Whenever any app file changes, bump `CACHE_VERSION` in [sw.js](sw.js). Otherwise returning players keep the cached old version. If you add a file, add it to the `FILES` list there too.

## Hosting

It's a static site, so any static host works: GitHub Pages, Netlify or Cloudflare Pages. All paths are relative, so it also works from a subpath like `/initiative-order-tracker/`.

## Credits

Scenario and monster names are derived from the game data of [Gloomhaven Secretariat](https://github.com/Lurkars/gloomhavensecretariat) by Lurkars (AGPL-3.0). See [DATA_SOURCES.md](DATA_SOURCES.md).

## License

Copyright (C) 2026 Milica Krivokapic

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3 or later. See [LICENSE](LICENSE).

## Disclaimer

This is an unofficial fan tool, not affiliated with or endorsed by Cephalofair Games. *Gloomhaven* and all related properties, names and text are owned by Cephalofair Games. This app contains no game art, stats, card text or rules text.
