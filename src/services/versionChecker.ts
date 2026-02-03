import { supabase } from '../lib/supabase';
import { detectLandingEnvironment, getLandingProject } from '../utils/environment';

// Versión tomada automáticamente del package.json en build time
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

interface AppVersion {
  version: string;
  force_reload: boolean;
}

/**
 * Consulta la versión actual desde Supabase
 */
async function fetchRemoteVersion(): Promise<AppVersion | null> {
  const environment = detectLandingEnvironment();
  
  // No validar en local
  if (environment === 'local') {
    return null;
  }
  
  const project = getLandingProject();
  
  try {
    const { data, error } = await supabase
      .from('app_versions')
      .select('version, force_reload')
      .eq('project', project)
      .eq('environment', environment)
      .single();
    
    if (error) {
      console.error('Error fetching app version:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error in fetchRemoteVersion:', err);
    return null;
  }
}

/**
 * Verifica si la versión actual es válida
 * @returns true si debe forzar recarga, false si no
 */
export async function checkVersion(): Promise<boolean> {
  const remoteVersion = await fetchRemoteVersion();
  
  // Si no hay versión remota o estamos en local, no forzar
  if (!remoteVersion) {
    return false;
  }
  
  // Si las versiones coinciden, no forzar
  if (remoteVersion.version === CURRENT_VERSION) {
    return false;
  }
  
  // Si las versiones no coinciden y force_reload es true, forzar
  return remoteVersion.force_reload;
}

/**
 * Obtiene la versión actual del cliente
 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
