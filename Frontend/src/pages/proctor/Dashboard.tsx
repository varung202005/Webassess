import LegacyPage from "../../components/LegacyPage";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:var(--font);font-size:14px;color:var(--c-gray-800);background:var(--c-bg);-webkit-font-smoothing:antialiased;}
button{font-family:var(--font);cursor:pointer;border:none;background:none;}
.app-shell{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:var(--sidebar-w);background:var(--c-sidebar);display:flex;flex-direction:column;flex-shrink:0;height:100vh;overflow-y:auto;}
.sidebar-logo{padding:0 20px;height:var(--header-h);display:flex;align-items:center;border-bottom:1px solid rgba(0,0,0,.12);}
.logo-text{font-size:18px;font-weight:700;color:#fff;}
.logo-sub{font-size:10px;color:rgba(255,255,255,.5);font-weight:500;letter-spacing:.8px;text-transform:uppercase;margin-top:1px;}
.sidebar-section{padding:20px 12px 8px;}
.sidebar-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.4);letter-spacing:.8px;text-transform:uppercase;padding:0 8px;margin-bottom:4px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-lg);color:rgba(255,255,255,.75);font-size:13.5px;font-weight:500;cursor:pointer;position:relative;margin-bottom:2px;transition:background .12s;width:100%;text-align:left;}
.nav-item:hover{background:rgba(0,0,0,.12);color:#fff;}
.nav-item.active{background:rgba(0,0,0,.2);color:#fff;}
.nav-item.active::before{content:'';position:absolute;left:0;top:6px;bottom:6px;width:3px;background:#fff;border-radius:0 2px 2px 0;}
.nav-item i{font-size:16px;flex-shrink:0;}
.nav-badge{margin-left:auto;background:rgba(0,0,0,.25);color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;}
.nav-badge.red{background:rgba(239,68,68,.8);}
.sidebar-bottom{margin-top:auto;padding:12px;border-top:1px solid rgba(0,0,0,.12);}
.sidebar-user{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-lg);}
.user-avatar{width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.2);color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.3);}
.user-name{font-size:13px;font-weight:600;color:#fff;}
.user-role{font-size:11px;color:rgba(255,255,255,.5);}
.main-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.header{height:var(--header-h);background:var(--c-card);border-bottom:1px solid var(--c-border);display:flex;align-items:center;padding:0 24px;gap:16px;flex-shrink:0;box-shadow:var(--shadow-sm);}
.breadcrumbs{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--c-gray-600);flex:1;}
.breadcrumbs .sep{color:var(--c-gray-300);}
.breadcrumbs .current{color:var(--c-gray-900);font-weight:500;}
.header-actions{display:flex;align-items:center;gap:4px;}
.icon-btn{width:36px;height:36px;border-radius:var(--radius-lg);color:var(--c-gray-600);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;}
.icon-btn:hover{background:var(--c-gray-100);}
.header-divider{width:1px;height:24px;background:var(--c-border);margin:0 4px;}
.header-user{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:var(--radius-lg);cursor:pointer;}
.header-user:hover{background:var(--c-gray-100);}
.header-avatar{width:30px;height:30px;border-radius:50%;background:var(--c-primary-700);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.header-user-name{font-size:13px;font-weight:500;color:var(--c-gray-800);}
.page-content{flex:1;overflow-y:auto;padding:28px 28px 40px;}
.page-header{margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
.page-title{font-size:22px;font-weight:700;color:var(--c-primary-800);letter-spacing:-0.3px;}
.page-subtitle{font-size:13px;color:var(--c-gray-600);margin-top:3px;}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;font-size:13.5px;font-weight:500;border-radius:var(--radius-md);border:1px solid transparent;cursor:pointer;transition:all .12s;font-family:var(--font);}
.btn i{font-size:15px;}
.btn-primary{background:var(--c-primary-700);color:#fff;border-color:var(--c-primary-700);}
.btn-primary:hover{background:var(--c-primary-800);}
.btn-danger{background:var(--c-danger-100);color:var(--c-danger-700);border-color:var(--c-danger-500);}
.btn-danger:hover{background:var(--c-danger-500);color:#fff;}
.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border);}
.btn-secondary:hover{background:var(--c-gray-50);}
.btn-sm{padding:6px 12px;font-size:12.5px;}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;}
.stat-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:20px;box-shadow:var(--shadow-sm);position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.stat-card.red::before{background:var(--c-primary-600);}
.stat-card.danger::before{background:var(--c-danger-500);}
.stat-card.warning::before{background:var(--c-warning-500);}
.stat-card.green::before{background:var(--c-success-500);}
.stat-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.stat-label{font-size:12px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;}
.stat-icon{width:34px;height:34px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:17px;}
.stat-icon.red{background:var(--c-primary-100);color:var(--c-primary-700);}
.stat-icon.danger{background:var(--c-danger-100);color:var(--c-danger-700);}
.stat-icon.warning{background:var(--c-warning-100);color:var(--c-warning-700);}
.stat-icon.green{background:var(--c-success-100);color:var(--c-success-700);}
.stat-value{font-size:30px;font-weight:700;color:var(--c-gray-900);line-height:1;margin-bottom:6px;}
.stat-meta{font-size:12px;color:var(--c-gray-600);}
.card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm);}
.card-header{padding:16px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:14px;font-weight:600;color:var(--c-gray-900);display:flex;align-items:center;gap:8px;}
.card-title i{color:var(--c-gray-500);font-size:16px;}
.card-action{font-size:12.5px;color:var(--c-primary-700);font-weight:500;cursor:pointer;}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font-size:11px;font-weight:600;border-radius:var(--radius-sm);border:1px solid;text-transform:uppercase;letter-spacing:.3px;line-height:18px;}
.badge-dot{width:5px;height:5px;border-radius:50%;}
.badge-critical{background:var(--c-danger-100);color:var(--c-danger-700);border-color:var(--c-danger-500);}
.badge-critical .badge-dot{background:var(--c-danger-500);}
.badge-warning{background:var(--c-warning-100);color:var(--c-warning-700);border-color:var(--c-warning-500);}
.badge-warning .badge-dot{background:var(--c-warning-500);}
.badge-normal{background:var(--c-success-100);color:var(--c-success-700);border-color:var(--c-success-500);}
.badge-normal .badge-dot{background:var(--c-success-500);}
/* Live pulse */
.live-badge{display:flex;align-items:center;gap:6px;background:rgba(16,185,129,.15);color:#065F46;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;border:1px solid rgba(16,185,129,.3);}
.live-dot{width:6px;height:6px;border-radius:50%;background:#10B981;animation:pulse 1.5s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
/* Session banner */
.session-banner{background:linear-gradient(135deg,var(--c-primary-800),var(--c-primary-900));color:#fff;border-radius:var(--radius-xl);padding:16px 20px;display:flex;align-items:center;gap:14px;margin-bottom:20px;}
/* Alert items */
.alert-item{display:flex;align-items:flex-start;gap:12px;padding:12px 20px;border-bottom:1px solid var(--c-border);}
.alert-item:last-child{border-bottom:none;}
.alert-icon{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.alert-icon.critical{background:var(--c-danger-100);color:var(--c-danger-700);}
.alert-icon.warning{background:var(--c-warning-100);color:var(--c-warning-700);}
.alert-icon.info{background:var(--c-primary-100);color:var(--c-primary-700);}
.alert-body{flex:1;}
.alert-text{font-size:13px;font-weight:500;color:var(--c-gray-900);}
.alert-meta{font-size:12px;color:var(--c-gray-500);margin-top:2px;}
/* Proctor grid */
.proctor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.proctor-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);overflow:hidden;}
.proctor-card.flagged{border-color:var(--c-danger-500);}
.proctor-card.warning{border-color:var(--c-warning-500);}
.proctor-card-header{padding:9px 14px;display:flex;align-items:center;justify-content:space-between;}
.proctor-card-header.flagged{background:var(--c-danger-700);}
.proctor-card-header.warning{background:var(--c-warning-700);}
.proctor-card-header.normal{background:var(--c-primary-800);}
.proctor-card-name{font-size:11.5px;font-weight:600;color:#fff;}
.proctor-cam{height:72px;background:var(--c-gray-100);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--c-gray-400);border-bottom:1px solid var(--c-border);}
.proctor-cam.flagged-bg{background:var(--c-danger-100);color:var(--c-danger-700);font-weight:600;font-size:11.5px;}
.proctor-cam.warn-bg{background:var(--c-warning-100);color:var(--c-warning-700);font-weight:600;font-size:11.5px;}
.proctor-body{padding:10px 14px;}
.proctor-stat-row{display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0;}
.proctor-label{color:var(--c-gray-600);}
.proctor-val-ok{color:var(--c-success-700);font-weight:600;}
.proctor-val-warn{color:var(--c-warning-700);font-weight:600;}
.proctor-val-bad{color:var(--c-danger-700);font-weight:600;}
.integrity-wrap{margin-top:8px;}
.integrity-label{display:flex;justify-content:space-between;font-size:11px;color:var(--c-gray-500);margin-bottom:4px;}
.integrity-track{height:5px;background:var(--c-gray-200);border-radius:3px;}
.integrity-fill{height:100%;border-radius:3px;}
/* Content layout */
.content-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}
.data-table{width:100%;border-collapse:collapse;}
.data-table th{font-size:11px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;padding:10px 16px;text-align:left;background:var(--c-gray-50);border-bottom:1px solid var(--c-border);}
.data-table td{padding:12px 16px;font-size:13.5px;border-bottom:1px solid var(--c-border);vertical-align:middle;}
.data-table tr:last-child td{border-bottom:none;}
.data-table tbody tr:hover{background:var(--c-gray-50);cursor:pointer;}
.table-footer{padding:11px 20px;border-top:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--c-gray-600);background:var(--c-gray-50);}
.pagination{display:flex;gap:4px;}
.page-btn{width:28px;height:28px;border:1px solid var(--c-border);background:#fff;border-radius:var(--radius-md);font-size:12.5px;font-family:var(--font);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--c-gray-700);}
.page-btn.active{background:var(--c-primary-700);color:#fff;border-color:var(--c-primary-700);}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--c-gray-300);border-radius:3px;}`;

const html = `<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div><div class="logo-text">EXAM.TIET</div><div class="logo-sub">Proctor Portal</div></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Monitoring</div>
      <button class="nav-item active"><i class="ti ti-layout-dashboard"></i>Dashboard</button>
      <button class="nav-item"><i class="ti ti-device-tv"></i>Live Sessions</button>
      <button class="nav-item"><i class="ti ti-alert-triangle"></i>Flagged Students<span class="nav-badge red">6</span></button>
      <button class="nav-item"><i class="ti ti-clipboard-list"></i>Incident Review</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Reports</div>
      <button class="nav-item"><i class="ti ti-report-analytics"></i>Summary Reports</button>
      <button class="nav-item"><i class="ti ti-bell"></i>Notifications<span class="nav-badge">4</span></button>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">PM</div>
        <div style="flex:1;min-width:0;">
          <div class="user-name">Priya Malhotra</div>
          <div class="user-role">Proctor · Exam Cell</div>
        </div>
      </div>
    </div>
  </aside>

  <div class="main-wrap">
    <header class="header">
      <div class="breadcrumbs">
        <span>Proctor Portal</span><span class="sep">/</span>
        <span class="current">Dashboard</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn"><i class="ti ti-bell"></i></button>
        <div class="header-divider"></div>
        <span style="font-size:11px;font-weight:600;color:var(--c-primary-700);background:var(--c-primary-100);padding:4px 10px;border-radius:20px;">PROCTOR</span>
        <button class="header-user">
          <div class="header-avatar">PM</div>
          <span class="header-user-name">Priya Malhotra</span>
          <i class="ti ti-chevron-down" style="font-size:13px;color:var(--c-gray-500);"></i>
        </button>
      </div>
    </header>

    <main class="page-content">

      <!-- Live Session Banner -->
      <div class="session-banner">
        <i class="ti ti-device-tv" style="font-size:28px;opacity:.9;flex-shrink:0;"></i>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:600;">UCS301 — DAA Mid-Semester Exam · Active Session</div>
          <div style="font-size:12.5px;opacity:.7;margin-top:2px;">Started 10:00 AM · 148 candidates in progress · Ends in 01:12:44</div>
        </div>
        <div class="live-badge"><div class="live-dot"></div>LIVE</div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2);">
          <i class="ti ti-device-tv"></i> Open Monitor
        </button>
      </div>

      <div class="page-header">
        <div>
          <div class="page-title">Proctor Dashboard</div>
          <div class="page-subtitle">Thursday, June 11, 2026 · 1 active exam session</div>
        </div>
      </div>

      <!-- STATS -->
      <div class="stats-grid">
        <div class="stat-card red">
          <div class="stat-header"><div class="stat-label">Live Candidates</div><div class="stat-icon red"><i class="ti ti-users"></i></div></div>
          <div class="stat-value" style="color:var(--c-primary-700);">148</div>
          <div class="stat-meta">UCS301 Mid-Semester</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-header"><div class="stat-label">Flagged Attempts</div><div class="stat-icon danger"><i class="ti ti-flag"></i></div></div>
          <div class="stat-value" style="color:var(--c-danger-700);">6</div>
          <div class="stat-meta">Requires immediate review</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-header"><div class="stat-label">Tab Switches (30m)</div><div class="stat-icon warning"><i class="ti ti-browser"></i></div></div>
          <div class="stat-value" style="color:var(--c-warning-700);">14</div>
          <div class="stat-meta">3 students near limit</div>
        </div>
        <div class="stat-card green">
          <div class="stat-header"><div class="stat-label">Avg. Integrity Score</div><div class="stat-icon green"><i class="ti ti-shield-check"></i></div></div>
          <div class="stat-value" style="color:var(--c-success-700);">93.8</div>
          <div class="stat-meta">Out of 100</div>
        </div>
      </div>

      <!-- ALERTS + FLAGGED STUDENTS GRID -->
      <div class="content-row">

        <!-- Alert Feed -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-alert-triangle"></i> Live Alerts</div>
            <span style="background:var(--c-danger-100);color:var(--c-danger-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:var(--radius-sm);">6 critical</span>
          </div>
          <div>
            <div class="alert-item">
              <div class="alert-icon critical"><i class="ti ti-users"></i></div>
              <div class="alert-body">
                <div class="alert-text">Multiple persons detected — <strong>20CSE0047 Raj Mehta</strong></div>
                <div class="alert-meta">2 faces in camera frame · Confidence 91% · 3 min ago</div>
              </div>
              <button class="btn btn-sm btn-danger" style="flex-shrink:0;">Review</button>
            </div>
            <div class="alert-item">
              <div class="alert-icon critical"><i class="ti ti-device-mobile"></i></div>
              <div class="alert-body">
                <div class="alert-text">Phone detected — <strong>20CSE0112 Sneha Roy</strong></div>
                <div class="alert-meta">Object classified as mobile device · Confidence 87% · 5 min ago</div>
              </div>
              <button class="btn btn-sm btn-danger" style="flex-shrink:0;">Review</button>
            </div>
            <div class="alert-item">
              <div class="alert-icon warning"><i class="ti ti-browser"></i></div>
              <div class="alert-body">
                <div class="alert-text">Tab switch limit reached — <strong>20CSE0089 Arjun Gupta</strong></div>
                <div class="alert-meta">3/3 allowed switches used · Next switch = auto-submit · 7 min ago</div>
              </div>
              <button class="btn btn-sm btn-secondary" style="flex-shrink:0;">Monitor</button>
            </div>
            <div class="alert-item">
              <div class="alert-icon critical"><i class="ti ti-user-x"></i></div>
              <div class="alert-body">
                <div class="alert-text">Face not detected — <strong>20CSE0203 Vikram Joshi</strong></div>
                <div class="alert-meta">No face visible for 45 seconds · 9 min ago</div>
              </div>
              <button class="btn btn-sm btn-danger" style="flex-shrink:0;">Review</button>
            </div>
            <div class="alert-item">
              <div class="alert-icon warning"><i class="ti ti-maximize-off"></i></div>
              <div class="alert-body">
                <div class="alert-text">Fullscreen exited — <strong>20CSE0158 Pooja Rao</strong></div>
                <div class="alert-meta">Exited fullscreen mode · 2/3 allowed · 11 min ago</div>
              </div>
              <button class="btn btn-sm btn-secondary" style="flex-shrink:0;">Monitor</button>
            </div>
            <div class="alert-item">
              <div class="alert-icon warning"><i class="ti ti-volume"></i></div>
              <div class="alert-body">
                <div class="alert-text">High audio noise — <strong>20CSE0312 Aman Patel</strong></div>
                <div class="alert-meta">Background noise level 72dB detected · 14 min ago</div>
              </div>
              <button class="btn btn-sm btn-secondary" style="flex-shrink:0;">Monitor</button>
            </div>
          </div>
        </div>

        <!-- Integrity Score Distribution -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-chart-bar"></i> Integrity Score Distribution</div>
            <span class="card-action">Full Report</span>
          </div>
          <div style="padding:20px;">
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--c-gray-700);margin-bottom:5px;">
                <span>90–100 (Excellent)</span><span style="font-weight:600;color:var(--c-success-700);">104 students</span>
              </div>
              <div style="height:8px;background:var(--c-gray-200);border-radius:4px;"><div style="height:100%;width:70%;background:var(--c-success-500);border-radius:4px;"></div></div>
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--c-gray-700);margin-bottom:5px;">
                <span>70–89 (Good)</span><span style="font-weight:600;color:var(--c-primary-700);">28 students</span>
              </div>
              <div style="height:8px;background:var(--c-gray-200);border-radius:4px;"><div style="height:100%;width:19%;background:var(--c-primary-600);border-radius:4px;"></div></div>
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--c-gray-700);margin-bottom:5px;">
                <span>50–69 (Moderate Risk)</span><span style="font-weight:600;color:var(--c-warning-700);">10 students</span>
              </div>
              <div style="height:8px;background:var(--c-gray-200);border-radius:4px;"><div style="height:100%;width:7%;background:var(--c-warning-500);border-radius:4px;"></div></div>
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--c-gray-700);margin-bottom:5px;">
                <span>&lt;50 (Critical — Flagged)</span><span style="font-weight:600;color:var(--c-danger-700);">6 students</span>
              </div>
              <div style="height:8px;background:var(--c-gray-200);border-radius:4px;"><div style="height:100%;width:4%;background:var(--c-danger-500);border-radius:4px;"></div></div>
            </div>
            <div style="height:1px;background:var(--c-border);margin:16px 0;"></div>
            <div style="font-size:12.5px;color:var(--c-gray-600);">
              <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Face absence events</span><span style="font-weight:600;">22</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Multi-person detections</span><span style="font-weight:600;">8</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Phone detections</span><span style="font-weight:600;">3</span></div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Total tab switches</span><span style="font-weight:600;">14</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- LIVE STUDENT GRID -->
      <div class="card" style="margin-bottom:0;">
        <div class="card-header">
          <div class="card-title"><i class="ti ti-grid-dots"></i> Live Candidate Monitor</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:var(--c-gray-500);">Showing flagged first</span>
            <button class="btn btn-sm btn-secondary"><i class="ti ti-filter"></i>Filter</button>
          </div>
        </div>
        <div style="padding:16px;">
          <div class="proctor-grid">
            <!-- Card 1: FLAGGED -->
            <div class="proctor-card flagged">
              <div class="proctor-card-header flagged">
                <div class="proctor-card-name">20CSE0047 — Raj Mehta</div>
                <span class="badge badge-critical" style="font-size:9px;">FLAGGED</span>
              </div>
              <div class="proctor-cam flagged-bg"><i class="ti ti-users" style="font-size:18px;margin-right:6px;"></i>2 persons detected</div>
              <div class="proctor-body">
                <div class="proctor-stat-row"><span class="proctor-label">Face match</span><span class="proctor-val-bad">71%</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Tab switches</span><span class="proctor-val-ok">1/3</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Questions done</span><span>12/50</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Phone detected</span><span class="proctor-val-bad">Yes</span></div>
                <div class="integrity-wrap">
                  <div class="integrity-label"><span>Integrity</span><span style="color:var(--c-danger-700);font-weight:700;">38</span></div>
                  <div class="integrity-track"><div class="integrity-fill" style="width:38%;background:var(--c-danger-500);"></div></div>
                </div>
                <button class="btn btn-danger btn-sm" style="width:100%;margin-top:8px;justify-content:center;font-size:11.5px;">
                  <i class="ti ti-flag"></i> Flag & Review
                </button>
              </div>
            </div>

            <!-- Card 2: WARNING -->
            <div class="proctor-card warning">
              <div class="proctor-card-header warning">
                <div class="proctor-card-name">20CSE0089 — Arjun Gupta</div>
                <span class="badge badge-warning" style="font-size:9px;">WARNING</span>
              </div>
              <div class="proctor-cam warn-bg"><i class="ti ti-browser" style="font-size:18px;margin-right:6px;"></i>Tab limit reached</div>
              <div class="proctor-body">
                <div class="proctor-stat-row"><span class="proctor-label">Face match</span><span class="proctor-val-ok">93%</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Tab switches</span><span class="proctor-val-bad">3/3 !</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Questions done</span><span>8/50</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Phone detected</span><span class="proctor-val-ok">No</span></div>
                <div class="integrity-wrap">
                  <div class="integrity-label"><span>Integrity</span><span style="color:var(--c-warning-700);font-weight:700;">62</span></div>
                  <div class="integrity-track"><div class="integrity-fill" style="width:62%;background:var(--c-warning-500);"></div></div>
                </div>
                <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;justify-content:center;font-size:11.5px;">
                  <i class="ti ti-eye"></i> Monitor
                </button>
              </div>
            </div>

            <!-- Card 3: NORMAL -->
            <div class="proctor-card">
              <div class="proctor-card-header normal">
                <div class="proctor-card-name">20CSE0052 — Priya Nair</div>
                <span class="badge badge-normal" style="font-size:9px;">NORMAL</span>
              </div>
              <div class="proctor-cam" style="background:var(--c-gray-50);color:var(--c-gray-400);">
                <i class="ti ti-camera" style="font-size:18px;margin-right:6px;"></i>Face Active
              </div>
              <div class="proctor-body">
                <div class="proctor-stat-row"><span class="proctor-label">Face match</span><span class="proctor-val-ok">97%</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Tab switches</span><span class="proctor-val-ok">0/3</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Questions done</span><span>31/50</span></div>
                <div class="proctor-stat-row"><span class="proctor-label">Phone detected</span><span class="proctor-val-ok">No</span></div>
                <div class="integrity-wrap">
                  <div class="integrity-label"><span>Integrity</span><span style="color:var(--c-success-700);font-weight:700;">98</span></div>
                  <div class="integrity-track"><div class="integrity-fill" style="width:98%;background:var(--c-success-500);"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Flagged Attempts Table -->
        <div style="padding:0 16px 16px;">
          <div style="font-size:13px;font-weight:600;color:var(--c-gray-900);margin-bottom:12px;padding:0 4px;">All Flagged Attempts (6)</div>
          <div style="border:1px solid var(--c-border);border-radius:var(--radius-xl);overflow:hidden;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student</th><th>Roll No.</th><th>Issues</th><th>Integrity Score</th><th>Tab Switches</th><th>Verdict</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight:500;">Raj Mehta</td>
                  <td style="font-size:12.5px;color:var(--c-gray-600);">20CSE0047</td>
                  <td><span class="badge badge-critical" style="font-size:10px;">Multi-Person</span></td>
                  <td style="color:var(--c-danger-700);font-weight:700;">38</td>
                  <td>1/3</td>
                  <td><span class="badge badge-warning" style="font-size:10px;">Pending</span></td>
                  <td style="display:flex;gap:4px;">
                    <button class="btn btn-sm btn-danger">Review</button>
                    <button class="btn btn-sm btn-secondary">Dismiss</button>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight:500;">Sneha Roy</td>
                  <td style="font-size:12.5px;color:var(--c-gray-600);">20CSE0112</td>
                  <td><span class="badge badge-critical" style="font-size:10px;">Phone Detected</span></td>
                  <td style="color:var(--c-danger-700);font-weight:700;">44</td>
                  <td>2/3</td>
                  <td><span class="badge badge-warning" style="font-size:10px;">Pending</span></td>
                  <td style="display:flex;gap:4px;">
                    <button class="btn btn-sm btn-danger">Review</button>
                    <button class="btn btn-sm btn-secondary">Dismiss</button>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight:500;">Vikram Joshi</td>
                  <td style="font-size:12.5px;color:var(--c-gray-600);">20CSE0203</td>
                  <td><span class="badge badge-warning" style="font-size:10px;">Face Absent</span></td>
                  <td style="color:var(--c-warning-700);font-weight:700;">58</td>
                  <td>0/3</td>
                  <td><span class="badge badge-warning" style="font-size:10px;">Pending</span></td>
                  <td style="display:flex;gap:4px;">
                    <button class="btn btn-sm btn-secondary">Review</button>
                    <button class="btn btn-sm btn-secondary">Dismiss</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </main>
  </div>
</div>`;

export default function Dashboard() {
  return <LegacyPage css={css} html={html} />;
}
