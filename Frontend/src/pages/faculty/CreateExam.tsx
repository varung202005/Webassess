/**
 * CreateExam.tsx
 *
 * 5-step wizard:
 *   Step 1 — Exam Info
 *   Step 2 — Questions
 *   Step 3 — Rules
 *   Step 4 — Schedule  (start / end time, registration deadline — mandatory)
 *   Step 5 — Preview & Create
 *
 * On submit:
 *   1. POST /api/v1/exams          → status: "DRAFT"
 *   2. POST /api/v1/questions link  (per selected question)
 *   3. POST /api/v1/exam-rules
 *   4. POST /api/v1/exam-schedules → is_published: false, times from Step 4
 *
 * Publishing happens ONLY from the Dashboard Publish button — this wizard
 * never sets status: "PUBLISHED" or is_published: true.
 *
 * Drop this file at:  src/pages/faculty/CreateExam.tsx
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState } from "../../features/faculty/components";
import { useFacultyDashboard, useQuestions, QUERY_KEYS } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import type { Question } from "../../features/faculty/types";
import CandidateManager from "./CandidateManager";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "info",      label: "Exam Info",   icon: "ti-info-circle"  },
  { id: "questions", label: "Questions",   icon: "ti-list-check"   },
  { id: "rules",     label: "Rules",       icon: "ti-shield-check" },
  { id: "schedule",  label: "Schedule",    icon: "ti-calendar-event" },
  { id: "preview",   label: "Preview",     icon: "ti-eye"          },
];

const DRAFT_STORAGE_KEY = "exam_portal_drafts_v1";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type QuestionType = "MCQ" | "MSQ" | "TRUE_FALSE";
type Difficulty   = "EASY" | "MEDIUM" | "HARD";
type ImportStatus = "idle" | "uploading" | "extracting" | "review" | "saving";

interface ExtractedQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: { text: string; is_correct: boolean }[];
  marks: number;
  difficulty: Difficulty;
  confidence: number;
  needs_review: boolean;
  approved: boolean;
}

interface ExamForm {
  title: string;
  course_id: string;
  exam_type: string;
  duration_minutes: number;
  total_marks: number;
  pass_marks: number;
  instructions: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
}

interface ScheduleForm {
  start_time: string;
  end_time: string;
  registration_deadline: string;
}

interface NewQuestion {
  question_type: QuestionType;
  question_text: string;
  marks: number;
  negative_marks: number;
  difficulty: Difficulty;
  options: { option_text: string; is_correct: boolean; order_index: number }[];
}

interface ExamDraft {
  draftId: string;
  savedAt: string;
  currentStep: number;
  form: ExamForm;
  rules: ExamRules;
  schedule: ScheduleForm;
  selectedQuestionIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Timezone helper
// Converts a datetime-local string (entered by user in IST) to UTC ISO string.
// The datetime-local input gives "YYYY-MM-DDTHH:mm" with no timezone.
// We treat it as IST (+05:30) and convert to UTC before sending to the backend.
// ─────────────────────────────────────────────────────────────────────────────

function toUTCString(localStr: string): string {
  if (!localStr) return localStr;
  return new Date(`${localStr}+05:30`).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadDrafts(): ExamDraft[] {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveDrafts(drafts: ExamDraft[]) {
  try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts)); } catch {}
}
function upsertDraft(draft: ExamDraft) {
  const drafts = loadDrafts();
  const idx = drafts.findIndex((d) => d.draftId === draft.draftId);
  if (idx >= 0) drafts[idx] = draft; else drafts.unshift(draft);
  saveDrafts(drafts);
}
function deleteDraft(draftId: string) {
  saveDrafts(loadDrafts().filter((d) => d.draftId !== draftId));
}
function newDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default state factories
// ─────────────────────────────────────────────────────────────────────────────

const defaultForm = (): ExamForm => ({
  title: "",
  course_id: "",
  exam_type: "MID_SEMESTER",
  duration_minutes: 120,
  total_marks: 80,
  pass_marks: 32,
  instructions: "",
  shuffle_questions: false,
  shuffle_options: false,
});

const defaultRules = () => ({
  allow_backtrack: true,
  mark_for_review: true,
  fullscreen_required: false,
  proctoring_enabled: false,
  camera_required: false,
  microphone_required: false,
  max_tab_switches: 3,
  auto_save_interval_sec: 30,
});

type ExamRules = ReturnType<typeof defaultRules>;

const defaultSchedule = (): ScheduleForm => ({
  start_time: "",
  end_time: "",
  registration_deadline: "",
});

// ─────────────────────────────────────────────────────────────────────────────
// StatCard + RepositoryOverview
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color = "#8b1a1a" }: {
  label: string; value: number | string; icon: string; color?: string;
}) {
  return (
    <div className="repo-stat-card">
      <div className="repo-stat-icon" style={{ background: `${color}15`, color }}>
        <i className={`ti ${icon}`} />
      </div>
      <div className="repo-stat-body">
        <div className="repo-stat-value">{value}</div>
        <div className="repo-stat-label">{label}</div>
      </div>
    </div>
  );
}

function RepositoryOverview({ portal }: {
  portal: ReturnType<typeof useFacultyDashboard>["data"];
}) {
  const qs = portal?.questionStats;
  const byType = qs?.byType ?? {};
  return (
    <div className="repo-overview">
      <div className="repo-overview-header">
        <h2 className="section-title"><i className="ti ti-database" /> Question Repository</h2>
        <span className="section-sub">Your personal question bank — reuse across exams</span>
      </div>
      <div className="repo-stats-grid">
        <StatCard label="Total Questions" value={qs?.total         ?? 0} icon="ti-books"        color="#8b1a1a" />
        <StatCard label="MCQ"             value={byType.MCQ        ?? 0} icon="ti-circle-dot"   color="#2563eb" />
        <StatCard label="MSQ"             value={byType.MSQ        ?? 0} icon="ti-checkbox"     color="#7c3aed" />
        <StatCard label="True / False"    value={byType.TRUE_FALSE ?? 0} icon="ti-toggle-left"  color="#059669" />
        <StatCard label="Active"          value={qs?.active        ?? 0} icon="ti-circle-check" color="#d97706" />
        <StatCard label="Courses Covered" value={portal?.courses?.length ?? 0} icon="ti-book"  color="#0891b2" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DraftsList
// ─────────────────────────────────────────────────────────────────────────────

function DraftsList({ activeDraftId, onResume, onDelete, onRefresh }: {
  activeDraftId: string;
  onResume: (draft: ExamDraft) => void;
  onDelete: (draftId: string) => void;
  onRefresh: () => void;
}) {
  const [drafts, setDrafts] = useState<ExamDraft[]>(() => loadDrafts());
  useEffect(() => { setDrafts(loadDrafts()); }, [activeDraftId]);

  const handleDelete = (draftId: string) => {
    deleteDraft(draftId);
    setDrafts(loadDrafts());
    onDelete(draftId);
    onRefresh();
  };

  const stepLabel = (d: ExamDraft) =>
    `Step ${d.currentStep + 1} of ${STEPS.length} · ${STEPS[d.currentStep]?.label ?? ""}`;

  if (drafts.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "60px 0" }}>
        <i className="ti ti-file-off" style={{ fontSize: 40, color: "#ccc" }} />
        <div className="empty-state-title" style={{ marginTop: 12 }}>No saved drafts</div>
        <div className="empty-state-text">Start creating an exam — it will auto-save here as you go.</div>
      </div>
    );
  }

  return (
    <div className="drafts-list-tab">
      {drafts.map((d) => {
        const isActive = d.draftId === activeDraftId;
        return (
          <div key={d.draftId} className={`draft-row ${isActive ? "draft-row-active" : ""}`}>
            <div className="draft-row-icon"><i className="ti ti-file-text" /></div>
            <div className="draft-row-body">
              <div className="draft-row-title">
                {d.form.title?.trim() || <em style={{ color: "#aaa" }}>Untitled exam</em>}
                {isActive && <span className="draft-active-badge">Editing now</span>}
              </div>
              <div className="draft-row-meta">
                <span><i className="ti ti-list-numbers" /> {stepLabel(d)}</span>
                <span><i className="ti ti-clock" /> {new Date(d.savedAt).toLocaleString()}</span>
                {d.selectedQuestionIds.length > 0 && (
                  <span><i className="ti ti-books" /> {d.selectedQuestionIds.length} question{d.selectedQuestionIds.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <div className="draft-row-right">
              <div className="draft-progress-wrap">
                <div className="draft-progress-bar">
                  <div className="draft-progress-fill" style={{ width: `${((d.currentStep + 1) / STEPS.length) * 100}%` }} />
                </div>
                <span className="draft-progress-label">{Math.round(((d.currentStep + 1) / STEPS.length) * 100)}%</span>
              </div>
              <div className="draft-row-actions">
                <button className="btn btn-sm btn-primary" onClick={() => onResume(d)} type="button" disabled={isActive}>
                  <i className="ti ti-player-play" />{isActive ? "In progress" : "Resume"}
                </button>
                <button className="btn btn-sm btn-ghost draft-delete-btn" onClick={() => handleDelete(d.draftId)} type="button" title="Delete draft">
                  <i className="ti ti-trash" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({ steps, current, onStep }: {
  steps: typeof STEPS; current: number; onStep: (i: number) => void;
}) {
  return (
    <div className="exam-stepper">
      {steps.map((s, i) => (
        <div key={s.id} className={`stepper-item ${i === current ? "active" : ""} ${i < current ? "done" : ""}`}>
          <button className="stepper-btn" onClick={() => i < current && onStep(i)} disabled={i > current}>
            <div className="stepper-circle">
              {i < current ? <i className="ti ti-check" /> : <span>{i + 1}</span>}
            </div>
            <span className="stepper-label">{s.label}</span>
          </button>
          {i < steps.length - 1 && <div className="stepper-line" />}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Exam Info
// ─────────────────────────────────────────────────────────────────────────────

function StepExamInfo({ form, onChange }: {
  form: ExamForm; onChange: (f: Partial<ExamForm>) => void;
}) {
  return (
    <div className="step-panel">
      <div className="step-header">
        <h3>Basic Exam Information</h3>
        <p>Configure the core details of your exam. All fields marked * are required.</p>
      </div>
      <div className="form-grid-1col">
        <div className="form-field">
          <label>Exam Title *</label>
          <input className="form-input" placeholder="e.g. Data Structures Mid Semester 2025"
            value={form.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
      </div>
      <div className="form-grid-2col">
        <div className="form-field">
          <label>Exam Type</label>
          <select className="form-select" value={form.exam_type} onChange={(e) => onChange({ exam_type: e.target.value })}>
            {["MID_SEMESTER","END_SEMESTER","QUIZ","ASSIGNMENT","PRACTICE","PLACEMENT","ENTRANCE"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Duration (minutes) *</label>
          <input type="number" className="form-input" min={10} max={360} value={form.duration_minutes}
            onChange={(e) => onChange({ duration_minutes: +e.target.value })} />
        </div>
        <div className="form-field">
          <label>Total Marks *</label>
          <input type="number" className="form-input" min={1} value={form.total_marks}
            onChange={(e) => onChange({ total_marks: +e.target.value })} />
        </div>
        <div className="form-field">
          <label>Pass Marks *</label>
          <input type="number" className="form-input" min={1} value={form.pass_marks}
            onChange={(e) => onChange({ pass_marks: +e.target.value })} />
        </div>
        <div className="form-field">
          <label>&nbsp;</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.shuffle_questions}
                onChange={(e) => onChange({ shuffle_questions: e.target.checked })} />
              Shuffle Questions
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.shuffle_options}
                onChange={(e) => onChange({ shuffle_options: e.target.checked })} />
              Shuffle Options
            </label>
          </div>
        </div>
      </div>
      <div className="form-field">
        <label>Instructions for Students</label>
        <textarea className="form-textarea" rows={4}
          placeholder="e.g. All questions are compulsory. Each MCQ carries 1 mark…"
          value={form.instructions} onChange={(e) => onChange({ instructions: e.target.value })} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionRow
// ─────────────────────────────────────────────────────────────────────────────

function QuestionRow({ q, selected, onToggle }: {
  q: Question; selected: boolean; onToggle: () => void;
}) {
  const typeColor: Record<string, string> = { MCQ: "#2563eb", MSQ: "#7c3aed", TRUE_FALSE: "#059669" };
  const diffColor: Record<string, string> = { EASY: "#059669", MEDIUM: "#d97706", HARD: "#dc2626" };
  return (
    <div className={`q-row ${selected ? "q-row-selected" : ""}`} onClick={onToggle}>
      <div className="q-row-check">
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={(e) => e.stopPropagation()} />
      </div>
      <div className="q-row-body">
        <div className="q-row-text">{q.question_text.slice(0, 120)}{q.question_text.length > 120 ? "…" : ""}</div>
        <div className="q-row-meta">
          <span className="q-badge" style={{ background: `${typeColor[q.question_type]}18`, color: typeColor[q.question_type] }}>{q.question_type}</span>
          <span className="q-badge" style={{ background: `${diffColor[q.difficulty]}18`, color: diffColor[q.difficulty] }}>{q.difficulty}</span>
          <span className="q-badge">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
          {q.courses && <span className="q-badge q-badge-course">{q.courses.code ?? q.courses.name}</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateQuestionForm
// ─────────────────────────────────────────────────────────────────────────────

function CreateQuestionForm({ courseId, onSaved }: {
  courseId: string; onSaved: (q: Question) => void;
}) {
  const [form, setForm] = useState<NewQuestion>({
    question_type: "MCQ", question_text: "", marks: 1, negative_marks: 0, difficulty: "MEDIUM",
    options: [
      { option_text: "", is_correct: false, order_index: 0 },
      { option_text: "", is_correct: false, order_index: 1 },
      { option_text: "", is_correct: false, order_index: 2 },
      { option_text: "", is_correct: false, order_index: 3 },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setType = (qt: QuestionType) => {
    if (qt === "TRUE_FALSE") {
      setForm((f) => ({ ...f, question_type: qt, options: [
        { option_text: "True", is_correct: false, order_index: 0 },
        { option_text: "False", is_correct: false, order_index: 1 },
      ]}));
    } else {
      setForm((f) => ({ ...f, question_type: qt, options: f.options.length < 4
        ? [...f.options, ...Array(4 - f.options.length).fill(null).map((_, i) => ({ option_text: "", is_correct: false, order_index: f.options.length + i }))]
        : f.options }));
    }
  };

  const toggleCorrect = (idx: number) => {
    setForm((f) => ({ ...f, options: f.options.map((o, i) => ({
      ...o, is_correct: f.question_type === "MSQ" ? (i === idx ? !o.is_correct : o.is_correct) : i === idx,
    }))}));
  };

  const save = async () => {
    if (!form.question_text.trim()) return setError("Question text is required.");
    if (!form.options.some((o) => o.is_correct)) return setError("Mark at least one correct answer.");
    setSaving(true); setError("");
    try {
      const res = await facultyApi.createQuestion({
        course_id: courseId || null, question_type: form.question_type, question_text: form.question_text,
        marks: form.marks, negative_marks: form.negative_marks, difficulty: form.difficulty,
        options: form.options.filter((o) => o.option_text.trim()), topics: [],
      });
      const full = await facultyApi.getQuestion(res.question_id);
      onSaved(full);
      setForm({ question_type: "MCQ", question_text: "", marks: 1, negative_marks: 0, difficulty: "MEDIUM",
        options: [
          { option_text: "", is_correct: false, order_index: 0 },
          { option_text: "", is_correct: false, order_index: 1 },
          { option_text: "", is_correct: false, order_index: 2 },
          { option_text: "", is_correct: false, order_index: 3 },
        ]});
    } catch (e: any) {
      setError(e?.message ?? "Failed to save question");
    } finally { setSaving(false); }
  };

  return (
    <div className="create-q-form">
      <div className="form-grid-3col">
        <div className="form-field">
          <label>Question Type</label>
          <select className="form-select" value={form.question_type} onChange={(e) => setType(e.target.value as QuestionType)}>
            <option value="MCQ">MCQ (Single correct)</option>
            <option value="MSQ">MSQ (Multiple correct)</option>
            <option value="TRUE_FALSE">True / False</option>
          </select>
        </div>
        <div className="form-field">
          <label>Marks</label>
          <input type="number" className="form-input" min={1} max={100} value={form.marks}
            onChange={(e) => setForm((f) => ({ ...f, marks: +e.target.value }))} />
        </div>
        <div className="form-field">
          <label>Negative Marks</label>
          <input type="number" className="form-input" min={0} step={0.25} value={form.negative_marks}
            onChange={(e) => setForm((f) => ({ ...f, negative_marks: +e.target.value }))} />
        </div>
      </div>
      <div className="form-field">
        <label>Question Text *</label>
        <textarea className="form-textarea" rows={3} placeholder="Enter your question here…"
          value={form.question_text} onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))} />
      </div>
      <div className="options-grid">
        <label className="form-label-sm">Answer Options (click circle/checkbox to mark correct)</label>
        {form.options.map((opt, idx) => (
          <div key={idx} className={`option-row ${opt.is_correct ? "option-correct" : ""}`}>
            <button className={`option-marker ${opt.is_correct ? "correct" : ""}`} onClick={() => toggleCorrect(idx)} type="button">
              {form.question_type === "MSQ"
                ? <i className={`ti ${opt.is_correct ? "ti-checkbox" : "ti-square"}`} />
                : <i className={`ti ${opt.is_correct ? "ti-circle-filled" : "ti-circle"}`} />}
            </button>
            <input className="form-input option-input" placeholder={`Option ${String.fromCharCode(65 + idx)}`}
              value={opt.option_text} readOnly={form.question_type === "TRUE_FALSE"}
              onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, option_text: e.target.value } : o) }))} />
          </div>
        ))}
      </div>
      <div className="form-field">
        <label>Difficulty</label>
        <div className="difficulty-toggle">
          {(["EASY", "MEDIUM", "HARD"] as Difficulty[]).map((d) => (
            <button key={d} className={`diff-btn ${form.difficulty === d ? "active" : ""} diff-${d.toLowerCase()}`}
              onClick={() => setForm((f) => ({ ...f, difficulty: d }))} type="button">{d}</button>
          ))}
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><span className="spinner-sm" /> Saving…</> : <><i className="ti ti-plus" /> Add to Repository &amp; Exam</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PdfImportPanel
// ─────────────────────────────────────────────────────────────────────────────

function PdfImportPanel({ onImported }: { onImported: (qs: ExtractedQuestion[]) => void }) {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [extracted, setExtracted] = useState<ExtractedQuestion[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const confColor = (c: number) => c >= 85 ? "#059669" : c >= 70 ? "#d97706" : "#dc2626";

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) { setError("Only PDF and DOCX files are supported."); return; }
    setError(""); setStatus("uploading");
    try {
      setStatus("extracting");
      const result = await facultyApi.extractQuestionsFromFile(file);
      if (!result || result.length === 0) {
        setError("No questions could be extracted. Make sure questions are numbered (1., 2., …).");
        setStatus("idle"); return;
      }
      setExtracted(result.map((q) => ({ ...q, approved: false })));
      setStatus("review");
    } catch (e: any) {
      setError(e?.message ?? "Extraction failed. Please try again."); setStatus("idle");
    }
  }, []);

  const toggleApprove = (id: string) =>
    setExtracted((list) => list.map((q) => (q.id === id ? { ...q, approved: !q.approved } : q)));
  const approveAll = () => setExtracted((list) => list.map((q) => ({ ...q, approved: true })));
  const saveApproved = () => {
    const approved = extracted.filter((q) => q.approved);
    if (!approved.length) { setError("Approve at least one question first."); return; }
    setStatus("saving"); onImported(approved); setStatus("idle"); setExtracted([]); setError("");
  };
  const reset = () => { setStatus("idle"); setExtracted([]); setError(""); if (fileRef.current) fileRef.current.value = ""; };

  if (status === "idle") {
    return (
      <div className="import-dropzone" onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".pdf,.docx" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <i className="ti ti-file-upload import-drop-icon" />
        <div className="import-drop-title">Import Questions from PDF or DOCX</div>
        <div className="import-drop-sub">Supports Google Forms PDFs &amp; standard MCQ PDFs · Text-based PDFs only<br />Questions numbered 1., 2., … · Answers inferred via Groq AI when not in PDF</div>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        <button className="btn btn-secondary" type="button"><i className="ti ti-upload" /> Choose File</button>
      </div>
    );
  }
  if (status === "uploading" || status === "extracting") {
    return (
      <div className="import-processing">
        <span className="spinner" />
        <div className="import-proc-title">{status === "uploading" ? "Uploading file…" : "Extracting questions & inferring answers via Groq AI…"}</div>
        <div className="import-proc-sub">{status === "extracting" ? "Parsing PDF then asking Groq for correct answers — takes 5–10 seconds" : "Uploading…"}</div>
      </div>
    );
  }
  if (status === "saving") {
    return <div className="import-processing"><span className="spinner" /><div className="import-proc-title">Saving questions to repository…</div></div>;
  }
  if (status === "review") {
    const approvedCount = extracted.filter((q) => q.approved).length;
    const avgConf = extracted.length ? Math.round(extracted.reduce((s, q) => s + q.confidence, 0) / extracted.length) : 0;
    return (
      <div className="import-review">
        <div className="import-review-summary">
          <div className="import-summary-card"><span className="is-val">{extracted.length}</span><span className="is-lbl">Questions Found</span></div>
          <div className="import-summary-card"><span className="is-val">{extracted.filter((q) => q.question_type === "MCQ").length}</span><span className="is-lbl">MCQ</span></div>
          <div className="import-summary-card"><span className="is-val">{extracted.filter((q) => q.question_type === "MSQ").length}</span><span className="is-lbl">MSQ</span></div>
          <div className="import-summary-card"><span className="is-val">{extracted.filter((q) => q.question_type === "TRUE_FALSE").length}</span><span className="is-lbl">T/F</span></div>
          <div className="import-summary-card"><span className="is-val" style={{ color: confColor(avgConf) }}>{avgConf}%</span><span className="is-lbl">Avg Confidence</span></div>
          <div className="import-summary-card"><span className="is-val">{approvedCount}</span><span className="is-lbl">Approved</span></div>
        </div>
        <div className="import-table-wrap">
          <div className="import-table-actions">
            <button className="btn btn-sm btn-secondary" onClick={approveAll} type="button"><i className="ti ti-check-all" /> Approve All</button>
          </div>
          <table className="import-table">
            <thead><tr><th style={{ width: 36 }}></th><th>Question</th><th>Type</th><th>Marks</th><th>Correct Answer(s)</th><th>Confidence</th><th>Approve</th></tr></thead>
            <tbody>
              {extracted.map((q) => {
                const correctAnswers = q.options.filter((o) => o.is_correct).map((o) => o.text);
                return (
                  <tr key={q.id} className={q.needs_review ? "row-review" : ""}>
                    <td>{q.needs_review && <i className="ti ti-alert-triangle" style={{ color: "#d97706" }} title="Low confidence" />}</td>
                    <td className="q-text-cell">{q.question_text.slice(0, 80)}{q.question_text.length > 80 ? "…" : ""}</td>
                    <td><span className="q-type-badge">{q.question_type}</span></td>
                    <td>{q.marks}</td>
                    <td className="ans-cell">
                      {correctAnswers.length > 0
                        ? <>{correctAnswers.join(", ")}<span className="ai-badge" title="Answer inferred by AI">✦ AI</span></>
                        : <span style={{ color: "#dc2626" }}>No answer detected</span>}
                    </td>
                    <td><span className="conf-badge" style={{ color: confColor(q.confidence), borderColor: confColor(q.confidence) }}>{q.confidence}%</span></td>
                    <td><button className={`approve-btn ${q.approved ? "approved" : ""}`} onClick={() => toggleApprove(q.id)} type="button">{q.approved ? <><i className="ti ti-check" /> Approved</> : "Approve"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="import-review-actions">
          <button className="btn btn-secondary" onClick={reset} type="button">Cancel</button>
          <button className="btn btn-primary" onClick={saveApproved} disabled={approvedCount === 0} type="button">
            <i className="ti ti-check" /> Save {approvedCount} Question{approvedCount !== 1 ? "s" : ""} to Repository
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AutoGeneratePanel
// ─────────────────────────────────────────────────────────────────────────────

function AutoGeneratePanel({ questions, onGenerated }: {
  questions: Question[]; onGenerated: (selected: Question[]) => void;
}) {
  const [mcqCount, setMcqCount] = useState(10);
  const [msqCount, setMsqCount] = useState(5);
  const [tfCount, setTfCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"MIXED" | Difficulty>("MIXED");
  const [error, setError] = useState("");

  const generate = () => {
    setError("");
    const pick = (type: QuestionType, count: number): Question[] => {
      let candidates = questions.filter((q) => q.question_type === type && q.is_active);
      if (difficulty !== "MIXED") candidates = candidates.filter((q) => q.difficulty === difficulty);
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      return candidates.slice(0, count);
    };
    const selected = [...pick("MCQ", mcqCount), ...pick("MSQ", msqCount), ...pick("TRUE_FALSE", tfCount)];
    if (selected.length === 0) { setError("No questions match criteria. Add more to the repository first."); return; }
    onGenerated(selected);
  };

  return (
    <div className="auto-gen-panel">
      <div className="auto-gen-header">
        <i className="ti ti-wand" />
        <div>
          <div className="auto-gen-title">Auto-Generate Exam Paper</div>
          <div className="auto-gen-sub">Randomly selects questions from your repository</div>
        </div>
      </div>
      <div className="form-grid-2col">
        <div className="form-field">
          <label>MCQ Count</label>
          <input type="number" className="form-input" min={0} max={50} value={mcqCount}
            onChange={(e) => setMcqCount(+e.target.value)} />
          <span className="field-hint">{questions.filter((q) => q.question_type === "MCQ").length} available</span>
        </div>
        <div className="form-field">
          <label>MSQ Count</label>
          <input type="number" className="form-input" min={0} max={30} value={msqCount}
            onChange={(e) => setMsqCount(+e.target.value)} />
          <span className="field-hint">{questions.filter((q) => q.question_type === "MSQ").length} available</span>
        </div>
        <div className="form-field">
          <label>True/False Count</label>
          <input type="number" className="form-input" min={0} max={30} value={tfCount}
            onChange={(e) => setTfCount(+e.target.value)} />
          <span className="field-hint">{questions.filter((q) => q.question_type === "TRUE_FALSE").length} available</span>
        </div>
        <div className="form-field">
          <label>Difficulty Mix</label>
          <select className="form-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
            <option value="MIXED">Mixed (Recommended)</option>
            <option value="EASY">Easy Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="HARD">Hard Only</option>
          </select>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary" onClick={generate} type="button">
        <i className="ti ti-wand" /> Generate Paper ({mcqCount + msqCount + tfCount} questions)
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Question Management
// ─────────────────────────────────────────────────────────────────────────────

function StepQuestions({ courseId, selectedIds, onToggle, onAddNew, onImported, allQuestions, questionsLoading }: {
  courseId: string; selectedIds: Set<string>; onToggle: (q: Question) => void;
  onAddNew: (q: Question) => void; onImported: (qs: ExtractedQuestion[]) => void;
  allQuestions: Question[]; questionsLoading: boolean;
}) {
  const [tab, setTab] = useState<"select" | "create" | "import" | "auto">("select");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDiff, setFilterDiff] = useState("");

  const filtered = allQuestions.filter((q) => {
    const matchSearch = !search || q.question_text.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || q.question_type === filterType;
    const matchDiff = !filterDiff || q.difficulty === filterDiff;
    return matchSearch && matchType && matchDiff;
  });

  const tabs = [
    { id: "select", label: "Select Existing", icon: "ti-list-search" },
    { id: "create", label: "Create Question", icon: "ti-pencil-plus" },
    { id: "import", label: "Import from PDF", icon: "ti-file-upload" },
    { id: "auto",   label: "Auto-Generate",   icon: "ti-wand"        },
  ] as const;

  return (
    <div className="step-panel">
      <div className="step-header">
        <h3>Question Management</h3>
        <p>Select questions from your repository, create new ones, or import from a PDF.</p>
        <div className="selected-count-badge">
          {selectedIds.size} question{selectedIds.size !== 1 ? "s" : ""} selected for this exam
        </div>
      </div>
      <div className="q-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`q-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)} type="button">
            <i className={`ti ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "select" && (
        <div className="q-select-panel">
          <div className="q-filters">
            <input className="form-input q-search" placeholder="Search questions…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="MCQ">MCQ</option>
              <option value="MSQ">MSQ</option>
              <option value="TRUE_FALSE">True / False</option>
            </select>
            <select className="form-select" value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
              <option value="">All Difficulty</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
            {selectedIds.size > 0 && (
              <button className="btn btn-sm btn-secondary" type="button"
                onClick={() => allQuestions.forEach((q) => { if (selectedIds.has(q.id)) onToggle(q); })}>
                Clear Selection
              </button>
            )}
          </div>
          {questionsLoading ? (
            <div className="loading-state"><span className="spinner" /> Loading questions…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 0" }}>
              <i className="ti ti-books" style={{ fontSize: 36, color: "#ccc" }} />
              <div className="empty-state-title">No questions found</div>
              <div className="empty-state-text">
                {allQuestions.length === 0 ? "Your repository is empty. Create questions or import from a PDF." : "Try adjusting your filters."}
              </div>
            </div>
          ) : (
            <div className="q-list">
              {filtered.map((q) => (
                <QuestionRow key={q.id} q={q} selected={selectedIds.has(q.id)} onToggle={() => onToggle(q)} />
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "create" && (
        <CreateQuestionForm courseId={courseId} onSaved={(q) => { onAddNew(q); setTab("select"); }} />
      )}
      {tab === "import" && (
        <PdfImportPanel onImported={(qs) => { onImported(qs); setTab("select"); }} />
      )}
      {tab === "auto" && (
        <AutoGeneratePanel questions={allQuestions}
          onGenerated={(selected) => { selected.forEach((q) => { if (!selectedIds.has(q.id)) onToggle(q); }); setTab("select"); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Rules
// ─────────────────────────────────────────────────────────────────────────────

function StepRules({ rules, onChange }: {
  rules: ExamRules; onChange: (r: ExamRules) => void;
}) {
  const rule = (key: keyof ExamRules, label: string, type: "bool" | "num" = "bool", min?: number) => {
    const numericValue = typeof rules[key] === "number" ? rules[key] : 0;
    return (
      <div className="form-field rule-field">
        <div className="rule-label">{label}</div>
        {type === "bool" ? (
          <label className="toggle-switch">
            <input type="checkbox" checked={!!rules[key]} onChange={(e) => onChange({ ...rules, [key]: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
        ) : (
          <input type="number" className="form-input rule-num" min={min ?? 0} value={numericValue}
            onChange={(e) => onChange({ ...rules, [key]: +e.target.value })} />
        )}
      </div>
    );
  };
  return (
    <div className="step-panel">
      <div className="step-header">
        <h3>Exam Rules &amp; Proctoring</h3>
        <p>Configure exam environment rules and anti-cheating settings.</p>
      </div>
      <div className="rules-grid">
        <div className="rules-section">
          <h4 className="rules-section-title"><i className="ti ti-layout-board" /> Navigation</h4>
          {rule("allow_backtrack", "Allow question backtracking")}
          {rule("mark_for_review", "Allow mark for review")}
        </div>
        <div className="rules-section">
          <h4 className="rules-section-title"><i className="ti ti-shield" /> Proctoring</h4>
          {rule("fullscreen_required", "Require fullscreen mode")}
          {rule("proctoring_enabled",  "Enable AI proctoring")}
          {rule("camera_required",     "Require camera access")}
          {rule("microphone_required", "Require microphone")}
        </div>
        <div className="rules-section">
          <h4 className="rules-section-title"><i className="ti ti-browser" /> Browser Integrity</h4>
          {rule("max_tab_switches",       "Max tab switches allowed",  "num", 0)}
          {rule("auto_save_interval_sec", "Auto-save interval (sec)", "num", 10)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Schedule
// ─────────────────────────────────────────────────────────────────────────────

function StepSchedule({ schedule, onChange }: {
  schedule: ScheduleForm; onChange: (s: Partial<ScheduleForm>) => void;
}) {
  return (
    <div className="step-panel">
      <div className="step-header">
        <h3>Exam Schedule</h3>
        <p>Set when this exam will take place. The exam will be saved as a draft — students won't see it until you hit <strong>Publish</strong> on the dashboard.</p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 16px",
          background: "#f0f7ff",
          border: "1.5px solid #bfdbfe",
          borderRadius: 10,
          marginBottom: 24,
          fontSize: 13,
          color: "#1e40af",
        }}
      >
        <i className="ti ti-info-circle" style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Enter times in your local time (IST). These times are saved with the exam so students know when it will run.
          The exam remains invisible until you click <strong>Publish</strong> on your dashboard.
        </span>
      </div>

      <div className="form-grid-2col">
        <div className="form-field">
          <label>Start Time *</label>
          <input
            type="datetime-local"
            className="form-input"
            value={schedule.start_time}
            onChange={(e) => onChange({ start_time: e.target.value })}
          />
        </div>
        <div className="form-field">
          <label>End Time *</label>
          <input
            type="datetime-local"
            className="form-input"
            value={schedule.end_time}
            onChange={(e) => onChange({ end_time: e.target.value })}
          />
        </div>
        <div className="form-field">
          <label>Registration Deadline <span style={{ fontWeight: 400, color: "#aaa" }}>(optional)</span></label>
          <input
            type="datetime-local"
            className="form-input"
            value={schedule.registration_deadline}
            onChange={(e) => onChange({ registration_deadline: e.target.value })}
          />
          <span className="field-hint">Leave blank to allow registration up until exam start.</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Preview
// ─────────────────────────────────────────────────────────────────────────────

function StepPreview({ form, schedule, selectedQuestions, examId }: {
  form: ExamForm;
  schedule: ScheduleForm;
  selectedQuestions: Question[];
  examId: string | null;
}) {
  const totalMarks = selectedQuestions.reduce((s, q) => s + q.marks, 0);
  const byType = selectedQuestions.reduce(
    (acc, q) => { acc[q.question_type] = (acc[q.question_type] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  // Show the datetime-local value as-is (it's already in IST, user entered it)
  const fmt = (dt: string) => dt ? new Date(`${dt}+05:30`).toLocaleString() : "—";

  if (examId) {
    return (
      <div className="step-panel">
        <div className="preview-success">
          <i className="ti ti-circle-check" style={{ fontSize: 48, color: "#059669" }} />
          <div className="preview-success-title">Exam Created Successfully!</div>
          <div className="preview-success-sub" style={{ color: "#555", marginTop: 6 }}>
            Saved as draft. Go to your dashboard and click <strong>Publish</strong> when you're ready to make it visible to students.
          </div>
          <div className="preview-success-sub" style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
            Exam ID: {examId}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="step-panel">
      <div className="step-header">
        <h3>Review &amp; Create</h3>
        <p>Check everything below, then click <strong>Create Exam</strong>. You can publish from the dashboard whenever you're ready.</p>
      </div>

      <div className="preview-grid">
        <div className="preview-card">
          <h4>Exam Info</h4>
          <div className="preview-rows">
            <div className="preview-row"><span>Title</span><strong>{form.title || "—"}</strong></div>
            <div className="preview-row"><span>Type</span><strong>{form.exam_type.replace(/_/g, " ")}</strong></div>
            <div className="preview-row"><span>Duration</span><strong>{form.duration_minutes} min</strong></div>
            <div className="preview-row"><span>Total Marks</span><strong>{form.total_marks}</strong></div>
            <div className="preview-row"><span>Questions Marks Sum</span><strong>{totalMarks}</strong></div>
            <div className="preview-row"><span>Pass Marks</span><strong>{form.pass_marks}</strong></div>
          </div>
        </div>

        <div className="preview-card">
          <h4>Questions ({selectedQuestions.length})</h4>
          <div className="preview-rows">
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} className="preview-row"><span>{type}</span><strong>{count}</strong></div>
            ))}
            {selectedQuestions.length === 0 && <div className="preview-empty">No questions selected</div>}
          </div>
        </div>

        <div className="preview-card">
          <h4><i className="ti ti-calendar-event" style={{ marginRight: 6 }} />Schedule</h4>
          <div className="preview-rows">
            <div className="preview-row"><span>Start</span><strong>{fmt(schedule.start_time)}</strong></div>
            <div className="preview-row"><span>End</span><strong>{fmt(schedule.end_time)}</strong></div>
            <div className="preview-row"><span>Registration closes</span><strong>{schedule.registration_deadline ? fmt(schedule.registration_deadline) : "At exam start"}</strong></div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: "12px 16px",
          background: "#fff3d8",
          border: "1.5px solid #f5d76e",
          borderRadius: 10,
          fontSize: 13,
          color: "#5a3c00",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <i className="ti ti-send" style={{ flexShrink: 0, color: "#94600a" }} />
        <span>
          This exam will be saved as a <strong>draft</strong>. To make it visible to students, go to your dashboard and click the <strong>Publish</strong> button on this exam's row.
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateExam() {
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: portal, isLoading: portalLoading } = useFacultyDashboard();

  const [draftId] = useState(() => newDraftId());
  const [currentStep,  setCurrentStep]  = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState("");
  const [examId,       setExamId]       = useState<string | null>(null);
  const [scheduleId,   setScheduleId]   = useState<string | null>(null);

  const [form,     setForm]     = useState<ExamForm>(() => ({
    ...defaultForm(),
    exam_type: searchParams.get("type") === "ENTRANCE" ? "ENTRANCE" : defaultForm().exam_type,
  }));
  const [rules,    setRules]    = useState(defaultRules);
  const [schedule, setSchedule] = useState<ScheduleForm>(defaultSchedule);

  const { data: serverQuestions = [], isLoading: questionsLoading } = useQuestions(
    form.course_id ? { course_id: form.course_id } : undefined
  );
  const [locallyAddedQuestions, setLocallyAddedQuestions] = useState<Question[]>([]);

  const allQuestions: Question[] = [
    ...locallyAddedQuestions.filter((lq) => !serverQuestions.some((sq) => sq.id === lq.id)),
    ...serverQuestions,
  ];

  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const selectedIds = new Set(selectedQuestions.map((q) => q.id));

  // Auto-save draft
  useEffect(() => {
    if (!form.title && currentStep === 0 && selectedQuestions.length === 0) return;
    upsertDraft({
      draftId,
      savedAt: new Date().toISOString(),
      currentStep,
      form,
      rules,
      schedule,
      selectedQuestionIds: selectedQuestions.map((q) => q.id),
    });
  }, [draftId, currentStep, form, rules, schedule, selectedQuestions]);

  // Resolve pending question IDs after server data loads
  const [pendingQuestionIds, setPendingQuestionIds] = useState<string[]>([]);
  useEffect(() => {
    if (pendingQuestionIds.length === 0 || serverQuestions.length === 0) return;
    const resolved = serverQuestions.filter((q) => pendingQuestionIds.includes(q.id));
    if (resolved.length > 0) {
      setSelectedQuestions((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...resolved.filter((r) => !existingIds.has(r.id))];
      });
      setPendingQuestionIds([]);
    }
  }, [pendingQuestionIds, serverQuestions]);

  const handleResumeDraft = (draft: ExamDraft) => {
    setForm(draft.form);
    setRules(draft.rules);
    setSchedule(draft.schedule ?? defaultSchedule());
    setCurrentStep(draft.currentStep);
    setSelectedQuestions([]);
    if (draft.selectedQuestionIds.length > 0) {
      const alreadyLoaded = serverQuestions.filter((q) => draft.selectedQuestionIds.includes(q.id));
      setSelectedQuestions(alreadyLoaded);
      const stillPending = draft.selectedQuestionIds.filter((id) => !alreadyLoaded.some((q) => q.id === id));
      if (stillPending.length > 0) setPendingQuestionIds(stillPending);
    }
  };

  const toggleQuestion = (q: Question) => {
    setSelectedQuestions((prev) =>
      prev.some((p) => p.id === q.id) ? prev.filter((p) => p.id !== q.id) : [...prev, q]
    );
  };

  const handleAddNew = (q: Question) => {
    setLocallyAddedQuestions((prev) => prev.some((p) => p.id === q.id) ? prev : [q, ...prev]);
    setSelectedQuestions((prev) => prev.some((p) => p.id === q.id) ? prev : [...prev, q]);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions() });
  };

  const handleImported = async (qs: ExtractedQuestion[]) => {
    for (const q of qs) {
      try {
        const res = await facultyApi.createQuestion({
          course_id: form.course_id || null, question_type: q.question_type,
          question_text: q.question_text, marks: q.marks, negative_marks: 0,
          difficulty: q.difficulty,
          options: q.options.map((o, i) => ({ option_text: o.text, is_correct: o.is_correct, order_index: i })),
          topics: [],
        });
        const full = await facultyApi.getQuestion(res.question_id);
        handleAddNew(full);
      } catch (e) {
        console.error("Failed to save imported question:", q.question_text, e);
      }
    }
  };

  // ── Create exam ────────────────────────────────────────────────────────────
  const saveExam = async () => {
    setSaving(true);
    setSaveError("");
    try {
      // Step 1 — create exam as DRAFT
      const examData = await facultyApi.createExam({
        title:             form.title,
        course_id:         form.course_id || null,
        exam_type:         form.exam_type,
        total_marks:       form.total_marks,
        pass_marks:        form.pass_marks,
        duration_minutes:  form.duration_minutes,
        shuffle_questions: form.shuffle_questions,
        shuffle_options:   form.shuffle_options,
        instructions:      form.instructions || null,
        status:            "DRAFT",
      });
      const newExamId = examData.id;

      // Step 2 — link questions
      for (let i = 0; i < selectedQuestions.length; i++) {
        await facultyApi.addQuestionToExam(newExamId, {
          question_id: selectedQuestions[i].id,
          order_index: i,
        });
      }

      // Step 3 — exam rules
      await facultyApi.upsertExamRules({ exam_id: newExamId, ...rules });

      // Step 4 — create schedule
      // toUTCString converts the datetime-local value (IST) to UTC ISO string
      // so the backend stores the correct UTC time.
      const scheduleResult = await facultyApi.createExamSchedule({
        exam_id:               newExamId,
        start_time:            schedule.start_time ? toUTCString(schedule.start_time) : null,
        end_time:              schedule.end_time ? toUTCString(schedule.end_time) : null,
        registration_deadline: schedule.registration_deadline ? toUTCString(schedule.registration_deadline) : null,
        is_published:          true,
      });

      setExamId(newExamId);
      setScheduleId(scheduleResult?.id ?? null);
      deleteDraft(draftId);

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exams() });
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to create exam. Check all fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return form.title.trim() && form.total_marks > 0 && form.pass_marks > 0;
    if (currentStep === 3) return !!schedule.start_time && !!schedule.end_time;
    return true;
  };

  const next = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1);
    else saveExam();
  };

  const [pageTab, setPageTab] = useState<"create" | "drafts">("create");
  const [draftCount, setDraftCount] = useState(() => loadDrafts().length);

  const handleResumeDraftAndSwitch = (draft: ExamDraft) => {
    handleResumeDraft(draft);
    setPageTab("create");
  };

  return (
    <FacultyLayout activePage="create-exam">
      <PageState loading={portalLoading}>
        <div className="create-exam-workspace">
          <RepositoryOverview portal={portal} />

          <div className="workspace-card">
            {!examId && (
              <div className="page-tabs">
                <button className={`page-tab ${pageTab === "create" ? "active" : ""}`}
                  onClick={() => setPageTab("create")} type="button">
                  <i className="ti ti-plus" /> Create New Exam
                </button>
                <button className={`page-tab ${pageTab === "drafts" ? "active" : ""}`}
                  onClick={() => { setDraftCount(loadDrafts().length); setPageTab("drafts"); }} type="button">
                  <i className="ti ti-file-pencil" /> Saved Drafts
                  {draftCount > 0 && <span className="page-tab-badge">{draftCount}</span>}
                </button>
              </div>
            )}

            {pageTab === "drafts" && !examId && (
              <div className="workspace-body">
                <div className="step-header">
                  <h3>Saved Drafts</h3>
                  <p>Resume any in-progress exam or delete ones you no longer need.</p>
                </div>
                <DraftsList
                  activeDraftId={draftId}
                  onResume={handleResumeDraftAndSwitch}
                  onDelete={(id) => { if (id === draftId) deleteDraft(id); setDraftCount(loadDrafts().length); }}
                  onRefresh={() => setDraftCount(loadDrafts().length)}
                />
              </div>
            )}

            {(pageTab === "create" || !!examId) && (
              <>
                <div className="workspace-header">
                  <div>
                    <h2 className="workspace-title">{examId ? "Exam Created!" : "Create New Exam"}</h2>
                    <p className="workspace-sub">
                      {examId
                        ? "Saved as draft — go to your dashboard and click Publish when ready."
                        : `Step ${currentStep + 1} of ${STEPS.length} · ${STEPS[currentStep].label}`}
                    </p>
                  </div>
                  {!examId && (
                    <button className="btn btn-sm btn-ghost" onClick={() => navigate("/faculty/dashboard")} type="button">
                      <i className="ti ti-x" /> Cancel
                    </button>
                  )}
                </div>

                <Stepper steps={STEPS} current={currentStep} onStep={setCurrentStep} />

                <div className="workspace-body">
                  {currentStep === 0 && (
                    <StepExamInfo form={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
                  )}
                  {currentStep === 1 && (
                    <StepQuestions
                      courseId={form.course_id} selectedIds={selectedIds}
                      onToggle={toggleQuestion} onAddNew={handleAddNew} onImported={handleImported}
                      allQuestions={allQuestions} questionsLoading={questionsLoading}
                    />
                  )}
                  {currentStep === 2 && (
                    <StepRules rules={rules} onChange={setRules} />
                  )}
                  {currentStep === 3 && (
                    <StepSchedule schedule={schedule} onChange={(p) => setSchedule((s) => ({ ...s, ...p }))} />
                  )}
                  {currentStep === 4 && (
                    <StepPreview
                      form={form}
                      schedule={schedule}
                      selectedQuestions={selectedQuestions}
                      examId={examId}
                    />
                  )}
                </div>

                {!examId && (
                  <div className="workspace-footer">
                    <div className="footer-left">
                      {currentStep > 0 && (
                        <button className="btn btn-secondary" onClick={() => setCurrentStep((s) => s - 1)} type="button">
                          <i className="ti ti-chevron-left" /> Back
                        </button>
                      )}
                    </div>
                    <div className="footer-center">
                      {saveError && <div className="form-error" style={{ textAlign: "center" }}>{saveError}</div>}
                      {form.title.trim() && (
                        <span className="draft-autosave-indicator"><i className="ti ti-device-floppy" /> Draft auto-saved</span>
                      )}
                    </div>
                    <div className="footer-right">
                      {currentStep < STEPS.length - 1 ? (
                        <button className="btn btn-primary" onClick={next} disabled={!canProceed()} type="button">
                          Next <i className="ti ti-chevron-right" />
                        </button>
                      ) : (
                        <button className="btn btn-primary" onClick={saveExam} disabled={saving || !!examId} type="button">
                          {saving
                            ? <><span className="spinner-sm" /> Creating…</>
                            : <><i className="ti ti-check" /> Create Exam</>}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {examId && (
                  <div className="workspace-footer">
                    {form.exam_type === "ENTRANCE" && scheduleId ? (
                      /* ── Entrance exam: show candidate manager inline ── */
                      <div style={{ width: "100%", marginTop: 8 }}>
                        <div style={{
                          background: "#ECFDF5", border: "1px solid #6EE7B7",
                          borderRadius: 10, padding: "14px 18px", marginBottom: 24,
                          display: "flex", alignItems: "center", gap: 10,
                          fontSize: 14, color: "#047857", fontWeight: 600,
                        }}>
                          <i className="ti ti-circle-check" style={{ fontSize: 18 }} />
                          Entrance exam created! Now assign candidates below, then go to Dashboard to publish.
                        </div>
                        <CandidateManager examScheduleId={scheduleId} examTitle={form.title} />
                        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                          <button className="btn btn-primary" onClick={() => navigate("/faculty/dashboard")} type="button">
                            <i className="ti ti-home" /> Go to Dashboard to Publish
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-primary" onClick={() => navigate("/faculty/dashboard")} type="button">
                        <i className="ti ti-home" /> Go to Dashboard to Publish
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PageState>
    </FacultyLayout>
  );
}
