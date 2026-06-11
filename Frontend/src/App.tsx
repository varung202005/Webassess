import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DevNav from "./components/DevNav";
import ProtectedRoute from "./routes/ProtectedRoute";

import Login from "./pages/auth/Login";

import StudentDashboard from "./pages/student/Dashboard";
import StudentAvailableExams from "./pages/student/AvailableExams";
import StudentRegistered from "./pages/student/Registered";
import StudentHistory from "./pages/student/History";
import StudentResults from "./pages/student/Results";

import FacultyDashboard from "./pages/faculty/Dashboard";
import FacultyQuestionBank from "./pages/faculty/QuestionBank";
import FacultyCreateExam from "./pages/faculty/CreateExam";
import FacultyEvaluation from "./pages/faculty/Evaluation";
import FacultyAnalytics from "./pages/faculty/Analytics";

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

        {/* Student */}
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute roles={["STUDENT"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/exams"
          element={
            <ProtectedRoute roles={["STUDENT"]}>
              <StudentAvailableExams />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/registered"
          element={
            <ProtectedRoute roles={["STUDENT"]}>
              <StudentRegistered />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/history"
          element={
            <ProtectedRoute roles={["STUDENT"]}>
              <StudentHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/results"
          element={
            <ProtectedRoute roles={["STUDENT"]}>
              <StudentResults />
            </ProtectedRoute>
          }
        />

        {/* Faculty */}
        <Route
          path="/faculty/dashboard"
          element={
            <ProtectedRoute roles={["FACULTY"]}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/question-bank"
          element={
            <ProtectedRoute roles={["FACULTY"]}>
              <FacultyQuestionBank />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/create-exam"
          element={
            <ProtectedRoute roles={["FACULTY"]}>
              <FacultyCreateExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/evaluation"
          element={
            <ProtectedRoute roles={["FACULTY"]}>
              <FacultyEvaluation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/analytics"
          element={
            <ProtectedRoute roles={["FACULTY"]}>
              <FacultyAnalytics />
            </ProtectedRoute>
          }
        />

        {/* Proctor */}
        <Route
          path="/proctor/dashboard"
          element={
            <ProtectedRoute roles={["PROCTOR"]}>
              <ProctorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Exam (full-screen, no chrome) */}
        <Route
          path="/exam/live"
          element={
            <ProtectedRoute roles={["STUDENT"]}>
              <LiveExam />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
      <DevNav />
    </BrowserRouter>
  );
}
