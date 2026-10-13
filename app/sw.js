/* PromoVie PWA: offline apenas da interface pública, nunca de dados de consultas ou páginas da Levita. */
const CACHE="promovie-app-shell-v14";
const SHELL=["/app/","/app/inicio/","/app/familias-amigos-promovie-2x.jpg","/app/telemedicina/","/app/manifest.webmanifest","/app/previa-fiel-20261010/coracao-promovie-com-logo-20261011.webp","/app/icons/heart-192.png","/app/icons/heart-512.png","/app/icons/favicon-32.png","/app/icons/favicon-48.png","/app/icons/favicon.ico","/app/icons/apple-touch-180.png","/app/icons/favicon-coracao-promovie-32.png","/app/icons/favicon-coracao-promovie-48.png","/app/icons/favicon-coracao-promovie.ico","/app/icons/apple-touch-coracao-promovie.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("promovie-app-shell-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith("/app/"))return;
 // A configuração do portal é sempre consultada on-line, sem cache.
 if(url.pathname==="/app/config.js")return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
   return response;
  }).catch(()=>caches.match(request).then(match=>match||caches.match("/app/inicio/"))));
  return;
 }
 event.respondWith(caches.match(request).then(match=>match||fetch(request).then(response=>{
  if(response.ok&&["/app/manifest.webmanifest","/app/previa-fiel-20261010/coracao-promovie-com-logo-20261011.webp","/app/icons/heart-192.png","/app/icons/heart-512.png","/app/icons/favicon-32.png","/app/icons/favicon-48.png","/app/icons/favicon.ico","/app/icons/apple-touch-180.png","/app/icons/favicon-coracao-promovie-32.png","/app/icons/favicon-coracao-promovie-48.png","/app/icons/favicon-coracao-promovie.ico","/app/icons/apple-touch-coracao-promovie.png"].includes(url.pathname)){
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));
  }
  return response;
 })));
});
