import LegacyPage from "../../components/LegacyPage";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:var(--font);font-size:14px;color:var(--c-gray-800);background:var(--c-bg);-webkit-font-smoothing:antialiased;}
button{font-family:var(--font);cursor:pointer;border:none;background:none;}
.app-shell{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:var(--sidebar-w);background:var(--c-sidebar);display:flex;flex-direction:column;flex-shrink:0;height:100vh;overflow-y:auto;}
.sidebar-logo{padding:0 20px;height:var(--header-h);display:flex;align-items:center;border-bottom:1px solid rgba(0,0,0,.12);}
.logo-text{font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;}
.logo-sub{font-size:10px;color:rgba(255,255,255,.5);font-weight:500;letter-spacing:.8px;text-transform:uppercase;margin-top:1px;}
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
.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border);}
.btn-secondary:hover{background:var(--c-gray-50);}
.btn-sm{padding:6px 12px;font-size:12.5px;}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;}
.stat-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:20px;box-shadow:var(--shadow-sm);position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.stat-card.red::before{background:var(--c-primary-600);}
.stat-card.green::before{background:var(--c-success-500);}
.stat-card.amber::before{background:var(--c-warning-500);}
.stat-card.navy::before{background:#0E3A63;}
.stat-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.stat-label{font-size:12px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;}
.stat-icon{width:34px;height:34px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:17px;}
.stat-icon.red{background:var(--c-primary-100);color:var(--c-primary-700);}
.stat-icon.green{background:var(--c-success-100);color:var(--c-success-700);}
.stat-icon.amber{background:var(--c-warning-100);color:var(--c-warning-700);}
.stat-icon.navy{background:#E6EEF7;color:#0E3A63;}
.stat-value{font-size:30px;font-weight:700;color:var(--c-gray-900);line-height:1;margin-bottom:6px;}
.stat-meta{font-size:12px;color:var(--c-gray-600);}
.stat-trend{display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:600;}
.stat-trend.up{color:var(--c-success-700);}
.card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm);}
.card-header{padding:16px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:14px;font-weight:600;color:var(--c-gray-900);display:flex;align-items:center;gap:8px;}
.card-title i{color:var(--c-gray-500);font-size:16px;}
.card-action{font-size:12.5px;color:var(--c-primary-700);font-weight:500;cursor:pointer;}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font-size:11px;font-weight:600;border-radius:var(--radius-sm);border:1px solid;text-transform:uppercase;letter-spacing:.3px;line-height:18px;}
.badge-dot{width:5px;height:5px;border-radius:50%;}
.badge-active{background:var(--c-success-100);color:var(--c-success-700);border-color:var(--c-success-500);}
.badge-active .badge-dot{background:var(--c-success-500);}
.badge-student{background:var(--c-primary-100);color:var(--c-primary-700);border-color:var(--c-primary-400);}
.badge-faculty{background:#EDE9FE;color:#4C1D95;border-color:#A78BFA;}
.badge-proctor{background:var(--c-warning-100);color:var(--c-warning-700);border-color:var(--c-warning-500);}
.badge-admin{background:#DBEAFE;color:#1E40AF;border-color:#93C5FD;}
.data-table{width:100%;border-collapse:collapse;}
.data-table th{font-size:11px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;padding:10px 16px;text-align:left;background:var(--c-gray-50);border-bottom:1px solid var(--c-border);}
.data-table td{padding:12px 16px;font-size:13.5px;border-bottom:1px solid var(--c-border);vertical-align:middle;}
.data-table tr:last-child td{border-bottom:none;}
.data-table tbody tr:hover{background:var(--c-gray-50);}
.user-cell{display:flex;align-items:center;gap:8px;}
.user-initials{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
.table-footer{padding:11px 20px;border-top:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--c-gray-600);background:var(--c-gray-50);border-radius:0 0 var(--radius-xl) var(--radius-xl);}
.pagination{display:flex;gap:4px;}
.page-btn{width:28px;height:28px;border:1px solid var(--c-border);background:#fff;border-radius:var(--radius-md);font-size:12.5px;font-family:var(--font);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--c-gray-700);}
.page-btn:hover{background:var(--c-gray-100);}
.page-btn.active{background:var(--c-primary-700);color:#fff;border-color:var(--c-primary-700);}
.content-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}
.filter-bar{padding:12px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;gap:10px;background:#fff;}
.search-wrap{position:relative;flex:1;max-width:280px;}
.search-wrap i{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:15px;color:var(--c-gray-400);pointer-events:none;}
.search-input{width:100%;padding:7px 10px 7px 34px;border:1px solid var(--c-border);border-radius:var(--radius-md);font-size:13px;font-family:var(--font);outline:none;background:var(--c-gray-50);}
.search-input:focus{border-color:var(--c-primary-600);background:#fff;}
.select-filter{padding:7px 10px;border:1px solid var(--c-border);border-radius:var(--radius-md);font-size:13px;font-family:var(--font);color:var(--c-gray-700);outline:none;background:#fff;cursor:pointer;}
/* Audit log */
.audit-row{display:flex;align-items:flex-start;gap:12px;padding:11px 20px;border-bottom:1px solid var(--c-border);}
.audit-row:last-child{border-bottom:none;}
.audit-row:hover{background:var(--c-gray-50);cursor:pointer;}
.audit-time{font-size:11px;color:var(--c-gray-500);font-family:monospace;width:100px;flex-shrink:0;padding-top:1px;}
.audit-action{flex-shrink:0;}
.audit-text{font-size:12.5px;color:var(--c-gray-700);}
.audit-text strong{color:var(--c-gray-900);}
.dept-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.dept-label{font-size:12.5px;color:var(--c-gray-700);width:110px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dept-bar-wrap{flex:1;height:7px;background:var(--c-gray-200);border-radius:4px;overflow:hidden;}
.dept-bar{height:100%;border-radius:4px;background:var(--c-primary-600);}
.dept-val{font-size:12px;font-weight:600;color:var(--c-gray-700);width:36px;text-align:right;flex-shrink:0;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--c-gray-300);border-radius:3px;}`;

const html = `<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div><div class="logo-text">EXAM.TIET</div><div class="logo-sub">Admin Portal</div></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Overview</div>
      <button class="nav-item active"><i class="ti ti-layout-dashboard"></i>Dashboard</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Management</div>
      <button class="nav-item"><i class="ti ti-users"></i>Users</button>
      <button class="nav-item"><i class="ti ti-shield-lock"></i>Roles & Permissions</button>
      <button class="nav-item"><i class="ti ti-building"></i>Departments</button>
      <button class="nav-item"><i class="ti ti-books"></i>Courses</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Examination</div>
      <button class="nav-item"><i class="ti ti-file-description"></i>All Exams</button>
      <button class="nav-item"><i class="ti ti-award"></i>Results</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">System</div>
      <button class="nav-item"><i class="ti ti-list-details"></i>Audit Logs</button>
      <button class="nav-item"><i class="ti ti-bell"></i>Notifications<span class="nav-badge">2</span></button>
      <button class="nav-item"><i class="ti ti-settings"></i>System Settings</button>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">AD</div>
        <div style="flex:1;min-width:0;">
          <div class="user-name">Admin User</div>
          <div class="user-role">System Administrator</div>
        </div>
      </div>
    </div>
  </aside>

  <div class="main-wrap">
    <header class="header">
      <div class="breadcrumbs">
        <span>Admin Portal</span><span class="sep">/</span>
        <span class="current">Dashboard</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn"><i class="ti ti-bell"></i></button>
        <div class="header-divider"></div>
        <span style="font-size:11px;font-weight:600;color:#1E40AF;background:#DBEAFE;padding:4px 10px;border-radius:20px;">ADMIN</span>
        <button class="header-user">
          <div class="header-avatar" style="background:#1E40AF;">AD</div>
          <span class="header-user-name">Admin User</span>
          <i class="ti ti-chevron-down" style="font-size:13px;color:var(--c-gray-500);"></i>
        </button>
      </div>
    </header>

    <main class="page-content">
      <div class="page-header">
        <div>
          <div class="page-title">Admin Dashboard</div>
          <div class="page-subtitle">Thursday, June 11, 2026 · System Overview</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary"><i class="ti ti-user-plus"></i>Add User</button>
          <button class="btn btn-primary"><i class="ti ti-settings"></i>Settings</button>
        </div>
      </div>

      <!-- STATS -->
      <div class="stats-grid">
        <div class="stat-card navy">
          <div class="stat-header"><div class="stat-label">Total Users</div><div class="stat-icon navy"><i class="ti ti-users"></i></div></div>
          <div class="stat-value">51,204</div>
          <div class="stat-meta"><span class="stat-trend up"><i class="ti ti-trending-up" style="font-size:12px;"></i> +342</span> this month</div>
        </div>
        <div class="stat-card red">
          <div class="stat-header"><div class="stat-label">Active Exams</div><div class="stat-icon red"><i class="ti ti-file-description"></i></div></div>
          <div class="stat-value" style="color:var(--c-primary-700);">12</div>
          <div class="stat-meta">3 live right now</div>
        </div>
        <div class="stat-card green">
          <div class="stat-header"><div class="stat-label">Departments</div><div class="stat-icon green"><i class="ti ti-building"></i></div></div>
          <div class="stat-value" style="color:var(--c-success-700);">18</div>
          <div class="stat-meta">94 active courses</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-header"><div class="stat-label">Audit Events (24h)</div><div class="stat-icon amber"><i class="ti ti-list-details"></i></div></div>
          <div class="stat-value" style="color:var(--c-warning-700);">1,847</div>
          <div class="stat-meta">3 anomalies flagged</div>
        </div>
      </div>

      <!-- USERS TABLE -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <div class="card-title"><i class="ti ti-users"></i> User Management</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="card-action">View all</span>
            <button class="btn btn-sm btn-primary"><i class="ti ti-user-plus"></i>Add User</button>
          </div>
        </div>
        <div class="filter-bar">
          <div class="search-wrap">
            <i class="ti ti-search"></i>
            <input class="search-input" placeholder="Search by name, email, roll number…">
          </div>
          <select class="select-filter"><option>All Roles</option><option>Student</option><option>Faculty</option><option>Proctor</option><option>Admin</option></select>
          <select class="select-filter"><option>All Departments</option><option>CSE</option><option>ECE</option><option>Mechanical</option></select>
          <select class="select-filter"><option>All Status</option><option>Active</option><option>Inactive</option></select>
          <button class="btn btn-secondary btn-sm" style="margin-left:auto;"><i class="ti ti-download"></i>Export</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th><input type="checkbox"></th>
                <th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="checkbox"></td>
                <td><div class="user-cell"><div class="user-initials" style="background:var(--c-primary-100);color:var(--c-primary-700);">KS</div><span style="font-weight:500;">Kamal Singh</span></div></td>
                <td style="font-size:12.5px;color:var(--c-gray-600);">102417042@tiet.ac.in</td>
                <td><span class="badge badge-student">Student</span></td>
                <td style="font-size:13px;">Computer Science</td>
                <td><span class="badge badge-active"><span class="badge-dot"></span>Active</span></td>
                <td style="font-size:12px;color:var(--c-gray-500);">Aug 2022</td>
                <td><div style="display:flex;gap:4px;"><button class="btn btn-sm btn-secondary">Edit</button><button class="btn btn-sm" style="color:var(--c-danger-500);border:1px solid var(--c-danger-500);padding:6px;"><i class="ti ti-trash" style="font-size:13px;"></i></button></div></td>
              </tr>
              <tr>
                <td><input type="checkbox"></td>
                <td><div class="user-cell"><div class="user-initials" style="background:#EDE9FE;color:#4C1D95;">DR</div><span style="font-weight:500;">Dr. Rajesh Kumar</span></div></td>
                <td style="font-size:12.5px;color:var(--c-gray-600);">rajesh.kumar@tiet.ac.in</td>
                <td><span class="badge badge-faculty">Faculty</span></td>
                <td style="font-size:13px;">Computer Science</td>
                <td><span class="badge badge-active"><span class="badge-dot"></span>Active</span></td>
                <td style="font-size:12px;color:var(--c-gray-500);">Jan 2018</td>
                <td><div style="display:flex;gap:4px;"><button class="btn btn-sm btn-secondary">Edit</button><button class="btn btn-sm" style="color:var(--c-danger-500);border:1px solid var(--c-danger-500);padding:6px;"><i class="ti ti-trash" style="font-size:13px;"></i></button></div></td>
              </tr>
              <tr>
                <td><input type="checkbox"></td>
                <td><div class="user-cell"><div class="user-initials" style="background:var(--c-warning-100);color:var(--c-warning-700);">PM</div><span style="font-weight:500;">Priya Malhotra</span></div></td>
                <td style="font-size:12.5px;color:var(--c-gray-600);">priya.malhotra@tiet.ac.in</td>
                <td><span class="badge badge-proctor">Proctor</span></td>
                <td style="font-size:13px;">Examination Cell</td>
                <td><span class="badge badge-active"><span class="badge-dot"></span>Active</span></td>
                <td style="font-size:12px;color:var(--c-gray-500);">Mar 2020</td>
                <td><div style="display:flex;gap:4px;"><button class="btn btn-sm btn-secondary">Edit</button><button class="btn btn-sm" style="color:var(--c-danger-500);border:1px solid var(--c-danger-500);padding:6px;"><i class="ti ti-trash" style="font-size:13px;"></i></button></div></td>
              </tr>
              <tr>
                <td><input type="checkbox"></td>
                <td><div class="user-cell"><div class="user-initials" style="background:#DBEAFE;color:#1E40AF;">AC</div><span style="font-weight:500;">Admin Controller</span></div></td>
                <td style="font-size:12.5px;color:var(--c-gray-600);">admin@tiet.ac.in</td>
                <td><span class="badge badge-admin">Admin</span></td>
                <td style="font-size:13px;">IT Services</td>
                <td><span class="badge badge-active"><span class="badge-dot"></span>Active</span></td>
                <td style="font-size:12px;color:var(--c-gray-500);">Jun 2015</td>
                <td><div style="display:flex;gap:4px;"><button class="btn btn-sm btn-secondary">Edit</button></div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span>Showing 1–4 of 51,204 users</span>
          <div class="pagination">
            <button class="page-btn" disabled><i class="ti ti-chevron-left" style="font-size:12px;"></i></button>
            <button class="page-btn active">1</button>
            <button class="page-btn">2</button>
            <button class="page-btn">3</button>
            <span style="align-self:center;color:var(--c-gray-400);font-size:12px;padding:0 4px;">…</span>
            <button class="page-btn">512</button>
            <button class="page-btn"><i class="ti ti-chevron-right" style="font-size:12px;"></i></button>
          </div>
        </div>
      </div>

      <!-- DEPT STATS + AUDIT -->
      <div class="content-row">
        <!-- Dept enrolment -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-building"></i> Students by Department</div>
            <span class="card-action">View all</span>
          </div>
          <div style="padding:16px 20px;">
            <div class="dept-bar-row"><div class="dept-label">Computer Science</div><div class="dept-bar-wrap"><div class="dept-bar" style="width:88%;"></div></div><div class="dept-val">12,840</div></div>
            <div class="dept-bar-row"><div class="dept-label">Electronics</div><div class="dept-bar-wrap"><div class="dept-bar" style="width:72%;"></div></div><div class="dept-val">10,500</div></div>
            <div class="dept-bar-row"><div class="dept-label">Mechanical</div><div class="dept-bar-wrap"><div class="dept-bar" style="width:60%;"></div></div><div class="dept-val">8,750</div></div>
            <div class="dept-bar-row"><div class="dept-label">Civil</div><div class="dept-bar-wrap"><div class="dept-bar" style="width:45%;"></div></div><div class="dept-val">6,560</div></div>
            <div class="dept-bar-row"><div class="dept-label">Chemical</div><div class="dept-bar-wrap"><div class="dept-bar" style="width:28%;"></div></div><div class="dept-val">4,100</div></div>
            <div class="dept-bar-row"><div class="dept-label">Others</div><div class="dept-bar-wrap"><div class="dept-bar" style="width:19%;"></div></div><div class="dept-val">8,454</div></div>
          </div>
        </div>

        <!-- Audit Log Preview -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-list-details"></i> Recent Audit Log</div>
            <span class="card-action">View all logs</span>
          </div>
          <div>
            <div class="audit-row">
              <div class="audit-time">10:04:23</div>
              <div class="audit-action"><span class="badge badge-active" style="font-size:10px;">CREATE</span></div>
              <div class="audit-text"><strong>admin@tiet.ac.in</strong> created exam <strong>UCS301 Mid-Sem</strong></div>
            </div>
            <div class="audit-row">
              <div class="audit-time">10:03:58</div>
              <div class="audit-action"><span class="badge" style="background:var(--c-warning-100);color:var(--c-warning-700);border-color:var(--c-warning-500);font-size:10px;">UPDATE</span></div>
              <div class="audit-text"><strong>rajesh.kumar</strong> updated question <strong>#7b2e…f910</strong></div>
            </div>
            <div class="audit-row">
              <div class="audit-time">09:58:11</div>
              <div class="audit-action"><span class="badge" style="background:#DBEAFE;color:#1E40AF;border-color:#93C5FD;font-size:10px;">LOGIN</span></div>
              <div class="audit-text"><strong>102417042@tiet.ac.in</strong> logged in from 10.0.0.81</div>
            </div>
            <div class="audit-row">
              <div class="audit-time">09:45:30</div>
              <div class="audit-action"><span class="badge badge-active" style="font-size:10px;">PUBLISH</span></div>
              <div class="audit-text"><strong>rajesh.kumar</strong> published exam schedule for <strong>UCS415</strong></div>
            </div>
            <div class="audit-row">
              <div class="audit-time">09:30:02</div>
              <div class="audit-action"><span class="badge" style="background:var(--c-danger-100);color:var(--c-danger-700);border-color:var(--c-danger-500);font-size:10px;">DELETE</span></div>
              <div class="audit-text"><strong>admin@tiet.ac.in</strong> deactivated question <strong>#3d1a…9220</strong></div>
            </div>
            <div class="audit-row">
              <div class="audit-time">09:15:47</div>
              <div class="audit-action"><span class="badge badge-active" style="font-size:10px;">CREATE</span></div>
              <div class="audit-text"><strong>admin@tiet.ac.in</strong> created user <strong>priya.malhotra</strong> (Proctor)</div>
            </div>
          </div>
        </div>
      </div>

    </main>
  </div>
</div>`;

export default function Dashboard() {
  return <LegacyPage css={css} html={html} />;
}
