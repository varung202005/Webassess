// ── Proctoring domain types ─────────────────────────────────────────────────

export type ProctoringVerdict = "CLEAN" | "SUSPICIOUS" | "VIOLATED" | "PENDING";

export interface FlaggedAttempt {
  attempt_id: string;
  integrity_score: number;        // 0.0–1.0 from backend
  total_incidents: number;
  face_absence_count: number;
  multi_person_count: number;
  phone_detection_count: number;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  noise_event_count: number;      // from audio_monitoring_logs
  flagged_for_review: boolean;
  proctor_verdict: ProctoringVerdict;
  reviewed_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  exam_attempts?: {
    student_id: string;
    exam_schedule_id: string;
    users?: { full_name: string } | null;
  } | null;
}

export interface ProctoringStats {
  total_flagged: number;
  total_live: number;
  tab_switches_last_30m: number;
  avg_integrity: number;
  face_absence_events: number;
  multi_person_events: number;
  phone_events: number;
  total_tab_switches: number;
  noise_events_last_30m: number;  // audio — new
  total_noise_events: number;     // audio — new
}

export interface ActiveAttempt {
  id: string;
  student_id: string;
  users?: { full_name: string } | null;
}

export interface ActiveSession {
  schedule_id: string;
  exam_title: string;
  course_code: string;
  active_students: number;
  ends_at: string;
  active_attempts: ActiveAttempt[];
}

export interface ProctoringDashboard {
  profile: ProctorProfile;
  stats: ProctoringStats;
  flagged: FlaggedAttempt[];
  activeSession: ActiveSession | null;      // first session (backward compat)
  activeSessions: ActiveSession[];          // ALL running exams
}

export interface ProctorProfile {
  id: string;
  full_name: string;
  email: string;
  profile_photo?: string | null;
}

export interface IntegrityBand {
  label: string;
  count: number;
  pct: number;
  color: string;
}