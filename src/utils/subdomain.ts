/**
 * Detecta si la aplicación está siendo ejecutada en el subdominio demo
 * Funciona tanto en cliente (browser) como en servidor (Astro SSR)
 */
export function isDemoSubdomain(): boolean {
  // En el cliente (browser)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Detectar subdominio demo: demo.easyrace.com.mx o demo.localhost (para desarrollo)
    return hostname.startsWith('demo.') || hostname === 'demo.easyrace.com.mx';
  }

  // En el servidor (Astro), intentar obtener del header
  // Nota: Esto requiere acceso a Astro.request, así que se pasará como parámetro cuando sea necesario
  return false;
}

/**
 * Detecta si estamos en el subdominio demo usando el hostname directamente
 * Útil para casos donde no tenemos acceso a window
 */
export function isDemoSubdomainFromHostname(hostname: string): boolean {
  return hostname.startsWith('demo.') || hostname === 'demo.easyrace.com.mx';
}

