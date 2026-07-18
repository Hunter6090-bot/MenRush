import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ComingSoon } from './pages/ComingSoon';
import { BetaAccess } from './pages/BetaAccess';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Discover } from './pages/Discover';
import { Stream } from './pages/Stream';
import { Profile } from './pages/Profile';
import { ProfileSetup } from './pages/ProfileSetup';
import { ProfileView } from './pages/ProfileView';
import { RequireProfileSetup } from './components/RequireProfileSetup';
import { Albums } from './pages/Albums';
import { Matches } from './pages/Matches';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Cookies } from './pages/Cookies';
import { Contact } from './pages/Contact';
import { Safety } from './pages/Safety';
import { CommunityGuidelines } from './pages/CommunityGuidelines';
import { Help } from './pages/Help';
import { MessagingRoute } from './components/MessagingRoute';
import { RoomsRoute } from './components/RoomsRoute';
import { Verify } from './pages/Verify';
import { VerifyScan } from './pages/VerifyScan';
import { VerifyPending } from './pages/VerifyPending';
import { VerifyRejected } from './pages/VerifyRejected';
import { Premium } from './pages/Premium';
import { Events } from './pages/Events';
import { HotSpots } from './pages/HotSpots';
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { useAuthStore } from './hooks/store';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useGlobalMessageNotifications } from './hooks/useGlobalMessageNotifications';
import { useUnreadSync } from './hooks/useUnreadSync';
import { useNotificationSync } from './hooks/useNotificationSync';
import { useAuthProfileSync } from './hooks/useAuthProfileSync';
import { useLiveLocationPublisher } from './hooks/useLiveLocationPublisher';
import { readThemePreference, applyTheme } from './lib/theme';
import { FEATURES } from './lib/featureFlags';
import { VideoCallModal } from './components/VideoCallModal';
import { ToastNotifications } from './components/ToastNotifications';
import { savePostAuthRedirect } from './lib/profileLinks';

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
    return <Navigate to="/verify" replace />;
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
    return <Navigate to="/verify" replace />;
  }
  // Signed-in home: Nearby (Discover). Profile setup is gated by RequireProfileSetup.
  return <Navigate to="/discover" replace />;
}

function AppShell() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  // Zombie sessions: store.token set but localStorage cleared (or vice versa) → 401 spam.
  // Heal on boot and whenever token flips.
  useEffect(() => {
    const lsToken = localStorage.getItem('token');
    if (token && !lsToken) {
      logout();
      return;
    }
    if (!token && lsToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [token, logout]);

  // Follow OS theme when preference is "system".
  useEffect(() => {
    applyTheme(readThemePreference());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readThemePreference() === 'system') applyTheme('system');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  usePushNotifications(!!token);
  useGlobalMessageNotifications();
  useUnreadSync();
  useNotificationSync();
  useAuthProfileSync();
  useLiveLocationPublisher();

  return (
    <>
      <ToastNotifications />
      <Routes>
        <Route path="/" element={<ComingSoon />} />
        <Route path="/app" element={<AppEntry />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
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
        <Route path="/verify" element={<ProtectedRoute><Verify /></ProtectedRoute>} />
        <Route path="/verify/scan/:sessionId" element={<VerifyScan />} />
        <Route path="/verify/pending" element={<ProtectedRoute><VerifyPending /></ProtectedRoute>} />
        <Route path="/verify/rejected" element={<ProtectedRoute><VerifyRejected /></ProtectedRoute>} />
        <Route path="/premium" element={<RequireVerified><Premium /></RequireVerified>} />
        <Route path="/profile/setup" element={<RequireVerified allowIncompleteProfile><ProfileSetup /></RequireVerified>} />
        <Route path="/discover" element={<RequireVerified><Discover /></RequireVerified>} />
        <Route path="/discovery" element={<Navigate to="/discover" replace />} />
        <Route path="/stream" element={<RequireVerified><Stream /></RequireVerified>} />
        <Route path="/events" element={<RequireVerified><Events /></RequireVerified>} />
        <Route path="/hot-spots" element={<RequireVerified><HotSpots /></RequireVerified>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/notifications" element={<RequireVerified><Notifications /></RequireVerified>} />
        <Route path="/profile" element={<RequireVerified allowIncompleteProfile><Profile /></RequireVerified>} />
        <Route path="/profile/:id" element={<RequireVerified><ProfileView /></RequireVerified>} />
        <Route path="/albums" element={<RequireVerified><Albums /></RequireVerified>} />
        <Route path="/matches" element={<RequireVerified><Matches /></RequireVerified>} />
        <Route path="/conversations" element={<RequireVerified><MessagingRoute /></RequireVerified>} />
        <Route path="/messages/:otherId" element={<RequireVerified><MessagingRoute /></RequireVerified>} />
        <Route path="/rooms" element={<RequireVerified><RoomsRoute /></RequireVerified>} />
        <Route path="/rooms/:roomId" element={<RequireVerified><RoomsRoute /></RequireVerified>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {token && FEATURES.videoCalls && <VideoCallModal />}
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
