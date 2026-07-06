import { get, post } from "../../lib/api";

export type CandidateExamState =
  | { state: "NOT_STARTED"; scheduled_at: string; exam_title: string; exam_duration_minutes: number }
  | { state: "ACTIVE"; exam_title: string; exam_duration_minutes: number; total_questions: number; total_marks: number; pass_marks: number; instructions: string | null; schedule_id: string; rules: CandidateExamRules | null }
  | { state: "IN_PROGRESS"; attempt_id: string; exam_title: string; schedule_id: string }
  | { state: "SUBMITTED" }
  | { state: "EXPIRED" }
  | { state: "NO_EXAM" };

export interface CandidateExamRules {
  require_fullscreen?: boolean;
  enable_proctoring?: boolean;
  allow_backtrack?: boolean;
  allow_review_flag?: boolean;
  max_tab_switches?: number | null;
  auto_save_interval_sec?: number | null;
}

export const candidateApi = {
  /**
   * Returns the current state of the candidate's assigned exam.
   * One of: NOT_STARTED | ACTIVE | IN_PROGRESS | SUBMITTED | EXPIRED | NO_EXAM
   */
  examState: () => get<CandidateExamState>("/api/v1/candidate/exam-state"),

  /**
   * Start a new attempt for the candidate's assigned exam.
   * Returns the attempt_id to redirect into the live exam engine.
   */
  startAttempt: () =>
    post<{ attempt_id: string; schedule_id: string; started_at: string; effective_deadline: string }>(
      "/api/v1/candidate/start-attempt"
    ),
  submitAttempt: (attemptId: string, submissionType: "MANUAL" | "AUTO") =>
    post("/api/v1/candidate/submit", {
      attempt_id: attemptId,
      submission_type: submissionType,
    }),
};
