/* Instalação opcional do portal público, isolada da autenticação e do SDK Médiquo. */
(function(){
  'use strict';
  const root=document.documentElement;
  const box=document.getElementById('pwa-install-actions');
  const dialog=document.getElementById('pwa-help-dialog');
  const heading=document.getElementById('pwa-help-title');
  const steps=document.getElementById('pwa-help-steps');
  const footnote=document.getElementById('pwa-help-note');
  if(!box||!dialog||!heading||!steps||!footnote)return;

  const ua=navigator.userAgent||'';
  const iphone=/iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua);
  const mobile=iphone||android||Boolean(navigator.userAgentData?.mobile)||
    (/Mobile/i.test(ua)&&!/(Windows NT|Macintosh)/i.test(ua));
  const macDesktop=!mobile&&/Macintosh|Mac OS X/i.test(ua);
  const windowsDesktop=!mobile&&/Windows/i.test(ua);
  root.dataset.pwaDevice=mobile?'mobile':'desktop';

  const installed=()=>window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone===true;
  const updateInstalled=()=>{box.hidden=installed();};
  updateInstalled();

  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt',function(event){
    event.preventDefault();
    deferredPrompt=event;
  });
  window.addEventListener('appinstalled',function(){
    deferredPrompt=null;
    box.hidden=true;
  });
  const standaloneQuery=window.matchMedia('(display-mode: standalone)');
  if(typeof standaloneQuery.addEventListener==='function'){
    standaloneQuery.addEventListener('change',updateInstalled);
  }

  function showSteps(title,list,note){
    heading.textContent=title;
    steps.replaceChildren();
    list.forEach(function(line){
      const item=document.createElement('li');
      item.textContent=line;
      steps.appendChild(item);
    });
    footnote.textContent=note||'';
    footnote.hidden=!note;
    if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
    else window.alert(title+'\n\n'+list.join('\n'));
  }

  async function requestNativeInstall(){
    if(!deferredPrompt)return false;
    const prompt=deferredPrompt;
    deferredPrompt=null;
    try{
      await prompt.prompt();
      const selection=await prompt.userChoice;
      if(selection?.outcome==='accepted'&&windowsDesktop){
        showSteps('Aplicativo instalado',[
          'A TeleSaúde PromoVie poderá abrir em uma janela própria, sem a barra de endereços.',
          'Para deixar o ícone fixo no Windows, abra o aplicativo, clique com o botão direito no ícone da barra de tarefas e escolha Fixar na barra de tarefas.'
        ],'A instalação e a fixação são ações distintas no Windows.');
      }
      return true;
    }catch{
      return false;
    }
  }

  async function androidInstall(){
    if(android&&await requestNativeInstall())return;
    showSteps('Adicionar no Android',[
      'Abra esta página no Google Chrome do Android.',
      'Toque no menu de três pontos (⋮) do navegador.',
      'Escolha Instalar aplicativo ou Adicionar à tela inicial e confirme.'
    ],'A instalação pode aparecer diretamente ao tocar no botão em navegadores compatíveis.');
  }

  function appleInstall(){
    showSteps('Adicionar no iPhone ou iPad',[
      'Abra a página no Safari do iPhone ou iPad.',
      'Toque em Compartilhar (quadrado com seta). Em algumas versões do Safari, abra primeiro o menu da página.',
      'Escolha Adicionar à Tela de Início.',
      'Mantenha Abrir como Aplicativo ativado, se aparecer, e toque em Adicionar.'
    ],'O ícone da TeleSaúde PromoVie aparecerá na tela inicial. A Apple exige a confirmação pelo próprio aparelho.');
  }

  async function desktopInstall(){
    if(await requestNativeInstall())return;
    if(macDesktop){
      showSteps('Instalar no Mac',[
        'Abra esta página no Safari do Mac.',
        'No menu Arquivo, escolha Adicionar ao Dock (ou Compartilhar > Adicionar ao Dock).',
        'Confirme em Adicionar.'
      ],'A TeleSaúde PromoVie será adicionada ao Dock e poderá abrir como aplicativo em janela separada.');
    }else{
      showSteps('Instalar no computador',[
        'Abra a página no Microsoft Edge ou Google Chrome.',
        'No Edge, abra o menu de três pontos (⋯), procure Aplicativos e escolha Instalar este site como aplicativo. No Chrome, procure a opção Instalar página como aplicativo.',
        'Confirme a instalação e, no Windows, fixe o aplicativo na barra de tarefas pelo menu do próprio aplicativo ou pelo ícone.'
      ],'A fixação na barra de tarefas depende de uma confirmação do sistema. Nenhum site consegue fazê-la sozinho.');
    }
  }

  document.getElementById('pwa-install-android')?.addEventListener('click',androidInstall);
  document.getElementById('pwa-install-apple')?.addEventListener('click',appleInstall);
  document.getElementById('pwa-install-desktop')?.addEventListener('click',desktopInstall);
  dialog.querySelector('[data-pwa-close]')?.addEventListener('click',function(){dialog.close();});
  dialog.addEventListener('click',function(event){
    if(event.target===dialog)dialog.close();
  });

  // Escopo restrito ao portal: rede sempre, sem armazenamento de dados pessoais.
  // O atendimento da Médiquo e suas chamadas de API não passam por este manipulador.
  if('serviceWorker' in navigator){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/telesaude/sw.js',{
        scope:'/telesaude/',updateViaCache:'none'
      }).catch(function(){/* Instalação alternativa continua disponível. */});
    },{once:true});
  }
})();
