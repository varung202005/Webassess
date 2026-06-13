export interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  profile_photo?: string | null;
  roll_number?: string | null;
  department_id?: string | null;
  semester?: number | null;
  departments?: { name: string; code: string } | null;
}

export interface Exam {
  id: string;
  title: string;
  status: string;
  duration_minutes: number;
  total_marks: number;
  pass_marks: number;
  instructions?: string | null;
  course_id: string;
  semester?: number | null;
  exam_rules?: ExamRule[] | ExamRule | null;
  courses?: { name: string; code: string };
}

export interface ExamRule {
  auto_save_interval_sec?: number;
  fullscreen_required?: boolean;
  tab_switch_limit?: number;
}

export interface Registration {
  id: string;
  exam_schedule_id: string;
  status: string;
  registered_at: string;
}

export interface Attempt {
  id: string;
  exam_schedule_id: string;
  started_at: string;
  submitted_at?: string | null;
  status: string;
  total_score?: number | null;
  submission_type?: string;
  effective_deadline?: string;
}

export interface StudentSchedule {
  id: string;
  exam_id: string;
  department_id: string;
  start_time: string;
  end_time: string;
  registration_deadline?: string | null;
  is_published: boolean;
  exam: Exam;
  course: { id?: string; name?: string; code?: string };
  faculty_name?: string | null;
  registration?: Registration | null;
  attempt?: Attempt | null;
  can_register: boolean;
  eligibility_status: string;
  window_status: "UPCOMING" | "OPEN" | "CLOSED";
}

export interface Result {
  id: string;
  attempt_id: string;
  exam_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  grade: string;
  is_passed: boolean;
  published_at?: string | null;
  faculty_remarks?: string | null;
  rank?: number | null;
  percentile?: number | null;
  exam: Exam;
  course: { name?: string; code?: string };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface Reevaluation {
  id: string;
  result_id: string;
  reason: string;
  status: string;
  reviewer_notes?: string | null;
  updated_score?: number | null;
  requested_at: string;
  resolved_at?: string | null;
}

export interface HistoryItem extends Attempt {
  schedule?: StudentSchedule | null;
  result?: Result | null;
}

export interface StudentPortal {
  profile: StudentProfile;
  schedules: StudentSchedule[];
  registrations: Registration[];
  attempts: Attempt[];
  history: HistoryItem[];
  results: Result[];
  notifications: Notification[];
  reevaluations: Reevaluation[];
  departments: Array<{ id: string; name: string; code: string }>;
}

export interface ExamQuestion {
  order_index: number;
  marks_override?: number | null;
  questions: {
    id: string;
    question_text: string;
    question_type: "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "LONG_ANSWER";
    marks: number;
    negative_marks: number;
    question_options: Array<{ id: string; option_text: string; order_index: number }>;
  };
  exam_sections?: { id: string; title: string } | null;
}

export interface ExamSession {
  attempt: Attempt;
  schedule: StudentSchedule;
  exam: Exam;
  questions: ExamQuestion[];
  effective_deadline: string;
  timer_policy: string;
}
