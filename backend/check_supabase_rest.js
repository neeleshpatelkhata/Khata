const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hobqauofjovwdttvqmpt.supabase.co';
const supabaseKey = 'sb_publishable_AJXZeXU61eRXm6ZlBkHb_g_R09JtQLe';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('\n================ Live Supabase Database Query ================');
  
  try {
    const { data: parties, error: pErr } = await supabase.from('parties').select('*').limit(10);
    if (pErr) console.log('⚠️ Parties:', pErr.message);
    else {
      console.log(`\n🏢 PARTIES (${parties.length} found):`);
      console.table(parties);
    }

    const { data: txs, error: tErr } = await supabase.from('transactions').select('*').limit(10);
    if (tErr) console.log('⚠️ Transactions:', tErr.message);
    else {
      console.log(`\n💰 TRANSACTIONS (${txs.length} found):`);
      console.table(txs);
    }

    const { data: users, error: uErr } = await supabase.from('users').select('*').limit(10);
    if (uErr) console.log('⚠️ Users:', uErr.message);
    else {
      console.log(`\n👤 USERS (${users.length} found):`);
      console.table(users);
    }

  } catch (err) {
    console.error('❌ Error checking database:', err.message);
  }
  console.log('===============================================================\n');
}

checkDatabase();
