import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '../services/api';

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptionData = useCallback(async () => {
    if (!user) {
      setEntitlement(null);
      setUsageStats(null);
      setLoading(false);
      return;
    }

    if (user.role === 'SUPER_ADMIN') {
      setEntitlement({
        isValid: true,
        status: 'ACTIVE',
        isSuperAdmin: true,
        planName: 'Platform Super Admin',
        features: {},
        limits: {},
        remainingDays: 9999,
        isExpiringSoon: false,
      });
      setUsageStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [entRes, useRes] = await Promise.all([
        apiRequest('/subscription/entitlement'),
        apiRequest('/subscription/usage'),
      ]);

      if (entRes.success) setEntitlement(entRes.data);
      if (useRes.success) setUsageStats(useRes.data?.usage || null);
    } catch (err) {
      console.error('Error fetching subscription entitlement:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  // Helper: checks whether a feature code exists and is enabled in the current active subscription
  const hasFeature = useCallback(
    (featureCode) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      if (!entitlement || !entitlement.isValid || !featureCode) return false;

      const code = String(featureCode).trim().toUpperCase();
      const features = entitlement.features;

      if (!features) return false;

      // Handle Map/Object structure: { TIMETABLE: true }
      if (typeof features === 'object' && !Array.isArray(features)) {
        return Boolean(features[code] || features[featureCode]);
      }

      // Handle Array structure: ["TIMETABLE"] or [{ code: "TIMETABLE" }]
      if (Array.isArray(features)) {
        return features.some((f) => {
          if (typeof f === 'string') return f.toUpperCase() === code;
          if (f && typeof f === 'object' && f.code) return String(f.code).toUpperCase() === code;
          return false;
        });
      }

      return false;
    },
    [user, entitlement]
  );

  // Helper: gets snapshot limit value for a resource (e.g. students, teachers, storageGb)
  const getLimit = useCallback(
    (limitKey) => {
      if (!entitlement || !entitlement.limits) return null;
      return entitlement.limits[limitKey] !== undefined ? entitlement.limits[limitKey] : null;
    },
    [entitlement]
  );

  // Helper: gets real-time usage for a metric
  const getUsage = useCallback(
    (limitKey) => {
      if (!usageStats || !usageStats[limitKey]) return null;
      return usageStats[limitKey];
    },
    [usageStats]
  );

  const isSubscriptionActive = useCallback(() => {
    if (user?.role === 'SUPER_ADMIN') return true;
    return Boolean(entitlement?.isValid);
  }, [user, entitlement]);

  const isExpiringSoon = useCallback(() => {
    if (user?.role === 'SUPER_ADMIN') return false;
    return Boolean(entitlement?.isExpiringSoon);
  }, [user, entitlement]);

  const daysRemaining = useCallback(() => {
    if (user?.role === 'SUPER_ADMIN') return 9999;
    return entitlement?.remainingDays || 0;
  }, [user, entitlement]);

  const value = {
    entitlement,
    usageStats,
    loading,
    hasFeature,
    getLimit,
    getUsage,
    isSubscriptionActive,
    isExpiringSoon,
    daysRemaining,
    refreshSubscription: fetchSubscriptionData,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
