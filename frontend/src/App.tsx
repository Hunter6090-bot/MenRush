import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ComingSoon } from './pages/ComingSoon';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Discover } from './pages/Discover';
import { Profile } from './pages/Profile';
import { ProfileView } from './pages/ProfileView';
import { Matches } from './pages/Matches';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Conversations } from './pages/Conversations';
import { Messages } from './pages/Messaging';
import { Rooms } from './pages/Rooms';
import { RoomChat } from './pages/RoomChat';
import { Verify } from './pages/Verify';
import { VerifyPending } from './pages/VerifyPending';
import { VerifyRejected } from './pages/VerifyRejected';
import { useAuthStore } from './hooks/store';
import { FEATURES } from './lib/featureFlags';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Gate any route that surfaces other users (Discover, Matches, Chat, Rooms).
// Per `agents/stripe-identity-spec.md`, unverified users are redirected to
// the verification flow; pending/rejected get a status-specific landing.
function RequireVerified({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (!token) return <Navigate to="/login" replace />;
  if (!user?.is_verified) {
    if (user?.verification_status === 'pending') return <Navigate to="/verify/pending" replace />;
    if (user?.verification_status === 'rejected') return <Navigate to="/verify/rejected" replace />;
    return <Navigate to="/verify" replace />;
  }
  return children;
}

function RootRedirect() {
  const token = useAuthStore((s) => s.token);
  return <Navigate to={token ? '/discover' : '/login'} replace />;
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/verify" element={<ProtectedRoute><Verify /></ProtectedRoute>} />
        <Route path="/verify/pending" element={<ProtectedRoute><VerifyPending /></ProtectedRoute>} />
        <Route path="/verify/rejected" element={<ProtectedRoute><VerifyRejected /></ProtectedRoute>} />
        <Route path="/discover" element={<RequireVerified><Discover /></RequireVerified>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<RequireVerified><ProfileView /></RequireVerified>} />
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
    </BrowserRouter>
  );
}
