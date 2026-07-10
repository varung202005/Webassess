"""
backend/app/api/v1/endpoints/proctoring.py

CHANGES vs previous version:
  - POST /browser: now syncs tab_switch_count + fullscreen_exit_count into
    proctoring_summary LIVE (not just on exam submission), so the dashboard
    stat cards show real-time counts.
  - POST /browser: now also INSERTs separate event rows into
    browser_activity_logs with an event_type column so the Supabase Realtime
    channel in Dashboard.tsx fires Live Alerts on every tab switch.
  - All other endpoints unchanged.

WHO DOES WHAT:
  - Camera / mic access request     → FRONTEND only (browser MediaDevices API)
  - Face detection ML model         → FRONTEND only (runs in browser)
  - Log face verification result    → BACKEND  POST /proctoring/face
  - Tab / fullscreen detection      → FRONTEND (document.visibilityState, fullscreenchange)
  - Log browser activity            → BACKEND  POST /proctoring/browser  ← FIXED
  - Audio noise detection           → FRONTEND (WebAudio API) + BACKEND POST /proctoring/audio
  - View proctoring summary         → BACKEND  GET  /proctoring/summary/:id  (Proctor/Admin)
  - Integrity score calculation     → BACKEND  POST /proctoring/summary/:id  (on submission)

  STUDENTS NEVER ACCESS PROCTORING DATA — enforced by RLS + role checks.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import os
import subprocess
import tempfile
import difflib
import urllib.request

from app.core.security import require_student, require_proctor
from app.db.supabase import get_supabase_admin
from app.core.config import settings

router = APIRouter()


# ── Shared helpers ────────────────────────────────────────────────────────────

def _get_tab_switch_limit(supabase, attempt_id: str) -> int:
    """
    Look up exam_rules.max_tab_switches for the exam this attempt belongs to.

    Uses Supabase's relationship embedding (attempt -> schedule -> exam ->
    exam_rules) the same way the rest of this codebase resolves nested
    relations (e.g. exam_schedules(exams(title,courses(code))) elsewhere) —
    this avoids hard-coding a foreign-key column name that may not match
    the actual schema.
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
    # rather than exam_id — try that path before giving up.
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
    score works out to. Small per-event penalties can otherwise leave the
    score above the 0.5 cutoff even though the exam was force-submitted.
    """
    return bool(session_conflict) or (tab_limit > 0 and tab_switch_count >= tab_limit)


# ── Phase 2: self-hosted whisper.cpp transcription (free, no API cost) ───────
#
# This is intentionally "pluggable" so the rest of the app works today with
# or without a server actually running whisper.cpp:
#
#   - Not configured yet (no WHISPER_CPP_BIN env var) → _transcribe_audio()
#     returns None immediately, audio_monitoring_logs just gets a row with
#     transcript=None, exam_relevant=False. Nothing breaks.
#
#   - Once you have ANY machine (a $5/mo VPS is plenty) with whisper.cpp
#     built and a model downloaded, set two env vars and it activates with
#     no further code changes:
#       WHISPER_CPP_BIN=/path/to/whisper.cpp/main
#       WHISPER_MODEL_PATH=/path/to/whisper.cpp/models/ggml-base.en.bin
#     (ffmpeg must also be on PATH — used to convert the browser's webm/opus
#     clip into the 16kHz mono WAV whisper.cpp expects.)

def _transcribe_audio(audio_url: str) -> Optional[str]:
    """
    Downloads the uploaded clip, converts it to 16kHz mono WAV via ffmpeg,
    and runs it through a self-hosted whisper.cpp binary. Returns the
    transcript, or None if transcription isn't configured / fails for any
    reason (never raises — a missing whisper.cpp setup should degrade to
    "no transcript available", not break audio logging).
    """
    whisper_bin   = os.environ.get("WHISPER_CPP_BIN")
    whisper_model = os.environ.get("WHISPER_MODEL_PATH")
    if not whisper_bin or not whisper_model:
        return None  # Phase 2 not deployed yet — safe no-op

    try:
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = os.path.join(tmp, "clip.webm")
            wav_path = os.path.join(tmp, "clip.wav")

            urllib.request.urlretrieve(audio_url, raw_path)

            subprocess.run(
                ["ffmpeg", "-y", "-i", raw_path, "-ar", "16000", "-ac", "1", wav_path],
                check=True, capture_output=True, timeout=30,
            )

            result = subprocess.run(
                [whisper_bin, "-m", whisper_model, "-f", wav_path, "-otxt", "-of", os.path.join(tmp, "out")],
                check=True, capture_output=True, timeout=60, text=True,
            )

            txt_path = os.path.join(tmp, "out.txt")
            if os.path.exists(txt_path):
                with open(txt_path, "r", encoding="utf-8") as f:
                    return f.read().strip() or None
            # Some whisper.cpp builds print straight to stdout instead
            return (result.stdout or "").strip() or None
    except Exception as exc:
        print(f"[proctoring] whisper.cpp transcription failed (non-fatal): {exc}")
        return None


def _check_exam_relevance(supabase, attempt_id: str, transcript: str) -> tuple[bool, Optional[str]]:
    """
    Free, deterministic relevance check — no LLM call needed. Fetches the
    exam's own question/answer text and fuzzy-matches it against the
    transcript, so "are they talking about the paper" is answered by direct
    comparison against the actual exam content rather than a guess.

    NOTE: adjust the table/column names below (`exam_questions` /
    `question_text`) to match your actual schema if they differ — wrapped
    in try/except so a schema mismatch degrades to "no match found"
    instead of crashing the endpoint.
    """
    try:
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

        questions = (
            supabase.table("exam_questions")
            .select("question_text")
            .eq("exam_id", exam_id)
            .execute()
            .data
        ) or []
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
    focus_loss_count: int = 0
    clipboard_violation_count: int = 0
    screenshot_violation_count: int = 0
    print_violation_count: int = 0
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
    real detection results here — no more hardcoded true/false.

    FIX — live proctoring_summary sync:
      Previously face events only affected flagged status once the exam was
      submitted (compute_proctoring_summary aggregates the whole log table
      at that point). That meant a phone caught mid-exam never showed up on
      Flagged Attempts until the student finished. Now we recompute the
      cumulative face-related counts and upsert proctoring_summary on every
      event, same pattern already used for tab-switch/fullscreen syncing.
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

    # A phone in frame or multiple people detected is serious enough to flag
    # immediately, regardless of what the blended score works out to — same
    # "hard violation" treatment already applied to tab-switch-limit breaches.
    #
    # FIX: this must look at the CUMULATIVE counts (phone_detect, multi_person
    # — already computed above from all_face_logs), not just the current
    # frame's body. Using body.phone_detected/body.person_count meant a
    # single later "clean" frame (phone put down, back to 1 person) would
    # upsert hard_violation=False and silently un-flag a student who was
    # genuinely caught with a phone moments earlier — this row's upsert
    # replaces the whole flagged_for_review value, so the earlier true
    # violation was being erased instead of staying flagged.
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

    FIX 1 — Live proctoring_summary sync:
      Previously this only wrote to browser_activity_logs (1 row per attempt,
      upserted). proctoring_summary.tab_switch_count was only written on exam
      submission, so the dashboard always showed 0 during a live exam.
      Now we update proctoring_summary immediately so the stat cards are live.

    FIX 2 — Realtime INSERT rows for Live Alerts:
      The Supabase Realtime channel in Dashboard.tsx listens for INSERT on
      browser_activity_logs. The old upsert only ever fired the Realtime
      trigger once (on first insert). Now we INSERT a separate event row
      with event_type so every tab switch fires a Live Alert.

    FIX 3 — browser_activity_summary was never being written:
      proctor.py's dashboard endpoint reads cumulative tab-switch /
      fullscreen-exit counts from a SEPARATE table, browser_activity_summary
      (one row per attempt), not from browser_activity_logs. This endpoint
      was only ever upserting into browser_activity_logs, so the dashboard's
      Students panel / tab-switch stat cards were reading a table nothing
      wrote to — always stale/empty regardless of real activity. Now the
      cumulative row is upserted into browser_activity_summary too.
    """
    supabase = get_supabase_admin()
    aid = str(body.attempt_id)
    p   = settings.INTEGRITY_SCORE_PENALTIES

    # ── 1. Upsert the cumulative activity row (unchanged behaviour) ───────────
    #    browser_activity_logs stays as the per-event/history table used by
    #    Realtime + compute_proctoring_summary()'s final read.
    supabase.table("browser_activity_logs").upsert(
        {
            "attempt_id":                aid,
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "focus_loss_count":          body.focus_loss_count,
            "clipboard_violation_count": body.clipboard_violation_count,
            "screenshot_violation_count":body.screenshot_violation_count,
            "print_violation_count":     body.print_violation_count,
            "session_conflict_detected": body.session_conflict_detected,
        },
        on_conflict="attempt_id",
    ).execute()

    # ── 1b. FIX: also upsert into browser_activity_summary ────────────────────
    #    This is the table the dashboard (proctor.py) actually reads
    #    cumulative counts from for the Students panel / stat cards.
    try:
        supabase.table("browser_activity_summary").upsert(
            {
                "attempt_id":            aid,
                "tab_switch_count":      body.tab_switch_count,
                "fullscreen_exit_count": body.fullscreen_exit_count,
                "focus_loss_count":          body.focus_loss_count,
                "clipboard_violation_count": body.clipboard_violation_count,
                "screenshot_violation_count":body.screenshot_violation_count,
                "print_violation_count":     body.print_violation_count,
            },
            on_conflict="attempt_id",
        ).execute()
    except Exception as exc:
        # Don't let a missing/misnamed browser_activity_summary table break
        # the whole /browser sync — log it and carry on, since
        # browser_activity_logs (above) still succeeded.
        print(f"[proctoring] browser_activity_summary upsert failed (non-fatal): {exc}")

    # ── 2. FIX: INSERT a separate event row per violation type ────────────────
    #    These INSERT rows are what fires the Supabase Realtime trigger
    #    in Dashboard.tsx → populates Live Alerts in real time.
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

    if body.focus_loss_count > 0:
        supabase.table("browser_activity_logs").insert({
            "attempt_id":                aid,
            "event_type":                "FOCUS_LOST",
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        }).execute()

    if body.clipboard_violation_count > 0:
        supabase.table("browser_activity_logs").insert({
            "attempt_id":                aid,
            "event_type":                "CLIPBOARD",
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        }).execute()

    if body.screenshot_violation_count > 0:
        supabase.table("browser_activity_logs").insert({
            "attempt_id":                aid,
            "event_type":                "SCREENSHOT",
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        }).execute()

    if body.print_violation_count > 0:
        supabase.table("browser_activity_logs").insert({
            "attempt_id":                aid,
            "event_type":                "PRINT",
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

    # ── 3. FIX: sync into proctoring_summary live ─────────────────────────────
    #    Compute a partial integrity score from browser events only.
    #    When the exam is submitted, compute_proctoring_summary() will
    #    overwrite this with the full score including face + audio.
    tab_penalty = body.tab_switch_count      * p.get("tab_switch",      0.03)
    fs_penalty  = body.fullscreen_exit_count * p.get("fullscreen_exit", 0.02)
    focus_penalty     = body.focus_loss_count          * p.get("focus_loss", 0.02)
    clipboard_penalty = body.clipboard_violation_count * p.get("clipboard",  0.05)
    screenshot_penalty= body.screenshot_violation_count* p.get("screenshot", 0.10)
    print_penalty     = body.print_violation_count     * p.get("print",      0.10)
    
    total_browser_penalty = tab_penalty + fs_penalty + focus_penalty + clipboard_penalty + screenshot_penalty + print_penalty
    partial_integrity = round(max(0.0, 1.0 - total_browser_penalty), 4)
    tab_limit = _get_tab_switch_limit(supabase, aid)
    hard_violation = _hard_violation(body.tab_switch_count, tab_limit, body.session_conflict_detected)
    # A student is flagged either once their integrity score drops below 50%,
    # OR immediately if they've been shut down for breaching a hard rule
    # (tab-switch limit / duplicate session) — even if the score alone
    # wouldn't have crossed the threshold yet.
    should_flag = partial_integrity < 0.5 or hard_violation

    # Check if a summary row already exists for this attempt
    existing = (
        supabase.table("proctoring_summary")
        .select("attempt_id, integrity_score, face_absence_count, multi_person_count, phone_detection_count, noise_event_count")
        .eq("attempt_id", aid)
        .execute()
        .data
    )

    if existing:
        # Update only browser-related fields — preserve face/audio counts
        # already recorded. Recompute integrity using all known penalties.
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
            max(0.0, 1.0 - total_browser_penalty - face_penalty - noise_penalty),
            4,
        )
        full_flagged = full_integrity < 0.5 or hard_violation

        supabase.table("proctoring_summary").update({
            "tab_switch_count":      body.tab_switch_count,
            "fullscreen_exit_count": body.fullscreen_exit_count,
            "focus_loss_count":          body.focus_loss_count,
            "clipboard_violation_count": body.clipboard_violation_count,
            "screenshot_violation_count":body.screenshot_violation_count,
            "print_violation_count":     body.print_violation_count,
            "integrity_score":       full_integrity,
            "flagged_for_review":    full_flagged,
            # Keep proctor_verdict as-is — don't overwrite a proctor decision
        }).eq("attempt_id", aid).execute()

    else:
        # First browser sync for this attempt — create the summary row
        supabase.table("proctoring_summary").insert({
            "attempt_id":            aid,
            "tab_switch_count":      body.tab_switch_count,
            "fullscreen_exit_count": body.fullscreen_exit_count,
            "focus_loss_count":          body.focus_loss_count,
            "clipboard_violation_count": body.clipboard_violation_count,
            "screenshot_violation_count":body.screenshot_violation_count,
            "print_violation_count":     body.print_violation_count,
            "integrity_score":       partial_integrity,
            "total_incidents":       body.tab_switch_count + body.fullscreen_exit_count + body.focus_loss_count + body.clipboard_violation_count + body.screenshot_violation_count + body.print_violation_count,
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
    detects sustained speech (not idle noise), with a short recorded clip
    already uploaded to Supabase Storage.

    Transcribes via self-hosted whisper.cpp (see _transcribe_audio — no-ops
    safely if it isn't deployed yet) and checks the transcript against the
    exam's own question text (free, deterministic — see
    _check_exam_relevance) instead of an LLM call.
    """
    supabase = get_supabase_admin()
    aid = str(body.attempt_id)

    transcript = _transcribe_audio(body.audio_url)

    exam_relevant = False
    matched_snippet: Optional[str] = None
    if transcript:
        exam_relevant, matched_snippet = _check_exam_relevance(supabase, aid, transcript)

    notes = None
    if transcript and exam_relevant:
        notes = f"Speech matched exam content: \"{matched_snippet}\""
    elif transcript:
        notes = f"Speech detected (not exam-related): \"{transcript[:80]}\""
    else:
        notes = "Speech detected — transcription unavailable (whisper.cpp not configured)"

    supabase.table("audio_monitoring_logs").insert({
        "attempt_id":       aid,
        "noise_detected":   True,
        "noise_level_db":   None,
        "notes":            notes,
        "transcript":       transcript,
        "exam_relevant":    exam_relevant,
        "matched_snippet":  matched_snippet,
        "audio_url":        body.audio_url,
    }).execute()

    # Speech that directly matches the exam's own question/answer content is
    # serious enough to flag immediately — same "hard violation" treatment
    # as the tab-switch-limit and phone-detection cases.
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
        .select("tab_switch_count,fullscreen_exit_count,focus_loss_count,clipboard_violation_count,screenshot_violation_count,print_violation_count,session_conflict_detected")
        .eq("attempt_id", aid)
        .order("tab_switch_count", desc=True)
        .limit(1)
        .execute()
        .data
    ) or []
    tab_switches     = browser[0].get("tab_switch_count", 0) if browser else 0
    fs_exits         = browser[0].get("fullscreen_exit_count", 0) if browser else 0
    focus_loss       = browser[0].get("focus_loss_count", 0) if browser else 0
    clipboard        = browser[0].get("clipboard_violation_count", 0) if browser else 0
    screenshot       = browser[0].get("screenshot_violation_count", 0) if browser else 0
    print_count      = browser[0].get("print_violation_count", 0) if browser else 0
    session_conflict = browser[0].get("session_conflict_detected", False) if browser else False

    # ── Audio logs ────────────────────────────────────────────────────────────
    audio_logs   = supabase.table("audio_monitoring_logs").select("id").eq("attempt_id", aid).eq("noise_detected", True).execute().data or []
    noise_events = len(audio_logs)

    # ── Integrity score ───────────────────────────────────────────────────────
    noise_penalty = p.get("noise_event", 0.02)
    penalty = (
        face_absence * p.get("face_absence", 0.05)    +
        multi_person * p.get("multi_person", 0.10)    +
        phone_detect * p.get("phone_detected", 0.10)  +
        tab_switches * p.get("tab_switch", 0.03)      +
        fs_exits     * p.get("fullscreen_exit", 0.02) +
        focus_loss   * p.get("focus_loss", 0.02)      +
        clipboard    * p.get("clipboard", 0.05)       +
        screenshot   * p.get("screenshot", 0.10)      +
        print_count  * p.get("print", 0.10)           +
        noise_events * noise_penalty
    )
    integrity_score = round(max(0.0, 1.0 - penalty), 4)
    total_incidents = face_absence + multi_person + phone_detect + tab_switches + fs_exits + focus_loss + clipboard + screenshot + print_count + noise_events
    tab_limit = _get_tab_switch_limit(supabase, aid)
    hard_violation = _hard_violation(tab_switches, tab_limit, session_conflict)
    # Flag threshold: a student shows up in "Flagged Attempts" once their
    # integrity score falls below 50% — OR immediately, regardless of score,
    # if their exam was shut down for breaching a hard rule (tab-switch limit
    # exceeded / duplicate session detected).
    flagged = integrity_score < 0.5 or hard_violation

    # Preserve an existing proctor decision — a recompute shouldn't silently
    # un-clear/un-violate an attempt a proctor already reviewed. Only default
    # to PENDING if there's no prior row or verdict yet.
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
            "focus_loss_count":          focus_loss,
            "clipboard_violation_count": clipboard,
            "screenshot_violation_count":screenshot,
            "print_violation_count":     print_count,
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


# ── Summary computation (called on exam submission) ───────────────────────────

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

    Useful for attempts whose flagged status was computed under an older
    version of the flagging rules (e.g. a tab-switch-limit shutdown that
    wasn't yet treated as an automatic flag) — a proctor can force a
    recheck without needing the student's session.
    """
    supabase = get_supabase_admin()
    return _compute_and_upsert_summary(supabase, str(attempt_id))


# ── Proctor-only read endpoints ───────────────────────────────────────────────

@router.get("/summary/{attempt_id}", dependencies=[Depends(require_proctor)])
async def get_proctoring_summary(attempt_id: UUID):
    """
    Proctor/Admin view of a single attempt's proctoring summary.
    Includes noise_event_count from audio_monitoring_logs.
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