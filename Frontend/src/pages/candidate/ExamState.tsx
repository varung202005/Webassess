/**
 * CandidateExamState — the single entry point after candidate login.
 *
 * Reads the current exam state from the API and renders the
 * appropriate UI or redirects into the live exam engine.
 *
 * States handled:
 *   NOT_STARTED  → countdown / waiting screen
 *   ACTIVE       → redirect to /candidate/instructions
 *   IN_PROGRESS  → redirect directly into /exam/live/:scheduleId (resume)
 *   SUBMITTED    → "already completed" screen
 *   EXPIRED      → "window closed" screen
 *   NO_EXAM      → "no exam assigned" screen
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CandidateLayout from "../../features/candidate/CandidateLayout";
import { useCandidateExamState } from "../../features/candidate/hooks";

const css = `
.cs-card {
  background: #fff; border: 1px solid var(--c-gray-200);
  border-radius: 14px; padding: 48px 40px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
}
.cs-icon { font-size: 52px; margin-bottom: 20px; }
.cs-title { font-size: 22px; font-weight: 700; color: var(--c-gray-900); margin-bottom: 10px; letter-spacing: -.3px; }
.cs-sub { font-size: 14px; color: var(--c-gray-600); line-height: 1.7; max-width: 420px; margin: 0 auto; }
.cs-time { display: inline-block; margin-top: 18px; background: var(--c-gray-50); border: 1px solid var(--c-gray-200); border-radius: 8px; padding: 10px 20px; font-size: 14px; color: var(--c-gray-700); font-weight: 500; }
.cs-exam-name { font-size: 16px; font-weight: 600; color: var(--c-primary-700); margin-bottom: 6px; }
.cs-spinner { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px 0; font-size: 14px; color: var(--c-gray-600); }
.cs-spinner i { font-size: 22px; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
`;

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "long", year: "numeric", month: "long",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CandidateExamState() {
  const navigate = useNavigate();
  const { data: state, isLoading, error } = useCandidateExamState();

  useEffect(() => {
    if (!state) return;
    if (state.state === "ACTIVE") {
      navigate("/candidate/instructions", { replace: true });
    }
    if (state.state === "IN_PROGRESS") {
      // Go directly into exam engine — skip instructions
      navigate(`/exam/live/${state.schedule_id}`, { replace: true });
    }
  }, [state, navigate]);

  return (
    <CandidateLayout>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {isLoading && (
        <div className="cs-spinner">
          <i className="ti ti-loader-2" /> Checking your assessment status…
        </div>
      )}

      {error && (
        <div className="cs-card">
          <div className="cs-icon">⚠️</div>
          <div className="cs-title">Unable to Load Assessment</div>
          <div className="cs-sub">
            There was a problem connecting to the server. Please refresh the page or
            contact support if the issue persists.
          </div>
        </div>
      )}

      {state?.state === "NOT_STARTED" && (
        <div className="cs-card">
          <div className="cs-icon">🕐</div>
          {state.exam_title && <div className="cs-exam-name">{state.exam_title}</div>}
          <div className="cs-title">Assessment Not Yet Started</div>
          <div className="cs-sub">
            Your assessment window has not opened yet. Please return at the scheduled time.
            This page will automatically refresh.
          </div>
          <div className="cs-time">
            📅 Scheduled for: <strong>{formatDateTime(state.scheduled_at)}</strong>
          </div>
        </div>
      )}

      {state?.state === "SUBMITTED" && (
        <div className="cs-card">
          <div className="cs-icon">✅</div>
          <div className="cs-title">Assessment Already Completed</div>
          <div className="cs-sub">
            You have already submitted this assessment. Your responses have been recorded.
            You will be notified when results are available.
          </div>
        </div>
      )}

      {state?.state === "EXPIRED" && (
        <div className="cs-card">
          <div className="cs-icon">⏰</div>
          <div className="cs-title">Assessment Window Has Closed</div>
          <div className="cs-sub">
            The time window for this assessment has expired. Please contact the exam
            coordinator if you believe this is an error.
          </div>
        </div>
      )}

      {state?.state === "NO_EXAM" && (
        <div className="cs-card">
          <div className="cs-icon">📋</div>
          <div className="cs-title">No Assessment Assigned</div>
          <div className="cs-sub">
            There is no active assessment linked to your account. If you received an
            invitation email, ensure you are signed in with the correct email address.
          </div>
        </div>
      )}

      {/* ACTIVE and IN_PROGRESS states trigger useEffect redirects above */}
    </CandidateLayout>
  );
}
