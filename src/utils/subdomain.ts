/**
 * Detecta si la aplicación está siendo ejecutada en el subdominio demo o staging
 * Funciona tanto en cliente (browser) como en servidor (Astro SSR)
 * También incluye localhost para desarrollo
 */
export function isDemoSubdomain(): boolean {
  // En el cliente (browser)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Detectar subdominio demo: demo.easyrace.com.mx, demo.localhost, o localhost (para desarrollo)
    return (
      hostname.startsWith('demo.') ||
      hostname === 'demo.easyrace.com.mx' ||
      hostname.startsWith('staging.') ||
      hostname === 'staging.easyrace.com.mx' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    );
  }

  // En el servidor (Astro), intentar obtener del header
  // Nota: Esto requiere acceso a Astro.request, así que se pasará como parámetro cuando sea necesario
  return false;
}

/**
 * Detecta si estamos en el subdominio demo o staging usando el hostname directamente
 * Útil para casos donde no tenemos acceso a window
 * También incluye localhost para desarrollo
 */
export function isDemoSubdomainFromHostname(hostname: string): boolean {
  return (
    hostname.startsWith('demo.') ||
    hostname === 'demo.easyrace.com.mx' ||
    hostname.startsWith('staging.') ||
    hostname === 'staging.easyrace.com.mx' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

