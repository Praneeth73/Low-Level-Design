"""The tailoring agent: one structured Claude call that rewrites the resume for a job."""
import os

import anthropic

from .models import TailorResult

MODEL = os.environ.get("RESUME_TAILOR_MODEL", "claude-opus-5-5")

SYSTEM_PROMPT = """You are an expert technical recruiter and resume writer. You tailor a candidate's \
resume to a specific job posting so it passes ATS keyword screens and reads well to a hiring manager.

Rules:
- Stay truthful. Use only facts present in the original resume. Never invent employers, titles, \
dates, degrees, certifications, metrics or technologies. You may rephrase, reorder, merge, trim and \
emphasise what is already there, and surface skills that are clearly implied by the described work.
- Mirror the job posting's terminology where the candidate genuinely has that experience \
(e.g. "CI/CD" vs "build pipelines").
- Rewrite the summary for this specific role, 2-4 sentences.
- Reorder skill groups and skills so the most job-relevant come first; drop irrelevant noise.
- Rewrite experience bullets to lead with strong action verbs and outcomes; keep existing numbers \
exactly as given. Put the most relevant bullets first; 3-6 bullets per recent role is a good target.
- Keep every job in the experience section (you may shorten old/irrelevant roles), in reverse \
chronological order, with the original dates.
- Include projects only if present in the original resume.
- Keywords the job wants but the resume has no evidence for go in analysis.missing_keywords and \
must NOT be added to the resume.
- Use empty strings/lists or null for anything the original resume does not contain."""


class TailorError(Exception):
    pass


def tailor_resume(resume_text: str, job_description: str, extra_instructions: str = "") -> TailorResult:
    client = anthropic.Anthropic()

    user_content = (
        f"<original_resume>\n{resume_text}\n</original_resume>\n\n"
        f"<job_description>\n{job_description}\n</job_description>\n\n"
    )
    if extra_instructions.strip():
        user_content += f"<candidate_preferences>\n{extra_instructions.strip()}\n</candidate_preferences>\n\n"
    user_content += "Tailor the resume to this job and return the tailored resume plus the match analysis."

    try:
        response = client.beta.messages.parse(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
            output_config={"effort": "high"},
            output_format=TailorResult,
            # If a safety classifier declines, let the API retry on its recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError:
        raise TailorError("Anthropic API key is invalid. Check ANTHROPIC_API_KEY and restart.")
    except TypeError as e:
        # Raised by the SDK before sending when no credentials are configured.
        if "authentication" not in str(e):
            raise
        raise TailorError("No Anthropic credentials found. Set ANTHROPIC_API_KEY and restart the server.")
    except anthropic.RateLimitError:
        raise TailorError("Rate limited by the Anthropic API. Wait a moment and try again.")
    except anthropic.APIStatusError as e:
        raise TailorError(f"Anthropic API error ({e.status_code}): {e.message}")
    except anthropic.APIConnectionError:
        raise TailorError("Could not reach the Anthropic API. Check your network connection.")

    if response.stop_reason == "refusal":
        raise TailorError("The model declined this request.")
    if response.stop_reason == "max_tokens":
        raise TailorError("The tailored resume was too long and got cut off. Try a shorter resume.")
    if response.parsed_output is None:
        raise TailorError("The model returned an unexpected response. Please try again.")
    return response.parsed_output
