import {mkdir,writeFile} from "node:fs/promises";
const url="https://widget.mediquo.com/assets/main.222d2998.js";
const response=await fetch(url,{signal:AbortSignal.timeout(18000)});
if(!response.ok)throw Error("HTTP "+response.status);
const js=await response.text();
const md=["# Investigação de identificação e autenticação do catálogo interno","",
"Arquivo público do widget; nenhum token pessoal foi utilizado.",""];
const ranges=[
  ["Recepção do comando open_room",150600,152400],
  ["Consulta interna à API de profissionais",122800,125200],
  ["Roteamento de profissional e efeitos",234100,238050],
  ["Regra de abertura a partir da lista",241800,243050],
  ["Rotas internas oficialmente usadas no bundle",714800,715550]
];
for(const [label,from,to] of ranges){md.push("","## "+label,"","~~~js",js.slice(from,to),"~~~");}
for(const keyword of ["Bearer ","Authorization","accessToken","getProfessionals","is_available","lr="]){
  const low=js.toLowerCase(),term=keyword.toLowerCase();let at=0,count=0;
  md.push("","## Padrão "+keyword);
  while(count<7&&(at=low.indexOf(term,at))!==-1){
    md.push("- "+at+": "+js.slice(Math.max(0,at-210),at+340).replace(/[\n\r]+/g," "));
    at+=term.length;count++;
  }
}
await mkdir("research",{recursive:true});
await writeFile("research/widget-auth-routing-inspection.md",md.join("\n")+"\n");
console.log("Inspeção de autenticação e roteamento concluída");
