import type { FlaggedAttempt, IntegrityBand, ProctoringVerdict } from "./types";

export function initials(name: string): string {
  return (name ?? "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "PR";
}

// 0.0–1.0 → 0–100 display
export function scoreDisplay(raw: number): number {
  return Math.round(raw * 100);
}

export function integrityColor(score: number): string {
  if (score >= 90) return "var(--c-success-700)";
  if (score >= 70) return "var(--c-primary-700)";
  if (score >= 50) return "var(--c-warning-700)";
  return "var(--c-danger-700)";
}

export function integrityBarColor(score: number): string {
  if (score >= 90) return "var(--c-success-500)";
  if (score >= 70) return "var(--c-primary-600)";
  if (score >= 50) return "var(--c-warning-500)";
  return "var(--c-danger-500)";
}

export function verdictLabel(v: ProctoringVerdict): string {
  const m: Record<ProctoringVerdict, string> = {
    CLEAN:      "Clean",
    SUSPICIOUS: "Suspicious",
    VIOLATED:   "Violated",
    PENDING:    "Pending",
  };
  return m[v] ?? v;
}

export function verdictBadgeClass(v: ProctoringVerdict): string {
  const m: Record<ProctoringVerdict, string> = {
    CLEAN:      "badge-published",
    SUSPICIOUS: "badge-review",
    VIOLATED:   "badge-invalidated",
    PENDING:    "badge-pending",
  };
  return m[v] ?? "badge-pending";
}

export function studentName(attempt: FlaggedAttempt): string {
  return attempt.exam_attempts?.users?.full_name ?? "Unknown Student";
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatCountdown(endIso: string): string {
  const diff = new Date(endIso).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function buildIntegrityBands(
  flagged: FlaggedAttempt[],
  totalLive: number
): IntegrityBand[] {
  const scores = flagged.map((f) => scoreDisplay(f.integrity_score));
  const total  = Math.max(totalLive, 1);

  const defs = [
    { label: "90–100 (Excellent)",      min: 90, max: 101, color: "var(--c-success-500)" },
    { label: "70–89 (Good)",            min: 70, max:  90, color: "var(--c-primary-600)" },
    { label: "50–69 (Moderate Risk)",   min: 50, max:  70, color: "var(--c-warning-500)" },
    { label: "<50 (Critical — Flagged)", min: 0,  max:  50, color: "var(--c-danger-500)"  },
  ];

  return defs.map((b) => {
    const count =
      b.min === 90
        ? Math.max(0, totalLive - scores.filter((s) => s < 90).length)
        : scores.filter((s) => s >= b.min && s < b.max).length;
    return {
      label: b.label,
      count,
      pct:   Math.round((count / total) * 100),
      color: b.color,
    };
  });
}

/** Build the issue chip list for a flagged attempt — now includes Audio. */
export function issueList(attempt: FlaggedAttempt): string[] {
  const issues: string[] = [];
  if (attempt.multi_person_count    > 0) issues.push("Multi-Person");
  if (attempt.phone_detection_count > 0) issues.push("Phone");
  if (attempt.face_absence_count    > 0) issues.push("Face Absent");
  if (attempt.tab_switch_count      >= 3) issues.push("Tab Limit");
  if (attempt.fullscreen_exit_count > 0) issues.push("Fullscreen Exit");
  if ((attempt.noise_event_count ?? 0) > 0) issues.push("Audio Noise");
  return issues;
}