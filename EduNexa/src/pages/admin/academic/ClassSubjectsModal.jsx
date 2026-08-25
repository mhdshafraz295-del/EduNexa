import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import { BookOpen, Check, AlertCircle, X, Plus } from 'lucide-react';

export default function ClassSubjectsModal({ isOpen, onClose, targetClass, allSubjects, onSaved }) {
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!targetClass || !isOpen) return;

    const fetchClassSubjects = async () => {
      try {
        setLoading(true);
        const res = await apiRequest(`/academic/classes/${targetClass.id}/subjects`);
        if (res.success) {
          const ids = res.data.map((cs) => cs.subjectId);
          setSelectedSubjectIds(ids);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch class subjects.');
      } finally {
        setLoading(false);
      }
    };

    fetchClassSubjects();
  }, [targetClass, isOpen]);

  const toggleSubject = (id) => {
    if (selectedSubjectIds.includes(id)) {
      setSelectedSubjectIds(selectedSubjectIds.filter((sid) => sid !== id));
    } else {
      setSelectedSubjectIds([...selectedSubjectIds, id]);
    }
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      setError('');
      const res = await apiRequest(`/academic/classes/${targetClass.id}/subjects`, {
        method: 'POST',
        body: JSON.stringify({ subjectIds: selectedSubjectIds }),
      });

      if (res.success) {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to assign subjects.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !targetClass) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Curriculum Setup</span>
            <h3 className="text-lg font-black text-slate-900 mt-0.5">
              Assign Subjects: {targetClass.name} {targetClass.section ? `(${targetClass.section})` : ''}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Select which subjects are studied by this class. Changes will not delete historical student results or timetable entries.
        </p>

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-3 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {allSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No subjects found. Create subjects first in the Subjects tab.</p>
            ) : (
              allSubjects.map((sub) => {
                const isSelected = selectedSubjectIds.includes(sub.id);
                return (
                  <button
                    type="button"
                    key={sub.id}
                    onClick={() => toggleSubject(sub.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {sub.code}
                      </span>
                      <span className="text-xs font-bold">{sub.name}</span>
                    </div>

                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      isSelected ? 'bg-[#FFD978] border-[#FFD978] text-slate-950' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500">
            {selectedSubjectIds.length} Selected
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
            >
              {submitting ? 'Saving...' : 'Save Subjects'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
