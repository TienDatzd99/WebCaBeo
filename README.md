# CaBeoWeb

Fullstack comic web app:
- Frontend: React + Vite
- Backend: Express + better-sqlite3

## Local development

1. Install dependencies:
	- `npm install`
2. Start backend:
	- `npm run server`
3. Start frontend:
	- `npm run dev`

Frontend runs on `http://localhost:5173` and backend on `http://localhost:3001`.

## Production deployment (recommended)

Use:
- Vercel for frontend
- Render for backend

See full instructions in `DEPLOY_VERCEL_RENDER.md`.

## Environment variables

Use `.env.example` as reference for required variables in Vercel and Render.
