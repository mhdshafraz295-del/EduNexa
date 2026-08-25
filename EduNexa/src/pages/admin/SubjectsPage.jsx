import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { BookOpen, Plus, AlertCircle, Check } from 'lucide-react';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subRes, clsRes] = await Promise.all([
        apiRequest('/academic/subjects'),
        apiRequest('/academic/classes'),
      ]);
      if (subRes.success) setSubjects(subRes.data);
      if (clsRes.success) setClasses(clsRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    try {
      setError('');
      setSuccess('');
      const res = await apiRequest('/academic/subjects', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          classId: classId ? parseInt(classId, 10) : null,
        }),
      });

      if (res.success) {
        setSuccess(`Subject '${res.data.name}' created!`);
        setName('');
        setCode('');
        setClassId('');
        fetchData();
      }
    } catch (err) {
      setError(err.message || 'Failed to create subject.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Subjects & Curriculum</h2>
        <p className="text-sm text-slate-500">Configure courses, subject codes, and class associations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Subject Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs h-fit">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <span>Add Subject</span>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pure Mathematics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. MATH-101"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to Class</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
              >
                <option value="">All Classes / General</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#FFD978]" />
              <span>Create Subject</span>
            </button>
          </form>
        </div>

        {/* Subjects List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Institute Subjects ({subjects.length})</h3>
            <p className="text-xs text-slate-400">Scoped exclusively to your institute</p>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
            </div>
          ) : subjects.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              No subjects registered yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {subjects.map((sub) => (
                <div key={sub.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-base">{sub.name}</h4>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {sub.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Class: {sub.class ? `${sub.class.name} ${sub.class.section || ''}` : 'General / All'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
