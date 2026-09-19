require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema, migrateSchema } = require('./src/database/db');
const apiRoutes = require('./src/routes/api');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
// Receipt photos and voice-note recordings are sent as base64 JSON bodies —
// the 100kb default is too small for either, so it's raised here.
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve API routes
app.use('/api/v1', apiRoutes);

// This service is API-only now — the frontend is a separately hosted static
// site (see frontend/), not built/served from here.
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Khata API</title></head>
      <body style="background:#090B10; color:#06B6D4; font-family:sans-serif; text-align:center; padding:5rem;">
        <h1>Khata Ledger API Server Running on Port ${PORT}</h1>
        <p style="color:#FFF">This is the API only. The frontend is hosted separately.</p>
      </body>
    </html>
  `);
});

// Error handling
app.use(errorHandler);

// Initialize DB and start server
initSchema().then(async () => {
  await migrateSchema();
  console.log('Database schema migration completed successfully.');

  const skipSeed = process.env.SKIP_SEED === 'true' || process.env.DB_PROVIDER === 'supabase';

  if (!skipSeed) {
    // Seed default admin user & demo data if empty on local SQLite only
    const { run, get } = require('./src/database/db');
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');

    const existingUser = await get('SELECT * FROM users LIMIT 1');
    if (!existingUser) {
      console.log('Seeding initial demo data...');
      const userId = uuidv4();
      const hash = await bcrypt.hash('admin123', 10);
      await run('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)', [
        userId, 'demo@khata.pro', hash, 'Enterprise Lead Accountant', 'ADMIN'
      ]);

      const wsId = uuidv4();
      await run('INSERT INTO workspaces (id, user_id, name, currency) VALUES (?, ?, ?, ?)', [
        wsId, userId, 'Global Trading Enterprise Ledger', 'INR'
      ]);

      console.log('Demo seed completed!');
    }
  } else {
    console.log('Clean database mode active (SKIP_SEED=true). No mock data generated.');
  }

  const startServer = (portToTry) => {
    const server = app.listen(portToTry, () => {
      console.log(`\n=================================================================`);
      console.log(`🚀 Khata Ledger Enterprise Full-Stack Server is LIVE!`);
      console.log(`👉 Access on Laptop: http://localhost:${portToTry}`);
      console.log(`=================================================================\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${portToTry} is occupied, trying port ${portToTry + 1}...`);
        startServer(portToTry + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  };

  startServer(Number(PORT));
}).catch(err => {
  console.error('Failed to initialize database schema:', err);
});
