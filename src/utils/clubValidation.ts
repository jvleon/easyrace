import { supabase } from '../lib/supabase';

/**
 * Normaliza el nombre de un club para comparación de duplicados
 * Convierte a minúsculas, quita acentos, espacios y caracteres especiales
 * @param name - Nombre del club
 * @returns Nombre normalizado para comparación
 */
export function normalizeClubName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]/g, '')       // Solo caracteres alfanuméricos
    .trim();
}

/**
 * Verifica si un club APROBADO ya existe con un nombre similar
 * Solo valida contra clubs con status='approved', permite duplicados pendientes
 * Usa filtrado defensivo compatible con/sin columna status
 * 
 * @param name - Nombre del club a verificar
 * @param sportTypeId - ID del tipo de deporte (para filtrar por deporte)
 * @returns Objeto con exists (boolean) y matchedClub (nombre del club existente si hay match)
 */
export async function checkClubExists(
  name: string,
  sportTypeId: string
): Promise<{ exists: boolean; matchedClub?: string }> {
  const normalizedInput = normalizeClubName(name);
  
  if (!normalizedInput) {
    return { exists: false };
  }

  try {
    // Primero obtener los club_ids que tienen el sport_type_id
    const { data: clubSportsData, error: clubSportsError } = await supabase
      .from('club_sports')
      .select('club_id')
      .eq('sport_type_id', sportTypeId);

    if (clubSportsError) {
      console.error('Error checking club_sports:', clubSportsError);
      // Si falla, intentar sin filtro de deporte
      return checkClubExistsWithoutSportFilter(name);
    }

    if (!clubSportsData || clubSportsData.length === 0) {
      // No hay clubs para este deporte, no hay duplicados posibles
      return { exists: false };
    }

    const clubIds = clubSportsData.map(cs => cs.club_id);

    // Obtener clubs con esos IDs
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name, status')
      .in('id', clubIds);

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError);
      return { exists: false };
    }

    if (!clubs || clubs.length === 0) {
      return { exists: false };
    }

    // Filtrar solo clubs aprobados (defensivo: si no tiene status, se considera aprobado)
    const approvedClubs = clubs.filter(club => 
      !('status' in club) || club.status === 'approved' || club.status === null
    );

    // Comparar nombres normalizados
    for (const club of approvedClubs) {
      const normalizedExisting = normalizeClubName(club.name);
      if (normalizedExisting === normalizedInput) {
        return {
          exists: true,
          matchedClub: club.name,
        };
      }
    }

    return { exists: false };
  } catch (error) {
    console.error('Error in checkClubExists:', error);
    return { exists: false };
  }
}

/**
 * Versión fallback sin filtro de deporte (para casos de error)
 */
async function checkClubExistsWithoutSportFilter(
  name: string
): Promise<{ exists: boolean; matchedClub?: string }> {
  const normalizedInput = normalizeClubName(name);

  try {
    const { data: clubs, error } = await supabase
      .from('clubs')
      .select('id, name, status');

    if (error) {
      console.error('Error fetching all clubs:', error);
      return { exists: false };
    }

    if (!clubs || clubs.length === 0) {
      return { exists: false };
    }

    // Filtrar solo clubs aprobados (defensivo)
    const approvedClubs = clubs.filter(club => 
      !('status' in club) || club.status === 'approved' || club.status === null
    );

    for (const club of approvedClubs) {
      const normalizedExisting = normalizeClubName(club.name);
      if (normalizedExisting === normalizedInput) {
        return {
          exists: true,
          matchedClub: club.name,
        };
      }
    }

    return { exists: false };
  } catch (error) {
    console.error('Error in checkClubExistsWithoutSportFilter:', error);
    return { exists: false };
  }
}

/**
 * Lista de estados de México + opciones especiales
 */
export const MEXICAN_STATES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
  'Nacional',
  'Internacional',
] as const;

export type MexicanState = typeof MEXICAN_STATES[number];
