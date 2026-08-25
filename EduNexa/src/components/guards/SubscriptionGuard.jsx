import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import SubscriptionExpiredScreen from '../common/SubscriptionExpiredScreen';

export default function SubscriptionGuard({ children }) {
  const { isSubscriptionActive, loading } = useSubscription();
  const { user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
      </div>
    );
  }

  // Super Admin platform bypass
  if (user?.role === 'SUPER_ADMIN') {
    return children;
  }

  // Allow essential subscription renewal path for Institute Admin to prevent redirect loops
  if (location.pathname.startsWith('/admin/subscription')) {
    return children;
  }

  if (!isSubscriptionActive()) {
    return <SubscriptionExpiredScreen />;
  }

  return children;
}
