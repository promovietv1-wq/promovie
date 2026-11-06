import test from 'node:test';
import assert from 'node:assert/strict';
import {sendAccessEmail,emailDeliveryEnabled} from './src/access-email.mjs';

const active={
  PROMOVIE_ACCESS_EMAIL_ENABLED:'true',
  PROMOVIE_ACCESS_EMAIL_FROM:'PromoVie <acesso@promovie.tv.br>',
  RESEND_API_KEY:'re_chave_ficticia_usada_somente_em_testes'
};
const recipient={
  email:'beneficiario@example.org',
  nome:'Pessoa Exemplo',
  codigo:'ABCDE-FGHIJ-KLMNP-QRSTU',
  recordId:'c411e069-312e-4d3a-9023-0a2193bd3f64'
};

test('envio fica desligado por padrão e não realiza chamadas externas',async()=>{
  assert.equal(emailDeliveryEnabled({}),false);
  assert.equal(await sendAccessEmail({},recipient),'desativado');
  assert.equal(await sendAccessEmail(active,{...recipient,email:''}),'sem_email');
  assert.equal(await sendAccessEmail({...active,RESEND_API_KEY:''},recipient),'indisponivel');
});

test('e-mail contém apenas texto curto, CPF não é transmitido e sucesso é aceite, não entrega',async()=>{
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(options.method,'POST');
    assert.equal(options.headers.Authorization,'Bearer '+active.RESEND_API_KEY);
    assert.match(options.headers['Idempotency-Key'],/^promovie-access\//);
    const body=JSON.parse(options.body);
    assert.equal(body.from,active.PROMOVIE_ACCESS_EMAIL_FROM);
    assert.deepEqual(body.to,[recipient.email]);
    assert.equal(body.subject,'Seu acesso à TeleSaúde PromoVie');
    assert.match(body.text,/Identificação: seu CPF cadastrado/);
    assert.match(body.text,/Código pessoal: ABCDE-FGHIJ-KLMNP-QRSTU/);
    assert.match(body.text,/https:\/\/www\.promovie\.tv\.br\/telesaude\//);
    assert.doesNotMatch(body.text,/529\.982\.247-25|52998224725/);
    assert.ok(!('html' in body));
    return new Response(JSON.stringify({id:'email-teste-aceito'}),{
      status:200,headers:{'Content-Type':'application/json'}
    });
  };
  try{
    assert.equal(await sendAccessEmail(active,recipient),'aceito');
    assert.equal(calls,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('erro de provedor retorna falhou, preservando entrega manual',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'quota'}),{status:429});
  try{
    assert.equal(await sendAccessEmail(active,recipient),'falhou');
  }finally{globalThis.fetch=originalFetch;}
});
