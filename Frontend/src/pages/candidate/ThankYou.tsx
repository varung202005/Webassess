/**
 * CandidateThankYou — shown after exam submission.
 *
 * No results, no links to dashboard, no navigation. Just confirmation
 * and a sign-out button. This is the terminal page of the candidate flow.
 */
import CandidateLayout from "../../features/candidate/CandidateLayout";
import { useAuthStore } from "../../store/authStore";
import { useLocation, useNavigate } from "react-router-dom";

const css = `
.ty-card {
  background: #fff; border: 1px solid var(--c-gray-200);
  border-radius: 14px; padding: 64px 40px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
}
.ty-icon {
  width: 80px; height: 80px; background: #ECFDF5; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 24px; font-size: 38px;
}
.ty-title { font-size: 26px; font-weight: 800; color: var(--c-gray-900); margin-bottom: 10px; letter-spacing: -.4px; }
.ty-sub { font-size: 15px; color: var(--c-gray-600); line-height: 1.7; max-width: 440px; margin: 0 auto 32px; }
.ty-note { font-size: 13px; color: var(--c-gray-500); margin-bottom: 36px; }
.ty-divider { border: none; border-top: 1px solid var(--c-gray-100); margin: 0 0 32px; }
.btn-signout {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--c-gray-900); color: #fff;
  border: none; border-radius: 10px; padding: 12px 28px;
  font-size: 14px; font-weight: 600; font-family: var(--font);
  cursor: pointer; transition: background .12s;
}
.btn-signout:hover { background: #111; }
`;

export default function CandidateThankYou() {
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const location = useLocation();
  const submittedAt = (location.state as { submittedAt?: string } | null)?.submittedAt;

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <CandidateLayout>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="ty-card">
        <div className="ty-icon"><i className="ti ti-circle-check-filled" /></div>
        <div className="ty-title">Exam Submitted Successfully</div>
        <div className="ty-sub">
          Thank you. Your answers have been securely recorded and your examination is complete.
        </div>
        {submittedAt && <div className="ty-note"><i className="ti ti-clock" /> Submitted {new Date(submittedAt).toLocaleString()}</div>}
        <div className="ty-note">
          You may close this window or sign out below.
        </div>
        <hr className="ty-divider" />
        <button className="btn-signout" onClick={handleSignOut}>
          <i className="ti ti-logout" /> Sign Out
        </button>
      </div>
    </CandidateLayout>
  );
}
