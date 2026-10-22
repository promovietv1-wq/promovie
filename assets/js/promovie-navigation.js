/* PromoVie | navegação de retorno entre páginas, v1
 * Da página interna: logomarca -> início.
 * Do início: logomarca/globo -> última página interna visitada.
 * Em visita direta ao início, mantém a Experiência Estratégica como destino padrão.
 * Para futuras páginas, incluir: <script src="/assets/js/promovie-navigation.js" defer></script>
 */
(function () {
  "use strict";
  var key = "promovie:last-page:v1";
  var defaultTarget = "/experiencia/";
  function normalize(value) {
    if (!value || typeof value !== "string") return null;
    try {
      var url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      var pathname = url.pathname.replace(/\/index\.html$/i, "/");
      if (!pathname || pathname === "/" || pathname.indexOf("//") === 0) return null;
      if (!/^\/[a-z0-9_\-/%.]+$/i.test(pathname)) return null;
      if (/^\/(?:assets|\.github|api|app-teste|admin)(?:\/|$)/i.test(pathname)) return null;
      if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return null;
      if (pathname.length > 180) return null;
      return pathname;
    } catch (e) { return null; }
  }
  function remember(page) {
    var target = normalize(page);
    if (target) { try { window.sessionStorage.setItem(key, target); } catch (e) {} }
    return target;
  }
  function readRemembered() {
    try { return normalize(window.sessionStorage.getItem(key)); }
    catch (e) { return null; }
  }
  function isHome() {
    return window.location.pathname === "/" || window.location.pathname === "/index.html";
  }
  function getReturnTarget() {
    if (isHome()) remember(document.referrer);
    return readRemembered() || defaultTarget;
  }
  function displayLabel(target) {
    var names = {
      "/conecta-gestao/": "Conecta Gestão",
      "/experiencia/": "Experiência Estratégica",
      "/audiovisual/": "Portfólio Audiovisual",
      "/app/": "Aplicativo PromoVie"
    };
    return names[target] || "última página visitada da PromoVie";
  }
  function refresh() {
    if (!isHome()) {
      remember(window.location.pathname);
      return;
    }
    var target = getReturnTarget();
    var label = "Voltar para " + displayLabel(target);
    document.querySelectorAll(".top .pvGlobeSwitch, .top a.pvPrimaryBrand").forEach(function (a) {
      a.setAttribute("href", target);
      a.setAttribute("aria-label", label);
      a.setAttribute("title", label);
    });
    var logo = document.querySelector(".top .logoMorphTop");
    if (logo) { logo.setAttribute("aria-label", label); logo.setAttribute("title", label); }
  }
  window.PromoVieNavigation = {
    getReturnTarget: getReturnTarget,
    rememberCurrent: function () { return remember(window.location.pathname); }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh);
  } else {
    refresh();
  }
  window.addEventListener("pageshow", refresh);
})();
