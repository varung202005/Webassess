import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { facultyApi } from "./api";

const FACULTY_PORTAL_KEY = ["faculty-portal"];

// Centralised query keys — import these in any component that needs to
// invalidate specific queries after a mutation (e.g. CreateExam.tsx).
export const QUERY_KEYS = {
  dashboard: FACULTY_PORTAL_KEY,
  exams: (params?: object) => ["faculty-exams", params],
  schedules: (params?: object) => ["faculty-schedules", params],
  questions: (params?: object) => ["faculty-questions", params],
};

export function useFacultyDashboard() {
  return useQuery({
    queryKey: FACULTY_PORTAL_KEY,
    queryFn: () => facultyApi.dashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

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

export function useQuestions(params?: {
  course_id?: string;
  question_type?: string;
  difficulty?: string;
  is_active?: boolean;
}) {
  return useQuery({
    queryKey: ["faculty-questions", params],
    queryFn: () => facultyApi.listQuestions(params),
    staleTime: 30_000,
  });
}

export function useExams(params?: { course_id?: string; status?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.exams(params),
    queryFn: () => facultyApi.listExams(params),
    staleTime: 30_000,
  });
}

export function useExam(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-exam", examId],
    queryFn: () => facultyApi.getExam(examId!),
    enabled: Boolean(examId),
  });
}

export function useSchedules(params?: { exam_id?: string; is_published?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.schedules(params),
    queryFn: () => facultyApi.listSchedules(params),
    staleTime: 30_000,
  });
}

export function useExamStats(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-exam-stats", examId],
    queryFn: () => facultyApi.getExamStats(examId!),
    enabled: Boolean(examId),
    staleTime: 60_000,
  });
}

export function useExamAnalytics(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-exam-analytics", examId],
    queryFn: () => facultyApi.getExamAnalytics(examId!),
    enabled: Boolean(examId),
    staleTime: 60_000,
  });
}

export function useExamAttempts(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-exam-attempts", examId],
    queryFn: () => facultyApi.getExamAttempts(examId!),
    enabled: Boolean(examId),
    staleTime: 15_000,
  });
}

export function useExamResults(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-exam-results", examId],
    queryFn: () => facultyApi.getExamResults(examId!),
    enabled: Boolean(examId),
    staleTime: 30_000,
  });
}

export function usePendingGrading(examId: string | undefined) {
  return useQuery({
    queryKey: ["faculty-pending-grading", examId],
    queryFn: () => facultyApi.getPendingGrading(examId!),
    enabled: Boolean(examId),
    staleTime: 15_000,
  });
}

export function usePendingReevaluations() {
  return useQuery({
    queryKey: ["faculty-pending-reevaluations"],
    queryFn: () => facultyApi.getPendingReevaluations(),
    staleTime: 30_000,
  });
}