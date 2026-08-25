import React, { useState } from 'react';
import { apiRequest } from '../../../services/api';
import { Calendar, Plus, CheckCircle2, AlertCircle, Clock, Star, Edit2, Shield } from 'lucide-react';

export default function AcademicYearsTab({ years, onRefresh }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    status: 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openCreateModal = () => {
    setEditingYear(null);
    setFormData({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isCurrent: false,
      status: 'ACTIVE',
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (yr) => {
    setEditingYear(yr);
    setFormData({
      name: yr.name,
      startDate: yr.startDate ? new Date(yr.startDate).toISOString().split('T')[0] : '',
      endDate: yr.endDate ? new Date(yr.endDate).toISOString().split('T')[0] : '',
      isCurrent: yr.isCurrent,
      status: yr.status,
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const url = editingYear ? `/academic/years/${editingYear.id}` : '/academic/years';
      const method = editingYear ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setIsModalOpen(false);
        onRefresh?.();
      }
    } catch (err) {
      setError(err.message || 'Failed to save Academic Year.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetCurrent = async (yearId) => {
    try {
      const res = await apiRequest(`/academic/years/${yearId}/current`, {
        method: 'PATCH',
      });
      if (res.success) onRefresh?.();
    } catch (err) {
      alert(err.message || 'Failed to set current academic year.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Academic Years</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure calendar periods, mark active sessions, and organize student cohorts.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Academic Year</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {years.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No Academic Years Created</p>
            <p className="text-xs text-slate-400 mt-1">
              Add your first academic year (e.g. 2026) to begin organizing classes and timetables.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Academic Year</span>
            </button>
          </div>
        ) : (
          years.map((yr) => (
            <div
              key={yr.id}
              className={`p-6 rounded-3xl bg-white border transition-all ${
                yr.isCurrent ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-sm' : 'border-slate-200/80 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xl font-black text-slate-900">{yr.name}</h4>
                    {yr.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFD978] text-slate-950 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-slate-950" /> Current Year
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      yr.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {yr.status}
                  </span>
                </div>

                <button
                  onClick={() => openEditModal(yr)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Start Date:</span>
                  <span className="font-semibold">{new Date(yr.startDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">End Date:</span>
                  <span className="font-semibold">{new Date(yr.endDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 font-medium">
                  {yr._count?.classes || 0} Classes • {yr._count?.studentEnrollments || 0} Students
                </div>

                {!yr.isCurrent && (
                  <button
                    onClick={() => handleSetCurrent(yr.id)}
                    className="text-xs font-bold text-slate-700 hover:text-slate-950 underline underline-offset-2"
                  >
                    Set as Current
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {editingYear ? 'Edit Academic Year' : 'New Academic Year'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Academic Year Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026, 2026/2027"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isCurrent}
                  onChange={(e) => setFormData({ ...formData, isCurrent: e.target.checked })}
                  className="w-4 h-4 rounded text-slate-900 focus:ring-0 accent-slate-900"
                />
                <span className="text-xs font-bold text-slate-800">Mark as Current Academic Year</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  {submitting ? 'Saving...' : editingYear ? 'Update Year' : 'Create Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
