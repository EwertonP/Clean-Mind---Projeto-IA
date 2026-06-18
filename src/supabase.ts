import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Instantiate only if the keys are defined to avoid runtime errors on boot when misconfigured
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Helper to provide a clear error when Supabase is not configured
export function getSupabase() {
  if (!supabase) {
    console.warn("Supabase não está configurado. O VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam ser definidos no painel de Segredos/Settings.");
  }
  return supabase;
}
