# Khata Ledger — Backend

Express API: auth, parties/transactions ledger, AI assist (Gemini — receipt OCR, NLP entry parsing, voice transcription), sync engine, backups. Persists to a local SQLite file (`khata_ledger.db`) regardless of `DB_PROVIDER`; Supabase/Postgres support (`src/config/supabase.js`) exists but isn't wired up yet.

## Setup

```
npm install
cp .env.example .env    # then fill in JWT_SECRET, GEMINI_API_KEY, etc.
npm start                # http://localhost:8080
```

## Deploying (e.g. Render)

- Root Directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Env vars: same keys as `.env.example` (`PORT`, `NODE_ENV`, `JWT_SECRET`, `SQLITE_DB_PATH`, `GEMINI_API_KEY`, ...)

Note: most hosts' filesystems are ephemeral — a plain `khata_ledger.db` file gets wiped on every redeploy/restart unless the host's data directory is backed by a persistent disk/volume.
