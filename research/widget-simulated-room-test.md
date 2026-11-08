# Experiência isolada com o widget público real

Autenticação e dados do paciente integralmente simulados. Nenhuma credencial ou sessão real utilizada.

- Inicialização do SDK: timeout
- Iframes antes: ["https://widget.mediquo.com/launcher/index.html","https://widget.mediquo.com/"]
- Iframes após open_room: ["https://widget.mediquo.com/launcher/index.html","https://widget.mediquo.com/"]
- Navegação para room comprovada no ambiente simulado: false
- Chamadas API simuladas: [{"method":"POST","path":"/sdk/events","host":"tracking.mediquo.com"},{"method":"POST","path":"/sdk/events","host":"tracking.mediquo.com"},{"method":"GET","path":"/widget/v1/setup","host":"chat.mediquo.com"},{"method":"GET","path":"/v1/profile"},{"method":"POST","path":"/sdk/events","host":"tracking.mediquo.com"},{"method":"POST","path":"/sdk/events","host":"tracking.mediquo.com"},{"method":"GET","path":"/widget/v1/setup","host":"chat.mediquo.com"}]
- Eventos sanitizados: [{"command":"launcher_init"},{"command":"close"},{"command":"styles"},{"command":"container_init"},{"command":"message"},{"command":"styles"},{"command":"styles"},{"command":"storage.save"},{"command":"message"},{"command":"styles"},{"command":"message"},{"command":"styles"}]
- Erros não sensíveis: ["Failed to load resource: net::ERR_FAILED","Failed to load resource: net::ERR_FAILED","Failed to load resource: net::ERR_FAILED","TypeError: Failed to fetch","TypeError: Failed to fetch","TypeError: Failed to fetch","Failed to load resource: net::ERR_FAILED","Failed to load resource: net::ERR_FAILED","Failed to load resource: net::ERR_FAILED","TypeError: Failed to fetch","TypeError: Failed to fetch","TypeError: Failed to fetch","TypeError: Cannot destructure property 'accepted_at' of 'A' as it is undefined.\n    at w (https://widget.mediquo.com/assets/main.222d2998.js:9:61865)\n    at https://widge","TypeError: Cannot destructure property 'accepted_at' of 'A' as it is undefined."]

O teste simulado **não confirma** o acesso de profissionais por pacientes reais na produção.
