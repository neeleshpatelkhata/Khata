const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'khata_ledger.db');
const db = new sqlite3.Database(dbPath);

console.log('\n================ Local SQLite Database Query ================');

db.serialize(() => {
  db.all('SELECT id, name, type, phone, current_balance FROM parties', (err, rows) => {
    console.log('\n🏢 ALL PARTIES IN DATABASE:');
    console.table(rows || []);
  });

  db.all('SELECT id, party_id, amount, type, description, date FROM transactions', (err, rows) => {
    console.log('\n💰 ALL TRANSACTIONS IN DATABASE:');
    console.table(rows || []);
  });
});

db.close(() => {
  console.log('=============================================================\n');
});
