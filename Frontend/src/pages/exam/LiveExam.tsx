/**
 * LiveExam.tsx — with question image support
 *
 * Changes vs previous version:
 *   • ExamQuestion type now includes image_url on the nested questions object.
 *   • QuestionImage component renders the image between the question stem and
 *     the answer options — fullscreen-safe, zoom-on-click, anti-screenshot
 *     watermark inherits from the parent overlay.
 *   • All proctoring, force-submit, and browser-monitor logic is unchanged.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { studentApi } from "../../features/student/api";
import { apiMessage } from "../../features/student/format";
import type { ExamQuestion } from "../../features/student/types";
import "./liveExam.css";
import "./liveExam.proctor.css";
import WebcamCapture from "../../features/proctor/WebcamCapture";
import AudioMonitor from "../../features/proctor/AudioMonitor";
import BrowserMonitor from "../../features/proctor/BrowserMonitor";
import CameraPermission from "../../features/proctor/CameraPermission";
import { useAuthStore } from "../../store/authStore";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnswerState {
  selected_option_id?: string | null;
  selected_option_ids?: string[];
  answer_text?: string;
  is_marked_for_review: boolean;
  time_spent_sec: number;
}

type ViolationType = "tab" | "fullscreen" | "conflict" | "focus" | "clipboard" | "screenshot" | "print";

interface ViolationWarning {
  id: number;
  type: ViolationType;
  message: string;
}

interface ExamRule {
  fullscreen_required: boolean;
  proctoring_enabled: boolean;
  camera_required: boolean;
  microphone_required: boolean;
  max_tab_switches: number;
  max_fullscreen_exits: number;
  auto_save_interval_sec: number;
}

let warnCounter = 0;

function getRule(session: any): ExamRule {
  const raw = Array.isArray(session?.exam?.exam_rules)
    ? session.exam.exam_rules[0]
    : session?.exam?.exam_rules;
  return {
    fullscreen_required:    raw?.require_fullscreen     ?? true,
    proctoring_enabled:     raw?.enable_proctoring      ?? false,
    camera_required:        raw?.camera_required        ?? false,
    microphone_required:    raw?.microphone_required    ?? false,
    max_tab_switches:       raw?.max_tab_switches       ?? 3,
    max_fullscreen_exits:   raw?.max_fullscreen_exits   ?? 3,
    auto_save_interval_sec: raw?.auto_save_interval_sec ?? 30,
  };
}

// ── Beacon flush ───────────────────────────────────────────────────────────────

function flushBrowserCountsBeacon(
  attemptId: string,
  tabCount: number,
  fsCount: number,
  sessionConflict = false,
) {
  const body = JSON.stringify({
    attempt_id:                attemptId,
    tab_switch_count:          tabCount,
    fullscreen_exit_count:     fsCount,
    session_conflict_detected: sessionConflict,
  });

  const token = (() => {
    try {
      const raw = localStorage.getItem("sb-clagdndeswnnacybvilh-auth-token");
      if (raw) return JSON.parse(raw)?.access_token ?? "";
    } catch { /* ignore */ }
    return "";
  })();

  const BACKEND = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  return fetch(`${BACKEND}/api/v1/proctoring/browser`, {
    method:    "POST",
    headers:   {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

// ── NEW: QuestionImage ─────────────────────────────────────────────────────────
//
// Renders the image attached to a question between the stem and the options.
// Clicking the image opens a lightbox overlay for a better look — useful for
// diagrams, circuit schematics, graphs, etc.
//
// Anti-screenshot note: the parent `.live-exam` already has a semi-transparent
// watermark overlay (`.exam-watermark`) that sits above all content at z-index
// lower than the lightbox. The lightbox also carries the watermark so the
// student's email is always visible over the zoomed image.

interface QuestionImageProps {
  src: string;
  studentEmail: string;
}

function QuestionImage({ src, studentEmail }: QuestionImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError,     setImgError]     = useState(false);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen]);

  if (imgError) return null;   // silently hide broken images

  return (
    <>
      {/* ── Inline image ── */}
      <div
        className="question-image-wrap"
        style={{
          margin: "18px 0 22px",
          borderRadius: 12,
          overflow: "hidden",
          border: "1.5px solid #e5e7eb",
          background: "#f9fafb",
          display: "inline-block",
          maxWidth: "100%",
          cursor: "zoom-in",
          position: "relative",
        }}
        onClick={() => setLightboxOpen(true)}
        title="Click to enlarge"
      >
        <img
          src={src}
          alt="Question illustration"
          onError={() => setImgError(true)}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: 340,
            objectFit: "contain",
            userSelect: "none",
            // Discourage casual right-click saving (not a hard block).
            // WebkitUserDrag isn't declared in React's CSSProperties type,
            // so the *entire* literal is typed against an intersection that
            // adds it — this is what avoids the excess-property-check error
            // (casting just the value, e.g. `"none" as any`, does NOT work
            // because TS still validates the key against CSSProperties).
            WebkitUserDrag: "none",
          } as React.CSSProperties & { WebkitUserDrag?: string }}
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
        />
        {/* Zoom hint badge */}
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          background: "rgba(0,0,0,0.45)", color: "#fff",
          borderRadius: 6, padding: "3px 8px", fontSize: 11,
          display: "flex", alignItems: "center", gap: 4,
          pointerEvents: "none",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
          </svg>
          Click to zoom
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {/* Watermark inside lightbox so it overlays the enlarged image too */}
          <div
            className="exam-watermark"
            aria-hidden="true"
            style={{ zIndex: 2001 }}
          >
            {Array.from({ length: 150 }).map((_, i) => (
              <span key={i}>{studentEmail}</span>
            ))}
          </div>

          <img
            src={src}
            alt="Question illustration — enlarged"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
            style={{
              maxWidth: "92vw",
              maxHeight: "88vh",
              objectFit: "contain",
              borderRadius: 10,
              boxShadow: "0 8px 60px rgba(0,0,0,0.6)",
              position: "relative",
              zIndex: 2002,
              userSelect: "none",
            }}
          />

          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            style={{
              position: "fixed", top: 18, right: 22,
              background: "rgba(255,255,255,0.15)",
              border: "none", borderRadius: "50%",
              width: 38, height: 38,
              color: "#fff", fontSize: 20,
              cursor: "pointer", zIndex: 2003,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Close (Esc)"
          >
            ✕
          </button>

          {/* Keyboard hint */}
          <div style={{
            position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.5)", fontSize: 12, zIndex: 2003,
            pointerEvents: "none",
          }}>
            Press Esc or click outside to close
          </div>
        </div>
      )}
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LiveExam() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();

  const sessionQuery = useQuery({
    queryKey: ["exam-session", scheduleId],
    queryFn:  () => studentApi.examSession(scheduleId!),
    enabled:  Boolean(scheduleId),
    retry:    false,
  });
  const answersQuery = useQuery({
    queryKey: ["exam-answers", sessionQuery.data?.attempt.id],
    queryFn:  () => studentApi.savedAnswers(sessionQuery.data!.attempt.id),
    enabled:  Boolean(sessionQuery.data?.attempt.id),
  });

  const [index,         setIndex]         = useState(0);
  const [answers,       setAnswers]       = useState<Record<string, AnswerState>>({});
  const [visited,       setVisited]       = useState<Set<string>>(new Set());
  const [remaining,     setRemaining]     = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [lastSaved,     setLastSaved]     = useState<Date | null>(null);
  const [submitOpen,    setSubmitOpen]    = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [cameraCleared, setCameraCleared] = useState(false);
  const [isFullscreen,  setIsFullscreen]  = useState(() => Boolean(document.fullscreenElement));
  const [isOnline,      setIsOnline]      = useState(navigator.onLine);

  const [warnings,        setWarnings]        = useState<ViolationWarning[]>([]);
  const [tabCount,        setTabCount]        = useState(0);
  const [fsCount,         setFsCount]         = useState(0);
  const [forceSubmitting, setForceSubmitting] = useState(false);
  const [forceReason,     setForceReason]     = useState("");

  const dirty              = useRef(new Set<string>());
  const submitted          = useRef(false);
  const enteredAt          = useRef(Date.now());
  const tabCountRef        = useRef(0);
  const fullscreenCountRef = useRef(0);

  const session     = sessionQuery.data;
  const currentUser = useAuthStore((s) => s.user);
  const rule        = getRule(session);

  // ── Restore saved answers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!answersQuery.data) return;
    setAnswers(Object.fromEntries(answersQuery.data.map((a) => [
      a.question_id,
      {
        selected_option_id:  a.selected_option_id,
        selected_option_ids: a.selected_option_ids ?? [],
        answer_text:         a.answer_text ?? "",
        is_marked_for_review: a.is_marked_for_review,
        time_spent_sec:      a.time_spent_sec,
      },
    ])));
  }, [answersQuery.data]);

  // ── Countdown ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const update = () =>
      setRemaining(Math.max(0, Math.floor((new Date(session.effective_deadline).getTime() - Date.now()) / 1000)));
    update();
    const t = window.setInterval(update, 1000);
    return () => window.clearInterval(t);
  }, [session]);

  // ── Track fullscreen ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ── Navigation Lockdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || submitting || forceSubmitting) return;
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [session, submitting, forceSubmitting]);

  // ── Flush answers to backend ─────────────────────────────────────────────────
  const flushAnswers = useCallback(async () => {
    if (!session || !dirty.current.size) return;
    const ids = [...dirty.current];
    setSaving(true);
    try {
      await Promise.all(ids.map((qid) => studentApi.saveAnswer({
        attempt_id:  session.attempt.id,
        question_id: qid,
        ...answers[qid],
      })));
      ids.forEach((id) => dirty.current.delete(id));
      setLastSaved(new Date());
    } catch (cause) {
      setError(`Auto-save failed: ${apiMessage(cause)}`);
    } finally {
      setSaving(false);
    }
  }, [session, answers]);

  // ── Core submit ──────────────────────────────────────────────────────────────
  const submit = useCallback(async (type: "MANUAL" | "AUTO") => {
    if (!session || submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await flushAnswers();
      await studentApi.computeProctoringsSummary(session.attempt.id).catch(() => undefined);
      await studentApi.submitAttempt(session.attempt.id, type);
      navigate("/student/history", { replace: true, state: { submitted: true } });
    } catch (cause) {
      submitted.current = false;
      setError(apiMessage(cause));
      setSubmitting(false);
    }
  }, [session, navigate, flushAnswers]);

  // ── Auto-submit on deadline ──────────────────────────────────────────────────
  useEffect(() => {
    if (session && remaining === 0 &&
        Date.now() >= new Date(session.effective_deadline).getTime() &&
        !submitted.current)
      void submit("AUTO");
  }, [remaining, session, submit]);

  // ── Auto-save ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const interval = Math.max(5, rule.auto_save_interval_sec) * 1000;
    const t = window.setInterval(() => void flushAnswers(), interval);
    return () => window.clearInterval(t);
  }, [session, flushAnswers, rule.auto_save_interval_sec]);

  // ── Connection events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const online  = () => {
      setIsOnline(true);
      void studentApi.logEvent(session.attempt.id, "CONNECTION_RESTORED").catch(() => undefined);
      void flushAnswers();
    };
    const offline = () => {
      setIsOnline(false);
      void studentApi.logEvent(session.attempt.id, "CONNECTION_LOST").catch(() => undefined);
    };
    window.addEventListener("online",  online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online",  online);
      window.removeEventListener("offline", offline);
    };
  }, [session, flushAnswers]);

  // ── Force-submit helper ───────────────────────────────────────────────────────
  const triggerForceSubmit = useCallback((
    reason: string,
    finalTabCount: number,
    finalFsCount: number,
    sessionConflict = false,
  ) => {
    setForceReason(reason);
    setForceSubmitting(true);

    const attemptId = session?.attempt.id ?? "";

    setTimeout(async () => {
      await flushBrowserCountsBeacon(attemptId, finalTabCount, finalFsCount, sessionConflict);
      await new Promise((r) => setTimeout(r, 600));
      await studentApi.computeProctoringsSummary(attemptId).catch(() => undefined);
      void submit("AUTO");
    }, 4000);
  }, [session?.attempt.id, submit]);

  // ── Violation handler ────────────────────────────────────────────────────────
  const handleViolation = useCallback((
    _message: string,
    type: ViolationType,
  ) => {
    if (type === "tab" || type === "focus") {
      tabCountRef.current += 1;
      const newCount = tabCountRef.current;
      setTabCount(newCount);
      const max = rule.max_tab_switches;

      void studentApi.logEvent(
        session?.attempt.id ?? "",
        type === "focus" ? "FOCUS_LOST_WARNING" : "TAB_SWITCH_WARNING"
      ).catch(() => undefined);

      if (max > 0 && newCount >= max) {
        const reason = `You switched tabs or lost focus ${newCount} time${newCount !== 1 ? "s" : ""}, exceeding the limit of ${max} set for this exam. Your exam is being submitted automatically.`;
        triggerForceSubmit(reason, newCount, fullscreenCountRef.current);
        return;
      }

      const id = ++warnCounter;
      setWarnings((prev) => [{
        id,
        type,
        message: max <= 0
          ? `⚠ ${_message}`
          : newCount >= max
          ? `🚨 Switch ${newCount}/${max} — You have exceeded the limit of allowed switches! This violation has been flagged for review.`
          : `⚠ Switch ${newCount}/${max} — This violation has been logged and flagged for review.`,
      }, ...prev].slice(0, 5));
      setTimeout(() => setWarnings((prev) => prev.filter((w) => w.id !== id)), 10_000);

    } else if (type === "fullscreen") {
      fullscreenCountRef.current += 1;
      const newCount = fullscreenCountRef.current;
      setFsCount(newCount);
      const max = rule.max_fullscreen_exits;

      void studentApi.logEvent(session?.attempt.id ?? "", "FULLSCREEN_EXIT").catch(() => undefined);

      if (max > 0 && newCount >= max) {
        const reason = `You exited fullscreen ${newCount} time${newCount !== 1 ? "s" : ""}, exceeding the limit of ${max} set for this exam. Your exam is being submitted automatically.`;
        triggerForceSubmit(reason, tabCountRef.current, newCount);
        return;
      }

      const id = ++warnCounter;
      setWarnings((prev) => [{
        id,
        type: "fullscreen" as ViolationType,
        message: max <= 0
          ? `⚠ You exited fullscreen (${newCount} total). This has been logged.`
          : newCount >= max
          ? `🚨 Fullscreen exit ${newCount}/${max} — You have exceeded the limit of allowed exits! This violation has been flagged for review.`
          : `⚠ Fullscreen exit ${newCount}/${max} — This violation has been logged and flagged for review.`,
      }, ...prev].slice(0, 5));
      setTimeout(() => setWarnings((prev) => prev.filter((w) => w.id !== id)), 12_000);

    } else if (type === "conflict") {
      const id = ++warnCounter;
      setWarnings((prev) => [{
        id,
        type: "conflict" as ViolationType,
        message: "🚨 Another tab with this exam was detected. Close it immediately — this is a violation.",
      }, ...prev].slice(0, 5));

    } else if (type === "clipboard" || type === "screenshot" || type === "print") {
      const id = ++warnCounter;
      void studentApi.logEvent(
        session?.attempt.id ?? "",
        `${type.toUpperCase()}_ATTEMPT_WARNING`
      ).catch(() => undefined);
      setWarnings((prev) => [{
        id,
        type,
        message: _message,
      }, ...prev].slice(0, 5));
      setTimeout(() => setWarnings((prev) => prev.filter((w) => w.id !== id)), 8_000);
    }
  }, [rule.max_tab_switches, rule.max_fullscreen_exits, session, triggerForceSubmit]);

  const handleConflict = useCallback(() => {
    triggerForceSubmit(
      "🚨 Another tab with this exam was detected. This is a violation. Your exam is being submitted automatically.",
      tabCountRef.current,
      fullscreenCountRef.current,
      true,
    );
  }, [triggerForceSubmit]);

  const handleHeartbeatFailure = useCallback(() => {
    triggerForceSubmit(
      "Proctoring telemetry has been blocked or dropped consecutively. This is a violation. Your exam is being submitted automatically.",
      tabCountRef.current,
      fullscreenCountRef.current,
    );
  }, [triggerForceSubmit]);

  // ── Answer helpers ───────────────────────────────────────────────────────────
  const questions = useMemo(() => {
    if (!session?.questions) return [];
    const seedGen = xmur3(session.attempt.id);
    const rand = mulberry32(seedGen());
    const shuffledQuestions = [...session.questions].map(q => ({
      ...q,
      questions: {
        ...q.questions,
        question_options: seededShuffle([...q.questions.question_options], rand)
      }
    }));
    return seededShuffle(shuffledQuestions, rand);
  }, [session?.attempt.id, session?.questions]);

  const row           = questions[index];
  const question      = row?.questions;
  const currentAnswer = question ? answers[question.id] ?? emptyAnswer() : emptyAnswer();

  const changeAnswer = (next: Partial<AnswerState>) => {
    if (!question) return;
    const elapsed = Math.floor((Date.now() - enteredAt.current) / 1000);
    const value = { ...currentAnswer, ...next, time_spent_sec: currentAnswer.time_spent_sec + elapsed };
    enteredAt.current = Date.now();
    setAnswers((s) => ({ ...s, [question.id]: value }));
    dirty.current.add(question.id);
  };

  const goTo = (next: number) => {
    if (!session || !question || next < 0 || next >= questions.length) return;
    const action = hasAnswer(currentAnswer) ? "ANSWERED" : "SKIPPED";
    void studentApi.navigate({ attempt_id: session.attempt.id, question_id: question.id, action }).catch(() => undefined);
    void flushAnswers();
    setVisited((s) => new Set(s).add(question.id));
    setIndex(next);
    enteredAt.current = Date.now();
  };

  const summary = useMemo(() => {
    const values = questions.map((item) => answers[item.questions.id] ?? emptyAnswer());
    return {
      answered:   values.filter(hasAnswer).length,
      flagged:    values.filter((v) => v.is_marked_for_review).length,
      unanswered: values.filter((v) => !hasAnswer(v)).length,
    };
  }, [answers, questions]);

  // ── Camera gate ──────────────────────────────────────────────────────────────
  if (session && !cameraCleared) {
    if (rule.camera_required || rule.proctoring_enabled || rule.fullscreen_required) {
      const proceedPastGate = () => {
        if (rule.fullscreen_required && document.fullscreenElement === null) {
          document.documentElement.requestFullscreen().catch((err) =>
            console.warn("[LiveExam] Could not enter fullscreen on gate click:", err)
          );
        }
        setCameraCleared(true);
      };
      return (
        <CameraPermission
          examTitle={session.exam.title}
          courseCode={session.exam.courses?.code ?? ""}
          cameraRequired={rule.camera_required}
          onProceed={proceedPastGate}
          onSkip={proceedPastGate}
        />
      );
    }
    setCameraCleared(true);
  }

  // ── Loading / error states ────────────────────────────────────────────────────
  if (sessionQuery.isLoading || answersQuery.isLoading)
    return (
      <div className="exam-state">
        <span className="spinner" />
        Preparing your secure exam session...
      </div>
    );
  if (sessionQuery.error || !session)
    return (
      <div className="exam-state error">
        <i className="ti ti-alert-triangle" />
        <h2>Unable to open exam</h2>
        <p>{apiMessage(sessionQuery.error)}</p>
        <button className="btn btn-primary" onClick={() => navigate("/student/registered")}>
          Back to Registered Exams
        </button>
      </div>
    );
  if (!question)
    return (
      <div className="exam-state error">
        <h2>No questions configured</h2>
        <p>This exam cannot be attempted until faculty add questions.</p>
        <button className="btn btn-primary" onClick={() => navigate("/student/registered")}>Go Back</button>
      </div>
    );

  const danger = remaining <= 300;

  // ── Force-submit overlay ─────────────────────────────────────────────────────
  if (forceSubmitting) {
    return (
      <div className="force-submit-overlay">
        <div className="force-submit-card">
          <div className="force-submit-icon">
            <i className="ti ti-ban" />
          </div>
          <h2>Exam Terminated</h2>
          <p>{forceReason}</p>
          <div className="force-submit-note">
            Your answers have been saved and the exam is being submitted automatically. Please wait...
          </div>
          <div className="force-submit-spinner">
            <span className="spinner" />
            Submitting...
          </div>
        </div>
      </div>
    );
  }

  // ── Offline lockdown overlay ─────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="force-submit-overlay offline-overlay">
        <div className="force-submit-card">
          <div className="force-submit-icon" style={{ color: "#d97706", background: "#fef3c7" }}>
            <i className="ti ti-wifi-off" />
          </div>
          <h2>Connection Lost</h2>
          <p>Your internet connection has dropped. The exam is paused and questions are hidden.</p>
          <div className="force-submit-note">
            Any answers you selected have been saved locally. Please reconnect to the internet to resume your exam.
          </div>
          <div className="force-submit-spinner">
            <span className="spinner" />
            Waiting for connection...
          </div>
        </div>
      </div>
    );
  }

  // ── Main exam UI ─────────────────────────────────────────────────────────────
  return (
    <div className="live-exam">

      {/* Anti-Camera Watermark */}
      {session && currentUser && (
        <div className="exam-watermark" aria-hidden="true">
          {Array.from({ length: 150 }).map((_, i) => (
            <span key={i}>{currentUser.email}</span>
          ))}
        </div>
      )}

      {/* Fullscreen nag bar */}
      {rule.fullscreen_required && !isFullscreen && (
        <div className="proctor-nag-bar">
          <i className="ti ti-maximize" />
          <span>
            This exam requires <strong>fullscreen mode</strong>. Your exit has been logged
            {rule.max_fullscreen_exits > 0 && ` (${fsCount}/${rule.max_fullscreen_exits})`}.
          </span>
          <button
            className="nag-btn"
            onClick={() => document.documentElement.requestFullscreen().catch(() => undefined)}
          >
            <i className="ti ti-maximize" /> Re-enter Fullscreen
          </button>
        </div>
      )}

      {/* Tab switch progress bar */}
      {rule.max_tab_switches > 0 && tabCount > 0 && (
        <div className="tab-switch-bar">
          <i className="ti ti-eye-off" />
          <span>Tab switches: <strong>{tabCount} / {rule.max_tab_switches}</strong></span>
          <div className="tab-switch-track">
            <div
              className="tab-switch-fill"
              style={{
                width: `${Math.min(100, (tabCount / rule.max_tab_switches) * 100)}%`,
                background:
                  tabCount >= rule.max_tab_switches - 1 ? "#dc2626" :
                  tabCount >= Math.floor(rule.max_tab_switches / 2) ? "#d97706" :
                  "#4ade80",
              }}
            />
          </div>
          {tabCount >= rule.max_tab_switches - 1 && (
            <span className="tab-switch-danger">Next switch = auto-submit</span>
          )}
        </div>
      )}

      {/* Fullscreen exit progress bar */}
      {rule.max_fullscreen_exits > 0 && fsCount > 0 && (
        <div className="tab-switch-bar">
          <i className="ti ti-maximize-off" />
          <span>Fullscreen exits: <strong>{fsCount} / {rule.max_fullscreen_exits}</strong></span>
          <div className="tab-switch-track">
            <div
              className="tab-switch-fill"
              style={{
                width: `${Math.min(100, (fsCount / rule.max_fullscreen_exits) * 100)}%`,
                background:
                  fsCount >= rule.max_fullscreen_exits - 1 ? "#dc2626" :
                  fsCount >= Math.floor(rule.max_fullscreen_exits / 2) ? "#d97706" :
                  "#4ade80",
              }}
            />
          </div>
          {fsCount >= rule.max_fullscreen_exits - 1 && (
            <span className="tab-switch-danger">Next exit = auto-submit</span>
          )}
        </div>
      )}

      {/* Violation warning banners */}
      {warnings.length > 0 && (
        <div className="violation-warnings">
          {warnings.map((w) => (
            <div key={w.id} className={`violation-warn violation-warn--${w.type}`}>
              <i className={`ti ${
                w.type === "tab"        ? "ti-eye-off" :
                w.type === "fullscreen" ? "ti-maximize-off" :
                "ti-alert-octagon"
              }`} />
              <span>{w.message}</span>
              <button
                className="warn-dismiss"
                onClick={() => setWarnings((prev) => prev.filter((x) => x.id !== w.id))}
                aria-label="Dismiss"
              >
                <i className="ti ti-x" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <header className="live-header">
        <div className="live-title">
          <strong>EXAM.TIET</strong>
          <span>{session.exam.courses?.code} · {session.exam.title}</span>
        </div>
        <div className={`live-timer ${danger ? "danger" : ""}`}>
          <i className="ti ti-clock" />
          <span>Time remaining</span>
          <strong>{formatRemaining(remaining)}</strong>
        </div>
        <div className="save-state">
          <span className={saving ? "saving" : ""} />
          <span>
            {saving
              ? "Saving..."
              : lastSaved
              ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Progress restored"}
          </span>
        </div>
        <div className="proctor-indicator">
          <div className="proctor-dot" />
          <span>Monitored</span>
        </div>
      </header>

      {error && (
        <div className="exam-error">
          <i className="ti ti-alert-circle" />
          {error}
          <button onClick={() => setError(null)}><i className="ti ti-x" /></button>
        </div>
      )}

      <div className="live-body">
        {/* Question pane */}
        <main className="question-pane">
          <div className="question-scroll">
            <div className="question-meta">
              <span>Question {index + 1} of {questions.length}</span>
              <div>
                <b>{row.marks_override ?? question.marks} marks</b>
                {question.negative_marks > 0 && (
                  <b className="negative">-{question.negative_marks} negative</b>
                )}
                <b>{question.question_type.replace("_", " ")}</b>
              </div>
            </div>

            {/* Question stem */}
            <h1>{obfuscateText(question.question_text)}</h1>

            {/* ── NEW: question image rendered between stem and options ── */}
            {question.image_url && (
              <QuestionImage
                src={question.image_url}
                studentEmail={currentUser?.email ?? ""}
              />
            )}

            <AnswerInput question={row} answer={currentAnswer} onChange={changeAnswer} />

            <div className="question-tools">
              <button
                className={currentAnswer.is_marked_for_review ? "flagged" : ""}
                onClick={() => changeAnswer({ is_marked_for_review: !currentAnswer.is_marked_for_review })}
              >
                <i className="ti ti-flag" />
                {currentAnswer.is_marked_for_review ? "Marked for review" : "Mark for review"}
              </button>
              <button onClick={() => changeAnswer({ selected_option_id: null, selected_option_ids: [], answer_text: "" })}>
                <i className="ti ti-eraser" />Clear response
              </button>
            </div>
          </div>
          <footer className="question-nav">
            <button className="btn btn-secondary" disabled={index === 0} onClick={() => goTo(index - 1)}>
              <i className="ti ti-arrow-left" />Previous
            </button>
            <div>
              <button className="btn btn-danger" onClick={() => setSubmitOpen(true)}>Submit Exam</button>
              <button
                className="btn btn-primary"
                disabled={index === questions.length - 1}
                onClick={() => goTo(index + 1)}
              >
                Save & Next<i className="ti ti-arrow-right" />
              </button>
            </div>
          </footer>
        </main>

        {/* Palette */}
        <aside className="question-palette">
          <div className="palette-head">
            <strong>Question Palette</strong>
            <span>{summary.answered}/{questions.length} answered</span>
          </div>
          <div className="palette-grid">
            {questions.map((item, qi) => {
              const ans = answers[item.questions.id] ?? emptyAnswer();
              const cls = [
                qi === index ? "current" : "",
                ans.is_marked_for_review        ? "flagged"  :
                hasAnswer(ans)                  ? "answered" :
                visited.has(item.questions.id)  ? "visited"  : "",
              ].join(" ");
              return (
                <button className={cls} key={item.questions.id} onClick={() => goTo(qi)}>
                  {qi + 1}
                  {/* ── Image indicator dot on palette button ── */}
                  {item.questions.image_url && (
                    <span style={{
                      position: "absolute", top: 2, right: 2,
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#0369a1",
                      display: "block",
                    }} title="Has image" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="palette-legend">
            <span><i className="answered" />Answered: {summary.answered}</span>
            <span><i className="flagged" />Review: {summary.flagged}</span>
            <span><i />Unanswered: {summary.unanswered}</span>
          </div>

          {/* Fullscreen button */}
          {rule.fullscreen_required && (
            <button
              className={`btn btn-secondary fullscreen${!isFullscreen ? " fullscreen-urgent" : ""}`}
              onClick={() => document.documentElement.requestFullscreen().catch(() => undefined)}
            >
              <i className="ti ti-maximize" />
              {isFullscreen ? "Fullscreen Active" : "Re-enter Fullscreen ⚠"}
            </button>
          )}

          {/* Tab switch counter */}
          {rule.max_tab_switches > 0 && (
            <div className={`palette-integrity${tabCount >= rule.max_tab_switches - 1 && tabCount > 0 ? " danger" : ""}`}>
              <i className="ti ti-eye" />
              <span>Tab switches: {tabCount}/{rule.max_tab_switches}</span>
            </div>
          )}

          {/* Fullscreen exit counter */}
          {rule.max_fullscreen_exits > 0 && (
            <div className={`palette-integrity${fsCount >= rule.max_fullscreen_exits - 1 && fsCount > 0 ? " danger" : ""}`}>
              <i className="ti ti-maximize-off" />
              <span>Fullscreen exits: {fsCount}/{rule.max_fullscreen_exits}</span>
            </div>
          )}

          {/* Proctoring status */}
          <div className="proctor-status-chip">
            <div className="proctor-dot" />
            <span>
              {[
                rule.camera_required     && "Camera",
                rule.microphone_required && "Audio",
                "Browser",
              ].filter(Boolean).join(" · ")} monitoring active
            </span>
          </div>

          <div className="timer-policy">
            Timer policy: your attempt closes at the earlier of the full duration or the published exam closing time.
          </div>
        </aside>
      </div>

      {session && (
        <>
          {rule.camera_required && (
            <WebcamCapture
              attemptId={session.attempt.id}
              studentId={currentUser?.id ?? ""}
              intervalMs={30_000}
            />
          )}
          {rule.microphone_required && (
            <AudioMonitor
              attemptId={session.attempt.id}
              noiseTreshold={60}
              checkIntervalMs={10_000}
            />
          )}
          <BrowserMonitor
            attemptId={session.attempt.id}
            fullscreenRequired={rule.fullscreen_required}
            onWarning={handleViolation}
            onConflict={handleConflict}
            onHeartbeatFailure={handleHeartbeatFailure}
          />
        </>
      )}

      {/* Submit confirmation modal */}
      {submitOpen && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="modal-header">
              <h2>Submit examination?</h2>
              <button onClick={() => setSubmitOpen(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <p>
                You have answered <strong>{summary.answered}</strong> of {questions.length} questions.
                {summary.unanswered > 0 && ` ${summary.unanswered} remain unanswered.`}
              </p>
              <div className="detail-grid" style={{ marginTop: 14 }}>
                <div className="detail-item"><span>Answered</span><strong>{summary.answered}</strong></div>
                <div className="detail-item"><span>Marked for review</span><strong>{summary.flagged}</strong></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSubmitOpen(false)}>
                Continue Exam
              </button>
              <button
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => void submit("MANUAL")}
              >
                {submitting ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AnswerInput({ question: row, answer, onChange }: {
  question: ExamQuestion;
  answer: AnswerState;
  onChange: (v: Partial<AnswerState>) => void;
}) {
  const question = row.questions;
  if (question.question_type === "SHORT_ANSWER" || question.question_type === "LONG_ANSWER") {
    return (
      <textarea
        className="answer-text"
        rows={question.question_type === "LONG_ANSWER" ? 10 : 4}
        value={answer.answer_text ?? ""}
        onChange={(e) => onChange({ answer_text: e.target.value })}
        placeholder="Type your answer here..."
        onPaste={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      />
    );
  }
  const multiple = question.question_type === "MSQ";
  return (
    <div className="answer-options">
      {question.question_options
        .sort((a, b) => a.order_index - b.order_index)
        .map((option, idx) => {
          const selected = multiple
            ? answer.selected_option_ids?.includes(option.id)
            : answer.selected_option_id === option.id;
          const choose = () => {
            if (!multiple) return onChange({ selected_option_id: option.id });
            const values = new Set(answer.selected_option_ids ?? []);
            if (values.has(option.id)) values.delete(option.id); else values.add(option.id);
            onChange({ selected_option_ids: [...values] });
          };
          return (
            <button className={selected ? "selected" : ""} onClick={choose} key={option.id}>
              <span>{String.fromCharCode(65 + idx)}</span>
              <i className={`ti ti-${multiple
                ? selected ? "square-check-filled" : "square"
                : selected ? "circle-dot-filled"  : "circle"
              }`} />
              <p>{obfuscateText(option.option_text)}</p>
            </button>
          );
        })}
    </div>
  );
}

function emptyAnswer(): AnswerState {
  return {
    selected_option_id:  null,
    selected_option_ids: [],
    answer_text:         "",
    is_marked_for_review: false,
    time_spent_sec:      0,
  };
}

function hasAnswer(a: AnswerState) {
  return Boolean(
    a.selected_option_id ||
    a.selected_option_ids?.length ||
    a.answer_text?.trim()
  );
}

function formatRemaining(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function obfuscateText(text: string | null | undefined): string {
  if (!text) return "";
  return text.split("").join("\u200B");
}

// ── PRNG & Shuffling Utilities ────────────────────────────────────────────────

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
}

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function seededShuffle<T>(array: T[], rand: () => number): T[] {
  let m = array.length, t, i;
  while (m) {
    i = Math.floor(rand() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}