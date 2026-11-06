import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const origin='http://127.0.0.1:8769';
const api='https://backend.promovie.tv.br/api/promovie/space/v1';
const browser=await chromium.launch({headless:true});
await mkdir('/tmp/pv-space-shots',{recursive:true});

async function checkViewport(width){
  let savedVault=null;
  const documents=new Map();
  const page=await browser.newPage({viewport:{width,height:890},acceptDownloads:true,reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));

  await page.route('https://backend.promovie.tv.br/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname.split('/space/v1')[1];
    const method=request.method();
    const headers={
      'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type,Authorization',
      'Cache-Control':'no-store'
    };
    if(method==='OPTIONS')return route.fulfill({status:204,headers});
    let status=200,payload={ok:true};
    if(path==='/health')payload={disponivel:true};
    else if(path==='/session'&&method==='POST')payload={token:'browser-fixture-session'};
    else if(path==='/vault'&&method==='GET')
      payload={revision:savedVault?.revision||0,record:savedVault};
    else if(path==='/vault'&&method==='PUT'){
      const body=request.postDataJSON();
      if(!savedVault&&!body.consent){status=403;payload={error:'Consentimento obrigatório'};}
      else {
        assert.ok(!JSON.stringify(body).includes('Penicilina'),'Dados clínicos devem sair cifrados');
        assert.ok(typeof body.ciphertext==='string'&&body.ciphertext.length>25);
        savedVault={salt:body.salt,iv:body.iv,ciphertext:body.ciphertext,revision:body.revision+1};
        payload={revision:savedVault.revision,atualizado_em:new Date().toISOString()};
      }
    }else if(path==='/documents'&&method==='POST'){
      const body=request.postDataJSON();
      assert.ok(!JSON.stringify(body).includes('resultado.pdf'),'Nome deve estar cifrado no cofre');
      documents.set(body.id,body.ciphertext);
      status=201;payload={id:body.id};
    }else if(path?.startsWith('/documents/')&&method==='GET'){
      const id=path.slice('/documents/'.length);
      if(!documents.has(id)){status=404;payload={error:'Documento não encontrado'};}
      else payload={ciphertext:documents.get(id)};
    }else if(path==='/logout'&&method==='POST')payload={ok:true};
    else {status=404;payload={error:'Rota simulada ausente: '+path};}
    return route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(payload)});
  });
  try{
    await page.goto(origin+'/telesaude/meu-espaco/',{waitUntil:'load'});
    await page.locator('#login-form button').waitFor({state:'visible'});
    assert.equal(await page.locator('#login-view').isVisible(),true);
    assert.equal(await page.locator('.identity img').evaluate(x=>x.naturalWidth>0),true);
    await page.locator('#cpf').fill('123.456.789-09');
    await page.locator('#access-code').fill('AAAAA-AAAAA-AAAAA-AAAAA');
    await page.locator('#login-form button').click();
    await page.locator('#unlock-view').waitFor({state:'visible'});
    assert.equal(await page.locator('#privacy-consent').isVisible(),true);
    await page.locator('#vault-passphrase').fill('UmaSenhaForte!SohParaTeste2026');
    await page.locator('#vault-passphrase-confirm').fill('UmaSenhaForte!SohParaTeste2026');
    await page.locator('#privacy-consent').check();
    await page.locator('#unlock-submit').click();
    await page.locator('#workspace-view').waitFor({state:'visible',timeout:25000});
    assert.ok(savedVault&&savedVault.ciphertext,'Cofre criptografado criado');

    await page.locator('#allergies').fill('Penicilina');
    await page.locator('#medications').fill('Vitamina prescrita');
    await page.locator('#note-text').fill('Perguntar sobre exame anual');
    await page.locator('#note-form button').click();
    assert.match(await page.locator('#notes-list').innerText(),/exame anual/);
    await page.locator('#save-all').click();
    assert.ok(savedVault.revision>=2);
    assert.ok(!savedVault.ciphertext.includes('Penicilina'));

    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    await page.locator('#file-input').setInputFiles({name:'resultado.pdf',mimeType:'application/pdf',buffer:pdf});
    await page.locator('#upload-file').click();
    await page.locator('#documents-list li').waitFor();
    assert.equal(documents.size,1);
    assert.ok(!savedVault.ciphertext.includes('resultado.pdf'));

    await page.locator('#make-summary').click();
    assert.equal(await page.locator('#summary-dialog').isVisible(),true);
    assert.match(await page.locator('#summary-text').innerText(),/Penicilina/);
    await page.locator('#close-summary').click();
    await page.locator('#logout').click();
    await page.locator('#login-view').waitFor({state:'visible'});

    await page.locator('#cpf').fill('123.456.789-09');
    await page.locator('#access-code').fill('AAAAA-AAAAA-AAAAA-AAAAA');
    await page.locator('#login-form button').click();
    await page.locator('#unlock-view').waitFor({state:'visible'});
    await page.locator('#vault-passphrase').fill('UmaSenhaForte!SohParaTeste2026');
    await page.locator('#unlock-submit').click();
    await page.locator('#workspace-view').waitFor({state:'visible',timeout:25000});
    assert.equal(await page.locator('#allergies').inputValue(),'Penicilina');
    assert.match(await page.locator('#notes-list').innerText(),/exame anual/);
    assert.match(await page.locator('#documents-list').innerText(),/resultado.pdf/);

    const downloadEvent=page.waitForEvent('download',{timeout:10000});
    await page.locator('#documents-list button').first().click();
    const file=await downloadEvent;
    assert.equal(file.suggestedFilename(),'resultado.pdf');

    const dims=await page.evaluate(()=>({
      viewport:window.innerWidth,scroll:document.documentElement.scrollWidth,
      background:getComputedStyle(document.body).backgroundImage
    }));
    assert.ok(dims.scroll<=dims.viewport+1,'Não pode existir rolagem horizontal: '+JSON.stringify(dims));
    assert.deepEqual(errors,[],'Nenhum erro JavaScript no navegador');
    await page.screenshot({path:'/tmp/pv-space-shots/space-'+width+'.png',fullPage:true});
    console.log('Fluxo completo concluído no viewport',width);
  }finally{
    await page.close();
  }
}
try{
  for(const width of [390,1440])await checkViewport(width);
}finally{
  await browser.close();
}
