const { supabaseClient, isSupabaseConfigured, supabaseUrl } = require('./src/config/supabase');

console.log('Testing Supabase Client connection...');
console.log('Configured URL:', supabaseUrl);
console.log('Is Configured:', isSupabaseConfigured);

if (supabaseClient) {
  supabaseClient.from('users').select('*').limit(1).then(res => {
    console.log('Supabase JS API Test Response:', res);
    process.exit(0);
  }).catch(err => {
    console.error('Supabase Error:', err);
    process.exit(1);
  });
} else {
  console.log('Supabase client is null.');
  process.exit(0);
}
