import LegacyPage from "../../components/LegacyPage";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:var(--font);font-size:14px;color:var(--c-gray-800);background:var(--c-bg);-webkit-font-smoothing:antialiased;}
button{font-family:var(--font);cursor:pointer;border:none;background:none;}
.app-shell{display:flex;height:100vh;overflow:hidden;}

/* SIDEBAR */
.sidebar{width:var(--sidebar-w);background:var(--c-sidebar);display:flex;flex-direction:column;flex-shrink:0;height:100vh;overflow-y:auto;}
.sidebar-logo{padding:0 20px;height:var(--header-h);display:flex;align-items:center;border-bottom:1px solid rgba(0,0,0,0.12);}
.logo-text{font-size:18px;font-weight:700;color:#fff;}
.logo-sub{font-size:10px;color:rgba(255,255,255,0.5);font-weight:500;letter-spacing:.8px;text-transform:uppercase;margin-top:1px;}
.sidebar-section{padding:20px 12px 8px;}
.sidebar-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.4);letter-spacing:.8px;text-transform:uppercase;padding:0 8px;margin-bottom:4px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-lg);color:rgba(255,255,255,.75);font-size:13.5px;font-weight:500;cursor:pointer;position:relative;margin-bottom:2px;transition:background .12s;width:100%;text-align:left;}
.nav-item:hover{background:rgba(0,0,0,.12);color:#fff;}
.nav-item.active{background:rgba(0,0,0,.18);color:#fff;}
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
.icon-btn{width:36px;height:36px;border-radius:var(--radius-lg);color:var(--c-gray-600);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;}
.icon-btn:hover{background:var(--c-gray-100);color:var(--c-gray-900);}
.header-divider{width:1px;height:24px;background:var(--c-border);margin:0 4px;}
.header-user{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:var(--radius-lg);cursor:pointer;}
.header-user:hover{background:var(--c-gray-100);}
.header-avatar{width:30px;height:30px;border-radius:50%;background:var(--c-primary-700);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.header-user-name{font-size:13px;font-weight:500;color:var(--c-gray-800);}

.page-content{flex:1;overflow:hidden;display:flex;flex-direction:column;}
.page-header{padding:24px 28px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-shrink:0;}
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
.btn-danger{background:var(--c-danger-100);color:var(--c-danger-700);border-color:var(--c-danger-500);}
.btn-danger:hover{background:var(--c-danger-500);color:#fff;}

/* SPLIT LAYOUT */
.split-layout{flex:1;display:flex;overflow:hidden;gap:0;}
.split-left{flex:1;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--c-border);}
.split-right{width:480px;flex-shrink:0;display:flex;flex-direction:column;background:var(--c-card);overflow:hidden;transition:width .2s;}
.split-right.collapsed{width:0;}

/* FILTER BAR */
.filter-bar{padding:14px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff;flex-shrink:0;}
.search-wrap{position:relative;min-width:220px;}
.search-wrap i{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:15px;color:var(--c-gray-400);pointer-events:none;}
.search-input{width:100%;padding:7px 10px 7px 34px;border:1px solid var(--c-border);border-radius:var(--radius-md);font-size:13px;font-family:var(--font);outline:none;background:var(--c-gray-50);}
.search-input:focus{border-color:var(--c-primary-600);background:#fff;box-shadow:0 0 0 3px rgba(196,30,58,.08);}
.select-filter{padding:7px 10px;border:1px solid var(--c-border);border-radius:var(--radius-md);font-size:13px;font-family:var(--font);color:var(--c-gray-700);outline:none;background:#fff;cursor:pointer;}
.select-filter:focus{border-color:var(--c-primary-600);}
.filter-chip-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.filter-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid var(--c-border);border-radius:20px;font-size:12px;font-weight:500;color:var(--c-gray-700);background:#fff;cursor:pointer;}
.filter-chip:hover{border-color:var(--c-primary-600);color:var(--c-primary-700);}
.filter-chip.active{background:var(--c-primary-100);border-color:var(--c-primary-600);color:var(--c-primary-700);}
.filter-chip.active i{color:var(--c-primary-600);}

/* TABLE */
.table-wrap{flex:1;overflow-y:auto;background:#fff;}
.data-table{width:100%;border-collapse:collapse;}
.data-table th{font-size:11px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;padding:10px 16px;text-align:left;background:var(--c-gray-50);border-bottom:1px solid var(--c-border);white-space:nowrap;}
.data-table th.sortable{cursor:pointer;}
.data-table th.sortable:hover{color:var(--c-gray-900);}
.data-table td{padding:13px 16px;font-size:13.5px;color:var(--c-gray-800);border-bottom:1px solid var(--c-border);vertical-align:middle;}
.data-table tr:last-child td{border-bottom:none;}
.data-table tbody tr{cursor:pointer;transition:background .1s;}
.data-table tbody tr:hover{background:var(--c-gray-50);}
.data-table tbody tr.selected{background:var(--c-primary-50)!important;}

.q-text-cell{max-width:320px;}
.q-text-preview{font-size:13.5px;font-weight:500;color:var(--c-gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;}
.q-text-sub{font-size:12px;color:var(--c-gray-500);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;}
.q-text-sub-item{display:flex;align-items:center;gap:3px;}
.q-text-sub-item i{font-size:12px;}

/* BADGES */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font-size:11px;font-weight:600;border-radius:var(--radius-sm);border:1px solid;text-transform:uppercase;letter-spacing:.3px;line-height:18px;}
.badge-mcq{background:var(--c-primary-100);color:var(--c-primary-700);border-color:#93C5FD;}
.badge-msq{background:#EDE9FE;color:#4C1D95;border-color:#A78BFA;}
.badge-tf{background:#FCE7F3;color:#831843;border-color:#F9A8D4;}
.badge-sa{background:#FEF3C7;color:#92400E;border-color:#FCD34D;}
.badge-la{background:#D1FAE5;color:#065F46;border-color:#6EE7B7;}
.badge-easy{background:#D1FAE5;color:#065F46;border-color:#6EE7B7;}
.badge-medium{background:#FEF3C7;color:#92400E;border-color:#FCD34D;}
.badge-hard{background:#FEE2E2;color:#991B1B;border-color:#FCA5A5;}
.badge-active{background:var(--c-success-100);color:var(--c-success-700);border-color:var(--c-success-500);}
.badge-inactive{background:var(--c-gray-100);color:var(--c-gray-600);border-color:var(--c-gray-300);}

.action-btn{width:28px;height:28px;border:1px solid var(--c-border);background:#fff;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--c-gray-600);cursor:pointer;}
.action-btn:hover{background:var(--c-gray-100);}
.action-btn.danger:hover{background:var(--c-danger-100);color:var(--c-danger-700);border-color:var(--c-danger-500);}

/* TABLE FOOTER */
.table-footer{padding:11px 20px;border-top:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--c-gray-600);background:var(--c-gray-50);flex-shrink:0;}
.pagination{display:flex;gap:4px;}
.page-btn{width:28px;height:28px;border:1px solid var(--c-border);background:#fff;border-radius:var(--radius-md);font-size:12.5px;font-family:var(--font);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--c-gray-700);}
.page-btn:hover{background:var(--c-gray-100);}
.page-btn.active{background:var(--c-primary-700);color:#fff;border-color:var(--c-primary-700);font-weight:600;}

/* BULK ACTIONS BAR */
.bulk-bar{display:none;padding:10px 20px;background:var(--c-primary-50);border-bottom:1px solid var(--c-primary-200,#F5B8C4);align-items:center;gap:10px;font-size:13px;color:var(--c-primary-800);font-weight:500;flex-shrink:0;}
.bulk-bar.visible{display:flex;}

/* ── RIGHT PANEL: CREATE / EDIT QUESTION ── */
.panel-header{padding:16px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.panel-title{font-size:15px;font-weight:600;color:var(--c-gray-900);}
.panel-close{width:28px;height:28px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--c-gray-600);cursor:pointer;}
.panel-close:hover{background:var(--c-gray-100);}
.panel-body{flex:1;overflow-y:auto;padding:20px;}
.form-group{margin-bottom:16px;}
.form-label{font-size:12.5px;font-weight:600;color:var(--c-gray-700);margin-bottom:5px;display:flex;align-items:center;gap:4px;}
.form-label .required{color:var(--c-primary-600);}
.form-control{width:100%;padding:8px 10px;border:1px solid var(--c-border);border-radius:var(--radius-md);font-size:13.5px;font-family:var(--font);color:var(--c-gray-800);outline:none;background:#fff;}
.form-control:focus{border-color:var(--c-primary-600);box-shadow:0 0 0 3px rgba(196,30,58,.08);}
textarea.form-control{resize:vertical;min-height:90px;line-height:1.6;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.form-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:32px;}

/* Question type selector */
.type-selector{display:flex;gap:8px;flex-wrap:wrap;}
.type-btn{padding:6px 12px;border:1.5px solid var(--c-border);border-radius:var(--radius-md);font-size:12.5px;font-weight:600;color:var(--c-gray-700);cursor:pointer;transition:all .12s;}
.type-btn:hover{border-color:var(--c-primary-600);color:var(--c-primary-700);}
.type-btn.active{background:var(--c-primary-100);border-color:var(--c-primary-600);color:var(--c-primary-700);}

/* Options builder */
.options-builder{display:flex;flex-direction:column;gap:8px;}
.option-row{display:flex;align-items:flex-start;gap:8px;}
.option-indicator{width:28px;height:28px;border-radius:var(--radius-md);border:1.5px solid var(--c-gray-300);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;margin-top:6px;font-size:13px;color:var(--c-gray-500);transition:all .12s;}
.option-indicator:hover{border-color:var(--c-success-500);color:var(--c-success-700);}
.option-indicator.correct{background:var(--c-success-100);border-color:var(--c-success-500);color:var(--c-success-700);}
.option-indicator i{font-size:15px;}
.option-input{flex:1;padding:7px 10px;border:1px solid var(--c-border);border-radius:var(--radius-md);font-size:13.5px;font-family:var(--font);outline:none;}
.option-input:focus{border-color:var(--c-primary-600);}
.option-del{width:24px;height:24px;border-radius:var(--radius-sm);color:var(--c-gray-400);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;margin-top:10px;flex-shrink:0;}
.option-del:hover{color:var(--c-danger-500);background:var(--c-danger-100);}
.add-option-btn{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--c-primary-700);cursor:pointer;padding:6px 0;font-weight:500;}
.add-option-btn:hover{text-decoration:underline;}

.hint-text{font-size:11.5px;color:var(--c-gray-500);margin-top:4px;}

.panel-footer{padding:14px 20px;border-top:1px solid var(--c-border);display:flex;gap:10px;justify-content:flex-end;flex-shrink:0;}

/* STATS ROW */
.stats-row{display:flex;gap:16px;padding:16px 20px;background:#fff;border-bottom:1px solid var(--c-border);flex-shrink:0;}
.stat-chip{display:flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--c-border);border-radius:var(--radius-lg);background:var(--c-gray-50);}
.stat-chip-val{font-size:18px;font-weight:700;color:var(--c-gray-900);}
.stat-chip-label{font-size:12px;color:var(--c-gray-600);}

::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--c-gray-300);border-radius:3px;}`;

const html = `<div class="app-shell">

  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div><div class="logo-text">EXAM.TIET</div><div class="logo-sub">Examination Portal</div></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Main</div>
      <button class="nav-item" onclick="switchNav(this)"><i class="ti ti-layout-dashboard"></i>Dashboard</button>
      <button class="nav-item active" onclick="switchNav(this)"><i class="ti ti-books"></i>Question Bank</button>
      <button class="nav-item" onclick="switchNav(this)"><i class="ti ti-file-description"></i>My Exams</button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Management</div>
      <button class="nav-item" onclick="switchNav(this)"><i class="ti ti-device-desktop-analytics"></i>Analytics</button>
      <button class="nav-item" onclick="switchNav(this)"><i class="ti ti-writing"></i>Grading<span class="nav-badge">5</span></button>
      <button class="nav-item" onclick="switchNav(this)"><i class="ti ti-refresh-alert"></i>Re-evaluations<span class="nav-badge">3</span></button>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">DR</div>
        <div style="flex:1;min-width:0;">
          <div class="user-name">Dr. Rajesh Kumar</div>
          <div class="user-role">Faculty · CSE Dept.</div>
        </div>
      </div>
    </div>
  </aside>

  <!-- MAIN -->
  <div class="main-wrap">
    <header class="header">
      <div class="breadcrumbs">
        <span>Faculty Portal</span>
        <span class="sep">/</span>
        <span class="current">Question Bank</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn"><i class="ti ti-bell"></i></button>
        <div class="header-divider"></div>
        <span style="font-size:11px;font-weight:600;color:var(--c-primary-700);background:var(--c-primary-100);padding:4px 10px;border-radius:20px;">FACULTY</span>
        <button class="header-user">
          <div class="header-avatar">DR</div>
          <span class="header-user-name">Dr. Rajesh</span>
          <i class="ti ti-chevron-down" style="font-size:13px;color:var(--c-gray-500);"></i>
        </button>
      </div>
    </header>

    <div class="page-content">
      <!-- Page Header -->
      <div class="page-header" style="padding-bottom:16px;">
        <div>
          <div class="page-title">Question Bank</div>
          <div class="page-subtitle">1,247 questions across all your courses</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary"><i class="ti ti-upload"></i>Import CSV</button>
          <button class="btn btn-primary" onclick="openCreatePanel()"><i class="ti ti-plus"></i>New Question</button>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-chip">
          <div><div class="stat-chip-val">1,247</div><div class="stat-chip-label">Total Questions</div></div>
        </div>
        <div class="stat-chip">
          <div><div class="stat-chip-val" style="color:var(--c-primary-700);">748</div><div class="stat-chip-label">MCQ</div></div>
        </div>
        <div class="stat-chip">
          <div><div class="stat-chip-val" style="color:#4C1D95;">124</div><div class="stat-chip-label">MSQ</div></div>
        </div>
        <div class="stat-chip">
          <div><div class="stat-chip-val" style="color:var(--c-warning-700);">215</div><div class="stat-chip-label">Short Answer</div></div>
        </div>
        <div class="stat-chip">
          <div><div class="stat-chip-val" style="color:var(--c-success-700);">160</div><div class="stat-chip-label">Long Answer</div></div>
        </div>
        <div style="flex:1;"></div>
        <div class="stat-chip" style="background:var(--c-success-100);border-color:var(--c-success-500);">
          <div><div class="stat-chip-val" style="color:var(--c-success-700);">1,186</div><div class="stat-chip-label" style="color:var(--c-success-700);">Active</div></div>
        </div>
      </div>

      <!-- Split Layout -->
      <div class="split-layout">

        <!-- LEFT: Table -->
        <div class="split-left">

          <!-- Filter Bar -->
          <div class="filter-bar">
            <div class="search-wrap">
              <i class="ti ti-search"></i>
              <input class="search-input" placeholder="Search questions…" type="text">
            </div>
            <select class="select-filter form-select">
              <option>All Courses</option>
              <option>UCS301 — DAA</option>
              <option>UCS415 — COE</option>
              <option>UCS501 — CN</option>
            </select>
            <select class="select-filter form-select">
              <option>All Types</option>
              <option>MCQ</option>
              <option>MSQ</option>
              <option>TRUE / FALSE</option>
              <option>Short Answer</option>
              <option>Long Answer</option>
            </select>
            <select class="select-filter form-select">
              <option>All Difficulty</option>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
            <div style="flex:1;"></div>
            <button class="btn btn-secondary btn-sm"><i class="ti ti-download"></i>Export</button>
          </div>

          <!-- Active filters chips -->
          <div style="padding:8px 20px;background:#fff;border-bottom:1px solid var(--c-border);display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span style="font-size:12px;color:var(--c-gray-600);">Active filters:</span>
            <div class="filter-chip active"><i class="ti ti-x" style="font-size:11px;"></i>UCS301 — DAA</div>
            <div class="filter-chip active"><i class="ti ti-x" style="font-size:11px;"></i>MCQ</div>
            <div class="filter-chip active"><i class="ti ti-x" style="font-size:11px;"></i>Medium</div>
            <span style="font-size:12px;color:var(--c-primary-700);cursor:pointer;font-weight:500;margin-left:4px;" onclick="clearFilters()">Clear all</span>
          </div>

          <!-- Bulk bar -->
          <div class="bulk-bar" id="bulk-bar">
            <i class="ti ti-checkbox" style="font-size:16px;"></i>
            <span id="bulk-count">2</span> questions selected
            <div style="flex:1;"></div>
            <button class="btn btn-sm btn-secondary"><i class="ti ti-file-plus"></i>Add to Exam</button>
            <button class="btn btn-sm btn-danger"><i class="ti ti-trash"></i>Deactivate</button>
          </div>

          <!-- Table -->
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:36px;"><input type="checkbox" id="select-all" onchange="toggleAll(this)"></th>
                  <th class="sortable">Question <i class="ti ti-selector" style="font-size:11px;opacity:.5;"></i></th>
                  <th>Type</th>
                  <th>Difficulty</th>
                  <th class="sortable">Marks <i class="ti ti-selector" style="font-size:11px;opacity:.5;"></i></th>
                  <th>Topic</th>
                  <th>Status</th>
                  <th style="width:80px;">Actions</th>
                </tr>
              </thead>
              <tbody id="q-table-body">
                <!-- Rows generated by JS -->
              </tbody>
            </table>
          </div>

          <!-- Table Footer -->
          <div class="table-footer">
            <span>Showing 1–10 of 312 questions</span>
            <div class="pagination">
              <button class="page-btn" disabled><i class="ti ti-chevron-left" style="font-size:12px;"></i></button>
              <button class="page-btn active">1</button>
              <button class="page-btn">2</button>
              <button class="page-btn">3</button>
              <span style="align-self:center;color:var(--c-gray-400);font-size:12px;padding:0 4px;">…</span>
              <button class="page-btn">32</button>
              <button class="page-btn"><i class="ti ti-chevron-right" style="font-size:12px;"></i></button>
            </div>
          </div>
        </div>

        <!-- RIGHT: Create / Edit Panel -->
        <div class="split-right collapsed" id="right-panel">
          <div class="panel-header">
            <div class="panel-title" id="panel-title">Create New Question</div>
            <button class="panel-close" onclick="closePanel()"><i class="ti ti-x"></i></button>
          </div>
          <div class="panel-body">

            <!-- Question Type -->
            <div class="form-group">
              <div class="form-label">Question Type <span class="required">*</span></div>
              <div class="type-selector">
                <button class="type-btn active" onclick="selectType(this,'MCQ')">MCQ</button>
                <button class="type-btn" onclick="selectType(this,'MSQ')">MSQ</button>
                <button class="type-btn" onclick="selectType(this,'TF')">True / False</button>
                <button class="type-btn" onclick="selectType(this,'SA')">Short Answer</button>
                <button class="type-btn" onclick="selectType(this,'LA')">Long Answer</button>
              </div>
            </div>

            <!-- Course + Topic -->
            <div class="form-row">
              <div class="form-group" style="margin-bottom:0;">
                <div class="form-label">Course <span class="required">*</span></div>
                <select class="form-control form-select">
                  <option value="">Select course…</option>
                  <option selected>UCS301 — DAA</option>
                  <option>UCS415 — COE</option>
                  <option>UCS501 — CN</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <div class="form-label">Difficulty <span class="required">*</span></div>
                <select class="form-control form-select">
                  <option>Easy</option>
                  <option selected>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
            </div>

            <div class="form-row" style="margin-top:16px;">
              <div class="form-group" style="margin-bottom:0;">
                <div class="form-label">Topic</div>
                <input class="form-control" placeholder="e.g. Sorting Algorithms" value="Dynamic Programming">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <div class="form-label">Chapter</div>
                <input class="form-control" placeholder="e.g. Chapter 4" value="Chapter 3">
              </div>
            </div>

            <div style="height:1px;background:var(--c-border);margin:20px 0;"></div>

            <!-- Question Text -->
            <div class="form-group">
              <div class="form-label">Question Text <span class="required">*</span></div>
              <textarea class="form-control" rows="4" placeholder="Enter the question here…">Which of the following recurrence relations correctly represents the time complexity of the Merge Sort algorithm?</textarea>
            </div>

            <!-- Marks -->
            <div class="form-row">
              <div class="form-group" style="margin-bottom:0;">
                <div class="form-label">Marks <span class="required">*</span></div>
                <input type="number" class="form-control" value="2" min="1">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <div class="form-label">Negative Marks</div>
                <input type="number" class="form-control" value="0.5" min="0" step="0.25">
              </div>
            </div>

            <div style="height:1px;background:var(--c-border);margin:20px 0;"></div>

            <!-- Options (MCQ) -->
            <div id="options-section">
              <div class="form-label" style="margin-bottom:10px;">Options <span class="required">*</span> <span style="font-size:11px;color:var(--c-gray-500);font-weight:400;">Click ✓ to mark correct answer</span></div>
              <div class="options-builder" id="options-builder">
                <div class="option-row">
                  <div class="option-indicator" onclick="toggleCorrect(this)" title="Mark as correct"><i class="ti ti-check"></i></div>
                  <input class="option-input" placeholder="Option A…" value="T(n) = T(n/2) + O(n)">
                  <div class="option-del" onclick="removeOption(this)"><i class="ti ti-trash"></i></div>
                </div>
                <div class="option-row">
                  <div class="option-indicator correct" onclick="toggleCorrect(this)" title="Mark as correct"><i class="ti ti-check"></i></div>
                  <input class="option-input" placeholder="Option B…" value="T(n) = 2T(n/2) + O(n)">
                  <div class="option-del" onclick="removeOption(this)"><i class="ti ti-trash"></i></div>
                </div>
                <div class="option-row">
                  <div class="option-indicator" onclick="toggleCorrect(this)" title="Mark as correct"><i class="ti ti-check"></i></div>
                  <input class="option-input" placeholder="Option C…" value="T(n) = T(n-1) + O(n)">
                  <div class="option-del" onclick="removeOption(this)"><i class="ti ti-trash"></i></div>
                </div>
                <div class="option-row">
                  <div class="option-indicator" onclick="toggleCorrect(this)" title="Mark as correct"><i class="ti ti-check"></i></div>
                  <input class="option-input" placeholder="Option D…" value="T(n) = 2T(n/2) + O(log n)">
                  <div class="option-del" onclick="removeOption(this)"><i class="ti ti-trash"></i></div>
                </div>
              </div>
              <div class="add-option-btn" onclick="addOption()">
                <i class="ti ti-plus" style="font-size:14px;"></i> Add option
              </div>
            </div>

          </div>
          <div class="panel-footer">
            <button class="btn btn-secondary" onclick="closePanel()">Cancel</button>
            <button class="btn btn-secondary"><i class="ti ti-eye"></i>Preview</button>
            <button class="btn btn-primary"><i class="ti ti-device-floppy"></i>Save Question</button>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>`;

const script = `function switchNav(el) {
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  el.classList.add('active');
}

// ── Sample question data ──
const questions = [
  { id:1, text:'Which of the following recurrence relations correctly represents Merge Sort?', type:'MCQ', diff:'Medium', marks:2, topic:'Sorting', status:'active', course:'UCS301' },
  { id:2, text:'Select ALL algorithms that use divide and conquer approach.', type:'MSQ', diff:'Medium', marks:3, topic:'Algorithm Design', status:'active', course:'UCS301' },
  { id:3, text:'The time complexity of Binary Search is O(log n). (True/False)', type:'TF', diff:'Easy', marks:1, topic:'Searching', status:'active', course:'UCS301' },
  { id:4, text:'Explain the significance of the Master Theorem with an example.', type:'LA', diff:'Hard', marks:10, topic:'Recurrences', status:'active', course:'UCS301' },
  { id:5, text:'What is the worst-case time complexity of QuickSort?', type:'MCQ', diff:'Easy', marks:2, topic:'Sorting', status:'active', course:'UCS301' },
  { id:6, text:'State the difference between memoization and tabulation in DP.', type:'SA', diff:'Medium', marks:4, topic:'Dynamic Programming', status:'active', course:'UCS301' },
  { id:7, text:'Which data structure is used in Kruskal\\'s algorithm for cycle detection?', type:'MCQ', diff:'Medium', marks:2, topic:'Graph Algorithms', status:'active', course:'UCS301' },
  { id:8, text:'Prove that the problem of Travelling Salesman is NP-Hard.', type:'LA', diff:'Hard', marks:10, topic:'Complexity Theory', status:'inactive', course:'UCS301' },
  { id:9, text:'The optimal substructure property is required for Dynamic Programming.', type:'TF', diff:'Easy', marks:1, topic:'Dynamic Programming', status:'active', course:'UCS301' },
  { id:10, text:'Identify ALL greedy algorithm problems from the following:', type:'MSQ', diff:'Hard', marks:3, topic:'Greedy', status:'active', course:'UCS301' },
];

const typeBadge = { MCQ:'badge-mcq', MSQ:'badge-msq', TF:'badge-tf', SA:'badge-sa', LA:'badge-la' };
const typeLabel = { MCQ:'MCQ', MSQ:'MSQ', TF:'T / F', SA:'Short Ans.', LA:'Long Ans.' };
const diffBadge = { Easy:'badge-easy', Medium:'badge-medium', Hard:'badge-hard' };

const selectedRows = new Set();

function renderTable() {
  const tbody = document.getElementById('q-table-body');
  tbody.innerHTML = '';
  questions.forEach((q,i) => {
    const tr = document.createElement('tr');
    if (selectedRows.has(q.id)) tr.classList.add('selected');
    tr.innerHTML = \`
      <td><input type="checkbox" \${selectedRows.has(q.id)?'checked':''} onchange="toggleRow(\${q.id},this)"></td>
      <td class="q-text-cell">
        <div class="q-text-preview">\${q.text}</div>
        <div class="q-text-sub">
          <span class="q-text-sub-item"><i class="ti ti-tag"></i>\${q.topic}</span>
          <span class="q-text-sub-item"><i class="ti ti-book"></i>\${q.course}</span>
        </div>
      </td>
      <td><span class="badge \${typeBadge[q.type]||'badge-mcq'}">\${typeLabel[q.type]||q.type}</span></td>
      <td><span class="badge \${diffBadge[q.diff]||'badge-medium'}">\${q.diff}</span></td>
      <td style="font-weight:600;">\${q.marks}</td>
      <td style="font-size:12.5px;color:var(--c-gray-600);">\${q.topic}</td>
      <td><span class="badge \${q.status==='active'?'badge-active':'badge-inactive'}">\${q.status==='active'?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="action-btn" title="Edit" onclick="openEditPanel(\${q.id})"><i class="ti ti-pencil"></i></button>
          <button class="action-btn danger" title="Deactivate"><i class="ti ti-trash"></i></button>
        </div>
      </td>\`;
    tr.onclick = (e) => { if (e.target.type !== 'checkbox' && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) openEditPanel(q.id); };
    tbody.appendChild(tr);
  });
}
renderTable();

function toggleRow(id, cb) {
  if (cb.checked) selectedRows.add(id); else selectedRows.delete(id);
  document.getElementById('bulk-bar').classList.toggle('visible', selectedRows.size > 0);
  document.getElementById('bulk-count').textContent = selectedRows.size;
  renderTable();
}
function toggleAll(cb) {
  questions.forEach(q => cb.checked ? selectedRows.add(q.id) : selectedRows.delete(q.id));
  document.getElementById('bulk-bar').classList.toggle('visible', selectedRows.size > 0);
  document.getElementById('bulk-count').textContent = selectedRows.size;
  renderTable();
}

function clearFilters() {}

// ── Panel ──
function openCreatePanel() {
  document.getElementById('panel-title').textContent = 'Create New Question';
  document.getElementById('right-panel').classList.remove('collapsed');
}
function openEditPanel(id) {
  document.getElementById('panel-title').textContent = 'Edit Question';
  document.getElementById('right-panel').classList.remove('collapsed');
  document.querySelectorAll('.data-table tbody tr').forEach((tr,i)=>{
    tr.classList.remove('selected');
    if (questions[i]?.id === id) tr.classList.add('selected');
  });
}
function closePanel() { document.getElementById('right-panel').classList.add('collapsed'); }

// ── Question Type Switch ──
function selectType(el, type) {
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const optSec = document.getElementById('options-section');
  if (type === 'SA' || type === 'LA') {
    optSec.style.display = 'none';
  } else if (type === 'TF') {
    optSec.style.display = '';
    document.getElementById('options-builder').innerHTML = \`
      <div class="option-row">
        <div class="option-indicator correct" onclick="toggleCorrect(this)"><i class="ti ti-check"></i></div>
        <input class="option-input" value="True" readonly>
      </div>
      <div class="option-row">
        <div class="option-indicator" onclick="toggleCorrect(this)"><i class="ti ti-check"></i></div>
        <input class="option-input" value="False" readonly>
      </div>\`;
  } else {
    optSec.style.display = '';
  }
}

// ── Options ──
let optCount = 4;
function addOption() {
  if (optCount >= 6) return;
  optCount++;
  const label = String.fromCharCode(64 + optCount);
  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML = \`
    <div class="option-indicator" onclick="toggleCorrect(this)"><i class="ti ti-check"></i></div>
    <input class="option-input" placeholder="Option \${label}…">
    <div class="option-del" onclick="removeOption(this)"><i class="ti ti-trash"></i></div>\`;
  document.getElementById('options-builder').appendChild(row);
}
function removeOption(el) {
  el.closest('.option-row').remove();
  optCount--;
}
function toggleCorrect(el) {
  // For MCQ: single correct
  document.querySelectorAll('.option-indicator.correct').forEach(i=>i.classList.remove('correct'));
  el.classList.add('correct');
}`;

export default function QuestionBank() {
  return <LegacyPage css={css} html={html} script={script} />;
}
