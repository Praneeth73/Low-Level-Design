from typing import List, Optional

from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    website: Optional[str] = None


class ExperienceItem(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    bullets: List[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str
    description: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)
    bullets: List[str] = Field(default_factory=list)


class EducationItem(BaseModel):
    degree: str
    institution: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    details: Optional[str] = None


class SkillGroup(BaseModel):
    category: str
    skills: List[str]


class Resume(BaseModel):
    name: str
    headline: Optional[str] = None
    contact: ContactInfo
    summary: str
    skills: List[SkillGroup] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)


class MatchAnalysis(BaseModel):
    job_title: str
    company: Optional[str] = None
    match_score_before: int = Field(description="0-100 fit of the ORIGINAL resume to the job")
    match_score_after: int = Field(description="0-100 fit of the TAILORED resume to the job")
    matched_keywords: List[str]
    missing_keywords: List[str] = Field(
        description="Important job keywords the candidate has no evidence for; NOT added to the resume"
    )
    changes_made: List[str]
    suggestions: List[str] = Field(description="Honest advice for the candidate to close remaining gaps")


class TailorResult(BaseModel):
    resume: Resume
    analysis: MatchAnalysis
