import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import EduNexaLogo from '../common/EduNexaLogo';
import { AlertTriangle, LogOut, PhoneCall } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, inactiveInstituteMessage, logout } = useAuth();
  const location = useLocation();

  // 1. Loading splash screen with official EduNexa logo
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <EduNexaLogo size="xl" />
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-[#FFD978] animate-ping" />
            Initializing EduNexa Multi-Institute Platform...
          </div>
        </div>
      </div>
    );
  }

  // 2. Inactive Institute Block Screen
  if (inactiveInstituteMessage && user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="flex justify-center mb-4">
            <EduNexaLogo size="md" />
          </div>
          <div className="w-16 h-16 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Institute Account Inactive</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {inactiveInstituteMessage || 'Your institute account is currently inactive. Please contact EduNexa support.'}
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-xs text-slate-500 flex items-center justify-center gap-2 border border-slate-200">
            <PhoneCall className="w-4 h-4 text-slate-400" />
            Support Hotline: support@edunexa.com / +94 11 234 5678
          </div>
          <button
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // 3. Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. Role Authorization Check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to user's authorized root
    switch (user.role) {
      case 'SUPER_ADMIN':
        return <Navigate to="/super-admin" replace />;
      case 'ADMIN':
        return <Navigate to="/admin" replace />;
      case 'TEACHER':
        return <Navigate to="/teacher" replace />;
      case 'STUDENT':
        return <Navigate to="/student" replace />;
      case 'PARENT':
        return <Navigate to="/parent" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
}
