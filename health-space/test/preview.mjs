// LOCAL SYNTHETIC HARNESS ONLY. Not imported by the Worker or deployment config.
import http from 'node:http';import {readFile} from 'node:fs/promises';
import worker,{BASE} from '../src/worker.mjs';import {fixture} from './fixtures.mjs';
const f=await fixture();
f.env.ASSETS.fetch=async req=>{const path=new URL(req.url).pathname;let name=path.slice((BASE+'/').length)||'index.html';if(!['index.html','app.js','style.css','heart.webp'].includes(name))return new Response('',{status:404});let data=await readFile(new URL('../public'+BASE+'/'+name,import.meta.url));if(name==='index.html')data=Buffer.from(data.toString().replace('<main>','<main><p class="private">DEMONSTRAÇÃO LOCAL · Apenas dados fictícios · Nada é enviado à PromoVie ou à Médiquo.</p>'));return new Response(data,{headers:{'Content-Type':({'index.html':'text/html; charset=utf-8','app.js':'text/javascript','style.css':'text/css','heart.webp':'image/webp'})[name]}});};
const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:8789'){res.writeHead(403);res.end();return;}
  const chunks=[];for await(const c of req)chunks.push(c);const headers=new Headers(req.headers);
  if(headers.get('Origin')==='http://127.0.0.1:8789')headers.set('Origin',f.env.HEALTH_ORIGIN);
  const response=await worker.fetch(new Request(f.env.HEALTH_ORIGIN+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),f.env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch{res.writeHead(500);res.end('Preview error');}});
server.listen(8789,'127.0.0.1',()=>console.log('Synthetic preview: http://127.0.0.1:8789'+BASE+'/'));
