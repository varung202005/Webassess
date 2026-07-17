import { useNavigate } from "react-router-dom";
import StudentLayout from "../../features/student/StudentLayout";

export default function StudentThankYou() {
  const navigate = useNavigate();

  return (
    <StudentLayout>
      <div className="student-ty-card">
        <div className="student-ty-icon"><i className="ti ti-check" /></div>
        <div className="student-ty-title">Test Submitted</div>
        <div className="student-ty-sub">
          Thank you. Your test has been submitted successfully.
          Results will be published soon.
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/student/dashboard", { replace: true })}>
          Back to Dashboard
        </button>
      </div>
    </StudentLayout>
  );
}
