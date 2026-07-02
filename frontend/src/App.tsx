import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ComingSoon } from './pages/ComingSoon';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { Contact } from './pages/Contact';
import { Safety } from './pages/Safety';
import { CommunityGuidelines } from './pages/CommunityGuidelines';
import { Help } from './pages/Help';
import { Cookies } from './pages/Cookies';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ComingSoon />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
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
