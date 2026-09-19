// src/App.jsx
import { Suspense, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import AuthModal from "./Global/Authentication/AuthModal";
import ProtectedRoute from "./Global/Authentication/ProtectedRoutes";
import { ConfirmProvider } from "./Global/Common/components/ConfirmModal";
import { lazyPage } from "./Global/Common/lazyPage";
import { getSeasonValue, fetchActiveSeasonCode } from "./Global/Common/utils/seasonUtils";
import { useAuth } from "./Global/Context/AuthContext";
import Footer from "./Global/Layout/Footer";
import Header from "./Global/Layout/Header";
import NotFound from "./Global/NotFound";
import RouteSeo from "./Global/seo/RouteSeo";
import Home from "./Men/Local/Pages/Home/HomeWrapper";

const AlumniJoin = lazyPage(() => import("./Global/Authentication/AlumniJoin"));
const PendingApproval = lazyPage(() => import("./Global/Authentication/PendingApproval"));
const ResetPassword = lazyPage(() => import("./Global/Authentication/ResetPassword"));
const SetPassword = lazyPage(() => import("./Global/Authentication/SetPassword"));
const PrivacyPolicy = lazyPage(() => import("./Global/PrivacyPolicy"));
const TermsOfService = lazyPage(() => import("./Global/TermsOfService"));
const AdminDashboard = lazyPage(() => import("./Men/Local/Admin/AdminDash"));
const AlumniBudget = lazyPage(() => import("./Men/Local/Pages/AlumniBudget/AlumniBudget"));
const Donate = lazyPage(() => import("./Men/Local/Pages/Donate/Donate"));
const DonateSuccess = lazyPage(() => import("./Men/Local/Pages/Donate/DonateSuccess"));
const Dues = lazyPage(() => import("./Men/Local/Pages/Dues/Dues"));
const EventDetail = lazyPage(() => import("./Men/Local/Pages/EventSignup/EventDetail"));
const EventSignup = lazyPage(() => import("./Men/Local/Pages/EventSignup/EventSignup"));
const Fundraiser = lazyPage(() => import("./Men/Local/Pages/Fundraiser/Fundraiser"));
const FundraiserSuccess = lazyPage(() => import("./Men/Local/Pages/Fundraiser/FundraiserSuccess"));
const Gallery = lazyPage(() => import("./Men/Local/Pages/Gallery/GalleryMain"));
const Manage = lazyPage(() => import("./Men/Local/Pages/Payments/Manage"));
const PaymentsRedirect = lazyPage(() => import("./Men/Local/Pages/Payments/PaymentsRedirect"));
const Portal = lazyPage(() => import("./Men/Local/Pages/Payments/Portal"));
const RaffleDetail = lazyPage(() => import("./Men/Local/Pages/Raffles/RaffleDetail"));
const Raffles = lazyPage(() => import("./Men/Local/Pages/Raffles/Raffles"));
const RecruitmentForm = lazyPage(() => import("./Men/Local/Pages/Recruitment/Recruitment"));
const RecruitmentSubmissions = lazyPage(() => import("./Men/Local/Pages/Recruitment/Submissions"));
const Roster = lazyPage(() => import("./Men/Local/Pages/Roster/Roster"));
const Schedule = lazyPage(() => import("./Men/Local/Pages/Schedule/Schedule"));
const Settings = lazyPage(() => import("./Men/Local/Pages/Settings/Settings"));
const SponsorMain = lazyPage(() => import("./Men/Local/Pages/Sponsor/SponsorMain"));
const Stats = lazyPage(() => import("./Men/Local/Pages/Stats/Stats"));
const Checkout = lazyPage(() => import("./Men/Local/Pages/Store/Checkout/Checkout"));
const CheckoutSuccess = lazyPage(() => import("./Men/Local/Pages/Store/Checkout/CheckoutSuccess"));
const OrderLookup = lazyPage(() => import("./Men/Local/Pages/Store/OrderLookup"));
const Store = lazyPage(() => import("./Men/Local/Pages/Store/Store"));
const WAdminDashboard = lazyPage(() => import("./Women/Local/Admin/AdminDash"));
const WAlumniBudget = lazyPage(() => import("./Women/Local/Pages/AlumniBudget/AlumniBudget"));
const WDonate = lazyPage(() => import("./Women/Local/Pages/Donate/Donate"));
const WDonateSuccess = lazyPage(() => import("./Women/Local/Pages/Donate/DonateSuccess"));
const WDues = lazyPage(() => import("./Women/Local/Pages/Dues/Dues"));
const WEventDetail = lazyPage(() => import("./Women/Local/Pages/EventSignup/EventDetail"));
const WEventSignup = lazyPage(() => import("./Women/Local/Pages/EventSignup/EventSignup"));
const WFundraiser = lazyPage(() => import("./Women/Local/Pages/Fundraiser/Fundraiser"));
const WFundraiserSuccess = lazyPage(() => import("./Women/Local/Pages/Fundraiser/FundraiserSuccess"));
const WGallery = lazyPage(() => import("./Women/Local/Pages/Gallery/GalleryMain"));
const WHome = lazyPage(() => import("./Women/Local/Pages/Home/HomeWrapper"));
const WManage = lazyPage(() => import("./Women/Local/Pages/Payments/Manage"));
const WPaymentsRedirect = lazyPage(() => import("./Women/Local/Pages/Payments/PaymentsRedirect"));
const WPortal = lazyPage(() => import("./Women/Local/Pages/Payments/Portal"));
const WRaffleDetail = lazyPage(() => import("./Women/Local/Pages/Raffles/RaffleDetail"));
const WRaffles = lazyPage(() => import("./Women/Local/Pages/Raffles/Raffles"));
const WRecruitmentForm = lazyPage(() => import("./Women/Local/Pages/Recruitment/Recruitment"));
const WRecruitmentSubmissions = lazyPage(() => import("./Women/Local/Pages/Recruitment/Submissions"));
const WRoster = lazyPage(() => import("./Women/Local/Pages/Roster/Roster"));
const WSchedule = lazyPage(() => import("./Women/Local/Pages/Schedule/Schedule"));
const WSettings = lazyPage(() => import("./Women/Local/Pages/Settings/Settings"));
const WSponsorMain = lazyPage(() => import("./Women/Local/Pages/Sponsor/SponsorMain"));
const WStats = lazyPage(() => import("./Women/Local/Pages/Stats/Stats"));
const WCheckout = lazyPage(() => import("./Women/Local/Pages/Store/Checkout/Checkout"));
const WCheckoutSuccess = lazyPage(() => import("./Women/Local/Pages/Store/Checkout/CheckoutSuccess"));
const WStore = lazyPage(() => import("./Women/Local/Pages/Store/Store"));

function PageLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5E0009] border-t-transparent" />
    </div>
  );
}

export default function App() {
  const { roles } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const menRole = roles?.men;
  const womenRole = roles?.women;

  const [activeSeason, setActiveSeason] = useState(
    () => localStorage.getItem("selectedSeason") || getSeasonValue()
  );
  useEffect(() => {
    if (!localStorage.getItem("selectedSeason")) {
      fetchActiveSeasonCode().then(setActiveSeason);
    }
  }, []);

  return (
    <ConfirmProvider>
    <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    <Router>
      <div className="min-h-screen flex flex-col bg-white">
        <RouteSeo />
        <Header onAuthOpen={() => setShowAuthModal(true)} />

        <main className="flex-1 w-full">
          <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/alumni-join" element={<AlumniJoin />} />
            <Route path="/" element={<Home />} />
            <Route
              path="/schedule"
              element={<Navigate to={`/schedule/${activeSeason}`} replace />}
            />
            <Route
              path="/schedule/:season"
              element={<Schedule userRole={menRole} />}
            />
            <Route
              path="/roster"
              element={<Navigate to={`/roster/${activeSeason}`} replace />}
            />
            <Route
              path="/roster/:season"
              element={<Roster userRole={menRole} />}
            />
            <Route
              path="/stats"
              element={<Navigate to={`/stats/${activeSeason}`} replace />}
            />
            <Route
              path="/stats/:season"
              element={<Stats />}
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <PaymentsRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manage"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Manage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <Portal />
                </ProtectedRoute>
              }
            />
            <Route path="/store" element={<Store />} />
            <Route path="/order-lookup" element={<OrderLookup />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/donate/success" element={<DonateSuccess />} />
            <Route path="/fundraiser/:slug" element={<Fundraiser />} />
            <Route path="/fundraiser/:slug/success" element={<FundraiserSuccess />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/sponsorships" element={<SponsorMain />} />
            <Route path="/recruitment" element={<RecruitmentForm userRole={menRole} />} />
            <Route
              path="/recruitment/submissions"
              element={
                <ProtectedRoute allowedRoles={["admin", "player"]}>
                  <RecruitmentSubmissions userRole={menRole} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent", "alumni", "coach"]}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="/event-signup" element={<EventSignup />} />
            <Route path="/event-signup/:slug" element={<EventDetail />} />
            <Route path="/raffles" element={<Raffles />} />
            <Route path="/raffles/:slug" element={<RaffleDetail />} />
            <Route path="/checkout" element={<Checkout />} />
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
            <Route
              path="/alumni-budget"
              element={
                <ProtectedRoute allowedRoles={["admin", "alumni"]}>
                  <AlumniBudget />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dues"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <Dues />
                </ProtectedRoute>
              }
            />

            <Route path="/women" element={<WHome />} />
            <Route
              path="/women/schedule"
              element={<Navigate to={`/women/schedule/${activeSeason}`} replace />}
            />
            <Route
              path="/women/schedule/:season"
              element={<WSchedule userRole={womenRole} />}
            />
            <Route
              path="/women/roster"
              element={<Navigate to={`/women/roster/${activeSeason}`} replace />}
            />
            <Route
              path="/women/roster/:season"
              element={<WRoster userRole={womenRole} />}
            />
            <Route
              path="/women/stats"
              element={<Navigate to={`/women/stats/${activeSeason}`} replace />}
            />
            <Route
              path="/women/stats/:season"
              element={<WStats />}
            />
            <Route
              path="/women/payments"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <WPaymentsRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/women/manage"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <WManage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/women/portal"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <WPortal />
                </ProtectedRoute>
              }
            />
            <Route path="/women/store" element={<WStore />} />
            <Route path="/women/order-lookup" element={<OrderLookup />} />
            <Route path="/women/donate" element={<WDonate />} />
            <Route path="/women/donate/success" element={<WDonateSuccess />} />
            <Route path="/women/gallery" element={<WGallery />} />
            <Route path="/women/sponsorships" element={<WSponsorMain />} />
            <Route
              path="/women/recruitment"
              element={<WRecruitmentForm userRole={womenRole} />}
            />
            <Route
              path="/women/recruitment/submissions"
              element={
                <ProtectedRoute allowedRoles={["admin", "player"]}>
                  <WRecruitmentSubmissions userRole={womenRole} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/women/settings"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent", "alumni", "coach"]}>
                  <WSettings />
                </ProtectedRoute>
              }
            />
            <Route path="/women/event-signup" element={<WEventSignup />} />
            <Route path="/women/event-signup/:slug" element={<WEventDetail />} />
            <Route path="/women/fundraiser/:slug" element={<WFundraiser />} />
            <Route path="/women/fundraiser/:slug/success" element={<WFundraiserSuccess />} />
            <Route path="/women/raffles" element={<WRaffles />} />
            <Route path="/women/raffles/:slug" element={<WRaffleDetail />} />
            <Route
              path="/women/checkout"
              element={<WCheckout />}
            />
            <Route path="/women/checkout-success" element={<WCheckoutSuccess />} />
            <Route
              path="/women/alumni-budget"
              element={
                <ProtectedRoute allowedRoles={["admin", "alumni"]}>
                  <WAlumniBudget />
                </ProtectedRoute>
              }
            />
            <Route
              path="/women/dues"
              element={
                <ProtectedRoute allowedRoles={["admin", "player", "parent"]}>
                  <WDues />
                </ProtectedRoute>
              }
            />

            <Route
              path="/women/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <WAdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </main>

        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

        <Footer />
      </div>
    </Router>
    </ConfirmProvider>
  );
}

