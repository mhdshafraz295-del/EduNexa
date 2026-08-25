import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import EduNexaLogo from './EduNexaLogo';
import { AlertTriangle, RefreshCw, LogOut, ArrowRight, ShieldX, Clock } from 'lucide-react';

export default function SubscriptionExpiredScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { entitlement } = useSubscription();

  const isAdmin = user?.role === 'ADMIN';
  const isPending = entitlement?.status === 'PAYMENT_SUBMITTED';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-6">
        <EduNexaLogo size="lg" />
      </div>

      <div className="bg-white max-w-lg w-full rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-xs ${
          isPending ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {isPending ? <Clock className="w-8 h-8 animate-spin" /> : <ShieldX className="w-8 h-8" />}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">
            {isPending ? 'Renewal Payment Under Review' : 'Subscription Inactive'}
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {isPending
              ? 'Your renewal payment receipt has been submitted and is currently being verified by Super Admin.'
              : isAdmin
              ? 'Your EduNexa institute subscription has expired. Please renew your plan to restore full platform access.'
              : "Your institute's EduNexa subscription is currently inactive. Please contact your institute administrator."}
          </p>
        </div>

        {entitlement?.planName && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
            <p className="text-slate-500">
              Previous Plan: <strong>{entitlement.planName}</strong>
            </p>
            {entitlement.endDate && (
              <p className="text-slate-400">
                Expired on: <strong>{new Date(entitlement.endDate).toLocaleDateString()}</strong>
              </p>
            )}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin/subscription')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4 text-[#FFD978]" />
              <span>{isPending ? 'View Payment Status' : 'Renew Subscription'}</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
