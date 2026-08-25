import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import EduNexaLogo from '../../components/common/EduNexaLogo';
import GlassCard from '../../components/common/GlassCard';
import {
  Building,
  Mail,
  Lock,
  User,
  Phone,
  Gift,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function RegisterInstitutePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [referrerCode, setReferrerCode] = useState('');
  const [hasUrlRefCode, setHasUrlRefCode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Capture referral code from URL query (?ref=CODE)
  useEffect(() => {
    const urlRef = searchParams.get('ref') || new URLSearchParams(window.location.search).get('ref');
    if (urlRef && urlRef.trim()) {
      const clean = urlRef.trim().toUpperCase();
      setReferrerCode(clean);
      setHasUrlRefCode(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Institute name is required.');
      return;
    }
    if (!adminEmail.trim()) {
      setError('Administrator email is required.');
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        name: name.trim(),
        email: email.trim() || adminEmail.trim(),
        phone: phone.trim() || undefined,
        adminName: adminName.trim() || adminEmail.split('@')[0],
        adminEmail: adminEmail.trim(),
        adminPassword,
        referrerCode: referrerCode.trim().toUpperCase() || undefined,
      };

      const res = await apiRequest('/auth/register-institute', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.token) {
        // Automatically login with the returned token / credentials
        await login(adminEmail.trim(), adminPassword);
        navigate('/admin', { replace: true });
      } else {
        setError(res.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during registration. Please verify details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50/60">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="flex justify-center mb-3">
          <EduNexaLogo size="lg" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
          Register Your Institute
        </h2>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          Create your campus workspace on the EduNexa multi-institute platform
        </p>

        {/* Applied Referral Banner */}
        {hasUrlRefCode && referrerCode && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-slate-900 text-xs font-bold shadow-2xs">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Referral Code Applied: <strong className="font-mono text-amber-800">{referrerCode}</strong></span>
          </div>
        )}
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <GlassCard padding="py-8 px-6 sm:px-10" className="shadow-glass border-slate-200/80">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Registration Issue</p>
                <p className="text-xs leading-relaxed mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Institute Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Institute / Campus Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Springfield International Academy"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white transition-colors"
                  required
                />
              </div>
            </div>

            {/* Admin Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Admin Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Dr. John Davis"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Admin Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Admin Email *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@springfield.edu"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Referral Code (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Referral Code (Optional)
                </label>
                {hasUrlRefCode && (
                  <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Auto-filled from referral link
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Gift className="h-4 w-4 text-amber-600" />
                </div>
                <input
                  type="text"
                  value={referrerCode}
                  onChange={(e) => setReferrerCode(e.target.value.toUpperCase())}
                  placeholder="e.g. EDUNEXA-95E419"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white font-mono font-bold transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Institute & Start Free Trial</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already registered your campus?{' '}
              <Link to="/login" className="font-bold text-slate-900 hover:underline">
                Sign in to your portal
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
