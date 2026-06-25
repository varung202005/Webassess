import { del, get, patch, post, apiFile } from "../../lib/api";
import type {
  Course,
  Department,
  Exam,
  ExamAnalytics,
  ExamAttempt,
  ExamRegistration,
  ExamRule,
  ExamSchedule,
  ExamSection,
  ExtractedQuestion,
  FacultyDashboard,
  Notification,
  Question,
  ReevaluationRequest,
  Result,
  StudentAnswer,
} from "./types";


export const facultyApi = {
  // ── Portal ──────────────────────────────────────────────────────────────────
  dashboard: () => get<FacultyDashboard>("/api/v1/faculty/dashboard"),

  // ── Questions ───────────────────────────────────────────────────────────────
  listQuestions: (params?: {
    course_id?: string;
    question_type?: string;
    difficulty?: string;
    is_active?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.course_id) query.set("course_id", params.course_id);
    if (params?.question_type) query.set("question_type", params.question_type);
    if (params?.difficulty) query.set("difficulty", params.difficulty);
    if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
    const qs = query.toString();
    return get<Question[]>(`/api/v1/questions/${qs ? `?${qs}` : ""}`);
  },

  getQuestion: (questionId: string) =>
    get<Question>(`/api/v1/questions/${questionId}`),

  createQuestion: (body: Record<string, unknown>) =>
    post<{ message: string; question_id: string }>("/api/v1/questions/", body),

  updateQuestion: (questionId: string, body: Record<string, unknown>) =>
    patch<Question>(`/api/v1/questions/${questionId}`, body),

  deleteQuestion: (questionId: string) =>
    del(`/api/v1/questions/${questionId}`),

  /**
   * Upload a text-based PDF or DOCX and extract structured questions from it.
   * Sends multipart/form-data to POST /api/v1/questions/extract.
   * Uses apiFile() which omits Content-Type so the browser sets the correct
   * multipart boundary automatically — do NOT use post() here.
   */
  extractQuestionsFromFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFile<ExtractedQuestion[]>("/api/v1/questions/extract", formData);
  },

  // ── Exams ───────────────────────────────────────────────────────────────────
  listExams: (params?: { course_id?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.course_id) query.set("course_id", params.course_id);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    return get<Exam[]>(`/api/v1/exams/${qs ? `?${qs}` : ""}`);
  },

  getExam: (examId: string) => get<Exam>(`/api/v1/exams/${examId}`),

  createExam: (body: Record<string, unknown>) =>
    post<Exam>("/api/v1/exams/", body),

  updateExam: (examId: string, body: Record<string, unknown>) =>
    patch<Exam>(`/api/v1/exams/${examId}`, body),

  changeExamStatus: (examId: string, status: string) =>
    patch(`/api/v1/exams/${examId}/status`, { status }),

  getExamQuestions: (examId: string) =>
    get<Array<Record<string, unknown>>>(`/api/v1/exams/${examId}/questions`),

  addQuestionToExam: (examId: string, body: Record<string, unknown>) =>
    post(`/api/v1/exams/${examId}/questions`, body),

  removeQuestionFromExam: (examId: string, questionId: string) =>
    del(`/api/v1/exams/${examId}/questions/${questionId}`),

  // ── Exam Sections ───────────────────────────────────────────────────────────
  createExamSection: (body: Record<string, unknown>) =>
    post<ExamSection>("/api/v1/exam-sections/", body),

  // ── Exam Rules ──────────────────────────────────────────────────────────────
  upsertExamRules: (body: Record<string, unknown>) =>
    post<ExamRule>("/api/v1/exam-rules/", body),

  // ── Exam Schedules ──────────────────────────────────────────────────────────
  listSchedules: (params?: { exam_id?: string; is_published?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.exam_id) query.set("exam_id", params.exam_id);
    if (params?.is_published !== undefined)
      query.set("is_published", String(params.is_published));
    const qs = query.toString();
    return get<ExamSchedule[]>(`/api/v1/exam-schedules/${qs ? `?${qs}` : ""}`);
  },

  getSchedule: (scheduleId: string) =>
    get<ExamSchedule>(`/api/v1/exam-schedules/${scheduleId}`),

  createExamSchedule: (body: Record<string, unknown>) =>
    post<ExamSchedule>("/api/v1/exam-schedules/", body),



  updateSchedule: (scheduleId: string, body: Record<string, unknown>) =>
    patch<ExamSchedule>(`/api/v1/exam-schedules/${scheduleId}`, body),

  // ── Registrations ───────────────────────────────────────────────────────────
  listRegistrations: (examScheduleId: string) =>
    get<ExamRegistration[]>(
      `/api/v1/exam-registrations/schedule/${examScheduleId}`
    ),

  // ── Attempts (Faculty view) ─────────────────────────────────────────────────
  getExamAttempts: (examId: string) =>
    get<ExamAttempt[]>(`/api/v1/faculty/exam-attempts/${examId}`),

  getAttemptTimeline: (attemptId: string) =>
    get<Array<{ source: string; event: string; time: string }>>(
      `/api/v1/exam-attempts/${attemptId}/timeline`
    ),

  // ── Grading ─────────────────────────────────────────────────────────────────
  getPendingGrading: (examId: string) =>
    get<StudentAnswer[]>(`/api/v1/grading/pending/${examId}`),

  setManualScore: (body: {
    answer_id: string;
    marks_awarded: number;
    is_correct?: boolean;
    change_reason: string;
  }) => patch("/api/v1/grading/score", body),

  // ── Results ─────────────────────────────────────────────────────────────────
  getExamStats: (examId: string) =>
    get<{
      total_attempts: number;
      passed: number;
      failed: number;
      pass_rate: number;
      average_percentage: number;
      grade_distribution: Record<string, number>;
    }>(`/api/v1/results/exam/${examId}/stats`),

  getExamResults: (examId: string) =>
    get<Result[]>(`/api/v1/faculty/exam-results/${examId}`),

  publishResult: (resultId: string) =>
    patch(`/api/v1/results/${resultId}/publish`),

  publishAllResults: (examId: string) =>
    post(`/api/v1/faculty/publish-results/${examId}`),

  // ── Analytics ───────────────────────────────────────────────────────────────
  getExamAnalytics: (examId: string) =>
    get<ExamAnalytics>(`/api/v1/faculty/analytics/${examId}`),

  // ── Re-evaluation ───────────────────────────────────────────────────────────
  getPendingReevaluations: () =>
    get<ReevaluationRequest[]>("/api/v1/re-evaluation/pending"),

  resolveReevaluation: (requestId: string, body: Record<string, unknown>) =>
    patch(`/api/v1/re-evaluation/${requestId}`, body),

  // ── Notifications ───────────────────────────────────────────────────────────
  getNotifications: (unreadOnly?: boolean) =>
    get<Notification[]>(
      `/api/v1/notifications/${unreadOnly ? "?unread_only=true" : ""}`
    ),

  markNotificationRead: (notificationId: string) =>
    patch(`/api/v1/notifications/${notificationId}/read`),

  markAllNotificationsRead: () =>
    patch("/api/v1/notifications/read-all"),

  // ── Master Data ─────────────────────────────────────────────────────────────
  listDepartments: () => get<Department[]>("/api/v1/departments/"),

  listCourses: (departmentId?: string) => {
    const qs = departmentId ? `?department_id=${departmentId}` : "";
    return get<Course[]>(`/api/v1/courses/${qs}`);
  },
};