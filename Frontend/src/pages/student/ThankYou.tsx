import { useNavigate } from "react-router-dom";
import StudentLayout from "../../features/student/StudentLayout";

const css = `
.student-ty-card {
  background: #fff;
  border: 1px solid #e8e9ef;
  border-radius: 14px;
  padding: 64px 40px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
}
.student-ty-icon {
  width: 80px;
  height: 80px;
  background: #ECFDF5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  font-size: 38px;
}
.student-ty-title {
  font-size: 26px;
  font-weight: 800;
  color: #222536;
  margin-bottom: 10px;
  letter-spacing: 0;
}
.student-ty-sub {
  font-size: 15px;
  color: #616573;
  line-height: 1.7;
  max-width: 440px;
  margin: 0 auto 32px;
}
`;

export default function StudentThankYou() {
  const navigate = useNavigate();

  return (
    <StudentLayout>
      <style dangerouslySetInnerHTML={{ __html: css }} />
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
