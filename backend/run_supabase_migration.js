const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('SUPABASE_DB_URL is not set in backend/.env — nothing to migrate.');
  process.exit(1);
}

console.log('🔌 Connecting to Supabase PostgreSQL database at:');
console.log(connectionString.replace(/(:[^:@]+@)/, ':****@'));

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL server successfully!');

    const sqlPath = path.join(__dirname, 'supabase_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚡ Executing database migration script (supabase_schema.sql)...');
    await client.query(sqlContent);
    console.log('🎉 All tables, indexes, extensions, and RLS policies created successfully on Supabase!');

    // Query list of created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📋 Created Tables in Supabase Database:');
    res.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
  } finally {
    await client.end();
  }
}

runMigration();
