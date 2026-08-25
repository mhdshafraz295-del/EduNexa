import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { School, Plus, Trash2, Users, BookOpen, AlertCircle, Check } from 'lucide-react';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/academic/classes');
      if (res.success) {
        setClasses(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setError('');
      setSuccess('');
      const res = await apiRequest('/academic/classes', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), section: section.trim() || null }),
      });

      if (res.success) {
        setSuccess(`Class ${res.data.name} ${res.data.section || ''} created successfully!`);
        setName('');
        setSection('');
        fetchClasses();
      }
    } catch (err) {
      setError(err.message || 'Failed to create class.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this class?')) return;
    try {
      await apiRequest(`/academic/classes/${id}`, { method: 'DELETE' });
      fetchClasses();
    } catch (err) {
      alert(err.message || 'Failed to delete class.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Classes & Sections Management</h2>
        <p className="text-sm text-slate-500">Create and organize grade levels and class divisions for your institute</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Class Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs h-fit">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <School className="w-5 h-5 text-amber-600" />
            <span>Add Class Division</span>
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Grade 10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Section / Division</label>
              <input
                type="text"
                placeholder="e.g. A or Science"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#FFD978]" />
              <span>Create Class</span>
            </button>
          </form>
        </div>

        {/* Classes List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Institute Classes ({classes.length})</h3>
            <p className="text-xs text-slate-400">Scoped exclusively to your institute</p>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
            </div>
          ) : classes.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              No classes created yet. Use the form to add your first class.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {classes.map((cls) => (
                <div key={cls.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {cls.name} {cls.section && <span className="text-amber-800 font-mono text-sm font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Section {cls.section}</span>}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {cls._count?.students || 0} Students
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        {cls._count?.subjects || 0} Subjects
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(cls.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete Class"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
