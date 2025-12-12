import { supabase } from '../lib/supabase';

/**
 * Normaliza el slug del evento según el estándar
 * Convierte el nombre del evento a formato URL-friendly (máximo 50 caracteres)
 * @param eventName - Nombre del evento o slug existente
 * @returns Slug normalizado
 */
function normalizeEventSlug(eventName: string): string {
  return eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Reemplazar caracteres especiales con guiones
    .replace(/^-+|-+$/g, '')      // Eliminar guiones al inicio/final
    .substring(0, 50);             // Limitar a 50 caracteres
}

/**
 * Genera un ID aleatorio de 13 caracteres usando base36
 * Formato según estándar: Math.random().toString(36).substring(2, 15)
 */
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Valida que el archivo sea una imagen válida
 */
function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Validar tipo de archivo
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Solo se permiten archivos de imagen (JPEG, PNG, GIF, WebP)',
    };
  }

  // Validar tamaño (2 MB máximo para foto de identificación)
  const maxSize = 2 * 1024 * 1024; // 2 MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'La imagen debe ser menor a 2MB',
    };
  }

  return { valid: true };
}

/**
 * Obtiene la URL de direct upload desde la edge function de Supabase
 * Según la documentación de Supabase, se usa supabase.functions.invoke()
 * La edge function está configurada para aceptar peticiones públicas (sin autenticación)
 * La edge function solo genera la URL, no sube el archivo
 */
async function getDirectUploadUrl(
  eventSlug: string,
  customId: string,
  eventId?: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  // Usar el método invoke del cliente de Supabase como indica la documentación
  // La edge function está configurada para aceptar peticiones públicas
  const { data, error } = await supabase.functions.invoke('cloudflare-direct-upload', {
    body: {
      customId,
      metadata: {
        eventSlug,
        eventId: eventId || undefined, // Incluir eventId si está disponible
        competitorId: 'new', // Según la documentación
        type: 'competitor-id-photo',
      },
      requireSignedURLs: false, // Según la documentación
    },
  });

  if (error) {
    console.error('Error al invocar edge function:', error);
    throw new Error(`Error al obtener URL de subida: ${error.message || JSON.stringify(error)}`);
  }

  if (!data) {
    throw new Error('La edge function no retornó datos');
  }

  // La edge function retorna uploadURL (mayúscula) e imageId
  // Intentar diferentes variantes comunes
  const uploadUrl = data.uploadUrl || data.upload_url || data.uploadURL || data.url;
  let publicUrl = data.publicUrl || data.public_url || data.publicURL;

  if (!uploadUrl) {
    console.error('Datos recibidos de edge function:', JSON.stringify(data, null, 2));
    throw new Error(`La edge function no retornó uploadUrl. Datos recibidos: ${JSON.stringify(data)}`);
  }
  
  // Si no hay publicUrl, construirla a partir del uploadURL o imageId
  if (!publicUrl) {
    const imageId = data.imageId || data.image_id || data.imageID;
    
    if (imageId) {
      // Intentar usar CLOUDFLARE_IMAGES_URL si está configurada
      const cloudflareImagesUrl = import.meta.env.PUBLIC_CLOUDFLARE_IMAGES_URL || import.meta.env.VITE_CLOUDFLARE_IMAGES_URL;
      
      if (cloudflareImagesUrl) {
        // Usar la URL base configurada
        publicUrl = `${cloudflareImagesUrl}/${imageId}/public`;
      } else if (uploadUrl.includes('upload.imagedelivery.net')) {
        // Construir la URL pública usando el formato de Cloudflare Images
        // El uploadURL tiene el formato: https://upload.imagedelivery.net/{account_hash}/{imageId}
        // La URL pública es: https://imagedelivery.net/{account_hash}/{imageId}/public
        publicUrl = uploadUrl.replace('upload.imagedelivery.net', 'imagedelivery.net') + '/public';
      } else {
        console.error('Datos recibidos de edge function:', JSON.stringify(data, null, 2));
        throw new Error(`No se pudo construir publicUrl. uploadUrl: ${uploadUrl}, imageId: ${imageId}`);
      }
    } else {
      console.error('Datos recibidos de edge function:', JSON.stringify(data, null, 2));
      throw new Error(`No se pudo construir publicUrl. uploadUrl: ${uploadUrl}, imageId: ${imageId}`);
    }
  }

  return {
    uploadUrl,
    publicUrl,
  };
}

/**
 * Sube la imagen directamente a Cloudflare Images usando direct upload
 * Según la documentación actualizada, se usa POST con FormData (no PUT)
 */
async function uploadToCloudflare(
  file: File,
  uploadUrl: string
): Promise<void> {
  // Según la documentación, usar POST con FormData (no PUT)
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    // No incluir headers Content-Type, el navegador lo maneja automáticamente con FormData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al subir imagen a Cloudflare: ${errorText}`);
  }
}

/**
 * Función principal para subir una imagen de identificación a Cloudflare Images
 * 
 * Flujo según la documentación actualizada:
 * 1. Edge function genera uploadURL e imageId (petición pública, sin autenticación)
 * 2. Cliente sube directamente a Cloudflare usando POST con FormData
 * 3. Se construye la URL pública a partir del imageId
 * 
 * @param file - Archivo de imagen a subir
 * @param eventSlug - Slug del evento (para el custom ID)
 * @param eventId - ID del evento (opcional, para metadata)
 * @returns URL pública de la imagen en Cloudflare Images
 */
export async function uploadIdPhotoToCloudflare(
  file: File,
  eventSlug: string,
  eventId?: string
): Promise<string> {
  // Validar archivo
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Normalizar el slug del evento según el estándar
  const normalizedSlug = normalizeEventSlug(eventSlug);

  // Generar custom ID con el formato: identificacion-boletera-{event-slug}-{random-id}
  const randomId = generateRandomId();
  const customId = `identificacion-boletera-${normalizedSlug}-${randomId}`;

  try {
    // 1. Obtener URL de direct upload y URL pública desde la edge function
    // La edge function está configurada para aceptar peticiones públicas (sin autenticación)
    // Solo genera la URL, no sube el archivo
    const { uploadUrl, publicUrl } = await getDirectUploadUrl(eventSlug, customId, eventId);

    // 2. Subir la imagen directamente a Cloudflare usando POST con FormData
    // Según la documentación actualizada, se usa POST (no PUT)
    await uploadToCloudflare(file, uploadUrl);

    // 3. Retornar la URL pública
    return publicUrl;
  } catch (error) {
    console.error('Error en uploadIdPhotoToCloudflare:', error);
    throw error;
  }
}

/**
 * Sube una foto social a Cloudflare Images
 * @param file - Archivo de imagen a subir
 * @param eventSlug - Slug del evento
 * @param eventId - ID del evento (opcional)
 * @returns URL pública de la imagen
 */
export async function uploadSocialPhotoToCloudflare(
  file: File,
  eventSlug: string,
  eventId?: string
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Normalizar el slug del evento según el estándar
  const normalizedSlug = normalizeEventSlug(eventSlug);

  const randomId = generateRandomId();
  const customId = `social-boletera-${normalizedSlug}-${randomId}`;

  try {
    const { uploadUrl, publicUrl } = await getDirectUploadUrl(eventSlug, customId, eventId);
    await uploadToCloudflare(file, uploadUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error en uploadSocialPhotoToCloudflare:', error);
    throw error;
  }
}

/**
 * Sube un comprobante de pago a Cloudflare Images
 * @param file - Archivo de imagen a subir (JPEG, JPG, PNG, máximo 2MB)
 * @param eventSlug - Slug del evento
 * @param eventId - ID del evento (opcional)
 * @returns URL pública de la imagen
 */
export async function uploadPaymentProofToCloudflare(
  file: File,
  eventSlug: string,
  eventId?: string
): Promise<string> {
  // Validar que sea JPEG, JPG o PNG
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Solo se permiten archivos JPEG, JPG o PNG');
  }

  // Validar tamaño (2MB máximo)
  const maxSize = 2 * 1024 * 1024; // 2 MB
  if (file.size > maxSize) {
    throw new Error('La imagen debe ser menor a 2MB');
  }

  // Normalizar el slug del evento según el estándar
  const normalizedSlug = normalizeEventSlug(eventSlug);

  const randomId = generateRandomId();
  const customId = `comprobante-boletera-${normalizedSlug}-${randomId}`;

  try {
    const { uploadUrl, publicUrl } = await getDirectUploadUrl(eventSlug, customId, eventId);
    await uploadToCloudflare(file, uploadUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error en uploadPaymentProofToCloudflare:', error);
    throw error;
  }
}

/**
 * Verifica si una URL es de Cloudflare Images
 */
export function isCloudflareImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('imagedelivery.net');
}

/**
 * Obtiene una variante de la imagen de Cloudflare
 */
export function getCloudflareImageVariant(
  imageUrl: string,
  variant: 'public' | 'thumbnail' | 'avatar' = 'public'
): string {
  if (!isCloudflareImageUrl(imageUrl)) {
    return imageUrl; // Si no es de Cloudflare, retornar la URL original
  }

  // Reemplazar la última parte de la URL con la variante
  const parts = imageUrl.split('/');
  parts[parts.length - 1] = variant;
  return parts.join('/');
}

