/*global UVServiceWorker,__uv$config*/
importScripts('bundle.js');
importScripts('config.js');
importScripts(__uv$config.sw || 'core.js');

const uv = new UVServiceWorker();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function handleRequest(event) {
    if (uv.route(event)) {
        return await uv.fetch(event);
    }
    return await fetch(event.request);
}

self.addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event));
});
