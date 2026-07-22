/**
 * CandidateInstructions — shown when the exam window is ACTIVE.
 *
 * Displays exam details and rules, then on "Start Test" calls
 * POST /api/v1/candidate/start-attempt and navigates into LiveExam.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CandidateLayout from "../../features/candidate/CandidateLayout";
import { useCandidateExamState } from "../../features/candidate/hooks";
import { candidateApi } from "../../features/candidate/api";

const css = `
.inst-card {
  background: #fff; border: 1px solid var(--c-gray-200);
  border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,.06);
  overflow: hidden;
}
.inst-header {
  background: var(--c-primary-700); padding: 32px 36px;
  color: #fff;
}
.inst-label { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,.65); margin-bottom: 8px; }
.inst-title { font-size: 26px; font-weight: 800; letter-spacing: -.4px; margin-bottom: 20px; }
.inst-meta { display: flex; flex-wrap: wrap; gap: 20px; }
.inst-meta-item { display: flex; align-items: center; gap: 7px; font-size: 14px; color: rgba(255,255,255,.85); }
.inst-meta-item i { font-size: 17px; color: rgba(255,255,255,.65); }
.inst-meta-item strong { color: #fff; }

.inst-body { padding: 32px 36px; }
.inst-section-title { font-size: 13px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--c-gray-500); margin-bottom: 14px; }
.inst-rules { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
.inst-rules li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--c-gray-700); line-height: 1.55; }
.inst-rules li i { font-size: 17px; color: var(--c-primary-600); flex-shrink: 0; margin-top: 1px; }
.inst-instructions { background: var(--c-gray-50); border: 1px solid var(--c-gray-200); border-radius: 8px; padding: 16px 18px; font-size: 14px; color: var(--c-gray-700); line-height: 1.7; white-space: pre-wrap; margin-bottom: 28px; }
.inst-divider { border: none; border-top: 1px solid var(--c-gray-100); margin: 0 0 28px; }

.inst-fullscreen-notice {
  display: flex; align-items: flex-start; gap: 12px;
  background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px;
  padding: 14px 16px; margin-bottom: 28px; font-size: 13.5px;
  color: #92400E; line-height: 1.5;
}
.inst-fullscreen-notice i { font-size: 18px; color: #D97706; flex-shrink: 0; }

.inst-footer { border-top: 1px solid var(--c-gray-100); padding: 24px 36px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.inst-agree { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--c-gray-700); cursor: pointer; }
.inst-agree input { width: 16px; height: 16px; accent-color: var(--c-primary-700); cursor: pointer; }
.btn-start {
  display: flex; align-items: center; gap: 8px;
  background: var(--c-primary-700); color: #fff;
  border: none; border-radius: 10px; padding: 13px 32px;
  font-size: 15px; font-weight: 700; font-family: var(--font);
  cursor: pointer; transition: background .12s; letter-spacing: -.1px;
}
.btn-start:hover:not(:disabled) { background: var(--c-primary-800); }
.btn-start:disabled { opacity: .55; cursor: not-allowed; }
.inst-error { background: var(--c-danger-100); border: 1px solid #FCA5A5; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--c-danger-700); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.inst-spinner { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px 0; font-size: 14px; color: var(--c-gray-600); }
.inst-spinner i { font-size: 22px; animation: spin2 .8s linear infinite; }
@keyframes spin2 { to { transform: rotate(360deg); } }
@media(max-width:640px) {
  .inst-header { padding: 24px 20px; }
  .inst-title { font-size: 20px; }
  .inst-body { padding: 24px 20px; }
  .inst-footer { flex-direction: column; align-items: stretch; padding: 20px; }
  .btn-start { justify-content: center; }
}
`;

const DEFAULT_RULES = [
  { icon: "ti-clock", text: "The timer starts when the secure exam begins and cannot be paused." },
  { icon: "ti-layout-2", text: "Do not switch browser tabs or windows. This will be logged and may result in disqualification." },
  { icon: "ti-maximize", text: "Keep the exam in fullscreen mode for the duration of the test." },
  { icon: "ti-device-laptop", text: "Use a stable internet connection. Your answers are saved automatically." },
  { icon: "ti-refresh-alert", text: "Do not refresh or close the browser window during the exam." },
  { icon: "ti-flag", text: "You may mark questions for review and return to them before submitting." },
];

export default function CandidateInstructions() {
  const navigate = useNavigate();
  const { data: state, isLoading } = useCandidateExamState();
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!agreed || starting) return;
    setStarting(true);
    setError(null);
    try {
      if (state?.state !== "ACTIVE") throw new Error("No active exam is available.");
      navigate(`/exam/preflight/${state.schedule_id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start exam. Please try again.");
      setStarting(false);
    }
  };

  if (isLoading) {
    return (
      <CandidateLayout>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div className="inst-spinner"><i className="ti ti-loader-2" /> Loading exam details…</div>
      </CandidateLayout>
    );
  }

  // If state changed (e.g. already submitted), redirect to state gate
  if (!state || (state.state !== "ACTIVE" && state.state !== "IN_PROGRESS")) {
    navigate("/candidate/state", { replace: true });
    return null;
  }

  const exam = state.state === "ACTIVE" ? state : null;

  return (
    <CandidateLayout>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="inst-card">
        <div className="inst-header">
          <div className="inst-label">Assessment Instructions</div>
          <div className="inst-title">{exam?.exam_title ?? "Assessment"}</div>
          <div className="inst-meta">
            {exam && (
              <>
                <div className="inst-meta-item">
                  <i className="ti ti-clock" />
                  <span>Duration: <strong>{exam.exam_duration_minutes} minutes</strong></span>
                </div>
                <div className="inst-meta-item">
                  <i className="ti ti-list-check" />
                  <span>Questions: <strong>{exam.total_questions}</strong></span>
                </div>
                <div className="inst-meta-item">
                  <i className="ti ti-star" />
                  <span>Total Marks: <strong>{exam.total_marks}</strong></span>
                </div>
                <div className="inst-meta-item">
                  <i className="ti ti-trophy" />
                  <span>Passing Marks: <strong>{exam.pass_marks}</strong></span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="inst-body">
          <div className="inst-section-title">Instructions from Examiner</div>
          {exam?.instructions ? (
            <div className="inst-instructions">{exam.instructions}</div>
          ) : (
            <div className="inst-instructions" style={{ color: "var(--c-gray-500)", fontStyle: "italic" }}>
              No specific instructions provided. Please follow the general rules below.
            </div>
          )}

          <hr className="inst-divider" />

          <div className="inst-section-title">General Rules</div>
          <ul className="inst-rules">
            {DEFAULT_RULES.map((rule, i) => (
              <li key={i}>
                <i className={`ti ${rule.icon}`} />
                {rule.text}
              </li>
            ))}
            {exam?.rules?.enable_proctoring && (
              <li>
                <i className="ti ti-camera" />
                <strong>Proctoring is enabled.</strong> Your camera and/or microphone may be monitored.
              </li>
            )}
          </ul>

          <div className="inst-fullscreen-notice">
            <i className="ti ti-alert-circle" />
            <div>
              <strong>Fullscreen Required:</strong> The exam will request fullscreen when you click Start Test.
              Exiting fullscreen will be recorded. Please use a desktop or laptop — mobile devices are not recommended.
            </div>
          </div>

          {error && (
            <div className="inst-error">
              <i className="ti ti-alert-circle" /> {error}
            </div>
          )}
        </div>

        <div className="inst-footer">
          <label className="inst-agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={starting}
            />
            I have read and agree to all instructions and rules
          </label>
          <button
            className="btn-start"
            disabled={!agreed || starting}
            onClick={handleStart}
          >
            {starting ? (
              <><i className="ti ti-loader-2" style={{ animation: "spin2 .8s linear infinite" }} /> Starting…</>
            ) : (
              <><i className="ti ti-player-play" /> Start Test</>
            )}
          </button>
        </div>
      </div>
    </CandidateLayout>
  );
}
