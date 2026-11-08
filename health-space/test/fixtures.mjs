import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {enc,hmac,b64} from '../src/crypto.mjs';
export class DB {
  constructor(){this.db=new DatabaseSync(':memory:');this.db.exec('PRAGMA foreign_keys=ON');}
  prepare(q){const db=this.db;return {bind(...args){return {async first(){return db.prepare(q).get(...args)||null;},async all(){return {results:db.prepare(q).all(...args)};},async run(){const r=db.prepare(q).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}
  async batch(statements){this.db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
export const CODE='ABCDE-FGHJK-LMNPQ-RSTUV',CPF='52998224725';
export async function fixture(){
 const health=new DB(),beneficiaries=new DB();health.db.exec(readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
 beneficiaries.db.exec('CREATE TABLE pv_beneficiarios(id TEXT PRIMARY KEY,cpf_index TEXT,situacao TEXT,plano TEXT); CREATE TABLE pv_access_codes(beneficiario_id TEXT,code_hash TEXT); CREATE TABLE pv_access_codes_pending(beneficiario_id TEXT,code_hash TEXT);');
 const objects=new Map();
 const env={HEALTH_ENABLED:'true',HEALTH_REVIEW_APPROVED:'true',HEALTH_ORIGIN:'https://www.promovie.tv.br',HEALTH_DB:health,BENEFICIARIES:beneficiaries,PROMOVIE_ADMIN_DATA_KEY:'fixture-only-admin-key-not-for-production',HEALTH_KEYS:JSON.stringify({v1:b64(crypto.getRandomValues(new Uint8Array(32)))}),HEALTH_KEY_VERSION:'v1',HEALTH_AUDIT_KEY:b64(crypto.getRandomValues(new Uint8Array(32))),ASSETS:{fetch:async()=>new Response('fixture')},SCANNER:{fetch:async()=>Response.json({clean:true})},FILES:{async put(k,v){objects.set(k,{value:v,uploaded:new Date()});},async get(k){return objects.has(k)?{text:async()=>objects.get(k).value}:null;},async delete(k){objects.delete(k);},async list(){return {objects:[...objects].map(([key,v])=>({key,uploaded:v.uploaded})),truncated:false};}}};
 async function add(owner,cpf){const indexKey=await crypto.subtle.digest('SHA-256',enc.encode('PromoVie|Indice|v1|'+env.PROMOVIE_ADMIN_DATA_KEY));const idx=await hmac(indexKey,cpf);const key=await crypto.subtle.digest('SHA-256',enc.encode('PromoVie|CodigoAcesso|v1|'+env.PROMOVIE_ADMIN_DATA_KEY));const ch=await hmac(key,idx+'|'+CODE.replaceAll('-',''));beneficiaries.db.prepare('INSERT INTO pv_beneficiarios VALUES(?,?,?,?)').run(owner,idx,'ativo','345');beneficiaries.db.prepare('INSERT INTO pv_access_codes VALUES(?,?)').run(owner,ch);}
 await add('beneficiary-a',CPF);await add('beneficiary-b','11144477735');return {env,health,beneficiaries,objects,close(){health.db.close();beneficiaries.db.close();}};
}
