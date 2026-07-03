import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ComingSoon } from './pages/ComingSoon';
import { SignIn } from './pages/SignIn';
import { BetaAccess } from './pages/BetaAccess';
import { CreateAccount } from './pages/CreateAccount';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ComingSoon />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/beta" element={<BetaAccess />} />
        <Route path="/register" element={<CreateAccount />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
