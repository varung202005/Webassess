/**
 * pages/proctor/Dashboard.tsx
 * Live Proctor Dashboard — multi-exam support with per-exam filter tabs.
 */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useFlaggedAttempts, useProctorDashboard, useSetVerdict } from "../../features/proctor/hooks";
import ProctorLayout from "../../features/proctor/ProctorLayout";
import {
  AlertFeed,
  AudioMonitorPanel,
  FlaggedTable,
  IntegrityDistribution,
  SessionBanner,
  StatsRow,
} from "../../features/proctor/components";
import type { AlertItem } from "../../features/proctor/components";
import type { ActiveSession, FlaggedAttempt, ProctoringVerdict } from "../../features/proctor/types";
import { studentName, verdictLabel } from "../../features/proctor/format";
import CandidateGrid from "../../features/proctor/CandidateGrid";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeAlertId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function faceViolationType(payload: Record<string, unknown>): { type: AlertItem["type"]; label: string } {
  if (Number(payload.multi_person_detected ?? 0) > 0) return { type: "danger",  label: "Multiple people detected" };
  if (Number(payload.phone_detected ?? 0) > 0)        return { type: "danger",  label: "Phone detected" };
  if (Number(payload.face_detected) === 0)            return { type: "warning", label: "Face not visible" };
  return { type: "info", label: "Face event" };
}

function noiseLabel(payload: Record<string, unknown>): string {
  const db = Number(payload.noise_level_db ?? 0);
  if (db >= 80) return `Loud noise detected (${db} dB)`;
  if (db >= 60) return `Moderate noise (${db} dB)`;
  return payload.notes ? String(payload.notes) : "Audio noise detected";
}

const EMPTY_STATS = {
  total_flagged: 0, total_live: 0, tab_switches_last_30m: 0,
  avg_integrity: 1, face_absence_events: 0, multi_person_events: 0,
  phone_events: 0, total_tab_switches: 0, noise_events_last_30m: 0, total_noise_events: 0,
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProctorDashboard() {
  const { data: portal, isLoading: portalLoading, isError: portalError } = useProctorDashboard();
  const { data: flaggedData, isLoading: flaggedLoading } = useFlaggedAttempts();
  const setVerdict = useSetVerdict();

  const [pendingId,      setPendingId]      = useState<string | null>(null);
  const [alerts,         setAlerts]         = useState<AlertItem[]>([]);
  // "all" or a schedule_id to filter by exam
  const [selectedExam,   setSelectedExam]   = useState<string>("all");

  const sessions: ActiveSession[] = portal?.activeSessions ?? (portal?.activeSession ? [portal.activeSession] : []);
  const stats    = portal?.stats   ?? EMPTY_STATS;
  const flagged  = flaggedData     ?? [];

  // Debug — remove after confirming
  console.log("[Dashboard] portal:", portal);
  console.log("[Dashboard] sessions:", sessions);
  console.log("[Dashboard] visibleAttempts will be from sessions.flatMap active_attempts");

  // ── Derived: filter by selected exam ─────────────────────────────────────
  const selectedSession = selectedExam === "all" ? null : sessions.find((s) => s.schedule_id === selectedExam) ?? null;

  const visibleAttempts = selectedExam === "all"
    ? sessions.flatMap((s) => s.active_attempts)
    : (selectedSession?.active_attempts ?? []);

  const visibleFlagged: FlaggedAttempt[] = selectedExam === "all"
    ? flagged
    : flagged.filter((f) =>
        f.exam_attempts?.exam_schedule_id === selectedExam
      );

  // ── Supabase Realtime channels ────────────────────────────────────────────
  useEffect(() => {
    const faceCh = supabase.channel("proctor-face-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "face_verification_logs" }, (payload) => {
        const rec = payload.new as Record<string, unknown>;
        const { type, label } = faceViolationType(rec);
        setAlerts((prev) => [{
          id: makeAlertId(), type,
          title: `${label} — attempt ${String(rec.attempt_id ?? "").slice(0, 8).toUpperCase()}`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      }).subscribe();

    const browseCh = supabase.channel("proctor-browser-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "browser_activity_logs" }, (payload) => {
        const rec = payload.new as Record<string, unknown>;
        const ev  = String(rec.event_type ?? "").toLowerCase();
        const isTab  = ev.includes("tab");
        const isFull = ev.includes("fullscreen");
        if (!isTab && !isFull) return;
        setAlerts((prev) => [{
          id: makeAlertId(), type: isTab ? "warning" : "info",
          title: `${isTab ? "Tab switch" : "Fullscreen exit"} — attempt ${String(rec.attempt_id ?? "").slice(0, 8).toUpperCase()}`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      }).subscribe();

    const audioCh = supabase.channel("proctor-audio-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audio_monitoring_logs" }, (payload) => {
        const rec = payload.new as Record<string, unknown>;
        if (!rec.noise_detected) return;
        setAlerts((prev) => [{
          id: makeAlertId(), type: "audio",
          title: `${noiseLabel(rec)} — attempt ${String(rec.attempt_id ?? "").slice(0, 8).toUpperCase()}`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      }).subscribe();

    return () => {
      void supabase.removeChannel(faceCh);
      void supabase.removeChannel(browseCh);
      void supabase.removeChannel(audioCh);
    };
  }, []);

  // ── Verdict handler ────────────────────────────────────────────────────────
  const handleVerdict = (attemptId: string, verdict: ProctoringVerdict) => {
    setPendingId(attemptId);
    setVerdict.mutate({ attemptId, verdict }, {
      onSettled: () => setPendingId(null),
      onSuccess: () => {
        const attempt = flaggedData?.find((a: FlaggedAttempt) => a.attempt_id === attemptId);
        const name    = attempt ? studentName(attempt) : attemptId.slice(0, 8).toUpperCase();
        setAlerts((prev) => [{
          id: makeAlertId(),
          type: verdict === "VIOLATED" ? "danger" : verdict === "SUSPICIOUS" ? "warning" : "info",
          title: `Verdict set to "${verdictLabel(verdict)}" for ${name}`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      },
    });
  };

  if (portalError) {
    return (
      <ProctorLayout activePage="dashboard">
        <div className="page-error">
          <i className="ti ti-wifi-off" />
          Could not load dashboard — check your connection and try refreshing.
        </div>
      </ProctorLayout>
    );
  }

  return (
    <ProctorLayout activePage="dashboard">

      {/* ── Exam Filter Tabs ── */}
      {sessions.length > 0 && (
        <div className="exam-tabs">
          <button
            className={`exam-tab ${selectedExam === "all" ? "active" : ""}`}
            onClick={() => setSelectedExam("all")}
          >
            <i className="ti ti-layout-grid" />
            All Exams
            <span className="exam-tab-badge">{sessions.reduce((n, s) => n + s.active_students, 0)}</span>
          </button>
          {sessions.map((s) => (
            <button
              key={s.schedule_id}
              className={`exam-tab ${selectedExam === s.schedule_id ? "active" : ""}`}
              onClick={() => setSelectedExam(s.schedule_id)}
            >
              <i className="ti ti-file-text" />
              <span className="exam-tab-title">{s.exam_title}</span>
              <span className="exam-tab-code">{s.course_code}</span>
              <span className="exam-tab-badge">{s.active_students}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Session Banner ── */}
      {selectedExam === "all" ? (
        sessions.length > 0 && (
          <SessionBanner
            title={`${sessions.length} exam${sessions.length > 1 ? "s" : ""} running`}
            courseCode=""
            activeStudents={sessions.reduce((n, s) => n + s.active_students, 0)}
            endsAt={sessions[0].ends_at}
          />
        )
      ) : selectedSession ? (
        <SessionBanner
          title={selectedSession.exam_title}
          courseCode={selectedSession.course_code}
          activeStudents={selectedSession.active_students}
          endsAt={selectedSession.ends_at}
        />
      ) : null}

      {/* ── Stats ── */}
      {portalLoading ? (
        <div className="stats-row">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 84, borderRadius: 10 }} />
          ))}
        </div>
      ) : (
        <StatsRow stats={stats} />
      )}

      {/* ── Live Candidate Feeds ── */}
      <div className="pcard">
        <div className="pcard-head">
          <i className="ti ti-camera" style={{ color: "var(--c-primary-700)", fontSize: 17 }} />
          <span className="pcard-title">Live Candidate Feeds</span>
          <span className="pcard-count" style={{ background: "#f0fdf4", color: "#166534" }}>~30s delay</span>
          {visibleAttempts.length > 0 && (
            <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto" }}>
              {visibleAttempts.length} candidate{visibleAttempts.length !== 1 ? "s" : ""} monitored
            </span>
          )}
        </div>
        <div className="pcard-body">
          <CandidateGrid attempts={visibleAttempts} refreshMs={30_000} />
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="proctor-grid">

        {/* Flagged table */}
        <div className="pcard">
          <div className="pcard-head">
            <i className="ti ti-alert-triangle" style={{ color: "var(--c-danger-600)", fontSize: 17 }} />
            <span className="pcard-title">Flagged Attempts</span>
            {visibleFlagged.length > 0 && <span className="pcard-count">{visibleFlagged.length}</span>}
          </div>
          <div className="pcard-body" style={{ padding: 0 }}>
            <FlaggedTable
              attempts={visibleFlagged}
              loading={flaggedLoading}
              onVerdict={handleVerdict}
              pendingId={pendingId}
            />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="proctor-sidebar-right">

          <div className="pcard">
            <div className="pcard-head">
              <i className="ti ti-chart-bar" style={{ color: "var(--c-primary-700)", fontSize: 17 }} />
              <span className="pcard-title">Integrity Distribution</span>
            </div>
            <div className="pcard-body">
              <IntegrityDistribution flagged={visibleFlagged} totalLive={visibleAttempts.length} />
            </div>
          </div>

          <div className="pcard">
            <div className="pcard-head">
              <i className="ti ti-microphone" style={{ color: "#7c3aed", fontSize: 17 }} />
              <span className="pcard-title">Audio Monitor</span>
              {stats.total_noise_events > 0 && (
                <span className="pcard-count" style={{ background: "#ede9fe", color: "#6d28d9" }}>
                  {stats.total_noise_events}
                </span>
              )}
            </div>
            <div className="pcard-body">
              <AudioMonitorPanel flagged={visibleFlagged} activeAttempts={visibleAttempts} />
            </div>
          </div>

          <div className="pcard">
            <div className="pcard-head">
              <i className="ti ti-activity" style={{ color: "var(--c-warning-700)", fontSize: 17 }} />
              <span className="pcard-title">Live Alerts</span>
              {alerts.length > 0 && <span className="pcard-count">{alerts.length}</span>}
            </div>
            <div className="pcard-body">
              <AlertFeed alerts={alerts} />
            </div>
          </div>

        </div>
      </div>
    </ProctorLayout>
  );
}