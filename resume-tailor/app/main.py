import re
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .export import to_docx, to_pdf
from .extract import ExtractionError, job_description_from_url, resume_to_text
from .models import Resume, TailorResult
from .tailor import TailorError, tailor_resume

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

app = FastAPI(title="Resume Tailor")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/tailor", response_model=TailorResult)
async def tailor(
    resume: UploadFile = File(...),
    job_url: str = Form(""),
    job_text: str = Form(""),
    instructions: str = Form(""),
):
    data = await resume.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Resume file is larger than 5 MB.")
    if not job_url.strip() and not job_text.strip():
        raise HTTPException(400, "Provide a job link or paste the job description.")

    try:
        resume_text = resume_to_text(resume.filename or "", data)
        if job_text.strip():
            jd = job_text.strip()
        else:
            jd = await run_in_threadpool(job_description_from_url, job_url.strip())
    except ExtractionError as e:
        raise HTTPException(422, str(e))

    try:
        return await run_in_threadpool(tailor_resume, resume_text, jd, instructions)
    except TailorError as e:
        raise HTTPException(502, str(e))


def _filename(r: Resume, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9]+", "_", r.name).strip("_") or "resume"
    return f"{base}_Resume.{ext}"


@app.post("/api/export/{fmt}")
def export(fmt: str, resume: Resume):
    if fmt == "docx":
        content = to_docx(resume)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif fmt == "pdf":
        content = to_pdf(resume)
        media = "application/pdf"
    else:
        raise HTTPException(404, "Unknown format")
    return Response(content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{_filename(resume, fmt)}"'})


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
