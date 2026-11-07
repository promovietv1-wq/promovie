import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
const first='A'.repeat(20),second='B'.repeat(20),origin='http://127.0.0.1:8769';
const browser=await chromium.launch({headless:true});
await mkdir('/tmp/pv-space-shots',{recursive:true});
async function run(width){
  let vault=null;
  const docs=new Map(),errors=[];
  const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true,reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://backend.promovie.tv.br/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname.split('/space/v1')[1];
    const method=request.method();
    const headers={'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type,Authorization'};
    if(method==='OPTIONS')return route.fulfill({status:204,headers});
    let status=200,body={ok:true};
    if(path==='/health')body={disponivel:true};
    else if(path==='/session'&&method==='POST')body={token:'session-fixture'};
    else if(path==='/vault'&&method==='GET')body={revision:vault?.revision||0,record:vault};
    else if(path==='/vault'&&method==='PUT'){
      const data=request.postDataJSON();
      assert.equal(data.revision,vault?.revision||0);
      if(!vault)assert.equal(data.consent,true);
      if(vault&&data.salt!==vault.salt)assert.equal(data.previousSalt,vault.salt);
      assert.ok(typeof data.ciphertext==='string'&&data.ciphertext.length>20);
      vault={revision:data.revision+1,salt:data.salt,iv:data.iv,ciphertext:data.ciphertext};
      body={revision:vault.revision};
    }
    else if(path==='/documents'&&method==='POST'){
      const data=request.postDataJSON();docs.set(data.id,data.ciphertext);
      status=201;body={id:data.id};
    }
    else if(path?.startsWith('/documents/')&&method==='GET'){
      const id=path.split('/').at(-1);
      if(docs.has(id))body={ciphertext:docs.get(id)};
      else{status=404;body={error:'Não encontrado'};}
    }
    else if(path==='/logout'&&method==='POST')body={ok:true};
    else{status=404;body={error:'Rota de simulação ausente'};}
    return route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  });
  async function login(code,expected){
    await page.locator('#cpf').fill('123.456.789-09');
    await page.locator('#access-code').fill(code);
    await page.locator('#login-form button').click();
    await page.locator('#'+expected+'-view').waitFor({state:'visible',timeout:25000});
  }
  async function logout(){
    await page.locator('#logout').click();
    await page.locator('#login-view').waitFor({state:'visible'});
  }
  try{
    await page.goto(origin+'/telesaude/meu-espaco/',{waitUntil:'load'});
    await login(first,'unlock');
    assert.equal(await page.locator('#legacy-wrap').isVisible(),false);
    assert.equal(await page.locator('#unlock-title').innerText(),'Meu Espaço de Saúde');
    assert.equal(await page.locator('#unlock-submit').innerText(),'Ativar meu espaço');
    assert.match(await page.locator('.warning').innerText(),/informar o anterior uma vez/);
    assert.equal(await page.locator('#unlock-back').count(),0);
    await page.locator('#privacy-consent').check();
    await page.locator('#unlock-submit').click();
    await page.locator('#workspace-view').waitFor({state:'visible',timeout:25000});
    assert.match(vault.salt,/^c2_/);
    await page.locator('#allergies').fill('Observação de teste');
    await page.locator('#save-all').click();
    const pdf=Buffer.from('%PDF-1.4\n%%EOF\n');
    await page.locator('#file-input').setInputFiles({name:'resultado.pdf',mimeType:'application/pdf',buffer:pdf});
    await page.locator('#upload-file').click();
    await page.locator('#documents-list li').waitFor();
    await logout();
    await login(first,'workspace');
    assert.equal(await page.locator('#allergies').inputValue(),'Observação de teste');
    await logout();
    await login(second,'unlock');
    assert.match(await page.locator('#old-credential-label').innerText(),/Código anterior/);
    await page.locator('#vault-passphrase').fill(first);
    await page.locator('#unlock-submit').click();
    await page.locator('#workspace-view').waitFor({state:'visible',timeout:25000});
    assert.equal(await page.locator('#allergies').inputValue(),'Observação de teste');
    await logout();
    await login(second,'workspace');
    const downloading=page.waitForEvent('download',{timeout:15000});
    await page.locator('#documents-list button').first().click();
    const downloaded=await downloading;
    assert.deepEqual(await readFile(await downloaded.path()),pdf,'Documento preservado após rotação');
    assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:'/tmp/pv-space-shots/single-code-'+width+'.png',fullPage:true});
    console.log('Código único e migração aprovados:',width);
  }finally{await page.close();}
}
try{for(const width of [390,1440])await run(width);}
finally{await browser.close();}
