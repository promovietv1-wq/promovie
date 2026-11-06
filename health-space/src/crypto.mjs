export const enc = new TextEncoder();
export const dec = new TextDecoder();
export const b64 = bytes => { let s=''; for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(s); };
export const unb64 = s => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
export const random = () => b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hmac(secret,s){const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0;}
async function key(env,owner,version){
  const keys=JSON.parse(env.HEALTH_KEYS),raw=unb64(keys[version]);
  if(raw.length!==32)throw Error('key');
  const master=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode(owner),info:enc.encode('PromoVie health v1')},master,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function seal(env,owner,context,bytes){
  const v=env.HEALTH_KEY_VERSION,iv=crypto.getRandomValues(new Uint8Array(12));
  const c=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(owner+'|'+context+'|'+v)},await key(env,owner,v),bytes);
  return JSON.stringify({v,iv:b64(iv),c:b64(new Uint8Array(c))});
}
export async function open(env,owner,context,payload){
  const {v,iv,c}=JSON.parse(payload);
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:enc.encode(owner+'|'+context+'|'+v)},await key(env,owner,v),unb64(c)));
}
