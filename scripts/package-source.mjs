// SPDX-License-Identifier: GPL-3.0-or-later
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';

const { version: idbVersion } = JSON.parse(await readFile('node_modules/idb/package.json', 'utf8'));
await readFile(`public/upstream/idb-v${idbVersion}.tar.gz`);

// Explicit allowlist: never package .git, node_modules, credentials or user data.
execFileSync('tar', ['-czf', 'dist/source.tar.gz',
  'src', 'public', 'scripts', 'tests', 'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts', 'README.md', 'LICENSE', 'NOTICE.md', '.nvmrc', '.gitignore', '.github']);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? walk(join(directory, e.name)) : join(directory, e.name)));
  return nested.flat();
}
const files = (await walk('dist')).filter(f => !f.endsWith('/sw.js')).sort();
const hash = createHash('sha256');
for (const file of files) { hash.update(relative('dist', file)); hash.update(await readFile(file)); }
const version = hash.digest('hex').slice(0, 16);
const urls = files.map(f => './' + relative('dist', f));
await writeFile('dist/sw.js', `// SPDX-License-Identifier: GPL-3.0-or-later
const PREFIX = 'nephrite-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(['./', ...urls])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match('./index.html')) || fetch(event.request)));
    return;
  }
  // All entries are our own immutable, precached static files. Vite sends Vary:
  // Origin; module requests and precache fetches may carry different Origin headers.
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreSearch: true, ignoreVary: true })) || fetch(event.request)));
});
`);
console.log(`Offline cache ${version}: ${urls.length} files; corresponding source: dist/source.tar.gz`);
