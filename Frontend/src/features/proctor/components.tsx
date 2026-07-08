import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { ActiveSession, FlaggedAttempt, ProctoringStats, StudentBrowserStat } from "./types";
import {
  formatCountdown,
  issueList,
  relativeTime,
  studentName,
  verdictBadgeClass,
  verdictLabel,
} from "./format";
import type { ProctoringVerdict } from "./types";

function examLabel(s: ActiveSession): string {
  const code = s.course_code && s.course_code !== "—" ? s.course_code : "";
  return code ? `${s.exam_title} — ${code}` : s.exam_title;
}

/* ── Session Banner (with built-in exam filter dropdown) ─────────────────────
 * One bar instead of two: the "which running test" selector lives right
 * inside the red live banner, next to the countdown/LIVE pill.
 */
interface SessionBannerProps {
  sessions: ActiveSession[];
  selectedExam: string;
  onSelectExam: (scheduleId: string) => void;
  endsAt: string;
}
export function SessionBanner({ sessions, selectedExam, onSelectExam, endsAt }: SessionBannerProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(endsAt));
  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = sessions.find((s) => s.schedule_id === selectedExam) ?? null;

  return (
    <div className="session-banner">
      <i className="ti ti-device-desktop-analytics session-banner-icon" />

      <div className="exam-dropdown" ref={wrapRef}>
        <button
          type="button"
          className="exam-dropdown-trigger"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={selected ? "" : "exam-dropdown-placeholder"}>
            {selected ? examLabel(selected) : "Select a running test…"}
          </span>
          <i className={`ti ti-chevron-down exam-dropdown-chevron ${open ? "open" : ""}`} />
        </button>

        {open && (
          <div className="exam-dropdown-menu">
            {sessions.map((s) => (
              <button
                type="button"
                key={s.schedule_id}
                className={`exam-dropdown-option ${s.schedule_id === selectedExam ? "active" : ""}`}
                onClick={() => { onSelectExam(s.schedule_id); setOpen(false); }}
              >
                <i className="ti ti-file-text" />
                <span className="exam-dropdown-option-label">{examLabel(s)}</span>
                {s.schedule_id === selectedExam && <i className="ti ti-check exam-dropdown-check" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="session-banner-count">
        {sessions.length} test{sessions.length !== 1 ? "s" : ""} running
      </span>
      <div className="session-timer">{countdown}</div>
      <div className="live-pill">
        <div className="live-dot" />
        LIVE
      </div>
    </div>
  );
}

/* ── Stats Row (Active / Registered / Completed for the selected exam) ──────── */
export function StatsRow({
  stats, registered, completed,
}: {
  stats: ProctoringStats;
  registered?: number;
  completed?: number;
}) {
  return (
    <div className="stats-row stats-row-triple">
      <StatCard
        icon="ti-users"
        iconColor="red"
        value={stats.total_live}
        label="Active Candidates"
        meta="Currently in exam"
      />
      <StatCard
        icon="ti-user-check"
        iconColor="success"
        value={registered ?? 0}
        label="Registered"
        meta="Signed up for this exam"
      />
      <StatCard
        icon="ti-clipboard-check"
        iconColor="warning"
        value={completed ?? 0}
        label="Given the Test"
        meta="Have submitted their attempt"
      />
    </div>
  );
}

function StatCard({
  icon, iconColor, value, label, meta,
}: {
  icon: string; iconColor: string; value: string | number; label: string; meta: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconColor}`}>
        <i className={`ti ${icon}`} />
      </div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-meta">{meta}</div>
      </div>
    </div>
  );
}

/* ── Flagged Table ─────────────────────────────────────────────────────────── */
interface FlaggedTableProps {
  attempts: FlaggedAttempt[];
  loading: boolean;
  onVerdict: (attemptId: string, verdict: ProctoringVerdict) => void;
  pendingId: string | null;
}
export function FlaggedTable({ attempts, loading, onVerdict, pendingId }: FlaggedTableProps) {
  // Which evidence modal is open, if any: which attempt + which issue type.
  const [evidence, setEvidence] = useState<{ attemptId: string; name: string; issue: string } | null>(null);

  if (loading) {
    return (
      <div style={{ padding: "20px 18px" }}>
        {[1,2,3,4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8, borderRadius: 6 }} />
        ))}
      </div>
    );
  }
  if (attempts.length === 0) {
    return (
      <div className="empty-state">
        <i className="ti ti-shield-check" />
        No flagged attempts — all candidates look clean
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="flag-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Incidents</th>
            <th>Issues</th>
            <th>Verdict</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => {
            const issues = issueList(a);
            const isBusy = pendingId === a.attempt_id;

            return (
              <tr key={a.attempt_id}>
                {/* Student */}
                <td>
                  <div className="student-cell">
                    <div className="student-avatar">
                      {studentName(a).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0,2)}
                    </div>
                    <div>
                      <div className="student-name">{studentName(a)}</div>
                      <div className="student-id">{a.attempt_id.slice(0,8).toUpperCase()}</div>
                    </div>
                  </div>
                </td>

                {/* Total incidents */}
                <td style={{ fontWeight: 600, color: a.total_incidents > 5 ? "var(--c-danger-700)" : "#444" }}>
                  {a.total_incidents}
                </td>

                {/* Issue chips — clickable, opens the evidence modal for that issue */}
                <td>
                  {issues.length > 0 ? (
                    <div className="issues-list">
                      {issues.map((iss) => (
                        <button
                          key={iss}
                          type="button"
                          className={`issue-chip${iss === "Audio Noise" ? " audio" : ""}`}
                          style={{ cursor: "pointer", border: "none" }}
                          onClick={() => setEvidence({ attemptId: a.attempt_id, name: studentName(a), issue: iss })}
                          title="Click to view evidence"
                        >
                          {iss === "Audio Noise" && <i className="ti ti-microphone" style={{ fontSize: 9, marginRight: 3 }} />}
                          {iss}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#bbb", fontSize: 12 }}>—</span>
                  )}
                </td>

                {/* Verdict */}
                <td>
                  <span className={`badge ${verdictBadgeClass(a.proctor_verdict)}`}>
                    {verdictLabel(a.proctor_verdict)}
                  </span>
                </td>

                {/* Time */}
                <td style={{ color: "#999", fontSize: 12, whiteSpace: "nowrap" }}>
                  {relativeTime(a.updated_at ?? a.created_at)}
                </td>

                {/* Actions */}
                <td>
                  <div className="action-btns">
                    <button
                      className="btn-xs btn-xs-clear"
                      disabled={isBusy || a.proctor_verdict === "CLEAN"}
                      onClick={() => onVerdict(a.attempt_id, "CLEAN")}
                    >
                      {isBusy
                        ? <i className="ti ti-loader-2" style={{ animation: "spin .8s linear infinite" }} />
                        : <i className="ti ti-check" />}
                      Clear
                    </button>
                    <button
                      className="btn-xs btn-xs-flag"
                      disabled={isBusy || a.proctor_verdict === "SUSPICIOUS"}
                      onClick={() => onVerdict(a.attempt_id, "SUSPICIOUS")}
                    >
                      <i className="ti ti-flag" /> Flag
                    </button>
                    <button
                      className="btn-xs btn-xs-violate"
                      disabled={isBusy || a.proctor_verdict === "VIOLATED"}
                      onClick={() => onVerdict(a.attempt_id, "VIOLATED")}
                    >
                      <i className="ti ti-ban" /> Violate
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {evidence && (
        <EvidenceModal
          attemptId={evidence.attemptId}
          studentName={evidence.name}
          issue={evidence.issue}
          onClose={() => setEvidence(null)}
        />
      )}
    </div>
  );
}

/* ── Evidence Modal ────────────────────────────────────────────────────────
 * Shown when a proctor clicks an issue chip in the Flagged Attempts table.
 * Pulls the actual frames/events that caused that specific issue:
 *   - Phone / Face Absent / Multi-Person → snapshot photos from
 *     face_verification_logs (WebcamCapture already uploads + logs a
 *     snapshot_url for every flagged frame).
 *   - Audio Noise → the logged noise events from audio_monitoring_logs
 *     (no photo — shows dB level / notes / timestamp instead).
 */
function EvidenceModal({
  attemptId,
  studentName: name,
  issue,
  onClose,
}: {
  attemptId: string;
  studentName: string;
  issue: string;
  onClose: () => void;
}) {
  const isAudio = issue === "Audio Noise";

  const { data: rows, isLoading } = useQuery({
    queryKey: ["evidence", attemptId, issue],
    queryFn: async () => {
      if (isAudio) {
        const { data, error } = await supabase
          .from("audio_monitoring_logs")
          .select("noise_level_db,notes,detected_at")
          .eq("attempt_id", attemptId)
          .eq("noise_detected", true)
          .order("detected_at", { ascending: false })
          .limit(20);
        if (error) { console.error("[EvidenceModal] audio query error:", error.message); return []; }
        return data ?? [];
      }

      let q = supabase
        .from("face_verification_logs")
        .select("snapshot_url,face_detected,person_count,phone_detected,confidence_score,checked_at")
        .eq("attempt_id", attemptId);

      // For Face Absent we don't filter out null snapshot_url — the frame
      // where the face was missing may not have a photo, but we still show
      // the event so the proctor knows the violation was logged.
      if (issue === "Phone")             q = q.eq("phone_detected", true).not("snapshot_url", "is", null);
      else if (issue === "Face Absent")  q = q.eq("face_detected", false);
      else if (issue === "Multi-Person") q = q.gt("person_count", 1).not("snapshot_url", "is", null);

      const { data, error } = await q.order("checked_at", { ascending: false }).limit(20);
      if (error) { console.error("[EvidenceModal] face query error:", error.message); return []; }
      return data ?? [];
    },
    staleTime: 10_000,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12, width: "min(720px, 100%)",
          maxHeight: "80vh", overflowY: "auto", padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{name} — {issue}</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              {isAudio ? "Logged noise events" : "Flagged snapshots"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: "#888" }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: "30px 0" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 6 }} />
            ))}
          </div>
        ) : !rows?.length ? (
          <div className="empty-state" style={{ padding: "30px 0" }}>
            <i className="ti ti-photo-off" style={{ fontSize: 26, marginBottom: 6 }} />
            No {isAudio ? "noise events" : "snapshots"} found for this issue
          </div>
        ) : isAudio ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(rows as { noise_level_db: number | null; notes: string | null; detected_at: string }[]).map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8f9fb", borderRadius: 8, fontSize: 13 }}>
                <span>{r.notes ?? "Noise detected"}</span>
                <span style={{ color: "#888", whiteSpace: "nowrap", marginLeft: 12 }}>
                  {r.noise_level_db != null ? `${r.noise_level_db} dB · ` : ""}{relativeTime(r.detected_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {(rows as { snapshot_url: string | null; person_count: number; face_detected: boolean; checked_at: string }[]).map((r, i) => (
              <div key={i} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}>
                {r.snapshot_url ? (
                  <img
                    src={r.snapshot_url}
                    alt={`${issue} evidence`}
                    style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", aspectRatio: "4/3", background: "#f3f4f6",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", color: "#aaa", fontSize: 11, gap: 4,
                  }}>
                    <i className="ti ti-camera-off" style={{ fontSize: 22 }} />
                    No snapshot
                  </div>
                )}
                <div style={{ padding: "6px 8px", fontSize: 11, color: "#888" }}>
                  {relativeTime(r.checked_at)}
                  {issue === "Multi-Person" ? ` · ${r.person_count} people` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/* ── Students Panel — per-student browser monitoring ─────────────────────────
 * Shows every active student with their live tab-switch and fullscreen-exit
 * counts, pulled straight from browser_activity_logs via the dashboard API.
 */
export function StudentsPanel({
  students, loading, onRecompute, recomputingId,
}: {
  students: StudentBrowserStat[];
  loading?: boolean;
  onRecompute?: (attemptId: string) => void;
  recomputingId?: string | null;
}) {
  if (loading) {
    return (
      <div style={{ padding: "16px 0" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 40, marginBottom: 8, borderRadius: 6 }} />
        ))}
      </div>
    );
  }

  if (!students.length) {
    return (
      <div className="empty-state" style={{ padding: "16px 0" }}>
        <i className="ti ti-device-desktop" style={{ fontSize: 28, marginBottom: 6 }} />
        No browser activity recorded yet
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="flag-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Tab Switches</th>
            <th>Fullscreen Exits</th>
            {onRecompute && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const isBusy = recomputingId === s.attempt_id;
            return (
            <tr key={s.attempt_id}>
              <td>
                <div className="student-cell">
                  <div className="student-avatar">
                    {s.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div className="student-name">{s.name}</div>
                    <div className="student-id">{s.attempt_id.slice(0, 8).toUpperCase()}</div>
                  </div>
                </div>
              </td>
              <td>
                <span
                  className={`issue-chip${s.tab_switch_count >= 3 ? " audio" : ""}`}
                  style={s.tab_switch_count === 0 ? { background: "#f3f4f6", color: "#999" } : undefined}
                >
                  <i className="ti ti-arrows-left-right" style={{ fontSize: 9, marginRight: 3 }} />
                  {s.tab_switch_count}
                </span>
              </td>
              <td>
                <span
                  className={`issue-chip${s.fullscreen_exit_count > 0 ? " audio" : ""}`}
                  style={s.fullscreen_exit_count === 0 ? { background: "#f3f4f6", color: "#999" } : undefined}
                >
                  <i className="ti ti-arrows-diagonal-minimize" style={{ fontSize: 9, marginRight: 3 }} />
                  {s.fullscreen_exit_count}
                </span>
              </td>
              {onRecompute && (
                <td>
                  <button
                    className="btn-xs btn-xs-clear"
                    disabled={isBusy}
                    title="Re-run the flagging check for this attempt using its current logs"
                    onClick={() => onRecompute(s.attempt_id)}
                  >
                    {isBusy
                      ? <i className="ti ti-loader-2" style={{ animation: "spin .8s linear infinite" }} />
                      : <i className="ti ti-refresh" />}
                    Recheck
                  </button>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Audio Monitor Panel ───────────────────────────────────────────────────── */
export function AudioMonitorPanel({
  scheduleId,
}: {
  scheduleId?: string;
}) {
  const { data: audioRows, isLoading } = useQuery({
    queryKey: ["audio-monitor-panel", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];

      // Join through to the attempt's schedule + student name, so we can
      // (a) filter strictly to the selected exam at the DB level instead
      //     of relying on a client-side "active attempts" list that may
      //     be empty or incomplete, and
      // (b) always have a real name available, even for students who've
      //     already submitted and are no longer "active" or flagged.
      const { data, error } = await supabase
        .from("audio_monitoring_logs")
        .select(
          "attempt_id,exam_relevant,exam_attempts!inner(exam_schedule_id,users(full_name))"
        )
        .eq("noise_detected", true)
        .eq("exam_attempts.exam_schedule_id", scheduleId)
        .limit(500);

      if (error) {
        console.error("[AudioMonitorPanel] query error:", error.message);
        return [];
      }
      console.log("[AudioMonitorPanel] rows fetched:", data?.length, "scheduleId:", scheduleId);
      return data ?? [];
    },
    enabled: !!scheduleId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Count noise events per attempt, and separately flag any exam-relevant speech.
  // Resolve the name straight from the joined row — no more falling back to a
  // partial activeAttempts/flagged list.
  const counts: Record<string, number> = {};
  const relevantCounts: Record<string, number> = {};
  const nameMap: Record<string, string> = {};

  for (const row of audioRows ?? []) {
    counts[row.attempt_id] = (counts[row.attempt_id] ?? 0) + 1;
    if (row.exam_relevant) relevantCounts[row.attempt_id] = (relevantCounts[row.attempt_id] ?? 0) + 1;

    const attempt = row.exam_attempts as
      | { users?: { full_name: string } | { full_name: string }[] | null }
      | null;
    const usersField = attempt?.users;
    const resolved = Array.isArray(usersField) ? usersField[0]?.full_name : usersField?.full_name;
    if (resolved) nameMap[row.attempt_id] = resolved;
  }

  const entries = Object.entries(counts)
    .map(([id, count]) => ({
      id,
      name: nameMap[id] ?? id.slice(0, 8).toUpperCase(),
      count,
      relevantCount: relevantCounts[id] ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const maxCount = entries[0]?.count ?? 1;

  if (isLoading) {
    return (
      <div style={{ padding: "16px 0" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 28, marginBottom: 8, borderRadius: 6 }} />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="empty-state" style={{ padding: "16px 0" }}>
        <i className="ti ti-microphone-off" style={{ fontSize: 28, marginBottom: 6 }} />
        No noise events in the last 2 hours
      </div>
    );
  }

  return (
    <div className="audio-rows">
      {entries.map((a) => {
        const pct = Math.round((a.count / maxCount) * 100);
        return (
          <div className="audio-row" key={a.id}>
            <span className="audio-name" title={a.name}>{a.name}</span>
            <div className="audio-bar-bg">
              <div className="audio-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="audio-count">{a.count}×</span>
            {a.relevantCount > 0 && (
              <span
                className="issue-chip"
                style={{ background: "#fef2f2", color: "var(--c-danger-700, #b31234)", marginLeft: 6 }}
                title="Speech matched exam question/answer content"
              >
                <i className="ti ti-alert-triangle" style={{ fontSize: 9, marginRight: 3 }} />
                exam-relevant ×{a.relevantCount}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
/* ── Realtime Alert Feed ───────────────────────────────────────────────────── */
export interface AlertItem {
  id: string;
  type: "danger" | "warning" | "info" | "audio";
  title: string;
  time: string;
}

export function AlertFeed({ alerts }: { alerts: AlertItem[] }) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [alerts.length]);

  if (alerts.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "20px 0" }}>
        <i className="ti ti-checks" style={{ fontSize: 28, marginBottom: 6 }} />
        No alerts yet
      </div>
    );
  }

  return (
    <div className="alert-feed" ref={feedRef} style={{ maxHeight: 300, overflowY: "auto" }}>
      {alerts.map((a) => (
        <div className="alert-item" key={a.id}>
          <div className="alert-dot-wrap">
            <div className={`alert-dot ${a.type}`} />
          </div>
          <div className="alert-body">
            <div className="alert-title">{a.title}</div>
            <div className="alert-meta">{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}