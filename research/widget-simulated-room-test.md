# Experiência isolada com o widget público real

Autenticação e dados do paciente integralmente simulados. Nenhuma credencial ou sessão real utilizada.

- Inicialização do SDK: timeout
- Iframes antes: ["https://widget.mediquo.com/launcher/index.html","https://widget.mediquo.com/"]
- Iframes após open_room: ["https://widget.mediquo.com/launcher/index.html","https://widget.mediquo.com/"]
- Navegação para room comprovada no ambiente simulado: false
- Chamadas API simuladas: [{"method":"POST","path":"/sdk/events","host":"tracking.mediquo.com"},{"method":"POST","path":"/sdk/events","host":"tracking.mediquo.com"}]
- Eventos sanitizados: [{"command":"container_init"},{"command":"message"},{"command":"styles"},{"command":"message"},{"command":"styles"},{"command":"styles"},{"command":"launcher_init"},{"command":"message"},{"command":"styles"},{"command":"close"},{"command":"styles"},{"command":"widget_closed"}]
- Erros não sensíveis: ["InvalidTokenError: Invalid token specified: missing part #2","InvalidTokenError: Invalid token specified: missing part #2","Failed to load resource: net::ERR_FAILED","Failed to load resource: net::ERR_FAILED","TypeError: Failed to fetch","TypeError: Failed to fetch"]

O teste simulado **não confirma** o acesso de profissionais por pacientes reais na produção.
