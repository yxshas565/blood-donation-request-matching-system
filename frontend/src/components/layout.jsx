import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Activity, Bell, Boxes, BriefcaseMedical, Building2, ChevronRight, CircleUserRound, ClipboardList, HeartPulse, LayoutDashboard, LogOut, Menu, Search, Settings2, Users, X } from 'lucide-react';
import { Logo } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const navByRole = {
  Donor: [
    { label: 'Overview', to: '/app/dashboard', icon: LayoutDashboard },
    { label: 'My profile', to: '/app/profile', icon: CircleUserRound },
    { label: 'Donation history', to: '/app/donations', icon: HeartPulse },
    { label: 'Notifications', to: '/app/notifications', icon: Bell },
  ],
  Hospital: [
    { label: 'Overview', to: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Blood requests', to: '/app/requests', icon: ClipboardList },
    { label: 'Donor matching', to: '/app/matching', icon: Search },
    { label: 'Inventory', to: '/app/inventory', icon: Boxes },
    { label: 'Donations', to: '/app/donations', icon: HeartPulse },
    { label: 'Hospital profile', to: '/app/profile', icon: Building2 },
    { label: 'Notifications', to: '/app/notifications', icon: Bell },
  ],
  Organization: [
    { label: 'Overview', to: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Blood requests', to: '/app/requests', icon: ClipboardList },
    { label: 'Donor matching', to: '/app/matching', icon: Search },
    { label: 'Organization profile', to: '/app/profile', icon: Building2 },
    { label: 'Notifications', to: '/app/notifications', icon: Bell },
  ],
  Admin: [
    { label: 'Overview', to: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Users', to: '/app/users', icon: Users },
    { label: 'Donors', to: '/app/donors', icon: HeartPulse },
    { label: 'Requests', to: '/app/requests', icon: ClipboardList },
    { label: 'Donations', to: '/app/donations', icon: Activity },
    { label: 'Inventory', to: '/app/inventory', icon: Boxes },
    { label: 'Hospitals & groups', to: '/app/organizations', icon: BriefcaseMedical },
    { label: 'Integration status', to: '/app/integration', icon: Settings2 },
    { label: 'SQL Playground', to: '/app/sql-playground', icon: Settings2 },
    { label: 'Notifications', to: '/app/notifications', icon: Bell },
  ],
};

const titleFor = {
  '/app/dashboard': 'Overview', '/app/profile': 'Profile', '/app/requests': 'Blood requests',
  '/app/matching': 'Donor matching', '/app/inventory': 'Blood inventory', '/app/donations': 'Donations',
  '/app/notifications': 'Notifications', '/app/users': 'User directory', '/app/donors': 'Donor directory', '/app/integration': 'Integration status',
  '/app/organizations': 'Hospitals & organizations',
  '/app/sql-playground': 'SQL Playground',
};

export function SkipLink({ target = 'workspace-main' }) { return <a className="skip-link sr-only focus:not-sr-only" href={`#${target}`}>Skip to main content</a>; }

export function ProtectedRoute({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="boot-screen"><span className="boot-mark"><HeartPulse size={23} /></span><span>Connecting your console…</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.Role)) return <Navigate to="/app/dashboard" replace />;
  return children || <Outlet />;
}

export function PublicHeader() {
  return <header className="site-nav"><Link to="/" aria-label="Bloodline home"><Logo /></Link><nav aria-label="Main navigation" className="public-links"><Link to="/#how-it-works">How it works</Link><Link to="/#capabilities">Capabilities</Link></nav><div className="public-actions"><Link className="nav-login" to="/login">Log in <ChevronRight size={15} /></Link><Link className="key-button key-primary" to="/register">Join the network</Link></div></header>;
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const nav = navByRole[user?.Role] || [];
  const title = titleFor[location.pathname] || 'Workspace';
  const initials = (user?.Name || 'User').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <div className="app-frame"><SkipLink />
    <aside className={`app-sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Link to="/app/dashboard"><Logo compact /></Link><button className="icon-key sidebar-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="sidebar-section-label">WORKSPACE <span>01—0{nav.length}</span></div>
      <nav className="dashboard-nav" aria-label="Workspace navigation">{nav.map(({ label, to, icon: Icon }) => <NavLink key={to} end={to === '/app/dashboard'} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `dashboard-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><span className="help-icon"><Settings2 size={17} /></span><div><strong>Need a hand?</strong><small>Review platform guidance</small></div></div><Link to="/" className="sidebar-home">Platform home <ChevronRight size={15} /></Link></div>
    </aside>
    {open && <button className="sidebar-scrim" aria-label="Close navigation overlay" onClick={() => setOpen(false)} />}
    <main className="app-main" id="workspace-main"><header className="app-topbar"><button className="icon-key mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={19} /></button><div className="crumb mono-label"><span>Bloodline</span><ChevronRight size={13} /><strong>{title}</strong></div><div className="topbar-right"><span className="role-pill"><i />{user?.Role}</span><Link className="topbar-profile" to="/app/profile"><span className="avatar">{initials}</span><span className="profile-mini"><strong>{user?.Name}</strong><small>{user?.Email}</small></span></Link><button className="logout-key" onClick={logout} aria-label="Sign out"><LogOut size={17} /><span>Sign out</span></button></div></header><div className="workspace-wrap"><div className="workspace-bay"><div className="bay-screw screw-a" /><div className="bay-screw screw-b" /><div className="bay-screw screw-c" /><div className="bay-screw screw-d" /><div className="bay-content"><Outlet /></div></div><footer className="workspace-footer"><span>Bloodline / Secure workspace</span><span>Clinical screening remains essential.</span></footer></div></main>
  </div>;
}
