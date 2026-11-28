# Cox's Bazar City College BNCC Platoon Portal

Official web portal for **Cox's Bazar City College BNCC Platoon** (Army Wing, 15 BNCC Battalion, Karnaphuli Regiment, E Company), featuring bilingual CMS, online cadet enrollment, admit card generation, QR attendance/verification, examination portal, internal messenger, and media management.

## Architecture Overview

- **Frontend (`src/`)**: React 19 + TypeScript + Tailwind CSS + Vite + React Router (`BrowserRouter` with dynamic `basename`) + Firebase Web SDK (Auth + Cloud Firestore `cbcc-bncc-portal-db`).
- **Backend (`server.ts`)**: Node.js + Express 5 API handling:
  - Server-side credential/QR-token/HMAC session authentication (`bncc_sid` cookie + `Bearer` token fallback for cross-origin static hosts)
  - Firebase ID token verification (RS256 against `securetoken@system.gserviceaccount.com`)
  - Sealed AES-256-GCM exam answer keys & server-side grading
  - Authenticated private/public media vault & CMS sync APIs
  - Server-side Gemini AI proxy (`/api/gemini/*`)

## Hosting Modes

### 1. Unified Full-Stack Hosting (Render, Railway, Cloud Run, Fly.io, VPS)
The Express server serves both `/api/*` and the compiled Vite SPA (`dist/`).

```bash
npm install
npm run build
NODE_ENV=production npm start
```

### 2. Split Static Frontend + External Node/Express Backend
Host the static `dist/` folder on **GitHub Pages**, **Netlify**, **Vercel**, or **Cloudflare Pages**, while running `server.ts` on **Render**, **Railway**, **Fly.io**, **Cloud Run**, or a **VPS**.

1. Deploy `server.ts` first (Node 20+):
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Set environment variables: `NODE_ENV=production`, `SESSION_SECRET`, `EXAM_KEY_SECRET`, `ADMIN_LOGIN_PASSWORD`, `GEMINI_API_KEY`, `FIREBASE_PROJECT_ID=gen-lang-client-0584243831`, `ALLOWED_ORIGINS=https://your-frontend-domain.example`, and mount persistent storage at `DATA_DIR` and `MEDIA_DIR` (if persistent disk is unavailable, the server falls back safely to `/tmp`, while authenticated media uploads automatically fall back to Firebase Storage).
2. Build the static frontend with:
   - `VITE_API_BASE_URL=https://your-backend-api.example`
   - `VITE_BASE_PATH=/` (or `/<repo-name>/` for GitHub Pages project sites; `dist/404.html` embeds the matching segment count automatically)
   - `npm run build:client`
3. Add the frontend domain (e.g. `username.github.io`, `your-site.netlify.app`, `your-site.vercel.app`, `your-site.pages.dev`) to **Firebase Console → Authentication → Settings → Authorized domains**.

## Environment Variables

See `.env.example` for the full list of frontend (`VITE_*`) and backend variables. Never place secrets (`ADMIN_LOGIN_PASSWORD`, `SESSION_SECRET`, `EXAM_KEY_SECRET`, `GEMINI_API_KEY`) in `VITE_*` variables.

## Deployment Guides

- **GitHub Pages**: Uses `.github/workflows/deploy-pages.yml`. Set `VITE_API_BASE_URL` in repository Variables (and optionally `VITE_BASE_PATH`; otherwise `/` is chosen for `<username>.github.io` / `CNAME` or `/<repo-name>/` for project sites). `dist/404.html` + `index.html` query decoder preserve client routes.
- **Netlify**: Uses `netlify.toml` (`npm run build:client`, publish `dist/`, SPA rewrite, security headers). Set `VITE_API_BASE_URL` in Netlify Environment Variables.
- **Vercel**: Uses `vercel.json` (`npm run build:client`, output `dist/`, SPA rewrite, security headers). Set `VITE_API_BASE_URL` in Vercel Project Settings.
- **Cloudflare Pages**: Uses `public/_redirects` (`/* /index.html 200`). Set Build Command `npm run build:client`, Build Output `dist`, and `VITE_API_BASE_URL`.
- **Node Backend (`server.ts`)**: Uses `render.yaml` (Render Blueprint with persistent `/var/data` disk) or `Dockerfile` (Cloud Run, Railway, Fly.io, VPS).

## Useful Commands

- `npm run dev` — Start development server on port `3000`
- `npm run lint` — TypeScript typecheck
- `npm run lint:rules` — Validate Firestore security rules
- `npm run build` — Build both client (`dist/`) and Node server (`dist/server.cjs`)
- `npm run build:client` — Build static frontend bundle (`dist/`) only
