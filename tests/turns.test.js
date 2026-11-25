import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.js';
import { advanceTurn, undoTurn, setRound, turnStatus, nextInTurn, lastUndo, remainingInTurn, advanceTurns, undoTurns, undoPath } from '../js/turns.js';

// Three characters in the initiative order: c-1, c-2, c-3.
function party() {
  let s = S.createState();
  for (const name of ['Brute', 'Tinkerer', 'Spellweaver']) s = S.addCharacter(s, name);
  return s;
}

test('a new game starts in round 1 with the first plate current', () => {
  const s = party();
  assert.equal(s.round, 1);
  assert.equal(s.turn.current, 'c-1');
  assert.deepEqual(s.turn.done, []);
  assert.equal(S.createState().turn.current, null);
});

test('advancing marks the plate done and moves to the next one', () => {
  const s = advanceTurn(party());
  assert.equal(s.turn.current, 'c-2');
  assert.deepEqual(s.turn.done, ['c-1']);
  assert.equal(turnStatus(s, 'c-1'), 'done');
  assert.equal(turnStatus(s, 'c-2'), 'current');
  assert.equal(turnStatus(s, 'c-3'), 'upcoming');
  assert.deepEqual(s.active, ['c-1', 'c-2', 'c-3'], 'done plates stay in the order');
});

test('the last turn starts a new round at the top and keeps the order', () => {
  let s = party();
  s = advanceTurn(advanceTurn(s));
  assert.equal(nextInTurn(s), null);
  s = advanceTurn(s);
  assert.equal(s.round, 2);
  assert.equal(s.turn.current, 'c-1');
  assert.deepEqual(s.turn.done, []);
  assert.deepEqual(s.active, ['c-1', 'c-2', 'c-3']);
});

test('undo goes back one turn, also across a round boundary', () => {
  let s = party();
  for (let i = 0; i < 4; i++) s = advanceTurn(s); // round 2, c-2 current
  assert.equal(s.round, 2);
  s = undoTurn(s);
  assert.deepEqual([s.round, s.turn.current, s.turn.done], [2, 'c-1', []]);
  s = undoTurn(s); // back into round 1
  assert.deepEqual([s.round, s.turn.current, s.turn.done], [1, 'c-3', ['c-1', 'c-2']]);
  s = undoTurn(undoTurn(s));
  assert.equal(s.turn.current, 'c-1');
  assert.equal(undoTurn(s), s, 'nothing left to undo');
});

test('undo keeps a manually corrected round number', () => {
  let s = advanceTurn(advanceTurn(advanceTurn(party()))); // round 2
  s = setRound(s, 5);
  s = undoTurn(s);
  assert.equal(s.round, 4);
});

test('the current plate is tracked by id when plates are reordered', () => {
  let s = advanceTurn(party()); // c-2 current
  s = S.movePlate(s, 'c-2', 'active', 2); // c-1, c-3, c-2
  assert.equal(s.turn.current, 'c-2');
  assert.equal(nextInTurn(s), null);
  s = S.movePlate(s, 'c-1', 'active', 2); // done plate moved below: c-3, c-2, c-1
  assert.equal(s.turn.current, 'c-2');
  assert.equal(nextInTurn(s), null, 'done plates are skipped');
});

test('before anyone acts, the top plate is current (sorting for a new round)', () => {
  let s = party();
  s = S.movePlate(s, 'c-3', 'active', 0);
  assert.equal(s.turn.current, 'c-3');
});

test('a plate placed above the current one mid-round is skipped', () => {
  let s = advanceTurn(S.addCustomMonster(party(), 'Bandit')); // c-2 current
  s = S.movePlate(s, 'x-1', 'active', 0); // revealed with an earlier initiative
  assert.equal(s.turn.current, 'c-2');
  s = advanceTurn(advanceTurn(s));
  assert.equal(s.round, 2, 'round ends without the skipped plate');
});

test('when the current plate leaves the order, the next one takes over', () => {
  let s = advanceTurn(party()); // c-2 current
  s = S.movePlate(s, 'c-2', 'inactive', 0);
  assert.equal(s.turn.current, 'c-3');
  assert.equal(turnStatus(s, 'c-2'), 'inactive');
  s = S.removePlate(s, 'c-3'); // the last one to act is gone: new round
  assert.deepEqual([s.round, s.turn.current], [2, 'c-1']);
});

test('inactive plates are never part of the turn', () => {
  let s = S.movePlate(party(), 'c-2', 'inactive', 0);
  s = advanceTurn(s);
  assert.equal(s.turn.current, 'c-3');
  s = S.movePlate(s, 'c-1', 'inactive', 0); // a done plate leaves: done list cleaned
  assert.deepEqual(s.turn.done, []);
});

test('undo skips plates that have left the order', () => {
  let s = advanceTurn(advanceTurn(party())); // c-3 current
  s = S.movePlate(s, 'c-2', 'inactive', 0);
  assert.equal(lastUndo(s).id, 'c-1');
  s = undoTurn(s);
  assert.equal(s.turn.current, 'c-1');
});

test('empty order: nothing to advance', () => {
  const s = S.createState();
  assert.equal(advanceTurn(s), s);
  let one = S.addCharacter(s, 'Brute');
  one = advanceTurn(one);
  assert.deepEqual([one.round, one.turn.current], [2, 'c-1']);
});

test('setRound clamps and leaves the turn alone', () => {
  const s = advanceTurn(party());
  assert.equal(setRound(s, 0).round, 1);
  assert.equal(setRound(s, 3).turn, s.turn);
  assert.equal(setRound(s, 1), s);
});

test('starting or restarting a scenario resets the round', () => {
  let s = advanceTurn(advanceTurn(advanceTurn(party())));
  assert.equal(s.round, 2);
  s = S.setScenario(s, { id: 'gh-1', monsters: ['bandit-guard'] }, {});
  assert.deepEqual([s.round, s.turn.current, s.turn.done, s.turn.undo], [1, 'c-1', [], []]);
});

test('round and turn survive a save/load, and old saves get defaults', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const s = advanceTurn(advanceTurn(advanceTurn(advanceTurn(party()))));
  S.save(storage, s);
  assert.deepEqual(S.load(storage), s);

  const old = { version: 1, scenario: null, plates: s.plates, active: s.active, inactive: [] };
  store.set(S.STORAGE_KEY, JSON.stringify(old));
  const loaded = S.load(storage);
  assert.deepEqual([loaded.round, loaded.turn.current], [1, 'c-1']);

  store.set(S.STORAGE_KEY, JSON.stringify({ ...old, round: -3, turn: { current: 'nope', done: ['c-2', 'zz'], undo: 'x' } }));
  const repaired = S.load(storage);
  assert.deepEqual([repaired.round, repaired.turn.current, repaired.turn.done, repaired.turn.undo], [1, 'c-1', ['c-2'], []]);
});

test('one long pull can finish several turns, and stops at the end of the round', () => {
  let s = party();
  assert.deepEqual(remainingInTurn(s), ['c-2', 'c-3']);
  s = advanceTurns(s, 2);
  assert.deepEqual([s.round, s.turn.current, s.turn.done], [1, 'c-3', ['c-1', 'c-2']]);
  s = advanceTurns(party(), 99); // pulled all the way down: exactly one new round
  assert.deepEqual([s.round, s.turn.current, s.turn.done], [2, 'c-1', []]);
});

test('a multi-turn pull is undone one turn at a time or all at once', () => {
  const start = party();
  const s = advanceTurns(start, 3); // round 2
  assert.deepEqual(undoPath(s).map((e) => e.id), ['c-3', 'c-2', 'c-1']);
  assert.ok(undoPath(s)[0].done, 'the first undo goes back across the round boundary');
  assert.deepEqual(undoTurns(s, 3), { ...start, turn: { ...start.turn, undo: [] } });
  assert.equal(undoTurns(s, 1).turn.current, 'c-3');
});

test('remaining turns skip done plates and plates above the current one', () => {
  let s = advanceTurn(S.addCustomMonster(party(), 'Bandit')); // c-2 current
  s = S.movePlate(s, 'x-1', 'active', 0);
  s = S.movePlate(s, 'c-1', 'active', 3); // a done plate moved to the bottom
  assert.deepEqual(s.active, ['x-1', 'c-2', 'c-3', 'c-1']);
  assert.deepEqual(remainingInTurn(s), ['c-3']);
});
