import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import { Lock, Sparkles, ArrowRight, ShieldAlert, Check } from 'lucide-react';

export default function LockedFeaturePage({ featureName, featureCode }) {
  const navigate = useNavigate();
  const { entitlement } = useSubscription();
  const { user } = useAuth();

  const formattedFeatureName = featureName || (featureCode ? featureCode.replace(/_/g, ' ') : 'This Module');
  const currentPlan = entitlement?.planName || 'Current Plan';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-3xl border border-slate-200/80 shadow-lg p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-8 h-8 text-amber-700" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD978]/30 border border-[#FFD978] text-xs font-bold text-amber-950 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 fill-amber-900" />
            <span>Subscription Upgrade Required</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 capitalize">
            {formattedFeatureName}
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            This module is not included in your active <strong>{currentPlan}</strong> subscription tier.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left space-y-2 text-xs">
          <span className="font-bold uppercase text-[10px] tracking-wider text-slate-400">Upgrade Benefits</span>
          <div className="space-y-1.5 text-slate-700">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Instant access to {formattedFeatureName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Higher student, teacher, and storage capacities</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Multi-branch management & advanced analytics</span>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/admin/subscription')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <span>View Available Plans</span>
              <ArrowRight className="w-4 h-4 text-[#FFD978]" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Please contact your Institute Administrator to upgrade your subscription plan.
          </p>
        )}
      </div>
    </div>
  );
}
