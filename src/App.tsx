/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./context/AuthContext";
import { CMSProvider } from "./context/CMSContext";
import { LanguageProvider } from "./context/LanguageContext";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { ChatBot } from "./components/ChatBot";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { ImpersonationBanner } from "./components/ImpersonationBanner";

const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const EnrollmentForm = lazy(() =>
  import("./pages/EnrollmentForm").then((m) => ({ default: m.EnrollmentForm }))
);
const AdmitCard = lazy(() =>
  import("./pages/AdmitCard").then((m) => ({ default: m.AdmitCard }))
);
const AdminDashboard = lazy(() =>
  import("./pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const UserDashboard = lazy(() =>
  import("./pages/UserDashboard").then((m) => ({ default: m.UserDashboard }))
);
const Messenger = lazy(() =>
  import("./pages/Messenger").then((m) => ({ default: m.Messenger }))
);
const Gallery = lazy(() =>
  import("./pages/Gallery").then((m) => ({ default: m.Gallery }))
);
const CadetsPage = lazy(() =>
  import("./pages/CadetsPage").then((m) => ({ default: m.CadetsPage }))
);
const HallOfInchargesPage = lazy(() =>
  import("./pages/HallOfInchargesPage").then((m) => ({ default: m.HallOfInchargesPage }))
);
const HowToBecomeCadetPage = lazy(() =>
  import("./pages/HowToBecomeCadetPage").then((m) => ({ default: m.HowToBecomeCadetPage }))
);
const AboutPage = lazy(() =>
  import("./pages/AboutPage").then((m) => ({ default: m.AboutPage }))
);
const ActivitiesPage = lazy(() =>
  import("./pages/ActivitiesPage").then((m) => ({ default: m.ActivitiesPage }))
);
const ContactPage = lazy(() =>
  import("./pages/ContactPage").then((m) => ({ default: m.ContactPage }))
);
const NoticeBoardPage = lazy(() =>
  import("./pages/NoticeBoardPage").then((m) => ({ default: m.NoticeBoardPage }))
);
const Admin2Login = lazy(() =>
  import("./pages/Admin2Login").then((m) => ({ default: m.Admin2Login }))
);
const Admin2Dashboard = lazy(() =>
  import("./pages/Admin2Dashboard").then((m) => ({ default: m.Admin2Dashboard }))
);
const AdminQrDashboard = lazy(() =>
  import("./pages/AdminQrDashboard").then((m) => ({ default: m.AdminQrDashboard }))
);
const PublicQrScan = lazy(() =>
  import("./pages/PublicQrScan").then((m) => ({ default: m.PublicQrScan }))
);
const OfflineApplicationPublicPage = lazy(() =>
  import("./pages/OfflineApplicationPublicPage").then((m) => ({
    default: m.OfflineApplicationPublicPage,
  }))
);
const CMSPage = lazy(() =>
  import("./pages/CMSPage").then((m) => ({ default: m.CMSPage }))
);
const ExamPortal = lazy(() =>
  import("./pages/ExamPortal").then((m) => ({ default: m.ExamPortal }))
);
const ExamCandidateLogin = lazy(() =>
  import("./pages/ExamCandidateLogin").then((m) => ({ default: m.ExamCandidateLogin }))
);
const ExamAdminLogin = lazy(() =>
  import("./pages/ExamAdminLogin").then((m) => ({ default: m.ExamAdminLogin }))
);
const ExamCandidateDashboard = lazy(() =>
  import("./pages/ExamCandidateDashboard").then((m) => ({
    default: m.ExamCandidateDashboard,
  }))
);
const ExamInstructions = lazy(() =>
  import("./pages/ExamInstructions").then((m) => ({ default: m.ExamInstructions }))
);
const TakeExam = lazy(() =>
  import("./pages/TakeExam").then((m) => ({ default: m.TakeExam }))
);
const ExamResultPage = lazy(() =>
  import("./pages/ExamResultPage").then((m) => ({ default: m.ExamResultPage }))
);
const ExamAdminDashboard = lazy(() =>
  import("./pages/ExamAdminDashboard").then((m) => ({ default: m.ExamAdminDashboard }))
);
import { ExamPortalGate } from "./components/exam/ExamPortalGate";

function RouteLoadingFallback() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#F5F7FA]">
      <Loader2 className="w-8 h-8 text-[#002147] animate-spin" />
      <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
        Loading BNCC Portal...
      </p>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <CMSProvider>
            <Router>
              <div className="min-h-screen flex flex-col">
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#C5A059] focus:text-[#00152e] focus:font-bold focus:rounded-lg focus:shadow-xl"
                >
                  Skip to main content
                </a>
                <Navbar />
                <OfflineIndicator />
                <ImpersonationBanner />
                <main id="main-content" tabIndex={-1} className="flex-grow outline-none">
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/enroll" element={<EnrollmentForm />} />
                    <Route path="/admit-card/:id" element={<AdmitCard />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/gallery" element={<Gallery />} />
                    <Route path="/cadets" element={<CadetsPage />} />
                    <Route path="/hall-of-incharges" element={<HallOfInchargesPage />} />
                    <Route path="/incharges" element={<HallOfInchargesPage />} />
                    <Route path="/how-to-become-cadet" element={<HowToBecomeCadetPage />} />
                    <Route path="/cadet-guide" element={<HowToBecomeCadetPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/activities" element={<ActivitiesPage />} />
                    <Route path="/notices" element={<NoticeBoardPage />} />
                    <Route path="/notice-board" element={<NoticeBoardPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/qr-scan" element={<PublicQrScan />} />
                    <Route path="/offline-application" element={<OfflineApplicationPublicPage />} />
                    <Route path="/offline-form" element={<OfflineApplicationPublicPage />} />
                    <Route path="/admin" element={<Login />} />
                    <Route path="/admin2" element={<Admin2Login />} />

                    {/* Protected Cadet / User Routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <UserDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/messenger"
                      element={
                        <ProtectedRoute>
                          <Messenger />
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Admin Routes */}
                    <Route
                      path="/admin/dashboard"
                      element={
                        <ProtectedRoute requireAdmin requiredPermission="view_admin_dashboard">
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/cms"
                      element={
                        <ProtectedRoute requireAdmin requiredPermission="manage_cms">
                          <CMSPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/qr-dashboard"
                      element={
                        <ProtectedRoute requireAdmin requiredPermission="manage_qr_attendance">
                          <AdminQrDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin2/dashboard"
                      element={
                        <ProtectedRoute requireAdmin requiredPermission="manage_qr_attendance">
                          <Admin2Dashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Examination Module Routes */}
                    <Route path="/exam" element={<ExamPortalGate><ExamPortal /></ExamPortalGate>} />
                    <Route path="/exam/login" element={<ExamPortalGate><ExamCandidateLogin /></ExamPortalGate>} />
                    <Route path="/exam/admin/login" element={<ExamAdminLogin />} />
                    <Route
                      path="/exam/dashboard"
                      element={
                        <ExamPortalGate>
                          <ProtectedRoute>
                            <ExamCandidateDashboard />
                          </ProtectedRoute>
                        </ExamPortalGate>
                      }
                    />
                    <Route
                      path="/exam/instructions/:examId"
                      element={
                        <ExamPortalGate>
                          <ProtectedRoute>
                            <ExamInstructions />
                          </ProtectedRoute>
                        </ExamPortalGate>
                      }
                    />
                    <Route
                      path="/exam/take/:examId"
                      element={
                        <ExamPortalGate>
                          <ProtectedRoute>
                            <TakeExam />
                          </ProtectedRoute>
                        </ExamPortalGate>
                      }
                    />
                    <Route
                      path="/exam/result/:attemptId"
                      element={
                        <ExamPortalGate>
                          <ProtectedRoute>
                            <ExamResultPage />
                          </ProtectedRoute>
                        </ExamPortalGate>
                      }
                    />
                    <Route
                      path="/exam/admin"
                      element={
                        <ProtectedRoute requireAdmin requiredPermission="manage_exams">
                          <ExamAdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <ChatBot />
            </div>
          </Router>
        </CMSProvider>
      </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
