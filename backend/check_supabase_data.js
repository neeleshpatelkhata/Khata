const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.SUPABASE_DB_URL;

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function inspectData() {
  if (!connectionString) {
    console.error('SUPABASE_DB_URL is not set in backend/.env — nothing to inspect.');
    return;
  }
  try {
    await client.connect();
    console.log('📊 Connecting to Supabase database...');

    const tables = ['users', 'workspaces', 'parties', 'transactions', 'attachments', 'user_preferences'];

    console.log('\n================ Live Supabase Database Summary ================');
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) FROM public.${table}`);
        const count = res.rows[0].count;
        console.log(`  🔹 ${table.padEnd(20)} : ${count} record(s)`);
      } catch (err) {
        console.log(`  ⚠️ ${table.padEnd(20)} : Table not created yet`);
      }
    }
    console.log('=================================================================\n');

  } catch (err) {
    console.error('❌ Connection error:', err.message);
  } finally {
    await client.end();
  }
}

inspectData();
