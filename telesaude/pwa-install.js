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
  if(!section||!trigger||!dialog||!deviceSelect||!browserSelect||!steps||!note||!figure||!photo||!credit||!guide)return;

  const picApple="https://help.apple.com/assets/634D93C867B48F12442A1784/634D93C967B48F12442A1792/pt_BR/f8f0deb8446b1e154706060f49bcf69d.png";
  const picFirefox="https://1955479456-files.gitbook.io/~/files/v0/b/gitbook-legacy-files/o/assets%2F-M785MmSBNTaRZ17qLXZ%2F-Meydh4bpgynqDtq_zFT%2F-MeyoE0w7FOw-9NFkWfV%2Ffirefox.jpeg?alt=media&token=3cca5a48-3809-41dc-a942-36aaabb30eaa";
  const apple="https://support.apple.com/pt-br/guide/iphone/iph42ab2f3a7/ios";
  const chromeAndroid="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&hl=pt-BR";
  const chromeAndroidTabs="https://support.google.com/chrome/answer/11032183?co=GENIE.Platform%3DAndroid&hl=pt-BR";
  const chromeDesktop="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DDesktop&hl=pt-BR";
  const chromeIOS="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DiOS&hl=pt-BR";
  const firefoxAndroid="https://support.mozilla.org/pt-BR/kb/adicione-atalho-site-tela-inicial-android";
  const firefoxDesktop="https://support.mozilla.org/pt-BR/kb/crie-um-atalho-para-um-site-no-desktop";
  const windows="https://support.microsoft.com/pt-br/windows";
  const safariMac="https://support.apple.com/pt-br/guide/safari/welcome/mac";
  const guides={
    iphone:{
      safari:{steps:[
        "Toque em Compartilhar e escolha Adicionar à Tela de Início.",
        "Na tela seguinte, DESATIVE a opção Abrir como app web.",
        "Toque em Adicionar. O atalho abrirá a TeleSaúde no navegador, com as abas."
      ],note:"Importante: mantenha Abrir como app web desligado, como no exemplo. O atalho não deve abrir em uma janela de aplicativo.",photo:picApple,credit:"Captura de interface do Safari. Fonte: Apple.",source:apple},
      chrome:{steps:[
        "No Google Chrome, toque em Compartilhar e procure Adicionar à Tela de Início.",
        "Se aparecer Abrir como app web, deixe desativado.",
        "Confirme em Adicionar. Se a opção não existir, salve a página nos favoritos do Google Chrome."
      ],note:"Mantenha a consulta e os registros no mesmo navegador. Não escolha instalar aplicativo.",source:chromeIOS},
      firefox:{steps:[
        "Abra o menu de compartilhamento do Firefox e procure Adicionar à Tela de Início.",
        "Se aparecer Abrir como app web, deixe desativado, depois confirme.",
        "Se essa opção não existir no Firefox, use os favoritos do próprio navegador."
      ],note:"O atalho deve abrir como página do navegador, não como aplicativo independente.",source:apple},
      edge:{steps:[
        "No Edge, abra Compartilhar e procure Adicionar à Tela de Início.",
        "Se aparecer Abrir como app web, deixe desativado.",
        "Se a opção não estiver disponível, salve a TeleSaúde nos favoritos do Edge."
      ],note:"Não escolha instalação de aplicativo.",source:apple}
    },
    android:{
      chrome:{steps:[
        "No Google Chrome, toque em ⋮ > Instalar e criar atalho > Criar atalho.",
        "Confirme em Adicionar. Escolha Criar atalho, nunca Instalar.",
        "Se aparecer apenas Instalar, não prossiga: na Nova guia do Google Chrome, use Adicionar novo > Adicionar atalho e informe o endereço da TeleSaúde."
      ],note:"O atalho com o símbolo do Google Chrome abre no próprio navegador e preserva a navegação por abas.",source:chromeAndroid},
      firefox:{steps:[
        "Abra o menu do Firefox e escolha Adicionar à tela do dispositivo.",
        "Confirme em Adicionar. Não escolha uma opção de instalar aplicativo."
      ],note:"O atalho abre no navegador.",photo:picFirefox,credit:"Captura da interface do Firefox no Android.",source:firefoxAndroid},
      edge:{steps:[
        "Abra o menu do Edge e procure Adicionar à tela inicial ou Criar atalho.",
        "Confirme apenas se for um atalho para o navegador. Não selecione Instalar aplicativo.",
        "Se não houver opção de atalho, salve a página nos favoritos do Edge."
      ],note:"As opções variam conforme a versão do Edge.",source:chromeAndroid},
      samsung:{steps:[
        "No Samsung Internet, toque em ☰ > Adicionar página a.",
        "Escolha Tela inicial e confirme. Não selecione instalação de aplicativo."
      ],note:"Crie o ícone de acesso ao site, não um aplicativo separado.",source:chromeAndroid}
    },
    windows:{
      chrome:{steps:[
        "No Google Chrome, clique em ⋮ > Transmitir, salvar e compartilhar > Criar atalho.",
        "Escolha o nome TeleSaúde e clique em Criar.",
        "Não selecione Instalar página como aplicativo."
      ],note:"O atalho comum abre o endereço no navegador. Evite o modo de janela de aplicativo.",source:chromeDesktop},
      edge:{steps:[
        "Na área de trabalho do Windows, clique com o botão direito > Novo > Atalho.",
        "Cole https://www.promovie.tv.br/telesaude/ e avance.",
        "Dê o nome TeleSaúde e conclua. Não use Instalar este site como aplicativo."
      ],note:"O atalho abre no navegador padrão. Se utiliza Edge na consulta, mantenha-o como navegador padrão.",source:windows},
      firefox:{steps:[
        "Deixe uma parte da área de trabalho visível.",
        "Arraste o cadeado ao lado do endereço da TeleSaúde para a área de trabalho.",
        "Solte para criar o atalho. Não instale um aplicativo."
      ],note:"O atalho abre no navegador padrão.",source:firefoxDesktop}
    },
    mac:{
      safari:{steps:[
        "Reduza um pouco a janela do Safari para deixar a Mesa visível.",
        "Arraste o endereço da TeleSaúde da barra do Safari para a Mesa.",
        "Use esse atalho do site. Não selecione Adicionar ao Dock como aplicativo."
      ],note:"O atalho abre no navegador padrão, sem janela de aplicativo independente.",source:safariMac},
      chrome:{steps:[
        "No Google Chrome, clique em ⋮ > Transmitir, salvar e compartilhar > Criar atalho.",
        "Nomeie como TeleSaúde e confirme em Criar.",
        "Não escolha Instalar página como aplicativo."
      ],note:"É um atalho comum para a página, não um aplicativo.",source:chromeDesktop},
      edge:{steps:[
        "Reduza a janela do Edge para deixar a Mesa visível.",
        "Arraste o endereço da página para a Mesa, criando um atalho do site.",
        "Não use Instalar este site como aplicativo."
      ],note:"O endereço será aberto no navegador padrão.",source:safariMac},
      firefox:{steps:[
        "Deixe a Mesa visível ao lado da janela do Firefox.",
        "Arraste o cadeado da barra de endereços para a Mesa.",
        "Solte para criar o atalho do site."
      ],note:"O atalho abre no navegador padrão.",source:firefoxDesktop}
    }
  };
  const browserNames={safari:"Safari",chrome:"Google Chrome",firefox:"Firefox",edge:"Microsoft Edge",samsung:"Samsung Internet"};
  const ua=navigator.userAgent||"";
  const iphone=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua);
  const mac=!iphone&&!android&&/Macintosh|Mac OS X/i.test(ua);
  const initialDevice=iphone?"iphone":android?"android":mac?"mac":"windows";
  const initialBrowser=/Edg|EdgiOS|EdgA/i.test(ua)?"edge":/Firefox|FxiOS/i.test(ua)?"firefox":/SamsungBrowser/i.test(ua)?"samsung":/CriOS|Chrome/i.test(ua)?"chrome":"safari";
  deviceSelect.value=initialDevice;

  function installed(){
    return (typeof window.matchMedia==="function"&&window.matchMedia("(display-mode: standalone)").matches)||
      navigator.standalone===true;
  }
  function updateInstalled(){section.hidden=installed();}
  updateInstalled();
  // Suprimir o convite automatico de instalacao: so oferecemos atalhos comuns.
  window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();});
  window.addEventListener("appinstalled",updateInstalled);
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
  }
  deviceSelect.addEventListener("change",setBrowsers);
  browserSelect.addEventListener("change",render);
  setBrowsers();
  trigger.addEventListener("click",function(){
    updateInstalled();
    if(section.hidden)return;
    if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
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