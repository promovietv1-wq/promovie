/* Meu Espaço de Saúde. Dados clínicos são cifrados localmente antes de qualquer envio.
   Sem localStorage, IndexedDB, cookies JS ou acesso ao SDK Médiquo. */
(function(){
  "use strict";
  // Permitir somente o quadro interno da própria página de atendimento.
  // Continuar bloqueando quadros externos e outros caminhos do mesmo domínio.
  if(window.top!==window.self){
    let permitted=false;
    try{
      const params=new URLSearchParams(location.search);
      permitted=window.parent===window.top&&
        window.parent.location.origin===location.origin&&
        ["/telesaude/atendimento/","/telesaude/atendimento-especialidades-20261107/"]
          .includes(window.parent.location.pathname)&&
        params.get("atendimento")==="aberto"&&params.get("integrado")==="1"&&
        /^#pv-handoff=[0-9a-f-]{36}$/i.test(location.hash);
    }catch{}
    if(!permitted){document.body.replaceChildren();return;}
    // O retorno visível fica no cabeçalho da página do atendimento.
    // Evitar um segundo botão aparente dentro do quadro de registros.
    document.documentElement.classList.add("pv-space-embedded");
  }
  const BASE="https://backend.promovie.tv.br/api/promovie/space/v1";
  const MAX_FILE=500*1024;
  const LIMIT_NOTES=50;
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const $=id=>document.getElementById(id);
  const state={token:null,key:null,docKey:null,salt:null,revision:0,record:null,data:null,
    nextKey:null,nextSalt:null,previousSalt:null,recoveryMode:null,dirty:false,busy:false};
  const profileFields=[["allergies","alergias"],["medications","medicamentos"],["history","historico"]];
  const names={pergunta:"Pergunta",sintoma:"Sintoma ou observação",outro:"Anotação"};

  // Exibir instruções junto à preparação da consulta, sem prometer
  // troca automática de abas que o navegador pode bloquear.
  if(new URLSearchParams(location.search).get("atendimento")==="aberto"){
    const back=$("back-to-access"),guidance=$("attendance-guidance");
    if(back)back.hidden=true;
    if(guidance)guidance.hidden=false;
  }

  function notice(message,type="info"){
    const p=$("feedback");
    // No celular, o retorno é feito pelo botão do próprio aplicativo.
    // Não orientar a seleção de abas de navegador na interface mobile.
    const mobile=typeof window.matchMedia==="function"&&
      window.matchMedia("(max-width:700px)").matches;
    if(type==="navigation"&&(window.parent!==window||mobile)){
      p.textContent="";p.hidden=true;p.removeAttribute("data-kind");
      return;
    }
    p.textContent=message||"";p.hidden=!message;p.dataset.kind=type;
    if(message)p.scrollIntoView({block:"nearest",behavior:"smooth"});
  }
  function view(name){
    // Nunca renderizar o formulário de CPF durante um login compartilhado.
    $("loading-view").hidden=true;
    for(const v of ["login","unlock","workspace"])$(v+"-view").hidden=v!==name;
  }
  function waiting(flag){
    state.busy=flag;
    for(const b of document.querySelectorAll('button'))if(b.id!=="close-summary")b.disabled=flag;
  }
  function fresh(){
    return {version:1,perfil:{alergias:"",medicamentos:"",historico:""},anotacoes:[],documentos:[]};
  }
  function reset(){
    state.token=null;state.key=null;state.docKey=null;state.salt=null;state.revision=0;
    state.record=null;state.data=null;state.nextKey=null;state.nextSalt=null;state.previousSalt=null;
    state.recoveryMode=null;state.dirty=false;
    $("access-code").value="";$("vault-passphrase").value="";
    $("privacy-consent").checked=false;
    $("summary-text").textContent="";$("summary-dialog").close?.();view("login");
  }
  function encode64(bytes){
    let binary="";
    const arr=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    for(let i=0;i<arr.length;i+=16384)binary+=String.fromCharCode(...arr.subarray(i,i+16384));
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }
  function decode64(s){
    const binary=atob(s.replace(/-/g,"+").replace(/_/g,"/"));
    return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  }
  async function api(path,{method="GET",data}={}){
    const headers={};
    if(data!==undefined)headers["Content-Type"]="application/json";
    if(state.token)headers.Authorization="Bearer "+state.token;
    const response=await fetch(BASE+path,{method,mode:"cors",credentials:"omit",cache:"no-store",referrerPolicy:"no-referrer",
      headers,...(data!==undefined?{body:JSON.stringify(data)}:{})});
    let body={};try{body=await response.json();}catch{}
    if(!response.ok){
      if(response.status===401&&path!=="/session"){
        reset();
        throw Error("Sua sessão terminou ou seu código foi revogado. Entre novamente.");
      }
      throw Error(body.error||"Não foi possível concluir. Verifique sua conexão.");
    }
    return body;
  }
  async function keyFor(phrase,salt){
    const base=await crypto.subtle.importKey("raw",encoder.encode(phrase),{name:"PBKDF2"},false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt:decode64(salt),iterations:310000,hash:"SHA-256"},
      base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }
  // O código pessoal, já validado pelo backend, também protege os dados localmente.
  // Usamos outro domínio criptográfico para que a chave do cofre não seja a credencial da sessão.
  function codeSecret(code){
    const normalized=String(code||"").trim().toUpperCase().replace(/[\s-]/g,"");
    if(!/^[A-HJ-NP-Z2-9]{20}$/.test(normalized))throw Error("Código pessoal inválido.");
    return "PromoVie|EspacoSaude|codigo-v2|"+normalized;
  }
  function newCodeSalt(){return "c2_"+encode64(crypto.getRandomValues(new Uint8Array(16)));}
  async function keyForCode(code,salt){
    if(!/^c2_[A-Za-z0-9_-]{22}$/.test(salt))throw Error("Formato criptográfico inválido.");
    return keyFor(codeSecret(code),salt.slice(3));
  }
  async function rawKeyBits(secret,salt){
    const material=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"PBKDF2"},false,["deriveBits"]);
    return crypto.subtle.deriveBits({name:"PBKDF2",salt:decode64(salt),iterations:310000,hash:"SHA-256"},material,256);
  }
  async function openRecord(key,record){
    let raw;
    try{raw=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode64(record.iv)},key,decode64(record.ciphertext));}
    catch{throw Error("Não foi possível abrir os dados com a credencial utilizada.");}
    let data;
    try{data=JSON.parse(decoder.decode(raw));}catch{throw Error("Os dados não estão íntegros.");}
    if(data?.version!==1||!data.perfil||!Array.isArray(data.anotacoes)||!Array.isArray(data.documentos))
      throw Error("Formato dos dados não reconhecido. Nada foi alterado.");
    return data;
  }
  async function importDocumentKey(data){
    if(!data.documentKey)return null;
    const bits=decode64(data.documentKey);
    if(bits.byteLength!==32)throw Error("Chave antiga do documento inválida.");
    const key=await crypto.subtle.importKey("raw",bits,{name:"AES-GCM"},false,["encrypt","decrypt"]);
    bits.fill(0);
    return key;
  }
  async function encryptBytes(bytes,iv,key=state.key){
    return new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,bytes));
  }
  async function decryptBytes(cipher,iv){
    return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:decode64(iv)},state.docKey||state.key,cipher));
  }
  function changed(){
    state.dirty=true;$("save-state").textContent="Informações ainda não salvas";
  }
  function collectProfile(){
    for(const [id,field] of profileFields)state.data.perfil[field]=$(id).value.slice(0,4000);
  }
  function render(){
    for(const [id,field] of profileFields)$(id).value=String(state.data.perfil?.[field]||"");
    const notes=$("notes-list"),docs=$("documents-list");
    notes.replaceChildren();docs.replaceChildren();
    const noteItems=Array.isArray(state.data.anotacoes)?state.data.anotacoes:[];
    const docItems=Array.isArray(state.data.documentos)?state.data.documentos:[];
    $("notes-empty").hidden=noteItems.length>0;$("documents-empty").hidden=docItems.length>0;
    for(const note of noteItems){
      const li=document.createElement("li"),wrap=document.createElement("div");
      const title=document.createElement("strong"),details=document.createElement("span"),del=document.createElement("button");
      title.textContent=names[note.tipo]||"Anotação";details.textContent=note.texto||"";
      del.type="button";del.className="delete";del.textContent="Excluir";del.setAttribute("aria-label","Excluir anotação");
      del.addEventListener("click",()=>{state.data.anotacoes=state.data.anotacoes.filter(x=>x.id!==note.id);changed();renderNotes();});
      wrap.append(title,details);li.append(wrap,del);notes.appendChild(li);
    }
    for(const doc of docItems){
      const li=document.createElement("li"),wrap=document.createElement("div");
      const title=document.createElement("strong"),details=document.createElement("span");
      const open=document.createElement("button"),del=document.createElement("button");
      title.textContent=doc.nome||"Documento";details.textContent=doc.tamanho?Math.ceil(doc.tamanho/1024)+" KB · Criptografado":"Criptografado";
      open.type="button";open.textContent="Baixar arquivo";open.addEventListener("click",()=>downloadDoc(doc));
      del.type="button";del.textContent="Excluir";del.className="delete";del.addEventListener("click",()=>removeDoc(doc));
      wrap.append(title,details);li.append(wrap,open,del);docs.appendChild(li);
    }
    $("save-state").textContent=state.dirty?"Informações ainda não salvas":"Informações salvas";
  }
  function renderNotes(){
    // Manter alterações de texto ainda não salvas ao redesenhar a lista.
    collectProfile();
    render();
  }
  async function save(collectForm=true){
    if(!state.token||!state.key||!state.data)return;
    if(collectForm)collectProfile();
    if(state.data.anotacoes.length>LIMIT_NOTES)throw Error("Limite de anotações atingido.");
    const plain=encoder.encode(JSON.stringify(state.data));
    if(plain.byteLength>70000)throw Error("Suas anotações ultrapassaram o limite deste espaço.");
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await encryptBytes(plain,iv);
    const result=await api("/vault",{method:"PUT",data:{
      revision:state.revision,salt:state.salt,iv:encode64(iv),ciphertext:encode64(ciphertext),
      ...(state.revision===0?{consent:true}:{}),
      ...(state.previousSalt?{previousSalt:state.previousSalt}:{})
    }});
    state.revision=result.revision;state.previousSalt=null;
    state.record={salt:state.salt,iv:encode64(iv),ciphertext:encode64(ciphertext)};
    state.dirty=false;$("save-state").textContent="Informações salvas";
    return result;
  }
  async function protectedTask(job){
    if(state.busy)return;waiting(true);notice("");
    try{await job();}
    catch(e){notice(e?.message||"Não foi possível concluir a operação.","error");}
    finally{waiting(false);}
  }
  function finishOpen(){
    state.dirty=false;render();view("workspace");
  }
  function recoverView(mode){
    state.recoveryMode=mode;
    $("consent-row").hidden=true;$("privacy-consent").required=false;
    $("legacy-wrap").hidden=false;$("vault-passphrase").required=true;
    $("vault-passphrase").value="";
    $("old-credential-label").textContent=mode==="old-code"?"Código anterior":"Senha anterior";
    $("vault-passphrase").placeholder=mode==="old-code"?"Código usado antes da troca":"Senha usada ao criar este espaço";
    $("unlock-title").textContent="Atualizar acesso aos meus dados";
    $("unlock-description").textContent=mode==="old-code"?
      "Para preservar seus dados, informe o código anterior uma única vez.":
      "Para preservar seus dados, informe a senha usada anteriormente uma única vez.";
    $("unlock-submit").textContent="Confirmar e abrir";
    view("unlock");$("vault-passphrase").focus();
  }
  $("login-form").addEventListener("submit",e=>{
    e.preventDefault();
    protectedTask(async()=>{
      const cpf=$("cpf").value.replace(/\D/g,""),codigo=$("access-code").value;
      const session=await api("/session",{method:"POST",data:{cpf,codigo}});
      state.token=session.token;$("access-code").value="";
      const vault=await api("/vault");
      state.record=vault.record;state.revision=vault.revision;
      if(!vault.record){
        state.salt=newCodeSalt();
        state.key=await keyForCode(codigo,state.salt);
        state.data=fresh();state.docKey=null;
        $("legacy-wrap").hidden=true;$("vault-passphrase").required=false;
        $("consent-row").hidden=false;$("privacy-consent").required=true;
        $("unlock-title").textContent="Meu Espaço de Saúde";
        $("unlock-description").textContent="Você já está identificado. Ative seu espaço com o mesmo código da TeleSaúde.";
        $("unlock-submit").textContent="Ativar meu espaço";
        view("unlock");return;
      }
      if(vault.record.salt.startsWith("c2_")){
        try{
          const key=await keyForCode(codigo,vault.record.salt);
          const data=await openRecord(key,vault.record);
          const docKey=await importDocumentKey(data);
          state.key=key;state.salt=vault.record.salt;state.data=data;state.docKey=docKey;
          finishOpen();return;
        }catch(error){
          if(error.message!=="Não foi possível abrir os dados com a credencial utilizada.")throw error;
        }
      }
      // O novo código pode autenticar sem conseguir decifrar um cofre antigo.
      // Preservar o conteúdo e solicitar a credencial anterior apenas para migrar.
      state.nextSalt=newCodeSalt();
      state.nextKey=await keyForCode(codigo,state.nextSalt);
      recoverView(vault.record.salt.startsWith("c2_")?"old-code":"old-password");
    });
  });
  $("unlock-form").addEventListener("submit",e=>{
    e.preventDefault();
    protectedTask(async()=>{
      if(!state.record){
        if(!$("privacy-consent").checked)throw Error("Leia e aceite o aviso de privacidade para criar seu espaço.");
        await save();finishOpen();return;
      }
      const old=$("vault-passphrase").value;
      if(!old)throw Error("Informe a credencial anterior para preservar seus dados.");
      const isCode=state.recoveryMode==="old-code";
      const previousKey=isCode?
        await keyForCode(old,state.record.salt):
        await keyFor(old,state.record.salt);
      const data=await openRecord(previousKey,state.record);
      let docKey=await importDocumentKey(data);
      if(data.documentos.length&&!docKey){
        // Os anexos existentes continuam cifrados com a chave anterior.
        // Guardar somente a chave binária dentro do NOVO cofre criptografado.
        const oldSecret=isCode?codeSecret(old):old;
        const oldSalt=isCode?state.record.salt.slice(3):state.record.salt;
        const bits=await rawKeyBits(oldSecret,oldSalt);
        data.documentKey=encode64(bits);
        docKey=await crypto.subtle.importKey("raw",bits,{name:"AES-GCM"},false,["encrypt","decrypt"]);
        new Uint8Array(bits).fill(0);
      }
      state.data=data;state.docKey=docKey;
      state.previousSalt=state.record.salt;state.salt=state.nextSalt;state.key=state.nextKey;
      // No formulário de recuperação os campos clínicos estão ocultos e vazios;
      // não substituir o perfil recém-decriptado por esses campos em branco.
      await save(false);
      state.nextKey=null;state.nextSalt=null;state.recoveryMode=null;
      $("vault-passphrase").value="";
      finishOpen();
      notice("Informações preservadas. A partir de agora, use somente seu código pessoal atual.","success");
    });
  });
  for(const [id] of profileFields)$(id).addEventListener("input",()=>{if(state.data)changed();});
  $("note-form").addEventListener("submit",e=>{
    e.preventDefault();
    if(!state.data)return;
    const texto=$("note-text").value.trim();
    if(!texto){notice("Escreva uma anotação para adicionar.","error");return;}
    if(state.data.anotacoes.length>=LIMIT_NOTES){notice("Limite de 50 anotações atingido.","error");return;}
    state.data.anotacoes.unshift({id:crypto.randomUUID(),tipo:$("note-kind").value,texto,criadoEm:new Date().toISOString()});
    $("note-text").value="";changed();renderNotes();
  });
  $("save-all").addEventListener("click",()=>protectedTask(async()=>{await save();notice("Informações salvas com segurança.","success");}));
  $("logout").addEventListener("click",()=>{
    if(state.dirty&&!confirm("Existem alterações não salvas. Deseja sair mesmo assim?"))return;
    protectedTask(async()=>{await api("/logout",{method:"POST"}).catch(()=>{});reset();notice("Você saiu do seu espaço com segurança.");});
  });
  async function downloadDoc(doc){
    await protectedTask(async()=>{
      const stored=await api("/documents/"+encodeURIComponent(doc.id));
      const plain=await decryptBytes(decode64(stored.ciphertext),doc.iv);
      const mime=["application/pdf","image/png","image/jpeg"].includes(doc.tipo)?doc.tipo:"application/octet-stream";
      const filename=String(doc.nome||"documento").replace(/[\/\\\u0000-\u001f]/g,"_").slice(0,100);
      download(new Blob([plain],{type:mime}),filename);
      plain.fill(0);
    });
  }
  function download(blob,name){
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  $("upload-file").addEventListener("click",()=>protectedTask(async()=>{
    const file=$("file-input").files?.[0];
    if(!file)throw Error("Selecione um PDF ou imagem.");
    const mime=file.type||({pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png"}[file.name.split(".").pop().toLowerCase()]);
    if(!["application/pdf","image/jpeg","image/png"].includes(mime))throw Error("Use PDF, JPG ou PNG.");
    if(file.size===0||file.size>MAX_FILE)throw Error("O arquivo precisa ter até 500 KB.");
    if(state.data.documentos.length>=10)throw Error("Limite de dez documentos atingido.");
    if(state.dirty)await save();
    const id=crypto.randomUUID(),iv=crypto.getRandomValues(new Uint8Array(12));
    const buffer=await file.arrayBuffer();
    const ciphertext=await encryptBytes(new Uint8Array(buffer),iv,state.docKey||state.key);
    new Uint8Array(buffer).fill(0);
    await api("/documents",{method:"POST",data:{id,ciphertext:encode64(ciphertext)}});
    const meta={id,iv:encode64(iv),nome:file.name.slice(0,100),tipo:mime,tamanho:file.size,criadoEm:new Date().toISOString()};
    state.data.documentos.push(meta);
    try{await save();}catch(e){
      state.data.documentos=state.data.documentos.filter(d=>d.id!==id);
      await api("/documents/"+id,{method:"DELETE"}).catch(()=>{});
      throw e;
    }
    $("file-input").value="";render();notice("Arquivo salvo com criptografia. Ele não foi enviado ao profissional.","success");
  }));
  async function removeDoc(doc){
    if(!confirm("Excluir o documento “"+doc.nome+"”?"))return;
    await protectedTask(async()=>{
      if(state.dirty)await save();
      state.data.documentos=state.data.documentos.filter(d=>d.id!==doc.id);
      try{await save();}
      catch(e){state.data.documentos.push(doc);throw e;}
      await api("/documents/"+doc.id,{method:"DELETE"});
      render();notice("Documento excluído.","success");
    });
  }
  function summary(){
    collectProfile();
    const p=state.data.perfil;
    const out=["MEU RESUMO PARA A CONSULTA","", "Alergias e reações:",p.alergias||"Não informado","",
      "Medicamentos em uso:",p.medicamentos||"Não informado","",
      "Informações de saúde:",p.historico||"Não informado","", "Minhas anotações:"];
    const notes=state.data.anotacoes;
    for(const note of notes)out.push("• "+(names[note.tipo]||"Anotação")+": "+note.texto);
    if(!notes.length)out.push("Nenhuma anotação.");
    if(state.data.documentos.length){
      out.push("","Documentos guardados (não incluídos no resumo):");
      for(const d of state.data.documentos)out.push("• "+d.nome);
    }
    return out.join("\n");
  }
  $("make-summary").addEventListener("click",()=>{
    $("summary-text").textContent=summary();$("summary-dialog").showModal();
  });
  $("close-summary").addEventListener("click",()=>$("summary-dialog").close());
  $("summary-dialog").addEventListener("close",()=>$("summary-text").textContent="");
  $("copy-summary").addEventListener("click",()=>protectedTask(async()=>{
    await navigator.clipboard.writeText($("summary-text").textContent);
    notice("Resumo copiado. Compartilhe somente com quem você escolher.","success");
  }));
  $("export-backup").addEventListener("click",()=>protectedTask(async()=>{
    if(state.dirty)await save();
    const vault=await api("/vault");
    const documents=[];
    for(const doc of state.data.documentos){
      const stored=await api("/documents/"+doc.id);
      documents.push({id:doc.id,ciphertext:stored.ciphertext});
    }
    const bundle={format:"promovie-espaco-criptografado-v1",exportadoEm:new Date().toISOString(),
      vault:vault.record,documents};
    download(new Blob([JSON.stringify(bundle)],{type:"application/json"}),"promovie-espaco-protegido.json");
    notice("Cópia de segurança gerada. É um arquivo criptografado, não um PDF para leitura. Guarde seu código pessoal.","success");
  }));
  $("delete-vault").addEventListener("click",()=>protectedTask(async()=>{
    const decision=prompt("Esta ação apaga permanentemente informações e documentos. Para confirmar, digite EXCLUIR:");
    if(decision!=="EXCLUIR")return;
    // Exclusão permanece protegida por nova confirmação do código validada pelo backend.
    const codigo=prompt("Confirme o mesmo código pessoal da TeleSaúde para excluir os dados:");
    if(!codigo)throw Error("Operação cancelada.");
    await api("/vault",{method:"DELETE",data:{codigo}});reset();
    notice("Seu conteúdo pessoal foi excluído deste espaço.","success");
  }));
  // Login compartilhado vindo exclusivamente da aba de atendimento.
  // Sem salvar o token ou a chave em disco e sem mostrar o código pessoal novamente.
  function acceptAttendanceSession(){
    const marker=location.hash.match(/^#pv-handoff=([0-9a-f-]{36})$/i);
    if(!marker||new URLSearchParams(location.search).get("atendimento")!=="aberto"||
       typeof BroadcastChannel!=="function")return false;
    const id=marker[1];
    try{history.replaceState(null,"",location.pathname+location.search);}catch{}
    const channel=new BroadcastChannel("promovie:telesaude:space-handoff:v1");
    let completed=false;
    window.addEventListener("message",function(event){
      const source=window.parent!==window?window.parent:window.opener;
      if(completed||!source||event.source!==source||event.origin!==location.origin||
         event.data?.type!=="promovie-space-session"||event.data.id!==id)return;
      completed=true;channel.close();
      protectedTask(async()=>{
        try{
          const s=event.data.space;
          if(!s||!/^[A-Za-z0-9_-]{43}$/.test(s.token||"")||
             !["new","existing","recover"].includes(s.mode)||
             !/^c2_[A-Za-z0-9_-]{22}$/.test(s.salt||"")||
             !(s.key instanceof CryptoKey)||s.key.type!=="secret"||
             s.key.algorithm?.name!=="AES-GCM"||!s.key.usages.includes("decrypt"))
            throw Error("Sessão pessoal inválida.");
          state.token=s.token;
          const vault=await api("/vault");
          state.record=vault.record;state.revision=vault.revision;
          if(s.mode==="new"&&!vault.record){
            state.salt=s.salt;state.key=s.key;state.data=fresh();state.docKey=null;
            $("legacy-wrap").hidden=true;$("vault-passphrase").required=false;
            $("consent-row").hidden=false;$("privacy-consent").required=true;
            $("unlock-title").textContent="Meu Espaço de Saúde";
            $("unlock-description").textContent="Ative seu espaço com segurança.";
            $("unlock-submit").textContent="Ativar meu espaço";
            view("unlock");
          }else if(s.mode==="existing"&&vault.record?.salt===s.salt){
            const data=await openRecord(s.key,vault.record);
            state.key=s.key;state.salt=s.salt;state.data=data;
            state.docKey=await importDocumentKey(data);
            finishOpen();
          }else if(s.mode==="recover"&&vault.record){
            state.nextKey=s.key;state.nextSalt=s.salt;
            recoverView(vault.record.salt.startsWith("c2_")?"old-code":"old-password");
          }else{
            throw Error("Seu espaço foi atualizado. Entre novamente para continuar.");
          }
        }catch(error){
          reset();
          throw error;
        }
      });
    });
    channel.postMessage({type:"space-ready",id});
    setTimeout(()=>{
      if(completed)return;
      channel.close();
      // Se a sessão não chegar, oferecer a entrada manual só após a tentativa.
      view("login");
      notice("Não foi possível abrir automaticamente. Entre com seu CPF e código.","error");
    },12000);
    return true;
  }
  if(!acceptAttendanceSession())view("login");
  window.addEventListener("beforeunload",e=>{
    if(!state.dirty)return;
    e.preventDefault();e.returnValue="";
  });
  (async()=>{
    try{
      const health=await api("/health");
      if(!health.disponivel){
        $("login-form").querySelector("button").disabled=true;
        notice("Este espaço está em preparação. O atendimento médico continua disponível na TeleSaúde.","error");
      }
    }catch{
      $("login-form").querySelector("button").disabled=true;
      notice("Não foi possível verificar a disponibilidade do espaço. Tente novamente mais tarde.","error");
    }
  })();
})();
