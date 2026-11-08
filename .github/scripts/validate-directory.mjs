import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const mock=[
  {id:"clinico-11",name:"Bruno Silva",title:"General Medicine",status:"online"},
  {id:"psico-15",name:"Joana Souza",title:"Psychology",status:"online"},
  {id:"nutri-42",name:"Maria Rosa",title:"Nutrição",status:"offline"},
  {id:"fit-18",name:"Luiz Martins",title:"Personal Trainer",status:"offline"},
  {id:"pedi-21",name:"Clara Castro",title:"Pediatrics",status:"online"},
  {id:"derm-19",name:"José Gomes",title:"Dermatology",status:"online"},
  {id:"gineco-12",name:"Flávia Reis",title:"Gynecology",status:"offline"},
  {id:"vet-41",name:"Paulo Dias",title:"Veterinary",status:"online"}
];
try{
  for(const width of [320,390,1280]){
    const page=await browser.newPage({viewport:{width,height:860}});
    await page.goto("http://127.0.0.1:8767/telesaude/atendimento/",{waitUntil:"domcontentloaded"});
    assert.equal(await page.locator("#directory-open").isHidden(),true,"Sem catálogo real a busca permanece oculta");
    const enabled=await page.evaluate(async entries=>{
      window.__calls=[];
      window.fetch=async()=>Response.json({available:true,items:entries});
      const module=await import("/telesaude/diretorio.mjs");
      return module.initDirectory({open_room(id){window.__calls.push(id);}}, "A".repeat(43));
    },mock);
    assert.equal(enabled,true);
    assert.equal(await page.locator("#directory-open").isVisible(),true);
    await page.locator("#directory-open").click();
    assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),true);
    const groups=await page.locator(".directory-section h3").allInnerTexts();
    assert.deepEqual(groups,[
      "Clínico geral","Psicologia","Nutrição","Treinamento físico",
      "Pediatria","Dermatologia","Ginecologia","Veterinária"
    ]);
    const overflow=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,width:innerWidth,
      brandRight:document.querySelector(".identity").getBoundingClientRect().right,
      buttonLeft:document.getElementById("directory-open").getBoundingClientRect().left}));
    assert.ok(overflow.documentWidth<=width+1,"Sem scroll horizontal: "+JSON.stringify(overflow));
    assert.ok(overflow.brandRight<=overflow.buttonLeft+2,"Cabeçalho não deve sobrepor o diretório: "+JSON.stringify(overflow));
    await page.locator("#directory-query").fill("psico");
    assert.equal(await page.locator(".directory-person").count(),1);
    assert.match(await page.locator(".directory-person").innerText(),/Joana Souza/);
    await page.locator(".directory-person").click();
    assert.deepEqual(await page.evaluate(()=>window.__calls),["psico-15"]);
    assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
    assert.equal(await page.locator("#appointments-trigger").isVisible(),true);
    await page.screenshot({path:"/tmp/pv-prints/diretorio-profissionais-"+width+".png"});
    await page.close();
  }
  const page=await browser.newPage();
  await page.goto("http://127.0.0.1:8767/telesaude/atendimento/",{waitUntil:"domcontentloaded"});
  const activated=await page.evaluate(async()=>{
    window.fetch=async()=>Response.json({available:false,items:[]});
    return (await import("/telesaude/diretorio.mjs")).initDirectory({open_room(){}}, "A".repeat(43));
  });
  assert.equal(activated,false);
  assert.equal(await page.locator("#directory-open").isHidden(),true,"Não mostrar busca vazia");
  await page.close();
}finally{await browser.close();}
