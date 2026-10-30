# TeleSaúde PromoVie: integração Médiquo v3

Página pública: `https://www.promovie.tv.br/telesaude/`.
Backend existente: `https://backend.promovie.tv.br` (Worker `promovie-mediquo-teste-2`).

**Não alterar o DNS, o site principal nem a integração antiga.** As novas rotas são isoladas em `/api/mediquo/v3/*` e ficam desativadas por padrão.

## Rotas novas

| Rota | Método | Descrição |
| --- | --- | --- |
| `/api/mediquo/v3/health` | GET | Indica se a homologação está configurada |
| `/api/mediquo/v3/config` | GET | Retorna apenas a API Key pública e ambiente sandbox quando habilitado |
| `/api/mediquo/v3/patients/sync` | POST | Cadastra **somente o paciente fictício autorizado**, com token secreto no header Authorization |
| `/api/mediquo/v3/session` | POST | Exige CPF do paciente fictício **e** senha de homologação privada, consulta situação do paciente e solicita token à Médiquo |

## Configuração no Cloudflare Worker (sem colocar segredos no GitHub)

1. Confirmar com Pedro o **nome exato do plano**, a **API Key do novo cliente** e se a URL `https://sdk.mediquo.com/v1` corresponde à homologação com a nova chave. A chave antiga não serve para o cliente novo.
2. Pedir a rotação da **Secret Key** enviada por e-mail. Depois, adicionar a nova chave diretamente como secret do Worker.
3. Configurar no painel do Worker as variáveis/segredos listados abaixo, sem substituir indevidamente variáveis utilizadas pelo teste anterior.

**Variáveis não secretas:**
- `TELESAUDE_V3_ENABLED`: `false` até concluir a configuração; posteriormente `true` apenas para teste restrito.
- `WIDGET_ENVIRONMENT`: `sandbox`.
- `MEDIQUO_V3_API_KEY`: a API Key pública **do cliente novo**. Cadastrar no painel do Worker, não no HTML.
- `MEDIQUO_V3_PLAN`: nome exato do plano, a confirmar com Pedro.
- `MEDIQUO_V3_BASE_URL`: URL da API confirmada para homologação, sem barra final.

**Segredos, nunca versionar em repositórios nem inserir no navegador:**
- `MEDIQUO_V3_SECRET_KEY`: chave privada substituta da Médiquo.
- `TELESAUDE_V3_TEST_PASSWORD`: senha forte de homologação, mínimo de 16 caracteres.
- `TELESAUDE_V3_SYNC_TOKEN`: token forte para sincronização, mínimo de 24 caracteres.
- `TELESAUDE_V3_TEST_CPF`: identificador fictício de 11 dígitos usado apenas nos testes (manter privado no painel).

4. Com as variáveis confirmadas e com `TELESAUDE_V3_ENABLED=true`, conferir `GET /api/mediquo/v3/health` e enviar **um único beneficiário fictício** com `POST /api/mediquo/v3/patients/sync`, autenticado por `Authorization: Bearer <token privado>`.
5. Testar a página com CPF fictício + senha privada. Confirmar que CPF não autorizado é bloqueado e que os oito serviços aparecem conforme o plano.
6. **Não habilitar beneficiários reais nem remover os bloqueios por CPF/teste** até existir autenticação individual segura, gestão de licenças e avaliação de proteção de dados.

## Por que não copiar integralmente o backend do fornecedor?

O pacote v3 da Médiquo autentica qualquer CPF ativo sem verificar se o visitante é o titular. Essa condição pode expor dados de saúde e históricos. Por isso, a rota pública desta versão só permite **um CPF fictício configurado no próprio Worker** e exige senha privada de homologação. O acesso para beneficiários reais requer login individual com verificação de identidade, controles contra abuso e gestão de licenças.

## Compatibilidade e segurança

O código original do teste `/api/mediquo/health`, `/api/mediquo/config` e `/api/mediquo/token` foi preservado. As novas rotas não substituem esses caminhos. A publicação da página não ativa o atendimento automaticamente.

Os testes automatizados ficam em `test.mjs` e `v3.test.mjs` e rodam no fluxo `App Teste Novo 2 - Cloudflare Worker (simulado)`.
