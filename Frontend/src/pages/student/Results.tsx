import LegacyPage from "../../components/LegacyPage";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:var(--font);font-size:14px;color:var(--c-gray-800);background:var(--c-bg);-webkit-font-smoothing:antialiased;}
button{font-family:var(--font);cursor:pointer;border:none;background:none;}
.app-shell{display:flex;height:100vh;overflow:hidden;}
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
.main-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.header{height:var(--header-h);background:var(--c-card);border-bottom:1px solid var(--c-border);display:flex;align-items:center;padding:0 24px;gap:16px;flex-shrink:0;box-shadow:var(--shadow-sm);}
.breadcrumbs{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--c-gray-600);flex:1;}
.breadcrumbs .sep{color:var(--c-gray-300);}
.breadcrumbs .current{color:var(--c-gray-900);font-weight:500;}
.header-actions{display:flex;align-items:center;gap:4px;}
.icon-btn{width:36px;height:36px;border-radius:var(--radius-lg);color:var(--c-gray-600);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;position:relative;}
.icon-btn:hover{background:var(--c-gray-100);}
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
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;font-size:13.5px;font-weight:500;border-radius:var(--radius-md);border:1px solid transparent;cursor:pointer;transition:all .12s;font-family:var(--font);line-height:1;}
.btn i{font-size:15px;}
.btn-primary{background:var(--c-primary-700);color:#fff;}
.btn-primary:hover{background:var(--c-primary-800);}
.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border);}
.btn-secondary:hover{background:var(--c-gray-50);}
.btn-sm{padding:6px 12px;font-size:12.5px;}

/* SUMMARY CARDS */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;}
.stat-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:18px 20px;}
.stat-label{font-size:12px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}
.stat-val{font-size:26px;font-weight:700;color:var(--c-gray-900);letter-spacing:-0.5px;}
.stat-sub{font-size:12px;color:var(--c-gray-500);margin-top:4px;}
.stat-trend{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;font-weight:600;padding:2px 6px;border-radius:4px;margin-top:6px;}
.trend-up{background:var(--c-success-100);color:var(--c-success-700);}
.trend-down{background:var(--c-danger-100);color:var(--c-danger-700);}

/* RESULT TABLE */
.table-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);overflow:hidden;}
.table-hdr{padding:16px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.table-title{font-size:15px;font-weight:700;color:var(--c-gray-900);}
.filter-bar-sm{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.search-wrap{position:relative;}
.search-wrap i{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-gray-400);font-size:15px;}
.search-input{padding:7px 10px 7px 32px;border:1px solid var(--c-border);border-radius:var(--radius-lg);font-size:13px;font-family:var(--font);outline:none;background:var(--c-gray-50);width:200px;}
.search-input:focus{border-color:var(--c-primary-600);background:#fff;}
.filter-select{padding:7px 10px;border:1px solid var(--c-border);border-radius:var(--radius-lg);font-size:12.5px;font-family:var(--font);color:var(--c-gray-700);background:var(--c-gray-50);outline:none;}
table{width:100%;border-collapse:collapse;}
thead th{padding:10px 16px;text-align:left;font-size:11.5px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;background:var(--c-gray-50);border-bottom:1px solid var(--c-border);}
tbody tr{border-bottom:1px solid var(--c-gray-100);}
tbody tr:last-child{border-bottom:none;}
tbody tr:hover{background:var(--c-gray-50);}
tbody td{padding:13px 16px;font-size:13.5px;color:var(--c-gray-800);}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:10px;font-size:11.5px;font-weight:600;}
.badge-pass{background:var(--c-success-100);color:var(--c-success-700);}
.badge-fail{background:var(--c-danger-100);color:var(--c-danger-700);}
.badge-pending{background:var(--c-warning-100);color:var(--c-warning-700);}
.grade-chip{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:12px;font-weight:700;}
.grade-a{background:var(--c-success-100);color:var(--c-success-700);}
.grade-b{background:#DBEAFE;color:#1E40AF;}
.grade-c{background:var(--c-warning-100);color:var(--c-warning-700);}
.grade-f{background:var(--c-danger-100);color:var(--c-danger-700);}
.score-bar-wrap{display:flex;align-items:center;gap:10px;}
.score-bar{flex:1;height:6px;background:var(--c-gray-200);border-radius:3px;overflow:hidden;max-width:80px;}
.score-bar-fill{height:100%;border-radius:3px;background:var(--c-primary-700);}

/* SCORECARD MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:none;align-items:center;justify-content:center;padding:24px;}
.modal-overlay.open{display:flex;}
.modal{background:#fff;border-radius:12px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);}
.modal-head{padding:24px 28px;border-bottom:1px solid var(--c-border);display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
.modal-title{font-size:17px;font-weight:700;color:var(--c-gray-900);}
.modal-sub{font-size:13px;color:var(--c-gray-600);margin-top:3px;}
.modal-close{width:32px;height:32px;border-radius:var(--radius-lg);border:1px solid var(--c-border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--c-gray-600);font-size:18px;flex-shrink:0;}
.modal-close:hover{background:var(--c-gray-100);}
.modal-body{padding:28px;}
.score-hero{background:linear-gradient(135deg,var(--c-primary-700),var(--c-primary-900));border-radius:var(--radius-xl);padding:28px;text-align:center;margin-bottom:24px;}
.score-big{font-size:52px;font-weight:800;color:#fff;letter-spacing:-2px;}
.score-max{font-size:18px;color:rgba(255,255,255,.6);font-weight:400;}
.score-pct{font-size:20px;font-weight:700;color:rgba(255,255,255,.85);margin-top:4px;}
.score-grade-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;background:rgba(255,255,255,.15);color:#fff;font-size:15px;font-weight:700;margin-top:12px;}
.result-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}
.result-detail-item{background:var(--c-gray-50);border-radius:var(--radius-lg);padding:14px;}
.result-detail-label{font-size:11px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
.result-detail-val{font-size:15px;font-weight:600;color:var(--c-gray-800);}
.topic-breakdown{border:1px solid var(--c-border);border-radius:var(--radius-lg);overflow:hidden;}
.topic-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid var(--c-gray-100);}
.topic-row:last-child{border-bottom:none;}
.topic-name{flex:1;font-size:13px;color:var(--c-gray-700);}
.topic-score{font-size:13px;font-weight:600;color:var(--c-gray-900);min-width:60px;text-align:right;}
.topic-bar{width:100px;height:6px;background:var(--c-gray-200);border-radius:3px;overflow:hidden;}
.topic-bar-fill{height:100%;border-radius:3px;background:var(--c-primary-600);}
.re-eval-btn{display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:var(--radius-lg);border:1px dashed var(--c-border);color:var(--c-gray-600);font-size:13px;cursor:pointer;margin-top:16px;width:100%;justify-content:center;}
.re-eval-btn:hover{background:var(--c-primary-50);border-color:var(--c-primary-200);color:var(--c-primary-700);}`;

const html = `<div class="app-shell">
  <nav class="sidebar">
    <div class="sidebar-logo">
      <div><div class="logo-text">EXAM.TIET</div><div class="logo-sub">Examination Portal</div></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Student</div>
      <button class="nav-item" onclick="location.href='/student/dashboard'"><i class="ti ti-dashboard"></i>Dashboard</button>
      <button class="nav-item" onclick="location.href='/student/exams'"><i class="ti ti-clipboard-list"></i>Available Exams<span class="nav-badge">6</span></button>
      <button class="nav-item"><i class="ti ti-calendar-check"></i>Registered Exams</button>
      <button class="nav-item"><i class="ti ti-history"></i>Exam History</button>
      <button class="nav-item active"><i class="ti ti-award"></i>Results</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Account</div>
      <button class="nav-item"><i class="ti ti-bell"></i>Notifications<span class="nav-badge">3</span></button>
      <button class="nav-item"><i class="ti ti-user"></i>Profile</button>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">AK</div>
        <div><div class="user-name">Arjun Kumar</div><div class="user-role">Student · B.Tech CSE</div></div>
      </div>
    </div>
  </nav>

  <div class="main-wrap">
    <header class="header">
      <div class="breadcrumbs"><span>Student</span><span class="sep">/</span><span class="current">Results</span></div>
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
          <div class="page-title">My Results</div>
          <div class="page-subtitle">Published results for completed examinations</div>
        </div>
        <button class="btn btn-secondary btn-sm"><i class="ti ti-download"></i>Export Report</button>
      </div>

      <!-- Summary stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Exams Appeared</div>
          <div class="stat-val">12</div>
          <div class="stat-sub">This semester</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Average Score</div>
          <div class="stat-val">73.4%</div>
          <div class="stat-trend trend-up"><i class="ti ti-trending-up"></i>+3.2%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">SGPA (Computed)</div>
          <div class="stat-val">8.2</div>
          <div class="stat-trend trend-up"><i class="ti ti-trending-up"></i>vs last sem</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending Results</div>
          <div class="stat-val" style="color:var(--c-warning-700);">2</div>
          <div class="stat-sub">Awaiting publication</div>
        </div>
      </div>

      <!-- Results table -->
      <div class="table-card">
        <div class="table-hdr">
          <div class="table-title">All Results</div>
          <div class="filter-bar-sm">
            <div class="search-wrap">
              <i class="ti ti-search"></i>
              <input class="search-input" placeholder="Search exam...">
            </div>
            <select class="filter-select">
              <option>All Semesters</option>
              <option selected>Sem 5 · 2024-25</option>
              <option>Sem 4 · 2023-24</option>
            </select>
            <select class="filter-select">
              <option>All Grades</option>
              <option>A</option><option>B</option><option>C</option><option>F</option>
            </select>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Exam</th>
              <th>Course</th>
              <th>Date</th>
              <th>Score</th>
              <th>Percentage</th>
              <th>Grade</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><div style="font-weight:600;">DSA Mid Semester</div><div style="font-size:12px;color:var(--c-gray-500);">Duration: 120 min</div></td>
              <td>CS301</td>
              <td>10 May 2025</td>
              <td>
                <div class="score-bar-wrap">
                  <span style="font-weight:600;">68 / 80</span>
                  <div class="score-bar"><div class="score-bar-fill" style="width:85%"></div></div>
                </div>
              </td>
              <td style="font-weight:600;">85.0%</td>
              <td><span class="grade-chip grade-a">A</span></td>
              <td><span class="badge badge-pass"><i class="ti ti-check"></i>Pass</span></td>
              <td><button class="btn btn-secondary btn-sm" onclick="openModal()"><i class="ti ti-eye"></i>Scorecard</button></td>
            </tr>
            <tr>
              <td><div style="font-weight:600;">OOP End Semester</div><div style="font-size:12px;color:var(--c-gray-500);">Duration: 180 min</div></td>
              <td>CS302</td>
              <td>8 May 2025</td>
              <td>
                <div class="score-bar-wrap">
                  <span style="font-weight:600;">71 / 100</span>
                  <div class="score-bar"><div class="score-bar-fill" style="width:71%"></div></div>
                </div>
              </td>
              <td style="font-weight:600;">71.0%</td>
              <td><span class="grade-chip grade-b">B</span></td>
              <td><span class="badge badge-pass"><i class="ti ti-check"></i>Pass</span></td>
              <td><button class="btn btn-secondary btn-sm" onclick="openModal()"><i class="ti ti-eye"></i>Scorecard</button></td>
            </tr>
            <tr>
              <td><div style="font-weight:600;">Engg Math Quiz 1</div><div style="font-size:12px;color:var(--c-gray-500);">Duration: 45 min</div></td>
              <td>MA201</td>
              <td>2 May 2025</td>
              <td>
                <div class="score-bar-wrap">
                  <span style="font-weight:600;">18 / 30</span>
                  <div class="score-bar"><div class="score-bar-fill" style="width:60%"></div></div>
                </div>
              </td>
              <td style="font-weight:600;">60.0%</td>
              <td><span class="grade-chip grade-c">C</span></td>
              <td><span class="badge badge-pass"><i class="ti ti-check"></i>Pass</span></td>
              <td><button class="btn btn-secondary btn-sm" onclick="openModal()"><i class="ti ti-eye"></i>Scorecard</button></td>
            </tr>
            <tr>
              <td><div style="font-weight:600;">Networks Mid Sem</div><div style="font-size:12px;color:var(--c-gray-500);">Duration: 90 min</div></td>
              <td>CS401</td>
              <td>28 Apr 2025</td>
              <td>
                <div class="score-bar-wrap">
                  <span style="font-weight:600;">22 / 60</span>
                  <div class="score-bar"><div class="score-bar-fill" style="width:37%;background:var(--c-danger-500)"></div></div>
                </div>
              </td>
              <td style="font-weight:600;color:var(--c-danger-700);">36.7%</td>
              <td><span class="grade-chip grade-f">F</span></td>
              <td><span class="badge badge-fail"><i class="ti ti-x"></i>Fail</span></td>
              <td><button class="btn btn-secondary btn-sm" onclick="openModal()"><i class="ti ti-eye"></i>Scorecard</button></td>
            </tr>
            <tr style="opacity:.6;">
              <td><div style="font-weight:600;">Physics End Sem</div><div style="font-size:12px;color:var(--c-gray-500);">Duration: 180 min</div></td>
              <td>PH201</td>
              <td>25 Apr 2025</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td><span class="badge badge-pending"><i class="ti ti-clock"></i>Pending</span></td>
              <td><button class="btn btn-secondary btn-sm" disabled style="opacity:.4;cursor:not-allowed;">Awaiting</button></td>
            </tr>
            <tr style="opacity:.6;">
              <td><div style="font-weight:600;">DBMS Unit Test 2</div><div style="font-size:12px;color:var(--c-gray-500);">Duration: 60 min</div></td>
              <td>CS501</td>
              <td>20 Apr 2025</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td><span class="badge badge-pending"><i class="ti ti-clock"></i>Pending</span></td>
              <td><button class="btn btn-secondary btn-sm" disabled style="opacity:.4;cursor:not-allowed;">Awaiting</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- SCORECARD MODAL -->
<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="modal-head">
      <div>
        <div class="modal-title">Scorecard — DSA Mid Semester</div>
        <div class="modal-sub">CS301 · Data Structures &amp; Algorithms · 10 May 2025</div>
      </div>
      <div class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></div>
    </div>
    <div class="modal-body">
      <div class="score-hero">
        <div><span class="score-big">68</span><span class="score-max"> / 80</span></div>
        <div class="score-pct">85.0%</div>
        <div class="score-grade-badge"><i class="ti ti-award"></i>Grade A · Pass</div>
      </div>

      <div class="result-detail-grid">
        <div class="result-detail-item">
          <div class="result-detail-label">Time Spent</div>
          <div class="result-detail-val">98 / 120 min</div>
        </div>
        <div class="result-detail-item">
          <div class="result-detail-label">Questions Attempted</div>
          <div class="result-detail-val">38 / 40</div>
        </div>
        <div class="result-detail-item">
          <div class="result-detail-label">Correct Answers</div>
          <div class="result-detail-val" style="color:var(--c-success-700);">34</div>
        </div>
        <div class="result-detail-item">
          <div class="result-detail-label">Negative Marks</div>
          <div class="result-detail-val" style="color:var(--c-danger-700);">-4</div>
        </div>
        <div class="result-detail-item">
          <div class="result-detail-label">Rank (Department)</div>
          <div class="result-detail-val">12 / 240</div>
        </div>
        <div class="result-detail-item">
          <div class="result-detail-label">Percentile</div>
          <div class="result-detail-val">95th</div>
        </div>
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--c-gray-800);margin-bottom:12px;">Topic-wise Breakdown</div>
      <div class="topic-breakdown">
        <div class="topic-row">
          <div class="topic-name">Arrays & Strings</div>
          <div class="topic-bar"><div class="topic-bar-fill" style="width:100%"></div></div>
          <div class="topic-score">16 / 16</div>
        </div>
        <div class="topic-row">
          <div class="topic-name">Linked Lists</div>
          <div class="topic-bar"><div class="topic-bar-fill" style="width:90%"></div></div>
          <div class="topic-score">18 / 20</div>
        </div>
        <div class="topic-row">
          <div class="topic-name">Trees &amp; Graphs</div>
          <div class="topic-bar"><div class="topic-bar-fill" style="width:75%"></div></div>
          <div class="topic-score">18 / 24</div>
        </div>
        <div class="topic-row">
          <div class="topic-name">Sorting &amp; Searching</div>
          <div class="topic-bar"><div class="topic-bar-fill" style="width:80%"></div></div>
          <div class="topic-score">16 / 20</div>
        </div>
      </div>

      <button class="re-eval-btn"><i class="ti ti-pencil"></i>Request Re-evaluation</button>
    </div>
  </div>
</div>`;

const script = `function openModal(){document.getElementById('modal').classList.add('open');}
function closeModal(){document.getElementById('modal').classList.remove('open');}`;

export default function Results() {
  return <LegacyPage css={css} html={html} script={script} />;
}
