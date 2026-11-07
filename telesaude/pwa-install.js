/* Guia para criar um atalho do portal. Nao altera login, token ou SDK Mediquo. */
(function(){
  "use strict";
  const section=document.getElementById("pwa-install-actions");
  const trigger=document.getElementById("pwa-install-shortcut");
  const dialog=document.getElementById("pwa-help-dialog");
  const deviceSelect=document.getElementById("pwa-help-device");
  const browserSelect=document.getElementById("pwa-help-browser");
  const steps=document.getElementById("pwa-help-steps");
  const note=document.getElementById("pwa-help-note");
  const figure=document.getElementById("pwa-help-figure");
  const photo=document.getElementById("pwa-help-photo");
  const credit=document.getElementById("pwa-help-photo-credit");
  const guide=document.getElementById("pwa-help-source");
  const nativeButton=document.getElementById("pwa-native-install");
  if(!section||!trigger||!dialog||!deviceSelect||!browserSelect||!steps||!note||!figure||!photo||!credit||!guide)return;

  const picApple="https://help.apple.com/assets/634D93C867B48F12442A1784/634D93C967B48F12442A1792/pt_BR/f8f0deb8446b1e154706060f49bcf69d.png";
  const picAndroid="https://t.ctcdn.com.br/dSK-ckh9U_nSZbBOKo850oHAhms%3D/1024x0/smart/i878517.png";
  const picFirefox="https://1955479456-files.gitbook.io/~/files/v0/b/gitbook-legacy-files/o/assets%2F-M785MmSBNTaRZ17qLXZ%2F-Meydh4bpgynqDtq_zFT%2F-MeyoE0w7FOw-9NFkWfV%2Ffirefox.jpeg?alt=media&token=3cca5a48-3809-41dc-a942-36aaabb30eaa";
  const picChromeDesktop="https://t.ctcdn.com.br/nWUqjfwPPhgn1UZkQjgq2N3HYoY%3D/1024x0/smart/i878519.png";
  const picEdge="https://support.microsoft.com/pt-br/edge/media/install-as-an-app.png";
  const apple="https://support.apple.com/pt-br/guide/iphone/iph42ab2f3a7/ios";
  const chromeAndroid="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=pt-BR";
  const chromeIOS="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DiOS&hl=pt-BR";
  const chromeDesktop="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=pt-BR";
  const firefoxAndroid="https://support.mozilla.org/pt-BR/kb/adicione-atalho-site-tela-inicial-android";
  const edgeDesktop="https://support.microsoft.com/pt-br/edge/install-manage-or-uninstall-apps-in-microsoft-edge";
  const macSafari="https://support.apple.com/pt-br/104996";
  const guides={
    iphone:{
      safari:{steps:["Abra a TeleSaúde no Safari.","Toque no menu da página e depois em Compartilhar. Se o botão Compartilhar já aparecer, use-o.","Role a lista e escolha Adicionar à Tela de Início.","Confirme em Adicionar. Se aparecer Abrir como App da Web, você pode deixar ativado."],note:"O ícone aparecerá na tela inicial do iPhone ou iPad.",photo:picApple,credit:"Captura da interface do Safari. Fonte: Suporte Apple.",source:apple},
      chrome:{steps:["Abra a TeleSaúde no Chrome para iPhone.","Toque em Compartilhar, próximo à barra de endereço.","Selecione Adicionar à tela inicial e confirme em Adicionar."],note:"No iOS, o comportamento do atalho pode variar conforme o navegador e a versão do sistema.",source:chromeIOS},
      firefox:{steps:["Abra a TeleSaúde no Firefox do iPhone.","Abra o menu de compartilhamento e procure Adicionar à Tela de Início.","Se a opção não aparecer, copie o endereço e use o Safari para criar o atalho."],note:"As opções variam entre versões do Firefox e do iOS.",source:apple},
      edge:{steps:["Abra a TeleSaúde no Edge do iPhone.","Abra o menu Compartilhar e procure Adicionar à Tela de Início.","Se não aparecer, abra o endereço no Safari e use Compartilhar > Adicionar à Tela de Início."],note:"O menu disponível depende da versão do iOS.",source:apple}
    },
    android:{
      chrome:{steps:["Abra a TeleSaúde no Chrome do Android.","Toque no menu de três pontos, ao lado da barra de endereço.","Escolha Instalar aplicativo ou Adicionar à tela inicial.","Confirme em Instalar ou Adicionar."],note:"O nome da opção muda conforme o Chrome e o aparelho.",photo:picAndroid,credit:"Capturas reais do Chrome no Android. Fonte: Canaltech.",source:chromeAndroid},
      firefox:{steps:["Abra a TeleSaúde no Firefox para Android.","Toque no menu do navegador.","Escolha Adicionar à tela do dispositivo e confirme em Adicionar."],note:"O ícone será criado na tela inicial do Android.",photo:picFirefox,credit:"Capturas da interface do Firefox no Android. Fonte: GoomerGo.",source:firefoxAndroid},
      edge:{steps:["Abra a TeleSaúde no Edge do Android.","Abra o menu de três pontos e procure Adicionar ao telefone ou Adicionar à tela inicial.","Confirme a criação do atalho."],note:"A nomenclatura varia conforme a versão do Edge.",source:chromeAndroid},
      samsung:{steps:["Abra a TeleSaúde no navegador Samsung Internet.","Abra o menu do navegador e procure Adicionar página a.","Escolha Tela inicial e confirme."],note:"A posição do menu depende da versão do Samsung Internet.",source:chromeAndroid}
    },
    windows:{
      chrome:{steps:["Abra a TeleSaúde no Chrome do computador.","Abra o menu de três pontos > Transmitir, salvar e compartilhar.","Clique em Instalar esta página como um app. Também pode aparecer um ícone de instalação na barra de endereço.","Confirme a instalação. Para fixar na área de trabalho, abra chrome://apps e crie o atalho do aplicativo."],note:"O ícone pode ser colocado na área de trabalho ou na barra de tarefas.",photo:picChromeDesktop,credit:"Captura do menu de instalação no Chrome. Fonte: Canaltech.",source:chromeDesktop},
      edge:{steps:["Abra a TeleSaúde no Microsoft Edge.","No menu de três pontos, procure Aplicativos > Instalar este site como aplicativo. Em algumas versões fica em Mais ferramentas > Aplicativos.","Confirme. Para fixar na área de trabalho ou na barra de tarefas, abra edge://apps."],note:"O navegador pode oferecer a instalação diretamente na barra de endereço.",photo:picEdge,credit:"Captura do menu Aplicativos. Fonte: Suporte Microsoft.",source:edgeDesktop},
      firefox:{steps:["Abra a TeleSaúde no Firefox do computador.","Para acesso rápido, salve a página nos Favoritos com Ctrl+D.","Se quiser um ícone na área de trabalho, use o recurso de atalho do Windows ou abra a TeleSaúde pelo Edge ou Chrome para instalar como aplicativo."],note:"O Firefox de computador não oferece a mesma instalação de aplicativos web que Chrome e Edge.",source:edgeDesktop}
    },
    mac:{
      safari:{steps:["Abra a TeleSaúde no Safari do Mac.","No menu Arquivo, escolha Adicionar ao Dock. Também pode estar em Compartilhar > Adicionar ao Dock.","Confirme em Adicionar."],note:"Disponível em Macs com macOS Sonoma 14 ou posterior.",source:macSafari},
      chrome:{steps:["Abra a TeleSaúde no Chrome do Mac.","Abra o menu de três pontos > Transmitir, salvar e compartilhar > Instalar esta página como um app.","Confirme. O aplicativo poderá ser aberto e fixado no Dock."],note:"Algumas versões mostram o botão Instalar na barra de endereço.",photo:picChromeDesktop,credit:"Captura do menu de instalação no Chrome. Fonte: Canaltech.",source:chromeDesktop},
      edge:{steps:["Abra a TeleSaúde no Edge do Mac.","Abra o menu de três pontos > Aplicativos > Instalar este site como aplicativo.","Confirme. Depois, você poderá abrir o app e adicioná-lo ao Dock."],note:"A organização do menu pode variar.",photo:picEdge,credit:"Captura do menu Aplicativos. Fonte: Suporte Microsoft.",source:edgeDesktop},
      firefox:{steps:["Abra a TeleSaúde no Firefox do Mac.","Salve a página como favorita com Command+D.","Para um aplicativo separado, abra o mesmo endereço no Safari, Chrome ou Edge e siga a opção de instalar."],note:"A instalação nativa como app depende do navegador.",source:macSafari}
    }
  };
  const browserNames={safari:"Safari",chrome:"Chrome",firefox:"Firefox",edge:"Edge",samsung:"Samsung Internet"};
  const ua=navigator.userAgent||"";
  const iphone=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua);
  const mac=!iphone&&!android&&/Macintosh|Mac OS X/i.test(ua);
  const initialDevice=iphone?"iphone":android?"android":mac?"mac":"windows";
  const initialBrowser=/Edg|EdgiOS|EdgA/i.test(ua)?"edge":/Firefox|FxiOS/i.test(ua)?"firefox":/SamsungBrowser/i.test(ua)?"samsung":/CriOS|Chrome/i.test(ua)?"chrome":"safari";
  deviceSelect.value=initialDevice;
  let installPrompt=null;

  function installed(){
    return (typeof window.matchMedia==="function"&&window.matchMedia("(display-mode: standalone)").matches)||
      navigator.standalone===true;
  }
  function updateInstalled(){section.hidden=installed();}
  updateInstalled();
  window.addEventListener("appinstalled",function(){installPrompt=null;updateInstalled();});
  window.addEventListener("beforeinstallprompt",function(event){
    event.preventDefault();
    installPrompt=event;
    if(nativeButton)nativeButton.hidden=false;
  });
  function setBrowsers(){
    const available=Object.keys(guides[deviceSelect.value]||guides.iphone);
    const selected=browserSelect.value;
    browserSelect.replaceChildren();
    available.forEach(function(key){
      const option=document.createElement("option");
      option.value=key;option.textContent=browserNames[key];
      browserSelect.appendChild(option);
    });
    browserSelect.value=available.includes(selected)?selected:available.includes(initialBrowser)?initialBrowser:available[0];
    render();
  }
  function render(){
    const current=guides[deviceSelect.value]?.[browserSelect.value];
    if(!current)return;
    steps.replaceChildren();
    current.steps.forEach(function(line){
      const li=document.createElement("li");li.textContent=line;steps.appendChild(li);
    });
    note.textContent=current.note;
    guide.href=current.source;guide.hidden=false;
    const url=current.photo||"";
    photo.onload=function(){figure.hidden=false;};
    photo.onerror=function(){figure.hidden=true;};
    figure.hidden=!url;
    if(url){
      credit.textContent=current.credit||"Captura de tela real do navegador.";
      photo.alt="Captura de tela real do menu de atalho ou instalacao do navegador";
      photo.src=url;
      if(photo.complete&&photo.naturalWidth)figure.hidden=false;
    }else{
      photo.removeAttribute("src");
    }
    if(nativeButton)nativeButton.hidden=!installPrompt;
  }
  deviceSelect.addEventListener("change",setBrowsers);
  browserSelect.addEventListener("change",render);
  setBrowsers();
  trigger.addEventListener("click",function(){
    updateInstalled();
    if(section.hidden)return;
    if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
  });
  nativeButton?.addEventListener("click",async function(){
    if(!installPrompt)return;
    const prompt=installPrompt;
    installPrompt=null;nativeButton.hidden=true;
    try{
      await prompt.prompt();
      await prompt.userChoice;
      updateInstalled();
    }catch{/* As instrucoes manuais continuam visiveis. */}
  });
  dialog.querySelector("[data-pwa-close]")?.addEventListener("click",function(){dialog.close();});
  dialog.addEventListener("click",function(event){if(event.target===dialog)dialog.close();});
  // O SW abrange somente a pagina publica; nao armazena sessoes ou dados de saude.
  if("serviceWorker" in navigator){
    window.addEventListener("load",function(){
      navigator.serviceWorker.register("/telesaude/sw.js",{scope:"/telesaude/",updateViaCache:"none"}).catch(function(){});
    },{once:true});
  }
})();