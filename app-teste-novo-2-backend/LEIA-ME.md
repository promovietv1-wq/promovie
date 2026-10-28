# PromoVie — App Teste Novo 2 (Médiquo com backend)

**Objetivo:** testar gratuitamente a **segunda opção do kit enviado por Pedro**, com paciente fictício e autenticação por token. A primeira opção (sessão temporária) permanece preservada. Não utilizar este ambiente com dados ou pacientes reais.

## 1. Como publicar o servidor sem pagar

O frontend continua no GitHub Pages:
https://www.promovie.tv.br/app-teste-novo-2/

O GitHub Pages não executa Node.js. Para isso, o repositório já contém o arquivo [`render.yaml`](../render.yaml), preparado para **um serviço Render Free**. O plano pode adormecer após 15 minutos sem uso e demorar para acordar; não atende às exigências de operação contínua de saúde.

**Publicar com o seu próprio GitHub:**

1. Acesse **https://render.com/deploy?repo=https://github.com/promovietv1-wq/promovie**.
2. Entre/crie uma conta gratuita no Render e autorize o acesso ao repositório do GitHub, se solicitado.
3. Confira o serviço **`promovie-mediquo-homologacao`** e o plano **`Free`**. Não escolha plano pago.
4. Confirme a implantação. Ela só executa `app-teste-novo-2-backend/`, sem duplicar nem transferir o site da PromoVie.
5. Copie o endereço HTTPS do servidor que o Render criar, terminado em **`.onrender.com`**.
6. Abra `https://SEU-ENDERECO.onrender.com/api/mediquo/health`: enquanto faltar a confirmação de Pedro, a resposta esperada é `{"status":"aguardando-configuracao","mode":"homologacao-restrita"}`.

A URL acima é um **exemplo**, não um endereço já criado. O servidor não recebe nem emite tokens enquanto a configuração privada estiver incompleta.

## 2. O que significa o arquivo .env

O `.env` é somente um **arquivo local privado** de configuração. Não colocar `.env`, Secret Key ou senha no GitHub, em mensagens ou no HTML.

No **Render → serviço → Environment → Add Environment Variable**, usar os nomes do arquivo [`.env.example`](.env.example):

- `MEDIQUO_API_KEY`: chave de homologação enviada pelo Pedro.
- `MEDIQUO_SECRET_KEY`: chave **privada**, fornecida pelo Pedro.
- `MEDIQUO_BASE_URL`: URL **de Staging** que Pedro ainda está confirmando. Não adivinhar e não usar a de produção.
- `PROMOVIE_TEST_PASSWORD`: criar senha exclusiva de homologação com **pelo menos 16 caracteres**. Ela será digitada no App Teste Novo 2. Não é senha do Médiquo ID nem de beneficiário.
- `MEDIQUO_TEST_PATIENT_CODE`: já configurado como `promovie-homologacao-001`, um identificador fictício.
- `ALLOWED_ORIGINS`: já configurado para os endereços oficiais da PromoVie.
- `MEDIQUO_TEST_PLAN` (**opcional**): preencher só se Pedro confirmar que o endpoint de teste exige vinculação explícita ao plano.

Após salvar as variáveis privadas e reiniciar/deployar o serviço, a rota de saúde passará a retornar `"status":"ok"`. Isso **não prova** que a API real da Médiquo aceitou as credenciais; o teste real de cadastro e autenticação vem depois.

**Importante:** Pedro confirmou que o cadastro é feito via API, cada pessoa usando um `code` próprio. O backend atual bloqueia pacientes arbitrários e usa só **um paciente fictício**, não um sistema de login/licenças de produção. Para pacientes reais, precisam existir autenticação individual e verificação da licença antes de emitir token.

## 3. Conectar ao frontend já publicado

Depois de receber a URL real `.onrender.com`:

1. No GitHub, editar **`app-teste-novo-2/index.html`** e substituir apenas `const BACKEND_URL=""` por `const BACKEND_URL="https://URL-REAL.onrender.com"`.
2. Abrir **https://www.promovie.tv.br/app-teste-novo-2/**.
3. Digitar **somente a senha de homologação criada no Render** e clicar **Acessar telemedicina**.
4. O navegador buscará a API Key pública e solicitará ao servidor um token para o paciente fictício. A **Secret Key nunca é enviada ao navegador**.
5. Os oito profissionais e suas permissões dependem da configuração do plano no lado da Médiquo, como Pedro confirmou no e-mail de 28/10/2026.

Se a página disser que o servidor está pendente, ainda falta configurar a URL real do Render no HTML. Não tentar utilizar o formulário de senha para acesso de clientes reais.

## 4. Testes e limites

- Os testes locais são executados com `npm test` e também pelo GitHub Actions, usando simulação da API, **sem pacientes reais**.
- O servidor devolve HTTP 503 para configuração e token enquanto faltarem valores privados. Ele não tenta conectar à Médiquo nessa condição.
- Render Free pode hibernar, consumir franquias mensais e suspender serviço ao atingir limites. **Não** usar para atendimento real/contínuo nem para armazenar prontuários.
- O histórico dos atendimentos não é armazenado nesse servidor: fica sob responsabilidade da Médiquo para cada paciente autenticado, conforme o serviço contratado e confirmado pelo Pedro.
- O `render.yaml` desativa o auto-deploy para poupar recursos gratuitos: depois de **modificações no backend**, use um deploy manual no Render.

## 5. Execução local (opcional, para quem desenvolve)

Em Node.js 20.10+:

```bash
cd app-teste-novo-2-backend
cp .env.example .env
# Preencha o .env privadamente, somente com os valores confirmados.
npm run dev
```

Nunca versionar o arquivo `.env`. O ambiente de homologação deve sempre usar o endpoint correto, confirmado diretamente pela Médiquo.
