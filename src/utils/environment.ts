/**
 * Detecta el ambiente actual basándose en el hostname
 * @returns 'local' | 'demo' | 'prod' | 'staging'
 */
export function detectLandingEnvironment(): 'local' | 'demo' | 'prod' | 'staging' {
  if (typeof window === 'undefined') return 'local';
  
  const hostname = window.location.hostname;
  
  // Localhost y 127.0.0.1 son local
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local';
  }
  
  // demo.easyrace.com.mx
  if (hostname.startsWith('demo.')) {
    return 'demo';
  }
  
  // staging.easyrace.com.mx
  if (hostname.startsWith('staging.')) {
    return 'staging';
  }
  
  // easyrace.com.mx (producción)
  return 'prod';
}

/**
 * Obtiene el proyecto actual
 */
export function getLandingProject(): 'landing' {
  return 'landing';
}
