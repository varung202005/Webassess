import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { FlaggedAttempt, IntegrityBand, ProctoringStats } from "./types";
import {
  buildIntegrityBands,
  formatCountdown,
  integrityBarColor,
  integrityColor,
  issueList,
  relativeTime,
  scoreDisplay,
  studentName,
  verdictBadgeClass,
  verdictLabel,
} from "./format";
import type { ProctoringVerdict } from "./types";
import { useState } from "react";

/* ── Session Banner ────────────────────────────────────────────────────────── */
interface SessionBannerProps {
  title: string;
  courseCode: string;
  activeStudents: number;
  endsAt: string;
}
export function SessionBanner({ title, courseCode, activeStudents, endsAt }: SessionBannerProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(endsAt));
  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div className="session-banner">
      <i className="ti ti-device-desktop-analytics session-banner-icon" />
      <div className="session-banner-info">
        <div className="session-banner-title">{title} — {courseCode}</div>
        <div className="session-banner-sub">
          {activeStudents} student{activeStudents !== 1 ? "s" : ""} in progress
        </div>
      </div>
      <div className="session-timer">{countdown}</div>
      <div className="live-pill">
        <div className="live-dot" />
        LIVE
      </div>
    </div>
  );
}

/* ── Stats Row (5 cards — now includes Audio) ──────────────────────────────── */
export function StatsRow({ stats }: { stats: ProctoringStats }) {
  const avgPct = Math.round(stats.avg_integrity * 100);
  return (
    <div className="stats-row">
      <StatCard
        icon="ti-users"
        iconColor="red"
        value={stats.total_live}
        label="Active Candidates"
        meta="Currently in exam"
      />
      <StatCard
        icon="ti-alert-triangle"
        iconColor="danger"
        value={stats.total_flagged}
        label="Flagged Attempts"
        meta="Require review"
      />
      <StatCard
        icon="ti-arrows-left-right"
        iconColor="warning"
        value={stats.tab_switches_last_30m}
        label="Tab Switches (30m)"
        meta={`${stats.total_tab_switches} total this session`}
      />
      <StatCard
        icon="ti-microphone"
        iconColor="audio"
        value={stats.noise_events_last_30m}
        label="Audio Events (30m)"
        meta={`${stats.total_noise_events} total this session`}
      />
      <StatCard
        icon="ti-shield-half"
        iconColor={avgPct >= 75 ? "success" : avgPct >= 50 ? "warning" : "danger"}
        value={`${avgPct}%`}
        label="Avg Integrity Score"
        meta={`${stats.face_absence_events} face-absent · ${stats.phone_events} phone`}
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
            <th>Integrity</th>
            <th>Incidents</th>
            <th>Issues</th>
            <th>Verdict</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => {
            const score  = scoreDisplay(a.integrity_score);
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

                {/* Integrity bar */}
                <td>
                  <div className="int-wrap">
                    <div className="int-bar-bg">
                      <div
                        className="int-bar-fill"
                        style={{ width: `${score}%`, background: integrityBarColor(score) }}
                      />
                    </div>
                    <span className="int-score" style={{ color: integrityColor(score) }}>
                      {score}%
                    </span>
                  </div>
                </td>

                {/* Total incidents */}
                <td style={{ fontWeight: 600, color: a.total_incidents > 5 ? "var(--c-danger-700)" : "#444" }}>
                  {a.total_incidents}
                </td>

                {/* Issue chips */}
                <td>
                  {issues.length > 0 ? (
                    <div className="issues-list">
                      {issues.map((iss) => (
                        <span
                          key={iss}
                          className={`issue-chip${iss === "Audio Noise" ? " audio" : ""}`}
                        >
                          {iss === "Audio Noise" && <i className="ti ti-microphone" style={{ fontSize: 9, marginRight: 3 }} />}
                          {iss}
                        </span>
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
    </div>
  );
}

/* ── Integrity Distribution ────────────────────────────────────────────────── */
export function IntegrityDistribution({
  flagged, totalLive,
}: { flagged: FlaggedAttempt[]; totalLive: number }) {
  const bands: IntegrityBand[] = buildIntegrityBands(flagged, totalLive);
  return (
    <div className="dist-list">
      {bands.map((b) => (
        <div className="dist-row" key={b.label}>
          <div className="dist-meta">
            <span className="dist-label">{b.label}</span>
            <span className="dist-count">{b.count} students</span>
          </div>
          <div className="dist-bar-bg">
            <div className="dist-bar-fill" style={{ width: `${b.pct}%`, background: b.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Audio Monitor Panel ───────────────────────────────────────────────────── */
export function AudioMonitorPanel({
  activeAttempts,
}: {
  flagged?: FlaggedAttempt[];
  activeAttempts?: { id: string; users?: { full_name: string } | null }[];
}) {
  const attemptIds = (activeAttempts ?? []).map((a) => a.id);

  const { data: audioRows, isLoading } = useQuery({
    queryKey: ["audio-monitor-panel", ...attemptIds],
    queryFn: async () => {
      let q = supabase
        .from("audio_monitoring_logs")
        .select("attempt_id")
        .eq("noise_detected", true)
        .limit(500);

      // Only scope to specific attempts if we have IDs (exam tab filter)
      if (attemptIds.length > 0) {
        q = q.in("attempt_id", attemptIds);
      }

      const { data, error } = await q;
      if (error) {
        console.error("[AudioMonitorPanel] query error:", error.message);
        return [];
      }
      console.log("[AudioMonitorPanel] rows fetched:", data?.length, "attemptIds filter:", attemptIds);
      return data ?? [];
    },
    // ALWAYS enabled — no longer gated on attemptIds
    enabled: true,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Count noise events per attempt
  const counts: Record<string, number> = {};
  for (const row of audioRows ?? []) {
    counts[row.attempt_id] = (counts[row.attempt_id] ?? 0) + 1;
  }

  // Build name map from activeAttempts (best-effort — falls back to ID)
  const nameMap: Record<string, string> = {};
  for (const a of activeAttempts ?? []) {
    nameMap[a.id] = a.users?.full_name ?? "Student";
  }

  const entries = Object.entries(counts)
    .map(([id, count]) => ({
      id,
      name: nameMap[id] ?? id.slice(0, 8).toUpperCase(),
      count,
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