// Entrega opcional de códigos de acesso PromoVie por e-mail.
// Este módulo não é chamado quando o envio está desabilitado.
// Não registra códigos, CPF ou dados de contato em logs.
const RESEND_ENDPOINT='https://api.resend.com/emails';
const ACCESS_URL='https://www.promovie.tv.br/telesaude/';

const configured=(env)=>String(env?.PROMOVIE_ACCESS_EMAIL_ENABLED||'')==='true';
const sender=(env)=>String(env?.PROMOVIE_ACCESS_EMAIL_FROM||'').trim();
const key=(env)=>String(env?.RESEND_API_KEY||'').trim();
const validEmail=(value)=>typeof value==='string'&&value.length<=180&&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const validSender=(value)=>value.length<240&&!/[\r\n]/.test(value)&&
  /^(?:[^<>\r\n]{1,90}\s+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(value);

export function emailDeliveryEnabled(env){return configured(env);}

export async function sendAccessEmail(env,{email,nome,codigo,recordId}={}){
  if(!configured(env))return 'desativado';
  if(!validEmail(email))return 'sem_email';
  const from=sender(env),apiKey=key(env);
  if(!apiKey.startsWith('re_')||!validSender(from))return 'indisponivel';

  // Não incluir CPF, dados clínicos nem outras informações pessoais.
  const firstName=String(nome||'').trim().split(/\s+/)[0].slice(0,60)||'beneficiário';
  const text=[
    'Olá, '+firstName+'!',
    '',
    'Seu acesso à TeleSaúde PromoVie está disponível.',
    '',
    'Acesse: '+ACCESS_URL,
    'Identificação: seu CPF cadastrado',
    'Código pessoal: '+codigo,
    '',
    'Guarde seu código com segurança e não o compartilhe.',
    '',
    'PromoVie'
  ].join('\n');

  try{
    const response=await fetch(RESEND_ENDPOINT,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+apiKey,
        'Content-Type':'application/json',
        'Idempotency-Key':'promovie-access/'+String(recordId||'').slice(0,36)+'/'+crypto.randomUUID()
      },
      body:JSON.stringify({
        from,to:[email],subject:'Seu acesso à TeleSaúde PromoVie',text
      }),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)return 'falhou';
    const result=await response.json().catch(()=>null);
    return typeof result?.id==='string'&&result.id.length>0?'aceito':'falhou';
  }catch{
    // Entrega por e-mail nunca pode impedir geração e entrega manual do código.
    return 'falhou';
  }
}
