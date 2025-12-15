// Importación condicional de DOMPurify (solo en cliente)
let DOMPurify: any = null;

if (typeof window !== 'undefined') {
  try {
    DOMPurify = require('dompurify');
  } catch (e) {
    console.warn('DOMPurify no disponible, usando sanitización básica');
  }
}

/**
 * Sanitiza HTML para prevenir XSS attacks
 * Usa DOMPurify para limpiar contenido HTML no confiable
 * 
 * @param dirty - HTML sin sanitizar
 * @param allowStravaEmbed - Si es true, permite iframes de Strava (para embeds)
 * @returns HTML sanitizado y seguro
 */
export function sanitizeHtml(dirty: string | null | undefined, allowStravaEmbed: boolean = false): string {
  if (!dirty) return '';

  // DOMPurify solo funciona en el navegador
  if (typeof window === 'undefined' || !DOMPurify) {
    // En el servidor o si DOMPurify no está disponible, hacer sanitización básica
    return sanitizeHtmlServer(dirty, allowStravaEmbed);
  }
  
  // Configuración base de DOMPurify
  const config: any = {
    // Permitir tags comunes de formato
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre',
      'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
    ],
    // Atributos permitidos
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel',
      'width', 'height', 'align', 'colspan', 'rowspan'
    ],
    // URLs permitidas
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Mantener estilos inline (necesario para Slate)
    KEEP_CONTENT: true,
    // Retornar DOM en lugar de string (más seguro)
    RETURN_DOM: false,
    // Retornar DOM fragment
    RETURN_DOM_FRAGMENT: false,
    // Retornar DOM body
    RETURN_DOM_IMPORT: false,
  };

  // Si es un embed de Strava, permitir iframe
  if (allowStravaEmbed) {
    config.ALLOWED_TAGS?.push('iframe');
    config.ALLOWED_ATTR?.push('allowfullscreen', 'frameborder', 'scrolling', 'data-strava-embed');
    // Solo permitir iframes de Strava
    config.ALLOW_DATA_ATTR = true;
    
    // Verificar que el iframe sea de Strava
    const stravaRegex = /https?:\/\/(www\.)?strava\.com/i;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = dirty;
    const iframes = tempDiv.querySelectorAll('iframe');
    
    // Si hay iframes que no son de Strava, removerlos
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      if (!stravaRegex.test(src)) {
        iframe.remove();
      }
    });
    
    dirty = tempDiv.innerHTML;
  }

  // Sanitizar el HTML
  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitización básica para el servidor (SSR)
 * En producción, el contenido ya debería estar sanitizado desde la BD
 */
function sanitizeHtmlServer(dirty: string, allowStravaEmbed: boolean): string {
  // Escapar caracteres peligrosos básicos
  let sanitized = dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, (match) => {
      // Solo permitir iframes de Strava si está permitido
      if (allowStravaEmbed && /strava\.com/i.test(match)) {
        return match;
      }
      return '';
    })
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remover event handlers

  return sanitized;
}

/**
 * Sanitiza específicamente embeds de Strava
 * Valida y permite solo embeds legítimos de Strava con estructura conocida
 * 
 * Formato esperado:
 * <div class="strava-embed-placeholder" data-embed-type="route" data-embed-id="..." ...></div>
 * <script src="https://strava-embeds.com/embed.js"></script>
 */
export function sanitizeStravaEmbed(embed: string | null | undefined): string {
  if (!embed) return '';

  // Verificar que contenga elementos de embed de Strava
  const hasStravaPlaceholder = /strava-embed-placeholder/i.test(embed);
  const hasStravaScript = /strava-embeds\.com\/embed\.js/i.test(embed);
  
  if (!hasStravaPlaceholder && !hasStravaScript) {
    // Si no tiene la estructura de embed de Strava, retornar vacío
    if (typeof window !== 'undefined') {
      console.warn('Embed no tiene estructura de Strava, rechazado por seguridad');
    }
    return '';
  }

  // DOMPurify elimina scripts por seguridad, así que usamos validación y reconstrucción
  // Esto es más seguro que intentar permitir scripts en DOMPurify
  return sanitizeStravaEmbedClient(embed);
}

/**
 * Sanitización de embed de Strava para cliente
 * Valida y reconstruye el embed de forma segura (más seguro que permitir scripts en DOMPurify)
 */
function sanitizeStravaEmbedClient(embed: string): string {
  // Extraer el div de placeholder
  const placeholderMatch = embed.match(/<div[^>]*class=["']strava-embed-placeholder["'][^>]*>/i);
  const scriptMatch = embed.match(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/i);

  if (!placeholderMatch || !scriptMatch) {
    return '';
  }

  // Validar que el script sea de strava-embeds.com
  const scriptSrc = scriptMatch[1];
  if (!/^https:\/\/strava-embeds\.com\/embed\.js$/i.test(scriptSrc)) {
    if (typeof window !== 'undefined') {
      console.warn('Script de embed no es de strava-embeds.com, rechazado');
    }
    return '';
  }

  // Extraer atributos del div de forma segura
  const divContent = placeholderMatch[0];
  
  // Atributos permitidos y sus validaciones
  const allowedAttrs: Record<string, (value: string) => boolean> = {
    'class': (v) => v === 'strava-embed-placeholder',
    'data-embed-type': (v) => ['route', 'activity', 'segment'].includes(v),
    'data-embed-id': (v) => /^\d+$/.test(v), // Solo números
    'data-units': (v) => ['metric', 'imperial'].includes(v),
    'data-full-width': (v) => ['true', 'false'].includes(v),
    'data-style': (v) => ['light', 'dark'].includes(v),
    'data-terrain': (v) => /^\d+$/.test(v), // Solo números
    'data-surface-type': (v) => ['true', 'false'].includes(v),
    'data-map-hash': (v) => /^[\d.\/-]+$/.test(v), // Formato de hash de mapa
    'data-from-embed': (v) => v === 'true'
  };

  // Extraer y validar atributos
  const attrs: Record<string, string> = {};
  
  Object.keys(allowedAttrs).forEach(attr => {
    const regex = new RegExp(`${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=["']([^"']+)["']`, 'i');
    const match = divContent.match(regex);
    if (match && allowedAttrs[attr](match[1])) {
      attrs[attr] = match[1];
    }
  });

  // Validar que tenga al menos los atributos esenciales
  if (!attrs['data-embed-type'] || !attrs['data-embed-id']) {
    if (typeof window !== 'undefined') {
      console.warn('Embed de Strava falta atributos esenciales, rechazado');
    }
    return '';
  }

  // Reconstruir el div de forma segura
  const attrsString = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"`)
    .join(' ');

  // Retornar embed reconstruido de forma segura
  return `<div class="strava-embed-placeholder" ${attrsString}></div><script src="https://strava-embeds.com/embed.js"></script>`;
}

/**
 * Sanitización de embed de Strava para servidor (SSR)
 * Usa la misma lógica que el cliente
 */
function sanitizeStravaEmbedServer(embed: string): string {
  return sanitizeStravaEmbedClient(embed);
}

