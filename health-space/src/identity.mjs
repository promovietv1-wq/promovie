import {enc,hash,hmac,equal} from './crypto.mjs';
// Read-only compatibility with the existing beneficiary registry. No SDK calls,
// no issuance of Mediquo tokens and no mutation of beneficiary/admin tables.
export async function identity(env,cpf,code){
  if(typeof cpf!=='string'||typeof code!=='string'||cpf.length>20||code.length>40)return null;
  cpf=cpf.replace(/\D/g,'');code=code.toUpperCase().replace(/[\s-]/g,'');
  if(!/^\d{11}$/.test(cpf)||! /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$/.test(code))return null;
  const key=await crypto.subtle.digest('SHA-256',enc.encode('PromoVie|Indice|v1|'+env.PROMOVIE_ADMIN_DATA_KEY));
  const idx=await hmac(key,cpf);
  const row=await env.BENEFICIARIES.prepare("SELECT b.id,c.code_hash,p.code_hash AS pending_hash FROM pv_beneficiarios b LEFT JOIN pv_access_codes c ON c.beneficiario_id=b.id LEFT JOIN pv_access_codes_pending p ON p.beneficiario_id=b.id WHERE b.cpf_index=? AND b.situacao='ativo' AND b.plano='345'").bind(idx).first();
  const pepper=await crypto.subtle.digest('SHA-256',enc.encode('PromoVie|CodigoAcesso|v1|'+env.PROMOVIE_ADMIN_DATA_KEY));
  const submitted=await hmac(pepper,idx+'|'+code);
  const current=await equal(submitted,row?.code_hash||'invalid');
  const pending=await equal(submitted,row?.pending_hash||'invalid');
  return row&&(current||pending)?{owner:row.id,credential:submitted}:null;
}
export async function stillAuthorized(env,session){
  const row=await env.BENEFICIARIES.prepare("SELECT c.code_hash,p.code_hash AS pending_hash FROM pv_beneficiarios b LEFT JOIN pv_access_codes c ON c.beneficiario_id=b.id LEFT JOIN pv_access_codes_pending p ON p.beneficiario_id=b.id WHERE b.id=? AND b.situacao='ativo' AND b.plano='345'").bind(session.owner).first();
  const a=await equal(session.credential_hash,row?.code_hash||'invalid');
  const b=await equal(session.credential_hash,row?.pending_hash||'invalid');
  return !!row&&(a||b);
}
