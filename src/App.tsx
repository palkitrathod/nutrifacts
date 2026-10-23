import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from 'react-router';
import { NutritionProvider, SESSION_EXPIRED, useNutrition } from './context/NutritionContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ApiError } from './auth/authApi';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { WhatsAppButton } from './components/WhatsAppButton';
import { AccountModal } from './components/AccountModal';
import { NotificationModal } from './components/NotificationModal';
import { PdfDietChartModal } from './components/PdfDietChartModal';
import { BookAppointmentModal, BookingRequest } from './components/BookAppointmentModal';

import { HomeScreen } from './screens/HomeScreen';
import { DietChartScreen } from './screens/DietChartScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { AppointmentsScreen } from './screens/AppointmentsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PackagesScreen } from './screens/PackagesScreen';
import { LandingPage } from './screens/LandingPage';
import { SignInPage } from './screens/auth/SignInPage';
import { SignUpPage } from './screens/auth/SignUpPage';
import { ForgotPasswordPage } from './screens/auth/ForgotPasswordPage';
import { VerifyEmailPage } from './screens/auth/VerifyEmailPage';
import { safeNextPath } from './screens/auth/AuthFields';
import { CheckoutPaymentModal } from './components/CheckoutPaymentModal';
import { PaymentReceiptModal } from './components/PaymentReceiptModal';
import { NutritionPackage, PackagePayment } from './types/nutrition';
import { isPlanActive } from './shared/plans';

/** Optional hand-off from the sign-up page (e.g. the plan or service picked on the home page). */
interface AppEntryState {
  openTab?: string;
  bookService?: string;
}

// ── Signed-in app shell ────────────────────────────────────────────────────
function NutritionAppContent({ onSignOut, entry }: { onSignOut: () => Promise<void>; entry: AppEntryState | null }) {
  const { currentUser, isDietitian, patients, packages, getCurrentUserDietChart, getActivePackage, bookAppointment, syncError, dismissSyncError } = useNutrition();

  const [activeTab, setActiveTab] = useState<string>(entry?.openTab ?? 'home');
  // "My profile" in the account panel opens the Profile tab with its edit form showing (only that once).
  const [profileEditRequest, setProfileEditRequest] = useState(0);
  useEffect(() => {
    if (activeTab !== 'profile') setProfileEditRequest(0);
  }, [activeTab]);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(!!entry?.bookService);
  const [bookServicePreset, setBookServicePreset] = useState<string | undefined>(entry?.bookService);

  // Payment states
  const [checkout, setCheckout] = useState<{ pkg: NutritionPackage; upgrade: boolean; renew: boolean; goal?: string } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<PackagePayment | null>(null);
  // A First Consultation waiting for its ₹499 payment; booked when the payment succeeds.
  const [pendingBooking, setPendingBooking] = useState<BookingRequest | null>(null);

  const currentChart = getCurrentUserDietChart();

  const handleOpenBookModal = (serviceTitle?: string) => {
    setBookServicePreset(serviceTitle);
    setIsBookModalOpen(true);
  };

  const handleOpenPdfModal = () => {
    setIsPdfModalOpen(true);
  };

  const handleSelectPackageToBuy = (pkg: NutritionPackage, options: { upgrade?: boolean; renew?: boolean; goal?: string } = {}) => {
    setCheckout({ pkg, upgrade: !!options.upgrade, renew: !!options.renew, goal: options.goal });
  };

  // Buying from Home while a plan is running would skip the upgrade credit / scheduled downgrade: use My Plans.
  const handleBuyFromHome = (pkg: NutritionPackage, goal?: string) => {
    if (isPlanActive(getActivePackage(currentUser.id))) setActiveTab('plans');
    else handleSelectPackageToBuy(pkg, { goal });
  };

  const handlePayFirstConsultation = (booking: BookingRequest) => {
    const pkg = packages.find((p) => p.id === 'pkg-basic-consultation');
    if (!pkg) return;
    setPendingBooking(booking);
    handleSelectPackageToBuy(pkg);
  };

  const handlePaymentSuccess = (payment: PackagePayment) => {
    if (pendingBooking && payment.packageId === 'pkg-basic-consultation') bookAppointment(pendingBooking);
    setPendingBooking(null);
    setCheckout(null);
    setViewingReceipt(payment);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9F7] text-slate-800 font-sans selection:bg-[#3E6553] selection:text-white">
      {/* Top App Header */}
      <TopAppBar
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'home' && (
          <HomeScreen
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenBookAppointment={handleOpenBookModal}
            onOpenPdfChart={handleOpenPdfModal}
            onOpenCheckout={handleBuyFromHome}
          />
        )}

        {activeTab === 'diet' && (
          <DietChartScreen onOpenPdfModal={handleOpenPdfModal} />
        )}

        {activeTab === 'plans' && (
          <PackagesScreen
            onSelectPackageToBuy={handleSelectPackageToBuy}
            onBookConsultation={handleOpenBookModal}
            onViewReceipt={(payment) => setViewingReceipt(payment)}
          />
        )}

        {activeTab === 'progress' && <ProgressScreen />}

        {activeTab === 'appointments' && (
          <AppointmentsScreen onOpenBookModal={() => handleOpenBookModal()} />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            key={profileEditRequest}
            startEditing={profileEditRequest > 0}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenPdfModal={handleOpenPdfModal}
            onViewReceipt={(payment) => setViewingReceipt(payment)}
          />
        )}
      </main>

      {syncError && syncError !== SESSION_EXPIRED && (
        <div role="alert" className="fixed top-3 inset-x-3 z-[60] mx-auto max-w-md flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">
          <span className="flex-1">{syncError}</span>
          <button type="button" onClick={dismissSyncError} className="font-semibold text-red-700 hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Floating WhatsApp Action Button */}
      <WhatsAppButton />

      {/* Bottom tab bar (phones & tablets) */}
      <BottomNavBar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />

      {/* Modals & Overlays */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onSignOut={onSignOut}
        onOpenProfile={
          isDietitian
            ? undefined
            : () => {
                setIsAccountOpen(false);
                setProfileEditRequest((n) => n + 1);
                setActiveTab('profile');
              }
        }
      />

      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {isPdfModalOpen && currentChart && (
        <PdfDietChartModal
          chart={currentChart}
          patient={isDietitian ? patients.find((p) => p.id === currentChart.patientId) ?? currentUser : currentUser}
          onClose={() => setIsPdfModalOpen(false)}
        />
      )}

      <BookAppointmentModal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        preselectedService={bookServicePreset}
        onPayFirstConsultation={handlePayFirstConsultation}
      />

      {/* Checkout Payment Modal */}
      {checkout && (
        <CheckoutPaymentModal
          packageItem={checkout.pkg}
          upgrade={checkout.upgrade}
          renew={checkout.renew}
          goal={checkout.goal}
          isOpen
          onClose={() => {
            setCheckout(null);
            setPendingBooking(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Payment Receipt / Tax Invoice Modal */}
      {viewingReceipt && (
        <PaymentReceiptModal
          payment={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}

const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F7FAF8]" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3 text-[#3E6553]">
      <svg className="animate-spin w-7 h-7" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <span className="text-sm font-medium">Loading Nutrifacts…</span>
    </div>
  </div>
);

// ── Route guards ────────────────────────────────────────────────────────────
/** Shown on the sign-in page after a session ended unexpectedly (expired / signed out elsewhere). */
export const SESSION_NOTICE_KEY = 'nf_session_notice';
const setSessionNotice = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(SESSION_NOTICE_KEY, '1');
    else sessionStorage.removeItem(SESSION_NOTICE_KEY);
  } catch {
    /* storage unavailable (private mode): the notice is optional */
  }
};

const isSessionGone = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 409);

function CenteredMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F7FAF8] px-5 text-center" role="alert">
      <h1 className="text-xl font-bold text-[#2D4C3C]">{title}</h1>
      {children}
    </div>
  );
}

function ProtectedApp() {
  const { status, user, signOut, retry } = useAuth();
  const { dataOwnerId, activateAccount, flushPendingChanges, resetData, syncError } = useNutrition();
  const location = useLocation();
  const navigate = useNavigate();
  // Read once: the hand-off from sign-up should not replay on refresh.
  const [entry] = useState(() => location.state as AppEntryState | null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const signingOut = useRef(false);

  const endSessionLocally = () => {
    // The session is no longer this account's (expired, signed out elsewhere, or another account
    // signed in from another tab). Wipe this screen and start clean: the reload re-checks who is
    // signed in. Never call sign-out here — that would end the *new* session another tab started.
    setSessionNotice(true);
    resetData();
    window.location.replace(location.pathname + location.search);
  };

  const needsVerification = user?.emailVerified === false;

  useEffect(() => {
    if (!user || needsVerification) return; // the server holds back data until the email is verified
    setLoadError(null);
    activateAccount(user)
      .then(() => setSessionNotice(false))
      .catch((err) => {
        if (isSessionGone(err)) return endSessionLocally();
        console.error('Loading your data failed', err);
        setLoadError(err instanceof Error ? err.message : 'Could not load your data.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, attempt]);

  useEffect(() => {
    if (syncError === SESSION_EXPIRED) endSessionLocally();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncError]);

  useEffect(() => {
    // (Not when heading to verification: that redirect carries the hand-off along.)
    if (location.state && !needsVerification) navigate(location.pathname + location.search, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await flushPendingChanges();
    signingOut.current = true;
    try {
      // Only once the server has ended the session is the screen cleared.
      await signOut();
    } catch (err) {
      signingOut.current = false;
      throw err;
    }
    resetData();
    navigate('/', { replace: true });
  };

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'unreachable') {
    return (
      <CenteredMessage title="We can't reach Nutrifacts right now">
        <p className="text-sm text-slate-500 max-w-sm">Check your internet connection, then try again. You are still signed in.</p>
        <button type="button" onClick={retry} className="px-6 py-3 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] text-white text-sm font-semibold">
          Try again
        </button>
      </CenteredMessage>
    );
  }
  if (!user) {
    if (signingOut.current) return <FullPageLoader />; // on the way to the home page
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  if (needsVerification) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/verify-email?next=${next}`} replace state={entry} />;
  }
  if (loadError) {
    return (
      <CenteredMessage title="We couldn't load your data">
        <p className="text-sm text-slate-500 max-w-sm">{loadError}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="px-6 py-3 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] text-white text-sm font-semibold"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => handleSignOut().catch(() => undefined)}
            className="px-6 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
          >
            Sign out
          </button>
        </div>
      </CenteredMessage>
    );
  }
  // Wait until the data on screen belongs to this account, so nobody sees someone else's data flash.
  if (dataOwnerId !== user.id) return <FullPageLoader />;

  return <NutritionAppContent onSignOut={handleSignOut} entry={entry} />;
}

/**
 * Sign-in / sign-up pages are for signed-out visitors only. Someone who arrives already signed in
 * is sent on; someone who signs in *on* the page is left alone so the page can navigate itself
 * (to `?next=` or with the sign-up hand-off) instead of racing this redirect.
 * An account that hasn't verified its email hasn't finished signing up, so it counts as a visitor
 * here: it can sign in again (back to the code screen) or start a fresh sign-up.
 */
function GuestOnly({ children }: { children: React.ReactElement }) {
  const { status, user } = useAuth();
  const [params] = useSearchParams();
  const arrivedSignedIn = useRef<boolean | null>(null);
  if (status !== 'loading' && arrivedSignedIn.current === null) {
    arrivedSignedIn.current = status === 'authenticated' && !!user?.emailVerified;
  }
  if (status === 'loading') return <FullPageLoader />;
  if (arrivedSignedIn.current) return <Navigate to={safeNextPath(params.get('next'))} replace />;
  return children;
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F7FAF8] px-5 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <p className="text-6xl font-bold text-[#3E6553]" style={{ fontFamily: "'Playfair Display', serif" }}>404</p>
      <h1 className="text-xl font-bold text-[#2D4C3C]">This page doesn't exist</h1>
      <p className="text-sm text-slate-500 max-w-sm">The link may be broken or the page may have moved.</p>
      <Link to="/" className="mt-2 px-6 py-3 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] text-white text-sm font-semibold">
        Go to home page
      </Link>
    </div>
  );
}

/**
 * Scroll position, handled by the app instead of the browser:
 * - opening a page via a link starts at its top (the browser kept the old position, so e.g. the
 *   "Create Free Account" button at the bottom of the home page opened sign-up scrolled down);
 * - refresh and Back/Forward return to where you were *before the first paint*, so the page doesn't
 *   flash at the top and then jump down (the browser restored scroll only after the page had drawn).
 * Rendered before <Routes> so its layout effect runs before the pages' own.
 */
function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  // Live position of the current page, kept up to date on every scroll (cheap: no storage write).
  const current = useRef({ key: location.key, y: 0 });

  const persist = (key: string, y: number) => {
    try {
      sessionStorage.setItem(`nf_scroll:${key}`, String(Math.round(y)));
    } catch {
      /* storage unavailable */
    }
  };

  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      current.current.y = window.scrollY;
      clearTimeout(timer);
      timer = setTimeout(() => persist(current.current.key, current.current.y), 100);
    };
    const onHide = () => persist(current.current.key, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onHide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  useLayoutEffect(() => {
    // Remember where the page we're leaving was — before this navigation moves the scroll.
    if (current.current.key !== location.key) persist(current.current.key, current.current.y);
    current.current = { key: location.key, y: 0 };

    if (location.hash) return; // in-page anchors (e.g. /#pricing) are scrolled by the page itself
    let saved: number | null = null;
    if (navigationType === 'POP') {
      try {
        const raw = sessionStorage.getItem(`nf_scroll:${location.key}`);
        saved = raw === null ? null : Number(raw);
      } catch {
        /* storage unavailable */
      }
    }
    current.current.y = saved ?? 0;

    if (!saved || !document.fonts) {
      window.scrollTo(0, saved ?? 0);
      return;
    }
    // Returning mid-page: the brand fonts change section heights slightly, so restoring before they
    // are applied lands a few px off and then shifts. Ask for exactly the fonts the pages use (cached
    // and preloaded, so this takes a few ms), keep the page invisible for that instant (max 300 ms),
    // then restore once, exactly.
    const root = document.documentElement;
    root.style.visibility = 'hidden';
    let done = false;
    const restore = () => {
      if (done) return;
      done = true;
      window.scrollTo(0, saved!);
      root.style.visibility = '';
    };
    Promise.all(
      ["400 16px 'Plus Jakarta Sans'", "italic 400 16px 'Plus Jakarta Sans'", "700 16px 'Playfair Display'", "italic 600 16px 'Playfair Display'"].map(
        (font) => document.fonts.load(font)
      )
    )
      .catch(() => undefined)
      .then(() => requestAnimationFrame(restore));
    const timer = setTimeout(restore, 300);
    return () => {
      clearTimeout(timer);
      restore();
    };
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Root export ─────────────────────────────────────────────────────────────
export function AppRoutes() {
  return (
    <>
    <ScrollManager />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<GuestOnly><SignInPage /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignUpPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/app/*" element={<ProtectedApp />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NutritionProvider>
          <AppRoutes />
        </NutritionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
