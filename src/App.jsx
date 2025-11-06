// src/App.jsx
import { useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { useAuth } from "./Global/Context/AuthContext";

import AuthModal from "./Global/Authentication/AuthModal";
import PendingApproval from "./Global/Authentication/PendingApproval";
import ProtectedRoute from "./Global/Authentication/ProtectedRoutes";
import Footer from "./Global/Layout/Footer";
import Header from "./Global/Layout/Header";
import NotFound from "./Global/NotFound";

import AdminDashboard from "./Men/Local/Admin/AdminDash";
import Donate from "./Men/Local/Pages/Donate/Donate";
import Gallery from "./Men/Local/Pages/Gallery/GalleryMain";
import Home from "./Men/Local/Pages/Home/HomeWrapper";
import Payments from "./Men/Local/Pages/Payments/Payments";
import RecruitmentForm from "./Men/Local/Pages/Recruitment/Recruitment";
import RecruitmentSubmissions from "./Men/Local/Pages/Recruitment/Submissions";
import Roster from "./Men/Local/Pages/Roster/Roster";
import Schedule from "./Men/Local/Pages/Schedule/Schedule";
import Settings from "./Men/Local/Pages/Settings/Settings";
import SponsorMain from "./Men/Local/Pages/Sponsor/SponsorMain";
import Checkout from "./Men/Local/Pages/Store/Checkout/Checkout";
import CheckoutSuccess from "./Men/Local/Pages/Store/Checkout/CheckoutSuccess";
import Store from "./Men/Local/Pages/Store/Store";

export default function App() {
  const { user, roles } = useAuth();
  const [cart, setCart] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const userRole = roles?.men;

  const getSeasonValue = (date = new Date()) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const start = m >= 8 ? y : y - 1;
    return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
  };

  const activeSeason = localStorage.getItem("selectedSeason") || getSeasonValue();

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header onAuthOpen={() => setShowAuthModal(true)} />
        <main className="flex-1 w-full px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/schedule"
              element={<Navigate to={`/schedule/${activeSeason}`} replace />}
            />
            <Route
              path="/schedule/:season"
              element={<Schedule user={user} userRole={userRole} />}
            />
            <Route
              path="/roster"
              element={<Navigate to={`/roster/${activeSeason}`} replace />}
            />
            <Route
              path="/roster/:season"
              element={<Roster user={user} userRole={userRole} />}
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <Payments user={user} userRole={userRole} />
                </ProtectedRoute>
              }
            />
            <Route path="/store" element={<Store cart={cart} setCart={setCart} />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/sponsorships" element={<SponsorMain />} />
            <Route path="/recruitment" element={<RecruitmentForm userRole={userRole} />} />
            <Route
              path="/recruitment/submissions"
              element={
                <ProtectedRoute allowedRoles={["admin", "player"]}>
                  <RecruitmentSubmissions userRole={userRole} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <Settings user={user} userRole={userRole} />
                </ProtectedRoute>
              }
            />
            <Route path="/checkout" element={<Checkout cart={cart} setCart={setCart} />} />
            <Route path="/checkout-success" element={<CheckoutSuccess />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound Found />} />
          </Routes>
        </main>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <Footer />
      </div>
    </Router>
  );
}
