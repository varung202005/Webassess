"""
Questions endpoints — Question Bank.

WHO DOES WHAT:
  - Create / edit question form  → FRONTEND (UI form) + BACKEND (POST/PATCH)
  - Question list / filters      → FRONTEND (renders) + BACKEND (query with filters)
  - Add options to a question    → BACKEND (POST /questions/{id}/options)
  - Soft delete question         → BACKEND only (sets is_active=FALSE)
  - Tag topics to question       → BACKEND only
  - Extract questions from PDF/DOCX → BACKEND (POST /questions/extract)

  NOTE: Never hard-delete questions — they may be linked to past exam_questions.

EXTRACTION PIPELINE (text-based PDFs only — no image OCR):
  - pdfplumber  → extracts text from text-based PDF pages (fast, accurate)
  - python-docx → extracts text from DOCX files
  - Rule-based regex parser detects MCQ/MSQ/TRUE_FALSE questions, options,
    correct answers (inline markers OR answer-key section), and marks.

  WHY NO TESSERACT HERE:
    The PDFs uploaded are faculty-authored text PDFs (not scans).
    pdfplumber extracts text directly from the PDF content stream —
    no image conversion needed, no OCR errors on numbers/letters.
    Tesseract is only useful for scanned image PDFs; adding it here
    introduced mis-reads of option labels and answer numbers.
"""
import io
import re
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID

import pdfplumber
from docx import Document as DocxDocument

from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()

QuestionType = Literal["MCQ", "MSQ", "TRUE_FALSE", "SHORT_ANSWER", "LONG_ANSWER"]
Difficulty    = Literal["EASY", "MEDIUM", "HARD"]
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
    question = q_result.data[0]
    qid = question["id"]

    if body.options:
        options_data = [
            {
                "question_id": qid,
                "option_text": o.option_text,
                "is_correct": o.is_correct,
                "order_index": o.order_index,
            }
            for o in body.options
        ]
        supabase.table("question_options").insert(options_data).execute()

    if body.topics:
        topics_data = [
            {"question_id": qid, "topic": t.topic, "subject": t.subject, "chapter": t.chapter}
            for t in body.topics
        ]
        supabase.table("question_topics").insert(topics_data).execute()

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
    """Soft delete — sets is_active=FALSE. NEVER hard delete questions."""
    supabase = get_supabase_admin()
    supabase.table("questions").update({"is_active": False}).eq("id", str(question_id)).execute()
    return {"message": "Question deactivated"}


# ── Text Extraction ───────────────────────────────────────────────────────────

def _extract_pdf_text(content: bytes) -> str:
    """
    Extract text from a text-based PDF using pdfplumber.

    pdfplumber reads the actual text content stream from the PDF — it does NOT
    do image conversion or OCR. This is exactly what we want for faculty-authored
    PDFs (Word exports, LaTeX, Google Docs exports). It preserves line breaks and
    spacing which is critical for our regex parser to split questions from options.

    Layout analysis (layout=True in extract_text) keeps option lines on their own
    lines instead of merging them into a single paragraph.
    """
    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            # layout=True preserves spatial text ordering — critical for Q&A structure
            page_text = page.extract_text(layout=True) or ""
            page_text = page_text.strip()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def _extract_docx_text(content: bytes) -> str:
    """Extract text from a DOCX preserving paragraph order."""
    doc = DocxDocument(io.BytesIO(content))
    parts: list[str] = []
    for para in doc.paragraphs:
        t = para.text.strip()
        if t:
            parts.append(t)
    # Also pull table cell text (some exams use tables for options)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                t = cell.text.strip()
                if t:
                    parts.append(t)
    return "\n".join(parts)


# ── Regex Patterns ────────────────────────────────────────────────────────────
#
# DESIGN NOTES:
#
# QUESTION_START_RE  — must only match lines where a NUMBER starts a new question.
#   We require the number to be at the very start of the line (after optional
#   whitespace) and followed by a period, closing paren, or colon, then whitespace.
#   We DON'T match "Q1" style here because "Q" can appear inside option text.
#   Using \b after the number prevents "10." inside a sentence from matching.
#
# OPTION_RE — matches lines that are answer options (A. / (A) / A) / A:).
#   The key fix vs the old version: we require the option letter to be ALONE
#   (not preceded by other letters/digits) so "Stack" or "B-tree" don't match.
#   We also capture multi-word option text to the END of the line.
#
# CORRECT_MARKER_RE — strips inline correct-answer markers from option text.
#   Supports: asterisk (*), checkmarks (✓ ✔), (correct), [correct], (ans), (answer).
#   Must be searched on the RAW text before stripping, then removed.
#
# ANSWER_KEY_ENTRY_RE — matches lines inside an "Answer Key" section.
#   Format: "1. B" / "2) A, C" / "3 - True" / "1: D"
#   We use a strict end-of-line anchor ($) so partial matches inside sentences
#   don't fire.

# Matches question start lines: "1." / "1)" / "1:" at start of line
QUESTION_START_RE = re.compile(
    r"(?m)^[ \t]*(\d{1,3})[.):\]]\s+",
)

# Matches option lines: "A." / "(A)" / "A)" / "A:" — letter must be word-boundary isolated
OPTION_RE = re.compile(
    r"(?m)^[ \t]*[\(\[]?([A-Da-d])[\).\:\]]\s+(.+)$"
)

# Answer key section header
ANSWER_KEY_HEADER_RE = re.compile(
    r"(?im)^[ \t]*(answer[\s_-]*key|answers?|solutions?|key)[ \t]*[:\-]?[ \t]*$"
)

# Answer key entries: "1. B"  "2) A, C"  "3 - True"
ANSWER_KEY_ENTRY_RE = re.compile(
    r"(?im)^[ \t]*(\d{1,3})[ \t]*[.):\-][ \t]*([A-Da-d](?:[ \t]*[,\/][ \t]*[A-Da-d])*|true|false)[ \t]*$"
)

# Inline correct-answer markers on option text (stripped before storing)
CORRECT_MARKER_RE = re.compile(
    r"(?i)[ \t]*(?:[*✓✔]+[ \t]*|\(correct\)|\[correct\]|\(ans(?:wer)?\)|\[ans(?:wer)?\])[ \t]*$"
)

# Marks annotation: "[2 marks]" / "(2 Marks)" / "(2M)"
MARKS_RE = re.compile(r"(?i)[\(\[][ \t]*(\d+)[ \t]*m(?:arks?)?[ \t]*[\)\]]")

# True/False hint in question body
TRUE_FALSE_HINT_RE = re.compile(r"(?i)\btrue[ \t]*[/\-or]*[ \t]*false\b")


# ── Parser ────────────────────────────────────────────────────────────────────

def _parse_answer_key(text: str) -> tuple[str, dict[int, list[str]]]:
    """
    Detect and strip a trailing Answer Key section.
    Returns (body_text_without_key, {q_num: [correct_letters_or_TF]}).
    """
    header_match = ANSWER_KEY_HEADER_RE.search(text)
    if not header_match:
        return text, {}

    body = text[: header_match.start()]
    key_section = text[header_match.end():]

    answer_map: dict[int, list[str]] = {}
    for entry in ANSWER_KEY_ENTRY_RE.finditer(key_section):
        q_num = int(entry.group(1))
        raw = entry.group(2).strip().lower()
        if raw in ("true", "false"):
            answer_map[q_num] = [raw.upper()]
        else:
            letters = [
                p.strip().upper()
                for p in re.split(r"[,\/]", raw)
                if p.strip()
            ]
            answer_map[q_num] = letters

    return body, answer_map


def _parse_single_question(
    number: int,
    block: str,
    answer_key: dict[int, list[str]],
) -> Optional[dict]:
    """
    Parse a single question block (text between two question-number markers).

    Steps:
      1. Split lines into question-text lines vs option lines.
         Option lines are identified by OPTION_RE. Everything before the first
         option line is the question text.
      2. Strip inline correct-answer markers from option text.
      3. If an answer key exists for this number, apply it (overrides inline marks).
      4. Detect TRUE_FALSE, MCQ, or MSQ.
      5. Score confidence.
    """
    # ── 1. Split question text vs options ──────────────────────────────────
    raw_lines = [ln.rstrip() for ln in block.splitlines() if ln.strip()]
    if not raw_lines:
        return None

    option_matches: list[re.Match] = []
    question_lines: list[str] = []
    seen_first_option = False

    for ln in raw_lines:
        m = OPTION_RE.match(ln)
        if m:
            seen_first_option = True
            option_matches.append(m)
        elif not seen_first_option:
            # Still in question body — strip trailing marks annotation
            clean = MARKS_RE.sub("", ln).strip()
            if clean:
                question_lines.append(clean)
        # Lines after the first option but not matching OPTION_RE are ignored
        # (e.g. continuation lines — rare in well-formatted PDFs)

    question_text = " ".join(question_lines).strip()
    if not question_text:
        return None

    # ── 2. Extract marks from raw block ───────────────────────────────────
    marks = 1
    mm = MARKS_RE.search(block)
    if mm:
        try:
            marks = int(mm.group(1))
        except ValueError:
            marks = 1

    # ── 3. Build raw options, strip inline correct markers ─────────────────
    raw_options: list[dict] = []
    for m in option_matches:
        letter = m.group(1).upper()
        opt_text = m.group(2)
        # Check for correct marker BEFORE stripping
        is_correct_inline = bool(CORRECT_MARKER_RE.search(opt_text))
        opt_text = CORRECT_MARKER_RE.sub("", opt_text).strip()
        if opt_text:
            raw_options.append({
                "letter": letter,
                "text": opt_text,
                "is_correct": is_correct_inline,
            })

    # ── 4. Apply answer key (takes priority over inline markers) ───────────
    key_entry = answer_key.get(number)  # e.g. ["B"] or ["A","C"] or ["TRUE"]

    if key_entry and key_entry not in (["TRUE"], ["FALSE"]):
        # Reset all, then mark correct from key
        for opt in raw_options:
            opt["is_correct"] = opt["letter"] in key_entry

    # ── 5. Detect question type ────────────────────────────────────────────
    is_tf_hint = bool(TRUE_FALSE_HINT_RE.search(block))
    option_texts_lower = {o["text"].strip().lower() for o in raw_options}

    looks_like_tf = (
        is_tf_hint
        or option_texts_lower <= {"true", "false"}  # only true/false options present
        or (
            not raw_options
            and question_text.strip().lower().endswith(("true.", "false.", "(true)", "(false)"))
        )
    )

    if looks_like_tf:
        # Determine correct answer for T/F
        tf_correct: Optional[str] = None

        if key_entry and key_entry[0] in ("TRUE", "FALSE"):
            tf_correct = key_entry[0]
        else:
            # Try inline-marked options
            for opt in raw_options:
                if opt["is_correct"]:
                    val = opt["text"].strip().lower()
                    if val in ("true", "false"):
                        tf_correct = val.upper()
                        break

        options = [
            {"text": "True",  "is_correct": tf_correct == "TRUE"},
            {"text": "False", "is_correct": tf_correct == "FALSE"},
        ]
        question_type = "TRUE_FALSE"
        has_correct = tf_correct is not None

    else:
        if len(raw_options) < 2:
            # Not enough options — skip this block
            return None

        options = [{"text": o["text"], "is_correct": o["is_correct"]} for o in raw_options]
        correct_count = sum(1 for o in options if o["is_correct"])
        question_type = "MSQ" if correct_count > 1 else "MCQ"
        has_correct = correct_count > 0

    # ── 6. Confidence scoring ──────────────────────────────────────────────
    confidence = 50
    if len(question_text) > 10:
        confidence += 10          # has substantial question text
    if len(question_text) > 30:
        confidence += 5           # even more text
    if question_type == "TRUE_FALSE" or len(options) >= 4:
        confidence += 15          # well-formed options
    elif len(options) >= 2:
        confidence += 8
    if has_correct:
        confidence += 20          # correct answer identified
    if key_entry:
        confidence += 5           # came from answer key — more reliable
    confidence = max(0, min(100, confidence))

    needs_review = not has_correct or confidence < 75

    # ── 7. Difficulty heuristic ────────────────────────────────────────────
    word_count = len(question_text.split())
    if word_count < 10:
        difficulty: Difficulty = "EASY"
    elif word_count < 25:
        difficulty = "MEDIUM"
    else:
        difficulty = "HARD"

    return {
        "id": f"ext-{number}",
        "question_text": question_text,
        "question_type": question_type,
        "options": options,
        "marks": marks,
        "difficulty": difficulty,
        "confidence": confidence,
        "needs_review": needs_review,
        "approved": False,
    }


def _parse_questions_from_text(text: str) -> list[dict]:
    """
    Split the full document text into per-question blocks and parse each.

    The splitter uses QUESTION_START_RE which matches lines like "1. " / "2) " etc.
    Each block is the text between two consecutive question-start markers.
    """
    # First strip any answer key section so its numbers don't confuse the splitter
    body_text, answer_key = _parse_answer_key(text)

    starts = list(QUESTION_START_RE.finditer(body_text))
    if not starts:
        logger.warning("No question-start markers found in extracted text.")
        return []

    results: list[dict] = []
    for i, m in enumerate(starts):
        number = int(m.group(1))
        block_start = m.end()
        block_end = starts[i + 1].start() if i + 1 < len(starts) else len(body_text)
        block = body_text[block_start:block_end]

        parsed = _parse_single_question(number, block, answer_key)
        if parsed:
            results.append(parsed)
        else:
            logger.debug("Skipped question block #%d (could not parse)", number)

    return results


# ── Extract Endpoint ──────────────────────────────────────────────────────────

@router.post("/extract", response_model=List[ExtractedQuestion])
async def extract_questions_from_file(
    file: UploadFile = File(...),
    _: dict = Depends(require_faculty),
):
    """
    Upload a text-based PDF or DOCX and extract structured exam questions.

    Extraction pipeline:
      PDF  → pdfplumber (direct text extraction — no OCR, no image conversion)
      DOCX → python-docx paragraph walker
      Both → regex rule-based parser (MCQ / MSQ / TRUE_FALSE)

    PDF must be text-based (exported from Word, LaTeX, Google Docs, etc.).
    Scanned image-only PDFs are not supported.

    Recommended question format for best results:
        1. Question text here? [2 marks]
        A. Option one
        B. Option two *        ← asterisk or (correct) marks the right answer
        C. Option three
        D. Option four

    Or use a trailing Answer Key section:
        Answer Key:
        1. B
        2. A, C
        3. True
    """
    filename = (file.filename or "").lower()
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if filename.endswith(".pdf"):
        try:
            text = _extract_pdf_text(content)
        except Exception as exc:
            logger.error("PDF text extraction failed: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not read this PDF. Make sure it is a text-based PDF "
                    "(not a scanned image) and is not password-protected."
                ),
            )
    elif filename.endswith(".docx"):
        try:
            text = _extract_docx_text(content)
        except Exception as exc:
            logger.error("DOCX extraction failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=400, detail="Could not read this DOCX file.")
    else:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No text could be extracted from this document. "
                "If it is a scanned PDF, please convert it to a text-based PDF first."
            ),
        )

    logger.info("Extracted %d characters of text from %s", len(text), filename)

    extracted = _parse_questions_from_text(text)

    if not extracted:
        raise HTTPException(
            status_code=422,
            detail=(
                "No questions could be identified in this document. "
                "Ensure questions are numbered (e.g. '1.', '2.') and options "
                "are labeled A–D. Correct answers should be marked with * or "
                "listed in an 'Answer Key' section at the end."
            ),
        )

    logger.info("Parsed %d questions from %s", len(extracted), filename)
    return extracted