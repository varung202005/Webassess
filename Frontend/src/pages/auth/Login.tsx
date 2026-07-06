import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore, type Role } from "../../store/authStore";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
.auth-page{display:flex;min-height:100vh;width:100%;font-family:var(--font);background:#F7F8FA;}
button{font-family:var(--font);cursor:pointer;}

/* ── SPLIT LAYOUT ── */
.auth-left {
  width: 480px; flex-shrink: 0;
  background: var(--c-primary-700);
  display: flex; flex-direction: column;
  padding: 48px 52px;
  position: relative; overflow: hidden;
}
.auth-left::before {
  content: ''; position: absolute; top: -80px; right: -80px;
  width: 320px; height: 320px; border-radius: 50%;
  background: rgba(255,255,255,0.05);
}
.auth-left::after {
  content: ''; position: absolute; bottom: -120px; left: -60px;
  width: 400px; height: 400px; border-radius: 50%;
  background: rgba(0,0,0,0.08);
}
.auth-left-content { position: relative; z-index: 1; }
.auth-logo { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 6px; }
.auth-logo span { color: rgba(255,255,255,0.6); }
.auth-institution { font-size: 13px; color: rgba(255,255,255,0.65); font-weight: 500; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 56px; }
.auth-left-headline { font-size: 32px; font-weight: 700; color: #fff; line-height: 1.25; margin-bottom: 16px; letter-spacing: -0.5px; }
.auth-left-sub { font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 40px; }

.auth-stats { display: flex; gap: 28px; margin-bottom: 40px; }
.auth-stat-num { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
.auth-stat-label { font-size: 11.5px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }

.auth-features { display: flex; flex-direction: column; gap: 14px; }
.auth-feature { display: flex; align-items: center; gap: 12px; }
.auth-feature-icon { width: 32px; height: 32px; border-radius: var(--radius-lg); background: rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; font-size: 16px; color: rgba(255,255,255,0.9); flex-shrink: 0; }
.auth-feature-text { font-size: 13px; color: rgba(255,255,255,0.75); }
.auth-left-footer { margin-top: auto; padding-top: 40px; font-size: 11px; color: rgba(255,255,255,0.35); }

/* ── RIGHT PANEL ── */
.auth-right {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 48px 40px; background: #F7F8FA;
}
.auth-form-box {
  width: 100%; max-width: 420px;
  background: #fff; border: 1px solid var(--c-gray-200);
  border-radius: 12px; padding: 36px 36px;
  box-shadow: var(--shadow-lg);
}
.auth-form-title { font-size: 22px; font-weight: 700; color: var(--c-gray-900); margin-bottom: 4px; letter-spacing: -0.3px; }
.auth-form-sub { font-size: 13px; color: var(--c-gray-600); margin-bottom: 24px; }

/* Sign in / Create account tabs */
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; background: var(--c-gray-50); border: 1px solid var(--c-gray-200); border-radius: var(--radius-lg); padding: 4px; }
.auth-tab {
  padding: 8px 10px; border: none; border-radius: calc(var(--radius-lg) - 2px);
  background: transparent; font-size: 13px; font-weight: 600; color: var(--c-gray-600);
  cursor: pointer; transition: all .12s; text-align: center;
}
.auth-tab.active { background: #fff; color: var(--c-primary-700); box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06)); }

.form-group { margin-bottom: 16px; }
.form-label { font-size: 12.5px; font-weight: 600; color: var(--c-gray-700); margin-bottom: 5px; display: block; }
.form-control {
  width: 100%; padding: 9px 12px;
  border: 1px solid var(--c-gray-200); border-radius: var(--radius-lg);
  font-size: 14px; font-family: var(--font); color: var(--c-gray-800);
  outline: none; transition: border-color .12s;
  background: var(--c-gray-50);
}
.form-control:focus { border-color: var(--c-primary-600); background: #fff; box-shadow: 0 0 0 3px rgba(196,30,58,.08); }
.form-control-wrap { position: relative; }
.form-control-wrap i { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 16px; color: var(--c-gray-400); cursor: pointer; }
.form-control-wrap .form-control { padding-right: 36px; }

.form-row-2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.remember-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--c-gray-600); cursor: pointer; }
.forgot-link { font-size: 13px; color: var(--c-primary-700); font-weight: 500; cursor: pointer; background: none; border: none; padding: 0; }
.forgot-link:hover { text-decoration: underline; }

.btn-login {
  width: 100%; padding: 11px;
  background: var(--c-primary-700); color: #fff;
  border: none; border-radius: var(--radius-lg);
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: background .12s; font-family: var(--font);
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.btn-login:hover { background: var(--c-primary-800); }
.btn-login:disabled { opacity: .65; cursor: not-allowed; }

.auth-signup-row { text-align: center; font-size: 13px; color: var(--c-gray-600); margin-top: 16px; }
.auth-signup-row button { color: var(--c-primary-700); font-weight: 600; cursor: pointer; background: none; border: none; padding: 0; font-size: 13px; }

/* Banners */
.error-banner { background: var(--c-danger-100); border: 1px solid #FCA5A5; border-radius: var(--radius-md); padding: 10px 14px; font-size: 13px; color: var(--c-danger-700); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.success-banner { background: #ECFDF5; border: 1px solid #6EE7B7; border-radius: var(--radius-md); padding: 10px 14px; font-size: 13px; color: #047857; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
@media(max-width:900px){.auth-left{width:360px;padding:38px 32px}.auth-right{padding:32px 24px}}
@media(max-width:680px){.auth-page{display:block;background:#f7f8fa}.auth-left{display:none}.auth-right{min-height:100vh;width:100%;padding:22px 16px}.auth-form-box{max-width:440px;padding:26px 20px;border-radius:18px}.auth-form-title{font-size:21px}.form-row-2{justify-content:flex-end}}
@media(max-width:380px){.auth-right{padding:12px}.auth-form-box{padding:22px 16px}.auth-tabs{gap:3px}}`;

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invitationBanner, setInvitationBanner] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);
  const apiUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

  // If arriving via invitation link (?token=xxx), show a welcome banner
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setInvitationBanner("You've been invited to take an assessment. Sign in below to proceed.");
    }
  }, []);

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
      .map((role) => role.toUpperCase())
      .filter((role): role is Role => ["STUDENT", "FACULTY", "PROCTOR", "ADMIN", "CANDIDATE"].includes(role));
    if (!roles.length) throw new Error("No portal role is assigned to this account.");
    const role = roles[0];
    setSession({
      id: payload.user.id,
      fullName: payload.user.full_name ?? "",
      email: payload.user.email,
      roles,
    }, token);
    setActiveRole(role);
    // Candidates skip the dashboard — go directly to exam state gate
    if (role === "CANDIDATE") {
      navigate("/candidate/state", { replace: true });
    } else {
      navigate(`/${role.toLowerCase()}/dashboard`, { replace: true });
    }
  };

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const supaUser = data.user;
        const session = data.session;

        if (!supaUser || !session) {
          throw new Error("Login succeeded but no session was returned.");
        }

        await bootstrapPortalSession(session.access_token);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: "student",
            },
          },
        });
        if (error) throw error;

        if (data.session && data.user) {
          await bootstrapPortalSession(data.session.access_token);
          return;
        }

        setSuccess("Account created! Check your email to verify, then sign in.");
        setFullName("");
        setPassword("");
        setConfirmPassword("");
        switchMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    setError(null);
    setSuccess(null);
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (resetError) setError(resetError.message);
    else setSuccess("Password reset instructions have been sent to your email.");
  };

  return (
    <div className="auth-page">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-logo">EXAM<span>.</span>TIET</div>
          <div className="auth-institution">Thapar Institute · Examination Portal</div>
          <div className="auth-left-headline">Online Examination Platform</div>
          <div className="auth-left-sub">
            Secure, proctored, and fully automated examinations for 50,000+ students across all departments.
          </div>

          <div className="auth-stats">
            <div>
              <div className="auth-stat-num">50K+</div>
              <div className="auth-stat-label">Students</div>
            </div>
            <div>
              <div className="auth-stat-num">120+</div>
              <div className="auth-stat-label">Courses</div>
            </div>
            <div>
              <div className="auth-stat-num">99.9%</div>
              <div className="auth-stat-label">Uptime</div>
            </div>
          </div>

          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon"><i className="ti ti-shield-check"></i></div>
              <div className="auth-feature-text">AI-powered proctoring with face verification and browser monitoring</div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><i className="ti ti-bolt"></i></div>
              <div className="auth-feature-text">Real-time auto-save and instant result computation</div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><i className="ti ti-chart-bar"></i></div>
              <div className="auth-feature-text">Detailed analytics, grade distribution and performance insights</div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><i className="ti ti-lock"></i></div>
              <div className="auth-feature-text">Encrypted, tamper-proof submissions with full audit trail</div>
            </div>
          </div>
        </div>
        <div className="auth-left-footer">© 2026 Thapar Institute of Engineering & Technology · All Rights Reserved</div>
      </div>

      <div className="auth-right">
        <div className="auth-form-box">
          <div className="auth-form-title">{mode === "login" ? "Welcome back" : "Create your account"}</div>
          <div className="auth-form-sub">
            {mode === "login"
              ? "Sign in to your examination portal account"
              : "Register with your university email to get started"}
          </div>

          <div className="auth-tabs">
            <button type="button" className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>
              Sign In
            </button>
            <button type="button" className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>
              Create Account
            </button>
          </div>

          {invitationBanner && (
            <div className="success-banner">
              <i className="ti ti-mail"></i> {invitationBanner}
            </div>
          )}
          {error && (
            <div className="error-banner">
              <i className="ti ti-alert-circle"></i> {error}
            </div>
          )}
          {success && (
            <div className="success-banner">
              <i className="ti ti-circle-check"></i> {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">University Email</label>
              <input
                className="form-control"
                type="email"
                placeholder="rollno@thapar.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="form-control-wrap">
                <input
                  className="form-control"
                  type={showPwd ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button type="button" aria-label={showPwd ? "Hide password" : "Show password"} onClick={() => setShowPwd((s) => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "var(--c-gray-400)" }}>
                  <i className={`ti ${showPwd ? "ti-eye-off" : "ti-eye"}`}></i>
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  className="form-control"
                  type={showPwd ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === "login" && (
              <div className="form-row-2">
                <button type="button" className="forgot-link" onClick={sendPasswordReset} disabled={loading}>Forgot password?</button>
              </div>
            )}

            <button className="btn-login" type="submit" disabled={loading}>
              <i className={`ti ${mode === "login" ? "ti-login" : "ti-user-plus"}`}></i>
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="auth-signup-row">
            {mode === "login" ? (
              <>New to the portal? <button onClick={() => switchMode("signup")}>Create an account</button></>
            ) : (
              <>Already have an account? <button onClick={() => switchMode("login")}>Sign in</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
