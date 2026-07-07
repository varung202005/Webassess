import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "../../lib/api";
import { useAuthStore, type Role } from "../../store/authStore";
import ProctorDashboard from "../proctor/Dashboard";

type AdminTab = "overview" | "users" | "candidates" | "proctor" | "audit";
type ApiRole = "Admin" | "Faculty" | "Proctor" | "Student" | "Candidate";

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  roles: ApiRole[];
}

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  is_published: boolean;
  exams?: {
    id: string;
    title: string;
    exam_type?: string;
    status?: string;
    duration_minutes?: number;
    courses?: { code?: string; name?: string } | null;
  } | null;
}

interface AuditLog {
  id: string;
  action: string;
  table_name?: string;
  created_at: string;
  users?: { full_name?: string; email?: string } | null;
}

interface AdminDashboardData {
  stats: {
    total_users: number;
    active_users: number;
    total_exams: number;
    active_exams: number;
    total_attempts: number;
    flagged_attempts: number;
    pending_reeval: number;
    departments: number;
    courses: number;
  };
  users: AdminUser[];
  roles: { id: string; name: ApiRole }[];
  entranceSchedules: Schedule[];
  auditLogs: AuditLog[];
}

interface CandidateRow {
  assignment_id: string;
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  invitation_status: string;
  login_url: string;
  assigned_at: string;
  attempt_status?: string | null;
}

interface CandidateEntry {
  full_name: string;
  email: string;
  phone: string;
  temp_password: string;
}

const roleOptions: ApiRole[] = ["Admin", "Faculty", "Proctor", "Student", "Candidate"];

const css = `
.admin-shell{display:flex;min-height:100vh;background:var(--c-bg);color:var(--c-gray-900);font-family:var(--font)}
.admin-sidebar{width:250px;background:var(--c-sidebar);color:#fff;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
.admin-brand{height:64px;display:flex;align-items:center;padding:0 20px;border-bottom:1px solid rgba(0,0,0,.14)}
.admin-brand strong{display:block;font-size:18px;letter-spacing:-.3px}.admin-brand span{display:block;font-size:11px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.8px}
.admin-nav{padding:18px 10px;display:flex;flex-direction:column;gap:4px}.admin-nav-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.55);padding:10px 10px 5px}
.admin-nav button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:rgba(255,255,255,.78);padding:10px;border-radius:6px;font:600 13.5px var(--font);cursor:pointer;text-align:left}
.admin-nav button:hover,.admin-nav button.active{background:rgba(0,0,0,.18);color:#fff}.admin-nav button i{font-size:17px}
.admin-side-bottom{margin-top:auto;padding:14px;border-top:1px solid rgba(0,0,0,.14);font-size:12px;color:rgba(255,255,255,.75)}
.admin-main{flex:1;min-width:0;display:flex;flex-direction:column}.admin-topbar{height:64px;background:#fff;border-bottom:1px solid var(--c-border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:5}
.admin-title{font-size:20px;font-weight:800;color:var(--c-primary-800);letter-spacing:-.35px}.admin-subtitle{font-size:12.5px;color:var(--c-gray-600);margin-top:2px}
.admin-content{padding:24px;overflow:auto}.admin-grid{display:grid;gap:16px}.stats-grid{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}
.stat-card,.admin-card{background:#fff;border:1px solid var(--c-border);border-radius:8px;box-shadow:var(--shadow-sm)}
.stat-card{padding:17px}.stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--c-gray-600);font-weight:800}.stat-value{font-size:28px;line-height:1;font-weight:800;margin-top:9px;color:var(--c-gray-900)}.stat-meta{font-size:12px;color:var(--c-gray-500);margin-top:7px}
.admin-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--c-border)}.admin-card-title{font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}.admin-card-body{padding:16px}
.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.input,.select{height:36px;border:1px solid var(--c-border);border-radius:6px;background:#fff;padding:0 10px;font:13px var(--font);color:var(--c-gray-800);outline:none}.input:focus,.select:focus{border-color:var(--c-primary-600);box-shadow:0 0 0 3px rgba(196,30,58,.08)}.input{min-width:240px}
.btn{height:36px;border:1px solid transparent;border-radius:6px;padding:0 13px;display:inline-flex;align-items:center;gap:7px;font:700 13px var(--font);cursor:pointer}.btn-primary{background:var(--c-primary-700);color:#fff}.btn-secondary{background:#fff;color:var(--c-gray-800);border-color:var(--c-border)}.btn-danger{background:var(--c-danger-100);color:var(--c-danger-700);border-color:#fecaca}.btn:disabled{opacity:.55;cursor:not-allowed}
.data-table{width:100%;border-collapse:collapse}.data-table th{background:var(--c-gray-50);border-bottom:1px solid var(--c-border);padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.45px;color:var(--c-gray-600)}.data-table td{border-bottom:1px solid var(--c-border);padding:10px;font-size:13px;vertical-align:middle}.data-table tr:last-child td{border-bottom:0}.muted{color:var(--c-gray-500);font-size:12px}.name-cell{font-weight:800}.badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800;border:1px solid transparent;text-transform:uppercase}.badge-admin{background:#dbeafe;color:#1e40af}.badge-faculty{background:#ede9fe;color:#5b21b6}.badge-proctor{background:#fef3c7;color:#92400e}.badge-student{background:#fde8ec;color:#9d102d}.badge-candidate{background:#d1fae5;color:#065f46}.badge-off{background:var(--c-gray-100);color:var(--c-gray-600)}
.two-col{grid-template-columns:minmax(0,1.3fr) minmax(320px,.7fr)}.notice{margin-bottom:14px;border-radius:8px;padding:10px 12px;font-size:13px;border:1px solid}.notice.success{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.notice.error{background:#fef2f2;color:#991b1b;border-color:#fecaca}
.csv-zone{border:2px dashed var(--c-gray-300);border-radius:8px;padding:28px;text-align:center;cursor:pointer;background:var(--c-gray-50)}.csv-zone:hover{border-color:var(--c-primary-600);background:#fff}.csv-zone i{font-size:30px;color:var(--c-gray-500)}.csv-zone p{margin:8px 0 3px;color:var(--c-gray-700);font-weight:700}.csv-zone small{color:var(--c-gray-500)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.proctor-embed{height:calc(100vh - 112px);overflow:auto;border:1px solid var(--c-border);border-radius:8px;background:#fff}.proctor-embed .proctor-shell{min-height:100%;height:auto}
.empty{padding:28px;text-align:center;color:var(--c-gray-500);font-size:13px}.audit-row{display:grid;grid-template-columns:110px 120px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);font-size:13px}.audit-row:last-child{border-bottom:0}
@media(max-width:1000px){.admin-sidebar{display:none}.stats-grid,.two-col{grid-template-columns:1fr}.admin-content{padding:16px}.form-row{grid-template-columns:1fr}.input{min-width:0;width:100%}}
`;

function roleClass(role?: string) {
  return `badge badge-${(role || "off").toLowerCase()}`;
}

function normalizeRole(role?: string): ApiRole {
  const match = roleOptions.find((option) => option.toLowerCase() === String(role || "").toLowerCase());
  return match ?? "Student";
}

function parseCSV(text: string): CandidateEntry[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").toLowerCase());
  const find = (names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const nameIndex = find(["name", "full_name", "full name", "candidate_name"]);
  const emailIndex = find(["email", "email_id", "email id", "candidate_email"]);
  const phoneIndex = find(["phone", "mobile", "contact"]);
  const passwordIndex = find(["temp_password", "password", "temporary_password"]);
  if (nameIndex < 0 || emailIndex < 0) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    return {
      full_name: cols[nameIndex] || "",
      email: cols[emailIndex] || "",
      phone: phoneIndex >= 0 ? cols[phoneIndex] || "" : "",
      temp_password: passwordIndex >= 0 ? cols[passwordIndex] || "" : "",
    };
  }).filter((row) => row.full_name && row.email.includes("@"));
}

function fmtDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminDashboard() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [candidateRows, setCandidateRows] = useState<CandidateEntry[]>([]);
  const [manualCandidate, setManualCandidate] = useState<CandidateEntry>({ full_name: "", email: "", phone: "", temp_password: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery<AdminDashboardData>({
    queryKey: ["admin-dashboard"],
    queryFn: () => get<AdminDashboardData>("/api/v1/admin/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: assignments = [] } = useQuery<CandidateRow[]>({
    queryKey: ["admin-candidates", selectedSchedule],
    queryFn: () => get<CandidateRow[]>(`/api/v1/admin/candidates/${selectedSchedule}`),
    enabled: Boolean(selectedSchedule),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ApiRole }) =>
      patch(`/api/v1/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      setNotice({ type: "success", text: "User role updated." });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (err: Error) => setNotice({ type: "error", text: err.message || "Could not update role." }),
  });

  const assignMutation = useMutation({
    mutationFn: (rows: CandidateEntry[]) =>
      post<{ assigned: number; emails_sent: number; emails_failed: number; emails_skipped: number }>("/api/v1/admin/candidates/assign", {
        exam_schedule_id: selectedSchedule,
        candidates: rows.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          phone: row.phone || null,
          temp_password: row.temp_password || null,
        })),
      }),
    onSuccess: (result) => {
      const mailText = result.emails_skipped
        ? " SMTP is not configured, so credentials were created but email was skipped."
        : ` ${result.emails_sent} email(s) sent, ${result.emails_failed} failed.`;
      setNotice({ type: "success", text: `${result.assigned} candidate(s) assigned.${mailText}` });
      setCandidateRows([]);
      setManualCandidate({ full_name: "", email: "", phone: "", temp_password: "" });
      void qc.invalidateQueries({ queryKey: ["admin-candidates", selectedSchedule] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (err: Error) => setNotice({ type: "error", text: err.message || "Could not assign candidates." }),
  });

  const users = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.users ?? []).filter((user) => {
      const role = user.roles[0] ?? "";
      const matchesRole = roleFilter === "ALL" || role.toLowerCase() === roleFilter.toLowerCase();
      const matchesSearch = !needle || `${user.full_name} ${user.email}`.toLowerCase().includes(needle);
      return matchesRole && matchesSearch;
    });
  }, [data?.users, roleFilter, search]);

  const schedules = data?.entranceSchedules ?? [];
  const selectedScheduleLabel = schedules.find((schedule) => schedule.id === selectedSchedule);

  const uploadCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseCSV(String(event.target?.result ?? ""));
      setCandidateRows(rows);
      setNotice(rows.length ? null : { type: "error", text: "No valid rows found. Use headers: name,email,phone,temp_password" });
    };
    reader.readAsText(file);
  };

  const addManualCandidate = () => {
    if (!manualCandidate.full_name.trim() || !manualCandidate.email.includes("@")) {
      setNotice({ type: "error", text: "Enter a valid candidate name and email." });
      return;
    }
    setCandidateRows((rows) => [...rows, manualCandidate]);
    setManualCandidate({ full_name: "", email: "", phone: "", temp_password: "" });
  };

  const renderOverview = () => (
    <>
      <div className="admin-grid stats-grid">
        <div className="stat-card"><div className="stat-label">Users</div><div className="stat-value">{data?.stats.total_users ?? 0}</div><div className="stat-meta">{data?.stats.active_users ?? 0} active accounts</div></div>
        <div className="stat-card"><div className="stat-label">Exams</div><div className="stat-value">{data?.stats.total_exams ?? 0}</div><div className="stat-meta">{data?.stats.active_exams ?? 0} live now</div></div>
        <div className="stat-card"><div className="stat-label">Attempts</div><div className="stat-value">{data?.stats.total_attempts ?? 0}</div><div className="stat-meta">{data?.stats.flagged_attempts ?? 0} flagged for review</div></div>
        <div className="stat-card"><div className="stat-label">Academics</div><div className="stat-value">{data?.stats.departments ?? 0}</div><div className="stat-meta">{data?.stats.courses ?? 0} courses, {data?.stats.pending_reeval ?? 0} re-evals</div></div>
      </div>
      <div className="admin-grid two-col">
        <div className="admin-card">
          <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-users" /> Recent Users</div><button className="btn btn-secondary" onClick={() => setActiveTab("users")}>Manage roles</button></div>
          <div style={{ overflowX: "auto" }}>{renderUsersTable((data?.users ?? []).slice(0, 8), false)}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-calendar" /> Entrance Schedules</div><button className="btn btn-primary" onClick={() => setActiveTab("candidates")}>Assign candidates</button></div>
          <div className="admin-card-body">
            {(schedules.slice(0, 6)).map((schedule) => (
              <div key={schedule.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--c-border)" }}>
                <div className="name-cell">{schedule.exams?.title ?? "Entrance exam"}</div>
                <div className="muted">{schedule.exams?.courses?.code ?? "No course"} | {fmtDate(schedule.start_time)}</div>
              </div>
            ))}
            {schedules.length === 0 && <div className="empty">No entrance schedules found.</div>}
          </div>
        </div>
      </div>
    </>
  );

  const renderUsersTable = (rows: AdminUser[], editable = true) => (
    <table className="data-table">
      <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th>{editable && <th>Change Role</th>}</tr></thead>
      <tbody>
        {rows.map((user) => {
          const currentRole = normalizeRole(user.roles[0]);
          return (
            <tr key={user.id}>
              <td><div className="name-cell">{user.full_name || "Unnamed user"}</div><div className="muted">{user.email}</div></td>
              <td><span className={roleClass(currentRole)}>{currentRole}</span></td>
              <td><span className={user.is_active ? "badge badge-candidate" : "badge badge-off"}>{user.is_active ? "Active" : "Inactive"}</span></td>
              <td className="muted">{fmtDate(user.created_at)}</td>
              {editable && (
                <td>
                  <select
                    className="select"
                    value={currentRole}
                    disabled={roleMutation.isPending}
                    onChange={(event) => roleMutation.mutate({ userId: user.id, role: event.target.value as ApiRole })}
                  >
                    {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderUsers = () => (
    <div className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title"><i className="ti ti-shield-lock" /> Users and Roles</div>
        <div className="toolbar">
          <input className="input" placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="ALL">All roles</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>{renderUsersTable(users)}</div>
    </div>
  );

  const renderCandidates = () => (
    <div className="admin-grid two-col">
      <div className="admin-card">
        <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-user-plus" /> Candidate Assignment</div></div>
        <div className="admin-card-body">
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <select className="select" style={{ minWidth: 320 }} value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)}>
              <option value="">Select entrance exam schedule</option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.exams?.title ?? "Entrance exam"} - {fmtDate(schedule.start_time)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <input className="input" placeholder="Full name" value={manualCandidate.full_name} onChange={(e) => setManualCandidate((row) => ({ ...row, full_name: e.target.value }))} />
            <input className="input" placeholder="Email" value={manualCandidate.email} onChange={(e) => setManualCandidate((row) => ({ ...row, email: e.target.value }))} />
            <input className="input" placeholder="Phone optional" value={manualCandidate.phone} onChange={(e) => setManualCandidate((row) => ({ ...row, phone: e.target.value }))} />
            <input className="input" placeholder="Password optional" value={manualCandidate.temp_password} onChange={(e) => setManualCandidate((row) => ({ ...row, temp_password: e.target.value }))} />
          </div>
          <button className="btn btn-secondary" onClick={addManualCandidate}><i className="ti ti-plus" /> Add to batch</button>

          <div className="csv-zone" style={{ marginTop: 16 }} onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) uploadCSV(file); }}>
            <i className="ti ti-upload" />
            <p>Upload candidate CSV</p>
            <small>Headers: name,email,phone,temp_password. Email is sent after import.</small>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadCSV(file); }} />
          </div>

          {candidateRows.length > 0 && (
            <div style={{ marginTop: 16, overflowX: "auto" }}>
              <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <strong>{candidateRows.length} candidate(s) ready</strong>
                <div className="toolbar">
                  <button className="btn btn-secondary" onClick={() => setCandidateRows([])}>Clear</button>
                  <button className="btn btn-primary" disabled={!selectedSchedule || assignMutation.isPending} onClick={() => assignMutation.mutate(candidateRows)}>
                    <i className="ti ti-mail" /> Send login email(s)
                  </button>
                </div>
              </div>
              <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Password</th></tr></thead><tbody>
                {candidateRows.slice(0, 12).map((row, index) => <tr key={`${row.email}-${index}`}><td>{row.full_name}</td><td>{row.email}</td><td>{row.phone || "-"}</td><td>{row.temp_password ? "Provided" : "Auto"}</td></tr>)}
              </tbody></table>
            </div>
          )}
        </div>
      </div>
      <div className="admin-card">
        <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-list-check" /> Assigned Candidates</div></div>
        <div className="admin-card-body">
          <div className="muted" style={{ marginBottom: 10 }}>{selectedScheduleLabel?.exams?.title ?? "Select a schedule"}</div>
          {assignments.length === 0 ? <div className="empty">No candidates loaded for this schedule.</div> : assignments.map((row) => (
            <div key={row.assignment_id} style={{ padding: "10px 0", borderBottom: "1px solid var(--c-border)" }}>
              <div className="name-cell">{row.full_name}</div>
              <div className="muted">{row.email}</div>
              <div style={{ marginTop: 5 }}><span className="badge badge-candidate">{row.invitation_status}</span> <span className="muted">{row.attempt_status ?? "Not started"}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAudit = () => (
    <div className="admin-card">
      <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-list-details" /> Audit Logs</div></div>
      <div className="admin-card-body">
        {(data?.auditLogs ?? []).map((log) => (
          <div className="audit-row" key={log.id}>
            <span className="muted">{new Date(log.created_at).toLocaleTimeString()}</span>
            <span className="badge badge-off">{log.action}</span>
            <span>{log.users?.email ?? "System"} on {log.table_name ?? "record"}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const content = () => {
    if (isLoading) return <div className="admin-card"><div className="empty">Loading admin control center...</div></div>;
    if (isError) return <div className="admin-card"><div className="empty">Could not load admin dashboard. Check the backend connection.</div></div>;
    if (activeTab === "users") return renderUsers();
    if (activeTab === "candidates") return renderCandidates();
    if (activeTab === "proctor") return <div className="proctor-embed"><ProctorDashboard /></div>;
    if (activeTab === "audit") return renderAudit();
    return renderOverview();
  };

  return (
    <div className="admin-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <aside className="admin-sidebar">
        <div className="admin-brand"><div><strong>EXAM.TIET</strong><span>Admin Control</span></div></div>
        <nav className="admin-nav">
          <div className="admin-nav-label">Control Center</div>
          {[
            ["overview", "Dashboard", "ti-layout-dashboard"],
            ["users", "Users and Roles", "ti-shield-lock"],
            ["candidates", "Candidate Assignment", "ti-user-plus"],
            ["proctor", "Proctor Console", "ti-device-desktop"],
            ["audit", "Audit Logs", "ti-list-details"],
          ].map(([key, label, icon]) => (
            <button key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key as AdminTab)}>
              <i className={`ti ${icon}`} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-side-bottom">
          <strong>{currentUser?.fullName ?? "Admin"}</strong>
          <div>{currentUser?.email ?? "System administrator"}</div>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div><div className="admin-title">Admin Dashboard</div><div className="admin-subtitle">Full project control, user roles, candidate assignment, and live proctoring</div></div>
          <div className="toolbar"><span className="badge badge-admin">ADMIN</span><button className="btn btn-secondary" onClick={signOut}>Sign out</button></div>
        </header>
        <main className="admin-content">
          {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
          {content()}
        </main>
      </section>
    </div>
  );
}
