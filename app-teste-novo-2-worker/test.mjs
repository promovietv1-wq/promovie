import test from "node:test";
import assert from "node:assert/strict";
import worker from "./src/index.mjs";

const origin = "https://www.promovie.tv.br";
const headers = { Origin: origin, "Content-Type": "application/json" };
const mockEnv = {
  ALLOWED_ORIGINS: "https://www.promovie.tv.br,https://promovie.tv.br",
  MEDIQUO_API_KEY: "api-key-staging-ficticia",
  MEDIQUO_SECRET_KEY: "secret-test-only",
  MEDIQUO_BASE_URL: "https://staging-ficticio.example/v1",
  MEDIQUO_TEST_PATIENT_CODE: "paciente-ficticio-001",
  PROMOVIE_TEST_PASSWORD: "senha-exclusiva-teste-2026"
};
function req(path, init = {}) {
  return new Request("https://backend-teste.example" + path, init);
}
async function handle(path, init = {}, env = mockEnv) {
  return worker.fetch(req(path, init), env);
}
test("serviço sem chaves inicia sem tokens nem segredos públicos", async () => {
  const env = { ALLOWED_ORIGINS: mockEnv.ALLOWED_ORIGINS,
    MEDIQUO_TEST_PATIENT_CODE: "paciente-ficticio-001" };
  const health = await handle("/api/mediquo/health", { headers }, env);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "aguardando-configuracao");
  const config = await handle("/api/mediquo/config", { headers }, env);
  assert.equal(config.status, 503);
  const token = await handle("/api/mediquo/token", {
    method: "POST", headers, body: JSON.stringify({ testPassword: "x" })
  }, env);
  assert.equal(token.status, 503);
});

test("CORS, senha de teste e secret isolados", async () => {
  const wrongOrigin = await handle("/api/mediquo/config", {
    headers: { Origin: "https://nao-autorizado.example" }
  });
  assert.equal(wrongOrigin.status, 403);
  const preflight = await handle("/api/mediquo/token", {
    method: "OPTIONS", headers
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  const c = await handle("/api/mediquo/config", { headers });
  assert.equal(c.status, 200);
  assert.equal((await c.json()).apiKey, mockEnv.MEDIQUO_API_KEY);
  const bad = await handle("/api/mediquo/token", {
    method: "POST", headers,
    body: JSON.stringify({ testPassword: "incorreta" })
  });
  assert.equal(bad.status, 401);
  assert.equal(JSON.stringify(await bad.json()).includes(mockEnv.MEDIQUO_SECRET_KEY), false);
});

test("código do paciente definido no backend; token emitido apenas após senha correta", async () => {
  const originalFetch = globalThis.fetch, records = [];
  globalThis.fetch = async (url, init) => {
    records.push({ url: String(url), secret: init.headers["X-API-Key"],
      payload: JSON.parse(init.body) });
    return new Response(
      String(url).endsWith("/authenticate") ?
        JSON.stringify({ access_token: "token-ficticio" }) : "{}",
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  try {
    const r = await handle("/api/mediquo/token", {
      method: "POST", headers,
      body: JSON.stringify({
        testPassword: mockEnv.PROMOVIE_TEST_PASSWORD,
        code: "codigo-do-paciente-de-outra-pessoa"
      })
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).access_token, "token-ficticio");
    assert.equal(records.length, 2);
    assert.equal(records[0].url, mockEnv.MEDIQUO_BASE_URL + "/patients");
    assert.equal(records[1].url, mockEnv.MEDIQUO_BASE_URL + "/patients/authenticate");
    assert.equal(records[0].secret, mockEnv.MEDIQUO_SECRET_KEY);
    assert.equal(records[0].payload.patients[0].code, mockEnv.MEDIQUO_TEST_PATIENT_CODE);
    assert.equal(records[1].payload.code, mockEnv.MEDIQUO_TEST_PATIENT_CODE);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("endpoint de produção do kit permanece bloqueado", async () => {
  const env = { ...mockEnv, MEDIQUO_BASE_URL: "https://sdk.mediquo.com/v1" };
  const c = await handle("/api/mediquo/config", { headers }, env);
  assert.equal(c.status, 503);
});
