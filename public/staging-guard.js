/**
 * Detecta si estamos en un subdominio de staging o demo
 * y bloquea analytics + inyecta noindex para evitar indexación.
 * 
 * Este script debe ejecutarse ANTES del Google Tag para poder bloquearlo.
 */
(function () {
  var hostname = window.location.hostname;
  var isStaging = hostname.startsWith('staging.') || hostname.startsWith('demo.');

  if (isStaging) {
    // Inyectar meta noindex para evitar indexación por buscadores
    var meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    var metaGoogle = document.createElement('meta');
    metaGoogle.name = 'googlebot';
    metaGoogle.content = 'noindex, nofollow';
    document.head.appendChild(metaGoogle);

    // Marcar flag global para que el gtag no se cargue
    window.__EASYRACE_BLOCK_ANALYTICS__ = true;
  }
})();
