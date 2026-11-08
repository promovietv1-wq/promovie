# Inspeção do roteamento público da Médiquo

Somente código público, nenhuma sessão ou credencial do paciente.


## https://widget.mediquo.com/js/1.0.0/mediquo.js
- tipo: application/javascript; charset=UTF-8
- tamanho: 11891
- sha256: 053525be8269838b71f9f27ee1bc3c901ccaa5f3e8e84b7907f9080b8256fbe8

### open_room
- 2078: );     launcher       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload: { path } },           "*"         )       : console.error("MediquoWidget hasn't been initialized");   },   open_room: (professional_hash) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "open_room", payload: { profes
- 2349: nt.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "open_room", payload: { professional_hash } },           "*"         )       : console.error("MediquoWidget container hasn't been initialized");   },   open_list: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.co
- 8368:    case "open":               launcher.contentWindow?.postMessage({ command: "open" }, "*");               container.contentWindow?.postMessage({ command: "open" }, "*");               break;             case "open_room":               launcher.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );               container.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );          

### professional_hash
- 2090: her       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload: { path } },           "*"         )       : console.error("MediquoWidget hasn't been initialized");   },   open_room: (professional_hash) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "open_room", payload: { professional_hash 
- 2372: uoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "open_room", payload: { professional_hash } },           "*"         )       : console.error("MediquoWidget container hasn't been initialized");   },   open_list: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     contain

### open_list
- 2500: launcher.contentWindow?.postMessage(           { command: "open_room", payload: { professional_hash } },           "*"         )       : console.error("MediquoWidget container hasn't been initialized");   },   open_list: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload: { path: "/" } },          
- 7853: "styles":               MediquoWidget.setStyles({                 element: { launcher: launcher, container: container }[target],                 styles,               });               break;             case "open_list":               container.contentWindow?.postMessage(                 { command: "open_list" },                 "*"               );               launcher.contentWindow?.postMessage(                 { command: "navigate", payload: { path: "/" } },                 "*"               );     
- 7945: her, container: container }[target],                 styles,               });               break;             case "open_list":               container.contentWindow?.postMessage(                 { command: "open_list" },                 "*"               );               launcher.contentWindow?.postMessage(                 { command: "navigate", payload: { path: "/" } },                 "*"               );             case "open":               launcher.contentWindow?.postMessage({ command: "open" }, 

### navigate
- 1779: r = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "logout" }, "*")       : console.warn("MediquoWidget hasn't been initialized");   },   navigate: (path) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload: { path } },           "*"         )       : console.error("MediquoWidget hasn't been initialized");   },   o
- 1951: get hasn't been initialized");   },   navigate: (path) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload: { path } },           "*"         )       : console.error("MediquoWidget hasn't been initialized");   },   open_room: (professional_hash) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.container
- 2754: nt.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload: { path: "/" } },           "*"         ) && launcher.contentWindow?.postMessage({ command: "open" }, "*")       : console.error("MediquoWidget container hasn't been initialized");   },   change_lifecycle: (state) => {     var launcher = document.getElementById(MediquoWidget.launc

### postMessage
- 1007: yles)       .map(([key, value]) => `${key}: ${value};`)       .join(" ");   },   open: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "open" }, "*")       : console.error("MediquoWidget hasn't been initialized");   },   close: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "close" }, "*")       : console.warn("
- 1246:  }, "*")       : console.error("MediquoWidget hasn't been initialized");   },   close: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "close" }, "*")       : console.warn("MediquoWidget hasn't been initialized");   },   destroy: () => {     MediquoWidget.logout();     document.getElementById(MediquoWidget.launcherId)?.remove();     document.getElementById(MediquoWidget.containerId)?.remove();   },   logout: 
- 1669: ve();     document.getElementById(MediquoWidget.containerId)?.remove();   },   logout: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "logout" }, "*")       : console.warn("MediquoWidget hasn't been initialized");   },   navigate: (path) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload

## Trechos do wrapper: createIframe:
- 149: var MediquoWidget = {   launcherId: "MediquoLauncher",   containerId: "MediquoContainer",   pendingConsultations: undefined,   adapter: undefined,   createIframe: ({ src, id }) => {     document.getElementById(id) && document.getElementById(id).remove();     var iframe = document.createElement("iframe");     iframe.setAttribute("id", id);     iframe.setAttribute("src", src);     iframe.setAttribute("title", id);     iframe.setAttribute("allow", 

## Trechos do wrapper: init:
- 3864: (adapter === "native" || !adapter) {       window.parent.postMessage(         {           command: "mediquo_native_lifecycle_changed",           payload: { state },         },         "*"       );     }   },   init: (params) => {     return new Promise((resolve, reject) => {       if (params && !params.apiKey) {         console.error("apiKey is required");         return;       }       var {         apiKey,         accessToken,         environment = "production",         show = "always",         showInit

## Trechos do wrapper: containerId:
- 57: var MediquoWidget = {   launcherId: "MediquoLauncher",   containerId: "MediquoContainer",   pendingConsultations: undefined,   adapter: undefined,   createIframe: ({ src, id }) => {     document.getElementById(id) && document.getElementById(id).remove();     var iframe = document.createElement("iframe");     iframe.setAttribute("id", id);     iframe.setAt

## Trechos do wrapper: launcherId:
- 24: var MediquoWidget = {   launcherId: "MediquoLauncher",   containerId: "MediquoContainer",   pendingConsultations: undefined,   adapter: undefined,   createIframe: ({ src, id }) => {     document.getElementById(id) && document.getElementById(id).remove();     var iframe = document.createElement("iframe");     iframe.setAttr

## Trechos do wrapper: case "open_room"
- 8362:          case "open":               launcher.contentWindow?.postMessage({ command: "open" }, "*");               container.contentWindow?.postMessage({ command: "open" }, "*");               break;             case "open_room":               launcher.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );               container.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );    

## Trechos do wrapper: case "navigate"
- 8693:                "*"               );               container.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );               break;             case "navigate":               container.contentWindow?.postMessage(                 { command: "navigate", payload },                 "*"               );               break;             case "close":               launcher.contentWindow?.postMessage({ command: "close" }, "*");               cont

## URLs de iframes no código público
- `${context}launcher/index.html`
- context

## https://widget.mediquo.com/launcher/index.html
- tipo: text/html; charset=UTF-8
- tamanho: 524
- sha256: af3374df61b1565c87af0500261228c6cbf0f05970bf39e3bfa7ad3622536598

### scripts carregados
- /assets/nested.c8b7bd4d.js

## https://widget.mediquo.com/assets/nested.c8b7bd4d.js
- tipo: application/javascript; charset=UTF-8
- tamanho: 7428
- sha256: 6c98255d6b3efbb6fbe880bb4688c430bf03ecad037c83945a695abc9c405789

### navigate
- 5954: :[],onEvent:({data:{command:p,theme:I,payload:m,isTemporalUser:T}})=>{var g,b;switch(p){case"init":E(I),$(T),n(u.launcher==="extended"?u.text.launcher:void 0),i(!0);break;case"open":t(!0);break;case x.internal.navigate:t(!0),window.parent.postMessage({command:x.internal.navigate,payload:m},"*");break;case"close":t(!1);break;case"logout":v||(E({...u,launcher:"hidden"}),t(!1),i(!1)),window.parent.postMessage({command:"logout"},"*");break;case x.internal.consultations:M(m.pendingConsultations);break;case"vid
- 6015: r:T}})=>{var g,b;switch(p){case"init":E(I),$(T),n(u.launcher==="extended"?u.text.launcher:void 0),i(!0);break;case"open":t(!0);break;case x.internal.navigate:t(!0),window.parent.postMessage({command:x.internal.navigate,payload:m},"*");break;case"close":t(!1);break;case"logout":v||(E({...u,launcher:"hidden"}),t(!1),i(!1)),window.parent.postMessage({command:"logout"},"*");break;case x.internal.consultations:M(m.pendingConsultations);break;case"videocall":const{state:L,professional:c}=m;S(L==="idle"?void 0:{

### postMessage
- 5983: ,theme:I,payload:m,isTemporalUser:T}})=>{var g,b;switch(p){case"init":E(I),$(T),n(u.launcher==="extended"?u.text.launcher:void 0),i(!0);break;case"open":t(!0);break;case x.internal.navigate:t(!0),window.parent.postMessage({command:x.internal.navigate,payload:m},"*");break;case"close":t(!1);break;case"logout":v||(E({...u,launcher:"hidden"}),t(!1),i(!1)),window.parent.postMessage({command:"logout"},"*");break;case x.internal.consultations:M(m.pendingConsultations);break;case"videocall":const{state:L,profess
- 6142: break;case x.internal.navigate:t(!0),window.parent.postMessage({command:x.internal.navigate,payload:m},"*");break;case"close":t(!1);break;case"logout":v||(E({...u,launcher:"hidden"}),t(!1),i(!1)),window.parent.postMessage({command:"logout"},"*");break;case x.internal.consultations:M(m.pendingConsultations);break;case"videocall":const{state:L,professional:c}=m;S(L==="idle"?void 0:{src:(g=c==null?void 0:c.avatar)!=null?g:"",alt:(b=c==null?void 0:c.name)!=null?b:""});break;case"message":const{professional:h}
- 6532: c==null?void 0:c.avatar)!=null?g:"",alt:(b=c==null?void 0:c.name)!=null?b:""});break;case"message":const{professional:h}=m;k(h?{src:h.avatar,alt:h.name}:void 0);break}}}),a.exports.useEffect(()=>{window.parent.postMessage({command:"launcher_init"},"*")},[]),a.exports.useEffect(()=>{o&&window.parent.postMessage({command:e?"open":"close"},"*")},[e,o]),a.exports.useEffect(()=>{o&&window.parent.postMessage({command:"styles",styles:X({extended:!!r&&!e,hidden:u.launcher==="hidden"&&!e,isBubble:!!C}),target:"lau

## https://widget.mediquo.com/index.html
- tipo: text/html; charset=UTF-8
- tamanho: 516
- sha256: 5339f6cb1808cd2c0093ae28b5176a882e99ad6c6924054b7e9031d314ca1526

### scripts carregados
- /assets/main.222d2998.js

## https://widget.mediquo.com/assets/main.222d2998.js
- tipo: application/javascript; charset=UTF-8
- tamanho: 715771
- sha256: ce65f9fb9f4314042c58cf8837288c11f94fa3e4fe0369094ecb8f9a097c4a09

### open_room
- 151612: w.parent.postMessage({command:He.internal.widgetOpened},"*");break;case"close":t(),window.parent.postMessage({command:He.internal.widgetClosed},"*");break;case"logout":g();break;case"resize":u(q<gv);break;case"open_room":const{professional_hash:ie}=ae;b(ie);break}}}),{isClose:!n&&!r,isMobile:s,isCloseButtonHidden:k,setIsMobile:u,initialMessage:h,dismissInitialMessage:H,showPracticeCountry:A,setInitialMessage:d,setSizeOnClosed:v,setIsWide:p,closeIframe:t,professionalHash:C,setProfessionalHash:b,isImmediate

### professional_hash
- 151629: age({command:He.internal.widgetOpened},"*");break;case"close":t(),window.parent.postMessage({command:He.internal.widgetClosed},"*");break;case"logout":g();break;case"resize":u(q<gv);break;case"open_room":const{professional_hash:ie}=ae;b(ie);break}}}),{isClose:!n&&!r,isMobile:s,isCloseButtonHidden:k,setIsMobile:u,initialMessage:h,dismissInitialMessage:H,showPracticeCountry:A,setInitialMessage:d,setSizeOnClosed:v,setIsWide:p,closeIframe:t,professionalHash:C,setProfessionalHash:b,isImmediateVideoCall:w,showC
- 239223: etProfessional({professionalHash:d}).queryKey,m=>m?{...m,active_absence:null,status:"offline"}:void 0)}function h(d,m){e.setQueryData(rt.getProfessionals().queryKey,(v=[])=>v.map(g=>(g==null?void 0:g.hash)===m.professional_hash?{...g,active_absence:m}:g)),e.getQueryData(rt.getProfessional({professionalHash:d}).queryKey)&&e.setQueryData(rt.getProfessional({professionalHash:d}).queryKey,v=>v?{...v,active_absence:m}:void 0)}return{appendMessage:r,updateCurrentAppointment:i,deleteMessage:s,updateMessageStatus
- 242492: ;D.is_available?s.push(`/professionals/${D.hash}/room`):window.parent.postMessage({command:"professionalIsUnavailable",detail:D},"*")},A=Yd(),_=I.exports.useRef([]);Ui({onAbsenceCancelled:D=>{A.cancelAbsence(D.professional_hash)},onAbsenceCreated:D=>{A.createAbsence(D.professional_hash,D);let L=null;const R=Fr(D.finishes_at,{utc:!0}).diff(Fr(),"milliseconds");R<=0?A.cancelAbsence(D.professional_hash):(L=setTimeout(()=>{A.cancelAbsence(D.professional_hash)},R),_.current.push(L))},onUnmount:()=>{_.current.f

### open_list
- 151335: eView:re,mute:fe,adapter:ve,payload:ae}})=>{var X;switch(B){case"init":!W&&H(),Z&&_(!0),te&&x(!0),Y&&T(!0),le&&N(!0),F(((X=Je)==null?void 0:X.hideCloseButton)==="true"),re&&u(!0),fe&&L(!0),ve&&$(ve);break;case"open_list":b("");case"open":i({event_type:"widget open"}),e(),window.parent.postMessage({command:He.internal.widgetOpened},"*");break;case"close":t(),window.parent.postMessage({command:He.internal.widgetClosed},"*");break;case"logout":g();break;case"resize":u(q<gv);break;case"open_room":const{profes

### navigate
- 72502: g"?br(t,null,null,r):t},Dd=function(t){return t},ma=l.forwardRef;typeof ma=="undefined"&&(ma=Dd);function Zx(e){return!!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)}var Yx=ma(function(e,t){var r=e.innerRef,n=e.navigate,i=e.onClick,s=Ho(e,["innerRef","navigate","onClick"]),u=s.target,c=he({},s,{onClick:function(h){try{i&&i(h)}catch(d){throw h.preventDefault(),d}!h.defaultPrevented&&h.button===0&&(!u||u==="_self")&&!Zx(h)&&(h.preventDefault(),n())}});return Dd!==ma?c.ref=t||r:c.ref=r,l.createElement("a",c)}
- 72543: turn t},ma=l.forwardRef;typeof ma=="undefined"&&(ma=Dd);function Zx(e){return!!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)}var Yx=ma(function(e,t){var r=e.innerRef,n=e.navigate,i=e.onClick,s=Ho(e,["innerRef","navigate","onClick"]),u=s.target,c=he({},s,{onClick:function(h){try{i&&i(h)}catch(d){throw h.preventDefault(),d}!h.defaultPrevented&&h.button===0&&(!u||u==="_self")&&!Zx(h)&&(h.preventDefault(),n())}});return Dd!==ma?c.ref=t||r:c.ref=r,l.createElement("a",c)}),Xx=ma(function(e,t){var r=e.component,n
- 73093: innerRef,c=Ho(e,["component","replace","to","innerRef"]);return l.createElement(Gn.Consumer,null,function(p){p||bi(!1);var h=p.history,d=jv(Ff(s,p.location),p.location),m=d?h.createHref(d):"",v=he({},c,{href:m,navigate:function(){var C=Ff(s,p.location),b=i?h.replace:h.push;b(C)}});return Dd!==ma?v.ref=t||u:v.innerRef=u,l.createElement(n,v)})}),zv=function(t){return t},Su=l.forwardRef;typeof Su=="undefined"&&(Su=zv);function Jx(){for(var e=arguments.length,t=new Array(e),r=0;r<e;r++)t[r]=arguments[r];retur

### /professionals/
- 124254: ultations/v1/immediate-videocall`,data:{video_call_schedule_id:e,adapter:t}}).then(({data:r})=>r),get:()=>Wn({url:`${Pu}/schedules/v1/immediate-videocall`}).then(({data:e})=>e)},Q8={available:()=>Wn({url:`${lr}/professionals/available`}).then(({data:e})=>e),list:()=>Wn({url:`${lr}/professionals`}).then(({data:e})=>e),get:e=>Wn({url:`${lr}/professionals/${e}`}).then(({data:t})=>t),consult:(e,t)=>{const r=t?{initial_message:{text:t.text,created_at:t.createdAt}}:void 0;return Fu({url:`${lr}/professionals/${e
- 124384: /v1/immediate-videocall`}).then(({data:e})=>e)},Q8={available:()=>Wn({url:`${lr}/professionals/available`}).then(({data:e})=>e),list:()=>Wn({url:`${lr}/professionals`}).then(({data:e})=>e),get:e=>Wn({url:`${lr}/professionals/${e}`}).then(({data:t})=>t),consult:(e,t)=>{const r=t?{initial_message:{text:t.text,created_at:t.createdAt}}:void 0;return Fu({url:`${lr}/professionals/${e}/consult`,data:r}).then(({data:n})=>n.room_id)}},q8={register:({firstName:e,lastName:t,gender:r,birthDate:n,email:i,phone:s,tax_i
- 124536: professionals`}).then(({data:e})=>e),get:e=>Wn({url:`${lr}/professionals/${e}`}).then(({data:t})=>t),consult:(e,t)=>{const r=t?{initial_message:{text:t.text,created_at:t.createdAt}}:void 0;return Fu({url:`${lr}/professionals/${e}/consult`,data:r}).then(({data:n})=>n.room_id)}},q8={register:({firstName:e,lastName:t,gender:r,birthDate:n,email:i,phone:s,tax_id:u,phone_prefix:c,commercial_accepted:p,privacy_accepted:h,terms_accepted:d,postal_code:m})=>yi({url:`${lr}/patients/temporal`,data:{first_name:e,last_

### roomId
- 227525: Room",W),D=W=>T==null?void 0:T.emit("exitRoom",W),L=W=>T==null?void 0:T.emit("typing",W),R=W=>T==null?void 0:T.emit("stopTyping",W),$=W=>{W.fromUserHash!==_.hash&&(T==null||T.emit("messageStatus",W.messageId,W.roomId,3))},H=({string:W,roomId:Z,messageId:Y})=>T==null?void 0:T.emit("message",W,Z,Y,"string"),B=({base64:W,roomId:Z,messageId:Y,type:te,name:le,fileType:re})=>T==null?void 0:T.emit("message",W,Z,Y,te,le,0,"ordinary",re==="voice_note"?"voice_note":"uncategorized"),q=W=>Z=>window.parent.postMessage
- 227550: d 0:T.emit("exitRoom",W),L=W=>T==null?void 0:T.emit("typing",W),R=W=>T==null?void 0:T.emit("stopTyping",W),$=W=>{W.fromUserHash!==_.hash&&(T==null||T.emit("messageStatus",W.messageId,W.roomId,3))},H=({string:W,roomId:Z,messageId:Y})=>T==null?void 0:T.emit("message",W,Z,Y,"string"),B=({base64:W,roomId:Z,messageId:Y,type:te,name:le,fileType:re})=>T==null?void 0:T.emit("message",W,Z,Y,te,le,0,"ordinary",re==="voice_note"?"voice_note":"uncategorized"),q=W=>Z=>window.parent.postMessage({command:W,detail:Z},"*"
- 227635: .emit("stopTyping",W),$=W=>{W.fromUserHash!==_.hash&&(T==null||T.emit("messageStatus",W.messageId,W.roomId,3))},H=({string:W,roomId:Z,messageId:Y})=>T==null?void 0:T.emit("message",W,Z,Y,"string"),B=({base64:W,roomId:Z,messageId:Y,type:te,name:le,fileType:re})=>T==null?void 0:T.emit("message",W,Z,Y,te,le,0,"ordinary",re==="voice_note"?"voice_note":"uncategorized"),q=W=>Z=>window.parent.postMessage({command:W,detail:Z},"*");return I.exports.useEffect(()=>{const W=Z=>Z.type==="string"?Z.string:JSON.stringif

### room_id
- 124593: }/professionals/${e}`}).then(({data:t})=>t),consult:(e,t)=>{const r=t?{initial_message:{text:t.text,created_at:t.createdAt}}:void 0;return Fu({url:`${lr}/professionals/${e}/consult`,data:r}).then(({data:n})=>n.room_id)}},q8={register:({firstName:e,lastName:t,gender:r,birthDate:n,email:i,phone:s,tax_id:u,phone_prefix:c,commercial_accepted:p,privacy_accepted:h,terms_accepted:d,postal_code:m})=>yi({url:`${lr}/patients/temporal`,data:{first_name:e,last_name:t,gender:r,birth_date:n,email:i,phone:s,tax_id:u,pho
- 235826: oom:{...O.room,pending_messages:0,last_message:A}}:O})),w=({professionalHash:A,room:_})=>t.setQueryData(rt.getProfessionals().queryKey,O=>O.map(T=>{var U;return(T==null?void 0:T.hash)===A?{...T,room:{..._,id:_.room_id,pending_messages:0,last_message:{...(U=T==null?void 0:T.room)==null?void 0:U.last_message,status:3}}}:T})),x=A=>{t.invalidateQueries({queryKey:rt.getAppointments({id:A.id}).queryKey,exact:!0}),t.setQueryData(rt.getProfessionals().queryKey,_=>_.map(O=>{var T;return((T=O.room)==null?void 0:T.i
- 236133: ,status:3}}}:T})),x=A=>{t.invalidateQueries({queryKey:rt.getAppointments({id:A.id}).queryKey,exact:!0}),t.setQueryData(rt.getProfessionals().queryKey,_=>_.map(O=>{var T;return((T=O.room)==null?void 0:T.id)===A.room_id?{...O,room:{...O.room,current_appointment:A}}:O}))},{joinRoom:k}=Ui({onMessageDeleted:C,onMessageUpdated:g,onAppointmentCreated:x,onAppointmentAccepted:x,onAppointmentExpired:x,onAppointmentFinished:x,onAppointmentOwed:x,onAppointmentPaid:x,onAppointmentRescheduled:x,onAppointmentUncharged:x

### postMessage
- 126290: seReducer((A,_)=>({...A,..._}),{}),[i,s]=I.exports.useState(!0),[u,c]=I.exports.useState({}),[p,h]=I.exports.useState("first"),[d,m]=I.exports.useState({});I.exports.useEffect(()=>{r.accessToken&&window.parent.postMessage({command:"storage.save",accessToken:r.accessToken},"*")},[r.accessToken]);const v=A=>{A.accessToken&&(Du=A.accessToken),A.apiKey&&(pc=A.apiKey),A.hash&&(eg=A.hash),A.referer&&(tg=A.referer),n(A)},g=()=>v({callRequested:void 0}),C=async()=>{r.callRequested&&await ft.calls.hangUp(r.callReq
- 126723: quested:void 0}),C=async()=>{r.callRequested&&await ft.calls.hangUp(r.callRequested.call.uuid).catch(console.error),ft.session.invalidate(),n({accessToken:void 0,hash:void 0}),Du=void 0,t.clear(),window.parent.postMessage({command:"storage.clear"},"*")},b=!!r.accessToken&&!!r.apiKey&&!!r.hash,w=A=>{const{accepted_at:_,last_version_at:O}=A;O&&(!_||Fr(_).isBefore(O)?(s(!1),Fr(_).isBefore(O)&&h("update")):_&&Fr(_).isAfter(O)&&s(!0)),c(A)},x=A=>{A!=null&&A.consultation_url&&m(A)},k=()=>{m(null)},F=()=>{ft.pro
- 150619: te(!1),[O,T]=I.exports.useState(!1),[U,N]=I.exports.useState(!1),[D,L]=I.exports.useState(!1),[R,$]=I.exports.useState("web");I.exports.useEffect(()=>{const q=h.state==="show"?h.professional:null;window.parent.postMessage({command:"message",payload:{professional:q}},"*")},[h]),I.exports.useEffect(()=>{window.parent.postMessage({command:"styles",target:"container",styles:d8({isBubble:h.state==="show",isMobile:s,isWide:c,sizeOnClosed:m,isOpen:r,isOpenFull:n})},"*")},[s,c,h,m,r,n]);const H=()=>d(B=>({...B,st

## https://widget.mediquo.com/container/index.html
- HTTP 404

## Restrições da pesquisa
- Não tenta navegar em conversas de pacientes sem sessão autorizada.
- Não há escrita na API nem alterações de cadastros.
