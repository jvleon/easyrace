import { createClient } from '@supabase/supabase-js';

// In Astro, PUBLIC_ prefixed vars are available on client-side
// VITE_ vars work server-side but not in client components
const supabaseUrl = 
  import.meta.env.PUBLIC_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = 
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables. ' +
    'Please add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY to your .env file. ' +
    'Note: In Astro, client-side code needs PUBLIC_ prefix, not VITE_.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Create Supabase client
// The client automatically handles authentication headers
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Debug: Verificar que el cliente esté inicializado correctamente
if (typeof window !== 'undefined') {
  console.log('[Supabase] Client initialized with URL:', supabaseUrl);
  console.log('[Supabase] Anon key present:', !!supabaseAnonKey);
}

