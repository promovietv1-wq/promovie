const CACHE='promovie-previa-v2';
const HOME='/previews/app-telemedicina/';
const SHELL=[HOME,HOME+'index.html',HOME+'manifest.webmanifest','/app/assets/coracao-promovie-com-logo.webp','/app/icons/heart-192.png','/app/icons/heart-512.png','/app/familias-amigos-promovie-2x.jpg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url)))));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('promovie-previa-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
const u=new URL(event.request.url);
if(event.request.mode==='navigate'&&u.pathname.startsWith(HOME)){event.respondWith(fetch(event.request).catch(()=>caches.match(HOME)));return;}
if(SHELL.includes(u.pathname)){event.respondWith(caches.match(event.request).then(x=>x||fetch(event.request)));}});
