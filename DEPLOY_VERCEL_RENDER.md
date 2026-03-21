# Deploy Guide (Vercel + Render)

## 1) Push source to GitHub
1. Create a GitHub repository.
2. Push this project to that repository.

## 2) Deploy backend on Render
1. In Render, create a new Web Service from your GitHub repo.
2. Use settings:
   - Build Command: `npm install`
   - Start Command: `npm run server`
   - Health Check Path: `/api/health`
3. Add environment variables:
   - `PORT=3001`
   - `FRONTEND_URL=https://your-vercel-project.vercel.app`
   - `JWT_SECRET=<long-random-secret>`
   - `DB_PATH=/opt/render/project/src/server/camap.db`
4. Deploy and copy backend URL, for example:
   - `https://your-render-service.onrender.com`

## 3) Deploy frontend on Vercel
1. In Vercel, import the same GitHub repo.
2. Framework: Vite (auto-detected).
3. Add environment variable:
   - `VITE_API_URL=https://your-render-service.onrender.com/api`
4. Deploy and copy frontend URL, for example:
   - `https://your-vercel-project.vercel.app`

## 4) Update CORS and redeploy backend
1. Go back to Render service environment variables.
2. Set `FRONTEND_URL` to your real Vercel URL.
3. Redeploy Render service.

## 5) Verify production
1. Open backend health URL:
   - `https://your-render-service.onrender.com/api/health`
2. Open frontend URL and test:
   - register/login
   - list comics
   - open chapter reader

## Notes
- Free Render may sleep when idle, first request can be slow.
- SQLite file on free hosting may be reset on some restarts/redeploys.
- For persistent production data, migrate to managed Postgres (Neon/Supabase).
