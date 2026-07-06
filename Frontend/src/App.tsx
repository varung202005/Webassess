import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";

import Login from "./pages/auth/Login";

// Student
import StudentDashboard from "./pages/student/Dashboard";
import StudentAvailableExams from "./pages/student/AvailableExams";
import StudentRegistered from "./pages/student/Registered";
import StudentHistory from "./pages/student/History";
import StudentResults from "./pages/student/Results";
import StudentReEvaluation from "./pages/student/ReEvaluation";
import StudentNotifications from "./pages/student/Notifications";
import StudentProfile from "./pages/student/Profile";

// Faculty — QuestionBank REMOVED; merged into CreateExam workspace
import FacultyDashboard from "./pages/faculty/Dashboard";
import FacultyCreateExam from "./pages/faculty/CreateExam";
import FacultyEvaluation from "./pages/faculty/Evaluation";
import FacultyAnalytics from "./pages/faculty/Analytics";
import FacultySchedules from "./pages/faculty/Schedules";
import FacultyReevaluations from "./pages/faculty/Reevaluations";
import FacultyNotificationsPage from "./pages/faculty/NotificationsPage";
import FacultyProfile from "./pages/faculty/Profile";

// Candidate
import CandidateExamState from "./pages/candidate/ExamState";
import CandidateInstructions from "./pages/candidate/Instructions";
import CandidateThankYou from "./pages/candidate/ThankYou";

// Other portals
import ProctorDashboard from "./pages/proctor/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import LiveExam from "./pages/exam/LiveExam";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* ── Student ─────────────────────────────────────────────────── */}
        <Route path="/student/dashboard"    element={<ProtectedRoute roles={["STUDENT"]}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/exams"        element={<ProtectedRoute roles={["STUDENT"]}><StudentAvailableExams /></ProtectedRoute>} />
        <Route path="/student/registered"   element={<ProtectedRoute roles={["STUDENT"]}><StudentRegistered /></ProtectedRoute>} />
        <Route path="/student/history"      element={<ProtectedRoute roles={["STUDENT"]}><StudentHistory /></ProtectedRoute>} />
        <Route path="/student/results"      element={<ProtectedRoute roles={["STUDENT"]}><StudentResults /></ProtectedRoute>} />
        <Route path="/student/re-evaluation" element={<ProtectedRoute roles={["STUDENT"]}><StudentReEvaluation /></ProtectedRoute>} />
        <Route path="/student/notifications" element={<ProtectedRoute roles={["STUDENT"]}><StudentNotifications /></ProtectedRoute>} />
        <Route path="/student/profile"      element={<ProtectedRoute roles={["STUDENT"]}><StudentProfile /></ProtectedRoute>} />

        {/* ── Faculty ─────────────────────────────────────────────────── */}
        <Route path="/faculty/dashboard"    element={<ProtectedRoute roles={["FACULTY"]}><FacultyDashboard /></ProtectedRoute>} />
        {/* /faculty/question-bank redirects → create-exam so old links don't 404 */}
        <Route path="/faculty/question-bank" element={<Navigate to="/faculty/create-exam" replace />} />
        <Route path="/faculty/create-exam"  element={<ProtectedRoute roles={["FACULTY"]}><FacultyCreateExam /></ProtectedRoute>} />
        <Route path="/faculty/evaluation"   element={<ProtectedRoute roles={["FACULTY"]}><FacultyEvaluation /></ProtectedRoute>} />
        <Route path="/faculty/analytics"    element={<ProtectedRoute roles={["FACULTY"]}><FacultyAnalytics /></ProtectedRoute>} />
        <Route path="/faculty/schedules"    element={<ProtectedRoute roles={["FACULTY"]}><FacultySchedules /></ProtectedRoute>} />
        <Route path="/faculty/reevaluations" element={<ProtectedRoute roles={["FACULTY"]}><FacultyReevaluations /></ProtectedRoute>} />
        <Route path="/faculty/notifications" element={<ProtectedRoute roles={["FACULTY"]}><FacultyNotificationsPage /></ProtectedRoute>} />
        <Route path="/faculty/profile"      element={<ProtectedRoute roles={["FACULTY"]}><FacultyProfile /></ProtectedRoute>} />

        {/* ── Candidate ────────────────────────────────────────────────── */}
        <Route path="/candidate/state"        element={<ProtectedRoute roles={["CANDIDATE"]}><CandidateExamState /></ProtectedRoute>} />
        <Route path="/candidate/instructions" element={<ProtectedRoute roles={["CANDIDATE"]}><CandidateInstructions /></ProtectedRoute>} />
        <Route path="/candidate/thank-you"    element={<ProtectedRoute roles={["CANDIDATE"]}><CandidateThankYou /></ProtectedRoute>} />

        {/* ── Proctor ──────────────────────────────────────────────────── */}
        <Route path="/proctor/dashboard"    element={<ProtectedRoute roles={["PROCTOR"]}><ProctorDashboard /></ProtectedRoute>} />

        {/* ── Admin ────────────────────────────────────────────────────── */}
        <Route path="/admin/dashboard"      element={<ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />

        {/* ── Live Exam (full-screen) — shared by Student and Candidate ── */}
        <Route path="/exam/live/:scheduleId" element={<ProtectedRoute roles={["STUDENT", "CANDIDATE"]}><LiveExam /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}