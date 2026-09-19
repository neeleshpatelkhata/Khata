const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../khata_ledger.db');
const uploadsDir = path.join(__dirname, '../../uploads');
const backupsDir = path.join(__dirname, '../../backups');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to local SQLite database at:', dbPath);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

function initSchema() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'ACCOUNTANT',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Workspaces table
      db.run(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'INR',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Parties (Customers / Suppliers)
      db.run(`
        CREATE TABLE IF NOT EXISTS parties (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          type TEXT NOT NULL DEFAULT 'CUSTOMER',
          address TEXT,
          opening_balance REAL DEFAULT 0,
          current_balance REAL DEFAULT 0,
          version INTEGER DEFAULT 1,
          is_deleted INTEGER DEFAULT 0,
          deleted_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `);

      // Transactions (Gave / Got)
      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          party_id TEXT NOT NULL,
          -- 'GAVE': party owes you more (receivable). 'GOT': party owes you less.
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          base_amount REAL DEFAULT 0,
          gst_amount REAL DEFAULT 0,
          payment_mode TEXT DEFAULT 'CASH',
          category TEXT DEFAULT 'GENERAL',
          notes TEXT,
          date DATETIME NOT NULL,
          version INTEGER DEFAULT 1,
          sync_status TEXT DEFAULT 'SYNCHRONIZED',
          is_deleted INTEGER DEFAULT 0,
          deleted_at DATETIME,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
        )
      `);

      // Attachments table
      db.run(`
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
        )
      `);

      // Sync Logs
      db.run(`
        CREATE TABLE IF NOT EXISTS sync_logs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          items_count INTEGER NOT NULL,
          conflicts_resolved INTEGER DEFAULT 0,
          status TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Backups telemetry
      db.run(`
        CREATE TABLE IF NOT EXISTS backups (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          type TEXT NOT NULL, -- 'AUTOMATED' | 'MANUAL'
          status TEXT NOT NULL, -- 'SUCCESS' | 'FAILED'
          checksum TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // User Snapshots Backups Table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_backups (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          backup_name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'MANUAL',
          data_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

/**
 * Bring an existing database up to the current schema.
 *
 * `CREATE TABLE IF NOT EXISTS` is a no-op once a table exists, so columns added
 * after the first release have to be applied with ALTER TABLE. SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, so a duplicate-column error means the migration
 * already ran and is safely ignored.
 */
async function migrateSchema() {
  const columnAdditions = [
    ['parties', 'is_deleted', 'INTEGER DEFAULT 0'],
    ['parties', 'deleted_at', 'DATETIME'],
    ['transactions', 'base_amount', 'REAL DEFAULT 0'],
    ['transactions', 'gst_amount', 'REAL DEFAULT 0'],
    ['transactions', 'is_deleted', 'INTEGER DEFAULT 0'],
    ['transactions', 'deleted_at', 'DATETIME'],
    ['transactions', 'updated_at', 'DATETIME']
  ];

  for (const [table, column, definition] of columnAdditions) {
    try {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`Migration applied: ${table}.${column}`);
    } catch (err) {
      if (!/duplicate column name/i.test(err.message)) {
        console.error(`Migration failed for ${table}.${column}:`, err.message);
      }
    }
  }

  // Indexes that matter once a workspace has a few thousand entries.
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_tx_workspace_date ON transactions(workspace_id, date DESC)',
    'CREATE INDEX IF NOT EXISTS idx_tx_party ON transactions(party_id)',
    'CREATE INDEX IF NOT EXISTS idx_parties_workspace ON parties(workspace_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'
  ];

  for (const sql of indexes) {
    try {
      await run(sql);
    } catch (err) {
      console.error('Index creation failed:', err.message);
    }
  }
}

// Database helper promises
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initSchema,
  migrateSchema,
  run,
  get,
  all,
  dbPath,
  uploadsDir,
  backupsDir
};
