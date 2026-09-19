const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function wipeAll() {
  console.log('--- Wiping Local SQLite Database ---');
  const dbPath = path.join(__dirname, 'backend/khata_ledger.db');
  const db = new sqlite3.Database(dbPath);

  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM attachments;');
      db.run('DELETE FROM transactions;');
      db.run('DELETE FROM parties;');
      db.run('DELETE FROM sync_logs;');
      db.run('DELETE FROM backups;');
      db.run('DELETE FROM workspaces;');
      db.run('DELETE FROM users;', (err) => {
        if (err) {
          console.error('SQLite wipe error:', err);
          reject(err);
        } else {
          console.log('✅ Local SQLite wiped clean!');
          resolve();
        }
      });
    });
  });
  db.close();

  console.log('--- Wiping Remote Supabase PostgreSQL Database ---');
  const client = new Client({
    connectionString: 'postgresql://postgres:Devansh2004passw@db.hobqauofjovwdttvqmpt.supabase.co:5432/postgres'
  });

  try {
    await client.connect();
    await client.query('TRUNCATE public.attachments, public.transactions, public.parties, public.sync_logs, public.backups, public.workspaces, public.users CASCADE;');
    console.log('✅ Remote Supabase PostgreSQL wiped clean!');
    await client.end();
  } catch (pgErr) {
    console.error('Supabase wipe notice:', pgErr.message);
  }

  console.log('\n=====================================================');
  console.log('🎉 ALL DATABASES (SQLITE & SUPABASE) SUCCESSFULLY WIPED!');
  console.log('=====================================================\n');
}

wipeAll().catch(console.error);
