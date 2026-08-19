// ==============================================================================
// SUPABASE SERVER ADMIN CLIENT (Strictly Server-Side)
// ==============================================================================
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nsvcphlhezykbbducxip.supabase.co';

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
