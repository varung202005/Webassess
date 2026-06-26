/**
 * pages/proctor/Dashboard.tsx
 *
 * Live Proctor Dashboard — fully wired to real API + Supabase Realtime.
 * Covers face logs, browser activity (tab switch / fullscreen), and
 * audio_monitoring_logs for noise detection events.
 *
 * Place this file at: Frontend/src/pages/proctor/Dashboard.tsx
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
import type { FlaggedAttempt, ProctoringVerdict } from "../../features/proctor/types";
import { studentName, verdictLabel } from "../../features/proctor/format";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeAlertId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function faceViolationType(payload: Record<string, unknown>): {
  type: AlertItem["type"];
  label: string;
} {
  if (Number(payload.multi_person_detected ?? 0) > 0)
    return { type: "danger",  label: "Multiple people detected" };
  if (Number(payload.phone_detected ?? 0) > 0)
    return { type: "danger",  label: "Phone detected" };
  if (Number(payload.face_detected) === 0)
    return { type: "warning", label: "Face not visible" };
  return { type: "info", label: "Face event" };
}

function noiseLabel(payload: Record<string, unknown>): string {
  const db = Number(payload.noise_level_db ?? 0);
  if (db >= 80) return `Loud noise detected (${db} dB)`;
  if (db >= 60) return `Moderate noise detected (${db} dB)`;
  return payload.notes ? String(payload.notes) : "Audio noise detected";
}

const EMPTY_STATS = {
  total_flagged: 0,
  total_live: 0,
  tab_switches_last_30m: 0,
  avg_integrity: 1,
  face_absence_events: 0,
  multi_person_events: 0,
  phone_events: 0,
  total_tab_switches: 0,
  noise_events_last_30m: 0,
  total_noise_events: 0,
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProctorDashboard() {
  const { data: portal, isLoading: portalLoading, isError: portalError } =
    useProctorDashboard();
  const { data: flaggedData, isLoading: flaggedLoading } = useFlaggedAttempts();
  const setVerdict = useSetVerdict();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [alerts,    setAlerts]    = useState<AlertItem[]>([]);

  // ── Supabase Realtime channels ────────────────────────────────────────────
  useEffect(() => {
    // 1. Face verification events
    const faceCh = supabase
      .channel("proctor-face-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "face_verification_logs" },
        (payload) => {
          const rec = payload.new as Record<string, unknown>;
          const { type, label } = faceViolationType(rec);
          setAlerts((prev) =>
            [
              {
                id:    makeAlertId(),
                type,
                title: `${label} — attempt ${String(rec.attempt_id ?? "").slice(0,8).toUpperCase()}`,
                time:  new Date().toLocaleTimeString(),
              } satisfies AlertItem,
              ...prev,
            ].slice(0, 60)
          );
        }
      )
      .subscribe();

    // 2. Browser activity (tab switch / fullscreen exit)
    const browseCh = supabase
      .channel("proctor-browser-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "browser_activity_logs" },
        (payload) => {
          const rec       = payload.new as Record<string, unknown>;
          const eventType = String(rec.event_type ?? "").toLowerCase();
          const isTab     = eventType.includes("tab");
          const isFull    = eventType.includes("fullscreen");
          if (!isTab && !isFull) return;
          setAlerts((prev) =>
            [
              {
                id:    makeAlertId(),
                type:  isTab ? "warning" : "info",
                title: `${isTab ? "Tab switch" : "Fullscreen exit"} — attempt ${String(rec.attempt_id ?? "").slice(0,8).toUpperCase()}`,
                time:  new Date().toLocaleTimeString(),
              } satisfies AlertItem,
              ...prev,
            ].slice(0, 60)
          );
        }
      )
      .subscribe();

    // 3. Audio monitoring events ← NEW
    const audioCh = supabase
      .channel("proctor-audio-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audio_monitoring_logs" },
        (payload) => {
          const rec = payload.new as Record<string, unknown>;
          // Only surface events where noise_detected is true
          if (!rec.noise_detected) return;
          setAlerts((prev) =>
            [
              {
                id:    makeAlertId(),
                type:  "audio",
                title: `${noiseLabel(rec)} — attempt ${String(rec.attempt_id ?? "").slice(0,8).toUpperCase()}`,
                time:  new Date().toLocaleTimeString(),
              } satisfies AlertItem,
              ...prev,
            ].slice(0, 60)
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(faceCh);
      void supabase.removeChannel(browseCh);
      void supabase.removeChannel(audioCh);
    };
  }, []);

  // ── Verdict handler ───────────────────────────────────────────────────────
  const handleVerdict = (attemptId: string, verdict: ProctoringVerdict) => {
    setPendingId(attemptId);
    setVerdict.mutate(
      { attemptId, verdict },
      {
        onSettled: () => setPendingId(null),
        onSuccess: () => {
          const attempt = flaggedData?.find((a: FlaggedAttempt) => a.attempt_id === attemptId);
          const name    = attempt ? studentName(attempt) : attemptId.slice(0,8).toUpperCase();
          setAlerts((prev) =>
            [
              {
                id:    makeAlertId(),
                type:  verdict === "VIOLATED" ? "danger" : verdict === "SUSPICIOUS" ? "warning" : "info",
                title: `Verdict set to "${verdictLabel(verdict)}" for ${name}`,
                time:  new Date().toLocaleTimeString(),
              } satisfies AlertItem,
              ...prev,
            ].slice(0, 60)
          );
        },
      }
    );
  };

  // ── Error state ───────────────────────────────────────────────────────────
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

  const stats   = portal?.stats   ?? EMPTY_STATS;
  const session = portal?.activeSession ?? null;
  const flagged = flaggedData ?? [];

  return (
    <ProctorLayout activePage="dashboard">

      {/* Live session banner */}
      {session && (
        <SessionBanner
          title={session.exam_title}
          courseCode={session.course_code}
          activeStudents={session.active_students}
          endsAt={session.ends_at}
        />
      )}

      {/* Stats row — 5 cards including audio */}
      {portalLoading ? (
        <div className="stats-row">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 84, borderRadius: 10 }} />
          ))}
        </div>
      ) : (
        <StatsRow stats={stats} />
      )}

      {/* Main grid */}
      <div className="proctor-grid">

        {/* Flagged attempts table */}
        <div className="pcard">
          <div className="pcard-head">
            <i className="ti ti-alert-triangle" style={{ color: "var(--c-danger-600)", fontSize: 17 }} />
            <span className="pcard-title">Flagged Attempts</span>
            {flagged.length > 0 && <span className="pcard-count">{flagged.length}</span>}
          </div>
          <div className="pcard-body" style={{ padding: 0 }}>
            <FlaggedTable
              attempts={flagged}
              loading={flaggedLoading}
              onVerdict={handleVerdict}
              pendingId={pendingId}
            />
          </div>
        </div>

        {/* Right sidebar panels */}
        <div className="proctor-sidebar-right">

          {/* Integrity distribution */}
          <div className="pcard">
            <div className="pcard-head">
              <i className="ti ti-chart-bar" style={{ color: "var(--c-primary-700)", fontSize: 17 }} />
              <span className="pcard-title">Integrity Distribution</span>
            </div>
            <div className="pcard-body">
              <IntegrityDistribution flagged={flagged} totalLive={stats.total_live} />
            </div>
          </div>

          {/* Audio noise monitor — NEW */}
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
              <AudioMonitorPanel flagged={flagged} />
            </div>
          </div>

          {/* Live alert feed */}
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