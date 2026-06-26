import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { facultyApi } from "./api";

// ── Query keys ────────────────────────────────────────────
const FACULTY_PORTAL_KEY = ["faculty-portal"];

export const QUERY_KEYS = {
  dashboard:    FACULTY_PORTAL_KEY,
  exams:        (params?: object) => ["faculty-exams", params],
  schedules:    (params?: object) => ["faculty-schedules", params],
  questions:    (params?: object) => ["faculty-questions", params],
  examAttempts: (examId?: string) => ["faculty-exam-attempts", examId],
  examAnalytics:(examId?: string) => ["faculty-exam-analytics", examId],
  examResults:  (examId?: string) => ["faculty-exam-results", examId],
  attemptDetail:(attemptId?: string) => ["attempt-detail", attemptId],
};

// ── Dashboard ─────────────────────────────────────────────
export function useFacultyDashboard() {
  return useQuery({
    queryKey: FACULTY_PORTAL_KEY,
    queryFn:  () => facultyApi.dashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ── Generic mutation helper ───────────────────────────────
export function useFacultyAction<TData = unknown, TVars = void>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidateKeys?: unknown[][],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      const keys = invalidateKeys ?? [FACULTY_PORTAL_KEY];
      keys.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

// ── Questions ─────────────────────────────────────────────
export function useQuestions(params?: {
  course_id?: string;
  question_type?: string;
  difficulty?: string;
  is_active?: boolean;
}) {
  return useQuery({
    queryKey: QUERY_KEYS.questions(params),
    queryFn:  () => facultyApi.listQuestions(params),
    staleTime: 30_000,
  });
}

// ── Exams ─────────────────────────────────────────────────
export function useExams(params?: { course_id?: string; status?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.exams(params),
    queryFn:  () => facultyApi.listExams(params),
    staleTime: 30_000,
  });
}

export function useExam(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-exam", examId],
    queryFn:  () => facultyApi.getExam(examId!),
    enabled:  Boolean(examId),
  });
}

export function useExamStats(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-exam-stats", examId],
    queryFn:  () => facultyApi.getExamStats(examId!),
    enabled:  Boolean(examId),
    staleTime: 60_000,
  });
}

// ── Schedules ─────────────────────────────────────────────
export function useSchedules(params?: { exam_id?: string; is_published?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.schedules(params),
    queryFn:  () => facultyApi.listSchedules(params),
    staleTime: 30_000,
  });
}

// ── Evaluation tab ────────────────────────────────────────

/**
 * All attempts for a given exam — used for the student list in Evaluation.
 * Route: GET /faculty/exam-attempts/{examId}
 */
export function useExamAttempts(examId: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.examAttempts(examId ?? undefined),
    queryFn:  () => facultyApi.getExamAttempts(examId!),
    enabled:  !!examId,
    staleTime: 15_000,
  });
}

/**
 * Per-attempt detail: question breakdown, options, is_correct, marks.
 * Route: GET /faculty/attempt-detail/{attemptId}
 */
export function useAttemptDetail(attemptId: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.attemptDetail(attemptId ?? undefined),
    queryFn:  () => facultyApi.getAttemptDetail(attemptId!),
    enabled:  !!attemptId,
    staleTime: 0,        // always re-fetch — don't serve cached error on retry
    retry: 2,
    retryDelay: 1000,
  });
}

// ── Results ───────────────────────────────────────────────

/**
 * All results for a given exam with rank.
 * Route: GET /faculty/exam-results/{examId}
 */
export function useExamResults(examId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.examResults(examId),
    queryFn:  () => facultyApi.getExamResults(examId!),
    enabled:  Boolean(examId),
    staleTime: 30_000,
  });
}

// ── Analytics tab ─────────────────────────────────────────

/**
 * Full analytics for a single exam.
 * Route: GET /faculty/analytics/{examId}
 */
export function useExamAnalytics(examId: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.examAnalytics(examId ?? undefined),
    queryFn:  () => facultyApi.getExamAnalytics(examId!),
    enabled:  !!examId,
    staleTime: 60_000,
    retry: 1,
  });
}

// ── Re-evaluations ────────────────────────────────────────
export function usePendingReevaluations() {
  return useQuery({
    queryKey: ["faculty-pending-reevaluations"],
    queryFn:  () => facultyApi.getPendingReevaluations(),
    staleTime: 30_000,
  });
}

// ── REMOVED ───────────────────────────────────────────────
// usePendingGrading — subjective grading endpoint, not applicable
// to this objective-only portal. Removed to avoid calling a
// non-existent route and silently breaking the Evaluation tab.