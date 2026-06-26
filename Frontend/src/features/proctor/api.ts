/**
 * features/proctor/api.ts
 *
 * All API calls for the proctor feature.
 * Uses the shared lib/api.ts fetch wrapper (attaches Bearer token automatically).
 */
import { get, patch } from "../../lib/api";
import type { FlaggedAttempt, ProctoringDashboard, ProctoringVerdict } from "./types";

// ── Response shapes for endpoints not already covered by types.ts ─────────────

export interface ActiveSchedule {
  id: string;
  start_time: string;
  end_time: string;
  exams: {
    title: string;
    courses?: { code?: string } | null;
  };
}

export interface ProctoringVerdictResponse {
  message: string;
}

// ── API object ────────────────────────────────────────────────────────────────

export const proctorApi = {
  /**
   * GET /api/v1/proctor/dashboard
   * Single call that returns profile + stats + flagged + active session.
   * Powers useProctorDashboard() — the main data source for the dashboard.
   */
  dashboard: () =>
    get<ProctoringDashboard>("/api/v1/proctor/dashboard"),

  /**
   * GET /api/v1/proctoring/flagged
   * Returns all PENDING flagged attempts.
   * Polled by useFlaggedAttempts() every 20s as a Realtime fallback.
   */
  flagged: () =>
    get<FlaggedAttempt[]>("/api/v1/proctoring/flagged"),

  /**
   * GET /api/v1/proctoring/summary/:attemptId
   * Per-attempt proctoring detail (proctor/admin only).
   * Use for a future drill-down modal.
   */
  summary: (attemptId: string) =>
    get<FlaggedAttempt>(`/api/v1/proctoring/summary/${attemptId}`),

  /**
   * PATCH /api/v1/proctoring/verdict/:attemptId
   * Sets the proctor verdict for a flagged attempt.
   * Called by the Clear / Flag / Violate buttons in the table.
   *
   * Body:
   *   proctor_verdict:   "CLEAN" | "SUSPICIOUS" | "VIOLATED" | "PENDING"
   *   flagged_for_review?: boolean   (omit to leave unchanged)
   */
  setVerdict: (
    attemptId: string,
    body: {
      proctor_verdict: ProctoringVerdict;
      flagged_for_review?: boolean;
    }
  ) =>
    patch<ProctoringVerdictResponse>(
      `/api/v1/proctoring/verdict/${attemptId}`,
      body
    ),

  /**
   * GET /api/v1/exam-schedules/?is_published=true
   * Used internally by the dashboard backend to find the active session.
   * Exposed here in case a future frontend component needs the raw list.
   */
  activeSessions: () =>
    get<ActiveSchedule[]>("/api/v1/exam-schedules/?is_published=true"),
};