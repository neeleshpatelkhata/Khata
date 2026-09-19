# Khata Ledger Enterprise

An enterprise ledger app: React/Vite web + Capacitor Android frontend, Express/SQLite backend.

The frontend and backend are two independently deployable projects, each with its own `package.json`:

- **[frontend/](frontend/)** — React/Vite web app and the Capacitor Android project. Deploys as a static site (Vercel/Netlify/etc.) and talks to the backend over HTTP via `VITE_API_BASE_URL`.
- **[backend/](backend/)** — Express API (auth, ledger, AI assist via Gemini, sync, backups). Deploys as a standalone API service (e.g. Render) with its own `backend/.env`.

## Local development

```
npm run install:all      # installs both frontend/ and backend/ dependencies
npm run dev:backend      # starts the API on http://localhost:8080
npm run dev:frontend     # starts the Vite dev server on http://localhost:5173
```

Copy `backend/.env.example` to `backend/.env` and fill in real values before starting the backend. See each folder's own instructions for build/release/deploy details.
