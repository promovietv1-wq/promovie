# Investigação isolada do Widget MediQuo

Consulta somente ao arquivo JavaScript público. Sem login, CPF, dados clínicos ou credenciais do serviço.

- Status HTTP do JS: 200
- Tipo de arquivo: application/javascript; charset=UTF-8
- Tamanho: 11891 caracteres
- SHA-256: 053525be8269838b71f9f27ee1bc3c901ccaa5f3e8e84b7907f9080b8256fbe8

## open_room: 5 ocorrência(s)
- posição 2078: Window?.postMessage(           { command: "navigate", payload: { path } },           "*"         )       : console.error("MediquoWidget hasn't been initialized");   },   open_room: (professional_hash) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.post
- posição 2349: Id);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "open_room", payload: { professional_hash } },           "*"         )       : console.error("MediquoWidget container hasn't been initialized");   },   open_list: () => {     var launcher = document.getElementById(MediquoWidget.launcherId); 
- posição 8368: ontentWindow?.postMessage({ command: "open" }, "*");               container.contentWindow?.postMessage({ command: "open" }, "*");               break;             case "open_room":               launcher.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );               container.contentWindow?.postMessage(                 { command: "open_room
- posição 8459: .postMessage({ command: "open" }, "*");               break;             case "open_room":               launcher.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );               container.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );               break;             case "
- posição 8599: (                 { command: "open_room", payload },                 "*"               );               container.contentWindow?.postMessage(                 { command: "open_room", payload },                 "*"               );               break;             case "navigate":               container.contentWindow?.postMessage(                 { command: "navigate", payload },                 "*"        

## open_list: 3 ocorrência(s)
- posição 2500:        { command: "open_room", payload: { professional_hash } },           "*"         )       : console.error("MediquoWidget container hasn't been initialized");   },   open_list: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(         
- posição 7853: tStyles({                 element: { launcher: launcher, container: container }[target],                 styles,               });               break;             case "open_list":               container.contentWindow?.postMessage(                 { command: "open_list" },                 "*"               );               launcher.contentWindow?.postMessage(                 { command: "navigate", payload
- posição 7945:              styles,               });               break;             case "open_list":               container.contentWindow?.postMessage(                 { command: "open_list" },                 "*"               );               launcher.contentWindow?.postMessage(                 { command: "navigate", payload: { path: "/" } },                 "*"               );             case "open":            

## postMessage: ao menos 8 ocorrência(s)
- posição 1007: y}: ${value};`)       .join(" ");   },   open: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "open" }, "*")       : console.error("MediquoWidget hasn't been initialized");   },   close: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.p
- posição 1246: idget hasn't been initialized");   },   close: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "close" }, "*")       : console.warn("MediquoWidget hasn't been initialized");   },   destroy: () => {     MediquoWidget.logout();     document.getElementById(MediquoWidget.launcherId)?.remove();     document.getEleme
- posição 1669: oWidget.containerId)?.remove();   },   logout: () => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage({ command: "logout" }, "*")       : console.warn("MediquoWidget hasn't been initialized");   },   navigate: (path) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentW
- posição 1916: asn't been initialized");   },   navigate: (path) => {     var launcher = document.getElementById(MediquoWidget.launcherId);     launcher       ? launcher.contentWindow?.postMessage(           { command: "navigate", payload: { path } },           "*"         )       : console.error("MediquoWidget hasn't been initialized");   },   open_room: (professional_hash) => {     var launcher = document.getElementById
- posição 2314: tElementById(MediquoWidget.launcherId);     var container = document.getElementById(MediquoWidget.containerId);     container && launcher       ? launcher.contentWindow?.postMessage(           { command: "open_room", payload: { professional_hash } },           "*"         )       : console.error("MediquoWidget container hasn't been initialized");   },   open_list: () => {     var launcher = document.getElem

## professional_id: 0 ocorrência(s)

## professionalId: 0 ocorrência(s)

## professionals: 0 ocorrência(s)

## room_id: 0 ocorrência(s)

## roomId: 0 ocorrência(s)

## sourceMappingURL: 0 ocorrência(s)

## Inspeção do objeto JS sem autenticação
~~~json
{
  "global": true,
  "own": [
    "launcherId",
    "containerId",
    "pendingConsultations",
    "adapter",
    "createIframe",
    "setStyles",
    "open",
    "close",
    "destroy",
    "logout",
    "navigate",
    "open_room",
    "open_list",
    "change_lifecycle",
    "init",
    "getPendingConsultations",
    "remove"
  ],
  "methods": {
    "init": {
      "present": true,
      "source": "(params) => {\n    return new Promise((resolve, reject) => {\n      if (params && !params.apiKey) {\n        console.error(\"apiKey is required\");\n        return;\n      }\n\n      var {\n        apiKey,\n        accessToken,\n        environment = \"production\",\n        show = \"always\",\n        showInitialMessage = false,\n        blockNavigation = false,\n        showPracticeCountry = false,\n        immediateVideoCall = false,\n        mute = false,\n        adapter = \"web\",\n        showChatSchedule = false,\n        isMobileView = false,\n        theme,\n      } = params;\n      this.adapter = adapter;\n\n      var context = {\n        local: \"/\",\n        sandbox: \"https://widget.dev.mediquo.com/\",\n        production: \"https://widget.mediquo.com/\",\n      }[environment];\n\n      var launcher = MediquoWidget.createIframe({\n        src: `${context}launcher/index.html`,\n        id: MediquoWidget.launcherId,\n   "
    },
    "open": {
      "present": true,
      "source": "() => {\n    var launcher = document.getElementById(MediquoWidget.launcherId);\n    launcher\n      ? launcher.contentWindow?.postMessage({ command: \"open\" }, \"*\")\n      : console.error(\"MediquoWidget hasn't been initialized\");\n  }"
    },
    "open_room": {
      "present": true,
      "source": "(professional_hash) => {\n    var launcher = document.getElementById(MediquoWidget.launcherId);\n    var container = document.getElementById(MediquoWidget.containerId);\n    container && launcher\n      ? launcher.contentWindow?.postMessage(\n          { command: \"open_room\", payload: { professional_hash } },\n          \"*\"\n        )\n      : console.error(\"MediquoWidget container hasn't been initialized\");\n  }"
    },
    "open_list": {
      "present": true,
      "source": "() => {\n    var launcher = document.getElementById(MediquoWidget.launcherId);\n    var container = document.getElementById(MediquoWidget.containerId);\n    container && launcher\n      ? launcher.contentWindow?.postMessage(\n          { command: \"navigate\", payload: { path: \"/\" } },\n          \"*\"\n        ) && launcher.contentWindow?.postMessage({ command: \"open\" }, \"*\")\n      : console.error(\"MediquoWidget container hasn't been initialized\");\n  }"
    }
  }
}
~~~

## Observações técnicas
- A existência do método não confirma abertura bem-sucedida.
- A lista de profissionais em produção requer sessão autenticada do paciente e não foi inspecionada.
- Não foram executadas operações da API, alterações cadastrais ou testes com beneficiários.
