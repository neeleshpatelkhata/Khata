const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const dbUrl = process.env.SUPABASE_DB_URL;
const dbProvider = process.env.DB_PROVIDER || 'sqlite';

console.log(`[Database Config] Active DB Provider: ${dbProvider.toUpperCase()}`);

const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  !supabaseUrl.includes('your-project-id') && 
  supabaseAnonKey && 
  !supabaseAnonKey.includes('your-supabase-anon-key')
);

let supabaseClient = null;

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log(`[Supabase] Successfully initialized Supabase Client for: ${supabaseUrl}`);
  } catch (err) {
    console.error(`[Supabase] Failed to initialize client: ${err.message}`);
  }
}

module.exports = {
  dbProvider,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceKey,
  dbUrl,
  isSupabaseConfigured,
  supabaseClient
};
