/**
 * FacultyCandidateManager
 *
 * Embedded as a tab inside CreateExam (or accessible standalone) when
 * exam_type === 'ENTRANCE'. Faculty can:
 *   - Add candidates manually (name + email + optional phone + optional temp password)
 *   - Upload a CSV
 *   - View all assigned candidates with their status
 *   - Copy invitation links
 *
 * Props:
 *   examScheduleId  — UUID of the schedule to assign candidates to
 *   examTitle       — display name for the exam
 *   onClose         — callback to go back
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "../../lib/api";

const css = `
.cm-wrap { font-family: var(--font); }
.cm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.cm-title { font-size: 18px; font-weight: 700; color: var(--c-gray-900); letter-spacing: -.3px; }
.cm-subtitle { font-size: 13px; color: var(--c-gray-500); margin-top: 2px; }

.cm-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--c-gray-200); margin-bottom: 24px; }
.cm-tab { padding: 8px 20px; font-size: 13.5px; font-weight: 600; color: var(--c-gray-500); border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: var(--font); transition: color .12s; }
.cm-tab.active { color: var(--c-primary-700); border-bottom-color: var(--c-primary-700); }

/* Add manually form */
.cm-form { background: var(--c-gray-50); border: 1px solid var(--c-gray-200); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
.cm-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.cm-form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.cm-form-group { display: flex; flex-direction: column; gap: 5px; }
.cm-label { font-size: 12px; font-weight: 600; color: var(--c-gray-700); text-transform: uppercase; letter-spacing: .4px; }
.cm-input { padding: 8px 11px; border: 1px solid var(--c-gray-300); border-radius: 7px; font-size: 14px; font-family: var(--font); color: var(--c-gray-800); outline: none; transition: border-color .12s; background: #fff; }
.cm-input:focus { border-color: var(--c-primary-600); box-shadow: 0 0 0 3px rgba(196,30,58,.07); }
.cm-hint { font-size: 11.5px; color: var(--c-gray-400); }
.cm-form-actions { display: flex; justify-content: flex-end; gap: 8px; }

/* CSV upload */
.cm-csv-zone { border: 2px dashed var(--c-gray-300); border-radius: 10px; padding: 36px; text-align: center; cursor: pointer; transition: border-color .12s, background .12s; }
.cm-csv-zone:hover, .cm-csv-zone.drag { border-color: var(--c-primary-600); background: rgba(196,30,58,.03); }
.cm-csv-zone i { font-size: 32px; color: var(--c-gray-400); display: block; margin-bottom: 10px; }
.cm-csv-zone p { font-size: 14px; color: var(--c-gray-600); }
.cm-csv-zone small { font-size: 12px; color: var(--c-gray-400); }
.cm-csv-preview { margin-top: 16px; }
.cm-csv-preview table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cm-csv-preview th { background: var(--c-gray-100); padding: 7px 10px; text-align: left; font-weight: 600; color: var(--c-gray-700); border-bottom: 1px solid var(--c-gray-200); }
.cm-csv-preview td { padding: 7px 10px; border-bottom: 1px solid var(--c-gray-100); color: var(--c-gray-800); }
.cm-csv-preview tr:last-child td { border-bottom: none; }

/* Candidate list */
.cm-table-wrap { overflow-x: auto; }
.cm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cm-table th { background: var(--c-gray-50); padding: 9px 12px; text-align: left; font-size: 11.5px; font-weight: 700; color: var(--c-gray-500); text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid var(--c-gray-200); }
.cm-table td { padding: 11px 12px; border-bottom: 1px solid var(--c-gray-100); vertical-align: middle; }
.cm-table tr:last-child td { border-bottom: none; }
.cm-table tr:hover td { background: var(--c-gray-50); }
.cm-name { font-weight: 600; color: var(--c-gray-900); }
.cm-email { color: var(--c-gray-600); font-size: 12.5px; }

.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
.badge-invited { background: #EFF6FF; color: #1D4ED8; }
.badge-started { background: #FFFBEB; color: #92400E; }
.badge-completed { background: #ECFDF5; color: #065F46; }
.badge-expired { background: var(--c-gray-100); color: var(--c-gray-600); }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: var(--font); transition: all .12s; }
.btn-primary { background: var(--c-primary-700); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--c-primary-800); }
.btn-secondary { background: var(--c-gray-100); color: var(--c-gray-700); border: 1px solid var(--c-gray-200); }
.btn-secondary:hover:not(:disabled) { background: var(--c-gray-200); }
.btn-ghost { background: none; color: var(--c-primary-700); padding: 4px 8px; font-size: 12.5px; }
.btn-ghost:hover { background: rgba(196,30,58,.07); }
.btn:disabled { opacity: .5; cursor: not-allowed; }

.cm-empty { text-align: center; padding: 48px 24px; color: var(--c-gray-500); font-size: 14px; }
.cm-empty i { font-size: 36px; color: var(--c-gray-300); display: block; margin-bottom: 12px; }

.cm-error { background: var(--c-danger-100); border: 1px solid #FCA5A5; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--c-danger-700); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.cm-success { background: #ECFDF5; border: 1px solid #6EE7B7; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #047857; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

.cm-copied { position: fixed; bottom: 24px; right: 24px; background: var(--c-gray-900); color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 500; z-index: 999; animation: fadeIn .15s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@media(max-width:640px) { .cm-form-row, .cm-form-row-3 { grid-template-columns: 1fr; } }
`;

interface CandidateRow {
  assignment_id: string;
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string;
  invitation_status: "INVITED" | "STARTED" | "COMPLETED" | "EXPIRED";
  invitation_token: string;
  login_url: string;
  assigned_at: string;
  attempt_status?: string | null;
  submitted_at?: string | null;
  score?: number | null;
  percentage?: number | null;
}

interface Props {
  examScheduleId: string;
  examTitle: string;
}

interface ManualEntry {
  full_name: string;
  email: string;
  phone: string;
  temp_password: string;
}

const emptyEntry = (): ManualEntry => ({ full_name: "", email: "", phone: "", temp_password: "" });

function statusBadge(status: string) {
  const map: Record<string, string> = {
    INVITED: "badge-invited",
    STARTED: "badge-started",
    COMPLETED: "badge-completed",
    EXPIRED: "badge-expired",
  };
  return <span className={`badge ${map[status] ?? "badge-invited"}`}>{status}</span>;
}

function parseCSV(text: string): ManualEntry[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  // Skip header row, parse: name,email,phone,temp_password (phone & pw optional)
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      full_name: cols[0] ?? "",
      email: cols[1] ?? "",
      phone: cols[2] ?? "",
      temp_password: cols[3] ?? "",
    };
  }).filter((e) => e.full_name && e.email);
}

export default function FacultyCandidateManager({ examScheduleId, examTitle }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"list" | "add" | "csv">("list");
  const [entry, setEntry] = useState<ManualEntry>(emptyEntry());
  const [csvRows, setCSVRows] = useState<ManualEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: candidates = [], isLoading } = useQuery<CandidateRow[]>({
    queryKey: ["faculty", "candidates", examScheduleId],
    queryFn: () => get<CandidateRow[]>(`/api/v1/faculty/candidates/${examScheduleId}`),
    enabled: Boolean(examScheduleId),
  });

  const assignMutation = useMutation({
    mutationFn: (entries: ManualEntry[]) =>
      post<{ assigned: number; results: unknown[] }>("/api/v1/faculty/candidates/assign", {
        exam_schedule_id: examScheduleId,
        candidates: entries.map((e) => ({
          full_name: e.full_name,
          email: e.email,
          phone: e.phone || null,
          temp_password: e.temp_password || null,
        })),
      }),
    onSuccess: (data: any) => {
      const assigned = data?.assigned ?? 0;
      setNotice({ type: "success", msg: `${assigned} candidate(s) assigned successfully.` });
      setEntry(emptyEntry());
      setCSVRows([]);
      qc.invalidateQueries({ queryKey: ["faculty", "candidates", examScheduleId] });
      setActiveTab("list");
    },
    onError: (err: Error) => {
      setNotice({ type: "error", msg: err.message || "Failed to assign candidates." });
    },
  });

  const handleCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target?.result as string);
      setCSVRows(rows);
      setNotice(rows.length ? null : { type: "error", msg: "No valid rows found. Ensure CSV has headers: name,email,phone,temp_password" });
    };
    reader.readAsText(file);
  };

  const copyLink = async (url: string) => {
    const full = `${window.location.origin}${url}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canSubmitManual = entry.full_name.trim() && entry.email.includes("@");

  return (
    <div className="cm-wrap">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="cm-header">
        <div>
          <div className="cm-title">Candidate Management</div>
          <div className="cm-subtitle">{examTitle} — {candidates.length} candidate(s) assigned</div>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "cm-error" : "cm-success"}>
          <i className={`ti ti-${notice.type === "error" ? "alert-circle" : "circle-check"}`} />
          {notice.msg}
          <button style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }} onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <div className="cm-tabs">
        <button className={`cm-tab ${activeTab === "list" ? "active" : ""}`} onClick={() => setActiveTab("list")}>
          <i className="ti ti-users" /> Candidates ({candidates.length})
        </button>
        <button className={`cm-tab ${activeTab === "add" ? "active" : ""}`} onClick={() => setActiveTab("add")}>
          <i className="ti ti-user-plus" /> Add Manually
        </button>
        <button className={`cm-tab ${activeTab === "csv" ? "active" : ""}`} onClick={() => setActiveTab("csv")}>
          <i className="ti ti-upload" /> Upload CSV
        </button>
      </div>

      {/* ── Tab: List ─────────────────────────────────────────────────── */}
      {activeTab === "list" && (
        <>
          {isLoading ? (
            <div className="cm-empty"><i className="ti ti-loader-2" style={{ animation: "spin .8s linear infinite" }} /> Loading candidates…</div>
          ) : candidates.length === 0 ? (
            <div className="cm-empty">
              <i className="ti ti-user-off" />
              No candidates assigned yet. Use "Add Manually" or "Upload CSV" to get started.
            </div>
          ) : (
            <div className="cm-table-wrap">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Status</th>
                    <th>Attempt</th>
                    <th>Score</th>
                    <th>Invitation Link</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.assignment_id}>
                      <td>
                        <div className="cm-name">{c.full_name}</div>
                        <div className="cm-email">{c.email}</div>
                        {c.phone && <div className="cm-email">{c.phone}</div>}
                      </td>
                      <td>{statusBadge(c.invitation_status)}</td>
                      <td>
                        {c.attempt_status ? (
                          <span style={{ fontSize: 12.5 }}>{c.attempt_status}{c.submitted_at ? ` · ${new Date(c.submitted_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}` : ""}</span>
                        ) : (
                          <span style={{ color: "var(--c-gray-400)", fontSize: 12.5 }}>Not started</span>
                        )}
                      </td>
                      <td>
                        {c.score != null ? (
                          <span style={{ fontWeight: 600 }}>{c.score} <span style={{ color: "var(--c-gray-500)", fontWeight: 400 }}>({c.percentage?.toFixed(1)}%)</span></span>
                        ) : (
                          <span style={{ color: "var(--c-gray-400)", fontSize: 12.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-ghost" onClick={() => copyLink(c.login_url)}>
                          <i className="ti ti-copy" /> Copy Link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Add Manually ─────────────────────────────────────────── */}
      {activeTab === "add" && (
        <div className="cm-form">
          <div className="cm-form-row">
            <div className="cm-form-group">
              <label className="cm-label">Full Name *</label>
              <input className="cm-input" placeholder="Jane Smith" value={entry.full_name} onChange={(e) => setEntry((v) => ({ ...v, full_name: e.target.value }))} />
            </div>
            <div className="cm-form-group">
              <label className="cm-label">Email *</label>
              <input className="cm-input" type="email" placeholder="jane@company.com" value={entry.email} onChange={(e) => setEntry((v) => ({ ...v, email: e.target.value }))} />
            </div>
          </div>
          <div className="cm-form-row">
            <div className="cm-form-group">
              <label className="cm-label">Phone <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
              <input className="cm-input" placeholder="+91 98765 43210" value={entry.phone} onChange={(e) => setEntry((v) => ({ ...v, phone: e.target.value }))} />
            </div>
            <div className="cm-form-group">
              <label className="cm-label">Temp Password <span style={{ fontWeight: 400, textTransform: "none" }}>(auto-generated if blank)</span></label>
              <input className="cm-input" placeholder="Leave blank to auto-generate" value={entry.temp_password} onChange={(e) => setEntry((v) => ({ ...v, temp_password: e.target.value }))} />
              <span className="cm-hint">Share this password with the candidate along with the invitation link.</span>
            </div>
          </div>
          <div className="cm-form-actions">
            <button className="btn btn-secondary" onClick={() => setEntry(emptyEntry())}>Clear</button>
            <button
              className="btn btn-primary"
              disabled={!canSubmitManual || assignMutation.isPending}
              onClick={() => assignMutation.mutate([entry])}
            >
              {assignMutation.isPending ? <><i className="ti ti-loader-2" /> Assigning…</> : <><i className="ti ti-user-plus" /> Assign Candidate</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: CSV Upload ───────────────────────────────────────────── */}
      {activeTab === "csv" && (
        <>
          <div
            className={`cm-csv-zone ${dragging ? "drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}
            onClick={() => fileRef.current?.click()}
          >
            <i className="ti ti-upload" />
            <p>Drag & drop a CSV file, or click to browse</p>
            <small>Format: <code>name,email,phone,temp_password</code> — phone and temp_password are optional</small>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }} />
          </div>

          {csvRows.length > 0 && (
            <div className="cm-csv-preview">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-gray-700)", marginBottom: 10 }}>
                {csvRows.length} candidate(s) found — review before importing:
              </div>
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Phone</th><th>Password</th></tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{r.full_name}</td>
                      <td>{r.email}</td>
                      <td>{r.phone || "—"}</td>
                      <td>{r.temp_password ? "••••••" : <em style={{ color: "var(--c-gray-400)" }}>auto</em>}</td>
                    </tr>
                  ))}
                  {csvRows.length > 10 && <tr><td colSpan={4} style={{ color: "var(--c-gray-500)", fontStyle: "italic" }}>…and {csvRows.length - 10} more</td></tr>}
                </tbody>
              </table>
              <div className="cm-form-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => setCSVRows([])}>Clear</button>
                <button
                  className="btn btn-primary"
                  disabled={assignMutation.isPending}
                  onClick={() => assignMutation.mutate(csvRows)}
                >
                  {assignMutation.isPending ? <><i className="ti ti-loader-2" /> Importing…</> : <><i className="ti ti-upload" /> Import {csvRows.length} Candidate(s)</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {copied && <div className="cm-copied"><i className="ti ti-check" /> Link copied to clipboard</div>}
    </div>
  );
}
