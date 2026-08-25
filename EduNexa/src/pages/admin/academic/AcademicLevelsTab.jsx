import React, { useState } from 'react';
import { apiRequest } from '../../../services/api';
import { Layers, Plus, Edit2, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AcademicLevelsTab({ levels, onRefresh }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    displayOrder: 0,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openCreateModal = () => {
    setEditingLevel(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      displayOrder: levels.length + 1,
      isActive: true,
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (lvl) => {
    setEditingLevel(lvl);
    setFormData({
      name: lvl.name,
      code: lvl.code,
      description: lvl.description || '',
      displayOrder: lvl.displayOrder || 0,
      isActive: lvl.isActive,
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const url = editingLevel ? `/academic/levels/${editingLevel.id}` : '/academic/levels';
      const method = editingLevel ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setIsModalOpen(false);
        onRefresh?.();
      }
    } catch (err) {
      setError(err.message || 'Failed to save Academic Level.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Academic Level?')) return;
    try {
      const res = await apiRequest(`/academic/levels/${id}`, { method: 'DELETE' });
      if (res.success) onRefresh?.();
    } catch (err) {
      alert(err.message || 'Failed to delete Level.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Academic Levels & Grades</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure dynamic levels (Grade 7–11, A/L, Diploma, English Course) without rigid hardcoding.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Level / Grade</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {levels.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-3xl border border-slate-200">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No Academic Levels Configured</p>
            <p className="text-xs text-slate-400 mt-1">
              Add your institute levels (e.g. Grade 10, A/L, ICT Diploma) to structure classes.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Level</span>
            </button>
          </div>
        ) : (
          levels.map((lvl) => (
            <div
              key={lvl.id}
              className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-black text-slate-900">{lvl.name}</h4>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                      {lvl.code}
                    </span>
                  </div>
                  {lvl.description && <p className="text-xs text-slate-500 mt-1">{lvl.description}</p>}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(lvl)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(lvl.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Display Order: #{lvl.displayOrder}</span>
                <span className="font-semibold text-slate-800">{lvl._count?.classes || 0} Classes</span>
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
                {editingLevel ? 'Edit Academic Level' : 'New Academic Level'}
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
                  Level / Grade Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grade 10, A/L Arts, Spoken English"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. G10, AL, ENG"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Order</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of syllabus or target audience"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900 resize-none"
                />
              </div>

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
                  {submitting ? 'Saving...' : editingLevel ? 'Update Level' : 'Create Level'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
