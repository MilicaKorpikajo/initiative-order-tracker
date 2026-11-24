import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, addCharacter, addCustomMonster, removePlate, movePlate,
  setScenario, validate, load, save, listOf, STORAGE_KEY,
} from '../js/state.js';

const MONSTERS = {
  'bandit-guard': { name: 'Bandit Guard' },
  'bandit-archer': { name: 'Bandit Archer' },
  'bandit-commander': { name: 'Bandit Commander', boss: true },
};
const SCENARIO = { id: 'gh-1', monsters: ['bandit-archer', 'bandit-guard'] };

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('addCharacter appends to the initiative order with unique ids', () => {
  let s = addCharacter(createState(), '  Brute  ');
  s = addCharacter(s, 'Spellweaver');
  assert.deepEqual(s.active, ['c-1', 'c-2']);
  assert.equal(s.plates['c-1'].name, 'Brute');
  assert.equal(s.plates['c-1'].kind, 'character');
});

test('addCharacter ignores blank names and does not mutate input', () => {
  const s0 = createState();
  assert.equal(addCharacter(s0, '   '), s0);
  addCharacter(s0, 'Brute');
  assert.deepEqual(s0.active, []);
});

test('ids are reused only after removal', () => {
  let s = addCharacter(addCharacter(createState(), 'A'), 'B');
  s = removePlate(s, 'c-1');
  s = addCharacter(s, 'C');
  assert.deepEqual(s.active, ['c-2', 'c-1']);
  assert.equal(s.plates['c-1'].name, 'C');
});

test('setScenario keeps characters and puts monsters in inactive', () => {
  let s = addCharacter(addCharacter(createState(), 'A'), 'B');
  s = movePlate(s, 'c-1', 'inactive', 0); // A is exhausted
  s = setScenario(s, SCENARIO, MONSTERS);
  assert.equal(s.scenario, 'gh-1');
  assert.deepEqual(s.active, ['c-2', 'c-1']);
  assert.deepEqual(s.inactive, ['m-bandit-archer', 'm-bandit-guard']);
  assert.equal(s.plates['m-bandit-guard'].name, 'Bandit Guard');
});

test('setScenario replaces previous monsters, including custom ones', () => {
  let s = setScenario(addCharacter(createState(), 'A'), SCENARIO, MONSTERS);
  s = addCustomMonster(s, 'Wolf');
  s = setScenario(s, { id: 'gh-2', monsters: ['bandit-commander'] }, MONSTERS);
  assert.deepEqual(Object.keys(s.plates).sort(), ['c-1', 'm-bandit-commander']);
  assert.equal(s.plates['m-bandit-commander'].boss, true);
  assert.deepEqual(s.inactive, ['m-bandit-commander']);
});

test('movePlate reorders within a list and moves between lists', () => {
  let s = setScenario(addCharacter(addCharacter(createState(), 'A'), 'B'), SCENARIO, MONSTERS);
  s = movePlate(s, 'm-bandit-guard', 'active', 1);
  assert.deepEqual(s.active, ['c-1', 'm-bandit-guard', 'c-2']);
  s = movePlate(s, 'c-1', 'active', 2);
  assert.deepEqual(s.active, ['m-bandit-guard', 'c-2', 'c-1']);
  s = movePlate(s, 'c-2', 'inactive', 99); // clamped to end
  assert.deepEqual(s.inactive, ['m-bandit-archer', 'c-2']);
  assert.equal(listOf(s, 'c-2'), 'inactive');
});

test('movePlate ignores unknown ids and lists', () => {
  const s = addCharacter(createState(), 'A');
  assert.equal(movePlate(s, 'nope', 'active', 0), s);
  assert.equal(movePlate(s, 'c-1', 'elsewhere', 0), s);
});

test('save and load round-trip', () => {
  const storage = memoryStorage();
  const s = setScenario(addCharacter(createState(), 'A'), SCENARIO, MONSTERS);
  save(storage, s);
  assert.deepEqual(load(storage), s);
});

test('load falls back to a fresh state on bad data', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(load(storage), createState());
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 999 }));
  assert.deepEqual(load(storage), createState());
});

test('validate repairs inconsistent lists', () => {
  const s = validate({
    version: 1,
    scenario: 'gh-1',
    plates: {
      'c-1': { id: 'c-1', kind: 'character', name: 'A' },
      'c-2': { id: 'c-2', kind: 'character', name: 'B' },
      bad: { id: 'other', kind: 'character', name: 'X' },
    },
    active: ['c-1', 'c-1', 'ghost'],
    inactive: [],
  });
  assert.deepEqual(s.active, ['c-1']);
  assert.deepEqual(s.inactive, ['c-2']);
  assert.equal(s.plates.bad, undefined);
});

test('save survives a throwing storage', () => {
  save({ setItem() { throw new Error('QuotaExceeded'); } }, createState());
});
