import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ComingSoon } from './pages/ComingSoon';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Discover } from './pages/Discover';
import { Stream } from './pages/Stream';
import { Profile } from './pages/Profile';
import { ProfileView } from './pages/ProfileView';
import { Albums } from './pages/Albums';
import { Matches } from './pages/Matches';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Cookies } from './pages/Cookies';
import { Contact } from './pages/Contact';
import { Safety } from './pages/Safety';
import { CommunityGuidelines } from './pages/CommunityGuidelines';
import { Help } from './pages/Help';
import { Conversations } from './pages/Conversations';
import { Messages } from './pages/Messaging';
import { Rooms } from './pages/Rooms';
import { RoomChat } from './pages/RoomChat';
import { Verify } from './pages/Verify';
import { VerifyPending } from './pages/VerifyPending';
import { VerifyRejected } from './pages/VerifyRejected';
import { Premium } from './pages/Premium';
import { Notifications } from './pages/Notifications';
import { useAuthStore } from './hooks/store';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useGlobalMessageNotifications } from './hooks/useGlobalMessageNotifications';
import { useUnreadSync } from './hooks/useUnreadSync';
import { useNotificationSync } from './hooks/useNotificationSync';
import { useAuthProfileSync } from './hooks/useAuthProfileSync';
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

// Gate any route that surfaces other users (Discover, Matches, Chat, Rooms).
// Unverified users are redirected to ID + selfie verification;
// pending/rejected get a status-specific landing.
function RequireVerified({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;

  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(returnPath)}`} replace />;
  }
  if (!user?.is_verified) {
    savePostAuthRedirect(returnPath);
    if (user?.verification_status === 'pending') return <Navigate to="/verify/pending" replace />;
    if (user?.verification_status === 'rejected') return <Navigate to="/verify/rejected" replace />;
    return <Navigate to="/verify" replace />;
  }
  return children;
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

function AppShell() {
  const token = useAuthStore((s) => s.token);
  usePushNotifications(!!token);
  useGlobalMessageNotifications();
  useUnreadSync();
  useNotificationSync();
  useAuthProfileSync();

  return (
    <>
      <ToastNotifications />
      <Routes>
        <Route path="/" element={<ComingSoon />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
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
        <Route path="/verify/pending" element={<ProtectedRoute><VerifyPending /></ProtectedRoute>} />
        <Route path="/verify/rejected" element={<ProtectedRoute><VerifyRejected /></ProtectedRoute>} />
        <Route path="/premium" element={<RequireVerified><Premium /></RequireVerified>} />
        <Route path="/discover" element={<RequireVerified><Discover /></RequireVerified>} />
        <Route path="/stream" element={<RequireVerified><Stream /></RequireVerified>} />
        <Route path="/notifications" element={<RequireVerified><Notifications /></RequireVerified>} />
        <Route path="/profile" element={<RequireVerified><Profile /></RequireVerified>} />
        <Route path="/profile/:id" element={<RequireVerified><ProfileView /></RequireVerified>} />
        <Route path="/albums" element={<RequireVerified><Albums /></RequireVerified>} />
        <Route path="/matches" element={<RequireVerified><Matches /></RequireVerified>} />
        <Route path="/conversations" element={<RequireVerified><Conversations /></RequireVerified>} />
        <Route path="/messages/:otherId" element={<RequireVerified><Messages /></RequireVerified>} />
        {FEATURES.chatRooms && (
          <>
            <Route path="/rooms" element={<RequireVerified><Rooms /></RequireVerified>} />
            <Route path="/rooms/:roomId" element={<RequireVerified><RoomChat /></RequireVerified>} />
          </>
        )}
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
