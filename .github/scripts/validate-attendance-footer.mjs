import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:8778';
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,768,1280,1680]){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://backend.promovie.tv.br/**',route=>route.fulfill({
      status:200,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':origin,'Cache-Control':'no-store'},
      body:JSON.stringify({disponivel:true})
    }));
    try{
      await page.goto(origin+'/telesaude/atendimento/',{waitUntil:'load'});
      assert.equal(await page.locator('.space-footer').isHidden(),true,
        'Sem atendimento aberto não deve aparecer o Meu Espaço');
      await page.evaluate(()=>{
        const host=document.createElement('div');
        host.id='MediquoContainer';
        const frame=document.createElement('iframe');
        frame.title='Simulação de layout, sem conexão ao SDK';
        host.appendChild(frame);
        document.body.appendChild(host);
        // Simulação apenas do sinal visual de abertura do widget.
        document.querySelector('#status').hidden=true;
      });
      await page.locator('.space-footer').waitFor({state:'visible',timeout:10000});
      const m=await page.evaluate(()=>{
        const host=document.querySelector('#MediquoContainer');
        const footer=document.querySelector('.space-footer');
        const head=document.querySelector('.topbar');
        const iframe=host.querySelector('iframe');
        const hostRect=host.getBoundingClientRect();
        const footerRect=footer.getBoundingClientRect();
        const headRect=head.getBoundingClientRect();
        const iframeRect=iframe.getBoundingClientRect();
        return {
          h:innerHeight,w:innerWidth,scroll:document.documentElement.scrollWidth,
          headBottom:headRect.bottom,
          hostTop:hostRect.top,hostBottom:hostRect.bottom,
          footerTop:footerRect.top,footerBottom:footerRect.bottom,
          iframeHeight:iframeRect.height,hostHeight:hostRect.height,
          outsideWidget:footer.parentElement===document.body,
          brandVisible:!!document.querySelector('.identity'),
          text:footer.textContent.trim()
        };
      });
      assert.ok(Math.abs(m.hostTop-m.headBottom)<2,'Widget inicia abaixo do cabeçalho: '+JSON.stringify(m));
      assert.ok(Math.abs(m.hostBottom-m.footerTop)<2,'Card deve ficar ABAIXO do widget: '+JSON.stringify(m));
      assert.ok(Math.abs(m.footerBottom-m.h)<2,'Card deve ficar no fim da viewport');
      assert.ok(m.iframeHeight>=m.hostHeight-4,'Iframe se ajusta ao novo espaço');
      assert.ok(m.scroll<=m.w+1,'Sem rolagem horizontal');
      assert.equal(m.outsideWidget,true,'Não injetar nada dentro da Médiquo');
      assert.match(m.text,/Meu Espaço de Saúde/);
      assert.equal(m.brandVisible,true);
      const link=page.locator('.space-entry');
      assert.equal(await link.getAttribute('href'),'/telesaude/meu-espaco/');
      assert.equal(await link.getAttribute('target'),'_blank','Preservar atendimento em andamento');
      assert.deepEqual(errors,[],'Sem erros JavaScript no navegador');
      console.log('Meu Espaço abaixo do aplicativo em '+width+'px, SDK preservado');
    }finally{await page.close();}
  }
}finally{await browser.close();}
