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
.header-actions{display:flex;align-items:center;gap:8px;}
.icon-btn{width:36px;height:36px;border-radius:var(--radius-lg);color:var(--c-gray-600);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;position:relative;}
.icon-btn:hover{background:var(--c-gray-100);}
.header-divider{width:1px;height:24px;background:var(--c-border);margin:0 4px;}
.header-avatar{width:30px;height:30px;border-radius:50%;background:var(--c-primary-700);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.header-user{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:var(--radius-lg);cursor:pointer;}
.header-user:hover{background:var(--c-gray-100);}
.header-user-name{font-size:13px;font-weight:500;color:var(--c-gray-800);}
.page-content{flex:1;overflow-y:auto;padding:28px 28px 40px;}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;font-size:13.5px;font-weight:500;border-radius:var(--radius-md);border:1px solid transparent;cursor:pointer;transition:all .12s;font-family:var(--font);line-height:1;}
.btn i{font-size:15px;}
.btn-primary{background:var(--c-primary-700);color:#fff;}
.btn-primary:hover{background:var(--c-primary-800);}
.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border);}
.btn-secondary:hover{background:var(--c-gray-50);}
.btn-sm{padding:6px 12px;font-size:12.5px;}

/* WIZARD STEPS */
.wizard-steps{display:flex;align-items:center;gap:0;margin-bottom:32px;background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:20px 24px;overflow-x:auto;}
.step-item{display:flex;align-items:center;gap:10px;flex:1;min-width:120px;}
.step-num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;border:2px solid var(--c-gray-200);color:var(--c-gray-400);}
.step-item.done .step-num{background:var(--c-success-100);border-color:var(--c-success-500);color:var(--c-success-700);}
.step-item.active .step-num{background:var(--c-primary-700);border-color:var(--c-primary-700);color:#fff;}
.step-label{font-size:12.5px;font-weight:600;color:var(--c-gray-400);}
.step-item.done .step-label{color:var(--c-success-700);}
.step-item.active .step-label{color:var(--c-primary-700);}
.step-connector{flex:1;height:1px;background:var(--c-gray-200);margin:0 8px;}
.step-connector.done{background:var(--c-success-500);}

/* FORM SECTIONS */
.wizard-body{max-width:760px;}
.form-section{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:28px;margin-bottom:20px;}
.form-section-title{font-size:14px;font-weight:700;color:var(--c-gray-900);margin-bottom:20px;display:flex;align-items:center;gap:8px;}
.form-section-title i{font-size:18px;color:var(--c-primary-600);}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
.form-row-3{grid-template-columns:1fr 1fr 1fr;}
.form-row-full{grid-template-columns:1fr;}
.form-group{display:flex;flex-direction:column;gap:5px;}
.form-label{font-size:12.5px;font-weight:600;color:var(--c-gray-700);}
.form-label span{color:var(--c-danger-500);}
.form-control{padding:9px 12px;border:1px solid var(--c-border);border-radius:var(--radius-lg);font-size:13.5px;font-family:var(--font);color:var(--c-gray-800);outline:none;background:var(--c-gray-50);}
.form-control:focus{border-color:var(--c-primary-600);background:#fff;box-shadow:0 0 0 3px rgba(196,30,58,.08);}
textarea.form-control{resize:vertical;min-height:80px;}
.form-hint{font-size:11.5px;color:var(--c-gray-500);margin-top:3px;}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--c-gray-100);}
.toggle-row:last-child{border-bottom:none;}
.toggle-label{font-size:13.5px;color:var(--c-gray-800);}
.toggle-sub{font-size:11.5px;color:var(--c-gray-500);margin-top:2px;}
.toggle{position:relative;width:40px;height:22px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;}
.toggle-slider{position:absolute;inset:0;background:var(--c-gray-300);border-radius:22px;cursor:pointer;transition:.2s;}
.toggle-slider::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;}
.toggle input:checked+.toggle-slider{background:var(--c-primary-700);}
.toggle input:checked+.toggle-slider::before{transform:translateX(18px);}

/* SECTION BUILDER */
.section-builder{border:1px solid var(--c-border);border-radius:var(--radius-xl);overflow:hidden;}
.section-builder-hdr{padding:12px 16px;background:var(--c-gray-50);border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;}
.section-row{padding:16px;border-bottom:1px solid var(--c-gray-100);display:flex;align-items:center;gap:12px;}
.section-row:last-child{border-bottom:none;}
.section-drag{color:var(--c-gray-300);font-size:20px;cursor:grab;}
.section-info{flex:1;}
.section-name{font-size:13.5px;font-weight:600;color:var(--c-gray-800);}
.section-meta{font-size:12px;color:var(--c-gray-500);margin-top:2px;}
.section-actions{display:flex;gap:4px;}

/* WIZARD FOOTER */
.wizard-footer{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;margin-top:24px;}
.wizard-footer-info{font-size:13px;color:var(--c-gray-500);}

/* RULES GRID */
.rules-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;}
.rules-grid .toggle-row{padding:14px 16px;border:none;border-bottom:1px solid var(--c-gray-100);}`;

const html = `<div class="app-shell">
  <nav class="sidebar">
    <div class="sidebar-logo">
      <div><div class="logo-text">EXAM.TIET</div><div class="logo-sub">Examination Portal</div></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Faculty</div>
      <button class="nav-item" onclick="location.href='/faculty/dashboard'"><i class="ti ti-dashboard"></i>Dashboard</button>
      <button class="nav-item" onclick="location.href='/faculty/question-bank'"><i class="ti ti-database"></i>Question Bank</button>
      <button class="nav-item active"><i class="ti ti-plus"></i>Create Exam</button>
      <button class="nav-item"><i class="ti ti-calendar"></i>Scheduling</button>
      <button class="nav-item"><i class="ti ti-pencil"></i>Evaluation</button>
      <button class="nav-item"><i class="ti ti-refresh"></i>Re-evaluations</button>
      <button class="nav-item"><i class="ti ti-chart-bar"></i>Analytics</button>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">DR</div>
        <div><div class="user-name">Dr. Rajesh Sharma</div><div class="user-role">Faculty · CSE Dept</div></div>
      </div>
    </div>
  </nav>

  <div class="main-wrap">
    <header class="header">
      <div class="breadcrumbs"><span>Faculty</span><span class="sep">/</span><span>Exams</span><span class="sep">/</span><span class="current">Create New Exam</span></div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm"><i class="ti ti-device-floppy"></i>Save Draft</button>
        <div class="header-divider"></div>
        <div class="header-avatar">DR</div>
      </div>
    </header>

    <div class="page-content">
      <!-- WIZARD STEPS -->
      <div class="wizard-steps">
        <div class="step-item done">
          <div class="step-num"><i class="ti ti-check" style="font-size:12px;"></i></div>
          <div class="step-label">Basic Info</div>
        </div>
        <div class="step-connector done"></div>
        <div class="step-item active">
          <div class="step-num">2</div>
          <div class="step-label">Sections</div>
        </div>
        <div class="step-connector"></div>
        <div class="step-item">
          <div class="step-num">3</div>
          <div class="step-label">Questions</div>
        </div>
        <div class="step-connector"></div>
        <div class="step-item">
          <div class="step-num">4</div>
          <div class="step-label">Rules</div>
        </div>
        <div class="step-connector"></div>
        <div class="step-item">
          <div class="step-num">5</div>
          <div class="step-label">Schedule</div>
        </div>
        <div class="step-connector"></div>
        <div class="step-item">
          <div class="step-num">6</div>
          <div class="step-label">Preview</div>
        </div>
      </div>

      <!-- STEP 1 CONTENT (shown as done/reference) -->
      <div class="wizard-body">

        <!-- Step 1 Review (collapsed) -->
        <div class="form-section" style="background:var(--c-primary-50);border-color:var(--c-primary-200);">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--c-success-500);display:flex;align-items:center;justify-content:center;"><i class="ti ti-check" style="color:#fff;font-size:12px;"></i></div>
              <div style="font-size:14px;font-weight:700;color:var(--c-primary-800);">Step 1 · Basic Info — Completed</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="showStep1()"><i class="ti ti-pencil"></i>Edit</button>
          </div>
          <div style="margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;" id="step1-summary">
            <div><div style="font-size:11px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;">Title</div><div style="font-size:13.5px;font-weight:600;margin-top:3px;">DSA Mid Semester 2025</div></div>
            <div><div style="font-size:11px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;">Course</div><div style="font-size:13.5px;font-weight:600;margin-top:3px;">CS301 · Data Structures</div></div>
            <div><div style="font-size:11px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;">Duration</div><div style="font-size:13.5px;font-weight:600;margin-top:3px;">120 minutes</div></div>
            <div><div style="font-size:11px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;">Total Marks</div><div style="font-size:13.5px;font-weight:600;margin-top:3px;">80</div></div>
            <div><div style="font-size:11px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;">Pass Marks</div><div style="font-size:13.5px;font-weight:600;margin-top:3px;">32</div></div>
            <div><div style="font-size:11px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;">Status</div><div style="margin-top:3px;"><span style="background:var(--c-warning-100);color:var(--c-warning-700);font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:4px;">DRAFT</span></div></div>
          </div>
        </div>

        <!-- Step 1 FORM (shown when editing) -->
        <div class="form-section" id="step1-form" style="display:none;">
          <div class="form-section-title"><i class="ti ti-info-circle"></i>Basic Exam Information</div>
          <div class="form-row form-row-full">
            <div class="form-group">
              <label class="form-label">Exam Title <span>*</span></label>
              <input class="form-control" value="DSA Mid Semester 2025" placeholder="e.g. Data Structures Mid Semester 2025">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Course <span>*</span></label>
              <select class="form-control"><option selected>CS301 · Data Structures &amp; Algorithms</option><option>CS302 · OOP</option><option>CS401 · Networks</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Exam Type</label>
              <select class="form-control"><option selected>Mid Semester</option><option>End Semester</option><option>Quiz</option><option>Unit Test</option></select>
            </div>
          </div>
          <div class="form-row form-row-3">
            <div class="form-group">
              <label class="form-label">Duration (minutes) <span>*</span></label>
              <input class="form-control" type="number" value="120">
            </div>
            <div class="form-group">
              <label class="form-label">Total Marks <span>*</span></label>
              <input class="form-control" type="number" value="80">
            </div>
            <div class="form-group">
              <label class="form-label">Pass Marks <span>*</span></label>
              <input class="form-control" type="number" value="32">
            </div>
          </div>
          <div class="form-row form-row-full">
            <div class="form-group">
              <label class="form-label">Instructions</label>
              <textarea class="form-control">Read all questions carefully. All MCQ questions carry 2 marks each. Negative marking applies (-0.5 per wrong answer). Do not switch tabs during the exam.</textarea>
            </div>
          </div>
          <div style="display:flex;gap:20px;margin-top:4px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;"><input type="checkbox" checked>Shuffle questions</label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;"><input type="checkbox" checked>Shuffle answer options</label>
          </div>
        </div>

        <!-- STEP 2: SECTIONS (active) -->
        <div class="form-section">
          <div class="form-section-title"><i class="ti ti-layout-columns"></i>Exam Sections</div>
          <p style="font-size:13px;color:var(--c-gray-600);margin-bottom:20px;">Divide your exam into logical sections. Each section can have its own marks allocation and question pool.</p>

          <div class="section-builder">
            <div class="section-builder-hdr">
              <span style="font-size:12px;font-weight:600;color:var(--c-gray-600);">3 SECTIONS · 40 QUESTIONS TOTAL</span>
              <button class="btn btn-primary btn-sm" onclick="addSection()"><i class="ti ti-plus"></i>Add Section</button>
            </div>
            <div class="section-row">
              <i class="ti ti-grip-vertical section-drag"></i>
              <div style="width:28px;height:28px;border-radius:50%;background:var(--c-primary-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--c-primary-700);flex-shrink:0;">1</div>
              <div class="section-info">
                <div class="section-name">Section A — MCQ (Single Answer)</div>
                <div class="section-meta">20 questions · 2 marks each · 40 total marks</div>
              </div>
              <div class="section-actions">
                <button class="btn btn-secondary btn-sm"><i class="ti ti-pencil"></i>Edit</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--c-danger-500);border-color:var(--c-danger-100);"><i class="ti ti-trash"></i></button>
              </div>
            </div>
            <div class="section-row">
              <i class="ti ti-grip-vertical section-drag"></i>
              <div style="width:28px;height:28px;border-radius:50%;background:var(--c-primary-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--c-primary-700);flex-shrink:0;">2</div>
              <div class="section-info">
                <div class="section-name">Section B — Multiple Select (MSQ)</div>
                <div class="section-meta">10 questions · 3 marks each · 30 total marks</div>
              </div>
              <div class="section-actions">
                <button class="btn btn-secondary btn-sm"><i class="ti ti-pencil"></i>Edit</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--c-danger-500);border-color:var(--c-danger-100);"><i class="ti ti-trash"></i></button>
              </div>
            </div>
            <div class="section-row">
              <i class="ti ti-grip-vertical section-drag"></i>
              <div style="width:28px;height:28px;border-radius:50%;background:var(--c-primary-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--c-primary-700);flex-shrink:0;">3</div>
              <div class="section-info">
                <div class="section-name">Section C — True / False</div>
                <div class="section-meta">10 questions · 1 mark each · 10 total marks</div>
              </div>
              <div class="section-actions">
                <button class="btn btn-secondary btn-sm"><i class="ti ti-pencil"></i>Edit</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--c-danger-500);border-color:var(--c-danger-100);"><i class="ti ti-trash"></i></button>
              </div>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:12px 14px;background:var(--c-gray-50);border-radius:var(--radius-lg);border:1px solid var(--c-border);">
            <div style="font-size:13px;color:var(--c-gray-600);">Marks tally: <strong>40 + 30 + 10 = 80</strong></div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--c-success-700);"><i class="ti ti-check"></i>Matches total marks</div>
          </div>
        </div>

        <!-- STEP 4 PREVIEW: Rules (shown collapsed) -->
        <div class="form-section" style="opacity:.5;pointer-events:none;">
          <div class="form-section-title"><i class="ti ti-shield"></i>Exam Rules <span style="font-size:11px;font-weight:400;color:var(--c-gray-500);margin-left:8px;">(Step 4 — not yet)</span></div>
          <div class="rules-grid">
            <div class="toggle-row">
              <div><div class="toggle-label">Allow Backtrack</div><div class="toggle-sub">Students can revisit answered questions</div></div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <div><div class="toggle-label">Mark for Review</div><div class="toggle-sub">Enable flag for review button</div></div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <div><div class="toggle-label">Require Fullscreen</div><div class="toggle-sub">Force fullscreen mode during exam</div></div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <div><div class="toggle-label">Enable Proctoring</div><div class="toggle-sub">Face, browser, audio monitoring</div></div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <div><div class="toggle-label">Camera Required</div><div class="toggle-sub">Block exam if camera unavailable</div></div>
              <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <div><div class="toggle-label">Microphone Required</div><div class="toggle-sub">Block exam if mic unavailable</div></div>
              <label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label>
            </div>
          </div>
          <div class="form-row" style="margin-top:16px;">
            <div class="form-group">
              <label class="form-label">Max Tab Switches Allowed</label>
              <input class="form-control" type="number" value="3">
              <span class="form-hint">Exam auto-submits if exceeded</span>
            </div>
            <div class="form-group">
              <label class="form-label">Auto-save Interval (seconds)</label>
              <input class="form-control" type="number" value="30">
            </div>
          </div>
        </div>

        <!-- WIZARD FOOTER -->
        <div class="wizard-footer">
          <div class="wizard-footer-info">Step 2 of 6 · Sections</div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-secondary" onclick="goBack()"><i class="ti ti-arrow-left"></i>Back</button>
            <button class="btn btn-primary" onclick="goNext()">Continue to Questions<i class="ti ti-arrow-right"></i></button>
          </div>
        </div>

      </div><!-- /wizard-body -->
    </div>
  </div>
</div>

<!-- ADD SECTION MODAL -->
<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:none;align-items:center;justify-content:center;padding:24px;" id="section-modal" onclick="if(event.target===this)document.getElementById('section-modal').style.display='none'">
  <div style="background:#fff;border-radius:12px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
    <div style="padding:22px 24px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:16px;font-weight:700;color:var(--c-gray-900);">Add Exam Section</div>
      <button onclick="document.getElementById('section-modal').style.display='none'" style="width:32px;height:32px;border-radius:var(--radius-lg);border:1px solid var(--c-border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:var(--c-gray-600);"><i class="ti ti-x"></i></button>
    </div>
    <div style="padding:24px;">
      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">Section Title <span style="color:var(--c-danger-500)">*</span></label>
        <input class="form-control" placeholder="e.g. Section A — MCQ">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div class="form-group">
          <label class="form-label">Question Count</label>
          <input class="form-control" type="number" value="10">
        </div>
        <div class="form-group">
          <label class="form-label">Marks per Question</label>
          <input class="form-control" type="number" value="2">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:20px;">
        <label class="form-label">Question Type</label>
        <select class="form-control"><option>MCQ (Single Answer)</option><option>MSQ (Multiple Answer)</option><option>True / False</option><option>Short Answer</option><option>Long Answer</option></select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="document.getElementById('section-modal').style.display='none'">Cancel</button>
        <button class="btn btn-primary"><i class="ti ti-plus"></i>Add Section</button>
      </div>
    </div>
  </div>
</div>`;

const script = `function addSection(){document.getElementById('section-modal').style.display='flex';}
function goNext(){alert('Proceeding to Question Selection...');}
function goBack(){location.href='/faculty/dashboard';}
function showStep1(){
  document.getElementById('step1-summary').closest('.form-section').style.display='none';
  document.getElementById('step1-form').style.display='block';
}`;

export default function CreateExam() {
  return <LegacyPage css={css} html={html} script={script} />;
}
