// Mensagem transacional PromoVie. O SDK e os dados médicos não participam deste envio.
// Publicação de verificação: preservar variáveis e segredos existentes no Worker.
// Não registrar códigos, CPF ou dados pessoais em logs.
const RESEND_ENDPOINT='https://api.resend.com/emails';
const ACCESS_URL='https://www.promovie.tv.br/telesaude/';
const ICON_URL='https://www.promovie.tv.br/app/icons/apple-touch-coracao-promovie.png?v=14';

const configured=env=>String(env?.PROMOVIE_ACCESS_EMAIL_ENABLED||'')==='true';
const sender=env=>String(env?.PROMOVIE_ACCESS_EMAIL_FROM||'').trim();
const key=env=>String(env?.RESEND_API_KEY||'').trim();
const validEmail=value=>typeof value==='string'&&value.length<=180&&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const validSender=value=>value.length<240&&!/[\r\n]/.test(value)&&
  /^(?:[^<>\r\n]{1,90}\s+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(value);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[character]);

export function emailDeliveryEnabled(env){return configured(env);}

export function renderAccessEmail({nome,codigo}={}){
  const firstName=String(nome||'').trim().split(/\s+/)[0].slice(0,60)||'beneficiário';
  // O código é gerado pelo Worker, nunca pelos campos enviados pelo navegador.
  const displayedCode=String(codigo||'');
  const safeName=escapeHtml(firstName),safeCode=escapeHtml(displayedCode);
  const text=[
    'Olá, '+firstName+'!',
    '',
    'Seu acesso à TeleSaúde PromoVie está disponível.',
    '',
    'Para entrar no portal, utilize seu CPF e o código pessoal abaixo.',
    '',
    'Código pessoal: '+displayedCode,
    'Portal: '+ACCESS_URL,
    '',
    'Sugerimos que não apague este e-mail para consultar seu código pessoal sempre que precisar.',
    '',
    'Cuidar de si é cuidar de quem você ama.',
    '',
    'Esta é uma mensagem automática. Não é necessário responder.'
  ].join('\n');

  // HTML com tabelas e estilos inline para clientes de e-mail e telas pequenas.
  // Não criar um falso botão "Copiar": scripts e escrita na área de transferência
  // são bloqueados pelos principais aplicativos de e-mail. O código é selecionável.
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">'+
    '<title>Seu acesso à TeleSaúde PromoVie</title></head>'+
    '<body style="margin:0;padding:0;background-color:#f5f3f8;color:#22202b;font-family:Arial,Helvetica,sans-serif;">'+
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" '+
    'style="width:100%;background-color:#f5f3f8;"><tr><td align="center" style="padding:24px 12px;">'+
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" '+
    'style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e8e1f0;border-radius:14px;">'+
    '<tr><td style="padding:28px 24px 24px;">'+
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>'+
    '<td style="padding-right:10px;vertical-align:middle;">'+
    '<img src="'+ICON_URL+'" width="34" height="34" alt="" style="display:block;width:34px;height:34px;border:0;" /></td>'+
    '<td style="font-size:17px;line-height:24px;font-weight:700;color:#421080;">TeleSaúde PromoVie</td>'+
    '</tr></table>'+
    '<div style="height:1px;background:#e8e1f0;margin:22px 0 26px;"></div>'+
    '<h1 style="margin:0 0 24px;font-size:22px;line-height:30px;font-weight:700;color:#23202a;">Seu acesso está disponível!</h1>'+
    '<p style="margin:0 0 20px;font-size:16px;line-height:26px;">Olá, <strong>'+safeName+'</strong>!</p>'+
    '<p style="margin:0 0 20px;font-size:16px;line-height:26px;">Seu acesso à <strong>TeleSaúde PromoVie</strong> está disponível.</p>'+
    '<p style="margin:0 0 24px;font-size:16px;line-height:26px;">Para entrar no portal, utilize seu CPF e o código pessoal abaixo.</p>'+
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" '+
    'style="width:100%;background:#f7f5fa;border:1px solid #e6e0ed;border-radius:10px;">'+
    '<tr><td style="padding:20px 18px;">'+
    '<p style="margin:0 0 9px;font-size:12px;letter-spacing:0.7px;line-height:18px;font-weight:700;color:#655d70;">CÓDIGO PESSOAL</p>'+
    '<p style="margin:0;font-size:18px;line-height:28px;letter-spacing:1px;font-weight:700;color:#261b31;word-break:break-word;user-select:all;-webkit-user-select:all;">'+safeCode+'</p>'+
    '</td></tr></table>'+
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0 26px;"><tr>'+
    '<td align="center" bgcolor="#421080" style="background-color:#421080;border-radius:9px;">'+
    '<a href="'+ACCESS_URL+'" target="_blank" rel="noopener noreferrer" '+
    'style="display:inline-block;padding:15px 25px;color:#ffffff;text-decoration:none;font-size:16px;line-height:22px;font-weight:700;border-radius:9px;">TeleSaúde PromoVie</a>'+
    '</td></tr></table>'+
    '<p style="margin:0 0 23px;font-size:15px;line-height:25px;">Sugerimos que não apague este e-mail para consultar seu código pessoal sempre que precisar.</p>'+
    '<p style="margin:0;font-size:15px;line-height:25px;font-weight:700;color:#54208a;">Cuidar de si é cuidar de quem você ama.</p>'+
    '<div style="height:1px;background:#e8e1f0;margin:25px 0 18px;"></div>'+
    '<p style="margin:0;font-size:12px;line-height:20px;color:#736c7e;">Esta é uma mensagem automática. Não é necessário responder.</p>'+
    '</td></tr></table></td></tr></table></body></html>';
  return {text,html};
}

export async function sendAccessEmail(env,{email,nome,codigo,recordId}={}){
  if(!configured(env))return 'desativado';
  if(!validEmail(email))return 'sem_email';
  const from=sender(env),apiKey=key(env);
  if(!apiKey.startsWith('re_')||!validSender(from))return 'indisponivel';
  const message=renderAccessEmail({nome,codigo});
  try{
    const response=await fetch(RESEND_ENDPOINT,{
      method:'POST',
      headers:{
        Authorization:'Bearer '+apiKey,
        'Content-Type':'application/json',
        'Idempotency-Key':'promovie-access/'+String(recordId||'').slice(0,36)+'/'+crypto.randomUUID()
      },
      body:JSON.stringify({
        from,to:[email],subject:'Seu acesso à TeleSaúde PromoVie está disponível',
        text:message.text,html:message.html
      }),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)return 'falhou';
    const result=await response.json().catch(()=>null);
    return typeof result?.id==='string'&&result.id.length>0?'aceito':'falhou';
  }catch{
    return 'falhou';
  }
}
