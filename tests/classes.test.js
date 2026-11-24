import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLASSES, findClass, suggestions, iconUrl } from '../js/classes.js';

test('findClass matches class names as whole words, any case', () => {
  assert.equal(findClass('Brute')?.id, 'brute');
  assert.equal(findClass('ana (brute)')?.id, 'brute');
  assert.equal(findClass('Leo - Beast  Tyrant')?.id, 'beast-tyrant');
  assert.equal(findClass('SUNKEEPER')?.id, 'sunkeeper');
});

test('findClass does not match partial words or unknown names', () => {
  assert.equal(findClass('Brutes'), null);
  assert.equal(findClass('Brutal Bob'), null);
  assert.equal(findClass('Ana'), null);
  assert.equal(findClass(''), null);
});

test('suggestions always include the six starting classes', () => {
  assert.deepEqual(suggestions(''), ['Brute', 'Cragheart', 'Mindthief', 'Scoundrel', 'Spellweaver', 'Tinkerer']);
});

test('locked classes are suggested only after three matching letters', () => {
  assert.ok(!suggestions('s').includes('Sunkeeper'));
  assert.ok(!suggestions('su').includes('Sunkeeper'));
  assert.ok(suggestions('sun').includes('Sunkeeper'));
  assert.ok(!suggestions('sun').includes('Summoner'));
  assert.ok(suggestions('Beast').includes('Beast Tyrant'));
});

test('every class has an icon file', () => {
  for (const cls of CLASSES) {
    const path = fileURLToPath(new URL(`../${iconUrl(cls)}`, import.meta.url));
    assert.ok(existsSync(path), `missing ${path}`);
  }
});
