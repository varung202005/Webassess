import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { Loading, ErrorBlock, EmptyState, PageHeading } from "../../features/faculty/components";
import { useFacultyDashboard, useExams, useFacultyAction } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import type { ExamSection, ExamRule } from "../../features/faculty/types";

/* ── Mutation helpers ─────────────────────────────────────── */
function useCreateExam() {
  return useFacultyAction(
    (body: Record<string, unknown>) => facultyApi.createExam(body),
    [["exams"]],
  );
}

function useCreateSection() {
  return useFacultyAction(
    (body: Record<string, unknown>) => facultyApi.createExamSection(body),
    [["exam-sections"]],
  );
}

function useUpsertRules() {
  return useFacultyAction(
    (body: Record<string, unknown>) => facultyApi.upsertExamRules(body),
    [["exam-rules"]],
  );
}

function useCreateSchedule() {
  return useFacultyAction(
    (body: Record<string, unknown>) => facultyApi.createSchedule(body),
    [["exam-schedules"]],
  );
}

/* ── Types ─────────────────────────────────────────────────── */
interface SectionDraft {
  title: string;
  question_count: number;
  marks_per_question: number;
  question_type: string;
}

interface ExamDraft {
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

interface RuleDraft {
  allow_backtrack: boolean;
  mark_for_review: boolean;
  require_fullscreen: boolean;
  enable_proctoring: boolean;
  camera_required: boolean;
  microphone_required: boolean;
  max_tab_switches: number;
  auto_save_interval_seconds: number;
}

interface ScheduleDraft {
  start_time: string;
  end_time: string;
  department_ids: string[];
}

const STEPS = ["Basic Info", "Sections", "Questions", "Rules", "Schedule", "Preview"];

const EXAM_TYPES = ["MID_SEMESTER", "END_SEMESTER", "QUIZ", "UNIT_TEST", "PRACTICE"];

const SECTION_TYPES = ["MCQ", "MSQ", "TRUE_FALSE", "SHORT_ANSWER", "LONG_ANSWER"];

/* ── Step Components ───────────────────────────────────────── */

function StepBasicInfo({
  draft,
  setDraft,
  courses,
  onNext,
}: {
  draft: ExamDraft;
  setDraft: (d: ExamDraft) => void;
  courses: Array<{ id: string; name: string; code: string }>;
  onNext: () => void;
}) {
  const set = <K extends keyof ExamDraft>(key: K, val: ExamDraft[K]) =>
    setDraft({ ...draft, [key]: val });

  return (
    <div className="form-section" id="step1-form">
      <div className="form-section-title">
        <i className="ti ti-info-circle" /> Basic Exam Information
      </div>

      <div className="form-row form-row-full">
        <div className="form-group">
          <label className="form-label">
            Exam Title <span>*</span>
          </label>
          <input
            className="form-control"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Data Structures Mid Semester 2025"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Course <span>*</span>
          </label>
          <select
            className="form-control"
            value={draft.course_id}
            onChange={(e) => set("course_id", e.target.value)}
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Exam Type</label>
          <select
            className="form-control"
            value={draft.exam_type}
            onChange={(e) => set("exam_type", e.target.value)}
          >
            {EXAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row form-row-3">
        <div className="form-group">
          <label className="form-label">
            Duration (minutes) <span>*</span>
          </label>
          <input
            className="form-control"
            type="number"
            value={draft.duration_minutes}
            min={1}
            onChange={(e) => set("duration_minutes", Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">
            Total Marks <span>*</span>
          </label>
          <input
            className="form-control"
            type="number"
            value={draft.total_marks}
            min={1}
            onChange={(e) => set("total_marks", Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">
            Pass Marks <span>*</span>
          </label>
          <input
            className="form-control"
            type="number"
            value={draft.pass_marks}
            min={1}
            onChange={(e) => set("pass_marks", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="form-row form-row-full">
        <div className="form-group">
          <label className="form-label">Instructions</label>
          <textarea
            className="form-control"
            rows={4}
            value={draft.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="Exam instructions for students…"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13.5px", cursor: "pointer" }}>
          <input type="checkbox" checked={draft.shuffle_questions} onChange={(e) => set("shuffle_questions", e.target.checked)} />
          Shuffle questions
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13.5px", cursor: "pointer" }}>
          <input type="checkbox" checked={draft.shuffle_options} onChange={(e) => set("shuffle_options", e.target.checked)} />
          Shuffle answer options
        </label>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="btn btn-primary" onClick={onNext} disabled={!draft.title || !draft.course_id}>
          <i className="ti ti-arrow-right" /> Next: Sections
        </button>
      </div>
    </div>
  );
}

function StepSections({
  sections,
  setSections,
  onBack,
  onNext,
}: {
  sections: SectionDraft[];
  setSections: (s: SectionDraft[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [newSection, setNewSection] = useState<SectionDraft>({
    title: "",
    question_count: 10,
    marks_per_question: 2,
    question_type: "MCQ",
  });

  const addSection = () => {
    if (!newSection.title) return;
    setSections([...sections, { ...newSection }]);
    setNewSection({ title: "", question_count: 10, marks_per_question: 2, question_type: "MCQ" });
    setShowModal(false);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const totalMarksFromSections = sections.reduce(
    (sum, s) => sum + s.question_count * s.marks_per_question,
    0,
  );

  return (
    <div className="form-section">
      <div className="form-section-title">
        <i className="ti ti-layout-columns" /> Exam Sections
      </div>
      <p style={{ fontSize: 13, color: "var(--c-gray-600)", marginBottom: 20 }}>
        Divide your exam into logical sections. Each section can have its own marks allocation and question pool.
      </p>

      <div className="section-builder">
        <div className="section-builder-hdr">
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-gray-600)" }}>
            {sections.length} SECTIONS ·{" "}
            {sections.reduce((s, sec) => s + sec.question_count, 0)} QUESTIONS TOTAL
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <i className="ti ti-plus" /> Add Section
          </button>
        </div>

        {sections.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--c-gray-500)" }}>
            <i className="ti ti-layout-columns" style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }} />
            <div>No sections yet. Add your first exam section.</div>
          </div>
        )}

        {sections.map((sec, idx) => (
          <div className="section-row" key={idx}>
            <i className="ti ti-grip-vertical section-drag" />
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--c-primary-100)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--c-primary-700)",
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </div>
            <div className="section-info">
              <div className="section-name">{sec.title}</div>
              <div className="section-meta">
                {sec.question_count} questions · {sec.marks_per_question} marks each ·{" "}
                {sec.question_count * sec.marks_per_question} total marks · {sec.question_type}
              </div>
            </div>
            <div className="section-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => removeSection(idx)}>
                <i className="ti ti-trash" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {sections.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
            padding: "12px 14px",
            background: "var(--c-gray-50)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--c-border)",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--c-gray-600)" }}>
            Marks tally:{" "}
            <strong>
              {sections.map((s, i) => `${s.question_count * s.marks_per_question}`).join(" + ")} = {totalMarksFromSections}
            </strong>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--c-success-700)",
            }}
          >
            <i className="ti ti-check" /> Total: {totalMarksFromSections} marks
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <i className="ti ti-arrow-left" /> Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Next: Questions <i className="ti ti-arrow-right" />
        </button>
      </div>

      {/* Add Section Modal */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            className="modal"
            style={{ maxWidth: 480 }}
          >
            <div
              style={{
                padding: "22px 24px",
                borderBottom: "1px solid var(--c-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--c-gray-900)" }}>
                Add Exam Section
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--c-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--c-gray-600)",
                  background: "#fff",
                }}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">
                  Section Title <span style={{ color: "var(--c-danger-500)" }}>*</span>
                </label>
                <input
                  className="form-control"
                  placeholder="e.g. Section A — MCQ"
                  value={newSection.title}
                  onChange={(e) =>
                    setNewSection({ ...newSection, title: e.target.value })
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div className="form-group">
                  <label className="form-label">Question Count</label>
                  <input
                    className="form-control"
                    type="number"
                    value={newSection.question_count}
                    min={1}
                    onChange={(e) =>
                      setNewSection({
                        ...newSection,
                        question_count: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Marks per Question</label>
                  <input
                    className="form-control"
                    type="number"
                    value={newSection.marks_per_question}
                    min={1}
                    onChange={(e) =>
                      setNewSection({
                        ...newSection,
                        marks_per_question: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Question Type</label>
                <select
                  className="form-control"
                  value={newSection.question_type}
                  onChange={(e) =>
                    setNewSection({ ...newSection, question_type: e.target.value })
                  }
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === "TRUE_FALSE"
                        ? "True / False"
                        : t === "SHORT_ANSWER"
                          ? "Short Answer"
                          : t === "LONG_ANSWER"
                            ? "Long Answer"
                            : t}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={addSection}>
                  <i className="ti ti-plus" /> Add Section
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepQuestions({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="form-section">
      <div className="form-section-title">
        <i className="ti ti-books" /> Question Selection
      </div>
      <p style={{ fontSize: 13, color: "var(--c-gray-600)", marginBottom: 20 }}>
        Select questions for each section from your question bank.
      </p>

      <div
        style={{
          padding: 32,
          textAlign: "center",
          background: "var(--c-gray-50)",
          borderRadius: "var(--radius-lg)",
          border: "2px dashed var(--c-border)",
        }}
      >
        <i className="ti ti-books" style={{ fontSize: 40, color: "var(--c-gray-300)", marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-gray-600)", marginBottom: 4 }}>
          Question Selection Coming Soon
        </div>
        <div style={{ fontSize: 13, color: "var(--c-gray-500)", marginBottom: 16 }}>
          Pick questions from your bank to create the exam paper. You can filter by topic, type, and difficulty.
        </div>
        <button className="btn btn-primary" disabled>
          <i className="ti ti-plus" /> Browse Question Bank
        </button>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <i className="ti ti-arrow-left" /> Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Next: Rules <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  );
}

function StepRules({
  rules,
  setRules,
  onBack,
  onNext,
}: {
  rules: RuleDraft;
  setRules: (r: RuleDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const set = <K extends keyof RuleDraft>(key: K, val: RuleDraft[K]) =>
    setRules({ ...rules, [key]: val });

  return (
    <div className="form-section">
      <div className="form-section-title">
        <i className="ti ti-shield" /> Exam Rules
      </div>

      <div className="rules-grid">
        {[
          { key: "allow_backtrack" as const, label: "Allow Backtrack", sub: "Students can revisit answered questions" },
          { key: "mark_for_review" as const, label: "Mark for Review", sub: "Enable flag for review button" },
          { key: "require_fullscreen" as const, label: "Require Fullscreen", sub: "Force fullscreen mode during exam" },
          { key: "enable_proctoring" as const, label: "Enable Proctoring", sub: "Face, browser, audio monitoring" },
          { key: "camera_required" as const, label: "Camera Required", sub: "Block exam if camera unavailable" },
          { key: "microphone_required" as const, label: "Microphone Required", sub: "Block exam if mic unavailable" },
        ].map(({ key, label, sub }) => (
          <div className="toggle-row" key={key}>
            <div>
              <div className="toggle-label">{label}</div>
              <div className="toggle-sub">{sub}</div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={rules[key]}
                onChange={(e) => set(key, e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        ))}
      </div>

      <div className="form-row" style={{ marginTop: 16 }}>
        <div className="form-group">
          <label className="form-label">Max Tab Switches Allowed</label>
          <input
            className="form-control"
            type="number"
            value={rules.max_tab_switches}
            min={1}
            onChange={(e) => set("max_tab_switches", Number(e.target.value))}
          />
          <span className="form-hint">Exam auto-submits if exceeded</span>
        </div>
        <div className="form-group">
          <label className="form-label">Auto-save Interval (seconds)</label>
          <input
            className="form-control"
            type="number"
            value={rules.auto_save_interval_seconds}
            min={5}
            onChange={(e) => set("auto_save_interval_seconds", Number(e.target.value))}
          />
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <i className="ti ti-arrow-left" /> Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Next: Schedule <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  );
}

function StepSchedule({
  schedule,
  setSchedule,
  departments,
  onBack,
  onNext,
}: {
  schedule: ScheduleDraft;
  setSchedule: (s: ScheduleDraft) => void;
  departments: Array<{ id: string; name: string; code: string }>;
  onBack: () => void;
  onNext: () => void;
}) {
  const set = <K extends keyof ScheduleDraft>(key: K, val: ScheduleDraft[K]) =>
    setSchedule({ ...schedule, [key]: val });

  const toggleDept = (id: string) => {
    const has = schedule.department_ids.includes(id);
    set(
      "department_ids",
      has
        ? schedule.department_ids.filter((d) => d !== id)
        : [...schedule.department_ids, id],
    );
  };

  return (
    <div className="form-section">
      <div className="form-section-title">
        <i className="ti ti-calendar-event" /> Exam Schedule
      </div>

      <div className="form-row form-row-full">
        <div className="form-group">
          <label className="form-label">
            Start Time <span>*</span>
          </label>
          <input
            className="form-control"
            type="datetime-local"
            value={schedule.start_time}
            onChange={(e) => set("start_time", e.target.value)}
          />
        </div>
      </div>

      <div className="form-row form-row-full">
        <div className="form-group">
          <label className="form-label">
            End Time <span>*</span>
          </label>
          <input
            className="form-control"
            type="datetime-local"
            value={schedule.end_time}
            onChange={(e) => set("end_time", e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Target Departments</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {departments.map((d) => (
            <span
              key={d.id}
              className={`filter-chip ${schedule.department_ids.includes(d.id) ? "active" : ""}`}
              onClick={() => toggleDept(d.id)}
            >
              {d.code || d.name}
            </span>
          ))}
        </div>
        {schedule.department_ids.length === 0 && (
          <span className="form-hint">Select at least one department to make the exam available.</span>
        )}
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <i className="ti ti-arrow-left" /> Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Next: Preview <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  );
}

function StepPreview({
  draft,
  sections,
  rules,
  schedule,
  departments,
  courses,
  isSaving,
  onBack,
  onSave,
}: {
  draft: ExamDraft;
  sections: SectionDraft[];
  rules: RuleDraft;
  schedule: ScheduleDraft;
  departments: Array<{ id: string; name: string; code: string }>;
  courses: Array<{ id: string; name: string; code: string }>;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  const course = courses.find((c) => c.id === draft.course_id);
  const totalQ = sections.reduce((s, sec) => s + sec.question_count, 0);
  const totalM = sections.reduce((s, sec) => s + sec.question_count * sec.marks_per_question, 0);
  const deptNames = schedule.department_ids
    .map((id) => departments.find((d) => d.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="form-section">
      <div className="form-section-title">
        <i className="ti ti-eye" /> Exam Preview
      </div>

      <div
        style={{
          background: "var(--c-primary-50)",
          border: "1px solid var(--c-primary-200)",
          borderRadius: "var(--radius-lg)",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--c-primary-800)", marginBottom: 12 }}>
          {draft.title || "Untitled Exam"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div>
            <div className="form-label">Course</div>
            <div style={{ fontWeight: 600 }}>{course ? `${course.code} · ${course.name}` : "-"}</div>
          </div>
          <div>
            <div className="form-label">Duration</div>
            <div style={{ fontWeight: 600 }}>{draft.duration_minutes} minutes</div>
          </div>
          <div>
            <div className="form-label">Total Marks</div>
            <div style={{ fontWeight: 600 }}>{totalM || draft.total_marks}</div>
          </div>
          <div>
            <div className="form-label">Pass Marks</div>
            <div style={{ fontWeight: 600 }}>{draft.pass_marks}</div>
          </div>
          <div>
            <div className="form-label">Questions</div>
            <div style={{ fontWeight: 600 }}>{totalQ}</div>
          </div>
          <div>
            <div className="form-label">Status</div>
            <span className="badge badge-draft">
              <span className="badge-dot" /> DRAFT
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 8 }}>Sections ({sections.length})</div>
        {sections.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--c-gray-500)" }}>No sections defined.</div>
        )}
        {sections.map((sec, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderBottom: "1px solid var(--c-gray-100)",
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 500 }}>{sec.title}</span>
            <span style={{ color: "var(--c-gray-600)" }}>
              {sec.question_count} Q × {sec.marks_per_question} marks = {sec.question_count * sec.marks_per_question}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 8 }}>Schedule</div>
        {schedule.start_time ? (
          <div style={{ fontSize: 13 }}>
            {new Date(schedule.start_time).toLocaleString()} → {new Date(schedule.end_time).toLocaleString()}
            {deptNames && <span style={{ color: "var(--c-gray-500)", marginLeft: 8 }}>· {deptNames}</span>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--c-gray-500)" }}>Not scheduled yet</div>
        )}
      </div>

      <div>
        <div className="form-label" style={{ marginBottom: 4 }}>Rules</div>
        <div style={{ fontSize: 13, color: "var(--c-gray-600)" }}>
          {rules.allow_backtrack && "· Backtrack allowed"} {rules.mark_for_review && "· Mark for review"}{" "}
          {rules.require_fullscreen && "· Fullscreen required"} {rules.enable_proctoring && "· Proctoring enabled"}{" "}
          {!rules.allow_backtrack && !rules.mark_for_review && !rules.require_fullscreen && !rules.enable_proctoring && "Default rules"}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <i className="ti ti-arrow-left" /> Back
        </button>
        <button className="btn btn-primary" onClick={onSave} disabled={isSaving}>
          <i className={`ti ${isSaving ? "ti-loader spinner" : "ti-device-floppy"}`} />
          {isSaving ? "Saving…" : "Create Exam"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function CreateExam() {
  const navigate = useNavigate();
  const { data: portal } = useFacultyDashboard();
  const courses = portal?.courses ?? [];
  const departments = portal?.departments ?? [];

  const [step, setStep] = useState(0);
  const [examDraft, setExamDraft] = useState<ExamDraft>({
    title: "",
    course_id: "",
    exam_type: "MID_SEMESTER",
    duration_minutes: 120,
    total_marks: 80,
    pass_marks: 32,
    instructions: "",
    shuffle_questions: true,
    shuffle_options: true,
  });
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [rules, setRules] = useState<RuleDraft>({
    allow_backtrack: true,
    mark_for_review: true,
    require_fullscreen: true,
    enable_proctoring: true,
    camera_required: true,
    microphone_required: false,
    max_tab_switches: 3,
    auto_save_interval_seconds: 30,
  });
  const [schedule, setSchedule] = useState<ScheduleDraft>({
    start_time: "",
    end_time: "",
    department_ids: [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const createExamMut = useCreateExam();
  const createSectionMut = useCreateSection();
  const upsertRulesMut = useUpsertRules();
  const createScheduleMut = useCreateSchedule();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Create exam
      const exam = await createExamMut.mutateAsync({
        title: examDraft.title,
        course_id: examDraft.course_id,
        exam_type: examDraft.exam_type,
        duration_minutes: examDraft.duration_minutes,
        total_marks: examDraft.total_marks,
        pass_marks: examDraft.pass_marks,
        instructions: examDraft.instructions,
        shuffle_questions: examDraft.shuffle_questions,
        shuffle_options: examDraft.shuffle_options,
        status: "DRAFT",
        semester: new Date().getFullYear().toString(),
      });
      const examId = (exam as any).id ?? (exam as any).exam_id;

      // 2. Create sections
      for (const sec of sections) {
        await createSectionMut.mutateAsync({
          exam_id: examId,
          section_title: sec.title,
          question_type: sec.question_type,
          question_count: sec.question_count,
          marks_per_question: sec.marks_per_question,
          total_marks: sec.question_count * sec.marks_per_question,
        });
      }

      // 3. Upsert rules
      await upsertRulesMut.mutateAsync({
        exam_id: examId,
        ...rules,
      });

      // 4. Create schedule if times provided
      if (schedule.start_time && schedule.end_time) {
        for (const deptId of schedule.department_ids.length > 0
          ? schedule.department_ids
          : [""]) {
          await createScheduleMut.mutateAsync({
            exam_id: examId,
            start_time: new Date(schedule.start_time).toISOString(),
            end_time: new Date(schedule.end_time).toISOString(),
            ...(deptId ? { department_id: deptId } : {}),
          });
        }
      }

      navigate("/faculty/dashboard");
    } catch {
      // Error handled by react-query
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepBasicInfo
            draft={examDraft}
            setDraft={setExamDraft}
            courses={courses}
            onNext={nextStep}
          />
        );
      case 1:
        return (
          <StepSections
            sections={sections}
            setSections={setSections}
            onBack={prevStep}
            onNext={nextStep}
          />
        );
      case 2:
        return <StepQuestions onBack={prevStep} onNext={nextStep} />;
      case 3:
        return (
          <StepRules
            rules={rules}
            setRules={setRules}
            onBack={prevStep}
            onNext={nextStep}
          />
        );
      case 4:
        return (
          <StepSchedule
            schedule={schedule}
            setSchedule={setSchedule}
            departments={departments}
            onBack={prevStep}
            onNext={nextStep}
          />
        );
      case 5:
        return (
          <StepPreview
            draft={examDraft}
            sections={sections}
            rules={rules}
            schedule={schedule}
            departments={departments}
            courses={courses}
            isSaving={isSaving}
            onBack={prevStep}
            onSave={handleSave}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FacultyLayout activePage="create-exam">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          <div className="page-title">Create New Exam</div>
          <div className="page-subtitle">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/faculty/dashboard")}>
            <i className="ti ti-device-floppy" /> Save Draft
          </button>
        </div>
      </div>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 100 }}>
            <div
              className={`step-item ${i < step ? "done" : ""} ${i === step ? "active" : ""}`}
              style={{ cursor: i < step ? "pointer" : "default" }}
              onClick={() => i < step && setStep(i)}
            >
              <div className="step-num">
                {i < step ? <i className="ti ti-check" style={{ fontSize: 12 }} /> : i + 1}
              </div>
              <div className="step-label">{label}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`step-connector ${i < step ? "done" : ""}`} />}
          </div>
        ))}
      </div>

      <div className="wizard-body">{renderStep()}</div>
    </FacultyLayout>
  );
}
