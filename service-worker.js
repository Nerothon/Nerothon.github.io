/* Manifest version: zQTvE3tk */
// Caution! Be sure you understand the caveats before publishing an application with
// offline support. See https://aka.ms/blazor-offline-considerations

self.importScripts('./service-worker-assets.js');
self.importScripts('./service-worker-data.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
const dataCacheName = `${cacheNamePrefix}${self.dataManifest.version}`;

//const offlineAssetsInclude = [ /\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/ ];
//const offlineAssetsExclude = [ /^service-worker\.js$/ ];
//https://github.com/jsakamoto/BlazorWasmPreRendering.Build/issues/45
const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /^index\.html$/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.ttf$/ , /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/ ];
const offlineAssetsExclude = [/^service-worker\.js$/, /^service-worker-data\.js$/, /^Data/];

async function onInstall(event) {
    console.info('Service worker: Install');

    self.skipWaiting();

    // Fetch and cache all matching items from the assets manifest
    const assetsRequests = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
        .map(asset => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));
    await caches.open(cacheName).then(cache => cache.addAll(assetsRequests));

    const dataRequests = self.dataManifest.assets
        .map(asset => new Request(asset.url, { cache: 'no-cache' }));
    await caches.open(dataCacheName).then(cache => cache.addAll(dataRequests));
}

async function onActivate(event) {
    console.info('Service worker: Activate');

    // Delete unused caches
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName && key !== dataCacheName)
        .map(key => caches.delete(key)));
}

async function onFetch(event) {
    let cachedResponse = null;
    if (event.request.method === 'GET') {
        // For all navigation requests, try to serve index.html from cache
        const shouldServeIndexHtml = event.request.mode === 'navigate';

        const request = shouldServeIndexHtml ? 'index.html' : event.request.url;

        const selectedCacheName = request.endsWith(".json") ? dataCacheName : cacheName;

        const cache = await caches.open(selectedCacheName);
        cachedResponse = await cache.match(request);
    }

    return cachedResponse || fetch(event.request);
}
