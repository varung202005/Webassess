import type { Role } from "../store/authStore";

export interface RouteMeta {
  path: string;
  label: string;
  roles: Role[] | "public";
}

/**
 * Single source of truth for every route in the app — mirrors the
 * "Complete Sitemap / Route Access Matrix" from the design spec.
 * Used to build <Route> entries in App.tsx and the quick-jump dev rail.
 */
export const ROUTES: RouteMeta[] = [
  { path: "/login", label: "Login", roles: "public" },

  { path: "/student/dashboard", label: "Student · Dashboard", roles: ["STUDENT"] },
  { path: "/student/exams", label: "Student · Available Exams", roles: ["STUDENT"] },
  { path: "/student/registered", label: "Student · Registered Exams", roles: ["STUDENT"] },
  { path: "/student/history", label: "Student · Exam History", roles: ["STUDENT"] },
  { path: "/student/results", label: "Student · Results", roles: ["STUDENT"] },
  { path: "/student/re-evaluation", label: "Student · Re-Evaluation", roles: ["STUDENT"] },
  { path: "/student/notifications", label: "Student · Notifications", roles: ["STUDENT"] },
  { path: "/student/profile", label: "Student · Profile", roles: ["STUDENT"] },

  { path: "/faculty/dashboard", label: "Faculty · Dashboard", roles: ["FACULTY"] },
  { path: "/faculty/question-bank", label: "Faculty · Question Bank", roles: ["FACULTY"] },
  { path: "/faculty/create-exam", label: "Faculty · Create Exam", roles: ["FACULTY"] },
  { path: "/faculty/evaluation", label: "Faculty · Evaluation", roles: ["FACULTY"] },
  { path: "/faculty/analytics", label: "Faculty · Analytics", roles: ["FACULTY"] },
  { path: "/faculty/schedules", label: "Faculty · Schedules", roles: ["FACULTY"] },
  { path: "/faculty/reevaluations", label: "Faculty · Re-evaluations", roles: ["FACULTY"] },
  { path: "/faculty/notifications", label: "Faculty · Notifications", roles: ["FACULTY"] },
  { path: "/faculty/profile", label: "Faculty · Profile", roles: ["FACULTY"] },

  { path: "/proctor/dashboard", label: "Proctor · Dashboard", roles: ["PROCTOR"] },

  { path: "/admin/dashboard", label: "Admin · Dashboard", roles: ["ADMIN"] },

  { path: "/exam/live/:scheduleId", label: "Live Exam (fullscreen)", roles: ["STUDENT"] },
];
