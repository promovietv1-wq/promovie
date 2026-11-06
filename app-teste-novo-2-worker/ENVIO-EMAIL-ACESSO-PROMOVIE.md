# PromoVie | Entrega opcional do código pessoal por e-mail

## Situação e custo

- A Cloudflare Email Routing é gratuita para receber/encaminhar e-mails. Enviar mensagens para beneficiários não verificados no plano Workers Free não é suportado pelo Email Sending da Cloudflare.
- Como alternativa gratuita, o Resend oferece atualmente 3.000 e-mails/mês, limite de 100/dia, sem cobrança no plano Free (sujeito aos termos do fornecedor): https://resend.com/pricing
- A integração foi adicionada **desligada por padrão**. Não cria conta, não ativa serviço pago e não envia mensagens até você configurar o fornecedor.

## Fluxo existente preservado

1. O gestor cadastra nome, CPF, telefone e e-mail no painel `/telesaude/gestao/`.
2. Somente depois de a licença do plano 345 ser confirmada como ativa, `Gerar código pessoal` emite o mesmo código individual da PromoVie.
3. **Se o envio estiver habilitado e existir e-mail válido**, o Worker solicita ao Resend a entrega da mensagem, sem CPF completo e sem dados clínicos.
4. O código continua aparecendo **uma única vez** ao gestor como contingência. Em falha de e-mail, o código gerado permanece válido para entrega manual.
5. A interface informa *solicitação aceita*, não *e-mail entregue*: aceitação do provedor não garante chegada à caixa postal.

## Mensagem

Assunto: **Seu acesso à TeleSaúde PromoVie**

> Olá, [primeiro nome]!
>
> Seu acesso à TeleSaúde PromoVie está disponível.
>
> Acesse: https://www.promovie.tv.br/telesaude/
>
> Identificação: seu CPF cadastrado
>
> Código pessoal: [código gerado]
>
> Guarde seu código com segurança e não o compartilhe.
>
> PromoVie

## Como habilitar sem afetar a produção

1. Criar uma conta Resend Free em https://resend.com/ (ação do responsável).
2. Adicionar e verificar um domínio ou subdomínio controlado da PromoVie no Resend. Configurar **apenas os registros DNS solicitados para envio**, sem substituir os registros existentes do GitHub Pages nem os MX de recebimento.
3. Gerar uma chave de API com permissão mínima para envio.
4. No **Worker existente** `promovie-mediquo-teste-2`, em Cloudflare > Settings > Variables and Secrets, configurar:
   - `RESEND_API_KEY` como **secret** (nunca no GitHub, HTML, chat ou logs);
   - `PROMOVIE_ACCESS_EMAIL_FROM` com um remetente validado, por exemplo `PromoVie <acesso@promovie.tv.br>` (exemplo, não criar esse remetente sem verificar domínio);
   - `PROMOVIE_ACCESS_EMAIL_ENABLED=true` **somente após teste controlado**, permanecendo ausente ou `false` até lá.
5. Fazer teste com beneficiário **já ativo** e e-mail próprio autorizado. Conferir recebimento e situação do envio no painel do Resend antes de uso geral.
6. Não alterar o plano 345, o SDK, os tokens, o banco D1, o domínio `backend.promovie.tv.br` ou o login da página pública.

## Salvaguardas

- Nenhum envio ocorre se a opção não estiver explicitamente habilitada.
- Os códigos continuam armazenados no D1 somente como HMAC, nunca em texto.
- A solicitação de e-mail é realizada apenas na rota administrativa autenticada e para beneficiário ativo.
- O Resend recebe o primeiro nome, o endereço de e-mail e o código como dados necessários à entrega; não recebe o CPF.
- Em falhas, o gestor vê o código para entrega manual, sem interrupção da entrada na Médiquo.
- Não são feitos envios de teste para contatos reais sem autorização.

## Referências

- Cloudflare: https://developers.cloudflare.com/email-service/platform/pricing/
- Resend Free: https://resend.com/pricing
- API Resend: https://resend.com/docs/api-reference/emails/send-email
