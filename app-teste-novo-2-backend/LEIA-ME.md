# App Teste Novo 2 — versão com backend

Este módulo implementa o fluxo da **segunda opção do kit enviado por Pedro/Médiquo**: o servidor usa a Secret Key para cadastrar/autenticar um paciente de teste e devolver somente o `access_token` ao navegador.

## Segurança

- **Não publicar a Secret Key** no repositório, HTML, GitHub Pages ou capturas de tela.
- O servidor do exemplo do fornecedor recebia `code` arbitrário, sem autenticação. Aqui, a rota exige **senha privada de homologação** e utiliza **um único paciente fictício** configurado exclusivamente no servidor.
- **Não usar com pacientes reais nem como sistema definitivo de login.** Para produção é necessário autenticar cada beneficiário na PromoVie, vinculá-lo a um código próprio e verificar o direito à licença **no servidor**, antes de gerar o token.
- Configure também as origens permitidas, sempre em HTTPS.

## Publicar e testar

1. Publique esta pasta em uma hospedagem **Node.js** que execute servidor (ex.: um serviço web privado). O GitHub Pages **não** executa Node.js.
2. Crie variáveis de ambiente privadas conforme `.env.example`. NÃO envie o arquivo `.env` ao GitHub. Preencha `MEDIQUO_API_KEY`, `MEDIQUO_SECRET_KEY`, `PROMOVIE_TEST_PASSWORD` (senha exclusiva longa), `MEDIQUO_TEST_PATIENT_CODE`, `ALLOWED_ORIGINS` e, se necessário, `MEDIQUO_BASE_URL` autorizado por Pedro.
3. Após publicar, abra `https://SEU_BACKEND/api/mediquo/health` para verificar se está no ar.
4. No arquivo `app-teste-novo-2/index.html` do site, configure somente `BACKEND_URL` com o endereço HTTPS real do backend.
5. Acesse `https://www.promovie.tv.br/app-teste-novo-2/`, digite a senha privada de teste e clique em **Acessar telemedicina**.
6. O browser solicita `GET /api/mediquo/config`, depois `POST /api/mediquo/token`; o backend usa as credenciais privadas para falar com `/v1/patients` e `/v1/patients/authenticate`.

**Importante:** se a Médiquo usa API separada para Staging, confirme com Pedro qual `MEDIQUO_BASE_URL` deverá ser usada. O valor padrão foi mantido conforme o kit técnico dele.

## Execução local

Com Node.js 20.10+:

```bash
cp .env.example .env
# Editar o .env localmente, sem compartilhar
npm run dev
```

As variáveis de produção devem ser inseridas somente no painel privado do provedor de hospedagem.
