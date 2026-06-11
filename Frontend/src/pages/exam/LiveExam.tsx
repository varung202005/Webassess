import LegacyPage from "../../components/LegacyPage";

const css = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: var(--font); font-size: 14px; color: var(--c-gray-800); background: #F0F2F5; -webkit-font-smoothing: antialiased; }
button { font-family: var(--font); cursor: pointer; border: none; background: none; }

/* ─── EXAM SHELL ─────────────────────────────── */
.exam-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* ─── EXAM HEADER ────────────────────────────── */
.exam-header {
  height: var(--exam-header);
  background: var(--c-gray-900);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  flex-shrink: 0;
  border-bottom: 2px solid var(--c-primary-700);
  position: relative;
  z-index: 50;
}
.exam-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.exam-logo { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: -0.2px; opacity: 0.9; flex-shrink: 0; }
.exam-divider-v { width: 1px; height: 24px; background: rgba(255,255,255,0.15); flex-shrink: 0; }
.exam-title { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exam-course-chip { background: rgba(179,18,52,0.3); border: 1px solid rgba(179,18,52,0.5); color: #F5B8C4; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 3px; letter-spacing: 0.3px; flex-shrink: 0; }

.exam-header-center { flex: 1; display: flex; justify-content: center; }
.timer-block {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  padding: 6px 14px;
}
.timer-icon { font-size: 16px; color: rgba(255,255,255,0.5); }
.timer-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; }
.timer-value { font-family: var(--font-mono); font-size: 22px; font-weight: 600; color: #fff; letter-spacing: 1px; min-width: 90px; text-align: center; }
.timer-value.warning { color: var(--c-warning-500); }
.timer-value.danger { color: #FF6B6B; animation: timerPulse 1s ease-in-out infinite; }
@keyframes timerPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

.exam-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.status-indicator { display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 500; color: rgba(255,255,255,0.55); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.status-dot.green { background: #34D399; box-shadow: 0 0 0 2px rgba(52,211,153,0.25); animation: statusPulse 2s infinite; }
.status-dot.amber { background: var(--c-warning-500); }
.status-dot.red { background: var(--c-danger-500); }
@keyframes statusPulse { 0%,100% { box-shadow: 0 0 0 2px rgba(52,211,153,0.25); } 50% { box-shadow: 0 0 0 4px rgba(52,211,153,0.08); } }
.status-sep { width: 1px; height: 14px; background: rgba(255,255,255,0.12); }

/* ─── MAIN BODY ──────────────────────────────── */
.exam-body { flex: 1; display: flex; overflow: hidden; }

/* ─── QUESTION AREA ──────────────────────────── */
.question-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Section tabs */
.section-tabs { background: #fff; border-bottom: 1px solid var(--c-gray-200); display: flex; align-items: center; padding: 0 24px; gap: 0; height: 42px; flex-shrink: 0; }
.section-tab { padding: 0 16px; height: 42px; display: flex; align-items: center; font-size: 12.5px; font-weight: 500; color: var(--c-gray-600); border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; }
.section-tab:hover { color: var(--c-gray-900); }
.section-tab.active { color: var(--c-primary-700); border-bottom-color: var(--c-primary-700); font-weight: 600; }
.section-tab-count { background: var(--c-gray-100); color: var(--c-gray-600); font-size: 10.5px; font-weight: 600; padding: 1px 6px; border-radius: 10px; margin-left: 6px; }
.section-tab.active .section-tab-count { background: var(--c-primary-100); color: var(--c-primary-700); }

/* Question scroll container */
.question-scroll { flex: 1; overflow-y: auto; padding: 28px 32px 20px; }

/* Question header row */
.q-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.q-num { font-size: 13px; font-weight: 600; color: var(--c-gray-600); }
.q-num span { color: var(--c-gray-400); }
.q-meta { display: flex; align-items: center; gap: 10px; }
.q-marks-badge { background: var(--c-primary-100); color: var(--c-primary-800); font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid #93C5FD; }
.q-negative-badge { background: var(--c-danger-100); color: #991B1B; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid #FCA5A5; }
.q-type-badge { background: var(--c-gray-100); color: var(--c-gray-700); font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: var(--radius-sm); text-transform: uppercase; letter-spacing: 0.3px; }

/* Question text */
.q-text { font-size: 16px; color: var(--c-gray-900); line-height: 1.65; font-weight: 500; margin-bottom: 24px; }
.q-text .q-instruction { font-size: 13px; color: var(--c-gray-600); font-weight: 400; font-style: italic; margin-bottom: 8px; }

/* MCQ Options */
.options-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px solid var(--c-gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
  background: #fff;
}
.option-item:hover { border-color: var(--c-primary-300, #F09BAB); background: var(--c-primary-50); }
.option-item.selected { border-color: var(--c-primary-600); background: var(--c-primary-50); }
.option-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--c-gray-300);
  flex-shrink: 0;
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.1s;
}
.option-item.selected .option-radio { border-color: var(--c-primary-600); }
.option-radio-inner { width: 8px; height: 8px; border-radius: 50%; background: var(--c-primary-600); display: none; }
.option-item.selected .option-radio-inner { display: block; }
.option-label {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  background: var(--c-gray-100);
  color: var(--c-gray-700);
  font-size: 11.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 0;
}
.option-item.selected .option-label { background: var(--c-primary-100); color: var(--c-primary-700); }
.option-text { font-size: 14.5px; color: var(--c-gray-800); line-height: 1.5; flex: 1; }
.option-item.selected .option-text { color: var(--c-gray-900); font-weight: 500; }

/* Action row */
.q-action-row { display: flex; align-items: center; gap: 10px; padding: 14px 0; border-top: 1px solid var(--c-gray-200); }
.btn-flag {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  border: 1.5px solid var(--c-gray-300);
  border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500;
  color: var(--c-gray-700);
  background: #fff;
  transition: all 0.12s;
}
.btn-flag:hover { border-color: var(--c-warning-500); color: var(--c-warning-700); background: var(--c-warning-100); }
.btn-flag.flagged { border-color: var(--c-warning-500); color: var(--c-warning-700); background: var(--c-warning-100); }
.btn-flag.flagged i { color: var(--c-warning-500); }
.btn-clear { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1.5px solid var(--c-gray-200); border-radius: var(--radius-md); font-size: 13px; font-weight: 500; color: var(--c-gray-600); background: #fff; }
.btn-clear:hover { background: var(--c-gray-100); }

/* Nav buttons */
.q-nav-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 32px; background: #fff; border-top: 1px solid var(--c-gray-200); flex-shrink: 0; gap: 12px; }
.btn-nav { display: inline-flex; align-items: center; gap: 8px; padding: 9px 20px; border: 1.5px solid var(--c-gray-300); border-radius: var(--radius-md); font-size: 14px; font-weight: 500; color: var(--c-gray-700); background: #fff; transition: all 0.12s; }
.btn-nav:hover:not(:disabled) { background: var(--c-gray-100); border-color: var(--c-gray-400); }
.btn-nav:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-nav-next { background: var(--c-primary-800); color: #fff; border-color: var(--c-primary-800); }
.btn-nav-next:hover:not(:disabled) { background: var(--c-primary-900, #0A2340); border-color: var(--c-primary-900, #0A2340); }
.btn-submit-exam { background: var(--c-primary-700); color: #fff; border: 1.5px solid var(--c-primary-700); display: inline-flex; align-items: center; gap: 8px; padding: 9px 22px; border-radius: var(--radius-md); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.12s; }
.btn-submit-exam:hover { background: var(--c-primary-800); }

/* ─── PALETTE PANEL ──────────────────────────── */
.palette-panel {
  width: var(--palette-w);
  background: #fff;
  border-left: 1px solid var(--c-gray-200);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}
.palette-header { padding: 14px 16px; border-bottom: 1px solid var(--c-gray-200); }
.palette-title { font-size: 12.5px; font-weight: 600; color: var(--c-gray-700); text-transform: uppercase; letter-spacing: 0.5px; }

.palette-legend { padding: 10px 14px; border-bottom: 1px solid var(--c-gray-200); display: flex; flex-direction: column; gap: 5px; }
.legend-row { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--c-gray-600); }
.legend-dot { width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
.legend-dot.not-visited { background: var(--pal-not-visited); border-color: var(--c-gray-300); }
.legend-dot.visited { background: var(--pal-visited); }
.legend-dot.answered { background: var(--pal-answered); }
.legend-dot.flagged { background: var(--pal-flagged); }
.legend-dot.flagged-ans { background: var(--pal-flagged-ans); }

.palette-scroll { flex: 1; overflow-y: auto; padding: 12px 14px; }
.palette-section-label { font-size: 10.5px; font-weight: 700; color: var(--c-gray-500); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.palette-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-bottom: 14px; }
.palette-btn {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid transparent;
  transition: transform 0.08s;
  position: relative;
}
.palette-btn:hover { transform: scale(1.08); }
.palette-btn.not-visited { background: var(--pal-not-visited); border-color: var(--c-gray-300); color: var(--c-gray-600); }
.palette-btn.visited { background: var(--pal-visited); border-color: var(--c-gray-400); color: var(--c-gray-700); }
.palette-btn.answered { background: var(--pal-answered); border-color: var(--c-primary-700); color: #fff; }
.palette-btn.flagged { background: var(--pal-flagged); border-color: #D97706; color: #fff; }
.palette-btn.flagged-ans { background: var(--pal-flagged-ans); border-color: var(--c-primary-800); color: #fff; }
.palette-btn.current { box-shadow: 0 0 0 2.5px var(--c-primary-600); }
.palette-btn.flagged .flag-mark, .palette-btn.flagged-ans .flag-mark { position: absolute; top: -3px; right: -3px; width: 8px; height: 8px; border-radius: 50%; background: #fff; border: 1.5px solid currentColor; display: block; }

/* Progress summary */
.palette-summary { padding: 12px 14px; border-top: 1px solid var(--c-gray-200); display: flex; flex-direction: column; gap: 4px; }
.summary-row { display: flex; justify-content: space-between; font-size: 12px; }
.summary-label { color: var(--c-gray-600); }
.summary-val { font-weight: 600; color: var(--c-gray-900); }
.progress-bar-outer { height: 6px; background: var(--c-gray-200); border-radius: 3px; overflow: hidden; margin-top: 6px; }
.progress-bar-inner { height: 100%; background: var(--c-primary-700); border-radius: 3px; transition: width 0.4s; }

.palette-submit-area { padding: 12px 14px; border-top: 1px solid var(--c-gray-200); }

/* ─── MODAL: Submit Confirmation ─────────────── */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 500; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal-box { background: #fff; border-radius: 8px; width: 420px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
.modal-header { padding: 18px 20px; border-bottom: 1px solid var(--c-gray-200); display: flex; align-items: center; gap: 10px; }
.modal-icon { width: 36px; height: 36px; border-radius: 50%; background: var(--c-warning-100); color: var(--c-warning-700); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.modal-title { font-size: 15px; font-weight: 700; color: var(--c-gray-900); }
.modal-body { padding: 20px; }
.modal-body p { font-size: 13.5px; color: var(--c-gray-700); line-height: 1.6; margin-bottom: 14px; }
.submit-summary { background: var(--c-gray-50); border: 1px solid var(--c-gray-200); border-radius: var(--radius-lg); padding: 14px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 4px; }
.submit-summary-item { font-size: 12.5px; }
.submit-summary-item .s-label { color: var(--c-gray-600); margin-bottom: 2px; }
.submit-summary-item .s-val { font-size: 18px; font-weight: 700; color: var(--c-gray-900); }
.s-val.green { color: var(--c-success-700); }
.s-val.amber { color: var(--c-warning-700); }
.s-val.red { color: #991B1B; }
.modal-footer { padding: 14px 20px; border-top: 1px solid var(--c-gray-200); display: flex; gap: 10px; justify-content: flex-end; }
.btn-modal-cancel { padding: 8px 18px; font-size: 13.5px; font-weight: 500; border: 1.5px solid var(--c-gray-300); border-radius: var(--radius-md); color: var(--c-gray-700); background: #fff; cursor: pointer; }
.btn-modal-cancel:hover { background: var(--c-gray-100); }
.btn-modal-confirm { padding: 8px 20px; font-size: 13.5px; font-weight: 600; border: none; border-radius: var(--radius-md); background: var(--c-primary-700); color: #fff; cursor: pointer; }
.btn-modal-confirm:hover { background: var(--c-primary-800); }

/* ─── TAB SWITCH WARNING BANNER ─────────────── */
.warning-banner {
  display: none;
  position: fixed;
  top: var(--exam-header);
  left: 0; right: 0;
  background: #FEF3C7;
  border-bottom: 2px solid var(--c-warning-500);
  padding: 10px 24px;
  z-index: 100;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--c-warning-700);
}
.warning-banner.open { display: flex; }
.warning-banner i { font-size: 18px; flex-shrink: 0; }
.warning-banner button { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--c-warning-700); border: 1px solid var(--c-warning-500); padding: 4px 10px; border-radius: var(--radius-sm); background: #fff; cursor: pointer; }

/* ─── AUTOSAVE TOAST ─────────────────────────── */
.autosave-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: var(--c-gray-900);
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 6px;
}
.autosave-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--c-gray-300); border-radius: 3px; }`;

const html = `<div class="exam-shell">

  <!-- ─── EXAM HEADER ─── -->
  <div class="exam-header">
    <div class="exam-header-left">
      <div class="exam-logo">EXAM.TIET</div>
      <div class="exam-divider-v"></div>
      <div class="exam-title">End Semester Examination — Computer Organization & Architecture</div>
      <span class="exam-course-chip">UCS415</span>
    </div>

    <div class="exam-header-center">
      <div class="timer-block" id="timer-block">
        <i class="ti ti-hourglass timer-icon"></i>
        <span class="timer-label">Time Left</span>
        <span class="timer-value" id="timer-display">02:47:38</span>
      </div>
    </div>

    <div class="exam-header-right">
      <div class="status-indicator" id="face-status">
        <div class="status-dot green"></div>
        Face OK
      </div>
      <div class="status-sep"></div>
      <div class="status-indicator" id="fullscreen-status">
        <div class="status-dot green"></div>
        Fullscreen
      </div>
      <div class="status-sep"></div>
      <div class="status-indicator" id="save-status">
        <div class="status-dot green"></div>
        Saved
      </div>
      <div class="status-sep"></div>
      <div class="status-indicator" id="conn-status">
        <div class="status-dot green"></div>
        Online
      </div>
    </div>
  </div>

  <!-- ─── TAB SWITCH BANNER ─── -->
  <div class="warning-banner" id="tab-warning">
    <i class="ti ti-alert-triangle"></i>
    <span><strong>Warning:</strong> Tab switch detected. This incident has been logged. Do not leave the exam window. <strong>2 of 3 allowed warnings used.</strong></span>
    <button onclick="closeWarning()">Dismiss</button>
  </div>

  <!-- ─── EXAM BODY ─── -->
  <div class="exam-body">

    <!-- Question Area -->
    <div class="question-area">

      <!-- Section Tabs -->
      <div class="section-tabs">
        <div class="section-tab active" onclick="switchSection(this)">
          Section A — MCQ
          <span class="section-tab-count">30 Qs</span>
        </div>
        <div class="section-tab" onclick="switchSection(this)">
          Section B — Short Answer
          <span class="section-tab-count">10 Qs</span>
        </div>
        <div class="section-tab" onclick="switchSection(this)">
          Section C — Long Answer
          <span class="section-tab-count">5 Qs</span>
        </div>
        <div style="flex:1;"></div>
        <div style="font-size:12px;color:var(--c-gray-500);align-self:center;padding:0 8px;">
          <i class="ti ti-device-floppy" style="font-size:13px;"></i> Auto-saves every 30s
        </div>
      </div>

      <!-- Question Scroll -->
      <div class="question-scroll">

        <!-- Q Header -->
        <div class="q-header">
          <div class="q-num">Question <strong style="color:var(--c-gray-900);">12</strong> <span>/ 30</span></div>
          <div class="q-meta">
            <span class="q-type-badge">MCQ</span>
            <span class="q-marks-badge"><i class="ti ti-plus" style="font-size:11px;"></i> 2 marks</span>
            <span class="q-negative-badge"><i class="ti ti-minus" style="font-size:11px;"></i> 0.5 negative</span>
          </div>
        </div>

        <!-- Question Text -->
        <div class="q-text">
          <div class="q-instruction">Select the single most appropriate answer.</div>
          In a pipelined processor, which of the following correctly describes the purpose of a <strong>hazard detection unit</strong>?
        </div>

        <!-- Options -->
        <div class="options-list" id="options-list">
          <label class="option-item" onclick="selectOption(this)">
            <div class="option-radio"><div class="option-radio-inner"></div></div>
            <div class="option-label">A</div>
            <div class="option-text">It increases the clock speed of the processor by reducing instruction fetch time.</div>
          </label>
          <label class="option-item selected" onclick="selectOption(this)">
            <div class="option-radio"><div class="option-radio-inner"></div></div>
            <div class="option-label">B</div>
            <div class="option-text">It detects conditions that would cause incorrect execution if pipeline stages continue without intervention, and stalls or flushes the pipeline accordingly.</div>
          </label>
          <label class="option-item" onclick="selectOption(this)">
            <div class="option-radio"><div class="option-radio-inner"></div></div>
            <div class="option-label">C</div>
            <div class="option-text">It is responsible for forwarding data between pipeline registers to eliminate structural hazards.</div>
          </label>
          <label class="option-item" onclick="selectOption(this)">
            <div class="option-radio"><div class="option-radio-inner"></div></div>
            <div class="option-label">D</div>
            <div class="option-text">It manages cache miss penalties by stalling only the memory access stage of the pipeline.</div>
          </label>
        </div>

        <!-- Flag + Clear row -->
        <div class="q-action-row">
          <button class="btn-flag flagged" id="flag-btn" onclick="toggleFlag()">
            <i class="ti ti-bookmark-filled"></i> Marked for Review
          </button>
          <button class="btn-clear" onclick="clearResponse()">
            <i class="ti ti-x" style="font-size:12px;"></i> Clear Response
          </button>
        </div>

      </div>

      <!-- Nav Row -->
      <div class="q-nav-row">
        <button class="btn-nav" onclick="goTo(11)">
          <i class="ti ti-chevron-left"></i> Previous
        </button>
        <div style="font-size:13px;color:var(--c-gray-500);">
          <span id="answered-count" style="font-weight:600;color:var(--c-gray-900);">18</span> answered ·
          <span id="flagged-count" style="font-weight:600;color:var(--c-warning-700);">4</span> flagged ·
          <span id="unanswered-count" style="font-weight:600;color:var(--c-gray-600);">23</span> not answered
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn-submit-exam" onclick="openSubmit()">
            <i class="ti ti-send"></i> Submit Exam
          </button>
          <button class="btn-nav btn-nav-next" onclick="goTo(13)">
            Next <i class="ti ti-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- ─── PALETTE PANEL ─── -->
    <div class="palette-panel">
      <div class="palette-header">
        <div class="palette-title">Question Navigator</div>
      </div>

      <!-- Legend -->
      <div class="palette-legend">
        <div class="legend-row"><div class="legend-dot not-visited"></div>Not visited</div>
        <div class="legend-row"><div class="legend-dot visited"></div>Visited, not answered</div>
        <div class="legend-row"><div class="legend-dot answered"></div>Answered</div>
        <div class="legend-row"><div class="legend-dot flagged"></div>Marked for review</div>
        <div class="legend-row"><div class="legend-dot flagged-ans"></div>Answered + flagged</div>
      </div>

      <!-- Palette Grid -->
      <div class="palette-scroll">
        <div class="palette-section-label">Section A — MCQ (30)</div>
        <div class="palette-grid" id="palette-grid">
          <!-- Generated by JS -->
        </div>

        <div class="palette-section-label">Section B — Short Answer (10)</div>
        <div class="palette-grid">
          <!-- Q31-40 -->
          <button class="palette-btn not-visited">31</button>
          <button class="palette-btn not-visited">32</button>
          <button class="palette-btn not-visited">33</button>
          <button class="palette-btn not-visited">34</button>
          <button class="palette-btn not-visited">35</button>
          <button class="palette-btn not-visited">36</button>
          <button class="palette-btn not-visited">37</button>
          <button class="palette-btn not-visited">38</button>
          <button class="palette-btn not-visited">39</button>
          <button class="palette-btn not-visited">40</button>
        </div>

        <div class="palette-section-label">Section C — Long Answer (5)</div>
        <div class="palette-grid">
          <button class="palette-btn not-visited">41</button>
          <button class="palette-btn not-visited">42</button>
          <button class="palette-btn not-visited">43</button>
          <button class="palette-btn not-visited">44</button>
          <button class="palette-btn not-visited">45</button>
        </div>
      </div>

      <!-- Progress Summary -->
      <div class="palette-summary">
        <div class="summary-row">
          <span class="summary-label">Answered</span>
          <span class="summary-val" style="color:var(--c-primary-700);">18 / 45</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Flagged</span>
          <span class="summary-val" style="color:var(--c-warning-700);">4</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Not Attempted</span>
          <span class="summary-val" style="color:var(--c-gray-600);">23</span>
        </div>
        <div class="progress-bar-outer">
          <div class="progress-bar-inner" style="width:40%;"></div>
        </div>
        <div style="font-size:11px;color:var(--c-gray-500);margin-top:3px;text-align:right;">40% complete</div>
      </div>

      <!-- Submit Button in Palette -->
      <div class="palette-submit-area">
        <button class="btn-submit-exam" style="width:100%;justify-content:center;font-size:13px;padding:10px;" onclick="openSubmit()">
          <i class="ti ti-send"></i> Submit Exam
        </button>
      </div>
    </div>

  </div>
</div>

<!-- ─── SUBMIT MODAL ─── -->
<div class="modal-overlay" id="submit-modal">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-icon"><i class="ti ti-alert-triangle"></i></div>
      <div>
        <div class="modal-title">Submit Examination?</div>
        <div style="font-size:12px;color:var(--c-gray-500);margin-top:2px;">This action cannot be undone.</div>
      </div>
    </div>
    <div class="modal-body">
      <p>Please review your attempt summary before submitting. Once submitted, you will not be able to modify any responses.</p>
      <div class="submit-summary">
        <div class="submit-summary-item">
          <div class="s-label">Total Questions</div>
          <div class="s-val">45</div>
        </div>
        <div class="submit-summary-item">
          <div class="s-label">Answered</div>
          <div class="s-val green">18</div>
        </div>
        <div class="submit-summary-item">
          <div class="s-label">Not Answered</div>
          <div class="s-val red">23</div>
        </div>
        <div class="submit-summary-item">
          <div class="s-label">Marked for Review</div>
          <div class="s-val amber">4</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-modal-cancel" onclick="closeSubmit()">Go Back & Review</button>
      <button class="btn-modal-confirm" onclick="submitExam()">
        <i class="ti ti-send" style="font-size:13px;margin-right:4px;"></i> Confirm Submit
      </button>
    </div>
  </div>
</div>

<!-- Autosave toast -->
<div class="autosave-toast" id="autosave-toast">
  <i class="ti ti-device-floppy"></i> Response auto-saved
</div>`;

const script = `// ── Question states for palette (30 questions in sec A) ──
const qStates = {};
const answeredQs  = [1,2,3,4,5,6,7,9,10,11,13,15,16,17,18,19,20,22];
const flaggedQs   = [6,12,14,21];
const flagAnsQs   = [6];
const visitedQs   = [8,23,24];

// current Q = 12
const CURRENT_Q = 12;

function buildPalette() {
  const grid = document.getElementById('palette-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= 30; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = 'palette-btn';
    if (i === CURRENT_Q) {
      btn.classList.add(answeredQs.includes(i) ? 'flagged-ans' : 'flagged');
      btn.classList.add('current');
    } else if (flagAnsQs.includes(i)) {
      btn.classList.add('flagged-ans');
      const mark = document.createElement('span'); mark.className = 'flag-mark';
      btn.appendChild(mark);
    } else if (flaggedQs.includes(i)) {
      btn.classList.add('flagged');
      const mark = document.createElement('span'); mark.className = 'flag-mark';
      btn.appendChild(mark);
    } else if (answeredQs.includes(i)) {
      btn.classList.add('answered');
    } else if (visitedQs.includes(i)) {
      btn.classList.add('visited');
    } else {
      btn.classList.add('not-visited');
    }
    btn.onclick = () => goTo(i);
    grid.appendChild(btn);
  }
}
buildPalette();

// ── Timer ──
let totalSecs = 2 * 3600 + 47 * 60 + 38;
const timerEl = document.getElementById('timer-display');
function updateTimer() {
  if (totalSecs <= 0) { timerEl.textContent = '00:00:00'; return; }
  totalSecs--;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  timerEl.textContent = \`\${String(h).padStart(2,'0')}:\${String(m).padStart(2,'0')}:\${String(s).padStart(2,'0')}\`;
  if (totalSecs < 300) { timerEl.className = 'timer-value danger'; }
  else if (totalSecs < 1800) { timerEl.className = 'timer-value warning'; }
}
setInterval(updateTimer, 1000);

// ── Option selection ──
function selectOption(el) {
  document.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  showAutosave();
}

// ── Flag ──
let isFlagged = true;
function toggleFlag() {
  isFlagged = !isFlagged;
  const btn = document.getElementById('flag-btn');
  if (isFlagged) {
    btn.className = 'btn-flag flagged';
    btn.innerHTML = '<i class="ti ti-bookmark-filled"></i> Marked for Review';
  } else {
    btn.className = 'btn-flag';
    btn.innerHTML = '<i class="ti ti-bookmark"></i> Mark for Review';
  }
}

function clearResponse() {
  document.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
  showAutosave();
}

// ── Navigation ──
function goTo(q) {
  // In production: save answer, load question q
  console.log('Navigate to Q' + q);
}
function switchSection(el) {
  document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ── Submit modal ──
function openSubmit() { document.getElementById('submit-modal').classList.add('open'); }
function closeSubmit() { document.getElementById('submit-modal').classList.remove('open'); }
function submitExam() {
  closeSubmit();
  // In production: POST /exam-attempts/submit
  document.body.innerHTML = \`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#F7F8FA;gap:16px;font-family:'Inter',sans-serif;">
      <div style="width:64px;height:64px;border-radius:50%;background:#D1FAE5;display:flex;align-items:center;justify-content:center;font-size:32px;color:#065F46;">✓</div>
      <div style="font-size:22px;font-weight:700;color:#1A1A2E;">Exam Submitted Successfully</div>
      <div style="font-size:14px;color:#6B6B7B;">Your responses have been recorded. Results will be published by the faculty.</div>
      <div style="font-size:13px;color:#9CA3AF;">UCS415 — End Semester Examination · Submitted at \${new Date().toLocaleTimeString()}</div>
    </div>\`;
}

// ── Tab switch simulation ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    document.getElementById('tab-warning').classList.add('open');
  }
});
function closeWarning() {
  document.getElementById('tab-warning').classList.remove('open');
}

// ── Auto-save toast ──
function showAutosave() {
  const t = document.getElementById('autosave-toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
// Auto-save every 30s
setInterval(() => {
  document.getElementById('save-status').innerHTML = '<div class="status-dot amber"></div>Saving…';
  setTimeout(() => {
    document.getElementById('save-status').innerHTML = '<div class="status-dot green"></div>Saved';
    showAutosave();
  }, 800);
}, 30000);`;

export default function LiveExam() {
  return <LegacyPage css={css} html={html} script={script} />;
}
