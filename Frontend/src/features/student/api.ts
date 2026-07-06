import { del, get, patch, post } from "../../lib/api";
import type { ExamSession, StudentPortal } from "./types";

export const studentApi = {
  portal: () =>
    get<StudentPortal>("/api/v1/student/portal"),

  register: (scheduleId: string) =>
    post("/api/v1/exam-registrations/", { exam_schedule_id: scheduleId }),

  cancelRegistration: (registrationId: string) =>
    del(`/api/v1/exam-registrations/${registrationId}`),

  eligibility: (scheduleId: string) =>
    get<{ eligible: boolean; reason: string; attempt_id?: string }>(
      `/api/v1/exam-registrations/eligibility/${scheduleId}`
    ),

  startAttempt: (scheduleId: string) =>
    post<{ attempt_id: string; started_at: string; effective_deadline: string }>(
      "/api/v1/exam-attempts/start",
      { exam_schedule_id: scheduleId }
    ),

  examSession: (scheduleId: string) =>
    get<ExamSession>(`/api/v1/student/exam-session/${scheduleId}`),

  savedAnswers: (attemptId: string) =>
    get<Array<{
      question_id: string;
      selected_option_id?: string | null;
      selected_option_ids?: string[] | null;
      answer_text?: string | null;
      is_marked_for_review: boolean;
      time_spent_sec: number;
    }>>(`/api/v1/student-answers/${attemptId}`),

  saveAnswer: (body: Record<string, unknown>) =>
    post("/api/v1/student-answers/save", body),

  navigate: (body: Record<string, unknown>) =>
    post("/api/v1/student-answers/navigate", body),

  submitAttempt: (attemptId: string, submissionType: "MANUAL" | "AUTO") =>
    post("/api/v1/exam-attempts/submit", {
      attempt_id:      attemptId,
      submission_type: submissionType,
    }),

  /**
   * Compute proctoring summary on exam submission.
   * Calls: POST /api/v1/proctoring/summary/:attemptId
   * Reads face/browser/audio logs, computes integrity score,
   * writes to proctoring_summary, flags if score < 0.7.
   * Must be called BEFORE submitAttempt.
   */
  computeProctoringsSummary: (attemptId: string) =>
    post<{ integrity_score: number; flagged: boolean; noise_events: number }>(
      `/api/v1/proctoring/summary/${attemptId}`,
      {}
    ),

  /**
   * Log a browser integrity event to submission_logs.
   * Calls: POST /api/v1/exam-attempts/:attemptId/log-event?event_type=...
   * Valid values: TAB_SWITCH_WARNING | FULLSCREEN_EXIT | CONNECTION_LOST
   *               CONNECTION_RESTORED | TIME_WARNING | ANSWER_SAVED
   */
  logEvent: (attemptId: string, eventType: string, metadata?: string) =>
    post<{ logged: boolean }>(
      `/api/v1/exam-attempts/${attemptId}/log-event?event_type=${encodeURIComponent(eventType)}${
        metadata ? `&metadata=${encodeURIComponent(metadata)}` : ""
      }`,
      {}
    ),

  requestReevaluation: (resultId: string, reason: string) =>
    post("/api/v1/re-evaluation/", { result_id: resultId, reason }),

  markNotificationRead: (notificationId: string) =>
    patch(`/api/v1/notifications/${notificationId}/read`),

  markAllNotificationsRead: () =>
    patch("/api/v1/notifications/read-all"),

  updateProfile: (body: Record<string, unknown>) =>
    patch("/api/v1/student/profile", body),
};