// Offline cache for the modular game. Update CACHE when releasing a new version.
const CACHE='gsat-dansunamgi-v20-soft-balance';
const FILES=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./css/base.css",
  "./css/table.css",
  "./css/logic.css",
  "./css/fever.css",
  "./css/progress.css",
  "./css/keypad.css",
  "./js/core/state.js",
  "./js/core/balancing.js",
  "./js/core/views.js",
  "./js/core/progress.js",
  "./js/core/fever.js",
  "./js/core/session.js",
  "./js/core/effects.js",
  "./js/games/alphabet.js",
  "./js/games/fractions.js",
  "./js/games/arithmetic.js",
  "./js/games/table.js",
  "./js/games/diagrams.js",
  "./js/games/reasoning.js",
  "./js/main.js"
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gsat-dansunamgi-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET' || new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}
      return response;
    }).catch(async()=> (await caches.match(request)) || (await caches.match('./index.html'))));
  }else{
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
  }
});
