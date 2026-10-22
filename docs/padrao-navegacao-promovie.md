# Padrão de navegação da PromoVie

## Regra de navegação

- Nas páginas internas, a logomarca da PromoVie deve levar a `/` (página principal).
- Na página principal, a logomarca do cabeçalho e o ícone de navegação levam de volta à **última página interna visitada** na aba atual. Exemplos: `/conecta-gestao/`, `/experiencia/`, `/audiovisual/`.
- Sem uma página anterior disponível, a página principal mantém `/experiencia/` como destino-padrão.
- Um link explícito para **Conecta Gestão** aparece no menu principal para acesso direto.

## Páginas novas

Todas as novas páginas HTML dentro deste domínio devem incluir no `<head>`:

```html
<script src="/assets/js/promovie-navigation.js" defer></script>
```

A logomarca do cabeçalho nas páginas internas deve usar o seguinte destino, mantendo a identidade visual apropriada:

```html
<a class="logoLink" href="/" aria-label="Voltar à página principal da PromoVie">
  <img src="/preview-promovie-logo.webp" alt="PromoVie">
</a>
```

O retorno na página principal depende da origem e do histórico de navegação na aba. Um visitante que acessa diretamente a página principal sem origem conhecida usa a Experiência Estratégica como padrão.

O script compartilhado utiliza apenas a origem do próprio site e o armazenamento da sessão na aba. Não altera links externos, páginas de atendimento, dados de pacientes nem conteúdo de vídeo.

## Arquivos inicialmente integrados

- `index.html`
- `experiencia/index.html`
- `conecta-gestao/index.html`
- `audiovisual/index.html`
- `app/index.html`

**Atenção:** GitHub Pages é um site estático. Criar uma nova página não injeta automaticamente scripts nela; é preciso seguir este padrão ao criar o arquivo. A página principal pode identificar páginas futuras pela origem da navegação, mas incluir o script garante o retorno em mais situações.
