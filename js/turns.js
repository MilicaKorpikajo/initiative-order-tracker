// Turn tracking: whose turn it is, who has finished this round, the round
// number, and an undo history. Pure functions, no DOM.
//
// Added to the game state (see state.js):
//   round: number >= 1
//   turn: {
//     current: id | null,   // plate whose turn it is: a stable id, not an index
//     done: [id],           // finished their turn this round (stays in the order, dimmed)
//     undo: [{ id, done? }] // one entry per finished turn, newest last. `done` is only
//                           // stored when that turn ended the round, so undo can go
//                           // back across the round boundary.
//   }
//
// Rules:
// - The turn moves down the initiative order, one plate at a time.
// - Before anyone has acted this round, the first plate is current, so sorting
//   the plates at the start of a round just works.
// - A plate placed above the current one mid-round (for example a monster revealed
//   after its initiative has passed) is skipped this round, as in the rules.
// - Inactive plates never take part.

export const UNDO_LIMIT = 50;
export const MAX_ROUND = 999;

export function emptyTurn() {
  return { current: null, done: [], undo: [] };
}

/** 'current' | 'done' | 'upcoming' | 'inactive' */
export function turnStatus(state, id) {
  if (!state.active.includes(id)) return 'inactive';
  if (state.turn.current === id) return 'current';
  return state.turn.done.includes(id) ? 'done' : 'upcoming';
}

/** The plate after the current one that still has to act, or null (end of round). */
export function nextInTurn(state) {
  const { active, turn } = state;
  const at = active.indexOf(turn.current);
  if (at === -1) return null;
  return active.slice(at + 1).find((id) => !turn.done.includes(id)) ?? null;
}

/** The undo entry that would be applied, or null. */
export function lastUndo(state) {
  const { undo } = state.turn;
  for (let i = undo.length - 1; i >= 0; i--) if (state.active.includes(undo[i].id)) return undo[i];
  return null;
}

/**
 * Keep the turn consistent after any change to the plates or lists.
 * `prev` is the state before the change: its order tells us who comes next
 * when the current plate has left the initiative order.
 */
export function normalizeTurn(prev, next) {
  const turn = next.turn ?? emptyTurn();
  const done = turn.done.filter((id) => next.active.includes(id));
  let current = turn.current;
  let round = next.round;

  if (done.length === 0) {
    current = next.active[0] ?? null;
  } else if (!next.active.includes(current) || done.includes(current)) {
    current = successor(prev, next.active, done);
    if (!current) {
      // The last plate to act left the order: that ends the round.
      round = Math.min(round + 1, MAX_ROUND);
      done.length = 0;
      current = next.active[0] ?? null;
    }
  }

  if (current === turn.current && round === next.round && done.length === turn.done.length && next.turn) return next;
  return { ...next, round, turn: { ...turn, current, done } };
}

function successor(prev, active, done) {
  const order = prev.active;
  const from = order.indexOf(prev.turn?.current);
  return order.slice(from + 1).find((id) => active.includes(id) && !done.includes(id)) ?? null;
}

/** Finish the current turn. After the last plate, a new round starts at the top. */
export function advanceTurn(state) {
  const { turn } = state;
  if (!turn.current) return state;
  const next = nextInTurn(state);
  const done = [...turn.done, turn.current];
  const entry = next ? { id: turn.current } : { id: turn.current, done: turn.done };
  const undo = [...turn.undo, entry].slice(-UNDO_LIMIT);

  if (next) return { ...state, turn: { current: next, done, undo } };
  return {
    ...state,
    round: Math.min(state.round + 1, MAX_ROUND),
    turn: { current: state.active[0], done: [], undo },
  };
}

/** Give the previous turn back, also across a round boundary. */
export function undoTurn(state) {
  const undo = [...state.turn.undo];
  while (undo.length) {
    const entry = undo.pop();
    if (!state.active.includes(entry.id)) continue; // that plate is gone or inactive
    if (entry.done) {
      return {
        ...state,
        round: Math.max(1, state.round - 1),
        turn: { current: entry.id, done: entry.done.filter((id) => state.active.includes(id)), undo },
      };
    }
    return { ...state, turn: { current: entry.id, done: state.turn.done.filter((id) => id !== entry.id), undo } };
  }
  return state;
}

/** Correct the round number by hand. Leaves the order and turn progress alone. */
export function setRound(state, round) {
  const clean = Math.max(1, Math.min(MAX_ROUND, Math.round(Number(round)) || 1));
  return clean === state.round ? state : { ...state, round: clean };
}

/** Clean up turn data read from storage. */
export function validateTurn(data, plates) {
  const ids = (list) => (Array.isArray(list) ? list.filter((id) => typeof id === 'string' && plates[id]) : []);
  const turn = data && typeof data === 'object' ? data : {};
  const undo = Array.isArray(turn.undo)
    ? turn.undo
      .filter((e) => e && typeof e.id === 'string')
      .map((e) => (Array.isArray(e.done) ? { id: e.id, done: ids(e.done) } : { id: e.id }))
      .slice(-UNDO_LIMIT)
    : [];
  return {
    current: typeof turn.current === 'string' ? turn.current : null,
    done: [...new Set(ids(turn.done))],
    undo,
  };
}

export function validateRound(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_ROUND ? value : 1;
}
