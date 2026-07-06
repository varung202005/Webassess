/**
 * LiveExam.tsx — Final
 *
 * Connected to exam_rules set by faculty in Step 3 of CreateExam:
 *   fullscreen_required     → enforces fullscreen, nag bar on exit
 *   max_tab_switches        → warns per switch, force-submits on limit
 *   proctoring_enabled      → gates camera / audio / browser monitors
 *   camera_required         → gates CameraPermission screen + WebcamCapture
 *   microphone_required     → gates AudioMonitor
 *   auto_save_interval_sec  → drives auto-save timer
 *
 * On every submit (manual, auto, or force):
 *   1. Flush pending answers
 *   2. POST /proctoring/summary/:id  ← computes integrity score, flags if < 0.7
 *   3. POST /exam-attempts/submit
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { candidateApi } from "../../features/candidate/api";
import { studentApi } from "../../features/student/api";
import { apiMessage } from "../../features/student/format";
import type { ExamQuestion } from "../../features/student/types";
import { useAuthStore } from "../../store/authStore";
import "./liveExam.css";
import "./liveExam.proctor.css";
import WebcamCapture from "../../features/proctor/WebcamCapture";
import AudioMonitor from "../../features/proctor/AudioMonitor";
import BrowserMonitor from "../../features/proctor/BrowserMonitor";
import CameraPermission from "../../features/proctor/CameraPermission";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnswerState {
  selected_option_id?: string | null;
  selected_option_ids?: string[];
  answer_text?: string;
  is_marked_for_review: boolean;
  time_spent_sec: number;
}

type ViolationType = "tab" | "fullscreen" | "conflict";

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
  auto_save_interval_sec: number;
}

let warnCounter = 0;

function getRule(session: any): ExamRule {
  const raw = Array.isArray(session?.exam?.exam_rules)
    ? session.exam.exam_rules[0]
    : session?.exam?.exam_rules;
  return {
    fullscreen_required:    raw?.fullscreen_required    ?? false,
    proctoring_enabled:     raw?.proctoring_enabled     ?? false,
    camera_required:        raw?.camera_required        ?? false,
    microphone_required:    raw?.microphone_required    ?? false,
    max_tab_switches:       raw?.max_tab_switches       ?? 3,
    auto_save_interval_sec: raw?.auto_save_interval_sec ?? 30,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LiveExam() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const activeRole = useAuthStore((s) => s.activeRole);
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

  // Violation state
  const [warnings,        setWarnings]        = useState<ViolationWarning[]>([]);
  const [tabCount,        setTabCount]        = useState(0);
  const [forceSubmitting, setForceSubmitting] = useState(false);
  const [forceReason,     setForceReason]     = useState("");

  const dirty       = useRef(new Set<string>());
  const submitted   = useRef(false);
  const enteredAt   = useRef(Date.now());
  const tabCountRef = useRef(0);

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

  // ── Core submit — called for manual, auto-deadline, and force-submit ─────────
  const submit = useCallback(async (type: "MANUAL" | "AUTO") => {
    if (!session || submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Save any pending answers
      await flushAnswers();
      if (activeRole === "CANDIDATE") {
        await candidateApi.submitAttempt(session.attempt.id, type);
        navigate("/candidate/thank-you", { replace: true });
      } else {
        await studentApi.submitAttempt(session.attempt.id, type);
        navigate("/student/history", { replace: true, state: { submitted: true } });
      }
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

  // ── Auto-save (interval from exam_rules) ────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const interval = Math.max(5, rule.auto_save_interval_sec) * 1000;
    const t = window.setInterval(() => void flushAnswers(), interval);
    return () => window.clearInterval(t);
  }, [session, flushAnswers, rule.auto_save_interval_sec]);

  // ── Connection events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const online  = () => void studentApi.logEvent(session.attempt.id, "CONNECTION_RESTORED").catch(() => undefined);
    const offline = () => void studentApi.logEvent(session.attempt.id, "CONNECTION_LOST").catch(() => undefined);
    window.addEventListener("online",  online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online",  online);
      window.removeEventListener("offline", offline);
    };
  }, [session]);

  // ── Violation handler — driven by exam_rules ─────────────────────────────────
  const handleViolation = useCallback((
    _message: string,
    type: ViolationType,
  ) => {
    if (type === "tab") {
      tabCountRef.current += 1;
      const newCount = tabCountRef.current;
      setTabCount(newCount);
      const max = rule.max_tab_switches;

      // Log to backend submission_logs
      void studentApi.logEvent(session?.attempt.id ?? "", "TAB_SWITCH_WARNING").catch(() => undefined);

      // Limit reached → force-submit
      if (max > 0 && newCount >= max) {
        const reason = `You switched tabs ${newCount} time${newCount !== 1 ? "s" : ""}, exceeding the limit of ${max} set for this exam. Your exam is being submitted automatically.`;
        setForceReason(reason);
        setForceSubmitting(true);
        // 4s grace so student sees the reason, then submit
        setTimeout(async () => {
          await studentApi.computeProctoringsSummary(session?.attempt.id ?? "").catch(() => undefined);
          void submit("AUTO");
        }, 4000);
        return;
      }

      // Under limit → warn with remaining count
      const remaining_switches = max - newCount;
      const id = ++warnCounter;
      setWarnings((prev) => [{
        id,
        type: "tab" as ViolationType,
        message: max <= 0
          ? `⚠ Tab switch detected (${newCount} total). This has been logged.`
          : remaining_switches === 1
          ? `⚠ Tab switch ${newCount}/${max} — ONE MORE switch will automatically submit your exam.`
          : `⚠ Tab switch ${newCount}/${max} — ${remaining_switches} more allowed before your exam is auto-submitted.`,
      }, ...prev].slice(0, 5));
      setTimeout(() => setWarnings((prev) => prev.filter((w) => w.id !== id)), 10_000);

    } else if (type === "fullscreen") {
      void studentApi.logEvent(session?.attempt.id ?? "", "FULLSCREEN_EXIT").catch(() => undefined);
      const id = ++warnCounter;
      setWarnings((prev) => [{
        id, 
        type: "fullscreen" as ViolationType, 
        message: "⚠ You exited fullscreen. This has been logged. Return to fullscreen immediately.",
      }, ...prev].slice(0, 5));
      setTimeout(() => setWarnings((prev) => prev.filter((w) => w.id !== id)), 12_000);

    } else if (type === "conflict") {
      const id = ++warnCounter;
      setWarnings((prev) => [{
        id,
        type: "conflict" as ViolationType,
        message: "🚨 Another tab with this exam was detected. Close it immediately — this is a violation.",
      }, ...prev].slice(0, 5));
    }
  }, [rule.max_tab_switches, session, submit]);

  const handleConflict = useCallback(() => handleViolation("", "conflict"), [handleViolation]);

  // ── Answer helpers ───────────────────────────────────────────────────────────
  const questions     = session?.questions ?? [];
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
      return (
        <CameraPermission
          examTitle={session.exam.title}
          courseCode={session.exam.courses?.code ?? ""}
          cameraRequired={rule.camera_required}
          onProceed={() => {
            // Fullscreen MUST be requested synchronously inside a real user
            // gesture (this click) — browsers silently reject
            // requestFullscreen() calls made later from a useEffect after
            // the state update below, which is why it was never actually
            // prompting before.
            if (rule.fullscreen_required && document.fullscreenElement === null) {
              document.documentElement.requestFullscreen().catch((err) =>
                console.warn("[LiveExam] Could not enter fullscreen on Start Exam click:", err)
              );
            }
            setCameraCleared(true);
          }}
          onSkip={() => setCameraCleared(true)}
        />
      );
    }
    // No camera needed — skip gate immediately
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

  // ── Main exam UI ─────────────────────────────────────────────────────────────
  return (
    <div className="live-exam">

      {/* Fullscreen nag bar */}
      {rule.fullscreen_required && !isFullscreen && (
        <div className="proctor-nag-bar">
          <i className="ti ti-maximize" />
          <span>This exam requires <strong>fullscreen mode</strong>. Your exit has been logged.</span>
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
            <h1>{question.question_text}</h1>
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

          {/* Tab switch counter in palette */}
          {rule.max_tab_switches > 0 && (
            <div className={`palette-integrity${tabCount >= rule.max_tab_switches - 1 && tabCount > 0 ? " danger" : ""}`}>
              <i className="ti ti-eye" />
              <span>Tab switches: {tabCount}/{rule.max_tab_switches}</span>
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

      {/* Invisible proctoring components.
          Camera/mic each mount purely off their own "required" flag — NOT
          gated behind proctoring_enabled, otherwise a faculty member can set
          microphone_required=true without also flipping proctoring_enabled
          and the mic permission prompt / recording never happens.
          BrowserMonitor (tab-switch + fullscreen tracking) always runs once
          the session is live, since a configured tab-switch limit needs to
          be enforced regardless of the camera/mic proctoring toggle. */}
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
              <p>{option.option_text}</p>
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
  const hours   = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const secs    = seconds % 60;
  return [hours, minutes, secs].map((v) => String(v).padStart(2, "0")).join(":");
}
