import LegacyPage from "../../components/LegacyPage";

const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:var(--font);font-size:14px;color:var(--c-gray-800);background:var(--c-bg);-webkit-font-smoothing:antialiased;}
button{font-family:var(--font);cursor:pointer;border:none;background:none;}
.app-shell{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:var(--sidebar-w);background:var(--c-sidebar);display:flex;flex-direction:column;flex-shrink:0;height:100vh;overflow-y:auto;}
.sidebar-logo{padding:0 20px;height:var(--header-h);display:flex;align-items:center;border-bottom:1px solid rgba(0,0,0,0.12);}
.logo-text{font-size:18px;font-weight:700;color:#fff;}
.logo-sub{font-size:10px;color:rgba(255,255,255,0.5);font-weight:500;letter-spacing:.8px;text-transform:uppercase;margin-top:1px;}
.sidebar-section{padding:20px 12px 8px;}
.sidebar-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.4);letter-spacing:.8px;text-transform:uppercase;padding:0 8px;margin-bottom:4px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-lg);color:rgba(255,255,255,.75);font-size:13.5px;font-weight:500;cursor:pointer;position:relative;margin-bottom:2px;transition:background .12s;width:100%;text-align:left;}
.nav-item:hover{background:rgba(0,0,0,.12);color:#fff;}
.nav-item.active{background:rgba(0,0,0,.2);color:#fff;}
.nav-item.active::before{content:'';position:absolute;left:0;top:6px;bottom:6px;width:3px;background:#fff;border-radius:0 2px 2px 0;}
.nav-item i{font-size:16px;flex-shrink:0;}
.sidebar-bottom{margin-top:auto;padding:12px;border-top:1px solid rgba(0,0,0,.12);}
.sidebar-user{display:flex;align-items:center;gap:10px;padding:8px 10px;}
.user-avatar{width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.2);color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.3);}
.user-name{font-size:13px;font-weight:600;color:#fff;}
.user-role{font-size:11px;color:rgba(255,255,255,.5);}
.main-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.header{height:var(--header-h);background:var(--c-card);border-bottom:1px solid var(--c-border);display:flex;align-items:center;padding:0 24px;gap:16px;flex-shrink:0;}
.breadcrumbs{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--c-gray-600);flex:1;}
.breadcrumbs .sep{color:var(--c-gray-300);}
.breadcrumbs .current{color:var(--c-gray-900);font-weight:500;}
.header-actions{display:flex;align-items:center;gap:8px;}
.header-avatar{width:30px;height:30px;border-radius:50%;background:var(--c-primary-700);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;font-size:13.5px;font-weight:500;border-radius:var(--radius-md);border:1px solid transparent;cursor:pointer;transition:all .12s;font-family:var(--font);line-height:1;}
.btn i{font-size:15px;}
.btn-primary{background:var(--c-primary-700);color:#fff;}
.btn-primary:hover{background:var(--c-primary-800);}
.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border);}
.btn-secondary:hover{background:var(--c-gray-50);}
.btn-sm{padding:6px 12px;font-size:12.5px;}
.page-content{flex:1;overflow-y:auto;padding:28px 28px 40px;}
.page-header{margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.page-title{font-size:22px;font-weight:700;color:var(--c-primary-800);letter-spacing:-0.3px;}
.page-subtitle{font-size:13px;color:var(--c-gray-600);margin-top:3px;}

/* STATS */
.stats-row{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:28px;}
.stat-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:18px 20px;}
.stat-label{font-size:11.5px;font-weight:600;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}
.stat-val{font-size:26px;font-weight:700;color:var(--c-gray-900);letter-spacing:-0.5px;}
.stat-trend{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;font-weight:600;padding:2px 6px;border-radius:4px;margin-top:6px;}
.trend-up{background:var(--c-success-100);color:var(--c-success-700);}
.trend-down{background:var(--c-danger-100);color:var(--c-danger-700);}

/* CHART GRID */
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}
.chart-grid-3{grid-template-columns:1fr 1fr 1fr;}
.chart-card{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);padding:20px 22px;}
.chart-card.wide{grid-column:span 2;}
.chart-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.chart-title{font-size:14px;font-weight:700;color:var(--c-gray-900);}
.chart-sub{font-size:12px;color:var(--c-gray-500);margin-top:2px;}
.chart-wrap{position:relative;}
canvas{max-height:220px;}

/* TOPIC TABLE */
.topic-table{width:100%;border-collapse:collapse;}
.topic-table thead th{padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--c-gray-600);text-transform:uppercase;letter-spacing:.5px;background:var(--c-gray-50);border-bottom:1px solid var(--c-border);}
.topic-table tbody tr{border-bottom:1px solid var(--c-gray-100);}
.topic-table tbody tr:last-child{border-bottom:none;}
.topic-table tbody tr:hover{background:var(--c-gray-50);}
.topic-table tbody td{padding:11px 12px;font-size:13px;}
.perf-bar{width:100%;height:6px;background:var(--c-gray-200);border-radius:3px;overflow:hidden;margin-top:3px;}
.perf-bar-fill{height:100%;border-radius:3px;}`;

const html = `<div class="app-shell">
  <nav class="sidebar">
    <div class="sidebar-logo">
      <div><div class="logo-text">EXAM.TIET</div><div class="logo-sub">Examination Portal</div></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Faculty</div>
      <button class="nav-item" onclick="location.href='/faculty/dashboard'"><i class="ti ti-dashboard"></i>Dashboard</button>
      <button class="nav-item" onclick="location.href='/faculty/question-bank'"><i class="ti ti-database"></i>Question Bank</button>
      <button class="nav-item" onclick="location.href='/faculty/create-exam'"><i class="ti ti-plus"></i>Create Exam</button>
      <button class="nav-item"><i class="ti ti-calendar"></i>Scheduling</button>
      <button class="nav-item" onclick="location.href='/faculty/evaluation'"><i class="ti ti-pencil"></i>Evaluation</button>
      <button class="nav-item"><i class="ti ti-refresh"></i>Re-evaluations</button>
      <button class="nav-item active"><i class="ti ti-chart-bar"></i>Analytics</button>
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
      <div class="breadcrumbs"><span>Faculty</span><span class="sep">/</span><span class="current">Analytics</span></div>
      <div class="header-actions">
        <select style="padding:6px 10px;border:1px solid var(--c-border);border-radius:var(--radius-lg);font-size:13px;font-family:var(--font);color:var(--c-gray-700);background:var(--c-gray-50);outline:none;">
          <option selected>DSA Mid Semester 2025</option>
          <option>OOP End Semester 2025</option>
          <option>Networks Mid Sem 2025</option>
        </select>
        <button class="btn btn-secondary btn-sm"><i class="ti ti-download"></i>Export</button>
        <div style="width:1px;height:24px;background:var(--c-border);margin:0 4px;"></div>
        <div class="header-avatar">DR</div>
      </div>
    </header>

    <div class="page-content">
      <div class="page-header">
        <div>
          <div class="page-title">Exam Analytics</div>
          <div class="page-subtitle">DSA Mid Semester 2025 · CS301 · 42 students</div>
        </div>
      </div>

      <!-- STATS ROW -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">Appeared</div>
          <div class="stat-val">38</div>
          <div style="font-size:12px;color:var(--c-gray-500);margin-top:4px;">of 42 registered</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Average Score</div>
          <div class="stat-val">54.8</div>
          <div style="font-size:12px;color:var(--c-gray-500);margin-top:4px;">68.5% · out of 80</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pass Rate</div>
          <div class="stat-val" style="color:var(--c-success-700);">84%</div>
          <div class="stat-trend trend-up"><i class="ti ti-trending-up"></i>+6% vs last</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Highest Score</div>
          <div class="stat-val">79</div>
          <div style="font-size:12px;color:var(--c-gray-500);margin-top:4px;">Priya Raj</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Median Score</div>
          <div class="stat-val">57</div>
          <div style="font-size:12px;color:var(--c-gray-500);margin-top:4px;">71.3%</div>
        </div>
      </div>

      <!-- CHART ROW 1 -->
      <div class="chart-grid" style="margin-bottom:20px;">
        <div class="chart-card">
          <div class="chart-hdr">
            <div><div class="chart-title">Grade Distribution</div><div class="chart-sub">Students by grade band</div></div>
          </div>
          <canvas id="gradeChart"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-hdr">
            <div><div class="chart-title">Score Distribution</div><div class="chart-sub">Frequency histogram</div></div>
          </div>
          <canvas id="histChart"></canvas>
        </div>
      </div>

      <!-- CHART ROW 2 -->
      <div class="chart-grid" style="margin-bottom:20px;">
        <div class="chart-card chart-wide" style="grid-column:span 2;">
          <div class="chart-hdr">
            <div><div class="chart-title">Performance Trend</div><div class="chart-sub">Average score across past 5 exams in this course</div></div>
          </div>
          <canvas id="trendChart" style="max-height:180px;"></canvas>
        </div>
      </div>

      <!-- TOPIC ANALYSIS TABLE -->
      <div class="chart-card">
        <div class="chart-hdr">
          <div><div class="chart-title">Topic-wise Performance</div><div class="chart-sub">Average accuracy per topic</div></div>
        </div>
        <table class="topic-table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Questions</th>
              <th>Avg Accuracy</th>
              <th>Performance</th>
              <th>Difficulty</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:600;">Arrays &amp; Strings</td>
              <td>8</td>
              <td style="font-weight:700;color:var(--c-success-700);">87%</td>
              <td>
                <div class="perf-bar"><div class="perf-bar-fill" style="width:87%;background:var(--c-success-500);"></div></div>
              </td>
              <td><span style="background:var(--c-success-100);color:var(--c-success-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">Easy</span></td>
            </tr>
            <tr>
              <td style="font-weight:600;">Linked Lists</td>
              <td>6</td>
              <td style="font-weight:700;color:var(--c-success-700);">79%</td>
              <td>
                <div class="perf-bar"><div class="perf-bar-fill" style="width:79%;background:var(--c-success-500);"></div></div>
              </td>
              <td><span style="background:var(--c-warning-100);color:var(--c-warning-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">Medium</span></td>
            </tr>
            <tr>
              <td style="font-weight:600;">Trees &amp; Graphs</td>
              <td>10</td>
              <td style="font-weight:700;color:var(--c-warning-700);">62%</td>
              <td>
                <div class="perf-bar"><div class="perf-bar-fill" style="width:62%;background:var(--c-warning-500);"></div></div>
              </td>
              <td><span style="background:var(--c-danger-100);color:var(--c-danger-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">Hard</span></td>
            </tr>
            <tr>
              <td style="font-weight:600;">Sorting &amp; Searching</td>
              <td>8</td>
              <td style="font-weight:700;color:var(--c-success-700);">74%</td>
              <td>
                <div class="perf-bar"><div class="perf-bar-fill" style="width:74%;background:var(--c-success-500);"></div></div>
              </td>
              <td><span style="background:var(--c-warning-100);color:var(--c-warning-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">Medium</span></td>
            </tr>
            <tr>
              <td style="font-weight:600;">Dynamic Programming</td>
              <td>8</td>
              <td style="font-weight:700;color:var(--c-danger-700);">41%</td>
              <td>
                <div class="perf-bar"><div class="perf-bar-fill" style="width:41%;background:var(--c-danger-500);"></div></div>
              </td>
              <td><span style="background:var(--c-danger-100);color:var(--c-danger-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">Very Hard</span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</div>`;

const script = `const red700='#B31234',red100='#FDE8EC',gray200='#E5E7EB',gray600='#6B6B7B';
const defaults={responsive:true,plugins:{legend:{labels:{font:{family:'Inter',size:12},color:gray600}},tooltip:{titleFont:{family:'Inter'},bodyFont:{family:'Inter'}}},scales:{x:{grid:{display:false},ticks:{font:{family:'Inter',size:11},color:gray600}},y:{grid:{color:gray200},ticks:{font:{family:'Inter',size:11},color:gray600}}}};

// Grade Distribution
new Chart(document.getElementById('gradeChart'),{type:'doughnut',data:{labels:['A (≥80%)','B (60-79%)','C (45-59%)','F (<45%)'],datasets:[{data:[8,16,8,6],backgroundColor:['#065F46','#B31234','#F59E0B','#EF4444'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{labels:{font:{family:'Inter',size:12},color:gray600}}}}});

// Score Histogram
new Chart(document.getElementById('histChart'),{type:'bar',data:{labels:['0-10','11-20','21-30','31-40','41-50','51-60','61-70','71-80'],datasets:[{label:'Students',data:[1,1,2,2,4,8,12,8],backgroundColor:red700,borderRadius:3}]},options:{...defaults,plugins:{...defaults.plugins,legend:{display:false}}}});

// Trend
new Chart(document.getElementById('trendChart'),{type:'line',data:{labels:['Quiz 1','Unit Test 1','Mid Sem','Quiz 2','Unit Test 2'],datasets:[{label:'Class Avg',data:[48,52,54.8,56,null],borderColor:red700,backgroundColor:'rgba(179,18,52,.08)',tension:.3,fill:true,pointBackgroundColor:red700,pointRadius:4}]},options:{...defaults,scales:{x:{grid:{display:false},ticks:{font:{family:'Inter',size:11},color:gray600}},y:{grid:{color:gray200},ticks:{font:{family:'Inter',size:11},color:gray600},max:80,min:0}}}});`;

export default function Analytics() {
  return <LegacyPage css={css} html={html} script={script} />;
}
