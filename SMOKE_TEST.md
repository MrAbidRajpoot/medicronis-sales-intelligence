# Medicronis Smoke Test

Run after local setup or deploy. Password: `demo`.

## Checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login at `/login` | Dashboard loads |
| 2 | Upload `samples/pdfs/medsupply_jul2026.pdf` | Document detail shows 6 extracted rows |
| 3 | (Optional) Upload `pharmalink_jul2026.pdf` → Review Queue | Resolve exceptions |
| 4 | Document detail → **Approve & Promote to Sales** | Status → Approved |
| 5 | Reports → select batch → **Generate SSR** | Report detail page |
| 6 | **Download Excel** | `.xlsx` with SSR columns + totals |

## API Health

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/extract -F "file=@samples/pdfs/medsupply_jul2026.pdf"
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Upload fails | PDF worker not running on :8000 |
| DB errors | `npx prisma migrate deploy && npx prisma db seed` |
| Empty dashboard chart | Approve at least one document first |
| Vercel cold start | Re-upload PDF; `/tmp` is ephemeral |
