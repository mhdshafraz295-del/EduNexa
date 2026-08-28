import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import EduNexaLogo from '../../components/common/EduNexaLogo';
import GlassCard from '../../components/common/GlassCard';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const quickLogins = [
    { role: 'Super Admin', email: 'superadmin@edunexa.com', pass: 'SuperAdmin123!', color: 'bg-[#FFD978]/30 text-slate-900 border-[#FFD978]/60' },
    { role: 'Demo Admin', email: 'admin@edunexa.com', pass: 'Admin123!', color: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
    { role: 'Teacher', email: 'teacher@edunexa.com', pass: 'Teacher123!', color: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
    { role: 'Student', email: 'student@edunexa.com', pass: 'Student123!', color: 'bg-blue-50 text-blue-900 border-blue-200' },
    { role: 'Parent', email: 'parent@edunexa.com', pass: 'Parent123!', color: 'bg-purple-50 text-purple-900 border-purple-200' },
  ];

  const handleQuickLogin = (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await login(email, password);

      // Redirect based on authenticated user role
      if (response.user.role === 'SUPER_ADMIN') {
        navigate('/super-admin', { replace: true });
      } else if (response.user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else if (response.user.role === 'TEACHER') {
        navigate('/teacher', { replace: true });
      } else if (response.user.role === 'STUDENT') {
        navigate('/student', { replace: true });
      } else if (response.user.role === 'PARENT') {
        navigate('/parent', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Official EduNexa Logo centrally placed */}
        <div className="flex justify-center mb-4">
          <EduNexaLogo size="lg" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
          EduNexa Platform
        </h2>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          Sign in to your platform or institute workspace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <GlassCard padding="py-8 px-6 sm:px-10" className="shadow-glass border-slate-200/80">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Access Blocked</p>
                <p className="text-xs leading-relaxed mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@institute.edu"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              New campus?{' '}
              <a href="/register" className="font-bold text-slate-900 hover:underline">
                Register your institute
              </a>
            </p>
          </div>

          {/* Quick Demo Access Shortcuts (Hidden in Production when VITE_ENABLE_DEMO_LOGIN=false) */}
          {(import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true' || (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false')) && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
                One-Click Demo Roles
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {quickLogins.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleQuickLogin(acc)}
                    className={`text-xs font-bold py-2 px-2.5 rounded-xl border text-center transition-transform active:scale-95 shadow-2xs ${acc.color}`}
                  >
                    {acc.role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
