# Medicronis Demo — PDF → SSR Sales Reporting

Pharma distributor sales report automation. Upload PDFs, match products, review exceptions, generate SSR Excel reports.

## Local Dev

### Option A — Docker (macOS / Linux / Windows with Docker Desktop)

```bash
npm install && cp .env.example .env
docker compose up -d
npx prisma migrate dev && npx prisma db seed
npm run dev
```

### Option B — Existing local PostgreSQL (Windows)

If PostgreSQL is already installed on port 5432 (no Docker):

```powershell
npm install
copy .env.example .env
npm run db:setup-local
npm run dev
```

You will be prompted for your **postgres superuser password** (set during PostgreSQL install). The script creates user/database `medicronis` / `medicronis`, runs migrations, and seeds demo data.

Start PDF worker in a second terminal:

```bash
cd services/pdf-worker && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
```

Open [http://localhost:3000](http://localhost:3000) — password: **`demo`**

---

## Demo Login

| | |
|---|---|
| **URL** | `/login` |
| **Password** | `demo` (set via `DEMO_PASSWORD`) |

---

## Smoke Test Checklist

Use `samples/pdfs/` (generate with `python scripts/generate_sample_pdfs.py`).

- [ ] **1. Upload PDF** — Login → Upload → `pharmalink_jul2026.pdf` → see extracted rows
- [ ] **2. Review** (if needed) — Review Queue → approve/map exceptions
- [ ] **3. Approve** — Document detail → **Approve & Promote to Sales**
- [ ] **4. Generate SSR** — Reports → select batch → **Generate SSR**
- [ ] **5. Download Excel** — Report detail → **Download Excel** (.xlsx opens with SSR grid)

Quick path (no review): upload `medsupply_jul2026.pdf` → Approve → Generate → Download.

See [SMOKE_TEST.md](./SMOKE_TEST.md) for detailed steps.

---

## Deploy

### 1. Database — Neon or Supabase (free tier)

1. Create a PostgreSQL project
2. Copy connection string → `DATABASE_URL`
3. Run migrations from local machine:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx prisma db seed
```

### 2. PDF Worker — Railway or Render

Deploy `services/pdf-worker/`:

- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Python 3.11+**
- Copy public URL → `PDF_WORKER_URL`

### 3. Web App — Vercel

1. Import repo on Vercel
2. **Root Directory:** `apps/web`
3. **Environment variables:**

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://user:pass@ep-....neon.tech/medicronis?sslmode=require` |
| `DEMO_PASSWORD` | your trial password |
| `PDF_WORKER_URL` | `https://your-worker.railway.app` |
| `UPLOAD_DIR` | `/tmp/medicronis-uploads` (optional — auto on Vercel) |

4. Deploy — `vercel.json` runs `prisma generate` from monorepo root

### File uploads on Vercel

Vercel serverless filesystem is **read-only** except `/tmp`. The app auto-uses `/tmp/medicronis-uploads` when `VERCEL=1`.

**Trial demo note:** Files in `/tmp` are ephemeral (lost on cold start). For persistent storage, add Vercel Blob or S3 post-demo.

---

## Known Demo Limitations

- **3 PDF templates** (DIST-001, DIST-002, generic) — not all 48 distributors
- **OCR optional** — scanned PDFs may fail without Tesseract on worker
- **No email, audit trail, or ERP modules**
- **Single shared password** — not multi-user RBAC
- **Synchronous processing** — no Redis/queue
- **Vercel `/tmp` storage** — files don't persist across cold starts

---

## Sample PDFs

```bash
pip install reportlab pdfplumber
python scripts/generate_sample_pdfs.py
```

---

## Useful Commands

```bash
npm run dev              # Web app :3000
npm run db:studio        # Prisma Studio
docker compose up -d     # Local Postgres
```
