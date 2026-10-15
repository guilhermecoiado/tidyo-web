import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SessionProvider, useApp } from './lib/session';
import { FullLoader } from './components/ui';
import Auth, { NewPassword } from './pages/Auth';
import Onboarding, { AcceptInvite } from './pages/Onboarding';
import { Billing, Clients, Home, More, Schedule } from './pages/Owner';
import MyDay from './pages/MyDay';
import Landing from './pages/Landing';

function Gate({ need, children }: { need: 'staff' | 'member'; children: ReactNode }) {
  const { ready, session, membership, isStaff } = useApp();
  const loc = useLocation();
  if (!ready) return <FullLoader />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />;
  if (need === 'staff' && !isStaff) return <Navigate to={membership ? '/dia' : '/comecar'} replace />;
  return <>{children}</>;
}

function Root({ publicPage }: { publicPage: 'landing' | 'auth' }) {
  const { ready, session, membership, isStaff } = useApp();
  if (!ready) return <FullLoader />;
  if (!session) return publicPage === 'landing' ? <Landing /> : <Auth />;
  let invite = '';
  try { invite = sessionStorage.getItem('tidyo.invite') || ''; } catch { /* ignore */ }
  if (invite && !membership) return <Navigate to={`/convite?t=${encodeURIComponent(invite)}`} replace />;
  if (!membership) return <Navigate to="/comecar" replace />;
  return <Navigate to={isStaff ? '/app' : '/dia'} replace />;
}

function Routed() {
  const { ready } = useApp();
  if (!ready) return <FullLoader />;
  return (
    <Routes>
      <Route path="/" element={<Root publicPage="landing" />} />
      <Route path="/entrar" element={<Root publicPage="auth" />} />
      <Route path="/nova-senha" element={<NewPassword />} />
      <Route path="/comecar" element={<Onboarding />} />
      <Route path="/convite" element={<AcceptInvite />} />
      <Route path="/dia" element={<Gate need="member"><MyDay /></Gate>} />
      <Route path="/app" element={<Gate need="staff"><Home /></Gate>} />
      <Route path="/app/agenda" element={<Gate need="staff"><Schedule /></Gate>} />
      <Route path="/app/clientes" element={<Gate need="staff"><Clients /></Gate>} />
      <Route path="/app/cobrancas" element={<Gate need="staff"><Billing /></Gate>} />
      <Route path="/app/mais" element={<Gate need="staff"><More /></Gate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routed />
      </SessionProvider>
    </BrowserRouter>
  );
}
