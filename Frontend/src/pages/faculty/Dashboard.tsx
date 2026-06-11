import LegacyPage from "../../components/LegacyPage";

const css = `/* ══════════════════════════════════════════════
   DESIGN TOKENS
══════════════════════════════════════════════ */


/* ══════════════════════════════════════════════
   RESET & BASE
══════════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: var(--font); font-size: 14px; color: var(--c-gray-800); background: var(--c-bg); line-height: 1.5; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }
button { font-family: var(--font); cursor: pointer; }

/* ══════════════════════════════════════════════
   APP SHELL
══════════════════════════════════════════════ */
.app-shell { display: flex; height: 100vh; overflow: hidden; }

/* ══════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════ */
.sidebar {
  width: var(--sidebar-w);
  background: var(--c-sidebar);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100vh;
  overflow-y: auto;
  position: relative;
  z-index: 100;
}
.sidebar-logo {
  padding: 0 20px;
  height: var(--header-h);
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}
.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.3px;
}
.logo-text span { color: #E8B4BE; }
.logo-sub {
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  font-weight: 500;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-top: 1px;
}

.sidebar-section { padding: 20px 12px 8px; }
.sidebar-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 0 8px;
  margin-bottom: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-lg);
  color: rgba(255,255,255,0.7);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  margin-bottom: 2px;
  transition: background 0.12s, color 0.12s;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}
.nav-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
.nav-item.active {
  background: rgba(196,30,58,0.18);
  color: #fff;
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background: var(--c-primary-600);
  border-radius: 0 2px 2px 0;
}
.nav-item i { font-size: 16px; flex-shrink: 0; opacity: 0.85; }
.nav-item.active i { opacity: 1; }
.nav-badge {
  margin-left: auto;
  background: var(--c-primary-600);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  line-height: 16px;
}

.sidebar-bottom {
  margin-top: auto;
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-lg);
  cursor: pointer;
}
.sidebar-user:hover { background: rgba(255,255,255,0.06); }
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--c-primary-700);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role { font-size: 11px; color: rgba(255,255,255,0.45); }

/* ══════════════════════════════════════════════
   MAIN CONTENT
══════════════════════════════════════════════ */
.main-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Header */
.header {
  height: var(--header-h);
  background: var(--c-card);
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 16px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.breadcrumbs { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--c-gray-600); flex: 1; }
.breadcrumbs .sep { color: var(--c-gray-300); }
.breadcrumbs .current { color: var(--c-gray-900); font-weight: 500; }

.header-actions { display: flex; align-items: center; gap: 4px; }
.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  border-radius: var(--radius-lg);
  color: var(--c-gray-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  position: relative;
  cursor: pointer;
}
.icon-btn:hover { background: var(--c-gray-100); color: var(--c-gray-900); }
.notif-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: var(--c-primary-600);
  border-radius: 50%;
  border: 2px solid #fff;
}
.header-divider { width: 1px; height: 24px; background: var(--c-border); margin: 0 4px; }
.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  border: none;
  background: none;
}
.header-user:hover { background: var(--c-gray-100); }
.header-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--c-primary-700);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.header-user-name { font-size: 13px; font-weight: 500; color: var(--c-gray-800); }

/* Page Content */
.page-content { flex: 1; overflow-y: auto; padding: 28px 28px 40px; }

/* Page Header */
.page-header { margin-bottom: 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-header-left {}
.page-title { font-size: 22px; font-weight: 700; color: var(--c-primary-800); letter-spacing: -0.3px; }
.page-subtitle { font-size: 13px; color: var(--c-gray-600); margin-top: 3px; }
.page-header-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  font-size: 13.5px;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s;
  font-family: var(--font);
  line-height: 1;
}
.btn i { font-size: 15px; }
.btn-primary { background: var(--c-primary-700); color: #fff; border-color: var(--c-primary-700); }
.btn-primary:hover { background: var(--c-primary-800); }
.btn-secondary { background: #fff; color: var(--c-gray-800); border-color: var(--c-border); }
.btn-secondary:hover { background: var(--c-gray-50); border-color: var(--c-gray-300); }
.btn-navy { background: var(--c-primary-800); color: #fff; border-color: var(--c-primary-800); }
.btn-navy:hover { background: var(--c-primary-900); }
.btn-sm { padding: 6px 12px; font-size: 12.5px; }
.btn-sm i { font-size: 13px; }

/* ══════════════════════════════════════════════
   STATS CARDS
══════════════════════════════════════════════ */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
.stat-card {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-xl);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}
.stat-card.navy::before { background: var(--c-primary-700); }
.stat-card.red::before { background: var(--c-primary-600); }
.stat-card.warning::before { background: var(--c-warning-500); }
.stat-card.danger::before { background: var(--c-danger-500); }

.stat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.stat-label { font-size: 12px; font-weight: 600; color: var(--c-gray-600); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
}
.stat-icon.navy { background: var(--c-primary-100); color: var(--c-primary-700); }
.stat-icon.red { background: var(--c-primary-100); color: var(--c-primary-700); }
.stat-icon.warning { background: var(--c-warning-100); color: var(--c-warning-700); }
.stat-icon.danger { background: var(--c-danger-100); color: var(--c-danger-700); }

.stat-value { font-size: 30px; font-weight: 700; color: var(--c-gray-900); line-height: 1; margin-bottom: 6px; }
.stat-meta { font-size: 12px; color: var(--c-gray-600); display: flex; align-items: center; gap: 4px; }
.stat-trend { display: inline-flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 600; }
.stat-trend.up { color: var(--c-success-700); }
.stat-trend.down { color: var(--c-danger-700); }

/* ══════════════════════════════════════════════
   CONTENT GRID
══════════════════════════════════════════════ */
.content-grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; margin-bottom: 20px; }
.content-grid-full { margin-bottom: 20px; }

/* ══════════════════════════════════════════════
   CARD
══════════════════════════════════════════════ */
.card {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}
.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title { font-size: 14px; font-weight: 600; color: var(--c-gray-900); display: flex; align-items: center; gap: 8px; }
.card-title i { color: var(--c-gray-500); font-size: 16px; }
.card-action { font-size: 12.5px; color: var(--c-primary-700); font-weight: 500; cursor: pointer; }
.card-action:hover { text-decoration: underline; }
.card-body { padding: 0; }

/* ══════════════════════════════════════════════
   STATUS BADGES
══════════════════════════════════════════════ */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 18px;
}
.badge-dot { width: 5px; height: 5px; border-radius: 50%; }
.badge-draft { background: var(--c-gray-100); color: var(--c-gray-700); border-color: var(--c-gray-300); }
.badge-draft .badge-dot { background: var(--c-gray-500); }
.badge-review { background: var(--c-warning-100); color: var(--c-warning-700); border-color: var(--c-warning-500); }
.badge-review .badge-dot { background: var(--c-warning-500); }
.badge-published { background: var(--c-success-100); color: var(--c-success-700); border-color: var(--c-success-500); }
.badge-published .badge-dot { background: var(--c-success-500); }
.badge-archived { background: var(--c-primary-100); color: var(--c-primary-700); border-color: #8B5CF6; }
.badge-pending { background: var(--c-warning-100); color: var(--c-warning-700); border-color: var(--c-warning-500); }
.badge-resolved { background: var(--c-success-100); color: var(--c-success-700); border-color: var(--c-success-500); }
.badge-mcq { background: var(--c-primary-100); color: var(--c-primary-700); border-color: #93C5FD; }
.badge-msq { background: #EDE9FE; color: #4C1D95; border-color: #A78BFA; }
.badge-easy { background: #D1FAE5; color: #065F46; border-color: #6EE7B7; }
.badge-medium { background: #FEF3C7; color: #92400E; border-color: #FCD34D; }
.badge-hard { background: #FEE2E2; color: #991B1B; border-color: #FCA5A5; }

/* ══════════════════════════════════════════════
   EXAM TABLE
══════════════════════════════════════════════ */
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-gray-600);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 16px;
  text-align: left;
  background: var(--c-gray-50);
  border-bottom: 1px solid var(--c-border);
}
.data-table th:first-child { border-radius: 0; }
.data-table td {
  padding: 13px 16px;
  font-size: 13.5px;
  color: var(--c-gray-800);
  border-bottom: 1px solid var(--c-border);
  vertical-align: middle;
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover { background: var(--c-gray-50); }

.table-exam-name { font-weight: 500; color: var(--c-gray-900); margin-bottom: 2px; }
.table-exam-meta { font-size: 12px; color: var(--c-gray-500); }
.table-actions { display: flex; gap: 4px; }
.action-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--c-border);
  background: #fff;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--c-gray-600);
  cursor: pointer;
}
.action-btn:hover { background: var(--c-gray-100); color: var(--c-gray-900); }
.action-btn.primary:hover { background: var(--c-primary-50); color: var(--c-primary-700); border-color: var(--c-primary-200, #FBCFE8); }

/* ══════════════════════════════════════════════
   SEARCH / FILTER BAR
══════════════════════════════════════════════ */
.filter-bar {
  padding: 12px 20px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
}
.search-input-wrap { position: relative; flex: 1; max-width: 280px; }
.search-input-wrap i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  color: var(--c-gray-400);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 7px 10px 7px 34px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-family: var(--font);
  color: var(--c-gray-800);
  outline: none;
  background: var(--c-gray-50);
}
.search-input:focus { border-color: var(--c-primary-600); background: #fff; box-shadow: 0 0 0 3px rgba(14,58,99,0.08); }
.select-filter {
  padding: 7px 10px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-family: var(--font);
  color: var(--c-gray-700);
  outline: none;
  background: #fff;
  cursor: pointer;
}
.select-filter:focus { border-color: var(--c-primary-600); }

/* ══════════════════════════════════════════════
   RECENT ACTIVITY / SIDE PANEL
══════════════════════════════════════════════ */
.activity-list { padding: 4px 0; }
.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--c-border);
}
.activity-item:last-child { border-bottom: none; }
.activity-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}
.activity-icon.blue { background: var(--c-primary-100); color: var(--c-primary-700); }
.activity-icon.green { background: var(--c-success-100); color: var(--c-success-700); }
.activity-icon.amber { background: var(--c-warning-100); color: var(--c-warning-700); }
.activity-icon.red { background: var(--c-danger-100); color: var(--c-danger-700); }
.activity-body { flex: 1; min-width: 0; }
.activity-text { font-size: 13px; color: var(--c-gray-800); line-height: 1.4; }
.activity-text strong { font-weight: 600; color: var(--c-gray-900); }
.activity-time { font-size: 11.5px; color: var(--c-gray-500); margin-top: 2px; }

/* ══════════════════════════════════════════════
   UPCOMING SCHEDULE SECTION
══════════════════════════════════════════════ */
.schedule-list { padding: 0; }
.schedule-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
}
.schedule-item:last-child { border-bottom: none; }
.schedule-item:hover { background: var(--c-gray-50); }
.schedule-date {
  width: 44px;
  text-align: center;
  flex-shrink: 0;
}
.schedule-date .day { font-size: 20px; font-weight: 700; color: var(--c-primary-800); line-height: 1; }
.schedule-date .month { font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--c-gray-500); letter-spacing: 0.5px; margin-top: 2px; }
.schedule-divider { width: 1px; height: 36px; background: var(--c-border); flex-shrink: 0; }
.schedule-info { flex: 1; min-width: 0; }
.schedule-name { font-size: 13.5px; font-weight: 500; color: var(--c-gray-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.schedule-meta { font-size: 12px; color: var(--c-gray-500); margin-top: 2px; display: flex; gap: 8px; flex-wrap: wrap; }
.schedule-meta-item { display: flex; align-items: center; gap: 3px; }
.schedule-meta-item i { font-size: 12px; }

/* ══════════════════════════════════════════════
   GRADING QUEUE
══════════════════════════════════════════════ */
.grading-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
}
.grading-item:last-child { border-bottom: none; }
.grading-item:hover { background: var(--c-gray-50); }
.grading-course-badge {
  padding: 2px 8px;
  background: var(--c-primary-100);
  color: var(--c-primary-800);
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.grading-info { flex: 1; min-width: 0; }
.grading-name { font-size: 13.5px; font-weight: 500; color: var(--c-gray-900); }
.grading-count { font-size: 12px; color: var(--c-gray-500); margin-top: 1px; }
.grading-action { flex-shrink: 0; }

/* ══════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════ */
.table-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--c-gray-600);
  background: var(--c-gray-50);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}
.pagination { display: flex; gap: 4px; }
.page-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--c-border);
  background: #fff;
  border-radius: var(--radius-md);
  font-size: 12.5px;
  font-family: var(--font);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-gray-700);
}
.page-btn:hover { background: var(--c-gray-100); }
.page-btn.active { background: var(--c-primary-800); color: #fff; border-color: var(--c-primary-800); font-weight: 600; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ══════════════════════════════════════════════
   NOTIFICATION DROPDOWN
══════════════════════════════════════════════ */
.dropdown-overlay { display: none; position: fixed; inset: 0; z-index: 200; }
.dropdown-overlay.open { display: block; }
.notif-dropdown {
  display: none;
  position: absolute;
  top: calc(var(--header-h) + 4px);
  right: 24px;
  width: 360px;
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  z-index: 300;
  overflow: hidden;
}
.notif-dropdown.open { display: block; }
.notif-header { padding: 14px 16px; border-bottom: 1px solid var(--c-border); display: flex; align-items: center; justify-content: space-between; }
.notif-title { font-size: 14px; font-weight: 600; color: var(--c-gray-900); }
.notif-mark-all { font-size: 12px; color: var(--c-primary-700); cursor: pointer; font-weight: 500; border: none; background: none; }
.notif-item { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--c-border); cursor: pointer; }
.notif-item:last-child { border-bottom: none; }
.notif-item:hover { background: var(--c-gray-50); }
.notif-item.unread { background: var(--c-primary-50); }
.notif-item.unread:hover { background: var(--c-primary-100); }
.notif-icon-wrap {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; flex-shrink: 0;
}
.notif-text { font-size: 13px; color: var(--c-gray-800); line-height: 1.4; }
.notif-time { font-size: 11px; color: var(--c-gray-500); margin-top: 3px; }
.unread-indicator { width: 6px; height: 6px; border-radius: 50%; background: var(--c-primary-600); margin-top: 6px; flex-shrink: 0; }

/* Progress bar for analytics card */
.progress-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.progress-label { font-size: 12.5px; color: var(--c-gray-700); width: 100px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.progress-bar-wrap { flex: 1; height: 6px; background: var(--c-gray-200); border-radius: 3px; overflow: hidden; }
.progress-bar { height: 100%; border-radius: 3px; }
.progress-val { font-size: 12px; font-weight: 600; color: var(--c-gray-700); width: 32px; text-align: right; flex-shrink: 0; }

/* Tabs */
.tab-bar { display: flex; border-bottom: 2px solid var(--c-border); margin-bottom: 0; }
.tab {
  padding: 12px 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-gray-600);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  border: none;
  background: none;
  font-family: var(--font);
}
.tab:hover { color: var(--c-gray-900); }
.tab.active { color: var(--c-primary-700); border-bottom: 2px solid var(--c-primary-700); font-weight: 600; }

/* Re-eval section */
.re-eval-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--c-border);
}
.re-eval-item:last-child { border-bottom: none; }
.re-eval-item:hover { background: var(--c-gray-50); cursor: pointer; }
.re-eval-student { font-size: 13px; font-weight: 500; color: var(--c-gray-900); }
.re-eval-meta { font-size: 12px; color: var(--c-gray-500); }
.re-eval-reason { font-size: 12.5px; color: var(--c-gray-700); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Empty state */
.empty-state { padding: 48px 20px; text-align: center; }
.empty-state i { font-size: 40px; color: var(--c-gray-300); margin-bottom: 12px; }
.empty-state-title { font-size: 14px; font-weight: 600; color: var(--c-gray-600); margin-bottom: 4px; }
.empty-state-text { font-size: 13px; color: var(--c-gray-500); }

/* Active session banner */
.session-banner {
  background: linear-gradient(135deg, var(--c-primary-800), var(--c-primary-900));
  color: #fff;
  border-radius: var(--radius-xl);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
  border: 1px solid rgba(255,255,255,0.08);
}
.session-banner-icon { font-size: 28px; opacity: 0.9; flex-shrink: 0; }
.session-banner-info { flex: 1; }
.session-banner-title { font-size: 14px; font-weight: 600; }
.session-banner-sub { font-size: 12.5px; opacity: 0.7; margin-top: 2px; }
.session-live-badge {
  display: flex; align-items: center; gap: 6px;
  background: rgba(16,185,129,0.15);
  color: #34D399;
  font-size: 11px; font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid rgba(16,185,129,0.3);
  flex-shrink: 0;
}
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: #34D399; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--c-gray-300); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--c-gray-400); }

/* Tooltip (simple) */
[data-tip] { position: relative; }
[data-tip]:hover::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-gray-900);
  color: #fff;
  font-size: 11.5px;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  white-space: nowrap;
  pointer-events: none;
  z-index: 999;
}`;

const html = `<div class="app-shell">

  <!-- ─── SIDEBAR ─────────────────────────── -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div>
        <div class="logo-text">EXAM<span>.</span>TIET</div>
        <div class="logo-sub">Examination Portal</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Main</div>
      <button class="nav-item active">
        <i class="ti ti-layout-dashboard"></i>
        Dashboard
      </button>
      <button class="nav-item" onclick="switchTab(this, 'questions')">
        <i class="ti ti-books"></i>
        Question Bank
      </button>
      <button class="nav-item" onclick="switchTab(this, 'exams')">
        <i class="ti ti-file-description"></i>
        My Exams
      </button>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Management</div>
      <button class="nav-item" onclick="switchTab(this)">
        <i class="ti ti-device-desktop-analytics"></i>
        Analytics
      </button>
      <button class="nav-item" onclick="switchTab(this)">
        <i class="ti ti-writing"></i>
        Grading
        <span class="nav-badge">5</span>
      </button>
      <button class="nav-item" onclick="switchTab(this)">
        <i class="ti ti-refresh-alert"></i>
        Re-evaluations
        <span class="nav-badge">3</span>
      </button>
      <button class="nav-item" onclick="switchTab(this)">
        <i class="ti ti-calendar-stats"></i>
        Schedules
      </button>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Account</div>
      <button class="nav-item" onclick="switchTab(this)">
        <i class="ti ti-bell"></i>
        Notifications
        <span class="nav-badge">7</span>
      </button>
      <button class="nav-item" onclick="switchTab(this)">
        <i class="ti ti-user-circle"></i>
        Profile
      </button>
    </div>

    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="user-avatar">DR</div>
        <div class="user-info">
          <div class="user-name">Dr. Rajesh Kumar</div>
          <div class="user-role">Faculty · CSE Dept.</div>
        </div>
        <i class="ti ti-chevron-right" style="color:rgba(255,255,255,0.3);font-size:14px;"></i>
      </div>
    </div>
  </aside>

  <!-- ─── MAIN ──────────────────────────── -->
  <div class="main-wrap">

    <!-- Header -->
    <header class="header">
      <div class="breadcrumbs">
        <span>Faculty Portal</span>
        <span class="sep">/</span>
        <span class="current">Dashboard</span>
      </div>

      <div class="header-actions">
        <!-- Help -->
        <button class="icon-btn" data-tip="Help">
          <i class="ti ti-help-circle"></i>
        </button>

        <!-- Notifications -->
        <button class="icon-btn" onclick="toggleNotif()" data-tip="Notifications" id="notif-btn">
          <i class="ti ti-bell"></i>
          <span class="notif-dot"></span>
        </button>

        <div class="header-divider"></div>

        <!-- Role badge -->
        <span style="font-size:11px;font-weight:600;color:var(--c-primary-700);background:var(--c-primary-100);padding:4px 10px;border-radius:20px;letter-spacing:0.3px;">FACULTY</span>

        <!-- Avatar -->
        <button class="header-user">
          <div class="header-avatar">DR</div>
          <span class="header-user-name">Dr. Rajesh</span>
          <i class="ti ti-chevron-down" style="font-size:13px;color:var(--c-gray-500);"></i>
        </button>
      </div>
    </header>

    <!-- Notification Dropdown -->
    <div class="dropdown-overlay" onclick="closeNotif()"></div>
    <div class="notif-dropdown" id="notif-panel">
      <div class="notif-header">
        <div class="notif-title">Notifications <span style="background:var(--c-primary-600);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:6px;">7</span></div>
        <button class="notif-mark-all">Mark all read</button>
      </div>
      <div class="notif-item unread">
        <div class="notif-icon-wrap" style="background:#FEF3C7;color:#92400E;"><i class="ti ti-refresh-alert"></i></div>
        <div style="flex:1">
          <div class="notif-text"><strong>Re-evaluation requested</strong> for UCS301 Mid-term by Priya Sharma</div>
          <div class="notif-time">10 minutes ago</div>
        </div>
        <div class="unread-indicator"></div>
      </div>
      <div class="notif-item unread">
        <div class="notif-icon-wrap" style="background:#D1FAE5;color:#065F46;"><i class="ti ti-check"></i></div>
        <div style="flex:1">
          <div class="notif-text">Exam <strong>COE315 End Semester</strong> published successfully</div>
          <div class="notif-time">2 hours ago</div>
        </div>
        <div class="unread-indicator"></div>
      </div>
      <div class="notif-item">
        <div class="notif-icon-wrap" style="background:#DBEAFE;color:#1E40AF;"><i class="ti ti-user-plus"></i></div>
        <div style="flex:1">
          <div class="notif-text"><strong>48 students</strong> registered for UCS415 Exam</div>
          <div class="notif-time">5 hours ago</div>
        </div>
      </div>
      <div class="notif-item">
        <div class="notif-icon-wrap" style="background:#FEE2E2;color:#991B1B;"><i class="ti ti-alert-triangle"></i></div>
        <div style="flex:1">
          <div class="notif-text">Proctoring alert: 3 students flagged in <strong>UCS301 Quiz 2</strong></div>
          <div class="notif-time">1 day ago</div>
        </div>
      </div>
      <div style="padding:10px 16px;text-align:center;border-top:1px solid var(--c-border);">
        <span style="font-size:12.5px;color:var(--c-primary-700);font-weight:500;cursor:pointer;">View all notifications</span>
      </div>
    </div>

    <!-- Page Content -->
    <main class="page-content">

      <!-- Active Session Banner -->
      <div class="session-banner">
        <i class="ti ti-device-desktop-analytics session-banner-icon"></i>
        <div class="session-banner-info">
          <div class="session-banner-title">UCS301 — Design & Analysis of Algorithms · Mid-Semester Exam</div>
          <div class="session-banner-sub">Started at 10:00 AM · 47 students in progress · Ends in 01:24:08</div>
        </div>
        <div class="session-live-badge">
          <div class="live-dot"></div>
          LIVE
        </div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.12);color:#fff;border-color:rgba(255,255,255,0.2);flex-shrink:0;">
          <i class="ti ti-eye"></i> Monitor
        </button>
      </div>

      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header-left">
          <div class="page-title">Faculty Dashboard</div>
          <div class="page-subtitle">Wednesday, June 10, 2026 · CSE Department</div>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" onclick="">
            <i class="ti ti-plus"></i> New Question
          </button>
          <button class="btn btn-primary" onclick="">
            <i class="ti ti-file-plus"></i> Create Exam
          </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card navy">
          <div class="stat-header">
            <div class="stat-label">Total Questions</div>
            <div class="stat-icon navy"><i class="ti ti-books"></i></div>
          </div>
          <div class="stat-value">1,247</div>
          <div class="stat-meta">
            <span class="stat-trend up"><i class="ti ti-trending-up" style="font-size:12px;"></i> +34</span>
            &nbsp;this month
          </div>
        </div>
        <div class="stat-card red">
          <div class="stat-header">
            <div class="stat-label">Active Exams</div>
            <div class="stat-icon red"><i class="ti ti-file-description"></i></div>
          </div>
          <div class="stat-value">8</div>
          <div class="stat-meta">3 published · 5 draft</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-header">
            <div class="stat-label">Pending Grading</div>
            <div class="stat-icon warning"><i class="ti ti-clock"></i></div>
          </div>
          <div class="stat-value">53</div>
          <div class="stat-meta">
            <span class="stat-trend down"><i class="ti ti-alert-circle" style="font-size:12px;"></i></span>
            Long-answer responses
          </div>
        </div>
        <div class="stat-card danger">
          <div class="stat-header">
            <div class="stat-label">Re-evaluations</div>
            <div class="stat-icon danger"><i class="ti ti-refresh-alert"></i></div>
          </div>
          <div class="stat-value">3</div>
          <div class="stat-meta">Awaiting review</div>
        </div>
      </div>

      <!-- Content Grid: Exam Table + Side Panel -->
      <div class="content-grid">

        <!-- Left: Recent Exams -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-file-description"></i> My Exams</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="card-action" onclick="">View all</span>
              <button class="btn btn-sm btn-primary" onclick="">
                <i class="ti ti-plus"></i> New
              </button>
            </div>
          </div>

          <!-- Tab bar -->
          <div style="padding: 0 20px; background:#fff; border-bottom: 1px solid var(--c-border);">
            <div class="tab-bar" style="border:none;">
              <button class="tab active" onclick="switchExamTab(this, 'all')">All (8)</button>
              <button class="tab" onclick="switchExamTab(this, 'published')">Published (3)</button>
              <button class="tab" onclick="switchExamTab(this, 'draft')">Draft (5)</button>
              <button class="tab" onclick="switchExamTab(this, 'review')">In Review (1)</button>
            </div>
          </div>

          <!-- Filter Bar -->
          <div class="filter-bar">
            <div class="search-input-wrap">
              <i class="ti ti-search"></i>
              <input class="search-input" placeholder="Search exams..." type="text">
            </div>
            <select class="select-filter">
              <option>All Courses</option>
              <option>UCS301 — DAA</option>
              <option>UCS415 — COE</option>
              <option>UCS501 — CN</option>
            </select>
            <select class="select-filter">
              <option>All Status</option>
              <option>Draft</option>
              <option>Review</option>
              <option>Published</option>
            </select>
          </div>

          <!-- Table -->
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Status</th>
                  <th>Questions</th>
                  <th>Duration</th>
                  <th>Scheduled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div class="table-exam-name">Mid-Semester Examination</div>
                    <div class="table-exam-meta">UCS301 · Design & Analysis of Algorithms</div>
                  </td>
                  <td><span class="badge badge-published"><span class="badge-dot"></span>Published</span></td>
                  <td>50 Qs</td>
                  <td>120 min</td>
                  <td style="font-size:12.5px;">Jun 10, 2026<br><span style="color:var(--c-gray-500);">10:00 – 12:00</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn primary" data-tip="View"><i class="ti ti-eye"></i></button>
                      <button class="action-btn" data-tip="Analytics"><i class="ti ti-chart-bar"></i></button>
                      <button class="action-btn" data-tip="Edit"><i class="ti ti-pencil"></i></button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div class="table-exam-name">End Semester Examination</div>
                    <div class="table-exam-meta">UCS415 · COE Lab</div>
                  </td>
                  <td><span class="badge badge-published"><span class="badge-dot"></span>Published</span></td>
                  <td>75 Qs</td>
                  <td>180 min</td>
                  <td style="font-size:12.5px;">Jun 18, 2026<br><span style="color:var(--c-gray-500);">09:00 – 12:00</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn primary" data-tip="View"><i class="ti ti-eye"></i></button>
                      <button class="action-btn" data-tip="Analytics"><i class="ti ti-chart-bar"></i></button>
                      <button class="action-btn" data-tip="Edit"><i class="ti ti-pencil"></i></button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div class="table-exam-name">Quiz 3 — Sorting Algorithms</div>
                    <div class="table-exam-meta">UCS301 · Design & Analysis of Algorithms</div>
                  </td>
                  <td><span class="badge badge-review"><span class="badge-dot"></span>Review</span></td>
                  <td>20 Qs</td>
                  <td>30 min</td>
                  <td style="font-size:12.5px;color:var(--c-gray-500);">Not scheduled</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn primary" data-tip="View"><i class="ti ti-eye"></i></button>
                      <button class="action-btn" data-tip="Edit"><i class="ti ti-pencil"></i></button>
                      <button class="action-btn" data-tip="Delete"><i class="ti ti-trash" style="color:var(--c-danger-500);"></i></button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div class="table-exam-name">Practice Assessment — Dynamic Programming</div>
                    <div class="table-exam-meta">UCS301 · Design & Analysis of Algorithms</div>
                  </td>
                  <td><span class="badge badge-draft"><span class="badge-dot"></span>Draft</span></td>
                  <td>15 Qs</td>
                  <td>45 min</td>
                  <td style="font-size:12.5px;color:var(--c-gray-500);">Not scheduled</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn primary" data-tip="View"><i class="ti ti-eye"></i></button>
                      <button class="action-btn" data-tip="Edit"><i class="ti ti-pencil"></i></button>
                      <button class="action-btn" data-tip="Delete"><i class="ti ti-trash" style="color:var(--c-danger-500);"></i></button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div class="table-exam-name">Mid-Semester Examination</div>
                    <div class="table-exam-meta">UCS501 · Computer Networks</div>
                  </td>
                  <td><span class="badge badge-draft"><span class="badge-dot"></span>Draft</span></td>
                  <td>40 Qs</td>
                  <td>90 min</td>
                  <td style="font-size:12.5px;color:var(--c-gray-500);">Not scheduled</td>
                  <td>
                    <div class="table-actions">
                      <button class="action-btn primary" data-tip="View"><i class="ti ti-eye"></i></button>
                      <button class="action-btn" data-tip="Edit"><i class="ti ti-pencil"></i></button>
                      <button class="action-btn" data-tip="Delete"><i class="ti ti-trash" style="color:var(--c-danger-500);"></i></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Table Footer -->
          <div class="table-footer">
            <span>Showing 1–5 of 8 exams</span>
            <div class="pagination">
              <button class="page-btn" disabled><i class="ti ti-chevron-left" style="font-size:12px;"></i></button>
              <button class="page-btn active">1</button>
              <button class="page-btn">2</button>
              <button class="page-btn"><i class="ti ti-chevron-right" style="font-size:12px;"></i></button>
            </div>
          </div>
        </div>

        <!-- Right: Side Panel -->
        <div style="display:flex;flex-direction:column;gap:16px;">

          <!-- Upcoming Schedules -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="ti ti-calendar-event"></i> Upcoming Exams</div>
              <span class="card-action">View all</span>
            </div>
            <div class="schedule-list">
              <div class="schedule-item">
                <div class="schedule-date">
                  <div class="day">10</div>
                  <div class="month">Jun</div>
                </div>
                <div class="schedule-divider"></div>
                <div class="schedule-info">
                  <div class="schedule-name">UCS301 Mid-Semester</div>
                  <div class="schedule-meta">
                    <span class="schedule-meta-item"><i class="ti ti-clock"></i> 10:00 – 12:00</span>
                    <span class="schedule-meta-item"><i class="ti ti-users"></i> 48 students</span>
                  </div>
                </div>
                <span class="session-live-badge" style="font-size:10px;padding:2px 7px;">
                  <div class="live-dot"></div> LIVE
                </span>
              </div>
              <div class="schedule-item">
                <div class="schedule-date">
                  <div class="day">18</div>
                  <div class="month">Jun</div>
                </div>
                <div class="schedule-divider"></div>
                <div class="schedule-info">
                  <div class="schedule-name">UCS415 End Semester</div>
                  <div class="schedule-meta">
                    <span class="schedule-meta-item"><i class="ti ti-clock"></i> 09:00 – 12:00</span>
                    <span class="schedule-meta-item"><i class="ti ti-users"></i> 62 students</span>
                  </div>
                </div>
                <span class="badge badge-published" style="font-size:10px;">Soon</span>
              </div>
              <div class="schedule-item">
                <div class="schedule-date">
                  <div class="day">25</div>
                  <div class="month">Jun</div>
                </div>
                <div class="schedule-divider"></div>
                <div class="schedule-info">
                  <div class="schedule-name">UCS501 Mid-Semester</div>
                  <div class="schedule-meta">
                    <span class="schedule-meta-item"><i class="ti ti-clock"></i> 14:00 – 16:00</span>
                    <span class="schedule-meta-item"><i class="ti ti-users"></i> 55 students</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Grading Queue -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="ti ti-writing"></i> Grading Queue</div>
              <span style="background:var(--c-warning-100);color:var(--c-warning-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:var(--radius-sm);">5 pending</span>
            </div>
            <div>
              <div class="grading-item">
                <div class="grading-course-badge">UCS301</div>
                <div class="grading-info">
                  <div class="grading-name">Mid-Semester · Q45 (Long Answer)</div>
                  <div class="grading-count">28 ungraded responses</div>
                </div>
                <div class="grading-action">
                  <button class="btn btn-sm btn-secondary">Grade</button>
                </div>
              </div>
              <div class="grading-item">
                <div class="grading-course-badge">UCS415</div>
                <div class="grading-info">
                  <div class="grading-name">Quiz 2 · Q8 (Short Answer)</div>
                  <div class="grading-count">14 ungraded responses</div>
                </div>
                <div class="grading-action">
                  <button class="btn btn-sm btn-secondary">Grade</button>
                </div>
              </div>
              <div class="grading-item">
                <div class="grading-course-badge">UCS501</div>
                <div class="grading-info">
                  <div class="grading-name">Quiz 1 · Q3 (Short Answer)</div>
                  <div class="grading-count">11 ungraded responses</div>
                </div>
                <div class="grading-action">
                  <button class="btn btn-sm btn-secondary">Grade</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Bottom Row: Analytics + Re-evaluations + Activity -->
      <div style="display:grid;grid-template-columns:1fr 1fr 320px;gap:20px;">

        <!-- Pass Rate Analytics -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-chart-bar"></i> Pass Rates by Exam</div>
            <span class="card-action">Details</span>
          </div>
          <div style="padding:16px 20px;">
            <div class="progress-row">
              <div class="progress-label">UCS301 Mid-Sem</div>
              <div class="progress-bar-wrap"><div class="progress-bar" style="width:78%;background:var(--c-success-500);"></div></div>
              <div class="progress-val">78%</div>
            </div>
            <div class="progress-row">
              <div class="progress-label">UCS415 End-Sem</div>
              <div class="progress-bar-wrap"><div class="progress-bar" style="width:65%;background:var(--c-warning-500);"></div></div>
              <div class="progress-val">65%</div>
            </div>
            <div class="progress-row">
              <div class="progress-label">UCS301 Quiz 2</div>
              <div class="progress-bar-wrap"><div class="progress-bar" style="width:91%;background:var(--c-success-500);"></div></div>
              <div class="progress-val">91%</div>
            </div>
            <div class="progress-row">
              <div class="progress-label">UCS501 Quiz 1</div>
              <div class="progress-bar-wrap"><div class="progress-bar" style="width:54%;background:var(--c-danger-500);"></div></div>
              <div class="progress-val">54%</div>
            </div>
            <div class="progress-row">
              <div class="progress-label">UCS415 Quiz 3</div>
              <div class="progress-bar-wrap"><div class="progress-bar" style="width:83%;background:var(--c-success-500);"></div></div>
              <div class="progress-val">83%</div>
            </div>
          </div>
          <div style="padding:10px 20px;border-top:1px solid var(--c-border);display:flex;gap:16px;font-size:12px;color:var(--c-gray-600);">
            <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--c-success-500);display:inline-block;"></span>≥70% Good</span>
            <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--c-warning-500);display:inline-block;"></span>50–70% Avg</span>
            <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--c-danger-500);display:inline-block;"></span>&lt;50% Low</span>
          </div>
        </div>

        <!-- Re-evaluations -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-refresh-alert"></i> Re-evaluation Requests</div>
            <span style="background:var(--c-danger-100);color:var(--c-danger-700);font-size:11px;font-weight:600;padding:2px 8px;border-radius:var(--radius-sm);">3 pending</span>
          </div>
          <div>
            <div class="re-eval-item">
              <div>
                <div class="re-eval-student">Priya Sharma · 102417042</div>
                <div class="re-eval-meta">UCS301 Mid-Semester · Score: 36/100</div>
              </div>
              <div class="re-eval-reason" style="font-size:12px;color:var(--c-gray-600);margin-left:8px;">"Q14 answer marked incorrect..."</div>
              <span class="badge badge-pending" style="flex-shrink:0;margin-left:8px;">Pending</span>
            </div>
            <div class="re-eval-item">
              <div>
                <div class="re-eval-student">Arjun Mehta · 102417019</div>
                <div class="re-eval-meta">UCS415 End-Semester · Score: 42/100</div>
              </div>
              <div class="re-eval-reason" style="font-size:12px;color:var(--c-gray-600);margin-left:8px;">"Long answer not evaluated..."</div>
              <span class="badge badge-pending" style="flex-shrink:0;margin-left:8px;">Pending</span>
            </div>
            <div class="re-eval-item">
              <div>
                <div class="re-eval-student">Sneha Kapoor · 102417055</div>
                <div class="re-eval-meta">UCS501 Quiz 2 · Score: 8/25</div>
              </div>
              <div class="re-eval-reason" style="font-size:12px;color:var(--c-gray-600);margin-left:8px;">"Auto-submit before I could..."</div>
              <span class="badge badge-pending" style="flex-shrink:0;margin-left:8px;">Pending</span>
            </div>
          </div>
          <div style="padding:10px 20px;border-top:1px solid var(--c-border);text-align:center;">
            <button class="btn btn-sm btn-secondary" style="width:100%;">
              <i class="ti ti-list-check"></i> Review All Requests
            </button>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-activity"></i> Recent Activity</div>
          </div>
          <div class="activity-list">
            <div class="activity-item">
              <div class="activity-icon green"><i class="ti ti-circle-check"></i></div>
              <div class="activity-body">
                <div class="activity-text">Exam <strong>COE315 End Sem</strong> published</div>
                <div class="activity-time">2 hours ago</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon blue"><i class="ti ti-file-plus"></i></div>
              <div class="activity-body">
                <div class="activity-text">Added <strong>12 new questions</strong> to UCS301 bank</div>
                <div class="activity-time">Yesterday, 3:40 PM</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon amber"><i class="ti ti-calendar-plus"></i></div>
              <div class="activity-body">
                <div class="activity-text">Scheduled <strong>UCS501 Mid-Sem</strong> for Jun 25</div>
                <div class="activity-time">Yesterday, 11:00 AM</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon green"><i class="ti ti-writing"></i></div>
              <div class="activity-body">
                <div class="activity-text">Graded 14 responses for <strong>UCS415 Quiz 2</strong></div>
                <div class="activity-time">2 days ago</div>
              </div>
            </div>
            <div class="activity-item">
              <div class="activity-icon red"><i class="ti ti-refresh-alert"></i></div>
              <div class="activity-body">
                <div class="activity-text">Re-evaluation resolved for <strong>Rohan Singh</strong></div>
                <div class="activity-time">3 days ago</div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </main>
  </div>
</div>`;

const script = `function switchTab(el, page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
}

function switchExamTab(el, tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

let notifOpen = false;
function toggleNotif() {
  notifOpen = !notifOpen;
  document.getElementById('notif-panel').classList.toggle('open', notifOpen);
  document.querySelector('.dropdown-overlay').classList.toggle('open', notifOpen);
}
function closeNotif() {
  notifOpen = false;
  document.getElementById('notif-panel').classList.remove('open');
  document.querySelector('.dropdown-overlay').classList.remove('open');
}

// Live timer update
function updateTimer() {
  const els = document.querySelectorAll('.session-banner-sub');
  // decorative only in prototype
}`;

export default function Dashboard() {
  return <LegacyPage css={css} html={html} script={script} />;
}
