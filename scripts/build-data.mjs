#!/usr/bin/env node
// Builds data/scenarios.json from a local checkout of Gloomhaven Secretariat (GHS).
// Gloomhaven 1st edition only. Run by hand; not part of the app.
//
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/Lurkars/gloomhavensecretariat.git vendor/ghs
//   git -C vendor/ghs sparse-checkout set data/gh
//   node scripts/build-data.mjs vendor/ghs
//
// Output: names and ids only. No stats, card text, rules text or art.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EDITION = 'gh'; // Gloomhaven 1st edition. Never 'gh2e'.

const ghsRoot = process.argv[2];
if (!ghsRoot) {
  console.error('Usage: node scripts/build-data.mjs <path-to-gloomhavensecretariat-checkout>');
  process.exit(1);
}

const dataDir = join(ghsRoot, 'data', EDITION);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const jsonFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.json'));

function fail(message) {
  console.error(`build-data: ${message}`);
  process.exit(1);
}

// --- Monster metadata -------------------------------------------------------
const labels = readJson(join(dataDir, 'label', 'en.json')).monster ?? {};
const monsterFiles = new Map(
  jsonFiles(join(dataDir, 'monster')).map((f) => [f.slice(0, -5), readJson(join(dataDir, 'monster', f))]),
);

// Map a GHS monster reference to the monster type that has its own plate.
// "stone-golem:+1" -> "stone-golem" (level modifier)
// "cultist-scenario-78" -> "cultist" (variant sharing the base standee)
function baseMonsterId(ref) {
  const id = ref.split(':')[0];
  const meta = monsterFiles.get(id);
  if (!meta) fail(`unknown monster "${ref}"`);
  if (meta.edition && meta.edition !== EDITION) fail(`monster "${id}" has edition "${meta.edition}"`);
  return labels[id] ? id : (meta.standeeShare ?? id);
}

function monsterName(id) {
  const name = labels[id];
  if (!name) fail(`no English name for monster "${id}"`);
  return name;
}

// --- Scenarios --------------------------------------------------------------
const monsters = {};
const scenarios = [];

for (const file of jsonFiles(join(dataDir, 'scenarios'))) {
  const s = readJson(join(dataDir, 'scenarios', file));
  if (s.edition !== EDITION) fail(`${file} has edition "${s.edition}", expected "${EDITION}"`);
  // Skip solo scenarios and the random dungeon. (`random: true` marks the
  // random side scenarios 63-71, which are regular scenarios: keep those.)
  if (s.solo || s.group) continue;
  const number = Number(s.index);
  if (!Number.isInteger(number)) fail(`${file} has non-numeric index "${s.index}"`);

  const ids = [...new Set((s.monsters ?? []).map(baseMonsterId))].sort();
  for (const id of ids) {
    monsters[id] ??= { name: monsterName(id), ...(monsterFiles.get(id)?.boss ? { boss: true } : {}) };
  }

  scenarios.push({
    id: `${EDITION}-${number}`,
    number,
    name: s.name,
    ...(s.spoiler ? { spoiler: true } : {}),
    monsters: ids,
  });
}

scenarios.sort((a, b) => a.number - b.number);

// Sanity checks: GH 1e has exactly scenarios 1..95.
if (scenarios.length !== 95 || scenarios.some((s, i) => s.number !== i + 1)) {
  fail(`expected scenarios 1-95, got ${scenarios.length} (${scenarios.map((s) => s.number).join(',')})`);
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', ghsRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch { /* not a git checkout */ }

const sortedMonsters = Object.fromEntries(Object.entries(monsters).sort(([a], [b]) => a.localeCompare(b)));
const output = {
  source: {
    name: 'Gloomhaven Secretariat',
    url: 'https://github.com/Lurkars/gloomhavensecretariat',
    license: 'AGPL-3.0',
    commit,
    path: `data/${EDITION}`,
  },
  edition: EDITION,
  monsters: sortedMonsters,
  scenarios,
};

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'scenarios.json');
writeFileSync(outPath, JSON.stringify(output, null, 1) + '\n');
console.log(`Wrote ${scenarios.length} scenarios, ${Object.keys(monsters).length} monster types to data/scenarios.json (GHS ${commit.slice(0, 7)})`);
