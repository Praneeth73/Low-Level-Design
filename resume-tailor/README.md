# Resume Tailor

An AI agent that tailors your resume to a specific job. Upload your resume, paste a link to the job
posting, and download a rewritten resume (PDF or DOCX) that mirrors the job's language and puts your
most relevant experience first, without inventing anything you haven't done.

## What it does

1. **Reads your resume**: PDF, DOCX, TXT or Markdown.
2. **Fetches the job description** from the link you give it (or you can paste the text).
3. **Tailors the resume with Claude**: rewrites the summary, reorders skills, sharpens bullets and
   matches keywords. It is told to stay truthful, so job keywords you have no evidence for are listed
   as gaps instead of being added.
4. **Shows a match report**: fit score before and after, matched keywords, gaps, what changed, and
   suggestions.
5. **Lets you edit and download**: click any text in the preview to change it, then download a PDF or
   DOCX.

## Quick start

```bash
cd resume-tailor
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export ANTHROPIC_API_KEY=sk-ant-...      # https://console.anthropic.com/
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000.

Optional: set `RESUME_TAILOR_MODEL` to use a different Claude model (default `claude-opus-5-5`).

## Project layout

```
resume-tailor/
├── app/
│   ├── main.py      # FastAPI routes: /api/tailor, /api/export/{pdf|docx}, serves the UI
│   ├── tailor.py    # The agent: prompt + structured Claude call
│   ├── extract.py   # Resume text extraction + job-page fetching (with SSRF guard)
│   ├── export.py    # Renders the resume to DOCX (python-docx) and PDF (reportlab)
│   └── models.py    # Pydantic schema for the resume and match analysis
├── static/          # UI: index.html, styles.css, app.js (no build step)
└── requirements.txt
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/api/tailor` | multipart: `resume` (file), `job_url` or `job_text`, optional `instructions` | `{ resume, analysis }` JSON |
| `POST` | `/api/export/pdf` | `Resume` JSON | PDF file |
| `POST` | `/api/export/docx` | `Resume` JSON | DOCX file |

## Notes

- **Job links:** most career pages (Greenhouse, Lever, Ashby, company sites) work. LinkedIn, Indeed and
  some Workday pages block bots or need JavaScript. If a link fails, use **Paste text**.
- **Scanned PDFs** have no text layer. Upload a DOCX or text version instead.
- Your resume is sent to the Anthropic API for processing. Nothing is stored on the server.
