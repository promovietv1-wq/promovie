import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.mjs';

test('pagina separada da teleSaude nao exige dados privados',async()=>{
 const r=await worker.fetch(new Request('https://example.workers.dev/'),{});
 assert.equal(r.status,200);
 assert.match(await r.text(),/Diagnóstico de profissionais/);
});

test('diagnostico bloqueia requisicao sem origem confiavel',async()=>{
 const request=new Request('https://example.workers.dev/diagnostico',{method:'POST',
  headers:{'Content-Type':'application/json'},body:'{}'});
 const r=await worker.fetch(request,{DIAG_ACCESS_PASSWORD:'exclusiva-teste-sem-segredos-123456'});
 assert.equal(r.status,403);
});
