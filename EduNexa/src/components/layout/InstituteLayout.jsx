import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { apiRequest } from '../../services/api';
import EduNexaLogo from '../common/EduNexaLogo';
import InstituteBrandingHeader from '../common/InstituteBrandingHeader';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Receipt,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Building,
  Calendar,
  UserCheck,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Award,
  Image as GalleryIcon,
  MessageSquare,
  Gift,
  Info,
  BookOpen,
  Vote,
} from 'lucide-react';

export default function InstituteLayout() {
  const { user, institute, logout } = useAuth();
  const { hasFeature, isExpiringSoon, daysRemaining } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Fetch unread count if feature enabled
  useEffect(() => {
    if (!hasFeature('INTERNAL_MESSAGES')) return;

    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await apiRequest('/messages/unread-count');
        if (res.success && isMounted) {
          setUnreadMessages(res.unreadCount || 0);
        }
      } catch {
        // non-blocking
      }
    };

    fetchUnread();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchUnread();
      }
    }, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasFeature, location.pathname]);

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

  const allNavItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Subscription & Billing', path: '/admin/subscription', icon: CreditCard },
    { label: 'Referral Rewards', path: '/admin/referrals', icon: Gift },
    { label: 'Academics Hub', path: '/admin/academic', icon: GraduationCap },
    { label: 'Timetable & Classes', path: '/admin/timetable', icon: Calendar, feature: 'TIMETABLE' },
    { label: 'Attendance', path: '/admin/attendance', icon: UserCheck, feature: 'ATTENDANCE' },
    { label: 'Exams / Live Exams', path: '/admin/exams', icon: Award, feature: 'ONLINE_EXAMS' },
    { label: 'Study Notes & Tutes', path: '/admin/study-materials', icon: BookOpen, feature: 'STUDY_MATERIALS' },
    { label: 'Polls & Voting', path: '/admin/polls', icon: Vote, feature: 'POLLS' },
    { label: 'Gallery Management', path: '/admin/gallery', icon: GalleryIcon, feature: 'GALLERY' },
    { label: 'Messages', path: '/admin/messages', icon: MessageSquare, feature: 'INTERNAL_MESSAGES', badge: unreadMessages },
    { label: 'Students Directory', path: '/admin/students', icon: Users, feature: 'STUDENT_MANAGEMENT' },
    { label: 'Teachers & Faculty', path: '/admin/teachers', icon: Users, feature: 'TEACHER_MANAGEMENT' },
    { label: 'Parent Management', path: '/admin/parents', icon: Users, feature: 'PARENT_PORTAL' },
    { label: 'Invoices & Fees', path: '/admin/invoices', icon: Receipt, feature: 'INVOICES' },
    { label: 'Institute Profile & Settings', path: '/admin/settings', icon: Settings },
    { label: 'About EduNexa', path: '/admin/about', icon: Info },
  ];

  // Dynamic menu filtering based on role and active subscription snapshot permissions
  const navItems = allNavItems.filter((item) => {
    if (!item.feature) return true;
    return hasFeature(item.feature);
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <EduNexaLogo size="sm" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {institute?.code || 'EDU'}
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 w-72 bg-white/95 md:bg-white/80 md:backdrop-blur-md border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-300 shadow-soft md:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Platform Brand Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <EduNexaLogo size="sm" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                SaaS Admin
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Close navigation drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Institute Tenant Card */}
          <InstituteBrandingHeader institute={institute} variant="card" />

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
              Management Portal
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    {Boolean(item.badge && item.badge > 0) && (
                      <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-[#FFD978] text-slate-900 rounded-full border border-[#E6BC50] shadow-2xs">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center gap-3 px-2 py-1.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-black text-xs shadow-xs shrink-0">
              {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name || user?.username}</p>
              <p className="text-[10px] text-slate-500 truncate font-medium">Administrator</p>
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
        {/* Expiry Warning Banner (7 days or less remaining) */}
        {isExpiringSoon() && user?.role === 'ADMIN' && (
          <div className="bg-amber-400 text-slate-950 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
              <span>
                Subscription expires in <strong>{daysRemaining()} days</strong>. Renew now to avoid feature locking.
              </span>
            </div>
            <button
              onClick={() => navigate('/admin/subscription')}
              className="px-3 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-bold text-[11px] flex items-center gap-1 shrink-0 self-start sm:self-auto"
            >
              <span>Renew Subscription</span>
              <ArrowRight className="w-3 h-3 text-[#FFD978]" />
            </button>
          </div>
        )}

        {/* Sticky Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">{institute?.name}</h1>
              <p className="text-xs text-slate-400 font-medium">EduNexa Multi-Institute Tenant Environment</p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              {institute?.code}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Active Workspace</span>
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
