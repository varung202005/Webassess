import io
import re
import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID
from app.core.config import settings
import pdfplumber
from docx import Document as DocxDocument
from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()

QuestionType          = Literal["MCQ", "MSQ", "TRUE_FALSE", "SHORT_ANSWER", "LONG_ANSWER"]
Difficulty            = Literal["EASY", "MEDIUM", "HARD"]
ExtractedQuestionType = Literal["MCQ", "MSQ", "TRUE_FALSE"]


# ── Sanitize helper ───────────────────────────────────────────────────────────

def sanitize(text: str | None) -> str | None:
    """
    Strip characters that PostgreSQL cannot store in a `text` column.

    PostgreSQL raises error code 22P05 ("unsupported Unicode escape sequence")
    when a string contains the NULL byte U+0000.  pdfplumber occasionally
    produces these from ligature glyphs or corrupt PDF glyph tables.

    We also strip the Unicode replacement character U+FFFD which can appear
    for the same reason and is usually unwanted in question text.
    """
    if text is None:
        return None
    return text.replace("\x00", "").replace("\ufffd", "")


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

    # FIX: sanitize() removes U+0000 null bytes that pdfplumber can embed in
    # extracted text, which PostgreSQL rejects with error code 22P05.
    q_data = {
        "created_by":     current_user["user_id"],
        "course_id":      str(body.course_id) if body.course_id else None,
        "question_type":  body.question_type,
        "question_text":  sanitize(body.question_text),   # ← FIX
        "marks":          body.marks,
        "negative_marks": body.negative_marks,
        "difficulty":     body.difficulty,
        "is_active":      True,
    }
    q_result = supabase.table("questions").insert(q_data).execute()
    qid = q_result.data[0]["id"]

    if body.options:
        supabase.table("question_options").insert([
            {
                "question_id": qid,
                "option_text": sanitize(o.option_text),   # ← FIX
                "is_correct":  o.is_correct,
                "order_index": o.order_index,
            }
            for o in body.options
        ]).execute()

    if body.topics:
        supabase.table("question_topics").insert([
            {
                "question_id": qid,
                "topic":       sanitize(t.topic),         # ← FIX
                "subject":     sanitize(t.subject),       # ← FIX
                "chapter":     sanitize(t.chapter),       # ← FIX
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

QUESTION_NUM_RE  = re.compile(r"^[ \t]*(\d{1,3})\.\s*(.*)?$")
MARKS_RE         = re.compile(r"(?i)\b(\d+)\s*(?:points?|marks?)\b")
TRUE_FALSE_RE    = re.compile(r"(?i)\btrue\s*/?\s*false\b")
OPTION_LABEL_RE  = re.compile(r"^[ \t]*[\(\[]?([A-Da-d])[\).\:\]][ \t]+(.+)$")
CORRECT_MARKER_RE = re.compile(
    r"(?i)[ \t]*(?:[*\u2713\u2714]+[ \t]*"
    r"|\(correct\)|\[correct\]"
    r"|\(ans(?:wer)?\)|\[ans(?:wer)?\])[ \t]*$"
)
ANSWER_KEY_HEADER_RE = re.compile(
    r"(?im)^[ \t]*(answer[\s_-]*key|answers?|solutions?|key)[ \t]*[:\-]?[ \t]*$"
)
ANSWER_KEY_ENTRY_RE = re.compile(
    r"(?im)^[ \t]*(\d{1,3})[ \t]*[.):\-][ \t]*"
    r"([A-Da-d](?:[ \t]*[,\/][ \t]*[A-Da-d])*|true|false)[ \t]*$"
)


# ── Format Detection ──────────────────────────────────────────────────────────

def _detect_format(text: str) -> str:
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
    pages = full_text.split("\n\n")
    content_lines: list[str] = []
    for page in pages:
        if _is_header_page(page):
            logger.debug("Skipping header page")
        else:
            content_lines.extend(page.splitlines())

    STANDALONE_ASTERISK_RE = re.compile(r"^\*+$")
    cleaned: list[str] = []
    for raw in content_lines:
        line = raw.strip()
        if not line or SKIP_LINE_RE.match(line):
            continue
        if STANDALONE_ASTERISK_RE.match(line):
            continue
        cleaned.append(line)

    questions: list[dict] = []
    current: dict | None = None
    awaiting_question_text = False

    for line in cleaned:
        m = QUESTION_NUM_RE.match(line)
        if m:
            if current and current.get("question_text"):
                questions.append(current)

            number = int(m.group(1))
            rest   = (m.group(2) or "").strip()

            marks = 1
            mm = MARKS_RE.search(rest)
            if mm:
                marks = int(mm.group(1))
                rest  = MARKS_RE.sub("", rest).strip()

            rest = re.sub(r"\s*\*+\s*$", "", rest).strip()

            current = {
                "number":        number,
                "question_text": rest,
                "options":       [],
                "marks":         marks,
                "has_correct":   False,
                "ai_answered":   False,
            }
            awaiting_question_text = not bool(rest)
            continue

        if current is None:
            continue

        if awaiting_question_text and not current["question_text"]:
            q_text = MARKS_RE.sub("", line).strip()
            q_text = re.sub(r"\s*\*+\s*$", "", q_text).strip()
            if not q_text:
                continue
            current["question_text"] = q_text
            awaiting_question_text = False
            continue

        opt_text = MARKS_RE.sub("", line).strip()
        opt_text = re.sub(r"\s*\*+\s*$", "", opt_text).strip()
        if not opt_text:
            continue

        prev_opts = current["options"]
        if prev_opts and opt_text[0].islower():
            prev_opts[-1]["text"] = (prev_opts[-1]["text"].rstrip() + " " + opt_text).strip()
            continue

        current["options"].append({"text": opt_text, "is_correct": False})

    if current and current.get("question_text"):
        questions.append(current)

    logger.info("Google Forms parser found %d questions", len(questions))
    return questions


# ── Standard MCQ Parser ───────────────────────────────────────────────────────

def _parse_standard(full_text: str) -> list[dict]:
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

        key = answer_key.get(number)
        if key and key not in (["TRUE"], ["FALSE"]):
            for opt in opts:
                opt["is_correct"] = opt.get("letter") in key

        has_correct = any(o["is_correct"] for o in opts)

        questions.append({
            "number":        number,
            "question_text": q_text,
            "options":       opts,
            "marks":         marks,
            "has_correct":   has_correct,
            "ai_answered":   False,
        })

    logger.info("Standard parser found %d questions", len(questions))
    return questions


# ── Groq AI Answer Inference ──────────────────────────────────────────────────

import requests
import time
import unicodedata

GROQ_BATCH_SIZE = 1


def _clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    # Also strip null bytes here as a second line of defence
    text = text.replace("\x00", "").replace("\ufffd", "")
    return re.sub(r"\s+", " ", text).strip()


def _call_groq(api_key: str, batch: list[dict], offset: int, temperature: float, attempt: int, strict: bool = False) -> bool:
    q = batch[0]
    q_text = _clean_text(q["question_text"])

    opts_lines = [
        f"{j}. {_clean_text(o['text'])}" for j, o in enumerate(q["options"])
    ]
    opts_block = "\n".join(opts_lines)

    if attempt == 1:
        print(f"### Q@{offset} text={q_text!r}", flush=True)
        for ol in opts_lines:
            print(f"### Q@{offset} opt: {ol!r}", flush=True)

    if not strict:
        system_prompt = (
            "You are an expert academic tutor answering a multiple-choice question. "
            "Reply with ONLY the option number(s) of the correct answer, as the "
            "very first thing in your reply. "
            "If more than one option is correct, reply with the numbers separated by commas, "
            "such as '0,2'. "
            "Do not include any words, explanations, labels, punctuation, or "
            "formatting — reply with the number(s) only, and always pick at "
            "least one number even if you are unsure.\n\n"
            "Example:\n"
            "Question: What is 2+2?\n"
            "Options:\n0. 3\n1. 4\n2. 5\n3. 6\n"
            "Correct option number(s): 1"
        )
        user_content = (
            f"Question: {q_text}\n\n"
            f"Options:\n{opts_block}\n\n"
            "Correct option number(s):"
        )
        max_tokens = 12
    else:
        system_prompt = (
            "You answer multiple-choice questions. "
            "You must respond with EXACTLY ONE CHARACTER: a single digit "
            "from 0 to 9, indicating the index of the correct option. "
            "Output nothing else — no words, no punctuation, no newline, "
            "just one digit."
        )
        user_content = (
            f"Question: {q_text}\n"
            f"Options:\n{opts_block}\n"
            "Answer (single digit only):"
        )
        max_tokens = 3

    payload = {
        "model":       "llama-3.3-70b-versatile",
        "temperature": temperature,
        "max_tokens":  max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ],
    }

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

    print(f"### Groq batch@{offset} attempt {attempt} status:", resp.status_code, flush=True)
    print(f"### Groq batch@{offset} attempt {attempt} raw text:", resp.text[:500], flush=True)

    resp.raise_for_status()
    body = resp.json()

    content = body["choices"][0]["message"]["content"].strip()
    nums = [int(n) for n in re.findall(r"\d+", content)]
    correct = sorted({n for n in nums if 0 <= n < len(q["options"])})

    if not correct:
        print(f"### Groq batch@{offset} attempt {attempt} no usable answer "
              f"(content={content!r})", flush=True)
        return False

    for j, opt in enumerate(q["options"]):
        opt["is_correct"] = (j in correct)
    q["has_correct"]  = True
    q["ai_answered"]  = True
    return True


def _infer_answers_batch(api_key: str, batch: list[dict], offset: int) -> None:
    for attempt, (temperature, strict) in enumerate(
        ((0, False), (0.5, False), (0.2, True)), start=1
    ):
        try:
            if _call_groq(api_key, batch, offset, temperature, attempt, strict=strict):
                return
        except (requests.exceptions.HTTPError, json.JSONDecodeError) as e:
            print(f"### Groq batch@{offset} attempt {attempt} failed: {e}", flush=True)
        time.sleep(0.2)

    logger.warning("Groq could not produce a confident answer for batch @%d", offset)


def _infer_answers_with_groq(raw_questions: list[dict]) -> list[dict]:
    api_key = settings.GROQ_API_KEY.strip()
    if not api_key:
        logger.warning("GROQ_API_KEY not set — skipping AI answer inference")
        return raw_questions

    for start in range(0, len(raw_questions), GROQ_BATCH_SIZE):
        batch = raw_questions[start:start + GROQ_BATCH_SIZE]
        try:
            _infer_answers_batch(api_key, batch, offset=start)
        except Exception as e:
            logger.error("Groq inference failed (batch @%d): %s", start, e, exc_info=True)
        time.sleep(0.2)

    answered = sum(1 for q in raw_questions if q.get("ai_answered") and q.get("has_correct"))
    logger.info("Groq answered %d / %d questions", answered, len(raw_questions))
    return raw_questions


# ── Finalize to ExtractedQuestion ─────────────────────────────────────────────

def _finalize(raw_questions: list[dict]) -> list[dict]:
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

        conf = 40
        if len(q_text) > 15:       conf += 10
        if len(q_text) > 40:       conf += 5
        if len(final_opts) >= 4:   conf += 10
        elif len(final_opts) >= 2: conf += 5
        if has_correct:            conf += 25
        if q.get("ai_answered"):   conf += 10
        conf = min(conf, 95)

        needs_review = not has_correct or conf < 70

        wc = len(q_text.split())
        difficulty = "EASY" if wc < 12 else ("MEDIUM" if wc < 30 else "HARD")

        results.append({
            "id":            f"ext-{len(results) + 1}",
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
    filename = (file.filename or "").lower()
    content  = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

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
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    if not full_text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No text could be extracted. "
                "Ensure the PDF is text-based, not a scanned image."
            ),
        )

    logger.info("Extracted %d chars from '%s'", len(full_text), filename)

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

    missing_answers = [q for q in raw_questions if not q.get("has_correct")]
    if missing_answers:
        logger.info(
            "%d / %d questions need AI answer inference",
            len(missing_answers), len(raw_questions),
        )
        raw_questions = _infer_answers_with_groq(raw_questions)

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