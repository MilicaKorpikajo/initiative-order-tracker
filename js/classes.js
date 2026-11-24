// Gloomhaven (1st edition) character classes: icon lookup and name suggestions.
// No DOM access, so this can be unit-tested in Node.

export const CLASSES = [
  // Starting classes
  { id: 'brute', name: 'Brute', starting: true },
  { id: 'cragheart', name: 'Cragheart', starting: true },
  { id: 'mindthief', name: 'Mindthief', starting: true },
  { id: 'scoundrel', name: 'Scoundrel', starting: true },
  { id: 'spellweaver', name: 'Spellweaver', starting: true },
  { id: 'tinkerer', name: 'Tinkerer', starting: true },
  // Locked classes
  { id: 'beast-tyrant', name: 'Beast Tyrant' },
  { id: 'berserker', name: 'Berserker' },
  { id: 'doomstalker', name: 'Doomstalker' },
  { id: 'elementalist', name: 'Elementalist' },
  { id: 'nightshroud', name: 'Nightshroud' },
  { id: 'plagueherald', name: 'Plagueherald' },
  { id: 'quartermaster', name: 'Quartermaster' },
  { id: 'sawbones', name: 'Sawbones' },
  { id: 'soothsinger', name: 'Soothsinger' },
  { id: 'summoner', name: 'Summoner' },
  { id: 'sunkeeper', name: 'Sunkeeper' },
];

// Locked class names are only suggested once this many letters match,
// so a single typed letter doesn't list classes the group hasn't unlocked.
export const LOCKED_SUGGEST_MIN = 3;

const normalize = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

// Longest names first, so "Beast Tyrant" is tried before any shorter name.
const byLength = [...CLASSES].sort((a, b) => b.name.length - a.name.length);

/**
 * The class named anywhere in `text` as a whole word, e.g.
 * "Brute", "ana (brute)", "Beast Tyrant - Leo". Null if none.
 */
export function findClass(text) {
  const words = ` ${normalize(text).replace(/[^a-z]+/g, ' ')} `;
  return byLength.find((c) => words.includes(` ${c.name.toLowerCase()} `)) ?? null;
}

/** Class names to offer while typing `text` into the character name field. */
export function suggestions(text) {
  const typed = normalize(text);
  return CLASSES
    .filter((c) => c.starting || (typed.length >= LOCKED_SUGGEST_MIN && c.name.toLowerCase().startsWith(typed)))
    .map((c) => c.name);
}

export const iconUrl = (cls) => `icons/classes/${cls.id}.png`;
