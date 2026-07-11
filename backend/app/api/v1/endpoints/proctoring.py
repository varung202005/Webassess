"""
backend/app/api/v1/endpoints/proctoring.py

CHANGES vs previous version:
  - POST /browser: now syncs tab_switch_count + fullscreen_exit_count into
    proctoring_summary LIVE (not just on exam submission), so the dashboard
    stat cards show real-time counts.
  - POST /browser: now also INSERTs separate event rows into
    browser_activity_logs with an event_type column so the Supabase Realtime
    channel in Dashboard.tsx fires Live Alerts on every tab switch.
  - POST /browser: now also upserts into browser_activity_summary — the table
    the dashboard (proctor.py) actually reads cumulative counts from.
  - POST /face: now syncs proctoring_summary LIVE on every face event.
  - POST /audio-transcript: transcribes via Groq Whisper, checks exam
    relevance via fuzzy-match through exam_questions -> questions join,
    flags immediately if speech matches exam content.
  - _check_exam_relevance: fixed to join exam_questions (junction table) ->
    questions to get question_text, matching actual schema.
  - All other endpoints unchanged.

WHO DOES WHAT:
  - Camera / mic access request     → FRONTEND only (browser MediaDevices API)
  - Face detection ML model         → FRONTEND only (runs in browser)
  - Log face verification result    → BACKEND  POST /proctoring/face
  - Tab / fullscreen detection      → FRONTEND (document.visibilityState, fullscreenchange)
  - Log browser activity            → BACKEND  POST /proctoring/browser
  - Audio noise detection           → FRONTEND (WebAudio API) + BACKEND POST /proctoring/audio
  - Audio speech transcription      → BACKEND  POST /proctoring/audio-transcript
  - View proctoring summary         → BACKEND  GET  /proctoring/summary/:id  (Proctor/Admin)
  - Integrity score calculation     → BACKEND  POST /proctoring/summary/:id  (on submission)

  STUDENTS NEVER ACCESS PROCTORING DATA — enforced by RLS + role checks.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import difflib
import logging
import requests

from app.core.security import require_student, require_proctor
from app.db.supabase import get_supabase_admin
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Shared helpers ────────────────────────────────────────────────────────────

def _get_tab_switch_limit(supabase, attempt_id: str) -> int:
    """
    Look up exam_rules.max_tab_switches for the exam this attempt belongs to.
    """
    rows = (
        supabase.table("exam_attempts")
        .select("exam_schedules(exams(exam_rules(max_tab_switches)))")
        .eq("id", attempt_id)
        .execute()
        .data
    ) or []
    if not rows:
        return 0

    sched = rows[0].get("exam_schedules") or {}
    if isinstance(sched, list):
        sched = sched[0] if sched else {}
    exam = sched.get("exams") or {}
    if isinstance(exam, list):
        exam = exam[0] if exam else {}
    rules = exam.get("exam_rules")
    if isinstance(rules, list):
        rules = rules[0] if rules else {}
    rules = rules or {}

    limit = rules.get("max_tab_switches") or 0
    if limit:
        return limit

    # Fallback: some schemas key exam_rules by exam_schedule_id directly
    attempt = (
        supabase.table("exam_attempts")
        .select("exam_schedule_id")
        .eq("id", attempt_id)
        .execute()
        .data
    ) or []
    if not attempt:
        return 0
    try:
        fallback = (
            supabase.table("exam_rules")
            .select("max_tab_switches")
            .eq("exam_schedule_id", attempt[0]["exam_schedule_id"])
            .execute()
            .data
        ) or []
        if fallback:
            return fallback[0].get("max_tab_switches") or 0
    except Exception:
        pass
    return 0


def _hard_violation(tab_switch_count: int, tab_limit: int, session_conflict: bool) -> bool:
    """
    A student should always land in Flagged Attempts if they were shut down
    for hitting a hard rule (tab-switch limit breached, or a duplicate
    session/tab was detected) — regardless of what the computed integrity
    score works out to.
    """
    return bool(session_conflict) or (tab_limit > 0 and tab_switch_count >= tab_limit)


# ── Phase 2: audio transcription via Groq's hosted Whisper API ───────────────

def _transcribe_audio(audio_url: str) -> Optional[str]:
    """
    Downloads the recorded speech clip and sends it to Groq's Whisper
    transcription endpoint. Returns the transcript text, or None if the
    key isn't configured or the request fails.

    Uses the same GROQ_API_KEY and requests-based style already used in
    questions.py — no self-hosted server, no ffmpeg, no VPS needed.
    """
    api_key = settings.GROQ_API_KEY.strip()
    if not api_key:
        logger.warning("GROQ_API_KEY not set — skipping audio transcription")
        return None

    try:
        clip_resp = requests.get(audio_url, timeout=15)
        clip_resp.raise_for_status()
        audio_bytes = clip_resp.content

        resp = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent":    "Mozilla/5.0 (compatible; ExamPortal/1.0)",
            },
            files={"file": ("clip.webm", audio_bytes, "audio/webm")},
            data={
                "model":           "whisper-large-v3-turbo",
                "response_format": "json",
            },
            timeout=30,
        )
        print(f"### Groq transcription status: {resp.status_code}", flush=True)
        resp.raise_for_status()
        text = (resp.json().get("text") or "").strip()
        return text or None
    except Exception as exc:
        print(f"### Groq transcription failed (non-fatal): {exc}", flush=True)
        return None


def _check_exam_relevance(supabase, attempt_id: str, transcript: str) -> tuple[bool, Optional[str]]:
    """
    Free, deterministic relevance check — no LLM call needed.

    Schema (confirmed via information_schema):
      exam_questions: exam_id, question_id, id, marks_override, ...
      questions:      id, question_text, course_id, question_type, ...

    The join goes: attempt -> exam_schedules(exam_id) -> exam_questions
    (filter by exam_id) -> questions (get question_text via question_id).

    Fuzzy-matches the transcript against the exam's own question text.
    Returns (is_relevant, matched_snippet) where is_relevant is True if
    the transcript meaningfully overlaps with any question's text.
    """
    try:
        # Step 1: resolve exam_id from attempt
        attempt = (
            supabase.table("exam_attempts")
            .select("exam_schedules(exam_id)")
            .eq("id", attempt_id)
            .execute()
            .data
        )
        if not attempt:
            return False, None
        sched = attempt[0].get("exam_schedules") or {}
        if isinstance(sched, list):
            sched = sched[0] if sched else {}
        exam_id = sched.get("exam_id")
        if not exam_id:
            return False, None

        # Step 2: join exam_questions -> questions to get question_text
        eq_rows = (
            supabase.table("exam_questions")
            .select("questions(question_text)")
            .eq("exam_id", exam_id)
            .execute()
            .data
        ) or []

        questions = []
        for row in eq_rows:
            q = row.get("questions") or {}
            if isinstance(q, list):
                q = q[0] if q else {}
            if q.get("question_text"):
                questions.append({"question_text": q["question_text"]})

    except Exception as exc:
        print(f"[proctoring] exam-relevance lookup failed (non-fatal): {exc}")
        return False, None

    transcript_lower = transcript.lower()
    best_ratio = 0.0
    best_snippet: Optional[str] = None

    for q in questions:
        qtext = (q.get("question_text") or "").strip()
        if not qtext:
            continue
        # Word-overlap heuristic first (cheap) — only fuzzy-match candidates
        # that already share meaningful words with the transcript.
        q_words = set(w.lower() for w in qtext.split() if len(w) > 3)
        t_words = set(w.lower() for w in transcript_lower.split() if len(w) > 3)
        if not q_words or len(q_words & t_words) < 2:
            continue
        ratio = difflib.SequenceMatcher(None, qtext.lower(), transcript_lower).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_snippet = qtext[:120]

    return best_ratio >= 0.25, best_snippet


# ── Schemas ───────────────────────────────────────────────────────────────────

class FaceVerificationLog(BaseModel):
    attempt_id: UUID
    face_detected: bool
    identity_matched: bool
    person_count: int
    phone_detected: bool
    confidence_score: float     # 0.0–1.0 from ML model
    snapshot_url: Optional[str] = None


class BrowserActivityLog(BaseModel):
    attempt_id: UUID
    tab_switch_count: int
    fullscreen_exit_count: int
    session_conflict_detected: bool = False


class AudioLog(BaseModel):
    attempt_id: UUID
    noise_detected: bool
    noise_level_db: float
    notes: Optional[str] = None


class AudioTranscriptRequest(BaseModel):
    attempt_id: UUID
    audio_url: str


class ProctoringVerdictBody(BaseModel):
    proctor_verdict: str    # CLEAN | SUSPICIOUS | VIOLATED | PENDING
    flagged_for_review: Optional[bool] = None


# ── Student-facing log endpoints ──────────────────────────────────────────────

@router.post("/face")
async def log_face_verification(
    body: FaceVerificationLog,
    _: dict = Depends(require_student),
):
    """
    Frontend AI models (face-api.js + coco-ssd, running client-side) send
    real detection results here.

    Live proctoring_summary sync: recomputes cumulative face-related counts
    and upserts proctoring_summary on every event so the dashboard shows
    real-time data, not just post-submission data.
    """
    if not (0.0 <= body.confidence_score <= 1.0):
        raise HTTPException(status_code=400, detail="confidence_score must be 0.0–1.0")

    supabase = get_supabase_admin()
    aid = str(body.attempt_id)
    p   = settings.INTEGRITY_SCORE_PENALTIES

    supabase.table("face_verification_logs").insert({
        "attempt_id":       aid,
        "face_detected":    body.face_detected,
        "identity_matched": body.identity_matched,
        "person_count":     body.person_count,
        "phone_detected":   body.phone_detected,
        "confidence_score": body.confidence_score,
        "snapshot_url":     body.snapshot_url,
    }).execute()

    # ── Live sync into proctoring_summary ─────────────────────────────────────
    all_face_logs = (
        supabase.table("face_verification_logs")
        .select("face_detected,person_count,phone_detected")
        .eq("attempt_id", aid)
        .execute()
        .data
    ) or []
    face_absence = sum(1 for f in all_face_logs if not f.get("face_detected"))
    multi_person = sum(1 for f in all_face_logs if (f.get("person_count") or 0) > 1)
    phone_detect = sum(1 for f in all_face_logs if f.get("phone_detected"))

    existing = (
        supabase.table("proctoring_summary")
        .select("tab_switch_count,fullscreen_exit_count,noise_event_count,proctor_verdict")
        .eq("attempt_id", aid)
        .execute()
        .data
    ) or []
    tab_switches    = existing[0].get("tab_switch_count", 0)      if existing else 0
    fs_exits        = existing[0].get("fullscreen_exit_count", 0) if existing else 0
    noise_events    = existing[0].get("noise_event_count", 0)     if existing else 0
    proctor_verdict = existing[0]["proctor_verdict"] if existing and existing[0].get("proctor_verdict") else "PENDING"

    penalty = (
        face_absence * p.get("face_absence",    0.05) +
        multi_person * p.get("multi_person",    0.10) +
        phone_detect * p.get("phone_detected",  0.10) +
        tab_switches * p.get("tab_switch",      0.03) +
        fs_exits     * p.get("fullscreen_exit", 0.02) +
        noise_events * p.get("noise_event",     0.02)
    )
    integrity_score = round(max(0.0, 1.0 - penalty), 4)
    total_incidents = face_absence + multi_person + phone_detect + tab_switches + fs_exits + noise_events

    # Use CUMULATIVE counts (not just current frame) so a later "clean" frame
    # doesn't un-flag a student who was genuinely caught with a phone earlier.
    hard_violation = phone_detect > 0 or multi_person > 0
    flagged = integrity_score < 0.5 or hard_violation

    supabase.table("proctoring_summary").upsert(
        {
            "attempt_id":            aid,
            "integrity_score":       integrity_score,
            "total_incidents":       total_incidents,
            "face_absence_count":    face_absence,
            "multi_person_count":    multi_person,
            "phone_detection_count": phone_detect,
            "tab_switch_count":      tab_switches,
            "fullscreen_exit_count": fs_exits,
            "noise_event_count":     noise_events,
            "flagged_for_review":    flagged,
            "proctor_verdict":       proctor_verdict,
        },
        on_conflict="attempt_id",
    ).execute()

    return {"logged": True, "flagged": flagged}


@router.post("/browser")
async def log_browser_activity(
    body: BrowserActivityLog,
    _: dict = Depends(require_student),
):
    """
    Frontend sends cumulative tab switch + fullscreen exit counts.

    FIX 1 — Live proctoring_summary sync: updates proctoring_summary
      immediately so dashboard stat cards are live, not post-submission only.

    FIX 2 — Realtime INSERT rows for Live Alerts: INSERTs a separate event
      row per violation type so Supabase Realtime triggers on every event.

    FIX 3 — browser_activity_summary: upserts the cumulative row into
      browser_activity_summary (the table proctor.py actually reads for the
      Students panel) in addition to browser_activity_logs.
    """
    supabase = get_supabase_admin()
    aid = str(body.attempt_id)
    p   = settings.INTEGRITY_SCORE_PENALTIES

    # ── 1. Upsert the cumulative activity row ─────────────────────────────────
    supabase.table("browser_activity_logs").upsert(
        {
            "attempt_id":                aid,
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        },
        on_conflict="attempt_id",
    ).execute()

    # ── 1b. Also upsert into browser_activity_summary ─────────────────────────
    try:
        supabase.table("browser_activity_summary").upsert(
            {
                "attempt_id":            aid,
                "tab_switch_count":      body.tab_switch_count,
                "fullscreen_exit_count": body.fullscreen_exit_count,
            },
            on_conflict="attempt_id",
        ).execute()
    except Exception as exc:
        print(f"[proctoring] browser_activity_summary upsert failed (non-fatal): {exc}")

    # ── 2. INSERT separate event rows per violation type ──────────────────────
    #    These INSERT rows fire the Supabase Realtime trigger in Dashboard.tsx
    if body.tab_switch_count > 0:
        supabase.table("browser_activity_logs").insert({
            "attempt_id":                aid,
            "event_type":                "TAB_SWITCH",
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        }).execute()

    if body.fullscreen_exit_count > 0:
        supabase.table("browser_activity_logs").insert({
            "attempt_id":                aid,
            "event_type":                "FULLSCREEN_EXIT",
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        }).execute()

    if body.session_conflict_detected:
        supabase.table("browser_activity_logs").insert({
            "attempt_id":                aid,
            "event_type":                "SESSION_CONFLICT",
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": True,
        }).execute()

    # ── 3. Sync into proctoring_summary live ──────────────────────────────────
    tab_penalty = body.tab_switch_count      * p.get("tab_switch",      0.03)
    fs_penalty  = body.fullscreen_exit_count * p.get("fullscreen_exit", 0.02)
    partial_integrity = round(max(0.0, 1.0 - tab_penalty - fs_penalty), 4)
    tab_limit = _get_tab_switch_limit(supabase, aid)
    hard_violation = _hard_violation(body.tab_switch_count, tab_limit, body.session_conflict_detected)
    should_flag = partial_integrity < 0.5 or hard_violation

    existing = (
        supabase.table("proctoring_summary")
        .select("attempt_id, integrity_score, face_absence_count, multi_person_count, phone_detection_count, noise_event_count")
        .eq("attempt_id", aid)
        .execute()
        .data
    )

    if existing:
        # Update only browser-related fields — preserve face/audio counts already recorded
        row = existing[0]
        face_absence = row.get("face_absence_count",    0) or 0
        multi_person = row.get("multi_person_count",    0) or 0
        phone_detect = row.get("phone_detection_count", 0) or 0
        noise_events = row.get("noise_event_count",     0) or 0

        noise_penalty = noise_events * p.get("noise_event", 0.02)
        face_penalty  = (
            face_absence * p.get("face_absence",   0.05) +
            multi_person * p.get("multi_person",   0.10) +
            phone_detect * p.get("phone_detected", 0.10)
        )
        full_integrity = round(
            max(0.0, 1.0 - tab_penalty - fs_penalty - face_penalty - noise_penalty),
            4,
        )
        full_flagged = full_integrity < 0.5 or hard_violation

        supabase.table("proctoring_summary").update({
            "tab_switch_count":      body.tab_switch_count,
            "fullscreen_exit_count": body.fullscreen_exit_count,
            "integrity_score":       full_integrity,
            "flagged_for_review":    full_flagged,
            # Don't overwrite an existing proctor decision
        }).eq("attempt_id", aid).execute()

    else:
        # First browser sync for this attempt — create the summary row
        supabase.table("proctoring_summary").insert({
            "attempt_id":            aid,
            "tab_switch_count":      body.tab_switch_count,
            "fullscreen_exit_count": body.fullscreen_exit_count,
            "integrity_score":       partial_integrity,
            "total_incidents":       body.tab_switch_count + body.fullscreen_exit_count,
            "face_absence_count":    0,
            "multi_person_count":    0,
            "phone_detection_count": 0,
            "noise_event_count":     0,
            "flagged_for_review":    should_flag,
            "proctor_verdict":       "PENDING",
        }).execute()

    return {"logged": True}


@router.post("/audio")
async def log_audio(
    body: AudioLog,
    _: dict = Depends(require_student),
):
    """
    Frontend WebAudio API detects noise → sends each event here.
    INSERT (append-only, one row per noise event).
    noise_detected=False rows are still stored for audit trail.
    """
    supabase = get_supabase_admin()
    supabase.table("audio_monitoring_logs").insert({
        "attempt_id":     str(body.attempt_id),
        "noise_detected": body.noise_detected,
        "noise_level_db": body.noise_level_db,
        "notes":          body.notes,
    }).execute()
    return {"logged": True}


@router.post("/audio-transcript")
async def log_audio_transcript(
    body: AudioTranscriptRequest,
    _: dict = Depends(require_student),
):
    """
    Phase 2 — called by AudioMonitor.tsx only when its client-side VAD
    detects sustained speech, with a short clip already uploaded to
    Supabase Storage.

    Flow:
      1. Transcribe clip via Groq Whisper (whisper-large-v3-turbo).
      2. Fuzzy-match transcript against exam's own question text via
         exam_questions -> questions join (free, deterministic, no LLM).
      3. Log result to audio_monitoring_logs (requires migration — see below).
      4. If exam_relevant, immediately flag the attempt in proctoring_summary.

    Requires these columns on audio_monitoring_logs (run migration first):
      alter table audio_monitoring_logs
        add column if not exists transcript       text,
        add column if not exists exam_relevant    boolean default false,
        add column if not exists matched_snippet  text,
        add column if not exists audio_url        text;
    """
    supabase = get_supabase_admin()
    aid = str(body.attempt_id)

    # Step 1: transcribe
    transcript = _transcribe_audio(body.audio_url)

    # Step 2: check exam relevance
    exam_relevant = False
    matched_snippet: Optional[str] = None
    if transcript:
        exam_relevant, matched_snippet = _check_exam_relevance(supabase, aid, transcript)

    # Step 3: build notes and log to audio_monitoring_logs
    notes = None
    if transcript and exam_relevant:
        notes = f"Speech matched exam content: \"{matched_snippet}\""
    elif transcript:
        notes = f"Speech detected (not exam-related): \"{transcript[:80]}\""
    else:
        notes = "Speech detected — transcription unavailable (GROQ_API_KEY not configured or request failed)"

    try:
        supabase.table("audio_monitoring_logs").insert({
            "attempt_id":      aid,
            "noise_detected":  True,
            "noise_level_db":  None,
            "notes":           notes,
            "transcript":      transcript,
            "exam_relevant":   exam_relevant,
            "matched_snippet": matched_snippet,
            "audio_url":       body.audio_url,
        }).execute()
    except Exception as exc:
        # Columns may not exist yet if migration hasn't run — fall back to
        # a basic insert so the endpoint never breaks noise logging entirely.
        print(f"[proctoring] audio-transcript full insert failed, falling back: {exc}")
        try:
            supabase.table("audio_monitoring_logs").insert({
                "attempt_id":     aid,
                "noise_detected": True,
                "noise_level_db": None,
                "notes":          notes,
            }).execute()
        except Exception as exc2:
            print(f"[proctoring] audio-transcript fallback insert also failed: {exc2}")

    # Step 4: if exam-relevant speech detected, flag immediately
    if exam_relevant:
        existing = (
            supabase.table("proctoring_summary")
            .select("*")
            .eq("attempt_id", aid)
            .execute()
            .data
        )
        if existing:
            proctor_verdict = existing[0].get("proctor_verdict") or "PENDING"
            supabase.table("proctoring_summary").update({
                "flagged_for_review": True,
                "proctor_verdict":    proctor_verdict,
            }).eq("attempt_id", aid).execute()

    return {"logged": True, "transcript": transcript, "exam_relevant": exam_relevant}


# ── Summary computation (called on exam submission) ───────────────────────────

def _compute_and_upsert_summary(supabase, attempt_id: str) -> dict:
    """
    Shared computation used by:
      - POST /proctoring/summary/{attempt_id}            (student, on submit)
      - POST /proctoring/summary/{attempt_id}/recompute   (proctor, manual re-check)

    Reads all three log tables, computes integrity_score with penalties,
    and writes/updates the proctoring_summary row for this attempt.

    Penalty config lives in INTEGRITY_SCORE_PENALTIES (core/config.py):
        face_absence:    0.05 per event
        multi_person:    0.10 per event
        phone_detected:  0.10 per event
        tab_switch:      0.03 per event
        fullscreen_exit: 0.02 per event
        noise_event:     0.02 per event
    """
    p   = settings.INTEGRITY_SCORE_PENALTIES
    aid = str(attempt_id)

    # ── Face logs ─────────────────────────────────────────────────────────────
    face_logs    = supabase.table("face_verification_logs").select("*").eq("attempt_id", aid).execute().data or []
    face_absence = sum(1 for f in face_logs if not f["face_detected"])
    multi_person = sum(1 for f in face_logs if f["person_count"] > 1)
    phone_detect = sum(1 for f in face_logs if f["phone_detected"])

    # ── Browser logs ──────────────────────────────────────────────────────────
    browser = (
        supabase.table("browser_activity_logs")
        .select("tab_switch_count,fullscreen_exit_count,session_conflict_detected")
        .eq("attempt_id", aid)
        .order("tab_switch_count", desc=True)
        .limit(1)
        .execute()
        .data
    ) or []
    tab_switches     = browser[0]["tab_switch_count"]          if browser else 0
    fs_exits         = browser[0]["fullscreen_exit_count"]     if browser else 0
    session_conflict = browser[0].get("session_conflict_detected", False) if browser else False

    # ── Audio logs ────────────────────────────────────────────────────────────
    audio_logs   = supabase.table("audio_monitoring_logs").select("id").eq("attempt_id", aid).eq("noise_detected", True).execute().data or []
    noise_events = len(audio_logs)

    # ── Integrity score ───────────────────────────────────────────────────────
    noise_penalty = p.get("noise_event", 0.02)
    penalty = (
        face_absence * p["face_absence"]    +
        multi_person * p["multi_person"]    +
        phone_detect * p["phone_detected"]  +
        tab_switches * p["tab_switch"]      +
        fs_exits     * p["fullscreen_exit"] +
        noise_events * noise_penalty
    )
    integrity_score = round(max(0.0, 1.0 - penalty), 4)
    total_incidents = face_absence + multi_person + phone_detect + tab_switches + fs_exits + noise_events
    tab_limit = _get_tab_switch_limit(supabase, aid)
    hard_violation = _hard_violation(tab_switches, tab_limit, session_conflict)
    flagged = integrity_score < 0.5 or hard_violation

    # Preserve an existing proctor decision — a recompute shouldn't silently
    # un-clear/un-violate an attempt a proctor already reviewed.
    existing = (
        supabase.table("proctoring_summary")
        .select("proctor_verdict")
        .eq("attempt_id", aid)
        .execute()
        .data
    ) or []
    proctor_verdict = existing[0]["proctor_verdict"] if existing and existing[0].get("proctor_verdict") else "PENDING"

    # ── Write final summary ───────────────────────────────────────────────────
    supabase.table("proctoring_summary").upsert(
        {
            "attempt_id":            aid,
            "integrity_score":       integrity_score,
            "total_incidents":       total_incidents,
            "face_absence_count":    face_absence,
            "multi_person_count":    multi_person,
            "phone_detection_count": phone_detect,
            "tab_switch_count":      tab_switches,
            "fullscreen_exit_count": fs_exits,
            "noise_event_count":     noise_events,
            "flagged_for_review":    flagged,
            "proctor_verdict":       proctor_verdict,
        },
        on_conflict="attempt_id",
    ).execute()

    return {
        "integrity_score": integrity_score,
        "flagged":         flagged,
        "noise_events":    noise_events,
        "tab_switches":    tab_switches,
        "hard_violation":  hard_violation,
    }


# ── Summary endpoints ─────────────────────────────────────────────────────────

@router.post("/summary/{attempt_id}")
async def compute_proctoring_summary(
    attempt_id: UUID,
    _: dict = Depends(require_student),
):
    """Called by the frontend on exam submission."""
    supabase = get_supabase_admin()
    return _compute_and_upsert_summary(supabase, str(attempt_id))


@router.post("/summary/{attempt_id}/recompute", dependencies=[Depends(require_proctor)])
async def recompute_proctoring_summary(attempt_id: UUID):
    """
    Proctor-only manual re-check. Re-runs the exact same computation as
    submission time, using whatever logs currently exist for the attempt.
    """
    supabase = get_supabase_admin()
    return _compute_and_upsert_summary(supabase, str(attempt_id))


# ── Proctor-only read endpoints ───────────────────────────────────────────────

@router.get("/summary/{attempt_id}", dependencies=[Depends(require_proctor)])
async def get_proctoring_summary(attempt_id: UUID):
    """
    Proctor/Admin view of a single attempt's proctoring summary.
    Students NEVER see this.
    """
    supabase = get_supabase_admin()
    aid = str(attempt_id)

    result = (
        supabase.table("proctoring_summary")
        .select("*")
        .eq("attempt_id", aid)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No proctoring summary for this attempt")

    audio_count = (
        supabase.table("audio_monitoring_logs")
        .select("id", count="exact")
        .eq("attempt_id", aid)
        .eq("noise_detected", True)
        .execute()
    ).count or 0

    return {**result.data, "noise_event_count": audio_count}


@router.patch("/verdict/{attempt_id}")
async def set_verdict(
    attempt_id: UUID,
    body: ProctoringVerdictBody,
    current_user: dict = Depends(require_proctor),
):
    """
    Proctor sets a verdict on a flagged attempt.
    Allowed values: CLEAN | SUSPICIOUS | VIOLATED | PENDING
    """
    allowed = {"CLEAN", "SUSPICIOUS", "VIOLATED", "PENDING"}
    if body.proctor_verdict not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"proctor_verdict must be one of: {', '.join(sorted(allowed))}",
        )

    supabase = get_supabase_admin()
    update: dict = {
        "proctor_verdict": body.proctor_verdict,
        "reviewed_by":     current_user["user_id"],
    }
    if body.flagged_for_review is not None:
        update["flagged_for_review"] = body.flagged_for_review

    supabase.table("proctoring_summary").update(update).eq("attempt_id", str(attempt_id)).execute()
    return {"message": "Verdict recorded"}


@router.get("/flagged", dependencies=[Depends(require_proctor)])
async def get_flagged_attempts():
    """
    Returns all attempts flagged for proctor review (PENDING verdict only).
    Attaches noise_event_count from audio_monitoring_logs to each row.
    """
    supabase = get_supabase_admin()

    flagged = (
        supabase.table("proctoring_summary")
        .select("*, exam_attempts(student_id, exam_schedule_id, users(full_name))")
        .eq("flagged_for_review", True)
        .eq("proctor_verdict", "PENDING")
        .order("integrity_score", desc=False)
        .execute()
        .data
    ) or []

    if not flagged:
        return []

    attempt_ids = [r["attempt_id"] for r in flagged]
    audio_rows  = (
        supabase.table("audio_monitoring_logs")
        .select("attempt_id")
        .eq("noise_detected", True)
        .in_("attempt_id", attempt_ids)
        .execute()
        .data
    ) or []

    noise_counts: dict[str, int] = {}
    for row in audio_rows:
        aid = row["attempt_id"]
        noise_counts[aid] = noise_counts.get(aid, 0) + 1

    for r in flagged:
        r["noise_event_count"] = noise_counts.get(r["attempt_id"], 0)

    return flagged