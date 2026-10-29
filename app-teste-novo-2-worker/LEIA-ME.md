# PromoVie TeleSaúde — backend gratuito com Cloudflare Workers

**Nova recomendação para a homologação:** Cloudflare Workers Free, integrado ao GitHub. Esta é a alternativa ao Render Free, que hiberna após 15 minutos de inatividade. O Worker executa cada requisição sem manter um servidor Node.js ligado o tempo todo.

A página da PromoVie continua publicada normalmente no GitHub Pages:

**https://www.promovie.tv.br/app-teste-novo-2/**

O Worker só executa as rotas do backend da **segunda opção** do kit de Pedro/Médiquo: solicitar uma API Key pública, criar/autenticar **um paciente fictício configurado no servidor** e devolver um token ao navegador.

## Endereço próprio: backend.promovie.tv.br (gratuito)

**Endereço escolhido:** `https://backend.promovie.tv.br`. Ele será um **subdomínio**, não uma pasta do GitHub Pages. O site institucional e o App Teste Novo 2 continuam normalmente hospedados no GitHub Pages.

**Pré-requisito para ativar:** a zona DNS `promovie.tv.br` deve estar ativa na sua conta Cloudflare. No plano gratuito, o uso de domínio personalizado exige que os **nameservers** do domínio apontem para a Cloudflare. Antes de trocá-los no Registro.br ou no seu provedor, confira TODOS os registros atuais (A, AAAA, CNAME, MX, TXT, SPF, DKIM, DMARC) para não interromper o site, e-mails ou verificações.

Depois que a zona estiver ativa e o Worker criado a partir do GitHub:

1. No painel Cloudflare, abra **Workers & Pages → promovie-mediquo-teste-2 → Settings → Domains & Routes → Add → Custom Domain**.
2. Informe `backend.promovie.tv.br`. A Cloudflare cria os registros DNS e o certificado HTTPS automaticamente.
3. Confirme `https://backend.promovie.tv.br/api/mediquo/health`. Sem credenciais privadas, deve exibir `"aguardando-configuracao"`, como proteção.
4. No GitHub, ajuste **somente** `const BACKEND_URL=""` no `app-teste-novo-2/index.html` para `const BACKEND_URL="https://backend.promovie.tv.br"`. Isso será feito **depois da publicação confirmada**, para não quebrar o aplicativo.
5. Depois que o domínio personalizado estiver validado, você pode desativar a rota pública `workers.dev` nas configurações do Worker, se desejar.

**Opção de configuração como código:** o arquivo `wrangler.jsonc` contém a linha `"routes": [{ "pattern": "backend.promovie.tv.br", "custom_domain": true }]` comentada. Ela também pode ser ativada depois que a zona Cloudflare estiver ativa. Nunca ativá-la antes: um deploy no GitHub pode falhar se a Cloudflare não reconhecer o domínio.

**Segurança:** domínio próprio e HTTPS não substituem autenticação individual nem homologação. O Worker atual é exclusivo para teste com paciente fictício; use somente as credenciais de Staging confirmadas por Pedro.

Referências: [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Cloudflare DNS — Full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/) e [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/).

## 1. Publicação GRATUITA pela sua conta GitHub

1. Acesse [Cloudflare Workers](https://dash.cloudflare.com/?to=/:account/workers-and-pages) e crie/entre na **conta gratuita**.
2. Em **Workers & Pages → Create application**, escolha **Import a repository / GitHub**.
3. Autorize a conexão ao GitHub e selecione o repositório **`promovietv1-wq/promovie`** (não o projeto inteiro como site estático).
4. Configure:
   - **Project/Worker name:** `promovie-mediquo-teste-2`
   - **Branch:** `main`
   - **Root directory:** `app-teste-novo-2-worker`
   - **Build command:** deixe vazio
   - **Deploy command:** `npx wrangler deploy`
   - **Plano:** mantenha **Workers Free**.
5. Clique em **Save and Deploy**. A plataforma cria um endereço HTTPS semelhante a `https://promovie-mediquo-teste-2.SEU-SUBDOMINIO.workers.dev`. **Esse endereço é um exemplo, não existe até a publicação.**
6. Abra `https://ENDERECO-REAL.workers.dev/api/mediquo/health`. Antes de configurar os segredos, a resposta esperada é `{"status":"aguardando-configuracao","mode":"homologacao-restrita",...}`. A aplicação **não emite tokens** enquanto a configuração não está completa.

**Integração contínua:** após conectar o GitHub pelo painel da Cloudflare, alterações no Worker feitas nesse repositório podem ser publicadas automaticamente por Workers Builds. Recomenda-se usar *Build watch paths* para monitorar apenas `app-teste-novo-2-worker/**`, evitando builds desnecessários ao editar outras páginas do site.

## 2. Onde colocar o .env sem expor dados

O **`.env`** citado pelo Pedro é o nome comum de um **arquivo local que contém configurações privadas**. No Cloudflare Workers, é melhor **não criar esse arquivo no GitHub**. Insira as informações diretamente no painel:

**Worker → Settings → Variables and Secrets → Add → Secret**, um nome por vez.

| Nome | Valor privado |
| --- | --- |
| `MEDIQUO_API_KEY` | API Key de homologação, enviada pelo Pedro |
| `MEDIQUO_SECRET_KEY` | Secret Key privada da homologação |
| `MEDIQUO_BASE_URL` | URL da API de Staging **confirmada pelo Pedro**, ainda pendente |
| `PROMOVIE_TEST_PASSWORD` | Uma senha nova e longa (**mínimo 16 caracteres**) para o paciente fictício do teste |

Já vêm no `wrangler.jsonc` apenas valores **públicos e não sensíveis**:
- `ALLOWED_ORIGINS`: `https://www.promovie.tv.br,https://promovie.tv.br`.
- `MEDIQUO_TEST_PATIENT_CODE`: `promovie-homologacao-001` (paciente fictício, não o cadastro de beneficiário real).

Se Pedro confirmar que o plano precisa constar no cadastro de teste, adicione `MEDIQUO_TEST_PLAN` com o valor exato que ele instruir. Os IDs Partner 108 e Plan 219 **não substituem uma API Key ou uma URL confirmada**.

**Não envie a Secret Key, senha de teste ou prints contendo esses valores nesta conversa, pelo e-mail ou nos arquivos do GitHub.** Ela fica somente no Cloudflare.

Após configurar os quatro segredos, a rota `/api/mediquo/health` passará a mostrar `"status":"ok"`. Isso confirma apenas a presença da configuração e não valida a conexão com a Médiquo. O teste real ocorre ao solicitar o token e abrir o Widget Web.

## 3. Ligar o Worker ao App Teste Novo 2

Depois que a Cloudflare gerar o domínio real:

1. Edite no GitHub o arquivo `app-teste-novo-2/index.html`.
2. Localize **`const BACKEND_URL=""`** e substitua por **`const BACKEND_URL="https://ENDERECO-REAL.workers.dev"`** (sem barra final).
3. Abra [App Teste Novo 2](https://www.promovie.tv.br/app-teste-novo-2/).
4. Digite **somente a senha privada do teste** criada no Cloudflare e clique em **Acessar telemedicina**.
5. O backend usa a Secret Key **sem enviá-la ao navegador** e, quando o serviço estiver liberado, fornece o token de um paciente fictício para abrir o widget.

**O App Teste Novo 1 e o aplicativo principal não foram alterados.**

## 4. Limitações e segurança

- O Workers Free **não hiberna por 15 minutos como o Render Free**, mas não oferece garantia absoluta de funcionamento nem SLA de disponibilidade.
- Limites oficiais pesquisados em outubro de 2026: **100 mil requisições/dia**, **10 ms de CPU por requisição**, **128 MB de memória**. No excesso de solicitações pode bloquear requisições. O uso de rede enquanto aguarda a Médiquo não equivale necessariamente a CPU ativa.
- A Cloudflare recomenda domínio personalizado para aplicações críticas, em vez do subdomínio gratuito `workers.dev`.
- **Somente homologação**: há uma senha compartilhada para um único paciente fictício. Isso **não é login de beneficiários reais**. A produção exige autenticação individual, verificação de titularidade/licença e regras de proteção de dados pessoais de saúde.
- O backend **não armazena prontuários ou histórico**; o histórico é vinculado ao paciente autenticado dentro da Médiquo, sujeito ao serviço contratado.
- Pedro ainda precisa confirmar a URL de Staging, as credenciais e a liberação dos oito serviços da PromoVie.

## 5. Testes

Os arquivos `src/index.mjs` e `test.mjs` são testados pelo GitHub Actions, sem usar credenciais reais. A simulação verifica rotas, bloqueio de origem não autorizada, senha, paciente fictício fixo e emissão de token simulada.

Para testar localmente (Node 22+), execute `npm test` dentro da pasta `app-teste-novo-2-worker`. Para executar `wrangler dev` local, utilize um `.dev.vars` **privado e não versionado** com os valores confirmados da homologação.

## Fontes oficiais

- [Cloudflare Workers — preços e limites](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers — integração GitHub](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [Cloudflare Workers — segredos no painel](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers — diretório do projeto](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
