import { useState, useCallback, useEffect } from "react";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { Loading, ErrorBlock, EmptyState, PageHeading } from "../../features/faculty/components";
import { useQuestions, useFacultyDashboard, useFacultyAction } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import { statusBadgeClass, statusLabel, difficultyBadge, typeBadge } from "../../features/faculty/format";
import { downloadExcel } from "../../lib/exportExcel";
import type { Question } from "../../features/faculty/types";

/* ── Helpers ───────────────────────────────────────────────── */
function useCreateQuestion() {
  return useFacultyAction(
    (body: Record<string, unknown>) => facultyApi.createQuestion(body),
    [["questions"]],
  );
}

function useUpdateQuestion() {
  return useFacultyAction(
    ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      facultyApi.updateQuestion(id, body),
    [["questions"]],
  );
}

function useDeleteQuestion() {
  return useFacultyAction(
    (id: string) => facultyApi.deleteQuestion(id),
    [["questions"]],
  );
}

type QuestionFormData = {
  question_text: string;
  question_type: string;
  difficulty: string;
  marks: number;
  negative_marks: number;
  course_id: string;
  topic: string;
  options: Array<{ id?: string; text: string; is_correct: boolean }>;
};

const initialForm: QuestionFormData = {
  question_text: "",
  question_type: "MCQ",
  difficulty: "MEDIUM",
  marks: 2,
  negative_marks: 0,
  course_id: "",
  topic: "",
  options: [
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ],
};

const QUESTION_TYPES = ["MCQ", "MSQ", "TRUE_FALSE", "SHORT_ANSWER", "LONG_ANSWER"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

/* ── Create/Edit Panel ─────────────────────────────────────── */
function QuestionFormPanel({
  editingId,
  initial,
  courses,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  initial: QuestionFormData;
  courses: Array<{ id: string; name: string; code: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<QuestionFormData>(initial);
  const createMut = useCreateQuestion();
  const updateMut = useUpdateQuestion();
  const isSaving = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    setForm(initial);
  }, [initial, editingId]);

  const set = (key: keyof QuestionFormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleTypeChange = (qt: string) => {
    set("question_type", qt);
    if (qt === "TRUE_FALSE") {
      set("options", [
        { text: "True", is_correct: true },
        { text: "False", is_correct: false },
      ]);
    } else if (qt === "SHORT_ANSWER" || qt === "LONG_ANSWER") {
      set("options", []);
    } else if (form.options.length < 2) {
      set("options", [
        { text: "", is_correct: false },
        { text: "", is_correct: false },
      ]);
    }
  };

  const toggleCorrect = (idx: number) => {
    if (form.question_type === "MCQ") {
      setForm((f) => ({
        ...f,
        options: f.options.map((o, i) => ({ ...o, is_correct: i === idx })),
      }));
    } else {
      setForm((f) => ({
        ...f,
        options: f.options.map((o, i) =>
          i === idx ? { ...o, is_correct: !o.is_correct } : o,
        ),
      }));
    }
  };

  const updateOption = (idx: number, text: string) => {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === idx ? { ...o, text } : o)),
    }));
  };

  const addOption = () => {
    if (form.options.length >= 6) return;
    setForm((f) => ({ ...f, options: [...f.options, { text: "", is_correct: false }] }));
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2 && !["SHORT_ANSWER", "LONG_ANSWER"].includes(form.question_type)) return;
    setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    const body: Record<string, unknown> = {
      question_text: form.question_text,
      question_type: form.question_type,
      difficulty: form.difficulty,
      marks: form.marks,
      negative_marks: form.negative_marks,
      course_id: form.course_id,
    };

    if (form.topic) {
      body.topics = [{ topic: form.topic, difficulty: form.difficulty }];
    }

    if (!["SHORT_ANSWER", "LONG_ANSWER"].includes(form.question_type)) {
      // FIX: the backend's option schema uses `order_index` (0-based) and
      // `id` (to update an existing option in place) — this previously sent
      // `option_order`, a key the backend never recognized, so edited
      // options (including a changed correct answer) were silently dropped
      // and never actually saved.
      body.options = form.options.map((o, i) => ({
        ...(o.id ? { id: o.id } : {}),
        option_text: o.text,
        is_correct: o.is_correct,
        order_index: i,
      }));
    }

    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, ...body } as any);
      } else {
        await createMut.mutateAsync(body);
      }
      onSaved();
    } catch {
      // Error handled by react-query
    }
  };

  const showOptions = !["SHORT_ANSWER", "LONG_ANSWER"].includes(form.question_type);

  return (
    <>
      <div className="panel-header">
        <div className="panel-title">{editingId ? "Edit Question" : "Create New Question"}</div>
        <button className="panel-close" onClick={onClose}>
          <i className="ti ti-x" />
        </button>
      </div>
      <div className="panel-body">
        {/* Type */}
        <div className="form-group">
          <div className="form-label">
            Question Type <span className="required">*</span>
          </div>
          <div className="type-selector">
            {QUESTION_TYPES.map((t) => (
              <button
                key={t}
                className={`type-btn ${form.question_type === t ? "active" : ""}`}
                onClick={() => handleTypeChange(t)}
              >
                {t === "TRUE_FALSE"
                  ? "T/F"
                  : t === "SHORT_ANSWER"
                    ? "Short Ans."
                    : t === "LONG_ANSWER"
                      ? "Long Ans."
                      : t}
              </button>
            ))}
          </div>
        </div>

        {/* Course + Difficulty */}
        <div className="form-row">
          <div className="form-group">
            <div className="form-label">
              Course <span className="required">*</span>
            </div>
            <select
              className="form-control form-select"
              value={form.course_id}
              onChange={(e) => set("course_id", e.target.value)}
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <div className="form-label">
              Difficulty <span className="required">*</span>
            </div>
            <select
              className="form-control form-select"
              value={form.difficulty}
              onChange={(e) => set("difficulty", e.target.value)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Topic */}
        <div className="form-group">
          <div className="form-label">Topic</div>
          <input
            className="form-control"
            placeholder="e.g. Sorting Algorithms"
            value={form.topic}
            onChange={(e) => set("topic", e.target.value)}
          />
        </div>

        <div style={{ height: 1, background: "var(--c-border)", margin: "20px 0" }} />

        {/* Question Text */}
        <div className="form-group">
          <div className="form-label">
            Question Text <span className="required">*</span>
          </div>
          <textarea
            className="form-control"
            rows={4}
            placeholder="Enter the question here…"
            value={form.question_text}
            onChange={(e) => set("question_text", e.target.value)}
          />
        </div>

        {/* Marks */}
        <div className="form-row">
          <div className="form-group">
            <div className="form-label">
              Marks <span className="required">*</span>
            </div>
            <input
              type="number"
              className="form-control"
              value={form.marks}
              min={1}
              onChange={(e) => set("marks", Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <div className="form-label">Negative Marks</div>
            <input
              type="number"
              className="form-control"
              value={form.negative_marks}
              min={0}
              step={0.25}
              onChange={(e) => set("negative_marks", Number(e.target.value))}
            />
          </div>
        </div>

        {showOptions && (
          <>
            <div style={{ height: 1, background: "var(--c-border)", margin: "20px 0" }} />
            <div className="form-group">
              <div className="form-label" style={{ marginBottom: 10 }}>
                Options <span className="required">*</span>{" "}
                <span style={{ fontSize: 11, color: "var(--c-gray-500)", fontWeight: 400 }}>
                  Click ✓ to mark correct answer
                </span>
              </div>
              <div className="options-builder">
                {form.options.map((opt, idx) => (
                  <div className="option-row" key={idx}>
                    <div
                      className={`option-indicator ${opt.is_correct ? "correct" : ""}`}
                      onClick={() => toggleCorrect(idx)}
                      title="Mark as correct"
                    >
                      <i className="ti ti-check" />
                    </div>
                    <input
                      className="option-input"
                      placeholder={`Option ${String.fromCharCode(65 + idx)}…`}
                      value={opt.text}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      readOnly={form.question_type === "TRUE_FALSE"}
                    />
                    {form.question_type !== "TRUE_FALSE" && (
                      <div className="option-del" onClick={() => removeOption(idx)}>
                        <i className="ti ti-trash" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {form.question_type !== "TRUE_FALSE" && form.options.length < 6 && (
                <div className="add-option-btn" onClick={addOption}>
                  <i className="ti ti-plus" style={{ fontSize: 14 }} /> Add option
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="panel-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          <i className={`ti ${isSaving ? "ti-loader spinner" : "ti-device-floppy"}`} />
          {editingId ? "Update" : "Save Question"}
        </button>
      </div>
    </>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function QuestionBank() {
  const { data: portal } = useFacultyDashboard();
  const courses = portal?.courses ?? [];

  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<QuestionFormData>(initialForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const filters = {
    ...(filterCourse && { course_id: filterCourse }),
    ...(filterType && { question_type: filterType }),
    ...(filterDifficulty && { difficulty: filterDifficulty }),
  };

  const { data: questionsData, isLoading, isError, error, refetch } = useQuestions(filters);
  const deleteMut = useDeleteQuestion();

  const allQuestions = Array.isArray(questionsData) ? questionsData : [];
  const filtered = search
    ? allQuestions.filter(
        (q) =>
          q.question_text?.toLowerCase().includes(search.toLowerCase()),
      )
    : allQuestions;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openCreate = () => {
    setEditingId(null);
    setFormInitial(initialForm);
    setPanelOpen(true);
  };

  const openEdit = useCallback(
    (q: Question) => {
      setEditingId(q.id);
      setFormInitial({
        question_text: q.question_text ?? "",
        question_type: q.question_type,
        difficulty: q.difficulty ?? "MEDIUM",
        marks: q.marks ?? 1,
        negative_marks: q.negative_marks ?? 0,
        course_id: q.course_id ?? "",
        topic: "",
        options:
          q.question_options?.map((o: any) => ({
            id: o.id,
            text: o.option_text ?? o.text ?? "",
            is_correct: o.is_correct ?? false,
          })) ?? [],
      });
      setPanelOpen(true);
    },
    [],
  );

  const handleSaved = () => {
    setPanelOpen(false);
    setEditingId(null);
    refetch();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((q) => q.id)));
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      deleteMut.mutate(id, { onSuccess: () => refetch() });
    }
  };

  const activeFilters = [
    ...(filterCourse ? [courses.find((c) => c.id === filterCourse)?.code ?? filterCourse] : []),
    ...(filterType ? [filterType] : []),
    ...(filterDifficulty ? [filterDifficulty] : []),
  ];

  const exportQuestions = () => {
    downloadExcel("question-bank", [{ name: "Questions", rows: filtered.map((question) => ({
      Question: question.question_text ?? "", Type: question.question_type ?? "", Difficulty: question.difficulty ?? "",
      Marks: question.marks ?? "", Negative_Marks: question.negative_marks ?? "", Course: question.courses?.name ?? "",
      Course_Code: question.courses?.code ?? "", Active: question.is_active !== false ? "Yes" : "No",
    })) }]);
  };

  return (
    <FacultyLayout activePage="question-bank">
      <PageHeading
        title="Question Bank"
        subtitle={`${allQuestions.length} questions across all courses`}
        actions={
          <>
            <button className="btn btn-secondary">
              <i className="ti ti-upload" /> Import CSV
            </button>
            <button className="btn btn-primary" onClick={openCreate}>
              <i className="ti ti-plus" /> New Question
            </button>
          </>
        }
      />

      {/* Stats chips */}
      <div className="stats-row">
        {(() => {
          const byType: Record<string, number> = {};
          const active = allQuestions.filter((q) => q.is_active !== false).length;
          for (const q of allQuestions) {
            byType[q.question_type] = (byType[q.question_type] ?? 0) + 1;
          }
          return (
            <>
              <div className="stat-chip">
                <div>
                  <div className="stat-chip-val">{allQuestions.length}</div>
                  <div className="stat-chip-label">Total</div>
                </div>
              </div>
              <div className="stat-chip">
                <div>
                  <div className="stat-chip-val" style={{ color: "var(--c-primary-700)" }}>
                    {byType["MCQ"] ?? 0}
                  </div>
                  <div className="stat-chip-label">MCQ</div>
                </div>
              </div>
              <div className="stat-chip">
                <div>
                  <div className="stat-chip-val" style={{ color: "#4C1D95" }}>
                    {byType["MSQ"] ?? 0}
                  </div>
                  <div className="stat-chip-label">MSQ</div>
                </div>
              </div>
              <div className="stat-chip">
                <div>
                  <div className="stat-chip-val" style={{ color: "var(--c-warning-700)" }}>
                    {(byType["SHORT_ANSWER"] ?? 0) + (byType["SHORT"] ?? 0)}
                  </div>
                  <div className="stat-chip-label">Short Answer</div>
                </div>
              </div>
              <div className="stat-chip">
                <div>
                  <div className="stat-chip-val" style={{ color: "var(--c-success-700)" }}>
                    {(byType["LONG_ANSWER"] ?? 0) + (byType["LONG"] ?? 0)}
                  </div>
                  <div className="stat-chip-label">Long Answer</div>
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <div className="stat-chip" style={{ background: "var(--c-success-100)", borderColor: "var(--c-success-500)" }}>
                <div>
                  <div className="stat-chip-val" style={{ color: "var(--c-success-700)" }}>
                    {active}
                  </div>
                  <div className="stat-chip-label" style={{ color: "var(--c-success-700)" }}>
                    Active
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Split Layout */}
      <div className="split-layout">
        {/* LEFT: Table */}
        <div className="split-left">
          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="search-wrap">
              <i className="ti ti-search" />
              <input
                className="search-input"
                placeholder="Search questions…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <select
              className="select-filter form-select"
              value={filterCourse}
              onChange={(e) => {
                setFilterCourse(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select
              className="select-filter form-select"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Types</option>
              {QUESTION_TYPES.map((t) => (
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
            <select
              className="select-filter form-select"
              value={filterDifficulty}
              onChange={(e) => {
                setFilterDifficulty(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Difficulty</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={exportQuestions}>
              <i className="ti ti-download" /> Export
            </button>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div
              style={{
                padding: "8px 20px",
                background: "#fff",
                borderBottom: "1px solid var(--c-border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--c-gray-600)" }}>Active filters:</span>
              {filterCourse && (
                <span className="filter-chip active">
                  <i
                    className="ti ti-x"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setFilterCourse("");
                      setPage(0);
                    }}
                  />
                  {courses.find((c) => c.id === filterCourse)?.code ?? filterCourse}
                </span>
              )}
              {filterType && (
                <span className="filter-chip active">
                  <i
                    className="ti ti-x"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setFilterType("");
                      setPage(0);
                    }}
                  />
                  {filterType}
                </span>
              )}
              {filterDifficulty && (
                <span className="filter-chip active">
                  <i
                    className="ti ti-x"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setFilterDifficulty("");
                      setPage(0);
                    }}
                  />
                  {filterDifficulty}
                </span>
              )}
              <span
                style={{ fontSize: 12, color: "var(--c-primary-700)", cursor: "pointer", fontWeight: 500, marginLeft: 4 }}
                onClick={() => {
                  setFilterCourse("");
                  setFilterType("");
                  setFilterDifficulty("");
                  setPage(0);
                }}
              >
                Clear all
              </span>
            </div>
          )}

          {/* Bulk bar */}
          <div className={`bulk-bar ${selectedIds.size > 0 ? "visible" : ""}`}>
            <i className="ti ti-checkbox" style={{ fontSize: 16 }} />
            <span>{selectedIds.size}</span> questions selected
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm btn-danger" onClick={() => {
              selectedIds.forEach((id) => deleteMut.mutate(id));
              setSelectedIds(new Set());
            }}>
              <i className="ti ti-trash" /> Delete
            </button>
          </div>

          {/* Table */}
          <div className="table-wrap">
            {isLoading ? (
              <Loading text="Loading questions…" />
            ) : isError ? (
              <ErrorBlock error={error} onRetry={() => refetch()} />
            ) : paged.length === 0 ? (
              <EmptyState
                icon="ti ti-books"
                title="No questions found"
                text={search || activeFilters.length > 0 ? "Try adjusting your filters." : "Create your first question to get started."}
                action={
                  <button className="btn btn-primary" onClick={openCreate}>
                    <i className="ti ti-plus" /> New Question
                  </button>
                }
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" onChange={toggleAll} checked={selectedIds.size === paged.length && paged.length > 0} />
                    </th>
                    <th className="sortable">
                      Question <i className="ti ti-selector" style={{ fontSize: 11, opacity: 0.5 }} />
                    </th>
                    <th>Type</th>
                    <th>Difficulty</th>
                    <th className="sortable">
                      Marks <i className="ti ti-selector" style={{ fontSize: 11, opacity: 0.5 }} />
                    </th>
                    <th>Status</th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((q) => (
                    <tr
                      key={q.id}
                      className={selectedIds.has(q.id) ? "selected" : ""}
                      onClick={() => openEdit(q)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(q.id)}
                          onChange={() => toggleSelect(q.id)}
                        />
                      </td>
                      <td className="q-text-cell">
                        <div className="q-text-preview">{q.question_text}</div>
                        <div className="q-text-sub">
                          <span className="q-text-sub-item">
                            <i className="ti ti-tag" />
                            {(q as any).topic ?? (q as any).topics?.[0]?.topic ?? "General"}
                          </span>
                          <span className="q-text-sub-item">
                            <i className="ti ti-book" />
                            {(q as any).course_code ?? ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${typeBadge(q.question_type)}`}>
                          {q.question_type === "TRUE_FALSE" ? "T/F" : q.question_type === "SHORT_ANSWER" ? "Short" : q.question_type === "LONG_ANSWER" ? "Long" : q.question_type}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${difficultyBadge(q.difficulty ?? "MEDIUM")}`}>
                          {q.difficulty ?? "MEDIUM"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{q.marks}</td>
                      <td>
                        <span className={`badge ${q.is_active !== false ? "badge-active" : "badge-inactive"}`}>
                          {q.is_active !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                          <button className="action-btn" title="Edit" onClick={() => openEdit(q)}>
                            <i className="ti ti-pencil" />
                          </button>
                          <button className="action-btn danger" title="Delete" onClick={() => handleDelete(q.id)}>
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          <div className="table-footer">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} questions
            </span>
            <div className="pagination">
              <button className="page-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <i className="ti ti-chevron-left" style={{ fontSize: 12 }} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                const pg = start + i;
                return (
                  <button
                    key={pg}
                    className={`page-btn ${pg === page ? "active" : ""}`}
                    onClick={() => setPage(pg)}
                  >
                    {pg + 1}
                  </button>
                );
              })}
              <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <i className="ti ti-chevron-right" style={{ fontSize: 12 }} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Create/Edit Panel */}
        <div className={`split-right ${panelOpen ? "" : "collapsed"}`}>
          {panelOpen && (
            <QuestionFormPanel
              editingId={editingId}
              initial={formInitial}
              courses={courses}
              onClose={() => {
                setPanelOpen(false);
                setEditingId(null);
              }}
              onSaved={handleSaved}
            />
          )}
        </div>
      </div>
    </FacultyLayout>
  );
}
