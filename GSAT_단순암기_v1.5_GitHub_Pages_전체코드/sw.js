const CACHE='gsat-dansunamgi-v15';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gsat-dansunamgi-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(res=>res||fetch(event.request)));
});
