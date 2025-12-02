/**
 * Convierte URLs de Cloudflare Images de /public a /banner para mejor calidad
 */
export function getBannerUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Si es una URL de Cloudflare Images, reemplazar /public por /banner
  if (url.includes('imagedelivery.net')) {
    return url.replace('/public', '/banner');
  }

  return url;
}

