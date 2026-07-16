import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { preferredRole, useAuthStore, type Role } from "../../store/authStore";

type AuthMode = "login" | "signup";
type SignupRole = "student" | "faculty";

const css = `
*,*::before,*::after{box-sizing:border-box}
button,input,select{font:inherit}
.auth-page{min-height:100vh;width:100%;font-family:var(--font);color:#101828;background:radial-gradient(circle at 8% 0%,rgba(179,18,52,.1),transparent 34%),linear-gradient(135deg,#fff 0%,#f7f8fb 54%,#eef4fb 100%);overflow:hidden}
.auth-shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(420px,.9fr);padding:18px}
.auth-hero{position:relative;min-height:calc(100vh - 36px);border-radius:32px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:42px;background:#f5f7fb;box-shadow:inset 0 0 0 1px rgba(255,255,255,.7)}
.auth-hero-bg{position:absolute;inset:-18px;background-image:linear-gradient(90deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.76) 36%,rgba(255,255,255,.26) 100%),url('/auth-assets/campus-building.png');background-size:cover;background-position:center;transform:scale(1.04);animation:authDrift 18s ease-in-out infinite alternate}
.auth-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.74));backdrop-filter:blur(1.5px);pointer-events:none}
.hero-top,.hero-main,.hero-bottom{position:relative;z-index:1}
.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
.brand-mark{display:inline-flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid rgba(255,255,255,.76);border-radius:999px;background:rgba(255,255,255,.54);backdrop-filter:blur(18px);box-shadow:0 10px 34px rgba(16,24,40,.07);font-size:13px;font-weight:700;color:#621426}
.brand-dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#b31234,#d8a63a);box-shadow:0 0 0 5px rgba(179,18,52,.1)}
.hero-main{max-width:720px;padding:42px 0 24px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;margin-bottom:18px;color:#245481;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.hero-title{font-size:clamp(52px,6.4vw,86px);line-height:.92;letter-spacing:0;font-weight:850;color:#151927;margin:0 0 22px;max-width:100%;overflow-wrap:break-word}
.hero-copy{max-width:590px;font-size:clamp(17px,1.7vw,22px);line-height:1.5;color:#344054;margin:0 0 28px}
.hero-bottom{display:flex;align-items:flex-end;justify-content:flex-end;gap:24px}
.logo-strip{display:flex;align-items:center;gap:22px;padding:16px 20px;border:1px solid rgba(255,255,255,.72);border-radius:24px;background:rgba(255,255,255,.7);backdrop-filter:blur(20px);box-shadow:0 12px 34px rgba(16,24,40,.08)}
.logo-strip img{display:block;max-height:56px;width:auto;object-fit:contain;filter:saturate(.96)}
.logo-strip img:nth-child(2){max-height:68px}
.security-note{max-width:250px;color:#475467;font-size:13px;line-height:1.5;text-align:right}
.auth-panel{display:flex;align-items:center;justify-content:center;padding:22px clamp(18px,3vw,42px);min-width:0}
.auth-card{width:100%;max-width:440px;max-height:calc(100vh - 44px);overflow:auto;border:1px solid rgba(226,232,240,.9);border-radius:22px;background:rgba(255,255,255,.92);backdrop-filter:blur(24px);box-shadow:0 22px 70px rgba(16,24,40,.14),0 1px 0 rgba(255,255,255,.9) inset;padding:24px;animation:cardIn .36s cubic-bezier(.2,.9,.2,1) both}
.card-head{margin-bottom:18px}
.card-kicker{color:#b31234;font-weight:800;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.card-title{font-size:clamp(24px,2.8vw,30px);line-height:1.12;letter-spacing:0;font-weight:820;color:#101828;margin:0 0 7px}
.card-subtitle{font-size:13px;line-height:1.45;color:#667085;margin:0}
.tabs{position:relative;display:grid;grid-template-columns:1fr 1fr;margin:0 0 18px;padding:4px;border-radius:14px;background:#f1f4f8;border:1px solid #e7ebf0}
.tabs::before{content:"";position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:999px;background:#fff;box-shadow:0 8px 20px rgba(16,24,40,.08);transition:transform .22s ease}
.tabs.signup::before{transform:translateX(100%)}
.tab{position:relative;z-index:1;border:0;background:transparent;border-radius:11px;padding:8px 12px;color:#667085;font-weight:800;font-size:13px;transition:color .18s ease}
.tab.active{color:#101828}
.banner{display:flex;gap:9px;align-items:flex-start;margin-bottom:16px;border-radius:16px;padding:12px 13px;font-size:13px;line-height:1.45;border:1px solid}
.banner.error{background:#fff1f2;color:#9f1239;border-color:#fecdd3}
.banner.success{background:#ecfdf5;color:#047857;border-color:#a7f3d0}
.field-grid{display:flex;flex-direction:column;gap:13px}
.field{display:flex;flex-direction:column;gap:6px;min-width:0}
.field-row{display:flex;flex-direction:column;gap:13px;min-width:0}
.label{display:block;font-size:12px;line-height:1.2;font-weight:760;color:#344054}
.input-wrap{position:relative;min-width:0}
.input,.select{display:block;width:100%;min-width:0;height:42px;border:1px solid #d9dee8;border-radius:12px;background:rgba(255,255,255,.9);padding:0 12px;color:#101828;outline:0;font-size:14px;line-height:42px;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}
.select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,#667085 50%),linear-gradient(135deg,#667085 50%,transparent 50%);background-position:calc(100% - 18px) 20px,calc(100% - 12px) 20px;background-size:6px 6px,6px 6px;background-repeat:no-repeat}
.input.has-action{padding-right:46px}
.input:focus,.select:focus{border-color:#b31234;background:#fff;box-shadow:0 0 0 4px rgba(179,18,52,.1)}
.input.error{border-color:#f43f5e}
.icon-button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:34px;height:34px;border:0;border-radius:11px;background:transparent;color:#667085;display:grid;place-items:center;transition:background .18s ease,color .18s ease}
.icon-button:hover{background:#f2f4f7;color:#101828}
.helper-error{font-size:11px;color:#be123c;margin-top:0}
.form-options{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0}
.check{display:inline-flex;align-items:center;gap:8px;color:#475467;font-size:13px;font-weight:650}
.check input{width:16px;height:16px;accent-color:#b31234}
.link-button{border:0;background:transparent;color:#9d102d;font-weight:800;font-size:13px;padding:0}
.link-button:hover{text-decoration:underline}
.strength{display:grid;gap:6px}
.strength-bars{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.strength-bars span{height:4px;border-radius:999px;background:#e4e7ec}
.strength-bars span.on{background:linear-gradient(90deg,#b31234,#d8a63a)}
.strength-text{font-size:12px;color:#667085}
.primary-btn,.ghost-btn{height:44px;width:100%;border-radius:13px;font-size:14px;font-weight:850;display:inline-flex;align-items:center;justify-content:center;gap:9px;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,border-color .18s ease}
.primary-btn{border:0;background:linear-gradient(135deg,#9d102d,#b31234 58%,#245481);color:#fff;box-shadow:0 16px 34px rgba(179,18,52,.24)}
.primary-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 20px 42px rgba(179,18,52,.28)}
.primary-btn:disabled,.ghost-btn:disabled{opacity:.62;cursor:not-allowed}
.card-foot{margin-top:14px;text-align:center;color:#667085;font-size:13px}
.modal-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.36);backdrop-filter:blur(10px);animation:fadeIn .18s ease both}
.modal{width:min(100%,430px);border-radius:24px;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.82);box-shadow:0 24px 80px rgba(15,23,42,.22);padding:26px;animation:modalIn .22s ease both}
.modal-top{display:flex;justify-content:space-between;gap:18px;margin-bottom:16px}
.modal-icon{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:#fef4f6;color:#b31234;margin-bottom:14px}
.modal h2{font-size:24px;margin:0 0 8px;color:#101828}
.modal p{margin:0;color:#667085;line-height:1.55;font-size:14px}
.close-btn{width:34px;height:34px;border:0;border-radius:11px;background:#f2f4f7;color:#475467;display:grid;place-items:center}
.toast{position:fixed;right:20px;bottom:20px;z-index:60;max-width:360px;border-radius:18px;border:1px solid #a7f3d0;background:rgba(236,253,245,.94);backdrop-filter:blur(16px);color:#047857;box-shadow:0 16px 50px rgba(16,24,40,.16);padding:13px 14px;font-size:14px;animation:toastIn .22s ease both}
@keyframes authDrift{from{transform:scale(1.04) translate3d(0,0,0)}to{transform:scale(1.09) translate3d(-14px,-8px,0)}}
@keyframes cardIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media(max-width:1280px){.auth-shell{grid-template-columns:minmax(0,1fr) minmax(380px,.82fr)}.auth-card{padding:22px}.hero-title{font-size:clamp(46px,5.4vw,72px)}}
@media(max-width:1100px){.auth-shell{grid-template-columns:1fr;padding:14px}.auth-hero{min-height:auto;padding:30px;border-radius:26px}.hero-main{padding:34px 0 24px}.auth-panel{padding:18px 0 10px}.auth-card{max-width:480px;max-height:none}.security-note{text-align:left}.hero-bottom{align-items:flex-start;justify-content:flex-start}}
@media(max-width:680px){.auth-shell{padding:0}.auth-hero{border-radius:0;padding:22px;min-height:350px}.hero-top{display:grid}.hero-title{font-size:44px}.hero-copy{font-size:15px}.hero-bottom{display:grid}.logo-strip{width:100%;justify-content:space-between;gap:14px;padding:12px 14px}.logo-strip img{max-width:48%;max-height:48px;height:auto}.logo-strip img:nth-child(2){max-height:58px}.auth-panel{padding:14px 12px 24px}.auth-card{padding:18px;border-radius:20px}.form-options{align-items:flex-start;flex-direction:column}.card-title{font-size:24px}.card-subtitle{font-size:13px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

const EyeIcon = ({ off }: { off?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {off ? <path d="m3 3 18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : null}
    <path d="M2.1 12.4s3.6-6.3 9.9-6.3 9.9 6.3 9.9 6.3-3.6 6.3-9.9 6.3-9.9-6.3-9.9-6.3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.2-8.56" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [role, setRole] = useState<SignupRole>("student");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invitationBanner, setInvitationBanner] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);
  const apiUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token")) {
      setInvitationBanner("You've been invited to take an assessment. Sign in below to proceed.");
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid university email.";
    if (mode === "signup") {
      if (password && password.length < 8) errors.password = "Use at least 8 characters.";
      if (confirmPassword && password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
      if (rollNumber && rollNumber.length < 3) errors.rollNumber = "Enter a valid roll number.";
    }
    return errors;
  }, [confirmPassword, email, mode, password, rollNumber]);

  const bootstrapPortalSession = async (token: string) => {
    const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Your portal profile or role is not configured.");
    const payload = await response.json() as {
      user: { id: string; full_name?: string; email: string };
      roles: string[];
    };
    const roles = payload.roles
      .map((assignedRole) => assignedRole.toUpperCase())
      .filter((assignedRole): assignedRole is Role => ["STUDENT", "FACULTY", "PROCTOR", "ADMIN", "CANDIDATE"].includes(assignedRole));
    const activeRole = preferredRole(roles);
    if (!activeRole) throw new Error("No portal role is assigned to this account.");
    setSession({
      id: payload.user.id,
      fullName: payload.user.full_name ?? "",
      email: payload.user.email,
      roles,
    }, token);
    setActiveRole(activeRole);
    navigate(activeRole === "CANDIDATE" ? "/candidate/state" : `/${activeRole.toLowerCase()}/dashboard`, { replace: true });
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (Object.keys(fieldErrors).length) {
      setError("Please resolve the highlighted fields.");
      return;
    }
    if (mode === "signup" && !terms) {
      setError("Please accept the terms to create your account.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (!data.user || !data.session) throw new Error("Login succeeded but no session was returned.");
        window.localStorage.setItem("webassess-remember", rememberMe ? "true" : "false");
        await bootstrapPortalSession(data.session.access_token);
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              roll_number: rollNumber,
              role,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session && data.user) {
          await bootstrapPortalSession(data.session.access_token);
          return;
        }
        setToast("Account created. Check your email to verify your WebAssess access.");
        setSuccess("Account created. Check your email to verify, then sign in.");
        setFullName("");
        setRollNumber("");
        setPassword("");
        setConfirmPassword("");
        setTerms(false);
        switchMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetLoading(false);
    if (resetError) {
      setError(resetError.message);
      setResetOpen(false);
      return;
    }
    setResetSent(true);
    setToast("We've sent a password reset link to your email.");
  };

  return (
    <main className="auth-page">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <section className="auth-shell" aria-label="WebAssess authentication">
        <aside className="auth-hero" aria-label="WebAssess platform overview">
          <div className="auth-hero-bg" aria-hidden="true" />
          <div className="hero-top">
            <div className="brand-mark"><span className="brand-dot" /> TIET Secure Assessment Cloud</div>
            <div className="logo-strip" aria-label="TIET and TSLAS logos">
              <img src="/auth-assets/tiet-logo.png" alt="Thapar Institute of Engineering and Technology" />
              <img src="/auth-assets/tslas-logo.png" alt="Thapar School of Liberal Arts and Sciences" />
            </div>
          </div>

          <div className="hero-main">
            <div className="eyebrow">AI Powered Online Examination Platform</div>
            <h1 className="hero-title">WebAssess</h1>
            <p className="hero-copy">Secure. Smart. Seamless online assessments for Thapar Institute of Engineering & Technology.</p>
          </div>

          <div className="hero-bottom">
            <p className="security-note">Encrypted sessions, role-aware access, and assessment workflows designed for university scale.</p>
          </div>
        </aside>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="card-head">
              <div className="card-kicker">Secure Assessment Platform for TIET</div>
              <h2 className="card-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="card-subtitle">
                {mode === "login" ? "Sign in to continue to your WebAssess dashboard." : "Use your university identity to request WebAssess access."}
              </p>
            </div>

            <div className={`tabs ${mode}`} role="tablist" aria-label="Authentication mode">
              <button type="button" role="tab" aria-selected={mode === "login"} className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>Login</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} className={`tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>Sign Up</button>
            </div>

            {invitationBanner && <div className="banner success" role="status">{invitationBanner}</div>}
            {error && <div className="banner error" role="alert">{error}</div>}
            {success && <div className="banner success" role="status">{success}</div>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="field-grid">
                {mode === "signup" && (
                  <div className="field">
                    <label className="label" htmlFor="fullName">Full Name</label>
                    <input id="fullName" className="input" type="text" placeholder="Aarav Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
                  </div>
                )}

                <div className="field">
                  <label className="label" htmlFor="email">{mode === "login" ? "Email" : "University Email"}</label>
                  <input id="email" className={`input ${fieldErrors.email ? "error" : ""}`} type="email" placeholder="name@thapar.edu" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} />
                  {fieldErrors.email && <div className="helper-error">{fieldErrors.email}</div>}
                </div>

                {mode === "signup" && (
                  <div className="field-row">
                    <div className="field">
                      <label className="label" htmlFor="rollNumber">Roll Number</label>
                      <input id="rollNumber" className={`input ${fieldErrors.rollNumber ? "error" : ""}`} type="text" placeholder="1022XXXX" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required autoComplete="off" aria-invalid={Boolean(fieldErrors.rollNumber)} />
                      {fieldErrors.rollNumber && <div className="helper-error">{fieldErrors.rollNumber}</div>}
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="role">Role</label>
                      <select id="role" className="select" value={role} onChange={(e) => setRole(e.target.value as SignupRole)}>
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="field">
                  <label className="label" htmlFor="password">Password</label>
                  <div className="input-wrap">
                    <input id="password" className={`input has-action ${fieldErrors.password ? "error" : ""}`} type={showPwd ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : 6} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={Boolean(fieldErrors.password)} />
                    <button className="icon-button" type="button" aria-label={showPwd ? "Hide password" : "Show password"} onClick={() => setShowPwd((shown) => !shown)}><EyeIcon off={showPwd} /></button>
                  </div>
                  {fieldErrors.password && <div className="helper-error">{fieldErrors.password}</div>}
                </div>

                {mode === "signup" && (
                  <>
                    <div className="field">
                      <label className="label" htmlFor="confirmPassword">Confirm Password</label>
                      <input id="confirmPassword" className={`input ${fieldErrors.confirmPassword ? "error" : ""}`} type={showPwd ? "text" : "password"} placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.confirmPassword)} />
                      {fieldErrors.confirmPassword && <div className="helper-error">{fieldErrors.confirmPassword}</div>}
                    </div>
                    <div className="strength" aria-label="Password strength">
                      <div className="strength-bars">{[1, 2, 3, 4].map((bar) => <span key={bar} className={passwordScore >= bar ? "on" : ""} />)}</div>
                      <div className="strength-text">{password ? ["Very weak", "Getting there", "Good", "Strong"][Math.max(passwordScore - 1, 0)] : "Use 8+ characters with a number and symbol."}</div>
                    </div>
                  </>
                )}

                {mode === "login" ? (
                  <div className="form-options">
                    <label className="check"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Remember me</label>
                    <button className="link-button" type="button" onClick={() => { setResetEmail(email); setResetSent(false); setResetOpen(true); }}>Forgot Password?</button>
                  </div>
                ) : (
                  <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required /> I agree to Terms</label>
                )}

                <button className="primary-btn" type="submit" disabled={loading}>
                  {loading ? <SpinnerIcon /> : null}
                  {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
                </button>
              </div>
            </form>

            <div className="card-foot">
              {mode === "login" ? <>New to WebAssess? <button className="link-button" type="button" onClick={() => switchMode("signup")}>Create account</button></> : <>Already registered? <button className="link-button" type="button" onClick={() => switchMode("login")}>Login</button></>}
            </div>
          </div>
        </section>
      </section>

      {resetOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setResetOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <div className="modal-top">
              <div>
                <div className="modal-icon"><MailIcon /></div>
                <h2 id="reset-title">Forgot Password?</h2>
                <p>{resetSent ? "We've sent a password reset link to your email." : "Enter your university email and we'll send a secure reset link."}</p>
              </div>
              <button className="close-btn" type="button" aria-label="Close forgot password modal" onClick={() => setResetOpen(false)}><CloseIcon /></button>
            </div>

            {!resetSent ? (
              <form className="field-grid" onSubmit={handleReset}>
                <div className="field">
                  <label className="label" htmlFor="resetEmail">Email</label>
                  <input id="resetEmail" className="input" type="email" placeholder="name@thapar.edu" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoFocus />
                </div>
                <button className="primary-btn" type="submit" disabled={resetLoading}>{resetLoading ? <SpinnerIcon /> : null}{resetLoading ? "Sending..." : "Send Reset Link"}</button>
              </form>
            ) : (
              <button className="primary-btn" type="button" onClick={() => setResetOpen(false)}>Done</button>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
