/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { EnrollmentForm } from "./pages/EnrollmentForm";
import { AdmitCard } from "./pages/AdmitCard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Login } from "./pages/Login";
import { UserDashboard } from "./pages/UserDashboard";
import { Messenger } from "./pages/Messenger";
import { Gallery } from "./pages/Gallery";
import { Admin2Login } from "./pages/Admin2Login";
import { Admin2Dashboard } from "./pages/Admin2Dashboard";
import { AdminQrDashboard } from "./pages/AdminQrDashboard";
import { PublicQrScan } from "./pages/PublicQrScan";
import { ExamPortal } from "./pages/ExamPortal";
import { ExamCandidateLogin } from "./pages/ExamCandidateLogin";
import { ExamAdminLogin } from "./pages/ExamAdminLogin";
import { ExamCandidateDashboard } from "./pages/ExamCandidateDashboard";
import { ExamInstructions } from "./pages/ExamInstructions";
import { TakeExam } from "./pages/TakeExam";
import { ExamResultPage } from "./pages/ExamResultPage";
import { ExamAdminDashboard } from "./pages/ExamAdminDashboard";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { ChatBot } from "./components/ChatBot";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/enroll" element={<EnrollmentForm />} />
              <Route path="/admit-card/:id" element={<AdmitCard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/qr-scan" element={<PublicQrScan />} />
              <Route path="/admin" element={<Login />} />
              <Route path="/admin2" element={<Admin2Login />} />

              {/* Protected Cadet / User Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              } />
              <Route path="/messenger" element={
                <ProtectedRoute>
                  <Messenger />
                </ProtectedRoute>
              } />

              {/* Protected Admin Routes */}
              <Route path="/admin/dashboard" element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/qr-dashboard" element={
                <ProtectedRoute requireAdmin>
                  <AdminQrDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin2/dashboard" element={
                <ProtectedRoute requireAdmin>
                  <Admin2Dashboard />
                </ProtectedRoute>
              } />

              {/* Examination Module Routes */}
              <Route path="/exam" element={<ExamPortal />} />
              <Route path="/exam/login" element={<ExamCandidateLogin />} />
              <Route path="/exam/admin/login" element={<ExamAdminLogin />} />
              <Route path="/exam/dashboard" element={
                <ProtectedRoute>
                  <ExamCandidateDashboard />
                </ProtectedRoute>
              } />
              <Route path="/exam/instructions/:examId" element={
                <ProtectedRoute>
                  <ExamInstructions />
                </ProtectedRoute>
              } />
              <Route path="/exam/take/:examId" element={
                <ProtectedRoute>
                  <TakeExam />
                </ProtectedRoute>
              } />
              <Route path="/exam/result/:attemptId" element={
                <ProtectedRoute>
                  <ExamResultPage />
                </ProtectedRoute>
              } />
              <Route path="/exam/admin" element={
                <ProtectedRoute requireAdmin>
                  <ExamAdminDashboard />
                </ProtectedRoute>
              } />
            </Routes>
          </main>
          <Footer />
          <ChatBot />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

