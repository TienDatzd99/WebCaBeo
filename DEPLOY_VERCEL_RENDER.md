# Deploy Guide (Vercel + Railway/Render)

## 1) Push source to GitHub
1. Create a GitHub repository.
2. Push this project to that repository.

## 2) Deploy backend on Railway (or Render)
1. In Railway/Render, create a new Web Service from your GitHub repo.
2. Use settings:
   - Build Command: `npm install`
   - Start Command: `npm run server`
   - Health Check Path: `/api/health`
3. Add a Persistent Disk/Volume (important):
   - Name: `sqlite-data` (any name)
   - Mount Path: `/var/data`
   - Size: 1 GB (or more)
4. Add environment variables:
   - `PORT=3001`
   - `FRONTEND_URL=https://your-vercel-project.vercel.app`
   - `JWT_SECRET=<long-random-secret>`
   - `DB_PATH=/var/data/camap.db`
   - `SERVE_FRONTEND=false` (API-only mode to reduce egress)
5. Deploy and copy backend URL, for example:
   - `https://your-backend.up.railway.app`

## 3) Deploy frontend on Vercel
1. In Vercel, import the same GitHub repo.
2. Framework: Vite (auto-detected).
3. Add environment variable:
   - `VITE_API_URL=https://your-backend.up.railway.app/api`
4. Deploy and copy frontend URL, for example:
   - `https://your-vercel-project.vercel.app`

## 4) Update CORS and redeploy backend
1. Go back to backend service environment variables.
2. Set `FRONTEND_URL` to your real Vercel URL.
3. Redeploy Render service.

## 5) Verify production
1. Open backend health URL:
   - `https://your-backend.up.railway.app/api/health`
2. Open frontend URL and test:
   - register/login
   - list comics
   - open chapter reader

## Notes
- Railway/Render may sleep when idle on free-tier, first request can be slow.
- If SQLite is not on a Persistent Disk, data can be lost after redeploy/restart.
- For persistent production data, migrate to managed Postgres (Neon/Supabase).

## Cost optimization checklist
- Frontend runs on Vercel/Netlify/Cloudflare Pages (free static egress).
- Backend runs API-only (`SERVE_FRONTEND=false`) on Railway/Render.
- Keep images on object storage (Cloudinary, R2, Firebase Storage), and store only URLs in DB.
