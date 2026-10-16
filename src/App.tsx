import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SessionProvider, useApp } from './lib/session';
import { FullLoader } from './components/ui';
import Auth, { NewPassword } from './pages/Auth';
import Onboarding, { AcceptInvite } from './pages/Onboarding';
import Home from './screens/Home';
import Agenda from './screens/Agenda';
import NewJob from './screens/NewJob';
import Clients from './screens/Clients';
import NewClient from './screens/NewClient';
import FinanceScreen from './screens/Finance';
import Invoices from './screens/Invoices';
import Settings from './screens/Settings';
import Account from './screens/Account';
import MyDay from './pages/MyDay';
import Inbox, { Help } from './pages/Inbox';
import Admin from './pages/Admin';
import { MfaPrompt } from './pages/Security';
import Contracts from './pages/Contracts';
import { ChatList, ChatThread } from './pages/Chat';
import RoutesScreen from './screens/Routes';
import Navigation from './screens/Navigation';
import { Expenses, TeamPay } from './pages/Finance';
import Landing from './pages/Landing';
import JobWork from './pages/JobWork';
import Portal, { PortalInvite } from './pages/Portal';

function Gate({ need, children }: { need: 'staff' | 'member' | 'portal' | 'any' | 'admin'; children: ReactNode }) {
  const { ready, session, membership, isStaff, portal, isAdmin } = useApp();
  const loc = useLocation();
  if (!ready) return <FullLoader />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />;
  if (need === 'any') return <>{children}</>;
  if (need === 'admin') return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
  if (need === 'portal') return portal ? <>{children}</> : <Navigate to="/" replace />;
  if (need === 'member' && !membership) return <Navigate to={portal ? '/portal' : '/comecar'} replace />;
  if (need === 'staff' && !isStaff) return <Navigate to={membership ? '/dia' : '/comecar'} replace />;
  return <>{children}</>;
}

function Root({ publicPage }: { publicPage: 'landing' | 'auth' }) {
  const { ready, session, membership, isStaff, portal, isAdmin } = useApp();
  if (!ready) return <FullLoader />;
  if (!session) return publicPage === 'landing' ? <Landing /> : <Auth />;
  let invite = '';
  try { invite = sessionStorage.getItem('tidyo.invite') || ''; } catch { /* ignore */ }
  if (invite && !membership) return <Navigate to={`/convite?t=${encodeURIComponent(invite)}`} replace />;
  let portalInvite = '';
  try { portalInvite = sessionStorage.getItem('tidyo.portalInvite') || ''; } catch { /* ignore */ }
  if (portalInvite && !membership && !portal) return <Navigate to={`/portal/convite?t=${encodeURIComponent(portalInvite)}`} replace />;
  if (!membership && portal) return <Navigate to="/portal" replace />;
  if (!membership && isAdmin) return <Navigate to="/admin" replace />;
  if (!membership) return <Navigate to="/comecar" replace />;
  return <Navigate to={isStaff ? '/app' : '/dia'} replace />;
}

// Finance tabs share one header, so switching between them should not replay the page animation
const routeKey = (p: string) => (p.startsWith('/app/financas') || p === '/app/cobrancas' ? '/app/financas' : p);

function Routed() {
  const { ready, session, needsMfa, refresh } = useApp();
  const loc = useLocation();
  if (!ready) return <FullLoader />;
  if (session && needsMfa) return <MfaPrompt onDone={refresh} />;
  return (
    <div className="route-view" key={routeKey(loc.pathname)}>
    <Routes location={loc}>
      <Route path="/" element={<Root publicPage="landing" />} />
      <Route path="/entrar" element={<Root publicPage="auth" />} />
      <Route path="/nova-senha" element={<NewPassword />} />
      <Route path="/comecar" element={<Onboarding />} />
      <Route path="/convite" element={<AcceptInvite />} />
      <Route path="/dia" element={<Gate need="member"><MyDay /></Gate>} />
      <Route path="/dia/servico/:id" element={<Gate need="member"><JobWork /></Gate>} />
      <Route path="/portal" element={<Gate need="portal"><Portal /></Gate>} />
      <Route path="/portal/convite" element={<PortalInvite />} />
      <Route path="/app" element={<Gate need="staff"><Home /></Gate>} />
      <Route path="/app/agenda" element={<Gate need="staff"><Agenda /></Gate>} />
      <Route path="/app/agenda/novo" element={<Gate need="staff"><NewJob /></Gate>} />
      <Route path="/app/clientes" element={<Gate need="staff"><Clients /></Gate>} />
      <Route path="/app/clientes/novo" element={<Gate need="staff"><NewClient /></Gate>} />
      <Route path="/app/cobrancas" element={<Gate need="staff"><Invoices /></Gate>} />
      <Route path="/app/financas" element={<Gate need="staff"><FinanceScreen /></Gate>} />
      <Route path="/app/financas/despesas" element={<Gate need="staff"><Expenses /></Gate>} />
      <Route path="/app/financas/equipe" element={<Gate need="staff"><TeamPay /></Gate>} />
      <Route path="/app/contratos" element={<Gate need="staff"><Contracts /></Gate>} />
      <Route path="/mensagens" element={<Gate need="any"><ChatList /></Gate>} />
      <Route path="/mensagens/:id" element={<Gate need="any"><ChatThread /></Gate>} />
      <Route path="/app/rotas" element={<Gate need="staff"><RoutesScreen /></Gate>} />
      <Route path="/app/rotas/navegacao" element={<Gate need="staff"><Navigation /></Gate>} />
      <Route path="/dia/navegacao" element={<Gate need="member"><Navigation /></Gate>} />
      <Route path="/avisos" element={<Gate need="any"><Inbox /></Gate>} />
      <Route path="/ajuda" element={<Gate need="any"><Help /></Gate>} />
      <Route path="/admin" element={<Gate need="admin"><Admin /></Gate>} />
      <Route path="/app/mais" element={<Gate need="staff"><Settings /></Gate>} />
      <Route path="/app/mais/:section" element={<Gate need="staff"><Settings /></Gate>} />
      <Route path="/app/conta" element={<Gate need="staff"><Account /></Gate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </div>
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
