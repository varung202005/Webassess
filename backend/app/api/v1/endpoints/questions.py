"""
Questions endpoints — Question Bank.

WHO DOES WHAT:
  - Create / edit question form  → FRONTEND (UI form) + BACKEND (POST/PATCH)
  - Question list / filters      → FRONTEND (renders) + BACKEND (query with filters)
  - Add options to a question    → BACKEND (POST /questions/{id}/options)
  - Soft delete question         → BACKEND only (sets is_active=FALSE)
  - Tag topics to question       → BACKEND only
  
  NOTE: Never hard-delete questions — they may be linked to past exam_questions.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Literal
from uuid import UUID

from app.core.security import require_faculty, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()

QuestionType = Literal["MCQ", "MSQ", "TRUE_FALSE", "SHORT_ANSWER", "LONG_ANSWER"]
Difficulty    = Literal["EASY", "MEDIUM", "HARD"]


# ── Schemas ──────────────────────────────────────────────────────────────────

class OptionCreate(BaseModel):
    option_text: str
    is_correct: bool
    order_index: int


class TopicCreate(BaseModel):
    topic: str
    subject: Optional[str] = None
    chapter: Optional[str] = None


class QuestionCreate(BaseModel):
    course_id: UUID
    question_type: QuestionType
    question_text: str
    marks: int
    negative_marks: int = 0
    difficulty: Difficulty
    options: Optional[List[OptionCreate]] = []   # Provide for MCQ/MSQ/TRUE_FALSE
    topics: Optional[List[TopicCreate]] = []


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    marks: Optional[int] = None
    negative_marks: Optional[int] = None
    difficulty: Optional[Difficulty] = None
    is_active: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_questions(
    course_id: Optional[UUID] = None,
    question_type: Optional[QuestionType] = None,
    difficulty: Optional[Difficulty] = None,
    is_active: Optional[bool] = True,
    _: dict = Depends(require_faculty),
):
    """List questions with optional filters. Faculty/Admin see all; students don't call this."""
    supabase = get_supabase_admin()
    query = supabase.table("questions").select(
        "*, courses(name), question_options(*), question_topics(*)"
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
        .select("*, courses(name), question_options(*), question_topics(*)")
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
    """
    Create a question with its options and topics in one API call.
    Faculty/Admin only. BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    # 1. Insert question
    q_data = {
        "created_by": current_user["user_id"],
        "course_id": str(body.course_id),
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

    # 2. Insert options (for MCQ/MSQ/TRUE_FALSE)
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

    # 3. Insert topics
    if body.topics:
        topics_data = [
            {
                "question_id": qid,
                "topic": t.topic,
                "subject": t.subject,
                "chapter": t.chapter,
            }
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
    return {"message": "Question deactivated (soft deleted)"}
