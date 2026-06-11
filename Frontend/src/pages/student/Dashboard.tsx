import LegacyPage from "../../components/LegacyPage";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:var(--font);font-size:14px;color:var(--c-gray-800);background:var(--c-bg);-webkit-font-smoothing:antialiased;}
button{font-family:var(--font);cursor:pointer;border:none;background:none;}
.app-shell{display:flex;height:100vh;overflow:hidden;}

/* SIDEBAR */
.sidebar{width:var(--sidebar-w);background:var(--c-sidebar);display:flex;flex-direction:column;flex-shrink:0;height:100vh;overflow-y:auto;}
.sidebar-logo{padding:0 20px;height:var(--header-h);display:flex;align-items:center;border-bottom:1px solid rgba(0,0,0,0.12);}
.logo-text{font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;}
.logo-sub{font-size:10px;color:rgba(255,255,255,0.5);font-weight:500;letter-spacing:.8px;text-transform:uppercase;margin-top:1px;}
.sidebar-section{padding:20px 12px 8px;}
.sidebar-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.4);letter-spacing:.8px;text-transform:uppercase;padding:0 8px;margin-bottom:4px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-lg);color:rgba(255,255,255,.75);font-size:13.5px;font-weight:500;cursor:pointer;position:relative;margin-bottom:2px;transition:background .12s;width:100%;text-align:left;}
.nav-item:hover{background:rgba(0,0,0,.12);color:#fff;}
.nav-item.active{background:rgba(0,0,0,.2);color:#fff;}
.nav-item.active::before{content:'';position:absolute;left:0;top:6px;bottom:6px;width:3px;background:#fff;border-radius:0 2px 2px 0;}
.nav-item i{font-size:16px;flex-shrink:0;}
.nav-badge{margin-left:auto;background:rgba(0,0,0,.25);color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;}
.sidebar-bottom{margin-top:auto;padding:12px;border-top:1px solid rgba(0,0,0,.12);}
.sidebar-user{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-lg);}
.user-avatar{width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.2);color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.3);}
.user-name{font-size:13px;font-weight:600;color:#fff;}
.user-role{font-size:11px;color:rgba(255,255,255,.5);}

/* MAIN */
.main-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.header{height:var(--header-h);background:var(--c-card);border-bottom:1px solid var(--c-border);display:flex;align-items:center;padding:0 24px;gap:16px;flex-shrink:0;box-shadow:var(--shadow-sm);}
.breadcrumbs{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--c-gray-600);flex:1;}
.breadcrumbs .sep{color:var(--c-gray-300);}
.breadcrumbs .current{color:var(--c-gray-900);font-weight:500;}
.header-actions{display:flex;align-items:center;gap:4px;}
.icon-btn{width:36px;height:36px;border-radius:var(--radius-lg);color:var(--c-gray-600);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;position:relative;}
.icon-btn:hover{background:var(--c-gray-100);color:var(--c-gray-900);}
.notif-dot{position:absolute;top:6px;right:6px;width:8px;height:8px;background:var(--c-primary-600);border-radius:50%;border:2px solid #fff;}
.header-divider{width:1px;height:24px;background:var(--c-border);margin:0 4px;}
.header-user{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:var(--radius-lg);cursor:pointer;}
.header-user:hover{background:var(--c-gray-100);}
.header-avatar{width:30px;height:30px;border-radius:50%;background:var(--c-primary-700);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.header-user-name{font-size:13px;font-weight:500;color:var(--c-gray-800);}
.page-content{flex:1;overflow-y:auto;padding:28px 28px 40px;}
.page-header{margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
.page-title{font-size:22px;font-weight:700;color:var(--c-primary-800);letter-spacing:-0.3px;}
.page-subtitle{font-size:13px;color:var(--c-gray-600);margin-top:3px;}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;font-size:13.5px;font-weight:500;border-radius:var(--radius-md);border:1px solid transparent;cursor:pointer;transition:all .12s;font-family:var(--font);line-height:1;}
.btn i{font-size:15px;}
.btn-primary{background:var(--c-primary-700);color:#fff;border-color:var(--c-primary-700);}
.btn-primary:hover{background:var(--c-primary-800);}
.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border);}
.btn-secondary:hover{background:var(--c-gray-50);border-color:var(--c-gray-300);}
.btn-sm{padding:6px 12px;font-size:12.5px;}
.btn-sm i{font-size:13px;}

/* STATS */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;}
.stat-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:20px;box-shadow:var(--shadow-sm);position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.stat-card.red::before{background:var(--c-primary-600);}
.stat-card.green::before{background:var(--c-success-500);}
.stat-card.amber::before{background:var(--c-warning-500);}
.stat-card.gray::before{background:var(--c-gray-400);}
.stat-label{font-size:12px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}
.stat-icon{width:34px;height:34px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:17px;margin-bottom:10px;}
.stat-icon.red{background:var(--c-primary-100);color:var(--c-primary-700);}
.stat-icon.green{background:var(--c-success-100);color:var(--c-success-700);}
.stat-icon.amber{background:var(--c-warning-100);color:var(--c-warning-700);}
.stat-icon.gray{background:var(--c-gray-100);color:var(--c-gray-600);}
.stat-value{font-size:30px;font-weight:700;color:var(--c-gray-900);line-height:1;margin-bottom:6px;}
.stat-meta{font-size:12px;color:var(--c-gray-600);}

/* CARDS */
.card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm);}
.card-header{padding:16px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:14px;font-weight:600;color:var(--c-gray-900);display:flex;align-items:center;gap:8px;}
.card-title i{color:var(--c-gray-500);font-size:16px;}
.card-action{font-size:12.5px;color:var(--c-primary-700);font-weight:500;cursor:pointer;}
.card-action:hover{text-decoration:underline;}

/* BADGES */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font-size:11px;font-weight:600;border-radius:var(--radius-sm);border:1px solid;text-transform:uppercase;letter-spacing:.3px;line-height:18px;}
.badge-dot{width:5px;height:5px;border-radius:50%;}
.badge-registered{background:var(--c-primary-100);color:var(--c-primary-700);border-color:var(--c-primary-400);}
.badge-registered .badge-dot{background:var(--c-primary-600);}
.badge-upcoming{background:var(--c-warning-100);color:var(--c-warning-700);border-color:var(--c-warning-500);}
.badge-upcoming .badge-dot{background:var(--c-warning-500);}
.badge-passed{background:var(--c-success-100);color:var(--c-success-700);border-color:var(--c-success-500);}
.badge-passed .badge-dot{background:var(--c-success-500);}
.badge-failed{background:var(--c-danger-100);color:var(--c-danger-700);border-color:var(--c-danger-500);}
.badge-failed .badge-dot{background:var(--c-danger-500);}
.badge-appeared{background:var(--c-gray-100);color:var(--c-gray-700);border-color:var(--c-gray-400);}

/* EXAM CARD */
.exam-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:18px 20px;box-shadow:var(--shadow-sm);transition:box-shadow .15s;cursor:pointer;}
.exam-card:hover{box-shadow:var(--shadow-md);}
.exam-card-course{font-size:11px;font-weight:700;color:var(--c-primary-700);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
.exam-card-title{font-size:15px;font-weight:600;color:var(--c-gray-900);margin-bottom:8px;}
.exam-card-meta{display:flex;gap:14px;font-size:12px;color:var(--c-gray-500);flex-wrap:wrap;margin-bottom:12px;}
.exam-card-meta i{font-size:13px;vertical-align:-1px;}
.exam-card-footer{display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--c-border);}

/* COUNTDOWN */
.countdown-card{background:var(--c-primary-800);border-radius:var(--radius-xl);padding:20px;color:#fff;box-shadow:var(--shadow-md);}
.countdown-exam-name{font-size:11px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;}
.countdown-title{font-size:14px;font-weight:600;color:#fff;margin-bottom:16px;}
.countdown-digits{display:flex;gap:10px;}
.cd-unit{text-align:center;}
.cd-num{font-size:24px;font-weight:700;background:rgba(255,255,255,.12);border-radius:var(--radius-lg);width:48px;height:44px;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;}
.cd-label{font-size:9px;color:rgba(255,255,255,.45);text-transform:uppercase;margin-top:4px;letter-spacing:.5px;}

/* RESULTS LIST */
.result-row{display:flex;align-items:center;gap:12px;padding:13px 20px;border-bottom:1px solid var(--c-border);cursor:pointer;}
.result-row:last-child{border-bottom:none;}
.result-row:hover{background:var(--c-gray-50);}
.result-grade{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
.result-grade.a{background:var(--c-success-100);color:var(--c-success-700);}
.result-grade.b{background:var(--c-primary-100);color:var(--c-primary-700);}
.result-grade.c{background:var(--c-warning-100);color:var(--c-warning-700);}
.result-grade.f{background:var(--c-danger-100);color:var(--c-danger-700);}
.result-info{flex:1;min-width:0;}
.result-name{font-size:13.5px;font-weight:500;color:var(--c-gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.result-meta{font-size:12px;color:var(--c-gray-500);margin-top:1px;}
.result-score{font-size:14px;font-weight:700;color:var(--c-gray-900);}
.result-pct{font-size:11px;color:var(--c-gray-500);}

/* NOTIFICATION ROW */
.notif-row{display:flex;gap:10px;padding:12px 20px;border-bottom:1px solid var(--c-border);cursor:pointer;}
.notif-row:last-child{border-bottom:none;}
.notif-row:hover{background:var(--c-gray-50);}
.notif-row.unread{background:var(--c-primary-50);}
.notif-icon{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.notif-text{font-size:13px;color:var(--c-gray-800);line-height:1.4;}
.notif-time{font-size:11px;color:var(--c-gray-500);margin-top:2px;}
.unread-dot{width:6px;height:6px;border-radius:50%;background:var(--c-primary-600);margin-top:6px;flex-shrink:0;}

/* CONTENT GRID */
.content-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}
.content-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px;}`;

const html = `<div class="app-shell">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div><div class="logo-text">EXAM.TIET</div><div class="logo-sub">Student Portal</div></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Main</div>
      <button class="nav-item active"><i class="ti ti-layout-dashboard"></i>Dashboard</button>
      <button class="nav-item"><i class="ti ti-file-description"></i>Available Exams</button>
      <button class="nav-item"><i class="ti ti-calendar-check"></i>Registered Exams</button>
      <button class="nav-item"><i class="ti ti-history"></i>Exam History</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Results</div>
      <button class="nav-item"><i class="ti ti-award"></i>My Results</button>
      <button class="nav-item"><i class="ti ti-refresh-alert"></i>Re-Evaluation</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Account</div>
      <button class="nav-item"><i class="ti ti-bell"></i>Notifications<span class="nav-badge">3</span></button>
      <button class="nav-item"><i class="ti ti-user-circle"></i>Profile</button>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">KS</div>
        <div style="flex:1;min-width:0;">
          <div class="user-name">Kamal Singh</div>
          <div class="user-role">Student · CSE-2022</div>
        </div>
      </div>
    </div>
  </aside>

  <!-- MAIN -->
  <div class="main-wrap">
    <header class="header">
      <div class="breadcrumbs">
        <span>Student Portal</span><span class="sep">/</span>
        <span class="current">Dashboard</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn"><i class="ti ti-help-circle"></i></button>
        <button class="icon-btn"><i class="ti ti-bell"></i><span class="notif-dot"></span></button>
        <div class="header-divider"></div>
        <span style="font-size:11px;font-weight:600;color:var(--c-primary-700);background:var(--c-primary-100);padding:4px 10px;border-radius:20px;">STUDENT</span>
        <button class="header-user">
          <div class="header-avatar">KS</div>
          <span class="header-user-name">Kamal Singh</span>
          <i class="ti ti-chevron-down" style="font-size:13px;color:var(--c-gray-500);"></i>
        </button>
      </div>
    </header>

    <main class="page-content">
      <div class="page-header">
        <div>
          <div class="page-title">My Dashboard</div>
          <div class="page-subtitle">Thursday, June 11, 2026 · Semester 8 · B.Tech CSE</div>
        </div>
        <button class="btn btn-primary" onclick="window.location='/student/exams'">
          <i class="ti ti-file-search"></i> Browse Exams
        </button>
      </div>

      <!-- STATS -->
      <div class="stats-grid">
        <div class="stat-card red">
          <div class="stat-label">Upcoming Exams</div>
          <div class="stat-icon red"><i class="ti ti-calendar-event"></i></div>
          <div class="stat-value" style="color:var(--c-primary-700);">3</div>
          <div class="stat-meta">2 this week</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Exams Passed</div>
          <div class="stat-icon green"><i class="ti ti-circle-check"></i></div>
          <div class="stat-value" style="color:var(--c-success-700);">11</div>
          <div class="stat-meta">Out of 12 attempted</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-label">Best Percentile</div>
          <div class="stat-icon amber"><i class="ti ti-trophy"></i></div>
          <div class="stat-value" style="color:var(--c-warning-700);">94th</div>
          <div class="stat-meta">UCS301 Mid-Semester</div>
        </div>
        <div class="stat-card gray">
          <div class="stat-label">Avg. Score</div>
          <div class="stat-icon gray"><i class="ti ti-chart-line"></i></div>
          <div class="stat-value" style="color:var(--c-gray-800);">81.4%</div>
          <div class="stat-meta">This semester</div>
        </div>
      </div>

      <!-- UPCOMING + COUNTDOWN -->
      <div class="content-row">

        <!-- Upcoming Exams -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-calendar-event"></i> Upcoming Exams</div>
            <span class="card-action">View all</span>
          </div>
          <div>
            <div class="exam-card" style="border:none;border-bottom:1px solid var(--c-border);border-radius:0;">
              <div class="exam-card-course">UCS301 · Design & Analysis of Algorithms</div>
              <div class="exam-card-title">Mid-Semester Examination</div>
              <div class="exam-card-meta">
                <span><i class="ti ti-calendar"></i> Jun 14, 2026 · 10:00 AM</span>
                <span><i class="ti ti-clock"></i> 120 min</span>
                <span><i class="ti ti-files"></i> 50 Questions</span>
              </div>
              <div class="exam-card-footer">
                <span class="badge badge-registered"><span class="badge-dot"></span>Registered</span>
                <button class="btn btn-sm btn-primary">View Details</button>
              </div>
            </div>
            <div class="exam-card" style="border:none;border-bottom:1px solid var(--c-border);border-radius:0;">
              <div class="exam-card-course">UCS501 · Computer Networks</div>
              <div class="exam-card-title">End-Semester Examination</div>
              <div class="exam-card-meta">
                <span><i class="ti ti-calendar"></i> Jun 22, 2026 · 02:00 PM</span>
                <span><i class="ti ti-clock"></i> 180 min</span>
                <span><i class="ti ti-files"></i> 75 Questions</span>
              </div>
              <div class="exam-card-footer">
                <span class="badge badge-upcoming"><span class="badge-dot"></span>Not Registered</span>
                <button class="btn btn-sm btn-secondary">Register Now</button>
              </div>
            </div>
            <div class="exam-card" style="border:none;border-radius:0;">
              <div class="exam-card-course">MTH-201 · Calculus & Differential Equations</div>
              <div class="exam-card-title">End-Semester Examination</div>
              <div class="exam-card-meta">
                <span><i class="ti ti-calendar"></i> Jun 25, 2026 · 09:00 AM</span>
                <span><i class="ti ti-clock"></i> 180 min</span>
                <span><i class="ti ti-files"></i> 60 Questions</span>
              </div>
              <div class="exam-card-footer">
                <span class="badge badge-registered"><span class="badge-dot"></span>Registered</span>
                <button class="btn btn-sm btn-primary">View Details</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Countdown + Notifications -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="countdown-card">
            <div class="countdown-exam-name">UCS301 · Mid-Semester</div>
            <div class="countdown-title">Design & Analysis of Algorithms</div>
            <div class="countdown-digits">
              <div class="cd-unit"><div class="cd-num" id="cd-d">02</div><div class="cd-label">Days</div></div>
              <div class="cd-unit"><div class="cd-num" id="cd-h">18</div><div class="cd-label">Hours</div></div>
              <div class="cd-unit"><div class="cd-num" id="cd-m">42</div><div class="cd-label">Mins</div></div>
              <div class="cd-unit"><div class="cd-num" id="cd-s">11</div><div class="cd-label">Secs</div></div>
            </div>
          </div>

          <!-- Quick notifications -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="ti ti-bell"></i> Notifications</div>
              <span class="card-action">View all</span>
            </div>
            <div>
              <div class="notif-row unread">
                <div class="notif-icon" style="background:var(--c-primary-100);color:var(--c-primary-700);"><i class="ti ti-file-description"></i></div>
                <div style="flex:1;">
                  <div class="notif-text">Result published for <strong>UCS415 End-Sem</strong></div>
                  <div class="notif-time">30 minutes ago</div>
                </div>
                <div class="unread-dot"></div>
              </div>
              <div class="notif-row unread">
                <div class="notif-icon" style="background:var(--c-warning-100);color:var(--c-warning-700);"><i class="ti ti-calendar-event"></i></div>
                <div style="flex:1;">
                  <div class="notif-text">Exam scheduled: <strong>UCS301 Mid-Sem</strong> on Jun 14</div>
                  <div class="notif-time">2 hours ago</div>
                </div>
                <div class="unread-dot"></div>
              </div>
              <div class="notif-row">
                <div class="notif-icon" style="background:var(--c-success-100);color:var(--c-success-700);"><i class="ti ti-check"></i></div>
                <div style="flex:1;">
                  <div class="notif-text">Re-evaluation request for <strong>UCS501 Quiz 2</strong> resolved</div>
                  <div class="notif-time">Yesterday</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RECENT RESULTS -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="ti ti-award"></i> Recent Results</div>
          <span class="card-action">View all results</span>
        </div>
        <div>
          <div class="result-row">
            <div class="result-grade a">A</div>
            <div class="result-info">
              <div class="result-name">UCS415 — End Semester Examination (COE)</div>
              <div class="result-meta">Appeared Jun 3, 2026 · Rank 4 in class</div>
            </div>
            <div style="text-align:right;">
              <div class="result-score">72 / 80</div>
              <div class="result-pct">90.0%</div>
            </div>
            <span class="badge badge-passed" style="margin-left:12px;"><span class="badge-dot"></span>Passed</span>
          </div>
          <div class="result-row">
            <div class="result-grade b">B+</div>
            <div class="result-info">
              <div class="result-name">UCS301 — Quiz 3: Sorting Algorithms</div>
              <div class="result-meta">Appeared May 28, 2026</div>
            </div>
            <div style="text-align:right;">
              <div class="result-score">17 / 20</div>
              <div class="result-pct">85.0%</div>
            </div>
            <span class="badge badge-passed" style="margin-left:12px;"><span class="badge-dot"></span>Passed</span>
          </div>
          <div class="result-row">
            <div class="result-grade c">C</div>
            <div class="result-info">
              <div class="result-name">MTH-201 — Quiz 2: Differential Equations</div>
              <div class="result-meta">Appeared May 20, 2026</div>
            </div>
            <div style="text-align:right;">
              <div class="result-score">11 / 20</div>
              <div class="result-pct">55.0%</div>
            </div>
            <span class="badge badge-passed" style="margin-left:12px;"><span class="badge-dot"></span>Passed</span>
          </div>
          <div class="result-row">
            <div class="result-grade f">F</div>
            <div class="result-info">
              <div class="result-name">PHY-101 — Mid-Semester Examination</div>
              <div class="result-meta">Appeared Apr 15, 2026</div>
            </div>
            <div style="text-align:right;">
              <div class="result-score">18 / 50</div>
              <div class="result-pct">36.0%</div>
            </div>
            <span class="badge badge-failed" style="margin-left:12px;"><span class="badge-dot"></span>Failed</span>
          </div>
        </div>
      </div>

    </main>
  </div>
</div>`;

const script = `// Live countdown
let target = new Date();
target.setDate(target.getDate() + 2);
target.setHours(target.getHours() + 18);
target.setMinutes(target.getMinutes() + 42);

function updateCountdown() {
  const now = new Date();
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  document.getElementById('cd-d').textContent = String(d).padStart(2,'0');
  document.getElementById('cd-h').textContent = String(h).padStart(2,'0');
  document.getElementById('cd-m').textContent = String(m).padStart(2,'0');
  document.getElementById('cd-s').textContent = String(s).padStart(2,'0');
}
setInterval(updateCountdown, 1000);
updateCountdown();`;

export default function Dashboard() {
  return <LegacyPage css={css} html={html} script={script} />;
}
