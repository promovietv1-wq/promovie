const CACHE='promovie-previa-v5';
const HOME='/previews/app-telemedicina/';
const SHELL=[HOME,HOME+'index.html',HOME+'manifest.webmanifest','/app/assets/coracao-promovie-com-logo.webp','/app/icons/heart-192.png','/app/icons/heart-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'}))))));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('promovie-previa-')&&key!==CACHE).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin)return;
 if(event.request.mode==='navigate'&&url.pathname.startsWith(HOME)){
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(res=>{
   if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(HOME,copy)));}
   return res;
  }).catch(()=>caches.match(HOME)));
  return;
 }
 if(SHELL.includes(url.pathname)){
  event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
 }
});
