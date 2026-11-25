// Offline support: caches the app's own files on first visit and serves them
// from the cache afterwards. Runs only when the page requests a file.
//
// RELEASE CHECKLIST: bump CACHE_VERSION whenever any file below changes,
// otherwise returning players keep the old version.

const CACHE_VERSION = 6;
const CACHE = `ghit-v${CACHE_VERSION}`;
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'js/main.js',
  'js/state.js',
  'js/render.js',
  'js/drag.js',
  'js/classes.js',
  'js/turns.js',
  'js/lever.js',
  'js/round.js',
  'data/scenarios.json',
  'fonts/PirataOne-Gloomhaven.ttf',
  ...[
    'beast-tyrant', 'berserker', 'brute', 'cragheart', 'doomstalker', 'elementalist',
    'mindthief', 'nightshroud', 'plagueherald', 'quartermaster', 'sawbones', 'scoundrel',
    'soothsinger', 'spellweaver', 'summoner', 'sunkeeper', 'tinkerer',
  ].map((id) => `icons/classes/${id}.png`),
  'manifest.webmanifest',
  'icon.svg',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache. Without it, a release
  // deployed within the host's cache time (10 min on GitHub Pages) would be
  // stored with the *old* files and stay stale until the next release.
  const fresh = FILES.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('ghit-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request)),
  );
});
