# Gloomhaven Initiative Tracker

A small browser-based initiative tracker for Gloomhaven, inspired by the physical initiative tracker in Frosthaven.

- Enter character names and pick a scenario. The scenario's monster types appear as nameplates.
- Drag nameplates to set the initiative order, by touch, mouse or keyboard.
- Park defeated or not-yet-revealed nameplates in an inactive area.
- The game state survives a refresh because it is saved in your browser.
- No install, no account and no backend. It's a static page.

**Status:** planning. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Run locally

There is no build step. Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. A server is needed because browsers block ES modules on `file://`.

## Credits

Scenario and monster names are derived from the game data of [Gloomhaven Secretariat](https://github.com/Lurkars/gloomhavensecretariat) by Lurkars (AGPL-3.0). See [DATA_SOURCES.md](DATA_SOURCES.md).

## License

Copyright (C) 2026 Milica Krivokapic

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3 or later. See [LICENSE](LICENSE).

## Disclaimer

This is an unofficial fan tool, not affiliated with or endorsed by Cephalofair Games. *Gloomhaven* and all related properties, names and text are owned by Cephalofair Games. This app contains no game art, stats, card text or rules text.
