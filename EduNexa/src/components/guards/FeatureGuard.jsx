import React from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import LockedFeaturePage from '../common/LockedFeaturePage';

export default function FeatureGuard({ featureCode, featureName, children }) {
  const { hasFeature, loading } = useSubscription();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
      </div>
    );
  }

  // Super Admin platform bypass
  if (user?.role === 'SUPER_ADMIN') {
    return children;
  }

  if (!hasFeature(featureCode)) {
    return <LockedFeaturePage featureCode={featureCode} featureName={featureName} />;
  }

  return children;
}
