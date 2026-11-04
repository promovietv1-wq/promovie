# TeleSaúde PromoVie | SDK Médiquo V3, plano 345

Página: https://www.promovie.tv.br/telesaude/
Backend existente: https://backend.promovie.tv.br
Worker: `promovie-mediquo-teste-2`

**Importante:** esta versão foi preparada em uma branch de homologação. O site principal, o PWA /app, o DNS e as rotas antigas devem permanecer inalterados. Não utilizar beneficiários reais nesta fase.

## Informações confirmadas por Pedro em 04/11/2026

- Plano indicado para os pacientes SDK: `345`.
- Base da SDK API: `https://sdk.mediquo.com/v1`.
- Widget: `environment: "production"`, inclusive para a homologação solicitada.
- Os pacientes SDK ainda não aparecem no portal ID.
- Cadastro e administração por API; o portal ID antigo não é um painel de gestão de pacientes SDK.

**Segredos enviados por e-mail:** Pedro enviou chaves denominadas "Parceiro" e "Cliente". Não foram copiadas para o repositório. A mensagem não identifica inequivocamente qual valor usar como `x-api-key` e qual usar como `x-secret-key` na SDK API. Pedir mapeamento seguro e rotação antes da utilização definitiva. Nunca colocar credenciais em Issues, PRs, HTML ou arquivos versionados.

## Duas APIs diferentes (documentação do fornecedor)

1. **API ID:** `https://api-portal.mediquo.com.br`
   - `POST /auth/login` com e-mail e senha administrativa, devolve token Bearer
   - `GET /patients?index=CPF` para consultar pacientes
   - `POST /patients` para cadastrar, com `documentNumber`, `name`, `clientId`, `planId`, `origin`
2. **API SDK:** `https://sdk.mediquo.com/v1`
   - O guia SDK Overview e o guia Widget descrevem `POST /patients/authenticate?code=CPF` com os headers `x-api-key` e `x-secret-key`, devolvendo `access_token`.
   - O guia SDK API também documenta `POST /patients/{licenceId}/token` com os mesmos headers, devolvendo `token`. Nosso backend permite os dois modos sob configuração privada, mas o padrão é `cpf`, sem abrir acesso real.
3. **Widget Web:** `https://widget.mediquo.com/js/1.0.0/mediquo.js`, inicializa com `apiKey` específica do Widget e `accessToken` da sessão.

Documentação:
- https://documentacao.mediquo.com.br/patients.html
- https://documentacao.mediquo.com.br/sdk-overview.html
- https://documentacao.mediquo.com.br/sdk-api.html
- https://documentacao.mediquo.com.br/sdk-widget.html

## Alterações feitas na branch

- Rota `/api/mediquo/v3/patients/sync`: cadastro **somente de um CPF fictício** na API ID, via POST /patients, exigindo token privado e liberação explícita para gravação.
- Rota `/api/mediquo/v3/session`: após CPF de teste + senha privada, consulta paciente ativo na API ID e gera token de sessão na API SDK, bloqueando pacientes ausentes/inativos ou de plano/cliente diferentes.
- Rota `/api/mediquo/v3/config`: só retorna chave destinada ao frontend do Widget, nunca as credenciais do ID ou SDK server-side.
- Rota `/api/mediquo/v3/health`: informa configuração, sem incluir segredos.
- Página TeleSaúde: usa `production` conforme resposta de Pedro, sem alterar o layout.
- Testes simulados garantem que CPF sozinho não autoriza sessão e que `TELESAUDE_V3_WRITE_ENABLED=false` impede cadastro.

## Variáveis públicas (Cloudflare Worker, não cadastrar segredos em vars)

O arquivo `wrangler.jsonc` já registra as variáveis públicas confirmadas. As necessárias:

- `TELESAUDE_V3_ENABLED=false` por padrão. Habilitar `true` somente para teste privado e após confirmar todas as credenciais.
- `TELESAUDE_V3_WRITE_ENABLED=false` por padrão. Habilitar `true` **só durante um cadastro fictício expressamente autorizado**, depois retornar a `false`.
- `WIDGET_ENVIRONMENT=production`.
- `MEDIQUO_V3_BASE_URL=https://sdk.mediquo.com/v1`.
- `MEDIQUO_V3_ID_BASE_URL=https://api-portal.mediquo.com.br`.
- `MEDIQUO_V3_PLAN=345`.
- `MEDIQUO_V3_ORIGIN=SDK`: usado na comunicação inicial da Médiquo em 16/10; é necessário confirmar que vale para o cliente novo.
- `MEDIQUO_V3_SDK_AUTH_MODE=cpf` (ou `licence` se Pedro confirmar a rota por licença).
- `MEDIQUO_V3_CLIENT_ID`: **ainda falta receber/confirmar** o ID numérico do novo cliente. Não confundir com o Partner ID 108 nem o antigo Plan ID 219.
- `MEDIQUO_V3_WIDGET_API_KEY`: chave do Widget, fornecida pela Médiquo para exposição ao navegador. Não confundir com as credenciais privadas da SDK API.

## Secrets obrigatórios (somente no painel Cloudflare)

- `MEDIQUO_V3_SDK_API_KEY`: API key **do backend SDK**.
- `MEDIQUO_V3_SDK_SECRET_KEY`: secret key **do backend SDK**.
- `MEDIQUO_V3_ID_EMAIL`: usuário administrativo que pode consultar/cadastrar pacientes do cliente correto.
- `MEDIQUO_V3_ID_PASSWORD`: senha administrativa respectiva.
- `TELESAUDE_V3_TEST_PASSWORD`: senha de homologação com pelo menos 16 caracteres.
- `TELESAUDE_V3_SYNC_TOKEN`: token de sincronização com pelo menos 24 caracteres.
- `TELESAUDE_V3_TEST_CPF`: CPF exclusivamente fictício autorizado para teste, 11 dígitos.

É importante usar configuração de secrets no painel Cloudflare; não armazenar senhas ou chaves no GitHub. Não publicar o conteúdo dos secrets em conversas ou logs.

## Para passar da preparação ao teste efetivo

1. Confirmar com Pedro o **clientId do novo cliente**, a validade de `origin=SDK`, a atribuição de cada chave e se a autenticação correta é por CPF ou por `licenceId`.
2. Obter acesso válido para a API ID e configurar os secrets de modo seguro no Cloudflare.
3. Confirmar com ele que o cadastro de **um único paciente fictício** no plano 345 pode ser feito no ambiente indicado sem produzir acesso real, notificações ou efeitos operacionais indesejados.
4. Publicar e configurar o Worker v3 apenas após os passos anteriores. Testar `/health`, que deve retornar `homologacao-pronta` com os secrets configurados.
5. Habilitar a permissão de cadastro apenas durante o teste. Cadastrar um CPF fictício autorizado por chamada `POST /api/mediquo/v3/patients/sync`, depois voltar `WRITE_ENABLED=false`.
6. Abrir `/telesaude/` com CPF fictício e senha privada, verificar os oito serviços e o histórico. Se houver bloqueio, usar logs privados sem expor dados pessoais.
7. Não permitir pacientes reais até haver mecanismo robusto de autenticação individual, proteção de dados e gestão de licenças.

## Testes

```bash
cd app-teste-novo-2-worker
npm test
```

O GitHub Actions executa testes locais sem credenciais reais. Sucesso nesses testes **não** significa autenticação real na Médiquo. Não altera cobrança ou licenças.

## Pontos ainda desconhecidos

- Novo `clientId` e `origin` definitivo.
- Mapeamento de chaves "Parceiro" e "Cliente" para SDK/ID, assim como a chave específica do Widget.
- Acesso administrativo funcional para a API ID (usuário/senha ou método alternativo).
- Confirmação de qual endpoint de token deve ser usado com o cliente 345.
- Resultado de uma autenticação real com um paciente fictício e os oito serviços liberados.

A implementação falha de modo seguro se faltar qualquer um desses itens. Não habilitar automaticamente os controles de homologação.
