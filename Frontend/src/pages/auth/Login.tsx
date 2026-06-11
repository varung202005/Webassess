import LegacyPage from "../../components/LegacyPage";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:var(--font);-webkit-font-smoothing:antialiased;}
body{display:flex;min-height:100vh;background:#F7F8FA;}
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
  content: '';
  position: absolute; top: -80px; right: -80px;
  width: 320px; height: 320px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
}
.auth-left::after {
  content: '';
  position: absolute; bottom: -120px; left: -60px;
  width: 400px; height: 400px;
  border-radius: 50%;
  background: rgba(0,0,0,0.08);
}
.auth-left-content { position: relative; z-index: 1; }
.auth-logo { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 6px; }
.auth-logo span { color: rgba(255,255,255,0.6); }
.auth-institution { font-size: 13px; color: rgba(255,255,255,0.65); font-weight: 500; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 56px; }
.auth-left-headline { font-size: 32px; font-weight: 700; color: #fff; line-height: 1.25; margin-bottom: 16px; letter-spacing: -0.5px; }
.auth-left-sub { font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 48px; }
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
.auth-form-sub { font-size: 13px; color: var(--c-gray-600); margin-bottom: 28px; }

/* Role selector */
.role-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
.role-btn {
  padding: 9px 10px; border: 1.5px solid var(--c-gray-200);
  border-radius: var(--radius-lg); background: #fff;
  font-size: 12px; font-weight: 600; color: var(--c-gray-600);
  cursor: pointer; transition: all .12s; text-align: center;
}
.role-btn:hover { border-color: var(--c-primary-400); color: var(--c-primary-700); background: var(--c-primary-50); }
.role-btn.active { border-color: var(--c-primary-600); color: var(--c-primary-700); background: var(--c-primary-100); }
.role-btn i { font-size: 16px; display: block; margin-bottom: 3px; }

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
.forgot-link { font-size: 13px; color: var(--c-primary-700); font-weight: 500; cursor: pointer; }
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

.auth-divider { text-align: center; font-size: 12px; color: var(--c-gray-400); margin: 18px 0; position: relative; }
.auth-divider::before, .auth-divider::after { content: ''; position: absolute; top: 50%; width: calc(50% - 30px); height: 1px; background: var(--c-gray-200); }
.auth-divider::before { left: 0; } .auth-divider::after { right: 0; }

.auth-signup-row { text-align: center; font-size: 13px; color: var(--c-gray-600); margin-top: 16px; }
.auth-signup-row a { color: var(--c-primary-700); font-weight: 600; cursor: pointer; }

/* Error banner */
.error-banner { background: var(--c-danger-100); border: 1px solid #FCA5A5; border-radius: var(--radius-md); padding: 10px 14px; font-size: 13px; color: var(--c-danger-700); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }`;

const html = `<div class="auth-left">
  <div class="auth-left-content">
    <div class="auth-logo">EXAM<span>.</span>TIET</div>
    <div class="auth-institution">Thapar Institute · Examination Portal</div>
    <div class="auth-left-headline">Online Examination Platform</div>
    <div class="auth-left-sub">Secure, proctored, and fully automated examinations for 50,000+ students across all departments.</div>
    <div class="auth-features">
      <div class="auth-feature">
        <div class="auth-feature-icon"><i class="ti ti-shield-check"></i></div>
        <div class="auth-feature-text">AI-powered proctoring with face verification and browser monitoring</div>
      </div>
      <div class="auth-feature">
        <div class="auth-feature-icon"><i class="ti ti-bolt"></i></div>
        <div class="auth-feature-text">Real-time auto-save and instant result computation</div>
      </div>
      <div class="auth-feature">
        <div class="auth-feature-icon"><i class="ti ti-chart-bar"></i></div>
        <div class="auth-feature-text">Detailed analytics, grade distribution and performance insights</div>
      </div>
      <div class="auth-feature">
        <div class="auth-feature-icon"><i class="ti ti-lock"></i></div>
        <div class="auth-feature-text">Encrypted, tamper-proof submissions with full audit trail</div>
      </div>
    </div>
  </div>
  <div class="auth-left-footer">© 2026 Thapar Institute of Engineering & Technology · All Rights Reserved</div>
</div>

<div class="auth-right">
  <div class="auth-form-box">
    <div class="auth-form-title">Welcome back</div>
    <div class="auth-form-sub">Sign in to your examination portal account</div>

    <!-- Error state (hidden by default) -->
    <!-- <div class="error-banner"><i class="ti ti-alert-circle"></i> Invalid email or password. Please try again.</div> -->

    <!-- Role Selector -->
    <div class="role-selector">
      <button class="role-btn active" onclick="setRole(this)"><i class="ti ti-user-graduate"></i>Student</button>
      <button class="role-btn" onclick="setRole(this)"><i class="ti ti-chalkboard"></i>Faculty</button>
      <button class="role-btn" onclick="setRole(this)"><i class="ti ti-eye"></i>Proctor</button>
      <button class="role-btn" onclick="setRole(this)"><i class="ti ti-settings"></i>Admin</button>
    </div>

    <div class="form-group">
      <label class="form-label">University Email</label>
      <input class="form-control" type="email" placeholder="rollno@thapar.edu" value="102417042@tiet.ac.in">
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <div class="form-control-wrap">
        <input class="form-control" type="password" id="pwd" placeholder="Enter your password" value="••••••••">
        <i class="ti ti-eye" onclick="togglePwd()"></i>
      </div>
    </div>
    <div class="form-row-2">
      <label class="remember-label"><input type="checkbox" checked> Remember me</label>
      <span class="forgot-link">Forgot password?</span>
    </div>
    <button class="btn-login" onclick="doLogin()">
      <i class="ti ti-login"></i> Sign In
    </button>
    <div class="auth-signup-row">
      New to the portal? <a onclick="">Request access from admin</a>
    </div>
  </div>
</div>`;

const script = `function setRole(el) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}
function togglePwd() {
  const p = document.getElementById('pwd');
  p.type = p.type === 'password' ? 'text' : 'password';
}
function doLogin() {
  window.location.href = '/student/dashboard';
}`;

export default function Login() {
  return <LegacyPage css={css} html={html} script={script} />;
}
