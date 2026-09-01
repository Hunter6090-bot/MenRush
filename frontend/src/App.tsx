import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RequireProfileSetup } from './components/RequireProfileSetup';
import { useAuthStore } from './hooks/store';
import { usePushNotifications } from './hooks/usePushNotifications';
import { usePushDeepLink } from './hooks/usePushDeepLink';
import { useGlobalMessageNotifications } from './hooks/useGlobalMessageNotifications';
import { useUnreadSync } from './hooks/useUnreadSync';
import { useNotificationSync } from './hooks/useNotificationSync';
import { useAuthProfileSync } from './hooks/useAuthProfileSync';
import { usePremiumSync } from './hooks/usePremiumSync';
import { useLiveLocationPublisher } from './hooks/useLiveLocationPublisher';
import { readThemePreference, applyTheme } from './lib/theme';
import { FEATURES } from './lib/featureFlags';
import { ToastNotifications } from './components/ToastNotifications';
import { InstallPrompt } from './components/InstallPrompt';
import { savePostAuthRedirect } from './lib/profileLinks';
import { prefetchAppRouteChunks } from './lib/routeChunks';
import { readStoredToken } from './lib/authSession';

/**
 * Named-export pages → lazy defaults. Keeps Mapbox / heavy screens out of the
 * first paint on phones (chat, profile, matches must not parse mapbox-gl).
 */
function lazyNamed<T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] as ComponentType<Record<string, never>> };
  });
}

const ComingSoon = lazyNamed(() => import('./pages/ComingSoon'), 'ComingSoon');
const GetTheApp = lazyNamed(() => import('./pages/GetTheApp'), 'GetTheApp');
const BetaAccess = lazyNamed(() => import('./pages/BetaAccess'), 'BetaAccess');
const Login = lazyNamed(() => import('./pages/Login'), 'Login');
const Register = lazyNamed(() => import('./pages/Register'), 'Register');
const ForgotPassword = lazyNamed(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const ResetPassword = lazyNamed(() => import('./pages/ResetPassword'), 'ResetPassword');
const Discover = lazyNamed(() => import('./pages/Discover'), 'Discover');
const Stream = lazyNamed(() => import('./pages/Stream'), 'Stream');
const Profile = lazyNamed(() => import('./pages/Profile'), 'Profile');
const ProfileSetup = lazyNamed(() => import('./pages/ProfileSetup'), 'ProfileSetup');
const ProfileView = lazyNamed(() => import('./pages/ProfileView'), 'ProfileView');
const Albums = lazyNamed(() => import('./pages/Albums'), 'Albums');
const Matches = lazyNamed(() => import('./pages/Matches'), 'Matches');
const Terms = lazyNamed(() => import('./pages/Terms'), 'Terms');
const Privacy = lazyNamed(() => import('./pages/Privacy'), 'Privacy');
const Cookies = lazyNamed(() => import('./pages/Cookies'), 'Cookies');
const Contact = lazyNamed(() => import('./pages/Contact'), 'Contact');
const Safety = lazyNamed(() => import('./pages/Safety'), 'Safety');
const CommunityGuidelines = lazyNamed(
  () => import('./pages/CommunityGuidelines'),
  'CommunityGuidelines',
);
const Help = lazyNamed(() => import('./pages/Help'), 'Help');
const Pride = lazyNamed(() => import('./pages/Pride'), 'Pride');
const MessagingRoute = lazyNamed(() => import('./components/MessagingRoute'), 'MessagingRoute');
const RoomsRoute = lazyNamed(() => import('./components/RoomsRoute'), 'RoomsRoute');
const Verify = lazyNamed(() => import('./pages/Verify'), 'Verify');
const VerifyVeriff = lazyNamed(() => import('./pages/VerifyVeriff'), 'VerifyVeriff');
const VerifyScan = lazyNamed(() => import('./pages/VerifyScan'), 'VerifyScan');
const VerifyPending = lazyNamed(() => import('./pages/VerifyPending'), 'VerifyPending');
const VerifyRejected = lazyNamed(() => import('./pages/VerifyRejected'), 'VerifyRejected');
const VerificationCentre = lazyNamed(
  () => import('./pages/VerificationCentre'),
  'VerificationCentre',
);
const AuthenticityVerify = lazyNamed(
  () => import('./pages/AuthenticityVerify'),
  'AuthenticityVerify',
);
const Premium = lazyNamed(() => import('./pages/Premium'), 'Premium');
const Events = lazyNamed(() => import('./pages/Events'), 'Events');
const HotSpots = lazyNamed(() => import('./pages/HotSpots'), 'HotSpots');
const Settings = lazyNamed(() => import('./pages/Settings'), 'Settings');
const Notifications = lazyNamed(() => import('./pages/Notifications'), 'Notifications');
const VideoCallModal = lazyNamed(() => import('./components/VideoCallModal'), 'VideoCallModal');
const RoomTempIdentityGatePreview = lazyNamed(
  () => import('./pages/RoomTempIdentityGatePreview'),
  'RoomTempIdentityGatePreview',
);
const RoomInRoomDmPreview = lazyNamed(
  () => import('./pages/RoomInRoomDmPreview'),
  'RoomInRoomDmPreview',
);

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary, #0D0A06)',
        color: 'var(--text-primary, #F0E0C0)',
      }}
      aria-busy="true"
      data-testid="route-chunk-fallback"
    />
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

// Hard gate is OFF for beta — unverified users enter the app. Verification
// pages stay available but must not block Discover / Matches / Chat.
function RequireVerified({
  children,
  allowIncompleteProfile = false,
}: {
  children: JSX.Element;
  allowIncompleteProfile?: boolean;
}) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;

  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(returnPath)}`} replace />;
  }
  if (FEATURES.requireIdVerification && !user?.is_verified) {
    savePostAuthRedirect(returnPath);
    if (user?.verification_status === 'pending') return <Navigate to="/verify/pending" replace />;
    if (user?.verification_status === 'rejected') return <Navigate to="/verify/rejected" replace />;
    return <Navigate to="/verify/id" replace />;
  }
  if (allowIncompleteProfile) return children;
  return <RequireProfileSetup>{children}</RequireProfileSetup>;
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D0A06',
        color: '#F0E0C0',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2rem', color: '#C4832A', margin: 0 }}>404</h1>
      <p style={{ margin: 0 }}>This page does not exist.</p>
      <a href="/" style={{ color: '#C4832A' }}>
        Go home
      </a>
    </div>
  );
}

function AppEntry() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token) {
    return <Navigate to="/login?next=/discover" replace />;
  }
  if (FEATURES.requireIdVerification && !user?.is_verified) {
    if (user?.verification_status === 'pending') return <Navigate to="/verify/pending" replace />;
    if (user?.verification_status === 'rejected') return <Navigate to="/verify/rejected" replace />;
    return <Navigate to="/verify/id" replace />;
  }
  return <Navigate to="/discover" replace />;
}

function AppShell() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const rehydrateAuth = useAuthStore((s) => s.rehydrateAuth);

  // PWA / WebView cold starts sometimes leave Zustand empty while storage still
  // has a session (or the first localStorage read raced). Rehydrate — never wipe.
  useEffect(() => {
    const sync = () => {
      const restored = rehydrateAuth();
      if (restored) return;
      const storeToken = useAuthStore.getState().token;
      if (storeToken && !readStoredToken()) {
        // Intentional logout elsewhere cleared storage; drop the in-memory session.
        logout();
      }
    };
    sync();
    window.addEventListener('pageshow', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [token, logout, rehydrateAuth]);

  useEffect(() => {
    applyTheme(readThemePreference());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readThemePreference() === 'system') applyTheme('system');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (!token) return;
    prefetchAppRouteChunks();
  }, [token]);

  usePushNotifications(!!token);
  usePushDeepLink(!!token);
  useGlobalMessageNotifications();
  useUnreadSync();
  useNotificationSync();
  useAuthProfileSync();
  usePremiumSync(!!token);
  useLiveLocationPublisher();

  const showDevRoomGate =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'));

  return (
    <>
      {token ? <ToastNotifications /> : null}
      <LazyRoute>
        <Routes>
          <Route path="/" element={<ComingSoon />} />
          <Route path="/get-the-app" element={<GetTheApp />} />
          <Route path="/install" element={<Navigate to="/get-the-app" replace />} />
          <Route path="/app" element={<AppEntry />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/brightonpride" element={<Navigate to="/pride" replace />} />
          <Route path="/brightonpride26" element={<Navigate to="/pride" replace />} />
          <Route path="/pride" element={<Pride />} />
          <Route path="/beta" element={<BetaAccess />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/guidelines" element={<CommunityGuidelines />} />
          <Route path="/help" element={<Help />} />
          <Route
            path="/verify"
            element={
              <ProtectedRoute>
                <VerificationCentre />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify/id"
            element={
              <ProtectedRoute>
                {FEATURES.veriffAfterSignup ? <VerifyVeriff /> : <Verify />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify/id/manual"
            element={
              <ProtectedRoute>
                <Verify />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify/authentic"
            element={
              <ProtectedRoute>
                <AuthenticityVerify />
              </ProtectedRoute>
            }
          />
          <Route path="/verify/scan/:sessionId" element={<VerifyScan />} />
          <Route
            path="/verify/pending"
            element={
              <ProtectedRoute>
                <VerifyPending />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify/rejected"
            element={
              <ProtectedRoute>
                <VerifyRejected />
              </ProtectedRoute>
            }
          />
          <Route
            path="/premium"
            element={
              <RequireVerified>
                <Premium />
              </RequireVerified>
            }
          />
          <Route
            path="/profile/setup"
            element={
              <RequireVerified allowIncompleteProfile>
                <ProfileSetup />
              </RequireVerified>
            }
          />
          <Route
            path="/discover"
            element={
              <RequireVerified>
                <Discover />
              </RequireVerified>
            }
          />
          <Route path="/discovery" element={<Navigate to="/discover" replace />} />
          <Route
            path="/stream"
            element={
              <RequireVerified>
                <Stream />
              </RequireVerified>
            }
          />
          <Route
            path="/events"
            element={
              <RequireVerified>
                <Events />
              </RequireVerified>
            }
          />
          <Route
            path="/hot-spots"
            element={
              <RequireVerified>
                <HotSpots />
              </RequireVerified>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireVerified>
                <Notifications />
              </RequireVerified>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireVerified allowIncompleteProfile>
                <Profile />
              </RequireVerified>
            }
          />
          <Route
            path="/profile/:id"
            element={
              <RequireVerified>
                <ProfileView />
              </RequireVerified>
            }
          />
          <Route
            path="/albums"
            element={
              <RequireVerified>
                <Albums />
              </RequireVerified>
            }
          />
          <Route
            path="/matches"
            element={
              <RequireVerified>
                <Matches />
              </RequireVerified>
            }
          />
          <Route
            path="/conversations"
            element={
              <RequireVerified>
                <MessagingRoute />
              </RequireVerified>
            }
          />
          <Route
            path="/messages/:otherId"
            element={
              <RequireVerified>
                <MessagingRoute />
              </RequireVerified>
            }
          />
          <Route
            path="/rooms"
            element={
              <RequireVerified>
                <RoomsRoute />
              </RequireVerified>
            }
          />
          <Route
            path="/rooms/:roomId"
            element={
              <RequireVerified>
                <RoomsRoute />
              </RequireVerified>
            }
          />
          {showDevRoomGate ? (
            <>
              <Route path="/dev/room-temp-gate" element={<RoomTempIdentityGatePreview />} />
              <Route path="/dev/room-inroom-dm" element={<RoomInRoomDmPreview />} />
            </>
          ) : null}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </LazyRoute>
      {token ? <InstallPrompt variant="sheet" /> : null}
      {token && FEATURES.videoCalls ? (
        <LazyRoute>
          <VideoCallModal />
        </LazyRoute>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
