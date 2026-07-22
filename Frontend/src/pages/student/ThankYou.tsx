import { useLocation, useNavigate } from "react-router-dom";
import StudentLayout from "../../features/student/StudentLayout";

export default function StudentThankYou() {
  const navigate = useNavigate();
  const location = useLocation();
  const submittedAt = (location.state as { submittedAt?: string } | null)?.submittedAt;
  const submittedTime = submittedAt ? new Date(submittedAt) : null;

  return (
    <StudentLayout>
      <div className="student-ty-card">
        <div className="student-ty-icon"><i className="ti ti-circle-check-filled" /></div>
        <div className="student-ty-eyebrow">Submission complete</div>
        <h1 className="student-ty-title">Exam Submitted Successfully</h1>
        <div className="student-ty-sub">
          Thank you. Your answers have been securely recorded and your examination is complete.
        </div>
        {submittedTime && <p className="student-ty-time"><i className="ti ti-clock" /> Submitted {submittedTime.toLocaleString()}</p>}
        <div className="student-ty-actions">
          <button className="btn btn-primary" onClick={() => navigate("/student/dashboard", { replace: true })}>
            Return to Dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/student/results", { replace: true })}>
            View Results
          </button>
        </div>
      </div>
    </StudentLayout>
  );
}
