export interface FacultyProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  profile_photo?: string | null;
  departments?: { name: string; code: string } | null;
}

export interface Question {
  id: string;
  course_id: string;
  question_type: "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "LONG_ANSWER";
  question_text: string;
  marks: number;
  negative_marks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  image_url?: string | null;          // ← NEW: optional image attached to question
  courses?: { name: string; code?: string } | null;
  question_options?: QuestionOption[];
  question_topics?: QuestionTopic[];
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
}

export interface QuestionTopic {
  id: string;
  question_id: string;
  topic: string;
  subject?: string | null;
  chapter?: string | null;
}

export interface Exam {
  id: string;
  title: string;
  course_id: string;
  exam_type?: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  instructions?: string | null;
  semester?: number | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
  courses?: { name: string; code?: string } | null;
  exam_sections?: ExamSection[];
  exam_rules?: ExamRule[];
  questions_count?: number;
}

export interface ExamSection {
  id: string;
  exam_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  total_marks: number;
  question_count: number;
}

export interface ExamRule {
  id?: string;
  exam_id?: string;
  allow_backtrack: boolean;
  allow_review_flag: boolean;
  require_fullscreen: boolean;
  enable_proctoring: boolean;
  camera_required: boolean;
  microphone_required: boolean;
  max_tab_switches: number;
  max_fullscreen_exits: number;
  auto_save_interval_sec: number;
}

export interface ExamSchedule {
  id: string;
  exam_id: string;
  department_id: string;
  start_time: string;
  end_time: string;
  registration_deadline?: string | null;
  is_published: boolean;
  published_at?: string | null;
  exams?: {
    title: string;
    duration_minutes: number;
    exam_type?: string;
    status?: string;
    courses?: { name?: string; code?: string } | null;
  } | null;
  departments?: { name: string } | null;
  registration_count?: number;
  candidate_count?: number;
  candidate_started_count?: number;
  candidate_completed_count?: number;
}

export interface ExamRegistration {
  id: string;
  exam_schedule_id: string;
  student_id: string;
  status: string;
  registered_at: string;
  students?: { user_id?: string; roll_number?: string } | null;
  users?: { full_name?: string; email?: string } | null;
}

export interface ExamAttempt {
  id: string;
  exam_schedule_id: string;
  student_id: string;
  status: string;
  started_at: string;
  submitted_at?: string | null;
  total_score?: number | null;
  total_time_spent_sec?: number | null;
  submission_type?: string | null;
  students?: { user_id?: string; roll_number?: string } | null;
  users?: { full_name?: string; email?: string } | null;
  schedule?: ExamSchedule | null;
}

export interface Result {
  id: string;
  attempt_id: string;
  student_id: string;
  exam_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  grade: string;
  is_passed: boolean;
  is_published: boolean;
  published_at?: string | null;
  faculty_remarks?: string | null;
  exams?: { title: string } | null;
  users?: { full_name?: string } | null;
}

export interface ReevaluationRequest {
  id: string;
  result_id: string;
  student_id: string;
  reason: string;
  status: "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED";
  reviewer_notes?: string | null;
  updated_score?: number | null;
  requested_at: string;
  resolved_at?: string | null;
  results?: Result | null;
  users?: { full_name?: string; email?: string } | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  department_id?: string;
}

export interface StudentAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id?: string | null;
  selected_option_ids?: string[] | null;
  answer_text?: string | null;
  is_correct?: boolean | null;
  marks_awarded?: number | null;
  time_spent_sec: number;
  is_marked_for_review: boolean;
  questions?: {
    id: string;
    question_text: string;
    question_type: string;
    marks: number;
    image_url?: string | null;       // ← NEW
  } | null;
}

export interface FacultyDashboard {
  profile: FacultyProfile;
  examCounts: {
    total: number;
    draft: number;
    review: number;
    published: number;
    archived: number;
  };
  questionStats: {
    total: number;
    byType: Record<string, number>;
    active: number;
  };
  pendingGrading: number;
  pendingReevaluations: number;
  activeSessions: Array<{
    schedule_id: string;
    exam_title: string;
    course_code: string;
    started_at: string;
    active_students: number;
    total_students: number;
    ends_at: string;
  }>;
  gradingQueue: Array<{
    exam_id: string;
    exam_title: string;
    course_code: string;
    pending_count: number;
    question_type: string;
  }>;
  recentExams: Exam[];
  upcomingSchedules: ExamSchedule[];
  reevaluationRequests: ReevaluationRequest[];
  notifications: Notification[];
  departments: Department[];
  courses: Course[];
}

export interface ExamAnalytics {
  exam_id: string;
  exam_title: string;
  course_name: string;
  course_code: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  total_registered: number;
  total_appeared: number;
  average_score: number;
  average_percentage: number;
  pass_rate: number;
  passed: number;
  failed: number;
  highest_score: number;
  highest_scorer: string | null;
  lowest_score: number;
  lowest_scorer: string | null;
  median_score: number;
  max_score: number;
  grade_distribution: Record<string, number>;
  score_distribution: number[];
  score_labels?: string[];
  topic_performance: {
    topic: string;
    question_count: number;
    avg_accuracy: number;
    difficulty: string;
  }[];
  question_performance: {
    question_id: string;
    question_text: string;
    difficulty: string;
    total_attempted: number;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    accuracy_pct: number;
    option_distribution: {
      option_id: string;
      option_text: string;
      is_correct: boolean;
      pick_count: number;
      pick_pct: number;
    }[];
  }[];
  topper_list: {
    rank: number;
    student_id: string;
    name: string;
    roll_number: string;
    score: number;
    percentage: number;
    grade: string;
    is_passed: boolean;
  }[];
}

export interface ExtractedOption {
  text: string;
  is_correct: boolean;
}

export interface ExtractedQuestion {
  id: string;
  question_text: string;
  question_type: "MCQ" | "MSQ" | "TRUE_FALSE";
  options: ExtractedOption[];
  marks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  confidence: number;
  needs_review: boolean;
  approved: boolean;
  image_url?: string | null;           // ← NEW: can be set manually after import
}