// Game state: shape, pure update functions, and localStorage persistence.
// No DOM access here, so this module can be unit-tested in Node.
//
// State shape:
// {
//   version: 1,
//   scenario: "gh-1" | null,
//   plates:   { [id]: { id, kind: "character" | "monster", name, boss?, custom? } },
//   active:   [id, ...],   // initiative order, top first
//   inactive: [id, ...],   // defeated, not yet revealed, or parked
// }
// Every plate id is in exactly one of `active` / `inactive`.

export const VERSION = 1;
export const STORAGE_KEY = 'ghit:state';
export const LISTS = ['active', 'inactive'];

export function createState() {
  return { version: VERSION, scenario: null, plates: {}, active: [], inactive: [] };
}

/** Which list a plate is in, or null. */
export function listOf(state, id) {
  return LISTS.find((list) => state[list].includes(id)) ?? null;
}

function nextId(state, prefix) {
  let n = 1;
  while (state.plates[`${prefix}${n}`]) n++;
  return `${prefix}${n}`;
}

function cleanName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

function withPlate(state, plate, list) {
  return {
    ...state,
    plates: { ...state.plates, [plate.id]: plate },
    [list]: [...state[list], plate.id],
  };
}

/** Add a character at the end of the initiative order. */
export function addCharacter(state, name) {
  const clean = cleanName(name);
  if (!clean) return state;
  return withPlate(state, { id: nextId(state, 'c-'), kind: 'character', name: clean }, 'active');
}

/** Add a monster that is not in the scenario data (summon, spawn, ...). */
export function addCustomMonster(state, name) {
  const clean = cleanName(name);
  if (!clean) return state;
  return withPlate(state, { id: nextId(state, 'x-'), kind: 'monster', name: clean, custom: true }, 'active');
}

export function removePlate(state, id) {
  if (!state.plates[id]) return state;
  const plates = { ...state.plates };
  delete plates[id];
  return {
    ...state,
    plates,
    active: state.active.filter((x) => x !== id),
    inactive: state.inactive.filter((x) => x !== id),
  };
}

/**
 * Move a plate to `list` at `index` (clamped). Works within one list
 * (reorder) and between lists. `index` is the position in the target
 * list after the plate has been taken out of its current list.
 */
export function movePlate(state, id, list, index) {
  if (!state.plates[id] || !LISTS.includes(list)) return state;
  const next = { ...state, active: state.active.filter((x) => x !== id), inactive: state.inactive.filter((x) => x !== id) };
  const target = [...next[list]];
  const at = Math.max(0, Math.min(Number.isInteger(index) ? index : target.length, target.length));
  target.splice(at, 0, id);
  next[list] = target;
  return next;
}

/**
 * Start (or restart) a scenario: keep characters (all back in the initiative
 * order), drop every monster plate, and add the scenario's monster types to
 * the inactive area.
 *
 * @param scenario  { id, monsters: [monsterId] } or null to clear
 * @param monsterInfo  { [monsterId]: { name, boss? } }
 */
export function setScenario(state, scenario, monsterInfo = {}) {
  const characters = Object.values(state.plates).filter((p) => p.kind === 'character');
  const charIds = new Set(characters.map((p) => p.id));
  // Keep the characters' current relative order: active ones first, then inactive ones.
  const active = [...state.active, ...state.inactive].filter((id) => charIds.has(id));

  const plates = Object.fromEntries(characters.map((p) => [p.id, p]));
  const inactive = [];
  for (const monsterId of scenario?.monsters ?? []) {
    const info = monsterInfo[monsterId] ?? {};
    const id = `m-${monsterId}`;
    plates[id] = { id, kind: 'monster', name: info.name ?? monsterId, ...(info.boss ? { boss: true } : {}) };
    inactive.push(id);
  }

  return { ...state, scenario: scenario?.id ?? null, plates, active, inactive };
}

// --- Persistence ------------------------------------------------------------

/** Return a valid state from untrusted data, or null if it can't be used. */
export function validate(data) {
  if (!data || typeof data !== 'object' || data.version !== VERSION) return null;
  if (typeof data.plates !== 'object' || data.plates === null) return null;
  if (!Array.isArray(data.active) || !Array.isArray(data.inactive)) return null;

  const plates = {};
  for (const [id, p] of Object.entries(data.plates)) {
    if (!p || p.id !== id || !['character', 'monster'].includes(p.kind) || typeof p.name !== 'string') continue;
    plates[id] = p;
  }
  const seen = new Set();
  const keep = (id) => typeof id === 'string' && plates[id] && !seen.has(id) && seen.add(id);
  const active = data.active.filter(keep);
  const inactive = data.inactive.filter(keep);
  // Any plate missing from both lists goes to inactive rather than vanishing.
  for (const id of Object.keys(plates)) if (!seen.has(id)) inactive.push(id);

  return {
    version: VERSION,
    scenario: typeof data.scenario === 'string' ? data.scenario : null,
    plates,
    active,
    inactive,
  };
}

export function load(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return (raw && validate(JSON.parse(raw))) || createState();
  } catch {
    return createState();
  }
}

export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled (private mode): the app still works, it just won't persist.
  }
}
