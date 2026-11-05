# Diagnóstico isolado SDK | PromoVie

O Worker `promovie-sdk-diagnostico` é **separado** de `promovie-mediquo-teste-2`.
Não usa D1; não cadastra, atualiza, suspende ou remove pacientes; não altera licenças.

## Publicação
Na Cloudflare, crie um novo Worker `promovie-sdk-diagnostico`, conectado ao repositório `promovietv1-wq/promovie`, ramo `main`, diretório raiz `promovie-sdk-diagnostico` e comando `npx wrangler deploy`.
Não edite a configuração nem as variáveis do Worker principal. Use apenas plano gratuito.

Configure **no novo Worker**, como Secrets (jamais no GitHub ou no chat):
- `DIAG_ACCESS_PASSWORD`: senha aleatória exclusiva, no mínimo 24 caracteres, diferente da senha administrativa.
- `DIAG_CLIENT_SECRET_KEY`: Secret Key identificada como **Cliente**, no e-mail de Pedro de 04/11/2026.
- `DIAG_PARTNER_SECRET_KEY`: Secret Key identificada como **Parceiro**, no mesmo e-mail.

A API Key pública do cliente já consta da configuração. Abra a URL `workers.dev` fornecida pela Cloudflare. Informe a senha exclusiva e opcionalmente o CPF de **paciente SDK já cadastrado**. Execute uma única vez. O resultado mostra só os códigos HTTP, a quantidade de profissionais e se houve token. Não mostra CPF, chaves, nomes nem tokens.

## Comparação
Para cada Secret Key, usando a API SDK `https://sdk.mediquo.com/v1`:
- `GET /consultants`, catálogo listado na documentação da API.
- `GET /professionals`, rota que o Widget chamou e retornou `{"data":[]}`.
- Se informado o CPF: `POST /patients/authenticate?code=CPF`.
- Se informado o CPF: `POST /patients/authenticate` com JSON `{"code":"CPF"}`.

Os dois últimos testes autenticam um paciente **já existente**, sem cadastrá-lo ou consumir outra licença. Nunca copie dados reais para o repositório.

**Interpretação:** um resultado com quantidade maior que zero em `/consultants` comprova o catálogo acessível por aquela combinação, mas não comprova que os oito serviços estejam liberados no plano 345. Erro 401/403 indica acesso negado. Resultado vazio exige análise do fornecedor ou do escopo de credenciais. O endpoint `/professionals` pode ser interno ao Widget; seu 404 isoladamente não prova configuração errada.

Depois do teste, desative ou exclua esse Worker e descarte a senha exclusiva. Não altere a chave do Worker principal sem confirmação da configuração correta.
