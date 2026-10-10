const CACHE="promovie-preview-fiel-2026-v1";
const BASE="/app/previa-fiel-20261010/";
const CORE=[BASE,BASE+"inicio/",BASE+"style.css",BASE+"manifest.webmanifest",BASE+"heart-brilho.svg","/app/icons/icon-192.png","/app/icons/icon-512.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("promovie-preview-fiel-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
 if(req.mode==="navigate"){
  event.respondWith(fetch(req).then(r=>{if(r.ok){let cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;}).catch(()=>caches.match(req).then(x=>x||caches.match(BASE+"inicio/"))));return;
 }
 event.respondWith(caches.match(req).then(x=>x||fetch(req)));
});