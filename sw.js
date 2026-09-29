/* =========================================================
   World Clock — Service Worker
   Estratègia: cache-first per a recursos locals, network-first per a HTML
   ========================================================= */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = 'world-clock-' + CACHE_VERSION;

/* Recursos que es pre-cachen a la instal·lació */
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

/* --------- INSTALL --------- */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

/* --------- ACTIVATE --------- */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

/* --------- FETCH --------- */
self.addEventListener('fetch', (event) => {
    const req = event.request;

    /* Només GET */
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    /* Ignora recursos externs (fonts, icones remotes...) */
    if (url.origin !== self.location.origin) {
        /* Per a Google Fonts: cache-first oportunista */
        if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
            event.respondWith(
                caches.match(req).then((cached) => {
                    if (cached) return cached;
                    return fetch(req).then((res) => {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                        return res;
                    }).catch(() => cached);
                })
            );
        }
        return;
    }

    /* Navegació (HTML): network-first amb fallback a cache */
    if (req.mode === 'navigate' || req.destination === 'document') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                    return res;
                })
                .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
        );
        return;
    }

    /* Altres recursos locals: cache-first amb revalidació */
    event.respondWith(
        caches.match(req).then((cached) => {
            const fetched = fetch(req)
                .then((res) => {
                    if (res && res.status === 200 && res.type === 'basic') {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || fetched;
        })
    );
});

/* --------- SKIP WAITING (per a updates forçats) --------- */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
