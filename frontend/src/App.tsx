import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Discover } from './pages/Discover';
import { Messages } from './pages/Messaging';
import { Conversations } from './pages/Conversations';
import { Matches } from './pages/Matches';
import { Profile } from './pages/Profile';
import { Landing } from './pages/Landing';
import { Rooms } from './pages/Rooms';
import { RoomChat } from './pages/RoomChat';
import { VideoCallModal } from './components/VideoCallModal';
import { useAuthStore } from './hooks/store';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VideoCallModal />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
          <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
          <Route path="/conversations" element={<ProtectedRoute><Conversations /></ProtectedRoute>} />
          <Route path="/messages/:otherId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
          <Route path="/rooms/:roomId" element={<ProtectedRoute><RoomChat /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
