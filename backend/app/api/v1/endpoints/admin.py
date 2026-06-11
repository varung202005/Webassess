"""Admin dashboard — system overview stats."""
from fastapi import APIRouter, Depends
from app.core.security import require_admin
from app.db.supabase import get_supabase_admin

router = APIRouter()


@router.get("/dashboard")
async def admin_dashboard(_: dict = Depends(require_admin)):
    supabase = get_supabase_admin()

    users       = supabase.table("users").select("id", count="exact").execute()
    exams       = supabase.table("exams").select("id", count="exact").execute()
    attempts    = supabase.table("exam_attempts").select("id", count="exact").execute()
    flagged     = supabase.table("proctoring_summary").select("id", count="exact").eq("flagged_for_review", True).execute()
    pending_re  = supabase.table("re_evaluation_requests").select("id", count="exact").eq("status", "PENDING").execute()

    return {
        "total_users":       users.count,
        "total_exams":       exams.count,
        "total_attempts":    attempts.count,
        "flagged_attempts":  flagged.count,
        "pending_reeval":    pending_re.count,
    }
