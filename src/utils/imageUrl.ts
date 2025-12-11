/**
 * Convierte URLs de Cloudflare Images de /public a /banner o /bannermovil para mejor calidad
 * @param url - URL de la imagen
 * @param isMobile - Si es true, usa /bannermovil, si es false usa /banner
 */
export function getBannerUrl(url: string | null | undefined, isMobile: boolean = false): string | null {
  if (!url) return null;

  // Si es una URL de Cloudflare Images, reemplazar /public por /banner o /bannermovil
  if (url.includes('imagedelivery.net')) {
    const replacement = isMobile ? '/bannermovil' : '/banner';
    return url.replace('/public', replacement);
  }

  return url;
}

