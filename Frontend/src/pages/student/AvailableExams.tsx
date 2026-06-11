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
.page-header{margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
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

/* FILTERS */
.filter-bar{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.search-wrap{flex:1;min-width:200px;position:relative;}
.search-wrap i{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-gray-400);font-size:16px;}
.search-input{width:100%;padding:8px 12px 8px 34px;border:1px solid var(--c-border);border-radius:var(--radius-lg);font-size:13px;font-family:var(--font);outline:none;background:var(--c-gray-50);}
.search-input:focus{border-color:var(--c-primary-600);background:#fff;box-shadow:0 0 0 3px rgba(196,30,58,.08);}
.filter-select{padding:8px 12px;border:1px solid var(--c-border);border-radius:var(--radius-lg);font-size:13px;font-family:var(--font);color:var(--c-gray-700);background:var(--c-gray-50);outline:none;cursor:pointer;}
.filter-select:focus{border-color:var(--c-primary-600);}

/* EXAM CARDS GRID */
.exams-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px;}
.exam-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);overflow:hidden;transition:box-shadow .12s;}
.exam-card:hover{box-shadow:var(--shadow-md);}
.exam-card-top{background:var(--c-primary-700);padding:20px;position:relative;}
.exam-card-course{font-size:11px;font-weight:600;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
.exam-card-title{font-size:16px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:12px;}
.exam-card-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:10px;font-size:11px;font-weight:600;background:rgba(255,255,255,.15);color:#fff;}
.exam-card-body{padding:18px 20px;}
.exam-meta-row{display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;}
.exam-meta-item{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--c-gray-600);}
.exam-meta-item i{font-size:14px;color:var(--c-gray-400);}
.exam-card-divider{height:1px;background:var(--c-border);margin:14px 0;}
.exam-schedule-row{display:flex;gap:12px;margin-bottom:16px;}
.exam-schedule-item{flex:1;background:var(--c-gray-50);border-radius:var(--radius-lg);padding:10px 12px;}
.exam-schedule-label{font-size:10px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}
.exam-schedule-val{font-size:13px;font-weight:600;color:var(--c-gray-800);}
.exam-card-footer{display:flex;align-items:center;justify-content:space-between;}
.registered-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:var(--radius-md);font-size:12px;font-weight:600;background:var(--c-success-100);color:var(--c-success-700);}

/* COUNTDOWN BANNER */
.countdown-banner{background:linear-gradient(135deg,var(--c-primary-800),var(--c-primary-600));border-radius:var(--radius-xl);padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;gap:20px;}
.countdown-text-wrap{flex:1;}
.countdown-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;}
.countdown-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:2px;}
.countdown-sub{font-size:12px;color:rgba(255,255,255,.65);}
.countdown-timer{display:flex;gap:8px;}
.countdown-unit{background:rgba(0,0,0,.2);border-radius:var(--radius-lg);padding:10px 14px;text-align:center;min-width:52px;}
.countdown-num{font-size:22px;font-weight:700;color:#fff;line-height:1;}
.countdown-unit-label{font-size:9px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}
.countdown-action{flex-shrink:0;}

/* SECTION HEADER */
.section-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.section-title{font-size:15px;font-weight:700;color:var(--c-gray-900);}
.section-count{font-size:13px;color:var(--c-gray-500);margin-left:6px;}
.section-link{font-size:13px;color:var(--c-primary-700);font-weight:500;cursor:pointer;}
.section-link:hover{text-decoration:underline;}`;

const html = `<div class="app-shell">
  <!-- SIDEBAR -->
  <nav class="sidebar">
    <div class="sidebar-logo">
      <div>
        <div class="logo-text">EXAM.TIET</div>
        <div class="logo-sub">Examination Portal</div>
      </div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Student</div>
      <button class="nav-item" onclick="location.href='/student/dashboard'"><i class="ti ti-dashboard"></i>Dashboard</button>
      <button class="nav-item active"><i class="ti ti-clipboard-list"></i>Available Exams<span class="nav-badge">6</span></button>
      <button class="nav-item" onclick="location.href='/student/registered'"><i class="ti ti-calendar-check"></i>Registered Exams</button>
      <button class="nav-item" onclick="location.href='/student/history'"><i class="ti ti-history"></i>Exam History</button>
      <button class="nav-item" onclick="location.href='/student/results'"><i class="ti ti-award"></i>Results</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Account</div>
      <button class="nav-item"><i class="ti ti-bell"></i>Notifications<span class="nav-badge">3</span></button>
      <button class="nav-item"><i class="ti ti-user"></i>Profile</button>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">AK</div>
        <div>
          <div class="user-name">Arjun Kumar</div>
          <div class="user-role">Student · B.Tech CSE</div>
        </div>
      </div>
    </div>
  </nav>

  <!-- MAIN -->
  <div class="main-wrap">
    <header class="header">
      <div class="breadcrumbs">
        <span>Student</span><span class="sep">/</span><span class="current">Available Exams</span>
      </div>
      <div class="header-actions">
        <div class="icon-btn"><i class="ti ti-bell"></i><span class="notif-dot"></span></div>
        <div class="header-divider"></div>
        <div class="header-user">
          <div class="header-avatar">AK</div>
          <span class="header-user-name">Arjun Kumar</span>
          <i class="ti ti-chevron-down" style="font-size:14px;color:var(--c-gray-400)"></i>
        </div>
      </div>
    </header>

    <div class="page-content">
      <div class="page-header">
        <div>
          <div class="page-title">Available Exams</div>
          <div class="page-subtitle">Published schedules you can register for</div>
        </div>
      </div>

      <!-- UPCOMING COUNTDOWN -->
      <div class="countdown-banner">
        <div class="countdown-text-wrap">
          <div class="countdown-label">Next Registered Exam</div>
          <div class="countdown-title">Data Structures &amp; Algorithms — Mid Semester</div>
          <div class="countdown-sub">Starts: 15 Jun 2025 · 10:00 AM · 120 min · 80 marks</div>
        </div>
        <div class="countdown-timer">
          <div class="countdown-unit"><div class="countdown-num" id="d">02</div><div class="countdown-unit-label">Days</div></div>
          <div class="countdown-unit"><div class="countdown-num" id="h">14</div><div class="countdown-unit-label">Hrs</div></div>
          <div class="countdown-unit"><div class="countdown-num" id="m">32</div><div class="countdown-unit-label">Min</div></div>
          <div class="countdown-unit"><div class="countdown-num" id="s">08</div><div class="countdown-unit-label">Sec</div></div>
        </div>
        <div class="countdown-action">
          <button class="btn btn-secondary btn-sm"><i class="ti ti-calendar"></i>View Schedule</button>
        </div>
      </div>

      <!-- FILTERS -->
      <div class="filter-bar">
        <div class="search-wrap">
          <i class="ti ti-search"></i>
          <input class="search-input" placeholder="Search exams by title or course...">
        </div>
        <select class="filter-select">
          <option>All Departments</option>
          <option selected>Computer Science</option>
          <option>Electronics</option>
          <option>Mechanical</option>
        </select>
        <select class="filter-select">
          <option>All Status</option>
          <option>Open for Registration</option>
          <option>Already Registered</option>
          <option>Closed</option>
        </select>
        <select class="filter-select">
          <option>All Dates</option>
          <option>This Week</option>
          <option>This Month</option>
        </select>
      </div>

      <!-- EXAM CARDS -->
      <div class="section-hdr">
        <div><span class="section-title">Open for Registration</span><span class="section-count">6 exams</span></div>
      </div>
      <div class="exams-grid">

        <!-- Card 1 -->
        <div class="exam-card">
          <div class="exam-card-top">
            <div class="exam-card-course">CS301 · Data Structures</div>
            <div class="exam-card-title">Data Structures &amp; Algorithms<br>Mid Semester Examination</div>
            <span class="exam-card-badge"><i class="ti ti-check"></i>Open</span>
          </div>
          <div class="exam-card-body">
            <div class="exam-meta-row">
              <div class="exam-meta-item"><i class="ti ti-clock"></i>120 minutes</div>
              <div class="exam-meta-item"><i class="ti ti-star"></i>80 marks</div>
              <div class="exam-meta-item"><i class="ti ti-shield-check"></i>Proctored</div>
            </div>
            <div class="exam-card-divider"></div>
            <div class="exam-schedule-row">
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Date</div>
                <div class="exam-schedule-val">15 Jun 2025</div>
              </div>
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Time</div>
                <div class="exam-schedule-val">10:00 AM</div>
              </div>
            </div>
            <div class="exam-card-footer">
              <div style="font-size:12px;color:var(--c-gray-500);">Registration closes: 13 Jun</div>
              <button class="btn btn-primary btn-sm" onclick="location.href='/exam/live'"><i class="ti ti-writing"></i>Register</button>
            </div>
          </div>
        </div>

        <!-- Card 2 — already registered -->
        <div class="exam-card">
          <div class="exam-card-top" style="background:var(--c-primary-900);">
            <div class="exam-card-course">CS302 · OOP</div>
            <div class="exam-card-title">Object Oriented Programming<br>End Semester Examination</div>
            <span class="exam-card-badge" style="background:rgba(16,185,129,.25);color:#6EE7B7;"><i class="ti ti-check"></i>Registered</span>
          </div>
          <div class="exam-card-body">
            <div class="exam-meta-row">
              <div class="exam-meta-item"><i class="ti ti-clock"></i>180 minutes</div>
              <div class="exam-meta-item"><i class="ti ti-star"></i>100 marks</div>
              <div class="exam-meta-item"><i class="ti ti-shield-check"></i>Proctored</div>
            </div>
            <div class="exam-card-divider"></div>
            <div class="exam-schedule-row">
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Date</div>
                <div class="exam-schedule-val">18 Jun 2025</div>
              </div>
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Time</div>
                <div class="exam-schedule-val">02:00 PM</div>
              </div>
            </div>
            <div class="exam-card-footer">
              <span class="registered-badge"><i class="ti ti-check"></i>Registered</span>
              <button class="btn btn-secondary btn-sm"><i class="ti ti-eye"></i>View Details</button>
            </div>
          </div>
        </div>

        <!-- Card 3 -->
        <div class="exam-card">
          <div class="exam-card-top">
            <div class="exam-card-course">MA201 · Mathematics</div>
            <div class="exam-card-title">Engineering Mathematics III<br>Quiz 2</div>
            <span class="exam-card-badge"><i class="ti ti-check"></i>Open</span>
          </div>
          <div class="exam-card-body">
            <div class="exam-meta-row">
              <div class="exam-meta-item"><i class="ti ti-clock"></i>45 minutes</div>
              <div class="exam-meta-item"><i class="ti ti-star"></i>30 marks</div>
              <div class="exam-meta-item"><i class="ti ti-shield-off"></i>No Proctoring</div>
            </div>
            <div class="exam-card-divider"></div>
            <div class="exam-schedule-row">
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Date</div>
                <div class="exam-schedule-val">20 Jun 2025</div>
              </div>
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Time</div>
                <div class="exam-schedule-val">11:00 AM</div>
              </div>
            </div>
            <div class="exam-card-footer">
              <div style="font-size:12px;color:var(--c-gray-500);">Registration closes: 18 Jun</div>
              <button class="btn btn-primary btn-sm"><i class="ti ti-writing"></i>Register</button>
            </div>
          </div>
        </div>

        <!-- Card 4 -->
        <div class="exam-card">
          <div class="exam-card-top">
            <div class="exam-card-course">CS401 · Networks</div>
            <div class="exam-card-title">Computer Networks<br>Mid Semester Examination</div>
            <span class="exam-card-badge"><i class="ti ti-check"></i>Open</span>
          </div>
          <div class="exam-card-body">
            <div class="exam-meta-row">
              <div class="exam-meta-item"><i class="ti ti-clock"></i>90 minutes</div>
              <div class="exam-meta-item"><i class="ti ti-star"></i>60 marks</div>
              <div class="exam-meta-item"><i class="ti ti-shield-check"></i>Proctored</div>
            </div>
            <div class="exam-card-divider"></div>
            <div class="exam-schedule-row">
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Date</div>
                <div class="exam-schedule-val">22 Jun 2025</div>
              </div>
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Time</div>
                <div class="exam-schedule-val">09:00 AM</div>
              </div>
            </div>
            <div class="exam-card-footer">
              <div style="font-size:12px;color:var(--c-gray-500);">Registration closes: 20 Jun</div>
              <button class="btn btn-primary btn-sm"><i class="ti ti-writing"></i>Register</button>
            </div>
          </div>
        </div>

        <!-- Card 5 — closed -->
        <div class="exam-card" style="opacity:.7;">
          <div class="exam-card-top" style="background:var(--c-gray-700);">
            <div class="exam-card-course">PH201 · Physics</div>
            <div class="exam-card-title">Engineering Physics<br>End Semester Examination</div>
            <span class="exam-card-badge" style="background:rgba(239,68,68,.25);color:#FCA5A5;"><i class="ti ti-lock"></i>Closed</span>
          </div>
          <div class="exam-card-body">
            <div class="exam-meta-row">
              <div class="exam-meta-item"><i class="ti ti-clock"></i>180 minutes</div>
              <div class="exam-meta-item"><i class="ti ti-star"></i>100 marks</div>
              <div class="exam-meta-item"><i class="ti ti-shield-check"></i>Proctored</div>
            </div>
            <div class="exam-card-divider"></div>
            <div class="exam-schedule-row">
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Date</div>
                <div class="exam-schedule-val">25 Jun 2025</div>
              </div>
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Time</div>
                <div class="exam-schedule-val">10:00 AM</div>
              </div>
            </div>
            <div class="exam-card-footer">
              <div style="font-size:12px;color:var(--c-danger-500);font-weight:500;">Registration closed</div>
              <button class="btn btn-secondary btn-sm" disabled style="opacity:.5;cursor:not-allowed;"><i class="ti ti-lock"></i>Closed</button>
            </div>
          </div>
        </div>

        <!-- Card 6 -->
        <div class="exam-card">
          <div class="exam-card-top">
            <div class="exam-card-course">CS501 · DBMS</div>
            <div class="exam-card-title">Database Management Systems<br>Unit Test 3</div>
            <span class="exam-card-badge"><i class="ti ti-check"></i>Open</span>
          </div>
          <div class="exam-card-body">
            <div class="exam-meta-row">
              <div class="exam-meta-item"><i class="ti ti-clock"></i>60 minutes</div>
              <div class="exam-meta-item"><i class="ti ti-star"></i>40 marks</div>
              <div class="exam-meta-item"><i class="ti ti-shield-check"></i>Proctored</div>
            </div>
            <div class="exam-card-divider"></div>
            <div class="exam-schedule-row">
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Date</div>
                <div class="exam-schedule-val">28 Jun 2025</div>
              </div>
              <div class="exam-schedule-item">
                <div class="exam-schedule-label">Time</div>
                <div class="exam-schedule-val">03:00 PM</div>
              </div>
            </div>
            <div class="exam-card-footer">
              <div style="font-size:12px;color:var(--c-gray-500);">Registration closes: 26 Jun</div>
              <button class="btn btn-primary btn-sm"><i class="ti ti-writing"></i>Register</button>
            </div>
          </div>
        </div>

      </div><!-- /exams-grid -->
    </div>
  </div>
</div>`;

const script = `// Countdown
function tick(){
  let d=parseInt(document.getElementById('d').textContent),
      h=parseInt(document.getElementById('h').textContent),
      m=parseInt(document.getElementById('m').textContent),
      s=parseInt(document.getElementById('s').textContent);
  s--;if(s<0){s=59;m--;}if(m<0){m=59;h--;}if(h<0){h=23;d--;}
  document.getElementById('d').textContent=String(d).padStart(2,'0');
  document.getElementById('h').textContent=String(h).padStart(2,'0');
  document.getElementById('m').textContent=String(m).padStart(2,'0');
  document.getElementById('s').textContent=String(s).padStart(2,'0');
}
setInterval(tick,1000);`;

export default function AvailableExams() {
  return <LegacyPage css={css} html={html} script={script} />;
}
