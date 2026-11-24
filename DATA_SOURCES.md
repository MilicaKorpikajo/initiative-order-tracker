# Scenario data sources: research findings

Researched on 2026-11-24. Every claim below comes from inspecting the repositories and files themselves, except where it is marked as unverified.

## Summary

- **There is no public Gloomhaven web API.** Every usable source is a JSON file inside an open-source GitHub repository, so "live API" in practice means fetching raw files from GitHub.
- **The best source is [Gloomhaven Secretariat](https://github.com/Lurkars/gloomhavensecretariat) (GHS).** It is complete for GH, JotL, FH and GH2e, actively maintained, and structured per room, which helps with spoilers.
- **[X-Haven Assistant](https://github.com/Tarmslitaren/FrosthavenAssistant) (XHA)** is an independent dataset that is good for cross-checking. Its monster lists match GHS in **92 of 95** Gloomhaven scenarios.
- **Recommendation:** bundle a small, trimmed, names-only JSON file built from GHS by a one-off script. It is about 3–4 KB gzipped per edition. Do not fetch live.

## Sources inspected

### 1. Gloomhaven Secretariat: `Lurkars/gloomhavensecretariat` (recommended)

| Criterion | Finding |
|---|---|
| Format | One JSON file per scenario in `data/<edition>/scenarios/NN.json`. Fields used: `index` (number), `name`, `monsters` (all types in the scenario), and `rooms[].monster[]` (which monster spawns in which room, by player count). Boss status is in `data/<edition>/monster/<id>.json` as `"boss": true`. English display names are in `data/<edition>/label/en.json` under `monster`. |
| Editions present | Data folders exist for `gh`, `gh2e`, `jotl`, `fh`, `fc`, `cs`, `toa`, `bb` and several fan campaigns. |
| Completeness (inspected) | **GH:** 113 files, which is 95 main scenarios plus 18 solo scenarios and a random dungeon. Every scenario has a name. Only #55 (Foggy Thicket) has no monsters. 29 bosses are flagged. **JotL:** 25/25 named and all have monsters, 4 bosses. **FH:** 159 files, 6 without a monster list, 49 bosses. **GH2e:** 122 files, 9 without a monster list. |
| Accuracy | Matches XHA in 92 of 95 GH scenarios. The 3 differences are #67, #75 and #78 (details under "Data caveats"). The maintainer says game data is checked against the physical components (`AI_NOTICE.md`). |
| Maintenance | Last push was 2026-11-22. 249 stars. Active. |
| CORS | `raw.githubusercontent.com` returns `access-control-allow-origin: *` and `cache-control: max-age=300`, so live fetching would technically work. |
| Licensing | Source code is **AGPL-3.0**. The README says *"Gloomhaven and all related properties, images and text are owned by Cephalofair Games"* and lists data credits, including the Creator Pack (CC BY-NC-SA 4.0), Worldhaven and XHA. There is **no separate data license**. |
| Spoilers | Per-room monster lists let the app reveal monsters room by room. 11 GH scenarios carry a `"spoiler": true` flag, for unlockable or class-related content. GHS keeps spoiler labels in a separate `label/spoiler/` folder. |

### 2. X-Haven Assistant: `Tarmslitaren/FrosthavenAssistant` (backup and cross-check)

| Criterion | Finding |
|---|---|
| Format | One large file per edition: `frosthaven_assistant/assets/data/editions/<Edition>.json`, about 360 KB for GH. Scenarios are keyed by strings such as `"#1 Black Barrow"`, with `monsters` as display names. Room data is in a separate `assets/data/rooms/` folder. |
| Editions present | Gloomhaven, GH2e, JotL, Frosthaven, Forgotten Circles, Crimson Scales, Trail of Ashes, Solo and others. |
| Completeness | 96 GH entries: 95 scenarios plus the random dungeon. |
| Maintenance | Last push was 2026-08-31. 232 stars. Active. README says *"All data is added by hand."* |
| Licensing | AGPL-3.0. Same Cephalofair ownership statement, no separate data license. |
| Drawback | Number and name are packed into one string key, which needs parsing. The schema is less structured than GHS. |

### 3. Worldhaven: `any2cards/worldhaven` (not suitable)

- It has `data/*.js` files for cards, monster stat and ability cards, map tiles and `random-scenarios.js`, but **no scenario-to-monster mapping**.
- **The license forbids reuse.** The README says the assets come from a personal licence agreement with Cephalofair, and that no one else may use or re-use them for any other purpose. No license file is attached.

### 4. Others found and rejected

| Repo | Why it was rejected |
|---|---|
| `johreh/gloomycompanion` | Last push 2019 and no license. Monster decks only. |
| `pearofducks/gloomhaven-data` | Last push 2018 and no license. Monster stats only. |
| `AluminumAngel/gloom` (MIT) | A monster-movement solver, not a scenario catalogue. |
| Various "gloomhaven-api" repos | Hobby backends for character persistence. None is hosted or public. |
| Gloomhaven Helper (Esoteric Software) | Closed source and discontinued. |

## Data caveats found while inspecting

1. **Boss variants.** GH #67 (Arcane Library): XHA lists the boss *Arcane Golem*, while GHS lists *Stone Golem* and applies the boss stats through a scenario rule. The build script needs a small override map for cases like this.
2. **Spawned monster types.** GH #75 and #78: GHS also lists types that appear only through special rules (Living Corpse, and a scenario-specific Cultist variant). The tracker needs them, which is an argument for GHS's more complete lists.
3. **Scenario-specific ids.** GHS has ids such as `cultist-scenario-78` or `cave-bear-scenario-54` that have no English label: 5 per edition in GH, JotL and FH, and 9 in GH2e. The build script must map these to their base name, for example "Cultist".
4. **Monsters only in sections.** Some types appear only in `sections/`, the scenario book's later paragraphs. In GH that is Lieutenant and Song of the Deep. FH and GH2e have many more. The app's "add custom plate" control covers these, or the script could merge them in.
5. **Shared ability decks.** GHS groups monster types by `deck`, for example Bandit Guard, City Guard and Inox Guard all use `guard`. **Unverified:** whether types that share a deck should share one initiative plate. This needs checking against the rulebook before deciding plates per type or per deck.

## Licensing assessment

- **No published Cephalofair fan-content or IP policy turned up in a web search.** Unofficial companion apps (GHS, XHA, Gloomhaven Helper) have existed openly for years, which suggests tolerance but is **not a grant of rights**.
- Scenario names and monster names are short factual identifiers. Shipping only those, with no art, stats, card text or rules text, keeps the footprint very small.
- Both usable sources are **AGPL-3.0** with no separate data license. A names-only extract of factual data is arguably not a copyrightable "work" taken from the AGPL code. **This is not legal advice.** The cautious options are:
  - **(a)** license this repo AGPL-3.0 too and credit GHS, which is simplest and avoids any question; or
  - **(b)** use MIT for your code, keep `data/scenarios.json` with a credit line, and ask the GHS maintainer for permission, for example in a GitHub issue.
- Keep the "unofficial, not affiliated with Cephalofair Games" disclaimer and keep the app free.

## Bundled vs live fetching

| | Bundled static JSON | Live fetch from GitHub raw |
|---|---|---|
| Size | About 22 KB raw, **3 KB gzipped** for GH (measured with a test extract). JotL is about 1 KB and FH about 4 KB gzipped. | Downloading per-scenario files means about 6 KB each, plus labels (about 100 KB) and monster files. That is larger and needs many requests. |
| Offline | Works once loaded, and fully offline with a service worker. | Fails without a network unless the app adds its own caching. |
| Reliability | Pinned to an upstream commit, so it never changes unexpectedly. | Breaks if GHS renames folders or changes the schema. |
| Updates | Re-run the script when you want fixes. | Fixes arrive automatically, along with breaking changes. |
| Licensing clarity | You choose exactly what is redistributed. | Each user pulls the data directly. That is similar legally, but you can't trim it. |

**Bundling wins on every criterion except automatic updates**, and scenario data rarely changes.

## Spoiler-avoidance approach (possible with GHS room data)

> Not adopted. See "Decisions" below: the full monster list is known at setup anyway, so `rooms` will be left out of the bundled JSON.

- At setup, show **only the monster types in the initial room** (`rooms[]` with `initial: true`).
- Keep the remaining types in an **"Unrevealed (n)" group** that shows only a count. Tapping "Reveal" when a door opens shows a chooser.
  - Simplest form: the chooser lists the room refs the data gives, such as "G1b", which match the map-tile labels players see on the board.
  - Alternative: reveal the unrevealed plates one at a time.
- Scenarios flagged `spoiler: true` can show their number only, with the name hidden until tapped.

## Recommended approach (simplest viable option)

1. **Source:** GHS, pinned to a commit. Current: `ee65e0be5374c23a5f97f264fb56d360487c1867` (2026-11-22).
2. **Build:** `scripts/build-data.mjs`, run by hand with Node and no dependencies. It reads a sparse checkout of `data/gh` and writes `data/scenarios.json` with this shape:
   ```json
   {
     "source": "gloomhavensecretariat@ee65e0b",
     "monsters": { "bandit-guard": { "name": "Bandit Guard" }, "bandit-commander": { "name": "Bandit Commander", "boss": true } },
     "scenarios": [
       { "id": "gh-1", "number": "1", "name": "Black Barrow",
         "rooms": [{ "ref": "L1a", "initial": true, "monsters": ["bandit-guard"] }],
         "monsters": ["bandit-archer", "bandit-guard", "living-bones"] }
     ]
   }
   ```
   It skips solo, random and group scenarios, maps scenario-specific ids to base names, and applies a short override list (for example #67's Arcane Golem).
3. **Editions:** ship GH first. JotL and FH use the same GHS schema, so adding them later means one more script argument each, about 1–4 KB gzipped per edition.
4. **Runtime:** a single `fetch('data/scenarios.json')` from the app's own origin, cached by the browser or an optional service worker. No third-party requests.
5. **Fallback:** a "custom plate" control for spawned or section-only monsters.

## Decisions (2026-11-24)

1. **License: AGPL-3.0**, matching GHS, with credit in the README.
2. **Spoilers: no room-by-room hiding.** Players need every monster's ability deck and figures at setup anyway, so the whole scenario's monster list is not a spoiler. All of a scenario's monster plates are added when it is selected, starting in the inactive area. The `rooms` data is not needed and is left out of the bundle. The only remaining spoiler concern is the 11 GH scenario *names* flagged `spoiler: true`. Showing the number only for those is optional.
3. **One plate per monster type.** This is how the game works: every Ooze acts on the Ooze initiative. GHS's `deck` field only matters where two different types use the same ability-card design in one scenario. That happens in 7 GH scenarios: #62, #75, #78, #87, #88 and #92 (twice). Example: #92 has Bandit, City and Inox Guards. The app keeps them as separate plates, and players can drag them next to each other if they act together.
4. **Gloomhaven 1st edition only:** the 95 main scenarios from GHS `data/gh`. Skip anything with `solo` or `group` set, which covers the solo scenarios and the random dungeon. Keep #55 Foggy Thicket even though it has no monsters, since the tracker still orders the characters. **Never** read from `data/gh2e`. The build script should check that `edition === "gh"` for every file it includes and fail otherwise.
5. **Offline: yes**, through a small versioned service worker. See ARCHITECTURE.md §9.

## Sources

- https://github.com/Lurkars/gloomhavensecretariat (README "Copyright / License", `AI_NOTICE.md`, `data/`)
- https://github.com/Tarmslitaren/FrosthavenAssistant (README, `frosthaven_assistant/assets/data/`)
- https://github.com/any2cards/worldhaven (README "Asset LICENSE Terms")
- Web search for a Cephalofair fan-content policy found nothing official. Closest: https://cephalofair.com/pages/about and https://stonemaiergames.com/?p=11593
