# Architecture proposal

Status: **proposal — no application code written yet.**

## 1. Goals recap

A static web page that lets a table of Gloomhaven players:

1. enter character names,
2. pick a scenario and get its monster types as nameplates,
3. drag nameplates to set the initiative order,
4. move nameplates to and from an **inactive** area (defeated, or not yet revealed),
5. keep all of this through a refresh or a closed tab.

The app has no accounts and no backend. It should be as small and quiet as possible.

## 2. Technology stack

| Concern | Choice | Why |
|---|---|---|
| Language | Plain HTML, CSS, JavaScript (ES modules) | Every browser supports these. No build step and no framework runtime. |
| Framework | **None** | The UI is two lists of buttons. A framework would add 30–100 KB for nothing. |
| Build tool | **None** for the app | Browsers load ES modules directly. One optional Node script builds the data file (see §5). |
| Drag and drop | **Custom, about 150 lines, on Pointer Events** | Native HTML5 drag and drop is unreliable on touch screens, especially iOS. Pointer Events handle mouse, touch and pen with one code path. SortableJS works well but is about 45 KB. |
| Accessibility for reordering | Keyboard and screen-reader controls alongside drag | Dragging alone is not accessible. See §6. |
| Persistence | `localStorage` | The state is a few KB and synchronous writes are fine at that size. IndexedDB would be overkill. |
| Scenario data | A static JSON file in the repo, generated ahead of time | Nothing is fetched at runtime from third parties. See §5. |
| Hosting | **GitHub Pages** | Free, serves straight from the repo, HTTPS, no configuration. Netlify or Cloudflare Pages would also work. |
| Offline (optional, later) | A tiny service worker that caches about 5 files | Useful at a game table with bad Wi-Fi. It runs only when the page fetches something, so it does no background work. This is a later step, not part of v1. |

Expected size: under **15 KB** of HTML, CSS and JS before gzip, plus a scenario JSON of roughly 10–20 KB.

## 3. Runtime model

```
user action ──► state.js (pure update) ──► save to localStorage
                                       └─► render.js (redraw the two lists)
```

- There is **one state object**, and all changes go through a few functions in `state.js`.
- **Rendering is a full redraw of two short lists** (at most about 20 items). That is cheap and much simpler than diffing. Event delegation on the list containers means no per-item listeners are attached or removed.
- **Nothing runs while the user does nothing:** no timers, no polling, no `requestAnimationFrame` loop, and no transitions beyond a short CSS `transform` while dragging. `prefers-reduced-motion` turns even that off.
- Saving happens only after a change, so a session writes a few dozen times at most.

## 4. Data model

### Persisted state (`localStorage` key `ghit:state`)

```js
{
  version: 1,                 // schema version, for safe migrations
  scenario: "gh-001",         // selected scenario id, or null
  plates: {                   // every nameplate, keyed by id
    "c-1":          { id: "c-1", kind: "character", name: "Brute (Ana)" },
    "m-bandit-guard": { id: "m-bandit-guard", kind: "monster", name: "Bandit Guard" },
    "m-custom-1":   { id: "m-custom-1", kind: "monster", name: "Summon: Wolf", custom: true }
  },
  active:   ["c-1", "m-bandit-guard"],   // initiative order, top first
  inactive: ["m-custom-1"]               // defeated, unrevealed or parked
}
```

Design notes:

- **Order lives only in the `active` and `inactive` arrays.** A plate is in exactly one of them. Moving or reordering is an array splice, with no index fields to keep in sync.
- **One plate per monster type, not per standee.** In Gloomhaven, normal and elite monsters of one type share a single initiative, so the tracker needs one plate per type.
- **Choosing a scenario** keeps the character plates, removes the previous scenario's monster plates, and adds the new ones to **inactive**, since most of them are not revealed yet. Players drag them up as rooms open.
- **Custom plates** (summons, spawned monsters, or anything missing from the data) can be added by name, so incomplete data never blocks a game.
- A **Reset** action clears the state. A **New round** action is not needed, because the physical tracker has none either.
- An optional initiative number per plate is left out of v1. The model has room for it later.

### Bundled scenario data (`data/scenarios.json`)

```js
{
  "source": "<name, URL and commit of upstream data>",
  "monsters": { "bandit-guard": "Bandit Guard", "inox-shaman": "Inox Shaman" /* … */ },
  "scenarios": [
    { "id": "gh-001", "number": 1, "name": "Black Barrow", "monsters": ["bandit-guard", "bandit-archer", "living-bones"] }
  ]
}
```

This file holds only names and ids. It has no stats, ability cards or art.

## 5. Scenario data: sources, risks and licensing

> **Superseded by [DATA_SOURCES.md](DATA_SOURCES.md)**, which has the inspected findings and the recommendation. The notes below are the original assumptions.

### Candidate sources

| Source | What it has | Notes |
|---|---|---|
| **Gloomhaven Secretariat** (GitHub: `Lurkars/gloomhavensecretariat`) | Structured JSON per edition, including per-scenario monster lists for GH, JotL, FH and others | Actively maintained, and the most machine-readable option. **Check its license before copying data.** The code is open source (I believe AGPL-3.0, but this needs checking), and the data folder may have its own terms. |
| **Worldhaven** (GitHub: `any2cards/worldhaven`) | Card and asset images, plus some JSON metadata | Mostly art. It is the wrong fit here and carries more copyright risk. |
| Scenario book or fan wikis | Monster lists per scenario | Reliable, but entering about 95 scenarios by hand is tedious. Fine as a fallback or for spot checks. |
| Gloomhaven Helper (Esoteric Software) | Discontinued and closed source | Not usable. |

### Recommendation

- **Do not fetch third-party data at runtime.** That adds a network dependency, CORS problems, breakage when the upstream layout changes, and energy cost.
- Add a small **Node script, `scripts/build-data.mjs`, that you run by hand.** It reads a local checkout of the chosen source and writes the trimmed `data/scenarios.json`. Record the upstream commit inside the file.
- **Start with Gloomhaven (1st edition) only.** Keep the `gh-` id prefix so Jaws of the Lion (`jotl-`) or Frosthaven (`fh-`) can be added later without schema changes.

### Known data issues

- **Spawned and summoned monsters.** Some scenarios add monster types through special rules that may not be in the base list. The "add custom plate" control covers this.
- **Bosses** usually appear as one entry. Check how the source names them.
- **Spoilers.** Showing every monster type in a scenario at setup reveals what's in later rooms. Putting them all in "inactive" softens this, and a later setting could hide unrevealed names.
- **Edition and errata differences.** Pin the upstream commit and note it in the data file.

### Licensing

- *Gloomhaven*, its scenario names and its monster names are © **Cephalofair Games**. Cephalofair has historically tolerated free, non-commercial fan tools (Gloomhaven Helper and Secretariat both exist), but **I can't confirm its current written fan-content policy**. Check it before publishing.
- To keep exposure low: **ship names only, with no art, stats, card text or rules text.** Keep the app free and non-commercial, and add a clear "unofficial fan tool, not affiliated with Cephalofair Games" notice.
- If data is derived from an AGPL or other copyleft source, the data file, and possibly the repo, may need a compatible license and attribution. Decide this **before** choosing a license for this repo. A permissive license such as MIT for your own code, with the data file under the upstream's terms, is a common split.

## 6. Interaction and accessibility

- **Drag:** a long press, or a press on a dedicated grip handle, starts a drag. The handle has `touch-action: none` so page scrolling still works everywhere else. `setPointerCapture` keeps the drag on the same element. A placeholder gap shows where the plate will land, and dropping on the other area moves the plate there.
- **Without drag:** each plate is a list item with small buttons: ↑ ↓, and "Deactivate" or "Activate". Alternatively, a focused plate responds to keys: Space to pick up, arrows to move, Space to drop, Esc to cancel. After every move, an `aria-live="polite"` region announces something like "Bandit Guard moved to position 3 of 7".
- Semantic markup: `<ol>` for the initiative order and `<ul>` for inactive, real `<button>`s, visible focus styles, targets at least 44×44 px, and colors that pass WCAG AA.
- Mobile-first layout, one column on phones and two side by side on tablets.

## 7. Project structure

```
/
├── index.html            # markup and the two lists; loads js/main.js as a module
├── css/
│   └── app.css           # one stylesheet, using custom properties for theming
├── js/
│   ├── main.js           # bootstraps: load state, load data, wire events, first render
│   ├── state.js          # state shape, pure update functions, load/save/migrate
│   ├── render.js         # draws the lists and the scenario picker from state
│   ├── drag.js           # pointer-based drag and drop, with no app knowledge (emits move(id, list, index))
│   ├── keyboard.js       # keyboard reordering and live-region announcements
│   └── scenarios.js      # loads data/scenarios.json and builds monster plates
├── data/
│   └── scenarios.json    # generated, names-only scenario → monster mapping
├── scripts/
│   └── build-data.mjs    # dev-only: regenerate scenarios.json from upstream
├── ARCHITECTURE.md
└── README.md
```

Modules stay small and single-purpose. Only `state.js` changes state. `drag.js` and `keyboard.js` only emit "move" intents, so they can be tested or replaced on their own.

## 8. Things deliberately left out

- No framework, bundler, TypeScript, CSS preprocessor or test runner in v1. A few `node --test` unit tests for `state.js` can be added cheaply later.
- No backend, accounts or sync between devices. One device sits on the table.
- No monster stats, health tracking or ability cards. That is what full companion apps are for.

## 9. Open questions for you

1. Which editions to support first: GH1e only, or also Jaws of the Lion or Frosthaven?
2. Whether to show unrevealed monster names at setup, or hide them (spoilers).
3. The license for this repo, which depends on the data source's license (§5).
4. Whether to add an offline service worker in v1 or later.
