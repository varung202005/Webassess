/**
 * CreateExam.tsx — final
 *
 * Changes vs original:
 *   • AnswerEditorSidebar added — click any row in the PDF import review
 *     table to open a slide-in sidebar showing all options; select / deselect
 *     correct answers and save.  Works for MCQ (single), MSQ (multi),
 *     TRUE_FALSE (single), and SHORT_ANSWER (free-text expected answer).
 *   • SHORT_ANSWER (fill-in-the-blank) question type added throughout:
 *     question creation form, PDF import review table, answer editor
 *     sidebar, question repository filters, and auto-generate panel.
 *   • require_fullscreen is ALWAYS TRUE — platform-level, not per-exam.
 *   • max_fullscreen_exits added to rules (default 3; 0 = log-only).
 *   • PDF import review state lifted to StepQuestions so switching tabs
 *     mid-review (e.g. to "Select Existing") no longer wipes it.
 */

import { useState, useRef, useCallback, useEffect, type Dispatch, type SetStateAction, type ChangeEvent, type DragEvent, type MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState } from "../../features/faculty/components";
import { useFacultyDashboard, useQuestions, QUERY_KEYS } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import type { Question } from "../../features/faculty/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "info",      label: "Exam Info",   icon: "ti-info-circle"    },
  { id: "questions", label: "Questions",   icon: "ti-list-check"     },
  { id: "rules",     label: "Rules",       icon: "ti-shield-check"   },
  { id: "schedule",  label: "Schedule",    icon: "ti-calendar-event" },
  { id: "preview",   label: "Preview",     icon: "ti-eye"            },
];

const DRAFT_STORAGE_KEY = "exam_portal_drafts_v1";
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_MB = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type QuestionType = "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_ANSWER";
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
  /**
   * Client-side only — the PDF/DOCX extractor never returns images, so if
   * faculty want a picture on an imported question they attach it here
   * during review. Not sent to the extract endpoint; only used locally,
   * then uploaded via uploadQuestionImage() right after the question row
   * is created in handleImported().
   */
  _imageFile?: File | null;
  /**
   * Client-side only — whether this question should ALSO be selected into
   * the exam currently being built, in addition to being saved to the
   * question bank. Saving to the bank never requires marks to add up to
   * the exam's target; that target only matters for questions flagged here,
   * since those are the ones that actually count toward this exam's total.
   */
  _addToExam?: boolean;
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
// Timezone helpers
// ─────────────────────────────────────────────────────────────────────────────

function toUTCString(localStr: string): string {
  if (!localStr) return localStr;
  return new Date(`${localStr}+05:30`).toISOString();
}

function toLocalInputString(iso: string | null | undefined): string {
  if (!iso) return "";
  const d   = new Date(iso);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadDrafts(): ExamDraft[] {
  try { const raw = localStorage.getItem(DRAFT_STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
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
  allow_review_flag: true,
  enable_proctoring: false,
  camera_required: false,
  microphone_required: false,
  max_tab_switches: 3,
  max_fullscreen_exits: 3,
  auto_save_interval_sec: 30,
});

type ExamRules = ReturnType<typeof defaultRules>;

const defaultSchedule = (): ScheduleForm => ({
  start_time: "",
  end_time: "",
  registration_deadline: "",
});

// ─────────────────────────────────────────────────────────────────────────────
// QuestionImageUploader — reusable image picker + preview widget
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionImageUploaderProps {
  /** Existing public URL (e.g. when editing a saved question) */
  existingUrl?: string | null;
  /** Called when the user picks a valid file — parent holds the File */
  onFileSelected: (file: File | null) => void;
  /** Optional: compact mode for use inside narrow form layouts */
  compact?: boolean;
}

function QuestionImageUploader({ existingUrl, onFileSelected, compact }: QuestionImageUploaderProps) {
  const [preview, setPreview]   = useState<string | null>(existingUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr]           = useState("");
  const inputRef                = useRef<HTMLInputElement>(null);

  const validate = (file: File): string => {
    if (!ALLOWED_IMAGE_MIME.includes(file.type))
      return "Only JPEG, PNG, GIF, or WebP images are allowed.";
    if (file.size > MAX_IMAGE_MB * 1024 * 1024)
      return `Image must be smaller than ${MAX_IMAGE_MB} MB.`;
    return "";
  };

  const handleFile = (file: File | null) => {
    if (!file) { setPreview(null); onFileSelected(null); setErr(""); return; }
    const msg = validate(file);
    if (msg) { setErr(msg); return; }
    setErr("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    onFileSelected(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  const remove = (e: MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onFileSelected(null);
    setErr("");
  };

  return (
    <div style={{ marginTop: compact ? 0 : 4 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        onChange={onInputChange}
      />

      {preview ? (
        /* ── Preview state ── */
        <div style={{
          position: "relative",
          display: "inline-block",
          borderRadius: 10,
          overflow: "hidden",
          border: "1.5px solid #e5e7eb",
          maxWidth: compact ? 180 : 320,
        }}>
          <img
            src={preview}
            alt="Question image preview"
            style={{
              display: "block",
              maxWidth: compact ? 180 : 320,
              maxHeight: compact ? 120 : 200,
              objectFit: "contain",
              background: "#f9fafb",
            }}
          />
          {/* Replace button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              position: "absolute", bottom: 6, left: 6,
              background: "rgba(0,0,0,0.55)", color: "#fff",
              border: "none", borderRadius: 6, padding: "3px 9px",
              fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <i className="ti ti-replace" /> Replace
          </button>
          {/* Remove button */}
          <button
            type="button"
            onClick={remove}
            style={{
              position: "absolute", top: 6, right: 6,
              background: "rgba(220,38,38,0.85)", color: "#fff",
              border: "none", borderRadius: "50%", width: 24, height: 24,
              fontSize: 13, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
            title="Remove image"
          >
            <i className="ti ti-x" />
          </button>
        </div>
      ) : (
        /* ── Drop zone state ── */
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `1.5px dashed ${dragOver ? "#8b1a1a" : "#d1d5db"}`,
            borderRadius: 10,
            padding: compact ? "10px 16px" : "16px 20px",
            cursor: "pointer",
            background: dragOver ? "#fff5f5" : "#fafafa",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "border-color .15s, background .15s",
          }}
        >
          <i className="ti ti-photo-plus" style={{ fontSize: compact ? 18 : 22, color: "#9ca3af", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: compact ? 12 : 13, color: "#374151", fontWeight: 500 }}>
              {dragOver ? "Drop image here" : "Attach an image (optional)"}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              JPEG · PNG · GIF · WebP · max {MAX_IMAGE_MB} MB
            </div>
          </div>
        </div>
      )}

      {err && (
        <div style={{ fontSize: 12, color: "#dc2626", marginTop: 5 }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />{err}
        </div>
      )}
    </div>
  );
}

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
  const qs     = portal?.questionStats;
  const byType = qs?.byType ?? {};
  return (
    <div className="repo-overview">
      <div className="repo-overview-header">
        <h2 className="section-title"><i className="ti ti-database" /> Question Repository</h2>
        <span className="section-sub">Your personal question bank — reuse across exams</span>
      </div>
      <div className="repo-stats-grid">
        <StatCard label="Total Questions"     value={qs?.total          ?? 0} icon="ti-books"       color="#8b1a1a" />
        <StatCard label="MCQ"                 value={byType.MCQ         ?? 0} icon="ti-circle-dot"  color="#2563eb" />
        <StatCard label="MSQ"                 value={byType.MSQ         ?? 0} icon="ti-checkbox"    color="#7c3aed" />
        <StatCard label="True / False"        value={byType.TRUE_FALSE  ?? 0} icon="ti-toggle-left" color="#059669" />
        <StatCard label="Fill in the Blank"   value={byType.SHORT_ANSWER ?? 0} icon="ti-forms"       color="#b45309" />
        <StatCard label="Active"              value={qs?.active         ?? 0} icon="ti-circle-check" color="#d97706" />
        <StatCard label="Courses Covered"     value={portal?.courses?.length ?? 0} icon="ti-book"  color="#0891b2" />
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

function QuestionRow({ q, selected, onToggle, onUpdateMarks, onView }: {
  q: Question; selected: boolean; onToggle: () => void;
  onUpdateMarks: (q: Question, marks: number) => void;
  onView: (q: Question) => void;
}) {
  const typeColor: Record<string, string> = {
    MCQ: "#2563eb", MSQ: "#7c3aed", TRUE_FALSE: "#059669", SHORT_ANSWER: "#b45309",
  };
  const typeLabel: Record<string, string> = {
    MCQ: "MCQ", MSQ: "MSQ", TRUE_FALSE: "TRUE_FALSE", SHORT_ANSWER: "FILL-BLANK",
  };
  const diffColor: Record<string, string> = { EASY: "#059669", MEDIUM: "#d97706", HARD: "#dc2626" };

  // Editable marks — kept as local text so the field feels responsive while
  // typing, committed to the repository (and to the exam's running total)
  // on blur / Enter. Resyncs if the underlying question's marks change
  // elsewhere (e.g. edited from the standalone Question Bank page).
  const [marksInput, setMarksInput] = useState(String(q.marks));
  useEffect(() => { setMarksInput(String(q.marks)); }, [q.marks]);

  const commitMarks = () => {
    const parsed = parseFloat(marksInput);
    if (!Number.isFinite(parsed) || parsed < 0) { setMarksInput(String(q.marks)); return; }
    if (parsed !== q.marks) onUpdateMarks(q, parsed);
  };

  return (
    <div className={`q-row ${selected ? "q-row-selected" : ""}`} onClick={onToggle}>
      <div className="q-row-check">
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={(e) => e.stopPropagation()} />
      </div>
      <div className="q-row-body">
        <div className="q-row-text">{q.question_text.slice(0, 120)}{q.question_text.length > 120 ? "…" : ""}</div>
        <div className="q-row-meta">
          <span className="q-badge" style={{ background: `${typeColor[q.question_type]}14`, color: typeColor[q.question_type], borderColor: `${typeColor[q.question_type]}30`, flex: "0 0 auto" }}>
            {typeLabel[q.question_type] ?? q.question_type}
          </span>
          <span className="q-badge" style={{ background: `${diffColor[q.difficulty]}14`, color: diffColor[q.difficulty], borderColor: `${diffColor[q.difficulty]}30`, flex: "0 0 auto" }}>{q.difficulty}</span>
          <span
            className="q-badge"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 12px", flex: "0 0 auto", whiteSpace: "nowrap",
              borderColor: "#d1d5db",
            }}
            title="Click to change marks for this question"
          >
            <input
              type="number"
              min={0}
              step={0.5}
              value={marksInput}
              onChange={(e) => setMarksInput(e.target.value)}
              onBlur={commitMarks}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              style={{
                // Fixed, non-growing size regardless of any global input
                // styling (e.g. width:100% resets) — flex-basis + grow/shrink
                // of 0 pins the box even when a plain `width` gets overridden.
                flex: "0 0 26px", width: 26, minWidth: 26, maxWidth: 26,
                boxSizing: "border-box", textAlign: "right",
                border: "none", background: "transparent", font: "inherit",
                color: "inherit", padding: 0, MozAppearance: "textfield",
              }}
            />
            <span style={{ flex: "0 0 auto" }}>mark{q.marks !== 1 ? "s" : ""}</span>
          </span>
          {q.courses && <span className="q-badge q-badge-course" style={{ flex: "0 0 auto" }}>{q.courses.code ?? q.courses.name}</span>}
          {q.image_url && (
            <span
              className="q-badge"
              title="This question has an attached image"
              style={{ background: "#f0f9ff", color: "#0369a1", borderColor: "#bae6fd", display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}
            >
              <i className="ti ti-photo" style={{ fontSize: 11 }} /> Image
            </span>
          )}
          <button
            type="button"
            className="q-badge"
            onClick={(e) => { e.stopPropagation(); onView(q); }}
            title="View full question, options, and correct answer"
            style={{
              flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 5,
              background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe", cursor: "pointer",
            }}
          >
            <i className="ti ti-eye" style={{ fontSize: 12 }} /> View / Edit
          </button>
        </div>
      </div>
      {q.image_url && (
        <div style={{ flexShrink: 0, marginLeft: 8 }}>
          <img
            src={q.image_url}
            alt=""
            style={{
              width: 52, height: 40,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExistingQuestionDetailSidebar
//
// Opened from the "View / Edit" button on a Select Existing row. Unlike
// AnswerEditorSidebar (which edits a not-yet-saved PDF-import candidate held
// entirely client-side), this edits a REAL question already in the
// repository — so every save round-trips to the API. It shows the full
// question text (the row itself truncates long questions), lets you toggle
// which option is correct, edit option wording, adjust marks/difficulty, and
// attach / replace / remove the question's image.
// ─────────────────────────────────────────────────────────────────────────────
function ExistingQuestionDetailSidebar({
  question,
  onClose,
  onSaved,
}: {
  question: Question;
  onClose: () => void;
  onSaved: (updated: Question) => void;
}) {
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");

  const [questionText, setQuestionText] = useState(question.question_text);
  const [marks, setMarks]               = useState<number>(question.marks);
  const [difficulty, setDifficulty]     = useState(question.difficulty);
  const [options, setOptions] = useState<Array<{ id?: string; text: string; is_correct: boolean }>>([]);
  const [shortAnswerText, setShortAnswerText] = useState("");

  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(question.image_url ?? null);
  const [newImageFile, setNewImageFile]         = useState<File | null>(null);
  const [removeImage, setRemoveImage]           = useState(false);

  const mapOptions = (raw: any[]) =>
    (raw ?? [])
      .slice()
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((o: any) => ({ id: o.id, text: o.option_text ?? o.text ?? "", is_correct: !!o.is_correct }));

  // Always fetch the freshest full detail on open — the row passed in may be
  // a lighter-weight copy without every option.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setLoadError("");
      try {
        const full: any = await facultyApi.getQuestion(question.id);
        if (cancelled) return;
        setQuestionText(full.question_text ?? question.question_text);
        setMarks(full.marks ?? question.marks);
        setDifficulty(full.difficulty ?? question.difficulty);
        setExistingImageUrl(full.image_url ?? null);
        const opts = mapOptions(full.question_options);
        setOptions(opts);
        if (question.question_type === "SHORT_ANSWER") setShortAnswerText(opts[0]?.text ?? "");
      } catch {
        if (cancelled) return;
        setLoadError("Couldn't refresh from the server — showing what was already loaded.");
        const opts = mapOptions((question as any).question_options);
        setOptions(opts);
        if (question.question_type === "SHORT_ANSWER") setShortAnswerText(opts[0]?.text ?? "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleOption = (idx: number) => {
    if (question.question_type === "MCQ" || question.question_type === "TRUE_FALSE") {
      setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
    } else {
      setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, is_correct: !o.is_correct } : o)));
    }
  };

  const handleImageFileSelected = (f: File | null) => {
    if (f) { setNewImageFile(f); setRemoveImage(false); }
    else    { setNewImageFile(null); setRemoveImage(!!existingImageUrl); }
  };

  const handleSave = async () => {
    setSaving(true); setSaveError("");
    try {
      const body: Record<string, unknown> = { question_text: questionText, marks, difficulty };

      if (question.question_type === "SHORT_ANSWER") {
        const text = shortAnswerText.trim();
        body.options = text
          ? [{ ...(options[0]?.id ? { id: options[0].id } : {}), option_text: text, is_correct: true, order_index: 0 }]
          : [];
      } else {
        body.options = options.map((o, i) => ({
          ...(o.id ? { id: o.id } : {}),
          option_text: o.text,
          is_correct: o.is_correct,
          order_index: i,
        }));
      }

      await facultyApi.updateQuestion(question.id, body);

      let finalImageUrl = existingImageUrl;
      if (newImageFile) {
        const uploaded: any = await facultyApi.uploadQuestionImage(question.id, newImageFile);
        finalImageUrl = uploaded?.image_url ?? finalImageUrl;
      } else if (removeImage && existingImageUrl) {
        // NOTE: if your api client wraps DELETE /questions/{id}/image under a
        // different method name, update this call to match.
        await (facultyApi as any).deleteQuestionImage(question.id);
        finalImageUrl = null;
      }

      onSaved({
        ...question,
        question_text: questionText,
        marks,
        difficulty,
        image_url: finalImageUrl,
        question_options: options.map((o, i) => ({ id: o.id, option_text: o.text, is_correct: o.is_correct, order_index: i })),
      } as Question);
    } catch {
      setSaveError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const correctAnswers = options
    .map((o, i) => (o.is_correct ? `${String.fromCharCode(65 + i)}. ${o.text}` : null))
    .filter(Boolean);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, height: "100dvh",
        width: "min(520px, 96vw)", background: "#fff", zIndex: 1001,
        display: "flex", flexDirection: "column",
        boxShadow: "-6px 0 40px rgba(0,0,0,0.18)",
        animation: "sidebarSlideIn 0.22s cubic-bezier(.22,1,.36,1)",
      }}>
        <style>{`
          @keyframes sidebarSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          .eqs-opt { display: flex; align-items: flex-start; gap: 12px; padding: 13px 15px; border-radius: 10px; border: 1.5px solid #e5e7eb; margin-bottom: 9px; }
          .eqs-opt.correct { border-color: #059669; background: #ecfdf5; }
          .eqs-marker { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #d1d5db; display: flex; align-items: center; justify-content: center; margin-top: 1px; cursor: pointer; }
          .eqs-marker.square { border-radius: 5px; }
          .eqs-opt.correct .eqs-marker { border-color: #059669; background: #059669; }
          .eqs-text-input { flex: 1; border: none; background: transparent; font-size: 14px; color: #1f2937; line-height: 1.5; font-family: inherit; padding: 2px 0; outline: none; }
          .eqs-letter { font-weight: 700; color: #9ca3af; margin-top: 3px; }
          .eqs-opt.correct .eqs-letter { color: #059669; }
          .eqs-short-input, .eqs-text-area { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; font-size: 14px; color: #1f2937; box-sizing: border-box; font-family: inherit; }
          .eqs-short-input:focus, .eqs-text-area:focus { outline: none; border-color: #8b1a1a; }
          .eqs-field-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; margin-bottom: 8px; }
        `}</style>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b1a1a", marginBottom: 6 }}>
              View / Edit Question
            </div>
            <textarea
              className="eqs-text-area"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              style={{ fontWeight: 600, resize: "vertical" }}
            />
          </div>
          <button onClick={onClose} type="button" title="Close (Esc)" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af", fontSize: 20, lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading ? (
            <div className="loading-state"><span className="spinner" /> Loading full question…</div>
          ) : (
            <>
              {loadError && (
                <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
                  ⚠ {loadError}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <div className="eqs-field-label">Marks</div>
                  <input type="number" className="form-input" min={0} step={0.5} value={marks}
                    onChange={(e) => setMarks(parseFloat(e.target.value) || 0)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="eqs-field-label">Difficulty</div>
                  <select className="form-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div className="eqs-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <i className="ti ti-photo" style={{ fontSize: 12 }} /> Question Image
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#c1c7d0" }}>(optional)</span>
                </div>
                <QuestionImageUploader
                  compact
                  existingUrl={removeImage ? null : existingImageUrl}
                  onFileSelected={handleImageFileSelected}
                />
              </div>

              {question.question_type === "SHORT_ANSWER" ? (
                <>
                  <div className="eqs-field-label">Expected Answer</div>
                  <input
                    className="eqs-short-input"
                    value={shortAnswerText}
                    onChange={(e) => setShortAnswerText(e.target.value)}
                    placeholder="Type the expected answer…"
                  />
                </>
              ) : (
                <>
                  <div className="eqs-field-label">
                    Options — click the circle to mark correct{question.question_type === "MSQ" ? " (multiple allowed)" : ""}, or edit the text
                  </div>
                  {options.map((opt, idx) => {
                    const isMulti = question.question_type === "MSQ";
                    return (
                      <div key={opt.id ?? idx} className={`eqs-opt ${opt.is_correct ? "correct" : ""}`}>
                        <div className={`eqs-marker ${isMulti ? "square" : ""}`} onClick={() => toggleOption(idx)}>
                          {opt.is_correct && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="eqs-letter">{String.fromCharCode(65 + idx)}.</span>
                        <input
                          className="eqs-text-input"
                          value={opt.text}
                          onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o)))}
                        />
                      </div>
                    );
                  })}
                  {correctAnswers.length > 0 ? (
                    <div style={{ marginTop: 14, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 13, color: "#065f46" }}>
                      <strong>Marked correct:</strong> {correctAnswers.join("  ·  ")}
                    </div>
                  ) : (
                    <div style={{ marginTop: 14, padding: "10px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
                      ⚠ No correct answer selected.
                    </div>
                  )}
                </>
              )}

              {saveError && <div className="form-error" style={{ marginTop: 14 }}>{saveError}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" type="button" onClick={handleSave} disabled={loading || saving}>
            {saving ? <><span className="spinner" /> Saving…</> : <><i className="ti ti-check" /> Save Changes</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateQuestionForm
// ─────────────────────────────────────────────────────────────────────────────

function CreateQuestionForm({ courseId, remainingMarks, onSaved }: {
  courseId: string; remainingMarks?: number; onSaved: (q: Question) => void;
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
  const [shortAnswerText, setShortAnswerText] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [imgErr, setImgErr] = useState("");

  const setType = (qt: QuestionType) => {
    if (qt === "TRUE_FALSE") {
      setForm((f) => ({ ...f, question_type: qt, options: [
        { option_text: "True",  is_correct: false, order_index: 0 },
        { option_text: "False", is_correct: false, order_index: 1 },
      ]}));
    } else if (qt === "SHORT_ANSWER") {
      setForm((f) => ({ ...f, question_type: qt, options: [] }));
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
    if (form.question_type === "SHORT_ANSWER") {
      if (!shortAnswerText.trim()) return setError("Enter the expected answer.");
    } else if (!form.options.some((o) => o.is_correct)) {
      return setError("Mark at least one correct answer.");
    }
    setSaving(true); setError(""); setImgErr("");
    try {
      // Fill-in-the-blank / short-answer questions reuse the existing
      // options table: the expected answer is stored as a single option
      // with is_correct=true, rather than requiring a schema change.
      const optionsPayload = form.question_type === "SHORT_ANSWER"
        ? [{ option_text: shortAnswerText.trim(), is_correct: true, order_index: 0 }]
        : form.options.filter((o) => o.option_text.trim());
      const res  = await facultyApi.createQuestion({
        course_id: courseId || null, question_type: form.question_type,
        question_text: form.question_text, marks: form.marks,
        negative_marks: form.negative_marks, difficulty: form.difficulty,
        options: optionsPayload, topics: [],
      });

      if (pendingImageFile) {
        try {
          await facultyApi.uploadQuestionImage(res.question_id, pendingImageFile);
        } catch (e: any) {
          // Non-fatal: the question itself is already saved successfully.
          setImgErr(`Question saved, but image upload failed: ${e?.message ?? "unknown error"}`);
        }
      }

      const full = await facultyApi.getQuestion(res.question_id);
      onSaved(full);
      setPendingImageFile(null);
      setForm({ question_type: "MCQ", question_text: "", marks: 1, negative_marks: 0, difficulty: "MEDIUM",
        options: [
          { option_text: "", is_correct: false, order_index: 0 },
          { option_text: "", is_correct: false, order_index: 1 },
          { option_text: "", is_correct: false, order_index: 2 },
          { option_text: "", is_correct: false, order_index: 3 },
        ]});
      setShortAnswerText("");
    } catch (e: any) { setError(e?.message ?? "Failed to save question"); }
    finally { setSaving(false); }
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
            <option value="SHORT_ANSWER">Short Answer / Fill in the Blank</option>
          </select>
        </div>
        <div className="form-field">
          <label>Marks</label>
          <input type="number" className="form-input" min={1} max={100} value={form.marks}
            onChange={(e) => setForm((f) => ({ ...f, marks: +e.target.value }))} />
          {typeof remainingMarks === "number" && (
            <span className="field-hint" style={{ color: remainingMarks < 0 ? "#dc2626" : "#8b1a1a" }}>
              {remainingMarks > 0
                ? `${remainingMarks} more mark${remainingMarks !== 1 ? "s" : ""} needed to reach the exam total`
                : remainingMarks < 0
                  ? `Already ${-remainingMarks} mark${-remainingMarks !== 1 ? "s" : ""} over the exam total`
                  : "Exam total marks already reached"}
            </span>
          )}
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

      <div className="form-field">
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-photo" style={{ fontSize: 14, color: "#6b7280" }} />
          Question Image
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
        </label>
        <QuestionImageUploader onFileSelected={setPendingImageFile} />
        {imgErr && (
          <div style={{ fontSize: 12, color: "#d97706", marginTop: 5 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />{imgErr}
          </div>
        )}
      </div>

      {form.question_type === "SHORT_ANSWER" ? (
        <div className="form-field">
          <label>Expected Answer *</label>
          <input className="form-input" placeholder="e.g. Photosynthesis"
            value={shortAnswerText} onChange={(e) => setShortAnswerText(e.target.value)} />
          <span className="field-hint">Students' free-text answers will need manual or fuzzy-match grading against this.</span>
        </div>
      ) : (
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
      )}

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
// AnswerEditorSidebar
// ─────────────────────────────────────────────────────────────────────────────

function AnswerEditorSidebar({
  question,
  onClose,
  onSave,
}: {
  question: ExtractedQuestion;
  onClose: () => void;
  onSave: (updated: ExtractedQuestion) => void;
}) {
  const [options, setOptions] = useState(question.options.map((o) => ({ ...o })));
  // For SHORT_ANSWER, the extracted "options" array holds at most one entry
  // (the expected answer text, is_correct=true) — surface it as a plain
  // text field instead of a toggleable option list.
  const [shortAnswerText, setShortAnswerText] = useState(
    question.question_type === "SHORT_ANSWER" ? (question.options[0]?.text ?? "") : "",
  );
  // Image attachment — carried client-side until the question is actually
  // created in the repository (see handleImported in the main component).
  const [imageFile, setImageFile] = useState<File | null>(question._imageFile ?? null);
  // FIX: QuestionImageUploader only shows a preview for a file the user just
  // picked in *this* mount (its internal preview state starts at whatever
  // `existingUrl` was passed in). Previously no `existingUrl` was ever passed
  // here, so reopening the sidebar for a question that already had an image
  // attached (from a previous visit to this editor) showed an empty "Attach
  // an image" dropzone instead of the image — even though the row in the
  // table correctly showed the "Image" badge. Generating an object URL for
  // the already-selected File up front fixes that.
  const [initialImagePreviewUrl] = useState<string | null>(
    question._imageFile ? URL.createObjectURL(question._imageFile) : null,
  );
  useEffect(() => {
    return () => { if (initialImagePreviewUrl) URL.revokeObjectURL(initialImagePreviewUrl); };
  }, [initialImagePreviewUrl]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleOption = (idx: number) => {
    if (question.question_type === "MCQ" || question.question_type === "TRUE_FALSE") {
      // Single-select: deselect all others
      setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
    } else {
      // MSQ: toggle individual
      setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, is_correct: !o.is_correct } : o)));
    }
  };

  const handleSave = () => {
    if (question.question_type === "SHORT_ANSWER") {
      const text = shortAnswerText.trim();
      onSave({
        ...question,
        options: text ? [{ text, is_correct: true }] : [],
        needs_review: !text,
        _imageFile: imageFile,
      });
      onClose();
      return;
    }

    const correctCount  = options.filter((o) => o.is_correct).length;
    const hasCorrect    = correctCount > 0;
    // Re-infer type from selection count (unless TRUE_FALSE)
    const inferredType: QuestionType =
      question.question_type === "TRUE_FALSE"
        ? "TRUE_FALSE"
        : correctCount > 1
        ? "MSQ"
        : "MCQ";

    onSave({
      ...question,
      options,
      question_type: inferredType,
      needs_review: !hasCorrect || question.confidence < 70,
      _imageFile: imageFile,
    });
    onClose();
  };

  const typeLabel: Record<QuestionType, string> = {
    MCQ:          "Single correct answer",
    MSQ:          "Multiple correct answers — toggle each",
    TRUE_FALSE:   "True / False",
    SHORT_ANSWER: "Short answer / fill in the blank",
  };

  const correctAnswers = options
    .map((o, i) => (o.is_correct ? `${String.fromCharCode(65 + i)}. ${o.text}` : null))
    .filter(Boolean);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, height: "100dvh",
        width: "min(500px, 96vw)", background: "#fff", zIndex: 1001,
        display: "flex", flexDirection: "column",
        boxShadow: "-6px 0 40px rgba(0,0,0,0.18)",
        animation: "sidebarSlideIn 0.22s cubic-bezier(.22,1,.36,1)",
      }}>
        <style>{`
          @keyframes sidebarSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          .aes-opt {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 13px 15px; border-radius: 10px;
            border: 1.5px solid #e5e7eb; cursor: pointer;
            transition: border-color .15s, background .15s;
            margin-bottom: 9px; user-select: none;
          }
          .aes-opt:hover { border-color: #8b1a1a33; background: #fafafa; }
          .aes-opt.correct { border-color: #059669; background: #ecfdf5; }
          .aes-opt:focus-visible { outline: 2px solid #8b1a1a; outline-offset: 2px; }
          .aes-marker {
            flex-shrink: 0; width: 22px; height: 22px;
            border-radius: 50%; border: 2px solid #d1d5db;
            display: flex; align-items: center; justify-content: center;
            transition: border-color .15s, background .15s; margin-top: 1px;
          }
          .aes-marker.square { border-radius: 5px; }
          .aes-opt.correct .aes-marker { border-color: #059669; background: #059669; }
          .aes-text { font-size: 14px; color: #1f2937; line-height: 1.5; flex: 1; }
          .aes-opt.correct .aes-text { color: #065f46; font-weight: 500; }
          .aes-letter { font-weight: 700; margin-right: 6px; color: #9ca3af; }
          .aes-opt.correct .aes-letter { color: #059669; }
          .aes-short-input {
            width: 100%; padding: 12px 14px; border-radius: 10px;
            border: 1.5px solid #e5e7eb; font-size: 14px; color: #1f2937;
            transition: border-color .15s; box-sizing: border-box;
          }
          .aes-short-input:focus { outline: none; border-color: #8b1a1a; }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "18px 20px 14px", borderBottom: "1px solid #f0f0f0",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b1a1a", marginBottom: 6 }}>
              Edit Answer
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1f2937", lineHeight: 1.5 }}>
              {question.question_text}
            </div>
          </div>
          <button onClick={onClose} type="button" title="Close (Esc)"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af", fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Type + meta hint */}
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 18 }}>
            {typeLabel[question.question_type]} · {question.marks} mark{question.marks !== 1 ? "s" : ""} · {question.difficulty}
          </div>

          {/* Image attachment (client-side only until question is saved) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <i className="ti ti-photo" style={{ fontSize: 12 }} /> Question Image
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#c1c7d0" }}>(optional)</span>
            </div>
            <QuestionImageUploader compact existingUrl={initialImagePreviewUrl} onFileSelected={setImageFile} />
          </div>

          {question.question_type === "SHORT_ANSWER" ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>
                Expected Answer
              </div>
              <input
                className="aes-short-input"
                placeholder="Type the expected answer…"
                value={shortAnswerText}
                onChange={(e) => setShortAnswerText(e.target.value)}
                autoFocus
              />
              {shortAnswerText.trim() ? (
                <div style={{
                  marginTop: 14, padding: "10px 14px",
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 8, fontSize: 13, color: "#065f46",
                }}>
                  <strong>Expected answer:</strong> {shortAnswerText.trim()}
                </div>
              ) : (
                <div style={{
                  marginTop: 14, padding: "10px 14px",
                  background: "#fff7ed", border: "1px solid #fed7aa",
                  borderRadius: 8, fontSize: 13, color: "#92400e",
                }}>
                  ⚠ No expected answer set — this question will be flagged for review.
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 12, color: "#9ca3af" }}>
                Free-text student answers will need manual or fuzzy-match grading against this expected answer.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>
                Select Correct Answer{question.question_type === "MSQ" ? "s" : ""}
              </div>

              {options.map((opt, idx) => {
                const isMulti = question.question_type === "MSQ";
                return (
                  <div
                    key={idx}
                    className={`aes-opt ${opt.is_correct ? "correct" : ""}`}
                    onClick={() => toggleOption(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleOption(idx); } }}
                  >
                    <div className={`aes-marker ${isMulti ? "square" : ""}`}>
                      {opt.is_correct && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="aes-text">
                      <span className="aes-letter">{String.fromCharCode(65 + idx)}.</span>
                      {opt.text}
                    </div>
                  </div>
                );
              })}

              {/* Summary */}
              {correctAnswers.length > 0 ? (
                <div style={{
                  marginTop: 14, padding: "10px 14px",
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 8, fontSize: 13, color: "#065f46",
                }}>
                  <strong>Marked correct:</strong> {correctAnswers.join("  ·  ")}
                </div>
              ) : (
                <div style={{
                  marginTop: 14, padding: "10px 14px",
                  background: "#fff7ed", border: "1px solid #fed7aa",
                  borderRadius: 8, fontSize: 13, color: "#92400e",
                }}>
                  ⚠ No correct answer selected — this question will be flagged for review.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 20px", borderTop: "1px solid #f0f0f0",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary"   type="button" onClick={handleSave}>
            <i className="ti ti-check" /> Save Answer
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PdfImportPanel  (with sidebar wired in; state lifted from parent)
// ─────────────────────────────────────────────────────────────────────────────

function PdfImportPanel({
  status, setStatus,
  extracted, setExtracted,
  error, setError,
  targetMarks, selectedMarksSum,
  onImported,
}: {
  status: ImportStatus; setStatus: (s: ImportStatus) => void;
  extracted: ExtractedQuestion[]; setExtracted: Dispatch<SetStateAction<ExtractedQuestion[]>>;
  error: string; setError: (e: string) => void;
  targetMarks?: number; selectedMarksSum?: number;
  onImported: (qs: ExtractedQuestion[]) => void;
}) {
  const [editingQuestion, setEditingQuestion] = useState<ExtractedQuestion | null>(null);
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
        setError("No questions could be extracted. Make sure questions are numbered (1., 2., … or Q.1, Q.2, …).");
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

  const approveAll = () =>
    setExtracted((list) => list.map((q) => ({ ...q, approved: true })));

  // Which approved rows should ALSO be selected into the exam being built
  // (as opposed to just saved to the question bank). Saving to the bank
  // never needs marks to add up — only rows checked here count toward the
  // exam's target, and only once you continue past the Questions step.
  const [addToExam, setAddToExam] = useState<Set<string>>(new Set());
  const toggleAddToExam = (id: string) =>
    setAddToExam((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Called by sidebar when user saves edited answers
  const handleAnswerSave = (updated: ExtractedQuestion) =>
    setExtracted((list) => list.map((q) => (q.id === updated.id ? updated : q)));

  const saveApproved = () => {
    const approved = extracted.filter((q) => q.approved);
    if (!approved.length) { setError("Approve at least one question first."); return; }
    const withExamFlag = approved.map((q) => ({ ...q, _addToExam: addToExam.has(q.id) }));
    setStatus("saving"); onImported(withExamFlag); setStatus("idle");
    setExtracted([]); setAddToExam(new Set()); setError("");
  };

  const reset = () => {
    setStatus("idle"); setExtracted([]); setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── idle ──
  if (status === "idle") {
    return (
      <div className="import-dropzone" onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".pdf,.docx" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <i className="ti ti-file-upload import-drop-icon" />
        <div className="import-drop-title">Import Questions from PDF or DOCX</div>
        <div className="import-drop-sub">
          Supports Google Forms PDFs, standard MCQ PDFs &amp; printed exam papers · Text-based PDFs only<br />
          MCQ, True/False &amp; Fill-in-the-Blank · Answers extracted from the PDF when present, otherwise inferred via AI
        </div>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        <button className="btn btn-secondary" type="button"><i className="ti ti-upload" /> Choose File</button>
      </div>
    );
  }

  // ── uploading / extracting ──
  if (status === "uploading" || status === "extracting") {
    return (
      <div className="import-processing">
        <span className="spinner" />
        <div className="import-proc-title">
          {status === "uploading" ? "Uploading file…" : "Extracting questions & answers…"}
        </div>
        <div className="import-proc-sub">
          {status === "extracting" ? "Reading answer keys, bold/colored markers, and inferring via AI only where needed" : "Uploading…"}
        </div>
      </div>
    );
  }

  // ── saving ──
  if (status === "saving") {
    return (
      <div className="import-processing">
        <span className="spinner" />
        <div className="import-proc-title">Saving questions to repository…</div>
      </div>
    );
  }

  // ── review ──
  if (status === "review") {
    const approvedCount = extracted.filter((q) => q.approved).length;
    const approvedMarksSum = extracted.filter((q) => q.approved).reduce((s, q) => s + q.marks, 0);
    const examMarksToAdd = extracted
      .filter((q) => q.approved && addToExam.has(q.id))
      .reduce((s, q) => s + q.marks, 0);
    const avgConf = extracted.length
      ? Math.round(extracted.reduce((s, q) => s + q.confidence, 0) / extracted.length)
      : 0;
    const setQuestionMarks = (id: string, marks: number) =>
      setExtracted((list) => list.map((q) => (q.id === id ? { ...q, marks } : q)));

    return (
      <div className="import-review">
        <style>{`
          .import-table tbody tr {
            cursor: pointer;
            transition: background 0.12s;
          }
          .import-table tbody tr:hover { background: #fafafa; }
          .edit-ans-chip {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 12px; color: #6b7280;
            padding: 3px 9px; border-radius: 6px;
            border: 1px solid #e5e7eb; background: #f9fafb;
            cursor: pointer; transition: border-color .12s, background .12s;
            white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis;
          }
          .edit-ans-chip:hover { border-color: #8b1a1a55; background: #fff5f5; color: #8b1a1a; }
          .edit-ans-chip.no-ans { color: #dc2626; border-color: #fca5a5; background: #fff5f5; }
          .row-hint {
            font-size: 12px; color: #9ca3af; margin-bottom: 10px;
            display: flex; align-items: center; gap: 6px;
          }
        `}</style>

        {/* Sidebar rendered in a portal-like manner above everything */}
        {editingQuestion && (
          <AnswerEditorSidebar
            question={editingQuestion}
            onClose={() => setEditingQuestion(null)}
            onSave={handleAnswerSave}
          />
        )}

        {/* Summary cards */}
        <div className="import-review-summary">
          <div className="import-summary-card"><span className="is-val">{extracted.length}</span><span className="is-lbl">Questions Found</span></div>
          <div className="import-summary-card"><span className="is-val">{extracted.filter((q) => q.question_type === "MCQ").length}</span><span className="is-lbl">MCQ</span></div>
          <div className="import-summary-card"><span className="is-val">{extracted.filter((q) => q.question_type === "MSQ").length}</span><span className="is-lbl">MSQ</span></div>
          <div className="import-summary-card"><span className="is-val">{extracted.filter((q) => q.question_type === "TRUE_FALSE").length}</span><span className="is-lbl">T/F</span></div>
          <div className="import-summary-card"><span className="is-val">{extracted.filter((q) => q.question_type === "SHORT_ANSWER").length}</span><span className="is-lbl">Fill-in-Blank</span></div>
          <div className="import-summary-card">
            <span className="is-val" style={{ color: confColor(avgConf) }}>{avgConf}%</span>
            <span className="is-lbl">Avg Confidence</span>
          </div>
          <div className="import-summary-card"><span className="is-val">{approvedCount}</span><span className="is-lbl">Approved</span></div>
          <div className="import-summary-card">
            <span className="is-val">{approvedMarksSum}</span>
            <span className="is-lbl">Approved Marks</span>
          </div>
          {examMarksToAdd > 0 && (
            <div className="import-summary-card">
              <span
                className="is-val"
                style={{ color: typeof targetMarks === "number" && (selectedMarksSum ?? 0) + examMarksToAdd > targetMarks ? "#dc2626" : undefined }}
              >
                {examMarksToAdd}
              </span>
              <span className="is-lbl">Marks Added to Exam</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, color: "#6b7280", margin: "-6px 0 14px" }}>
          <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
          Approved questions are always saved to your question bank — marks don't need to add up to anything for that.
          {typeof targetMarks === "number" && (
            <>
              {" "}Check <strong>Add to Exam</strong> on the questions you also want in this exam
              {typeof selectedMarksSum === "number" ? ` (currently ${selectedMarksSum} of ${targetMarks} marks selected)` : ""} —
              those marks only need to add up once you continue past this step.
            </>
          )}
        </div>

        <div className="import-table-wrap">
          <div className="import-table-actions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="row-hint">
              <i className="ti ti-pencil" />
              Click any row to view &amp; edit the answer — you can also attach an image there
            </div>
            <button className="btn btn-sm btn-secondary" onClick={approveAll} type="button">
              <i className="ti ti-check-all" /> Approve All
            </button>
          </div>

          <table className="import-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Question</th>
                <th>Type</th>
                <th>Marks</th>
                <th>Correct Answer(s)</th>
                <th>Confidence</th>
                <th>Approve</th>
                {typeof targetMarks === "number" && <th>Add to Exam</th>}
              </tr>
            </thead>
            <tbody>
              {extracted.map((q) => {
                const isShortAnswer = q.question_type === "SHORT_ANSWER";
                const correctAnswers = q.options.filter((o) => o.is_correct).map((o) => o.text);
                return (
                  <tr
                    key={q.id}
                    className={q.needs_review ? "row-review" : ""}
                    onClick={() => setEditingQuestion(q)}
                    title="Click to edit answer"
                  >
                    <td>
                      {q.needs_review && (
                        <i className="ti ti-alert-triangle" style={{ color: "#d97706" }} title="Needs review" />
                      )}
                    </td>
                    <td className="q-text-cell">
                      {q.question_text.slice(0, 80)}{q.question_text.length > 80 ? "…" : ""}
                      {q._imageFile && (
                        <span
                          title={`Image attached: ${q._imageFile.name}`}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            marginLeft: 8, fontSize: 11, color: "#0369a1",
                            background: "#f0f9ff", border: "1px solid #bae6fd",
                            borderRadius: 5, padding: "1px 6px", verticalAlign: "middle",
                          }}
                        >
                          <i className="ti ti-photo" style={{ fontSize: 10 }} /> Image
                        </span>
                      )}
                    </td>
                    <td><span className="q-type-badge">{isShortAnswer ? "FILL-BLANK" : q.question_type}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={q.marks}
                        onChange={(e) => setQuestionMarks(q.id, +e.target.value)}
                        style={{ width: 56, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}
                        title="Adjust marks for this question"
                      />
                    </td>
                    <td className="ans-cell">
                      {correctAnswers.length > 0 ? (
                        <span
                          className="edit-ans-chip"
                          onClick={(e) => { e.stopPropagation(); setEditingQuestion(q); }}
                          title="Click to change answer"
                        >
                          <i className="ti ti-pencil" style={{ fontSize: 11, flexShrink: 0 }} />
                          {correctAnswers.map((a) => a.slice(0, 22)).join(", ")}
                          {correctAnswers.some((a) => a.length > 22) ? "…" : ""}
                          {!isShortAnswer && <span className="ai-badge" title="From PDF or AI">✦</span>}
                        </span>
                      ) : (
                        <span
                          className="edit-ans-chip no-ans"
                          onClick={(e) => { e.stopPropagation(); setEditingQuestion(q); }}
                          title={isShortAnswer ? "Click to set expected answer" : "Click to set answer"}
                        >
                          <i className="ti ti-pencil" style={{ fontSize: 11, flexShrink: 0 }} />
                          {isShortAnswer ? "No expected answer — click to set" : "No answer — click to set"}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="conf-badge" style={{ color: confColor(q.confidence), borderColor: confColor(q.confidence) }}>
                        {q.confidence}%
                      </span>
                    </td>
                    <td>
                      <button
                        className={`approve-btn ${q.approved ? "approved" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleApprove(q.id); }}
                        type="button"
                      >
                        {q.approved ? <><i className="ti ti-check" /> Approved</> : "Approve"}
                      </button>
                    </td>
                    {typeof targetMarks === "number" && (
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={addToExam.has(q.id)}
                          disabled={!q.approved}
                          onChange={() => toggleAddToExam(q.id)}
                          title={q.approved ? "Also select this question into the current exam" : "Approve this question first"}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="import-review-actions">
          <button className="btn btn-secondary" onClick={reset} type="button">Cancel</button>
          <button
            className="btn btn-primary"
            onClick={saveApproved}
            disabled={approvedCount === 0}
            type="button"
          >
            <i className="ti ti-check" /> Save {approvedCount} Question{approvedCount !== 1 ? "s" : ""} to Repository
            {(() => {
              const examCount = extracted.filter((q) => q.approved && addToExam.has(q.id)).length;
              return examCount > 0 ? ` & Add ${examCount} to Exam` : "";
            })()}
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
  const [mcqCount,   setMcqCount]   = useState(10);
  const [msqCount,   setMsqCount]   = useState(5);
  const [tfCount,    setTfCount]    = useState(5);
  const [saCount,    setSaCount]    = useState(0);
  const [difficulty, setDifficulty] = useState<"MIXED" | Difficulty>("MIXED");
  const [error,      setError]      = useState("");

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
    const selected = [
      ...pick("MCQ", mcqCount),
      ...pick("MSQ", msqCount),
      ...pick("TRUE_FALSE", tfCount),
      ...pick("SHORT_ANSWER", saCount),
    ];
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
          <label>Fill-in-the-Blank Count</label>
          <input type="number" className="form-input" min={0} max={30} value={saCount}
            onChange={(e) => setSaCount(+e.target.value)} />
          <span className="field-hint">{questions.filter((q) => q.question_type === "SHORT_ANSWER").length} available</span>
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
        <i className="ti ti-wand" /> Generate Paper ({mcqCount + msqCount + tfCount + saCount} questions)
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Question Management
// ─────────────────────────────────────────────────────────────────────────────

function StepQuestions({ courseId, selectedIds, selectedQuestions, targetMarks, onToggle, onAddNew, onImported, onUpdateMarks, onQuestionUpdated, allQuestions, questionsLoading }: {
  courseId: string; selectedIds: Set<string>; selectedQuestions: Question[]; targetMarks: number;
  onToggle: (q: Question) => void;
  onAddNew: (q: Question) => void; onImported: (qs: ExtractedQuestion[]) => void;
  onUpdateMarks: (q: Question, marks: number) => void;
  onQuestionUpdated: (q: Question) => void;
  allQuestions: Question[]; questionsLoading: boolean;
}) {
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);
  const [tab,        setTab]        = useState<"select" | "create" | "import" | "auto">("select");
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDiff, setFilterDiff] = useState("");

  // ── Lifted PDF import state (survives tab switches, so switching to
  //    "Select Existing" or "Auto-Generate" mid-review no longer wipes the
  //    PDF import review table) ──
  const [pdfStatus,    setPdfStatus]    = useState<ImportStatus>("idle");
  const [pdfExtracted, setPdfExtracted] = useState<ExtractedQuestion[]>([]);
  const [pdfError,     setPdfError]     = useState("");

  const filtered = allQuestions.filter((q) => {
    const matchSearch = !search     || q.question_text.toLowerCase().includes(search.toLowerCase());
    const matchType   = !filterType || q.question_type === filterType;
    const matchDiff   = !filterDiff || q.difficulty    === filterDiff;
    return matchSearch && matchType && matchDiff;
  });

  const selectedMarksSum = selectedQuestions.reduce((s, q) => s + q.marks, 0);
  const remainingMarks   = targetMarks - selectedMarksSum;
  const marksMatch       = remainingMarks === 0;

  const tabs = [
    { id: "select", label: "Select Existing", icon: "ti-list-search"  },
    { id: "create", label: "Create Question", icon: "ti-pencil-plus"  },
    { id: "import", label: "Import from PDF", icon: "ti-file-upload"  },
    { id: "auto",   label: "Auto-Generate",   icon: "ti-wand"         },
  ] as const;

  return (
    <div className="step-panel">
      <div className="step-header">
        <h3>Question Management</h3>
        <p>Select questions from your repository, create new ones, or import from a PDF.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="selected-count-badge">
            {selectedIds.size} question{selectedIds.size !== 1 ? "s" : ""} selected for this exam
          </div>
          <div
            className="selected-count-badge"
            style={{
              background: marksMatch ? "#def8ee" : "#fff3d8",
              color: marksMatch ? "#08775b" : "#94600a",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <i className={`ti ${marksMatch ? "ti-circle-check" : "ti-alert-triangle"}`} />
            {selectedMarksSum} / {targetMarks} marks
            {!marksMatch && (
              <span>
                {" · "}{remainingMarks > 0 ? `${remainingMarks} more needed` : `${-remainingMarks} too many`}
              </span>
            )}
          </div>
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
              <option value="SHORT_ANSWER">Fill in the Blank</option>
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
                {allQuestions.length === 0
                  ? "Your repository is empty. Create questions or import from a PDF."
                  : "Try adjusting your filters."}
              </div>
            </div>
          ) : (
            <div className="q-list">
              {filtered.map((q) => (
                <QuestionRow key={q.id} q={q} selected={selectedIds.has(q.id)} onToggle={() => onToggle(q)} onUpdateMarks={onUpdateMarks} onView={setViewingQuestion} />
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "create" && (
        <CreateQuestionForm courseId={courseId} remainingMarks={remainingMarks} onSaved={(q) => { onAddNew(q); setTab("select"); }} />
      )}
      {tab === "import" && (
        <PdfImportPanel
          status={pdfStatus} setStatus={setPdfStatus}
          extracted={pdfExtracted} setExtracted={setPdfExtracted}
          error={pdfError} setError={setPdfError}
          targetMarks={targetMarks} selectedMarksSum={selectedMarksSum}
          onImported={(qs) => { onImported(qs); setTab("select"); }}
        />
      )}
      {tab === "auto" && (
        <AutoGeneratePanel questions={allQuestions}
          onGenerated={(selected) => { selected.forEach((q) => { if (!selectedIds.has(q.id)) onToggle(q); }); setTab("select"); }} />
      )}
      {viewingQuestion && (
        <ExistingQuestionDetailSidebar
          question={viewingQuestion}
          onClose={() => setViewingQuestion(null)}
          onSaved={(updated) => { onQuestionUpdated(updated); setViewingQuestion(null); }}
        />
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

      {/* Platform fullscreen notice */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "11px 15px", background: "#f0f7ff",
        border: "1.5px solid #bfdbfe", borderRadius: 10,
        marginBottom: 20, fontSize: 13, color: "#1e40af",
      }}>
        <i className="ti ti-maximize" style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          <strong>Fullscreen mode is always required</strong> — this is a platform-level rule that cannot be disabled.
          Use <em>Max fullscreen exits allowed</em> below to control how many exits a student may make before their exam
          is auto-submitted.
        </span>
      </div>

      <div className="rules-grid">
        <div className="rules-section">
          <h4 className="rules-section-title"><i className="ti ti-layout-board" /> Navigation</h4>
          {rule("allow_backtrack",   "Allow question backtracking")}
          {rule("allow_review_flag", "Allow mark for review")}
        </div>
        <div className="rules-section">
          <h4 className="rules-section-title"><i className="ti ti-shield" /> Proctoring</h4>
          {rule("enable_proctoring",   "Enable AI proctoring")}
          {rule("camera_required",     "Require camera access")}
          {rule("microphone_required", "Require microphone")}
        </div>
        <div className="rules-section">
          <h4 className="rules-section-title"><i className="ti ti-browser" /> Browser Integrity</h4>
          {rule("max_tab_switches",       "Max tab switches allowed",     "num", 0)}
          {rule("max_fullscreen_exits",   "Max fullscreen exits allowed", "num", 0)}
          <span className="field-hint" style={{ display: "block", marginTop: -6, marginBottom: 10, fontSize: 12, color: "#888" }}>
            Set 0 to log exits without auto-submitting.
          </span>
          {rule("auto_save_interval_sec", "Auto-save interval (sec)",     "num", 10)}
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
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 16px", background: "#f0f7ff",
        border: "1.5px solid #bfdbfe", borderRadius: 10,
        marginBottom: 24, fontSize: 13, color: "#1e40af",
      }}>
        <i className="ti ti-info-circle" style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Enter times in your local time (IST). These times are saved with the exam so students know when it will run.
          The exam remains invisible until you click <strong>Publish</strong> on your dashboard.
        </span>
      </div>
      <div className="form-grid-2col">
        <div className="form-field">
          <label>Start Time *</label>
          <input type="datetime-local" className="form-input"
            value={schedule.start_time} onChange={(e) => onChange({ start_time: e.target.value })} />
        </div>
        <div className="form-field">
          <label>End Time *</label>
          <input type="datetime-local" className="form-input"
            value={schedule.end_time} onChange={(e) => onChange({ end_time: e.target.value })} />
        </div>
        <div className="form-field">
          <label>Registration Deadline <span style={{ fontWeight: 400, color: "#aaa" }}>(optional)</span></label>
          <input type="datetime-local" className="form-input"
            value={schedule.registration_deadline} onChange={(e) => onChange({ registration_deadline: e.target.value })} />
          <span className="field-hint">Leave blank to allow registration up until exam start.</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Preview
// ─────────────────────────────────────────────────────────────────────────────

function StepPreview({ form, schedule, selectedQuestions, examId, isEditMode, justSaved }: {
  form: ExamForm; schedule: ScheduleForm; selectedQuestions: Question[];
  examId: string | null; isEditMode: boolean; justSaved: boolean;
}) {
  const totalMarks = selectedQuestions.reduce((s, q) => s + q.marks, 0);
  const byType     = selectedQuestions.reduce(
    (acc, q) => { acc[q.question_type] = (acc[q.question_type] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  const fmt = (dt: string) => dt ? new Date(`${dt}+05:30`).toLocaleString() : "—";

  if (justSaved) {
    return (
      <div className="step-panel">
        <div className="preview-success">
          <i className="ti ti-circle-check" style={{ fontSize: 48, color: "#059669" }} />
          <div className="preview-success-title">
            {isEditMode ? "Exam Updated Successfully!" : "Exam Created Successfully!"}
          </div>
          <div className="preview-success-sub" style={{ color: "#555", marginTop: 6 }}>
            {isEditMode
              ? "Your changes have been saved."
              : <>Saved as draft. Go to your dashboard and click <strong>Publish</strong> when you're ready to make it visible to students.</>}
          </div>
          {examId && (
            <div className="preview-success-sub" style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              Exam ID: {examId}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="step-panel">
      <div className="step-header">
        <h3>Review &amp; {isEditMode ? "Save" : "Create"}</h3>
        <p>
          Check everything below, then click <strong>{isEditMode ? "Save Changes" : "Create Exam"}</strong>.
          {!isEditMode && " You can publish from the dashboard whenever you're ready."}
        </p>
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
              <div key={type} className="preview-row"><span>{type === "SHORT_ANSWER" ? "FILL-BLANK" : type}</span><strong>{count}</strong></div>
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
      {!isEditMode && (
        <div style={{
          marginTop: 20, padding: "12px 16px",
          background: "#fff3d8", border: "1.5px solid #f5d76e",
          borderRadius: 10, fontSize: 13, color: "#5a3c00",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="ti ti-send" style={{ flexShrink: 0, color: "#94600a" }} />
          <span>
            This exam will be saved as a <strong>draft</strong>. To make it visible to students, go to your dashboard and click the <strong>Publish</strong> button on this exam's row.
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditLockedNotice
// ─────────────────────────────────────────────────────────────────────────────

function EditLockedNotice({ title, reason }: { title: string; reason: string }) {
  const navigate = useNavigate();
  return (
    <div className="workspace-card">
      <div className="workspace-body">
        <div className="empty-state" style={{ padding: "50px 20px" }}>
          <i className="ti ti-lock" style={{ fontSize: 40, color: "#dc2626" }} />
          <div className="empty-state-title" style={{ marginTop: 10 }}>Editing locked</div>
          <div className="empty-state-text" style={{ maxWidth: 420, margin: "6px auto 0" }}>
            <strong>{title}</strong> can no longer be edited. {reason}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => navigate("/faculty/dashboard")}>
            <i className="ti ti-arrow-left" /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — extract question id from various shapes
// ─────────────────────────────────────────────────────────────────────────────

function extractQuestionId(row: Record<string, unknown>): string | null {
  const nested = row["questions"] as Record<string, unknown> | undefined;
  if (nested && typeof nested["id"] === "string") return nested["id"];
  if (typeof row["question_id"] === "string") return row["question_id"] as string;
  if (typeof row["id"]          === "string") return row["id"]          as string;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page — CreateExam
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateExam() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient    = useQueryClient();

  const editExamId = searchParams.get("examId");
  const isEditMode = Boolean(editExamId) && searchParams.get("edit") === "true";

  const { data: portal, isLoading: portalLoading } = useFacultyDashboard();

  const [draftId,      setDraftId]      = useState(() => newDraftId());
  const [currentStep,  setCurrentStep]  = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState("");
  const [examId,       setExamId]       = useState<string | null>(null);
  const [justSaved,    setJustSaved]    = useState(false);

  const [editLoading,        setEditLoading]        = useState(isEditMode);
  const [editLoadError,      setEditLoadError]      = useState("");
  const [locked,             setLocked]             = useState(false);
  const [lockReason,         setLockReason]         = useState("");
  const [existingScheduleId, setExistingScheduleId] = useState<string | null>(null);
  const originalLinkedQuestionIds = useRef<Set<string>>(new Set());

  const [form,     setForm]     = useState<ExamForm>(() => ({
    ...defaultForm(),
    exam_type: searchParams.get("type") === "ENTRANCE" ? "ENTRANCE" : defaultForm().exam_type,
  }));
  const [rules,    setRules]    = useState(defaultRules);
  const [schedule, setSchedule] = useState<ScheduleForm>(defaultSchedule);

  const { data: serverQuestions = [], isLoading: questionsLoading } = useQuestions(
    form.course_id ? { course_id: form.course_id } : undefined,
  );
  const [locallyAddedQuestions, setLocallyAddedQuestions] = useState<Question[]>([]);

  const allQuestions: Question[] = [
    ...locallyAddedQuestions.filter((lq) => !serverQuestions.some((sq) => sq.id === lq.id)),
    ...serverQuestions,
  ];

  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const selectedIds = new Set(selectedQuestions.map((q) => q.id));

  // ── Load existing exam when editing ───────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !editExamId) return;
    let cancelled = false;

    (async () => {
      setEditLoading(true); setEditLoadError("");
      try {
        const [exam, questionRows, schedules, attempts] = await Promise.all([
          facultyApi.getExam(editExamId),
          facultyApi.getExamQuestions(editExamId).catch(() => []),
          facultyApi.listSchedules({ exam_id: editExamId }).catch(() => []),
          facultyApi.getExamAttempts(editExamId).catch(() => []),
        ]);
        if (cancelled) return;

        const scheduleRow  = schedules?.[0] ?? null;
        const now          = Date.now();
        const startPassed  = scheduleRow?.start_time ? new Date(scheduleRow.start_time).getTime() <= now : false;
        const hasAttempts  = Array.isArray(attempts) && attempts.length > 0;

        if (hasAttempts || startPassed) {
          setLocked(true);
          setLockReason(
            hasAttempts
              ? "Students have already started or completed attempts on this exam, so its content and rules are now locked."
              : "Its scheduled start time has already passed, so it can no longer be edited.",
          );
          setEditLoading(false);
          return;
        }

        setForm({
          title:             exam.title            ?? "",
          course_id:         exam.course_id        ?? "",
          exam_type:         (exam as any).exam_type ?? defaultForm().exam_type,
          duration_minutes:  exam.duration_minutes ?? defaultForm().duration_minutes,
          total_marks:       exam.total_marks      ?? defaultForm().total_marks,
          pass_marks:        exam.pass_marks       ?? defaultForm().pass_marks,
          instructions:      exam.instructions     ?? "",
          shuffle_questions: exam.shuffle_questions ?? false,
          shuffle_options:   exam.shuffle_options  ?? false,
        });

        const rawRules = Array.isArray(exam.exam_rules) ? exam.exam_rules[0] : exam.exam_rules;
        if (rawRules) {
          setRules({
            allow_backtrack:        rawRules.allow_backtrack        ?? true,
            allow_review_flag:      rawRules.allow_review_flag      ?? true,
            enable_proctoring:      rawRules.enable_proctoring      ?? false,
            camera_required:        rawRules.camera_required        ?? false,
            microphone_required:    rawRules.microphone_required    ?? false,
            max_tab_switches:       rawRules.max_tab_switches       ?? 3,
            max_fullscreen_exits:   rawRules.max_fullscreen_exits   ?? 3,
            auto_save_interval_sec: rawRules.auto_save_interval_sec ?? 30,
          });
        }

        if (scheduleRow) {
          setExistingScheduleId(scheduleRow.id);
          setSchedule({
            start_time:            toLocalInputString(scheduleRow.start_time),
            end_time:              toLocalInputString(scheduleRow.end_time),
            registration_deadline: toLocalInputString(scheduleRow.registration_deadline),
          });
        }

        const ids = (questionRows ?? [])
          .map((row) => extractQuestionId(row as Record<string, unknown>))
          .filter((id): id is string => Boolean(id));
        originalLinkedQuestionIds.current = new Set(ids);

        if (ids.length > 0) {
          const resolved = await Promise.all(ids.map((id) => facultyApi.getQuestion(id).catch(() => null)));
          if (!cancelled) setSelectedQuestions(resolved.filter((q): q is Question => Boolean(q)));
        }
      } catch (e: any) {
        if (!cancelled) setEditLoadError(e?.message ?? "Failed to load exam for editing.");
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isEditMode, editExamId]);

  // ── Auto-save draft ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isEditMode) return;
    if (!form.title && currentStep === 0 && selectedQuestions.length === 0) return;
    upsertDraft({
      draftId, savedAt: new Date().toISOString(), currentStep, form, rules, schedule,
      selectedQuestionIds: selectedQuestions.map((q) => q.id),
    });
  }, [isEditMode, draftId, currentStep, form, rules, schedule, selectedQuestions]);

  // ── Pending question resolution (after draft resume) ──────────────────────
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
    // Reuse the resumed draft's own ID — otherwise autosave keeps writing
    // under this mount's freshly-generated draftId, leaving the original
    // draft entry behind as a stale duplicate in the Saved Drafts list.
    setDraftId(draft.draftId);
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
      prev.some((p) => p.id === q.id) ? prev.filter((p) => p.id !== q.id) : [...prev, q],
    );
  };

  const handleAddNew = (q: Question, selectForExam: boolean = true) => {
    setLocallyAddedQuestions((prev) => prev.some((p) => p.id === q.id) ? prev : [q, ...prev]);
    if (selectForExam) {
      setSelectedQuestions((prev) => prev.some((p) => p.id === q.id) ? prev : [...prev, q]);
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions() });
  };

  // Update a question's marks in the repository (used from the "Select
  // Existing" tab so faculty can tweak marks to hit the exam's target
  // without leaving the exam builder). Also keeps any local copies of the
  // question — in the selected list and the locally-added list — in sync
  // so the marks total updates immediately.
  const handleUpdateQuestionMarks = async (q: Question, marks: number) => {
    setSelectedQuestions((prev) => prev.map((p) => (p.id === q.id ? { ...p, marks } : p)));
    setLocallyAddedQuestions((prev) => prev.map((p) => (p.id === q.id ? { ...p, marks } : p)));
    try {
      await facultyApi.updateQuestion(q.id, { marks });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions() });
    } catch (e) {
      console.error("Failed to update marks for question:", q.id, e);
      // Roll back the optimistic update on failure
      setSelectedQuestions((prev) => prev.map((p) => (p.id === q.id ? { ...p, marks: q.marks } : p)));
      setLocallyAddedQuestions((prev) => prev.map((p) => (p.id === q.id ? { ...p, marks: q.marks } : p)));
    }
  };

  // A question was fully edited (text/marks/difficulty/options/image) via
  // the "View / Edit" detail sidebar on the Select Existing tab — the API
  // calls already happened there; this just syncs local copies so the row,
  // the exam's selection, and the marks total all reflect the change
  // immediately without waiting on a refetch.
  const handleQuestionUpdated = (updated: Question) => {
    setSelectedQuestions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setLocallyAddedQuestions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions() });
  };

  const handleImported = async (qs: ExtractedQuestion[]) => {
    for (const q of qs) {
      try {
        const res  = await facultyApi.createQuestion({
          course_id: form.course_id || null, question_type: q.question_type,
          question_text: q.question_text, marks: q.marks, negative_marks: 0,
          difficulty: q.difficulty,
          // For SHORT_ANSWER, q.options holds at most one entry (the
          // expected answer text with is_correct=true) — same shape as
          // MCQ options, so no special-casing is needed here.
          options: q.options.map((o, i) => ({ option_text: o.text, is_correct: o.is_correct, order_index: i })),
          topics: [],
        });

        // If faculty attached an image during review (via the answer
        // editor sidebar's image uploader), upload it now that the
        // question row exists and has an id. Non-fatal on failure — the
        // question itself is still saved either way.
        if (q._imageFile) {
          try {
            await facultyApi.uploadQuestionImage(res.question_id, q._imageFile);
          } catch (imgErr) {
            console.error("Image upload failed for imported question:", q.question_text, imgErr);
          }
        }

        const full = await facultyApi.getQuestion(res.question_id);
        // Every approved question is saved to the repository regardless of
        // marks. Only the ones explicitly flagged "Add to Exam" during
        // review are also selected into this exam's question list.
        handleAddNew(full, !!q._addToExam);
      } catch (e) {
        console.error("Failed to save imported question:", q.question_text, e);
      }
    }
  };

  // ── Save / update exam ────────────────────────────────────────────────────
  const saveExam = async () => {
    setSaving(true); setSaveError("");
    try {
      const examFields = {
        title:             form.title,
        course_id:         form.course_id || null,
        exam_type:         form.exam_type,
        total_marks:       form.total_marks,
        pass_marks:        form.pass_marks,
        duration_minutes:  form.duration_minutes,
        shuffle_questions: form.shuffle_questions,
        shuffle_options:   form.shuffle_options,
        instructions:      form.instructions || null,
      };

      // Always force require_fullscreen true — platform-level rule
      const rulesPayload = { ...rules, require_fullscreen: true };

      let targetExamId: string;

      if (isEditMode && editExamId) {
        await facultyApi.updateExam(editExamId, examFields);
        targetExamId = editExamId;

        const originalIds  = originalLinkedQuestionIds.current;
        const selectedIdSet = new Set(selectedQuestions.map((q) => q.id));
        const toAdd        = selectedQuestions.filter((q) => !originalIds.has(q.id));
        const toRemove     = [...originalIds].filter((id) => !selectedIdSet.has(id));

        for (let i = 0; i < toAdd.length; i++) {
          await facultyApi.addQuestionToExam(targetExamId, { question_id: toAdd[i].id, order_index: originalIds.size + i });
        }
        for (const qid of toRemove) {
          await facultyApi.removeQuestionFromExam(targetExamId, qid);
        }

        await facultyApi.upsertExamRules({ exam_id: targetExamId, ...rulesPayload });

        const scheduleFields = {
          start_time:            schedule.start_time            ? toUTCString(schedule.start_time)            : null,
          end_time:              schedule.end_time              ? toUTCString(schedule.end_time)              : null,
          registration_deadline: schedule.registration_deadline ? toUTCString(schedule.registration_deadline) : null,
        };
        if (existingScheduleId) {
          await facultyApi.updateSchedule(existingScheduleId, scheduleFields);
        } else {
          await facultyApi.createExamSchedule({ exam_id: targetExamId, ...scheduleFields, is_published: true });
        }
      } else {
        const examData = await facultyApi.createExam({ ...examFields, status: "DRAFT" });
        targetExamId   = examData.id;

        for (let i = 0; i < selectedQuestions.length; i++) {
          await facultyApi.addQuestionToExam(targetExamId, { question_id: selectedQuestions[i].id, order_index: i });
        }

        await facultyApi.upsertExamRules({ exam_id: targetExamId, ...rulesPayload });

        await facultyApi.createExamSchedule({
          exam_id:               targetExamId,
          start_time:            schedule.start_time            ? toUTCString(schedule.start_time)            : null,
          end_time:              schedule.end_time              ? toUTCString(schedule.end_time)              : null,
          registration_deadline: schedule.registration_deadline ? toUTCString(schedule.registration_deadline) : null,
          is_published:          true,
        });

        deleteDraft(draftId);
      }

      setExamId(targetExamId);
      setJustSaved(true);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exams() });
    } catch (e: any) {
      setSaveError(e?.message ?? `Failed to ${isEditMode ? "save changes" : "create exam"}. Check all fields and try again.`);
    } finally {
      setSaving(false);
    }
  };

  const selectedMarksSum = selectedQuestions.reduce((s, q) => s + q.marks, 0);
  const marksMatchTarget = selectedMarksSum === form.total_marks;

  const canProceed = () => {
    if (currentStep === 0) return form.title.trim() && form.total_marks > 0 && form.pass_marks > 0;
    if (currentStep === 1) return selectedQuestions.length > 0 && marksMatchTarget;
    if (currentStep === 3) return !!schedule.start_time && !!schedule.end_time;
    return true;
  };

  const next = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1);
    else saveExam();
  };

  const [pageTab,    setPageTab]    = useState<"create" | "drafts">("create");
  const [draftCount, setDraftCount] = useState(() => loadDrafts().length);

  const handleResumeDraftAndSwitch = (draft: ExamDraft) => {
    handleResumeDraft(draft);
    setPageTab("create");
  };

  // ── Locked screen ─────────────────────────────────────────────────────────
  if (isEditMode && locked) {
    return (
      <FacultyLayout activePage="create-exam">
        <div className="page-heading">
          <div><h1>Edit Exam</h1><p>{form.title || "This exam"}</p></div>
        </div>
        <EditLockedNotice title={form.title || "This exam"} reason={lockReason} />
      </FacultyLayout>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <FacultyLayout activePage="create-exam">
      <PageState
        loading={portalLoading || editLoading}
        error={isEditMode && editLoadError ? editLoadError : undefined}
        onRetry={() => window.location.reload()}
      >
        <div className="create-exam-workspace">
          {!isEditMode && <RepositoryOverview portal={portal} />}

          <div className="workspace-card">
            {!examId && !isEditMode && (
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

            {pageTab === "drafts" && !examId && !isEditMode && (
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

            {(pageTab === "create" || !!examId || isEditMode) && (
              <>
                <div className="workspace-header">
                  <div>
                    <h2 className="workspace-title">
                      {justSaved
                        ? (isEditMode ? "Changes Saved!" : "Exam Created!")
                        : (isEditMode ? "Edit Exam" : "Create New Exam")}
                    </h2>
                    <p className="workspace-sub">
                      {justSaved
                        ? (isEditMode ? "Your changes are live." : "Saved as draft — go to your dashboard and click Publish when ready.")
                        : `Step ${currentStep + 1} of ${STEPS.length} · ${STEPS[currentStep].label}`}
                    </p>
                  </div>
                  {!justSaved && (
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
                      selectedQuestions={selectedQuestions} targetMarks={form.total_marks}
                      onToggle={toggleQuestion} onAddNew={handleAddNew} onImported={handleImported}
                      onUpdateMarks={handleUpdateQuestionMarks}
                      onQuestionUpdated={handleQuestionUpdated}
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
                      form={form} schedule={schedule}
                      selectedQuestions={selectedQuestions}
                      examId={examId} isEditMode={isEditMode} justSaved={justSaved}
                    />
                  )}
                </div>

                {!justSaved && (
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
                      {currentStep === 1 && !marksMatchTarget && (
                        <div className="form-error" style={{ textAlign: "center" }}>
                          {selectedQuestions.length === 0
                            ? `Select questions worth ${form.total_marks} marks to continue.`
                            : selectedMarksSum < form.total_marks
                              ? `Selected questions total ${selectedMarksSum} marks — add ${form.total_marks - selectedMarksSum} more mark${form.total_marks - selectedMarksSum !== 1 ? "s" : ""} to reach ${form.total_marks}.`
                              : `Selected questions total ${selectedMarksSum} marks — remove ${selectedMarksSum - form.total_marks} mark${selectedMarksSum - form.total_marks !== 1 ? "s" : ""} to reach ${form.total_marks}.`}
                        </div>
                      )}
                      {!isEditMode && form.title.trim() && (
                        <span className="draft-autosave-indicator"><i className="ti ti-device-floppy" /> Draft auto-saved</span>
                      )}
                    </div>
                    <div className="footer-right">
                      {currentStep < STEPS.length - 1 ? (
                        <button className="btn btn-primary" onClick={next} disabled={!canProceed()} type="button">
                          Next <i className="ti ti-chevron-right" />
                        </button>
                      ) : (
                        <button className="btn btn-primary" onClick={saveExam} disabled={saving} type="button">
                          {saving
                            ? <><span className="spinner-sm" /> {isEditMode ? "Saving…" : "Creating…"}</>
                            : <><i className="ti ti-check" /> {isEditMode ? "Save Changes" : "Create Exam"}</>}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {justSaved && (
                  <div className="workspace-footer">
                    <button className="btn btn-primary" onClick={() => navigate("/faculty/dashboard")} type="button">
                      <i className="ti ti-home" /> Go to Dashboard{!isEditMode ? " to Publish" : ""}
                    </button>
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