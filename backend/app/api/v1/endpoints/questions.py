import io
import re
import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID
from app.core.config import settings   # <-- add this line
import pdfplumber
from docx import Document as DocxDocument
from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()

QuestionType          = Literal["MCQ", "MSQ", "TRUE_FALSE", "SHORT_ANSWER", "LONG_ANSWER"]
Difficulty            = Literal["EASY", "MEDIUM", "HARD"]
ExtractedQuestionType = Literal["MCQ", "MSQ", "TRUE_FALSE"]


# ── Schemas ───────────────────────────────────────────────────────────────────

class OptionCreate(BaseModel):
    option_text: str
    is_correct: bool
    order_index: int

class TopicCreate(BaseModel):
    topic: str
    subject: Optional[str] = None
    chapter: Optional[str] = None

class QuestionCreate(BaseModel):
    course_id: Optional[UUID] = None
    question_type: QuestionType
    question_text: str
    marks: int
    negative_marks: int = 0
    difficulty: Difficulty
    options: Optional[List[OptionCreate]] = []
    topics: Optional[List[TopicCreate]] = []

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    marks: Optional[int] = None
    negative_marks: Optional[int] = None
    difficulty: Optional[Difficulty] = None
    is_active: Optional[bool] = None

class ExtractedOption(BaseModel):
    text: str
    is_correct: bool

class ExtractedQuestion(BaseModel):
    id: str
    question_text: str
    question_type: ExtractedQuestionType
    options: List[ExtractedOption]
    marks: int
    difficulty: Difficulty
    confidence: int
    needs_review: bool
    approved: bool = False


# ── CRUD Endpoints ────────────────────────────────────────────────────────────

@router.get("/")
async def list_questions(
    course_id: Optional[UUID] = None,
    question_type: Optional[QuestionType] = None,
    difficulty: Optional[Difficulty] = None,
    is_active: Optional[bool] = True,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    query = supabase.table("questions").select(
        "*, courses(name, code), question_options(*), question_topics(*)"
    )
    if course_id:
        query = query.eq("course_id", str(course_id))
    if question_type:
        query = query.eq("question_type", question_type)
    if difficulty:
        query = query.eq("difficulty", difficulty)
    if is_active is not None:
        query = query.eq("is_active", is_active)
    return query.execute().data


@router.get("/{question_id}")
async def get_question(question_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("questions")
        .select("*, courses(name, code), question_options(*), question_topics(*)")
        .eq("id", str(question_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found")
    return result.data


@router.post("/")
async def create_question(
    body: QuestionCreate,
    current_user: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    q_data = {
        "created_by": current_user["user_id"],
        "course_id": str(body.course_id) if body.course_id else None,
        "question_type": body.question_type,
        "question_text": body.question_text,
        "marks": body.marks,
        "negative_marks": body.negative_marks,
        "difficulty": body.difficulty,
        "is_active": True,
    }
    q_result = supabase.table("questions").insert(q_data).execute()
    qid = q_result.data[0]["id"]

    if body.options:
        supabase.table("question_options").insert([
            {
                "question_id": qid,
                "option_text": o.option_text,
                "is_correct": o.is_correct,
                "order_index": o.order_index,
            }
            for o in body.options
        ]).execute()

    if body.topics:
        supabase.table("question_topics").insert([
            {
                "question_id": qid,
                "topic": t.topic,
                "subject": t.subject,
                "chapter": t.chapter,
            }
            for t in body.topics
        ]).execute()

    return {"message": "Question created", "question_id": qid}


@router.patch("/{question_id}")
async def update_question(
    question_id: UUID,
    body: QuestionUpdate,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = supabase.table("questions").update(data).eq("id", str(question_id)).execute()
    return result.data[0]


@router.delete("/{question_id}")
async def soft_delete_question(question_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    supabase.table("questions").update({"is_active": False}).eq("id", str(question_id)).execute()
    return {"message": "Question deactivated"}


# ── Text Extraction ───────────────────────────────────────────────────────────

def _extract_pdf_text(content: bytes) -> str:
    """
    Extract full text from a text-based PDF using pdfplumber.
    layout=True preserves spatial ordering — critical so question numbers
    stay on their own lines (Google Forms PDF structure).
    """
    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text(layout=True) or ""
            text = text.strip()
            if text:
                parts.append(text)
    return "\n\n".join(parts)


def _extract_docx_text(content: bytes) -> str:
    doc = DocxDocument(io.BytesIO(content))
    parts: list[str] = []
    for para in doc.paragraphs:
        t = para.text.strip()
        if t:
            parts.append(t)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                t = cell.text.strip()
                if t:
                    parts.append(t)
    return "\n".join(parts)


# ── Regex Patterns ────────────────────────────────────────────────────────────

# Lines to discard from Google Forms PDFs
SKIP_LINE_RE = re.compile(
    r"(?i)^("
    r"mark\s+only\s+one\s+oval\.?"
    r"|mark\s+all\s+that\s+apply\.?"
    r"|required\s+question"
    r"|\*\s*indicates\s+required"
    r"|this\s+(form|content)\s+(doesn'?t|is\s+neither)"
    r"|this\s+content\s+is\s+neither"
    r"|google\s*\.?\s*forms?"
    r"|dear\s+students"
    r"|the\s+quiz\s+will\s+be\s+open"
    r"|start\s+time\s*:"
    r"|stop\s+time\s*:"
    r"|all\s+the\s+best"
    r"|roll\s+no\.?\s*\*?"
    r"|name\s*\*?"
    r"|email\s*\*?"
    r"|once\s+submit"
    r"|you\s+have\s+to\s+(be|wait)"
    r"|its?\s+responsibility"
    r"|there\s+will\s+be\s+no\s+make"
    r"|the\s+attendance\s+is\s+mandatory"
    r"|forms\s*$"
    r")\s*$",
)

# "4." or "4. 1 point" or "4. Some question text"
QUESTION_NUM_RE = re.compile(r"^[ \t]*(\d{1,3})\.\s*(.*)?$")

# Marks/points annotation anywhere in a line
MARKS_RE = re.compile(r"(?i)\b(\d+)\s*(?:points?|marks?)\b")

# True/False question hint
TRUE_FALSE_RE = re.compile(r"(?i)\btrue\s*/?\s*false\b")

# Standard A/B/C/D option label (for non-Google-Forms PDFs)
OPTION_LABEL_RE = re.compile(r"^[ \t]*[\(\[]?([A-Da-d])[\).\:\]][ \t]+(.+)$")

# Inline correct-answer markers (standard PDFs)
CORRECT_MARKER_RE = re.compile(
    r"(?i)[ \t]*(?:[*\u2713\u2714]+[ \t]*"
    r"|\(correct\)|\[correct\]"
    r"|\(ans(?:wer)?\)|\[ans(?:wer)?\])[ \t]*$"
)

# Answer key section header (standard PDFs)
ANSWER_KEY_HEADER_RE = re.compile(
    r"(?im)^[ \t]*(answer[\s_-]*key|answers?|solutions?|key)[ \t]*[:\-]?[ \t]*$"
)

# Single answer key entry: "1. B" / "2) A, C" / "3 - True"
ANSWER_KEY_ENTRY_RE = re.compile(
    r"(?im)^[ \t]*(\d{1,3})[ \t]*[.):\-][ \t]*"
    r"([A-Da-d](?:[ \t]*[,\/][ \t]*[A-Da-d])*|true|false)[ \t]*$"
)


# ── Format Detection ──────────────────────────────────────────────────────────

def _detect_format(text: str) -> str:
    """
    Returns 'google_forms' or 'standard'.
    Google Forms PDFs always contain 'mark only one oval' and related strings.
    """
    lower = text.lower()
    hits = sum(1 for phrase in [
        "mark only one oval",
        "mark all that apply",
        "this form doesn",
        "google forms",
        "indicates required question",
    ] if phrase in lower)
    return "google_forms" if hits >= 2 else "standard"


def _is_header_page(page_text: str) -> bool:
    """
    True if a page contains only quiz header/instructions and no question numbers.
    Used to skip the first 1-2 pages of Google Forms PDFs.
    """
    lines = [l.strip() for l in page_text.splitlines() if l.strip()]
    if any(QUESTION_NUM_RE.match(l) for l in lines):
        return False
    keywords = [
        "quiz", "dear students", "roll no", "name", "email",
        "start time", "stop time", "all the best", "open only for",
        "auto-submission", "10 mins",
    ]
    hits = sum(1 for kw in keywords if any(kw in l.lower() for l in lines))
    return hits >= 3


# ── Google Forms Parser ───────────────────────────────────────────────────────

def _parse_google_forms(full_text: str) -> list[dict]:
    """
    Parse Google Forms PDF structure:
      - Skip header pages
      - Discard noise lines (Mark only one oval, etc.)
      - Question number may be alone on its line ("4.")
        with question text on the NEXT line
      - Options are plain text lines with NO A/B/C/D labels
      - "1 point" annotations stripped from question numbers

    Returns list of raw question dicts (no correct answers yet).
    """
    # Skip header-only pages
    pages = full_text.split("\n\n")
    content_lines: list[str] = []
    for page in pages:
        if _is_header_page(page):
            logger.debug("Skipping header page")
        else:
            content_lines.extend(page.splitlines())

    # Strip noise lines
    cleaned: list[str] = []
    for raw in content_lines:
        line = raw.strip()
        if line and not SKIP_LINE_RE.match(line):
            cleaned.append(line)

    questions: list[dict] = []
    current: dict | None = None
    awaiting_question_text = False  # True when number was alone on its line

    for line in cleaned:
        m = QUESTION_NUM_RE.match(line)
        if m:
            # Save previous question before starting a new one
            if current and current.get("question_text"):
                questions.append(current)

            number = int(m.group(1))
            rest   = (m.group(2) or "").strip()

            # Extract marks from rest ("1 point" -> marks=1, rest="")
            marks = 1
            mm = MARKS_RE.search(rest)
            if mm:
                marks = int(mm.group(1))
                rest  = MARKS_RE.sub("", rest).strip()

            current = {
                "number":       number,
                "question_text": rest,   # empty when number is alone on its line
                "options":      [],
                "marks":        marks,
                "has_correct":  False,
                "ai_answered":  False,
            }
            awaiting_question_text = not bool(rest)
            continue

        if current is None:
            continue  # before first question (title page lines)

        # If we haven't got question text yet, this line IS the question
        if awaiting_question_text and not current["question_text"]:
            current["question_text"] = MARKS_RE.sub("", line).strip()
            awaiting_question_text = False
            continue

        # Every subsequent non-empty, non-skipped line is an option
        opt_text = MARKS_RE.sub("", line).strip()
        if opt_text:
            current["options"].append({
                "text":       opt_text,
                "is_correct": False,
            })

    # Don't forget the last question
    if current and current.get("question_text"):
        questions.append(current)

    logger.info("Google Forms parser found %d questions", len(questions))
    return questions


# ── Standard MCQ Parser ───────────────────────────────────────────────────────

def _parse_standard(full_text: str) -> list[dict]:
    """
    Parse standard MCQ PDF with A/B/C/D option labels.
    Handles inline correct markers (*) and trailing Answer Key sections.
    """
    # Strip answer key section first
    answer_key: dict[int, list[str]] = {}
    hm = ANSWER_KEY_HEADER_RE.search(full_text)
    if hm:
        key_section = full_text[hm.end():]
        full_text   = full_text[: hm.start()]
        for entry in ANSWER_KEY_ENTRY_RE.finditer(key_section):
            q_num = int(entry.group(1))
            raw   = entry.group(2).strip().lower()
            if raw in ("true", "false"):
                answer_key[q_num] = [raw.upper()]
            else:
                answer_key[q_num] = [
                    p.strip().upper()
                    for p in re.split(r"[,\/]", raw) if p.strip()
                ]

    # Split on question numbers
    q_start_re = re.compile(r"(?m)^[ \t]*(\d{1,3})[.):\]]\s+")
    starts = list(q_start_re.finditer(full_text))

    questions: list[dict] = []
    for i, m in enumerate(starts):
        number    = int(m.group(1))
        block_end = starts[i + 1].start() if i + 1 < len(starts) else len(full_text)
        block     = full_text[m.end(): block_end]

        lines    = [l.strip() for l in block.splitlines() if l.strip()]
        opts: list[dict] = []
        q_lines: list[str] = []
        seen_opt = False

        for ln in lines:
            lm = OPTION_LABEL_RE.match(ln)
            if lm:
                seen_opt = True
                letter   = lm.group(1).upper()
                opt_text = lm.group(2).strip()
                is_corr  = bool(CORRECT_MARKER_RE.search(opt_text))
                opt_text = CORRECT_MARKER_RE.sub("", opt_text).strip()
                opts.append({"letter": letter, "text": opt_text, "is_correct": is_corr})
            elif not seen_opt:
                clean = MARKS_RE.sub("", ln).strip()
                if clean:
                    q_lines.append(clean)

        q_text = " ".join(q_lines).strip()
        if not q_text or len(opts) < 2:
            continue

        marks = 1
        mm = MARKS_RE.search(block)
        if mm:
            try: marks = int(mm.group(1))
            except: pass

        # Apply answer key (overrides inline markers)
        key = answer_key.get(number)
        if key and key not in (["TRUE"], ["FALSE"]):
            for opt in opts:
                opt["is_correct"] = opt.get("letter") in key

        has_correct = any(o["is_correct"] for o in opts)

        questions.append({
            "number":       number,
            "question_text": q_text,
            "options":      opts,
            "marks":        marks,
            "has_correct":  has_correct,
            "ai_answered":  False,
        })

    logger.info("Standard parser found %d questions", len(questions))
    return questions


# ── Groq AI Answer Inference ──────────────────────────────────────────────────


import requests

def _infer_answers_with_groq(raw_questions: list[dict]) -> list[dict]:
    api_key = settings.GROQ_API_KEY.strip()
    if not api_key:
        logger.warning("GROQ_API_KEY not set — skipping AI answer inference")
        return raw_questions

    lines: list[str] = []
    for i, q in enumerate(raw_questions):
        opts_str = " | ".join(
            f"[{j}] {o['text']}" for j, o in enumerate(q["options"])
        )
        lines.append(f"Q{i}: {q['question_text']} OPTIONS: {opts_str}")

    questions_block = "\n".join(lines)

    system_prompt = (
        "You are an expert academic tutor. "
        "Given multiple-choice questions, identify the correct answer(s) for each. "
        "Reply ONLY with a JSON array — no prose, no markdown fences. "
        "Format: [{\"q\":0,\"correct\":[2]},{\"q\":1,\"correct\":[0]}, ...] "
        "where numbers are 0-based indices. "
        "Always include one correct index per question. "
        "Use multiple indices only when the question explicitly says 'select all that apply'."
    )

    payload = {
        "model":       "llama-3.1-8b-instant",
        "temperature": 0,
        "max_tokens":  1024,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Answer these {len(raw_questions)} questions:\n\n"
                    f"{questions_block}\n\n"
                    "JSON array only:"
                ),
            },
        ],
    }

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
                "User-Agent":    "Mozilla/5.0 (compatible; ExamPortal/1.0)",
            },
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()

        raw_json = body["choices"][0]["message"]["content"].strip()
        if raw_json.startswith("```"):
            raw_json = re.sub(r"```[a-z]*\n?", "", raw_json).strip().rstrip("`").strip()

        answers: list[dict] = json.loads(raw_json)

        for ans in answers:
            q_idx   = ans.get("q")
            correct = ans.get("correct", [])
            if not isinstance(q_idx, int) or q_idx >= len(raw_questions):
                continue
            q = raw_questions[q_idx]
            for j, opt in enumerate(q["options"]):
                opt["is_correct"] = (j in correct)
            q["has_correct"] = bool(correct)
            q["ai_answered"] = True

        answered = sum(1 for q in raw_questions if q.get("ai_answered"))
        logger.info("Groq answered %d / %d questions", answered, len(raw_questions))

    except requests.exceptions.HTTPError as e:
        logger.error("Groq API HTTP error %s: %s", e.response.status_code, e.response.text[:300])
    except json.JSONDecodeError as e:
        logger.error("Groq returned invalid JSON: %s", e)
    except Exception as e:
        logger.error("Groq inference failed: %s", e, exc_info=True)

    return raw_questions
    # Build compact prompt — one line per question to minimize tokens
    lines: list[str] = []
    for i, q in enumerate(raw_questions):
        opts_str = " | ".join(
            f"[{j}] {o['text']}" for j, o in enumerate(q["options"])
        )
        lines.append(f"Q{i}: {q['question_text']} OPTIONS: {opts_str}")

    questions_block = "\n".join(lines)

    system_prompt = (
        "You are an expert academic tutor. "
        "Given multiple-choice questions, identify the correct answer(s) for each. "
        "Reply ONLY with a JSON array — no prose, no markdown fences. "
        "Format: [{\"q\":0,\"correct\":[2]},{\"q\":1,\"correct\":[0]}, ...] "
        "where numbers are 0-based indices. "
        "Always include one correct index per question. "
        "Use multiple indices only when the question explicitly says 'select all that apply'."
    )

    payload = {
        "model":       "llama-3.1-8b-instant",
        "temperature": 0,
        "max_tokens":  1024,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Answer these {len(raw_questions)} questions:\n\n"
                    f"{questions_block}\n\n"
                    "JSON array only:"
                ),
            },
        ],
    }

    import urllib.request, urllib.error

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())

        raw_json = body["choices"][0]["message"]["content"].strip()

        # Strip accidental markdown fences
        if raw_json.startswith("```"):
            raw_json = re.sub(r"```[a-z]*\n?", "", raw_json).strip().rstrip("`").strip()

        answers: list[dict] = json.loads(raw_json)

        for ans in answers:
            q_idx   = ans.get("q")
            correct = ans.get("correct", [])
            if not isinstance(q_idx, int) or q_idx >= len(raw_questions):
                continue
            q = raw_questions[q_idx]
            for j, opt in enumerate(q["options"]):
                opt["is_correct"] = (j in correct)
            q["has_correct"] = bool(correct)
            q["ai_answered"] = True

        answered = sum(1 for q in raw_questions if q.get("ai_answered"))
        logger.info("Groq answered %d / %d questions", answered, len(raw_questions))

    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="ignore")
        logger.error("Groq API HTTP error %s: %s", e.code, body_text[:300])
        # Non-fatal — questions returned with needs_review=True
    except json.JSONDecodeError as e:
        logger.error("Groq returned invalid JSON: %s", e)
    except Exception as e:
        logger.error("Groq inference failed: %s", e, exc_info=True)

    return raw_questions


# ── Finalize to ExtractedQuestion ─────────────────────────────────────────────

def _finalize(raw_questions: list[dict]) -> list[dict]:
    """Convert raw parsed question dicts to ExtractedQuestion-compatible dicts."""
    results: list[dict] = []

    for q in raw_questions:
        q_text  = q.get("question_text", "").strip()
        options = q.get("options", [])
        marks   = q.get("marks", 1)
        number  = q.get("number", len(results) + 1)

        if not q_text or len(options) < 2:
            logger.debug("Skipping Q%s — insufficient text or options", number)
            continue

        opt_texts_lower = {o["text"].strip().lower() for o in options}
        is_tf = opt_texts_lower <= {"true", "false"} or bool(TRUE_FALSE_RE.search(q_text))

        if is_tf:
            question_type = "TRUE_FALSE"
            tf_correct: str | None = None
            for opt in options:
                if opt.get("is_correct"):
                    val = opt["text"].strip().capitalize()
                    if val in ("True", "False"):
                        tf_correct = val
                        break
            final_opts = [
                {"text": "True",  "is_correct": tf_correct == "True"},
                {"text": "False", "is_correct": tf_correct == "False"},
            ]
        else:
            correct_count = sum(1 for o in options if o.get("is_correct"))
            question_type = "MSQ" if correct_count > 1 else "MCQ"
            final_opts = [
                {"text": o["text"].strip(), "is_correct": o.get("is_correct", False)}
                for o in options
                if o.get("text", "").strip()
            ]

        has_correct = any(o["is_correct"] for o in final_opts)

        # Confidence scoring
        conf = 40
        if len(q_text) > 15:         conf += 10
        if len(q_text) > 40:         conf += 5
        if len(final_opts) >= 4:     conf += 10
        elif len(final_opts) >= 2:   conf += 5
        if has_correct:              conf += 25
        if q.get("ai_answered"):     conf += 10   # Groq answered it
        conf = min(conf, 95)

        needs_review = not has_correct or conf < 70

        wc = len(q_text.split())
        difficulty = "EASY" if wc < 12 else ("MEDIUM" if wc < 30 else "HARD")

        results.append({
            "id":            f"ext-{number}",
            "question_text": q_text,
            "question_type": question_type,
            "options":       final_opts,
            "marks":         marks,
            "difficulty":    difficulty,
            "confidence":    conf,
            "needs_review":  needs_review,
            "approved":      False,
        })

    return results


# ── Extract Endpoint ──────────────────────────────────────────────────────────

@router.post("/extract", response_model=List[ExtractedQuestion])
async def extract_questions_from_file(
    file: UploadFile = File(...),
    _: dict = Depends(require_faculty),
):
    """
    Upload a text-based PDF or DOCX and extract structured exam questions.

    AUTO-DETECTS two PDF formats:
    ─────────────────────────────
    Google Forms PDF  — no A/B/C/D labels, "Mark only one oval." present
                        Correct answers inferred by Groq AI (FREE, llama-3.1-8b-instant)

    Standard MCQ PDF  — options labeled A. B. C. D.
                        Correct answers from inline * markers or Answer Key section

    If Groq is unavailable (GROQ_API_KEY not set), questions are returned
    without correct answers — faculty selects them in the review table.
    """
    filename = (file.filename or "").lower()
    content  = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── 1. Extract raw text ───────────────────────────────────────────────────
    if filename.endswith(".pdf"):
        try:
            full_text = _extract_pdf_text(content)
        except Exception as exc:
            logger.error("PDF extraction failed: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not read this PDF. Ensure it is text-based "
                    "(exported from Word/Google Docs/LaTeX) and not password-protected."
                ),
            )
    elif filename.endswith(".docx"):
        try:
            full_text = _extract_docx_text(content)
        except Exception as exc:
            logger.error("DOCX extraction failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=400, detail="Could not read this DOCX file.")
    else:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )

    if not full_text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No text could be extracted. "
                "Ensure the PDF is text-based, not a scanned image."
            ),
        )

    logger.info("Extracted %d chars from '%s'", len(full_text), filename)

    # ── 2. Detect format and parse ────────────────────────────────────────────
    fmt = _detect_format(full_text)
    logger.info("Detected PDF format: %s", fmt)

    raw_questions = (
        _parse_google_forms(full_text)
        if fmt == "google_forms"
        else _parse_standard(full_text)
    )

    if not raw_questions:
        raise HTTPException(
            status_code=422,
            detail=(
                "No questions could be identified. "
                "Ensure questions are numbered (1., 2., ...) and "
                "the PDF is a text-based export."
            ),
        )

    # ── 3. AI answer inference for questions without confirmed answers ─────────
    missing_answers = [q for q in raw_questions if not q.get("has_correct")]
    if missing_answers:
        logger.info(
            "%d / %d questions need AI answer inference",
            len(missing_answers), len(raw_questions),
        )
        raw_questions = _infer_answers_with_groq(raw_questions)

    # ── 4. Finalize ───────────────────────────────────────────────────────────
    extracted = _finalize(raw_questions)

    if not extracted:
        raise HTTPException(
            status_code=422,
            detail=(
                "Questions were found but could not be structured. "
                "Each question needs at least 2 options."
            ),
        )

    logger.info("Returning %d extracted questions from '%s'", len(extracted), filename)
    return extracted