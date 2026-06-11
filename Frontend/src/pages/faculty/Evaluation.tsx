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
.nav-badge{margin-left:auto;background:rgba(0,0,0,.25);color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;}
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
.header-divider{width:1px;height:24px;background:var(--c-border);margin:0 4px;}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;font-size:13.5px;font-weight:500;border-radius:var(--radius-md);border:1px solid transparent;cursor:pointer;transition:all .12s;font-family:var(--font);line-height:1;}
.btn i{font-size:15px;}
.btn-primary{background:var(--c-primary-700);color:#fff;}
.btn-primary:hover{background:var(--c-primary-800);}
.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border);}
.btn-secondary:hover{background:var(--c-gray-50);}
.btn-sm{padding:6px 12px;font-size:12.5px;}
.btn-success{background:var(--c-success-500);color:#fff;}
.btn-success:hover{background:var(--c-success-700);}

/* LAYOUT: two-panel grading */
.grading-layout{display:grid;grid-template-columns:380px 1fr;gap:20px;height:calc(100vh - var(--header-h));overflow:hidden;padding:20px 24px;}

/* LEFT: student list */
.student-list-panel{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);display:flex;flex-direction:column;overflow:hidden;}
.panel-hdr{padding:14px 16px;border-bottom:1px solid var(--c-border);}
.panel-title{font-size:14px;font-weight:700;color:var(--c-gray-900);margin-bottom:10px;}
.search-wrap{position:relative;}
.search-wrap i{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-gray-400);font-size:15px;}
.search-input{width:100%;padding:7px 10px 7px 32px;border:1px solid var(--c-border);border-radius:var(--radius-lg);font-size:13px;font-family:var(--font);outline:none;background:var(--c-gray-50);}
.search-input:focus{border-color:var(--c-primary-600);}
.panel-tabs{display:flex;border-bottom:1px solid var(--c-border);}
.panel-tab{flex:1;padding:10px;text-align:center;font-size:12.5px;font-weight:600;color:var(--c-gray-500);cursor:pointer;border-bottom:2px solid transparent;transition:all .12s;}
.panel-tab.active{color:var(--c-primary-700);border-bottom-color:var(--c-primary-700);}
.student-list{flex:1;overflow-y:auto;}
.student-item{padding:12px 16px;border-bottom:1px solid var(--c-gray-100);cursor:pointer;display:flex;align-items:center;gap:12px;transition:background .1s;}
.student-item:hover{background:var(--c-gray-50);}
.student-item.active{background:var(--c-primary-50);border-left:3px solid var(--c-primary-700);}
.s-avatar{width:32px;height:32px;border-radius:50%;background:var(--c-primary-100);color:var(--c-primary-700);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.s-name{font-size:13.5px;font-weight:600;color:var(--c-gray-800);}
.s-roll{font-size:11.5px;color:var(--c-gray-500);}
.s-status{margin-left:auto;flex-shrink:0;}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;}
.badge-pending{background:var(--c-warning-100);color:var(--c-warning-700);}
.badge-done{background:var(--c-success-100);color:var(--c-success-700);}

/* RIGHT: grading panel */
.grading-panel{background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius-xl);display:flex;flex-direction:column;overflow:hidden;}
.grading-hdr{padding:16px 20px;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;gap:12px;}
.grading-hdr-left .g-exam-title{font-size:15px;font-weight:700;color:var(--c-gray-900);}
.grading-hdr-left .g-meta{font-size:12px;color:var(--c-gray-500);margin-top:2px;}
.grading-body{flex:1;overflow-y:auto;padding:20px;}
.q-card{border:1px solid var(--c-border);border-radius:var(--radius-xl);margin-bottom:16px;overflow:hidden;}
.q-card-hdr{padding:12px 16px;background:var(--c-gray-50);border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;gap:12px;}
.q-num{font-size:12px;font-weight:700;color:var(--c-primary-700);}
.q-type-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:var(--c-primary-100);color:var(--c-primary-700);}
.q-marks-badge{font-size:12px;font-weight:700;color:var(--c-gray-600);}
.q-body{padding:16px;}
.q-text{font-size:14px;color:var(--c-gray-800);line-height:1.6;margin-bottom:14px;}
.q-answer-label{font-size:11px;font-weight:700;color:var(--c-gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;}
.q-answer-box{background:var(--c-gray-50);border:1px solid var(--c-border);border-radius:var(--radius-lg);padding:12px 14px;font-size:13.5px;color:var(--c-gray-800);line-height:1.6;}
.q-answer-box.is-sa{background:var(--c-primary-50);border-color:var(--c-primary-200);}
.score-input-row{display:flex;align-items:center;gap:12px;margin-top:14px;}
.score-label{font-size:13px;font-weight:600;color:var(--c-gray-700);}
.score-input{width:72px;padding:7px 10px;border:1.5px solid var(--c-border);border-radius:var(--radius-lg);font-size:14px;font-weight:700;font-family:var(--font);text-align:center;outline:none;}
.score-input:focus{border-color:var(--c-primary-700);box-shadow:0 0 0 3px rgba(179,18,52,.08);}
.score-max{font-size:13px;color:var(--c-gray-500);}
.quick-score-btns{display:flex;gap:6px;flex-wrap:wrap;}
.quick-score-btn{padding:5px 10px;border:1px solid var(--c-border);border-radius:var(--radius-md);font-size:12.5px;font-weight:600;cursor:pointer;background:#fff;color:var(--c-gray-700);}
.quick-score-btn:hover{background:var(--c-primary-50);border-color:var(--c-primary-300);color:var(--c-primary-700);}
.grading-footer{padding:16px 20px;border-top:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;gap:12px;}
.grading-progress{font-size:13px;color:var(--c-gray-600);}
.grading-score-tally{font-size:15px;font-weight:700;color:var(--c-gray-900);}`;

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
      <button class="nav-item active"><i class="ti ti-pencil"></i>Evaluation<span class="nav-badge">14</span></button>
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
      <div class="breadcrumbs"><span>Faculty</span><span class="sep">/</span><span>Evaluation</span><span class="sep">/</span><span class="current">DSA Mid Sem — Subjective Grading</span></div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm"><i class="ti ti-download"></i>Export Scores</button>
        <button class="btn btn-primary btn-sm"><i class="ti ti-send"></i>Publish All Results</button>
        <div class="header-divider"></div>
        <div class="header-avatar">DR</div>
      </div>
    </header>

    <div class="grading-layout">
      <!-- LEFT PANEL -->
      <div class="student-list-panel">
        <div class="panel-hdr">
          <div class="panel-title">Students — DSA Mid Semester</div>
          <div class="search-wrap">
            <i class="ti ti-search"></i>
            <input class="search-input" placeholder="Search by name or roll no...">
          </div>
        </div>
        <div class="panel-tabs">
          <div class="panel-tab active">All (42)</div>
          <div class="panel-tab">Pending (14)</div>
          <div class="panel-tab">Graded (28)</div>
        </div>
        <div class="student-list">
          <div class="student-item active">
            <div class="s-avatar">AK</div>
            <div><div class="s-name">Arjun Kumar</div><div class="s-roll">102417042 · CSE</div></div>
            <div class="s-status"><span class="badge badge-pending">Pending</span></div>
          </div>
          <div class="student-item">
            <div class="s-avatar">PR</div>
            <div><div class="s-name">Priya Raj</div><div class="s-roll">102417088 · CSE</div></div>
            <div class="s-status"><span class="badge badge-pending">Pending</span></div>
          </div>
          <div class="student-item">
            <div class="s-avatar">MS</div>
            <div><div class="s-name">Manish Singh</div><div class="s-roll">102417056 · CSE</div></div>
            <div class="s-status"><span class="badge badge-done">Graded</span></div>
          </div>
          <div class="student-item">
            <div class="s-avatar">NV</div>
            <div><div class="s-name">Neha Verma</div><div class="s-roll">102417071 · CSE</div></div>
            <div class="s-status"><span class="badge badge-done">Graded</span></div>
          </div>
          <div class="student-item">
            <div class="s-avatar">RG</div>
            <div><div class="s-name">Rahul Gupta</div><div class="s-roll">102417033 · CSE</div></div>
            <div class="s-status"><span class="badge badge-pending">Pending</span></div>
          </div>
          <div class="student-item">
            <div class="s-avatar">SM</div>
            <div><div class="s-name">Sanya Mehta</div><div class="s-roll">102417099 · CSE</div></div>
            <div class="s-status"><span class="badge badge-done">Graded</span></div>
          </div>
          <div class="student-item">
            <div class="s-avatar">VB</div>
            <div><div class="s-name">Vivek Bhat</div><div class="s-roll">102417017 · CSE</div></div>
            <div class="s-status"><span class="badge badge-pending">Pending</span></div>
          </div>
          <div class="student-item">
            <div class="s-avatar">PA</div>
            <div><div class="s-name">Pooja Agarwal</div><div class="s-roll">102417062 · CSE</div></div>
            <div class="s-status"><span class="badge badge-done">Graded</span></div>
          </div>
        </div>
      </div>

      <!-- RIGHT PANEL -->
      <div class="grading-panel">
        <div class="grading-hdr">
          <div class="grading-hdr-left">
            <div class="g-exam-title">Arjun Kumar — 102417042</div>
            <div class="g-meta">Auto-graded: 58 / 60 (MCQ + T/F) · Subjective: 2 questions pending</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm"><i class="ti ti-arrow-left"></i>Prev</button>
            <button class="btn btn-secondary btn-sm">Next<i class="ti ti-arrow-right"></i></button>
          </div>
        </div>

        <div class="grading-body">
          <!-- Question 1: Short Answer (auto-graded MCQ for reference) -->
          <div class="q-card">
            <div class="q-card-hdr">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="q-num">Q39</span>
                <span class="q-type-badge">SHORT ANSWER</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <div class="q-marks-badge">5 marks</div>
                <span style="background:var(--c-warning-100);color:var(--c-warning-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">Needs Grading</span>
              </div>
            </div>
            <div class="q-body">
              <div class="q-text">Explain the difference between a Binary Search Tree (BST) and an AVL tree. Include the time complexity for insertion in both cases and explain why AVL trees are preferred for search-heavy applications.</div>
              <div class="q-answer-label">Student's Answer</div>
              <div class="q-answer-box is-sa">A Binary Search Tree (BST) is a tree data structure where each node's left child is smaller and right child is larger. In the worst case (sorted input), BST insertion is O(n) because it degrades to a linked list. An AVL tree is a self-balancing BST that maintains a balance factor (height difference ≤ 1) at every node. AVL trees perform rotations on insertion/deletion to restore balance. This ensures O(log n) insertion and search always. For search-heavy applications AVL trees are better because they guarantee O(log n) search even in worst case.</div>

              <div class="score-input-row">
                <div class="score-label">Score:</div>
                <input class="score-input" type="number" id="s39" value="" placeholder="—" min="0" max="5">
                <div class="score-max">/ 5</div>
                <div class="quick-score-btns">
                  <button class="quick-score-btn" onclick="setScore('s39',0)">0</button>
                  <button class="quick-score-btn" onclick="setScore('s39',1)">1</button>
                  <button class="quick-score-btn" onclick="setScore('s39',2)">2</button>
                  <button class="quick-score-btn" onclick="setScore('s39',3)">3</button>
                  <button class="quick-score-btn" onclick="setScore('s39',4)">4</button>
                  <button class="quick-score-btn" onclick="setScore('s39',5)">Full (5)</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Question 2 -->
          <div class="q-card">
            <div class="q-card-hdr">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="q-num">Q40</span>
                <span class="q-type-badge">LONG ANSWER</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <div class="q-marks-badge">10 marks</div>
                <span style="background:var(--c-warning-100);color:var(--c-warning-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;">Needs Grading</span>
              </div>
            </div>
            <div class="q-body">
              <div class="q-text">Describe Dijkstra's shortest path algorithm. Write the pseudocode, explain the data structures used, analyze its time complexity, and trace through an example graph with at least 5 nodes.</div>
              <div class="q-answer-label">Student's Answer</div>
              <div class="q-answer-box is-sa">Dijkstra's algorithm finds the shortest path from a source node to all other nodes in a weighted graph. It works by maintaining a set of unvisited nodes and a distance array. Initially all distances are set to infinity except the source which is 0. Algorithm: 1) Pick the unvisited node with minimum distance. 2) For each neighbor, calculate tentative distance. 3) If tentative < current, update. 4) Mark node as visited. The data structure used is a min-heap (priority queue) for efficiency. Time complexity with binary heap: O((V + E) log V). Example: Graph with nodes A,B,C,D,E — starting at A with edges A→B=4, A→C=2, C→B=1, C→D=5, B→D=1, B→E=3, D→E=2. Shortest paths from A: A→C=2, A→B=3 (via C), A→D=4 (via C→B), A→E=6 (via C→B→D).</div>

              <div class="score-input-row">
                <div class="score-label">Score:</div>
                <input class="score-input" type="number" id="s40" value="" placeholder="—" min="0" max="10">
                <div class="score-max">/ 10</div>
                <div class="quick-score-btns">
                  <button class="quick-score-btn" onclick="setScore('s40',0)">0</button>
                  <button class="quick-score-btn" onclick="setScore('s40',3)">3</button>
                  <button class="quick-score-btn" onclick="setScore('s40',5)">5</button>
                  <button class="quick-score-btn" onclick="setScore('s40',7)">7</button>
                  <button class="quick-score-btn" onclick="setScore('s40',9)">9</button>
                  <button class="quick-score-btn" onclick="setScore('s40',10)">Full (10)</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grading-footer">
          <div>
            <div class="grading-score-tally" id="tally">Total: 58 + <span id="subj-score">—</span> / 80</div>
            <div class="grading-progress" style="margin-top:2px;">Auto-graded: 58 / 60 · Subjective: 2 / 20</div>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-secondary" onclick="saveProgress()"><i class="ti ti-device-floppy"></i>Save Progress</button>
            <button class="btn btn-success" onclick="markDone()"><i class="ti ti-check"></i>Mark as Graded &amp; Next</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const script = `function setScore(id,v){
  document.getElementById(id).value=v;
  updateTally();
}
function updateTally(){
  const s39=parseFloat(document.getElementById('s39').value)||0;
  const s40=parseFloat(document.getElementById('s40').value)||0;
  const total=s39+s40;
  document.getElementById('subj-score').textContent=total+'/20';
}
document.querySelectorAll('.score-input').forEach(el=>el.addEventListener('input',updateTally));
function saveProgress(){alert('Progress saved.');}
function markDone(){alert('Graded! Moving to next student...');}`;

export default function Evaluation() {
  return <LegacyPage css={css} html={html} script={script} />;
}
