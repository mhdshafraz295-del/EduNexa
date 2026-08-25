import React from 'react';
import PlatformAboutViewer from '../../components/cms/PlatformAboutViewer';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AboutEduNexaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <PageHeader
        title="About EduNexa Platform"
        description="Official information, mission, core capabilities, and contact details for the EduNexa multi-tenant management ecosystem."
        badge="Platform Information"
        action={
          !user ? (
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
          ) : null
        }
      />

      {/* Read-Only Published CMS Viewer */}
      <PlatformAboutViewer isSuperAdmin={user?.role === 'SUPER_ADMIN'} />
    </div>
  );
}
