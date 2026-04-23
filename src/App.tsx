/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { EnrollmentForm } from "./pages/EnrollmentForm";
import { AdmitCard } from "./pages/AdmitCard";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Login } from "./pages/Login";
import { UserDashboard } from "./pages/UserDashboard";
import { Messenger } from "./pages/Messenger";
import { Gallery } from "./pages/Gallery";
import { Admin2Login } from "./pages/Admin2Login";
import { Admin2Dashboard } from "./pages/Admin2Dashboard";
import { Navbar } from "./components/Navbar";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ChatBot } from "./components/ChatBot";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen flex flex-col">
          <Header />
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/enroll" element={<EnrollmentForm />} />
              <Route path="/admit-card/:id" element={<AdmitCard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/messenger" element={<Messenger />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/admin" element={<Login />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin2" element={<Admin2Login />} />
              <Route path="/admin2/dashboard" element={<Admin2Dashboard />} />
            </Routes>
          </main>
          <Footer />
          <ChatBot />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
