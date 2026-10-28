// PromoVie TeleSaúde — backend Cloudflare Workers (homologação).
// Alternativa à execução Node.js do kit Médiquo: não hiberna por inatividade.
// NÃO é autenticação de beneficiários reais. Usa apenas um paciente fictício.
// Nunca incluir Secret Key, senha de homologação ou tokens no GitHub ou navegador.

const MAX_BODY_BYTES = 2048;
const SOURCE_VERSION = "2-worker-homologacao";

function respond(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      ...headers
    }
  });
}

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "")
    .split(",").map(x => x.trim()).filter(Boolean));
}

function stagingUrl(env) {
  try {
    const url = new URL(String(env.MEDIQUO_BASE_URL || "").trim());
    if (url.protocol !== "https:" || url.username || url.password ||
        url.search || url.hash || !url.hostname ||
        url.hostname.toLowerCase() === "sdk.mediquo.com") return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function configured(env) {
  return Boolean(
    String(env.MEDIQUO_API_KEY || "").trim() &&
    String(env.MEDIQUO_SECRET_KEY || "").trim() &&
    String(env.PROMOVIE_TEST_PASSWORD || "").length >= 16 &&
    String(env.MEDIQUO_TEST_PATIENT_CODE || "").trim() &&
    allowedOrigins(env).size &&
    stagingUrl(env)
  );
}

async function matchesPassword(provided, expected) {
  if (typeof provided !== "string" || provided.length > 256 ||
      typeof expected !== "string") return false;
  const encoder = new TextEncoder();
  const [inputHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const a = new Uint8Array(inputHash), b = new Uint8Array(expectedHash);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function vendorPost(base, secret, path, payload) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": secret
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(18000)
  });
  if (!response.ok) {
    // Não mostrar o corpo da resposta do fornecedor nem tokens em erros.
    throw new Error("Médiquo recusou uma operação (" + response.status + ").");
  }
  if (path === "/patients/authenticate") {
    try { return await response.json(); }
    catch { throw new Error("A Médiquo retornou uma resposta inválida."); }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const origins = allowedOrigins(env);
    if (origin && !origins.has(origin)) {
      return respond(403, { error: "Origem não autorizada." });
    }
    const cors = origin ? {
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    } : {};
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === "GET" && url.pathname === "/api/mediquo/health") {
      return respond(200, {
        status: configured(env) ? "ok" : "aguardando-configuracao",
        mode: "homologacao-restrita",
        version: SOURCE_VERSION
      }, cors);
    }
    if (request.method === "GET" && url.pathname === "/api/mediquo/config") {
      if (!configured(env)) return respond(503, {
        error: "Ambiente de homologação ainda não configurado."
      }, cors);
      return respond(200, { apiKey: String(env.MEDIQUO_API_KEY).trim() }, cors);
    }
    if (request.method === "POST" && url.pathname === "/api/mediquo/token") {
      if (!configured(env)) return respond(503, {
        error: "Ambiente de homologação ainda não configurado."
      }, cors);
      try {
        const input = await request.text();
        if (new TextEncoder().encode(input).length > MAX_BODY_BYTES) {
          return respond(413, { error: "Solicitação muito grande." }, cors);
        }
        let data;
        try { data = JSON.parse(input); }
        catch { return respond(400, { error: "JSON inválido." }, cors); }
        if (!await matchesPassword(data?.testPassword, env.PROMOVIE_TEST_PASSWORD)) {
          return respond(401, { error: "Senha de homologação inválida." }, cors);
        }
        const code = String(env.MEDIQUO_TEST_PATIENT_CODE).trim();
        const patient = { code, first_name: "Paciente", last_name: "Homologacao" };
        if (env.MEDIQUO_TEST_PLAN) patient.plan = String(env.MEDIQUO_TEST_PLAN).trim();
        const base = stagingUrl(env);
        const secret = String(env.MEDIQUO_SECRET_KEY).trim();
        await vendorPost(base, secret, "/patients", { patients: [patient] });
        const auth = await vendorPost(base, secret, "/patients/authenticate", { code });
        const token = auth?.access_token || auth?.data?.access_token;
        if (typeof token !== "string" || !token) {
          return respond(502, { error: "A Médiquo não retornou o token de atendimento." }, cors);
        }
        return respond(200, { access_token: token }, cors);
      } catch (error) {
        if (error?.name === "TimeoutError") {
          return respond(504, { error: "A Médiquo não respondeu dentro do prazo." }, cors);
        }
        return respond(502, { error: "Não foi possível autenticar o paciente de homologação." }, cors);
      }
    }
    return respond(404, { error: "Rota não encontrada." }, cors);
  }
};
