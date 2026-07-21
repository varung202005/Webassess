/**
 * pages/proctor/Dashboard.tsx
 * Live Proctor Dashboard — multi-exam support with per-exam filter tabs.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useFlaggedAttempts, useProctorDashboard, useRecomputeSummary, useSetVerdict } from "../../features/proctor/hooks";
import ProctorLayout from "../../features/proctor/ProctorLayout";
import {
  AlertFeed,
  AudioMonitorPanel,
  FlaggedTable,
  SessionBanner,
  StatsRow,
  StudentsPanel,
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
  if (Number(payload.person_count ?? 0) > 1)          return { type: "danger",  label: "Multiple people detected" };
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
interface ProctorDashboardProps {
  returnToAdmin?: boolean;
}

export default function ProctorDashboard({ returnToAdmin = false }: ProctorDashboardProps) {
  const navigate = useNavigate();
  const { data: portal, isLoading: portalLoading, isError: portalError } = useProctorDashboard();
  const { data: flaggedData, isLoading: flaggedLoading } = useFlaggedAttempts();
  const setVerdict = useSetVerdict();
  const recompute  = useRecomputeSummary();

  const [pendingId,      setPendingId]      = useState<string | null>(null);
  const [recomputingId,  setRecomputingId]  = useState<string | null>(null);
  const [alerts,         setAlerts]         = useState<AlertItem[]>([]);
  // "" = nothing picked from the dropdown yet
  const [selectedExam,   setSelectedExam]   = useState<string>("");

  const sessions: ActiveSession[] = portal?.activeSessions ?? (portal?.activeSession ? [portal.activeSession] : []);
  const stats    = portal?.stats   ?? EMPTY_STATS;
  const flagged  = flaggedData     ?? [];

  // Auto-pick the exam if there's exactly one running, otherwise wait for
  // the proctor to choose from the dropdown.
  useEffect(() => {
    if (sessions.length === 1 && !selectedExam) {
      setSelectedExam(sessions[0].schedule_id);
    }
    // If the previously-selected exam has ended / is no longer live, reset.
    if (selectedExam && !sessions.some((s) => s.schedule_id === selectedExam)) {
      setSelectedExam("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.map((s) => s.schedule_id).join(",")]);

  // ── Derived: scoped entirely to the selected exam ─────────────────────────
  const selectedSession = sessions.find((s) => s.schedule_id === selectedExam) ?? null;

  const visibleAttempts = selectedSession?.active_attempts ?? [];

  const visibleFlagged: FlaggedAttempt[] = flagged.filter((f) =>
    f.exam_attempts?.exam_schedule_id === selectedExam
  );

  const browserStats = portal?.studentBrowserStats ?? [];
  const visibleBrowserStats = browserStats.filter((s) => s.exam_schedule_id === selectedExam);

  // attempt_id -> student name, used so Live Alerts can show real names
  // instead of a truncated attempt id.
  const attemptNameMap: Record<string, string> = {};
  for (const s of sessions) {
    for (const a of s.active_attempts) {
      attemptNameMap[a.id] = a.users?.full_name ?? "Student";
    }
  }
  for (const f of flagged) {
    if (f.exam_attempts?.users?.full_name) {
      attemptNameMap[f.attempt_id] = f.exam_attempts.users.full_name;
    }
  }
  const nameMapRef = useRef<Record<string, string>>({});
  nameMapRef.current = attemptNameMap;
  const nameForAttempt = (attemptId: string) =>
    nameMapRef.current[attemptId] ?? `Attempt ${attemptId.slice(0, 8).toUpperCase()}`;

  // Tracks last-seen tab_switch_count / fullscreen_exit_count per attempt so
  // we can tell a genuine new violation apart from a routine 30s heartbeat
  // sync (BrowserMonitor UPDATEs the same row every sync, it only INSERTs
  // once per attempt).
  const browserCountsRef = useRef<Record<string, { tab: number; fs: number }>>({});
  useEffect(() => {
    for (const s of portal?.studentBrowserStats ?? []) {
      if (!(s.attempt_id in browserCountsRef.current)) {
        browserCountsRef.current[s.attempt_id] = { tab: s.tab_switch_count, fs: s.fullscreen_exit_count };
      }
    }
  }, [portal?.studentBrowserStats]);

  // ── Supabase Realtime channels ────────────────────────────────────────────
  useEffect(() => {
    const faceCh = supabase.channel("proctor-face-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "face_verification_logs" }, (payload) => {
        const rec = payload.new as Record<string, unknown>;
        const { type, label } = faceViolationType(rec);
        const name = nameForAttempt(String(rec.attempt_id ?? ""));
        setAlerts((prev) => [{
          id: makeAlertId(), type,
          title: `${name} — ${label}`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      }).subscribe();

    // browser_activity_logs: first sync for an attempt is an INSERT, every
    // sync after that is an UPDATE to the same row — so we need both event
    // types, and diff tab/fullscreen counts against what we last saw to
    // avoid firing an alert on every idle 30s heartbeat.
    const handleBrowserRow = (payload: { new: Record<string, unknown> }) => {
      const rec       = payload.new;
      const attemptId = String(rec.attempt_id ?? "");
      if (!attemptId) return;

      const newTab = Number(rec.tab_switch_count ?? 0);
      const newFs  = Number(rec.fullscreen_exit_count ?? 0);
      const prevCounts = browserCountsRef.current[attemptId] ?? { tab: 0, fs: 0 };
      browserCountsRef.current[attemptId] = { tab: newTab, fs: newFs };

      const name = nameForAttempt(attemptId);

      if (newTab > prevCounts.tab) {
        setAlerts((prev) => [{
          id: makeAlertId(), type: "warning",
          title: `${name} — Tab switch (${newTab} total)`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      }
      if (newFs > prevCounts.fs) {
        setAlerts((prev) => [{
          id: makeAlertId(), type: "info",
          title: `${name} — Fullscreen exit (${newFs} total)`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      }
      if (rec.session_conflict_detected) {
        setAlerts((prev) => [{
          id: makeAlertId(), type: "danger",
          title: `${name} — Duplicate tab/session detected`,
          time: new Date().toLocaleTimeString(),
        } satisfies AlertItem, ...prev].slice(0, 60));
      }
    };

    const browseCh = supabase.channel("proctor-browser-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "browser_activity_logs" }, handleBrowserRow)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "browser_activity_logs" }, handleBrowserRow)
      .subscribe();

    const audioCh = supabase.channel("proctor-audio-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audio_monitoring_logs" }, (payload) => {
        const rec = payload.new as Record<string, unknown>;
        if (!rec.noise_detected) return;
        const name = nameForAttempt(String(rec.attempt_id ?? ""));
        setAlerts((prev) => [{
          id: makeAlertId(), type: rec.exam_relevant ? "danger" : "audio",
          title: `${name} — ${noiseLabel(rec)}`,
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

  // ── Manual recheck handler (Students panel "Recheck" button) ──────────────
  const handleRecompute = (attemptId: string) => {
    setRecomputingId(attemptId);
    const name = nameForAttempt(attemptId);
    recompute.mutate(attemptId, {
      onSettled: () => setRecomputingId(null),
      onSuccess: (result) => {
        setAlerts((prev) => [{
          id: makeAlertId(),
          type: result.flagged ? "danger" : "info",
          title: result.flagged
            ? `${name} — recheck flagged this attempt (${result.tab_switches} tab switches${result.hard_violation ? ", limit exceeded" : ""})`
            : `${name} — rechecked, no flag needed`,
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
      {returnToAdmin && (
        <div className="pcard" style={{ marginBottom: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Admin proctor mode</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Your admin session is still active.</div>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => navigate("/admin/dashboard", { replace: true })}>
            <i className="ti ti-arrow-left" /> Return to Admin Dashboard
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="pcard">
          <div className="empty-state" style={{ padding: "48px 0" }}>
            <i className="ti ti-device-desktop-off" style={{ fontSize: 32, marginBottom: 8 }} />
            No active test right now
          </div>
        </div>
      ) : (
      <>

      <section className="proctor-page-heading">
        <div>
          <h1>Live Examination Monitoring</h1>
          <p>Monitor active candidates, integrity signals, and examination activity.</p>
        </div>
      </section>

      {/* ── Session Banner (includes the "which test" filter) ── */}
      <SessionBanner
        sessions={sessions}
        selectedExam={selectedExam}
        onSelectExam={setSelectedExam}
        endsAt={selectedSession?.ends_at ?? ""}
      />

      {!selectedSession ? (
        <div className="pcard">
          <div className="empty-state" style={{ padding: "48px 0" }}>
            <i className="ti ti-device-desktop-off" style={{ fontSize: 32, marginBottom: 8 }} />
            Select a running test above to view its live monitoring dashboard
          </div>
        </div>
      ) : (
      <>

      {/* ── Stats ── */}
      {portalLoading ? (
        <div className="stats-row stats-row-triple">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 84, borderRadius: 10 }} />
          ))}
        </div>
      ) : (
        <StatsRow
          stats={stats}
          registered={selectedSession.registered_count}
          completed={selectedSession.completed_count}
        />
      )}

      {/* ── Live Candidate Feeds ── */}
      <div className="pcard">
        <div className="pcard-head">
          <i className="ti ti-camera" style={{ color: "var(--c-primary-700)", fontSize: 17 }} />
          <span className="pcard-title">Live Candidate Feeds</span>
          <span className="pcard-count" style={{ background: "#f0fdf4", color: "#166534" }}>~10s delay</span>
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

        {/* Flagged table + Students browser-monitoring panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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

          <div className="pcard">
            <div className="pcard-head">
              <i className="ti ti-device-desktop" style={{ color: "var(--c-primary-700)", fontSize: 17 }} />
              <span className="pcard-title">Students — Browser Monitoring</span>
              {visibleBrowserStats.length > 0 && <span className="pcard-count">{visibleBrowserStats.length}</span>}
            </div>
            <div className="pcard-body" style={{ padding: 0 }}>
              <StudentsPanel
                students={visibleBrowserStats}
                loading={portalLoading}
                onRecompute={handleRecompute}
                recomputingId={recomputingId}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="proctor-sidebar-right">

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
            <AudioMonitorPanel scheduleId={selectedExam} />       
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
      </>
      )}
      </>
      )}
    </ProctorLayout>
  );
}
