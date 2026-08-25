import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import EduNexaLogo from '../common/EduNexaLogo';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronRight,
  Sparkles,
  Megaphone,
  Gift,
  Layers,
} from 'lucide-react';

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll and listen for Escape key when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setMobileMenuOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/super-admin', icon: LayoutDashboard, end: true },
    { label: 'Institutes Directory', path: '/super-admin/institutes', icon: Building2 },
    { label: 'Platform CMS', path: '/super-admin/platform-cms', icon: Layers },
    { label: 'Platform Announcements', path: '/super-admin/announcements', icon: Megaphone },
    { label: 'Referral Campaigns', path: '/super-admin/referral-campaigns', icon: Gift },
    { label: 'Subscription Plans', path: '/super-admin/plans', icon: CreditCard },
    { label: 'Subscriptions & Approvals', path: '/super-admin/subscriptions', icon: Shield },
    { label: 'Payment Settings', path: '/super-admin/payment-settings', icon: Building2 },
    { label: 'Platform Users', path: '/super-admin/users', icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <EduNexaLogo size="sm" />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-all"
          aria-label="Toggle platform menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 w-72 bg-white/95 md:bg-white/80 md:backdrop-blur-md border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-300 shadow-soft md:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Platform Header & Official Logo */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <EduNexaLogo size="sm" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-900 bg-[#FFD978] px-2.5 py-1 rounded-full shadow-2xs border border-[#E6BC50]">
                <Shield className="w-3 h-3" />
                Super Admin
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Close menu drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
              Platform Governance
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs md:text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-[#FFD978]/35 text-slate-900 font-bold border-l-4 border-[#E6BC50] shadow-xs'
                        : 'text-slate-600 hover:bg-[#FFD978]/15 hover:text-slate-900'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center gap-3 px-2 py-1.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-[#FFD978] flex items-center justify-center font-black text-xs shadow-xs shrink-0">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || user?.username}</p>
              <p className="text-[10px] text-slate-500 truncate font-medium">Platform Super Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">EduNexa Platform Administration</h1>
            <p className="text-xs text-slate-400 font-medium">Multi-Institute SaaS Platform Infrastructure</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SaaS Engine Active
            </div>
          </div>
        </header>

        {/* Routed Page Content */}
        <div className="p-4 md:p-8 flex-1 w-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
