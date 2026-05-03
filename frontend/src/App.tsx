import { ComingSoon } from './pages/ComingSoon';
import { GurlTingle } from './pages/GurlTingle';

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/gurltingle')) {
    return <GurlTingle />;
  }
  return <ComingSoon />;
}
