import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ComingSoon } from './pages/ComingSoon';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Discover } from './pages/Discover';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { Contact } from './pages/Contact';
import { Safety } from './pages/Safety';
import { CommunityGuidelines } from './pages/CommunityGuidelines';
import { Help } from './pages/Help';
import { Cookies } from './pages/Cookies';
import { useAuthStore } from './hooks/store';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ComingSoon />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <Discover />
            </ProtectedRoute>
          }
        />
        <Route path="/contact" element={<Contact />} />
        <Route path="/safety" element={<Safety />} />
        <Route path="/guidelines" element={<CommunityGuidelines />} />
        <Route path="/help" element={<Help />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
