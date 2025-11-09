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

// Men components
import AdminDashboard from "./Men/Local/Admin/AdminDash";
import Donate from "./Men/Local/Pages/Donate/Donate";
import Gallery from "./Men/Local/Pages/Gallery/GalleryMain";
import ManageArticlesModal from "./Men/Local/Pages/Home/Articles/ManageArticles.jsx";
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


// Women components
import WAdminDashboard from "./Women/Local/Admin/AdminDash";
import WDonate from "./Women/Local/Pages/Donate/Donate";
import WGallery from "./Women/Local/Pages/Gallery/GalleryMain";
import WManageArticlesModal from "./Women/Local/Pages/Home/Articles/ManageArticles.jsx";
import WHome from "./Women/Local/Pages/Home/HomeWrapper";
import WPayments from "./Women/Local/Pages/Payments/Payments";
import WRecruitmentForm from "./Women/Local/Pages/Recruitment/Recruitment";
import WRecruitmentSubmissions from "./Women/Local/Pages/Recruitment/Submissions";
import WRoster from "./Women/Local/Pages/Roster/Roster";
import WSchedule from "./Women/Local/Pages/Schedule/Schedule";
import WSettings from "./Women/Local/Pages/Settings/Settings";
import WSponsorMain from "./Women/Local/Pages/Sponsor/SponsorMain";
import WCheckout from "./Women/Local/Pages/Store/Checkout/Checkout";
import WCheckoutSuccess from "./Women/Local/Pages/Store/Checkout/CheckoutSuccess";
import WStore from "./Women/Local/Pages/Store/Store";

export default function App() {
  const { user, roles } = useAuth();
  const [cart, setCart] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showManageArticles, setShowManageArticles] = useState(false);
  const [showManageArticlesWomen, setShowManageArticlesWomen] = useState(false);

  const menRole = roles?.men;
  const womenRole = roles?.women;

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
        <Header
            onAuthOpen={() => setShowAuthModal(true)}
            onManageArticles={() => {
              setShowManageArticles(true);
            }}
            onManageArticlesWomen={() => {
              setShowManageArticlesWomen(true);
            }}
          />


        <main className="flex-1 w-full px-4 py-8">
          <Routes>
            {/* Men routes */}
            <Route path="/" element={<Home />} />
            <Route path="/schedule" element={<Navigate to={`/schedule/${activeSeason}`} replace />} />
            <Route path="/schedule/:season" element={<Schedule user={user} userRole={menRole} />} />
            <Route path="/roster" element={<Navigate to={`/roster/${activeSeason}`} replace />} />
            <Route path="/roster/:season" element={<Roster user={user} userRole={menRole} />} />
            <Route path="/payments" element={<ProtectedRoute allowedRoles={["admin","player","parent"]}><Payments user={user} userRole={menRole} /></ProtectedRoute>} />
            <Route path="/store" element={<Store cart={cart} setCart={setCart} />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/sponsorships" element={<SponsorMain />} />
            <Route path="/recruitment" element={<RecruitmentForm userRole={menRole} />} />
            <Route path="/recruitment/submissions" element={<ProtectedRoute allowedRoles={["admin","player"]}><RecruitmentSubmissions userRole={menRole} /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin","player","parent"]}><Settings userRole={menRole} /></ProtectedRoute>} />
            <Route path="/checkout" element={<Checkout cart={cart} setCart={setCart} />} />
            <Route path="/checkout-success" element={<CheckoutSuccess />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

            {/* Women routes */}
            <Route path="/women" element={<WHome />} />
            <Route path="/women/schedule" element={<Navigate to={`/women/schedule/${activeSeason}`} replace />} />
            <Route path="/women/schedule/:season" element={<WSchedule user={user} userRole={womenRole} />} />
            <Route path="/women/roster" element={<Navigate to={`/women/roster/${activeSeason}`} replace />} />
            <Route path="/women/roster/:season" element={<WRoster user={user} userRole={womenRole} />} />
            <Route path="/women/payments" element={<ProtectedRoute allowedRoles={["admin","player","parent"]}><WPayments user={user} userRole={womenRole} /></ProtectedRoute>} />
            <Route path="/women/store" element={<WStore cart={cart} setCart={setCart} />} />
            <Route path="/women/donate" element={<WDonate />} />
            <Route path="/women/gallery" element={<WGallery />} />
            <Route path="/women/sponsorships" element={<WSponsorMain />} />
            <Route path="/women/recruitment" element={<WRecruitmentForm userRole={womenRole} />} />
            <Route path="/women/recruitment/submissions" element={<ProtectedRoute allowedRoles={["admin","player"]}><WRecruitmentSubmissions userRole={womenRole} /></ProtectedRoute>} />
            <Route path="/women/settings" element={<ProtectedRoute allowedRoles={["admin","player","parent"]}><WSettings userRole={womenRole} /></ProtectedRoute>} />
            <Route path="/women/checkout" element={<WCheckout cart={cart} setCart={setCart} />} />
            <Route path="/women/checkout-success" element={<WCheckoutSuccess />} />
            <Route path="/women/admin" element={<ProtectedRoute allowedRoles={["admin"]}><WAdminDashboard /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound Found />} />
          </Routes>
        </main>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        {showManageArticles && (<ManageArticlesModal isOpen={showManageArticles} onClose={() => setShowManageArticles(false)} />)}
        {showManageArticlesWomen && (<WManageArticlesModal isOpen={showManageArticlesWomen} onClose={() => setShowManageArticlesWomen(false)} />)}
        <Footer />
      </div>
    </Router>
  );
}
