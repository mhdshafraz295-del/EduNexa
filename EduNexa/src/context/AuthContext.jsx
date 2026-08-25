import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('edunexa_token') || null);
  const [user, setUser] = useState(null);
  
  // Initialize institute from cached storage if available to prevent flash during hydration
  const [institute, setInstitute] = useState(() => {
    try {
      const cached = localStorage.getItem('edunexa_institute');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [inactiveInstituteMessage, setInactiveInstituteMessage] = useState(null);

  // Hydrate & verify authentication session
  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('edunexa_token');
      if (!storedToken) {
        if (active) {
          setUser(null);
          setInstitute(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await apiRequest('/auth/me');
        if (active) {
          if (response.success && response.user) {
            setUser(response.user);
            const inst = response.institute || response.user.institute || null;
            setInstitute(inst);
            if (inst) {
              localStorage.setItem('edunexa_institute', JSON.stringify(inst));
            } else {
              localStorage.removeItem('edunexa_institute');
            }
            setInactiveInstituteMessage(null);
          } else {
            logout();
          }
        }
      } catch (error) {
        if (active) {
          if (error.isInstituteInactive) {
            setInactiveInstituteMessage(error.message);
          } else {
            logout();
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      active = false;
    };
  }, [token]);

  const login = async (email, password) => {
    try {
      setInactiveInstituteMessage(null);
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.success && response.token) {
        const inst = response.institute || response.user?.institute || null;
        localStorage.setItem('edunexa_token', response.token);
        if (inst) {
          localStorage.setItem('edunexa_institute', JSON.stringify(inst));
        } else {
          localStorage.removeItem('edunexa_institute');
        }

        setToken(response.token);
        setUser(response.user);
        setInstitute(inst);
        return response;
      }
      throw new Error(response.message || 'Login failed');
    } catch (error) {
      if (error.isInstituteInactive) {
        setInactiveInstituteMessage(error.message);
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('edunexa_token');
    localStorage.removeItem('edunexa_institute');
    setToken(null);
    setUser(null);
    setInstitute(null);
    setInactiveInstituteMessage(null);
  };

  const updateInstituteContext = (newInstData) => {
    setInstitute((prev) => {
      const updated = { ...(prev || {}), ...(newInstData || {}) };
      try {
        localStorage.setItem('edunexa_institute', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        institute,
        token,
        loading,
        inactiveInstituteMessage,
        setInactiveInstituteMessage,
        login,
        logout,
        updateInstituteContext,
        isAuthenticated: !!user,
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
        isInstituteAdmin: user?.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
