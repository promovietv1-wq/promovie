'use strict';
const API='/telesaude/meu-espaco/api',CONSENT='2026-11-06-v1';
const $=id=>document.getElementById(id);let csrf='',version=0,idleTimer;
const say=text=>{$('message').textContent=text;};
function clear(){csrf='';version=0;clearTimeout(idleTimer);$('record').reset();$('login').reset();$('upload').reset();$('files').replaceChildren();$('space').hidden=true;$('logout').hidden=true;$('login-panel').hidden=false;$('erase').hidden=true;}
async function request(path,method='GET',data,extra={}){
  const r=await fetch(API+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'X-Health-Request':'1',...(method!=='GET'?{'X-CSRF-Token':csrf}:{}),...(data&&!(data instanceof File)?{'Content-Type':'application/json'}:{}),...extra},body:data?(data instanceof File?data:JSON.stringify(data)):undefined});
  if(!r.ok){if(r.status===401){clear();}const result=await r.json();throw Error(result.error||'Não foi possível concluir.');}return r;
}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function files(){const result=await(await request('/files')).json();$('files').replaceChildren();if(!result.files.length){const li=document.createElement('li');li.textContent='Seus documentos aparecerão aqui.';$('files').append(li);}
  for(const f of result.files){const li=document.createElement('li'),title=document.createElement('span'),get=document.createElement('button'),remove=document.createElement('button');title.textContent=f.name+' · '+(f.size/1024).toFixed(0)+' KB';get.textContent='Baixar';get.className='secondary';remove.textContent='Excluir';remove.className='danger';get.onclick=()=>run(get,async()=>download(await(await request('/files/'+f.id)).blob(),f.name));remove.onclick=()=>{if(!confirm('Excluir este documento do seu espaço?'))return;run(remove,async()=>{await request('/files/'+f.id,'DELETE');await files();});};li.append(title,get,remove);$('files').append(li);}
}
async function load(){const [s,r]=await Promise.all([request('/session').then(r=>r.json()),request('/record').then(r=>r.json())]);csrf=s.csrf;version=r.version;for(const [key,value]of Object.entries(r.data))$('record').elements.namedItem(key).value=value;await files();$('login-panel').hidden=true;$('space').hidden=false;$('logout').hidden=false;arm();}
function arm(){clearTimeout(idleTimer);idleTimer=setTimeout(async()=>{try{await request('/session','DELETE');}catch{}clear();say('Sessão encerrada por inatividade. Acesse novamente.');},14*60*1000);}
async function run(button,fn){button.disabled=true;try{await fn();if(csrf)arm();}catch(e){say(e.message);}finally{button.disabled=false;}}
$('login').onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{const f=e.target;const r=await(await request('/session','POST',{cpf:f.cpf.value,codigo:f.codigo.value,consent:f.consent.checked?CONSENT:''})).json();csrf=r.csrf;f.codigo.value='';await load();say('');});};
$('record').onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{const data={};for(const k of ['essenciais','alergias','medicamentos','anotacoes','perguntas'])data[k]=e.target.elements.namedItem(k).value;const r=await(await request('/record','PUT',{data,version})).json();version=r.version;$('saved').textContent='Informações salvas.';say('');});};
$('upload').onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{const file=e.target.arquivo.files[0];if(!file||file.size>5*1024*1024)throw Error('Escolha um arquivo de até 5 MB.');say('Verificando e guardando documento…');await request('/files','POST',file,{'X-File-Name':encodeURIComponent(file.name)});e.target.reset();await files();say('Documento guardado.');});};
$('logout').onclick=()=>run($('logout'),async()=>{try{await request('/session','DELETE');clear();say('Você saiu do espaço.');}catch(e){clear();throw Error('Campos limpos. Não foi possível confirmar a saída no servidor; a sessão expira em até 15 minutos.');}});
$('export').onclick=()=>run($('export'),async()=>{download(await(await request('/export','POST')).blob(),'meu-espaco.ndjson');say('Exportação concluída. Guarde o arquivo em local seguro.');});
$('delete-open').onclick=()=>{$('erase').hidden=false;};$('delete-cancel').onclick=()=>{$('erase').hidden=true;$('erase').reset();};
$('erase').onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{await request('/space','DELETE',{confirm:e.target.confirm.value});clear();say('Seu espaço foi excluído.');});};
window.addEventListener('pagehide',()=>clear());window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
load().catch(e=>{clear();if(!e.message.includes('Acesse novamente'))say(e.message);});
