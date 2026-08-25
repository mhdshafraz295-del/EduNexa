import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import { useSubscription } from '../../../context/SubscriptionContext';
import {
  Calendar as CalendarIcon,
  Plus,
  Video,
  Clock,
  MapPin,
  Users,
  School,
  Edit2,
  Trash2,
  AlertCircle,
  ExternalLink,
  Lock,
  Sparkles,
} from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function TimetablePage() {
  const { hasFeature } = useSubscription();
  const hasZoomFeature = hasFeature('ZOOM_CLASSES');

  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedViewDay, setSelectedViewDay] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formData, setFormData] = useState({
    academicYearId: '',
    classId: '',
    subjectId: '',
    teacherId: '',
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '09:30',
    classType: 'PHYSICAL',
    room: '',
    meetingUrl: '',
    meetingId: '',
    meetingPassword: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTimetableData = async (
    clsId = selectedClassId,
    tchId = selectedTeacherId,
    yrId = selectedYearId
  ) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (clsId) params.append('classId', clsId);
      if (tchId) params.append('teacherId', tchId);
      if (yrId) params.append('academicYearId', yrId);

      const [ttRes, clsRes, subRes, teachRes, yrRes] = await Promise.all([
        apiRequest(`/timetable?${params.toString()}`),
        apiRequest('/academic/classes'),
        apiRequest('/academic/subjects'),
        apiRequest('/teachers'),
        apiRequest('/academic/years'),
      ]);

      if (ttRes.success && Array.isArray(ttRes.data)) setSessions(ttRes.data);
      if (clsRes.success && Array.isArray(clsRes.data)) setClasses(clsRes.data);
      if (subRes.success && Array.isArray(subRes.data)) setSubjects(subRes.data);
      if (teachRes.success && Array.isArray(teachRes.data)) setTeachers(teachRes.data);
      if (yrRes.success && Array.isArray(yrRes.data)) setYears(yrRes.data);
    } catch (err) {
      console.error('Error fetching timetable data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetableData(selectedClassId, selectedTeacherId, selectedYearId);
  }, [selectedClassId, selectedTeacherId, selectedYearId]);

  const openCreateModal = (day = 'MONDAY') => {
    setEditingSession(null);
    const currentYear = years.find((y) => y.isCurrent) || years[0];
    setFormData({
      academicYearId: selectedYearId || (currentYear ? currentYear.id.toString() : ''),
      classId: selectedClassId || (classes[0] ? classes[0].id.toString() : ''),
      subjectId: subjects[0] ? subjects[0].id.toString() : '',
      teacherId: selectedTeacherId || '',
      dayOfWeek: day,
      startTime: '08:00',
      endTime: '09:30',
      classType: 'PHYSICAL',
      room: '',
      meetingUrl: '',
      meetingId: '',
      meetingPassword: '',
      notes: '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (sess) => {
    setEditingSession(sess);
    setFormData({
      academicYearId: sess.academicYearId ? sess.academicYearId.toString() : '',
      classId: sess.classId ? sess.classId.toString() : '',
      subjectId: sess.subjectId ? sess.subjectId.toString() : '',
      teacherId: sess.teacherId ? sess.teacherId.toString() : '',
      dayOfWeek: sess.dayOfWeek,
      startTime: sess.startTime,
      endTime: sess.endTime,
      classType: sess.classType || 'PHYSICAL',
      room: sess.room || '',
      meetingUrl: sess.meetingUrl || '',
      meetingId: sess.meetingId || '',
      meetingPassword: sess.meetingPassword || '',
      notes: sess.notes || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.classType !== 'PHYSICAL' && formData.meetingUrl && !formData.meetingUrl.startsWith('https://')) {
      setError('Meeting link must start with https://');
      return;
    }

    try {
      setSubmitting(true);
      const url = editingSession ? `/timetable/${editingSession.id}` : '/timetable';
      const method = editingSession ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        meetingUrl: formData.classType === 'PHYSICAL' ? null : formData.meetingUrl || null,
        meetingId: formData.classType === 'PHYSICAL' ? null : formData.meetingId || null,
        meetingPassword: formData.classType === 'PHYSICAL' ? null : formData.meetingPassword || null,
        classId: parseInt(formData.classId, 10),
        subjectId: parseInt(formData.subjectId, 10),
        teacherId: formData.teacherId ? parseInt(formData.teacherId, 10) : null,
        academicYearId: formData.academicYearId ? parseInt(formData.academicYearId, 10) : null,
      };

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setIsModalOpen(false);

        // Immediate UI alignment: If day filter or class filter is active and hiding the new slot, adjust view
        if (selectedViewDay !== 'ALL' && selectedViewDay !== formData.dayOfWeek) {
          setSelectedViewDay(formData.dayOfWeek);
        }

        // Immediate local state update
        if (res.data) {
          if (editingSession) {
            setSessions((prev) => prev.map((s) => (s.id === res.data.id ? res.data : s)));
          } else {
            setSessions((prev) => [...prev, res.data]);
          }
        }

        // Fetch latest data in background
        await fetchTimetableData(selectedClassId, selectedTeacherId, selectedYearId);
      }
    } catch (err) {
      setError(err.message || 'Failed to save timetable session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this timetable session?')) return;
    try {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      const res = await apiRequest(`/timetable/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchTimetableData(selectedClassId, selectedTeacherId, selectedYearId);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete timetable session.');
      fetchTimetableData(selectedClassId, selectedTeacherId, selectedYearId);
    }
  };

  const displayedDays = selectedViewDay === 'ALL' ? DAYS : [selectedViewDay];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FFD978]/30 text-slate-950 border border-[#FFD978]">
              Weekly Master Timetable
            </span>
            {hasZoomFeature && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Video className="w-3 h-3" /> Online Classes Enabled
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">Timetable Schedule</h2>
          <p className="text-xs text-slate-500">
            Build and manage weekly class sessions with automatic teacher & room conflict detection.
          </p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#FFD978] font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Session</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="">All Academic Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isCurrent ? '(Current)' : ''}
              </option>
            ))}
          </select>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.section ? `(${c.section})` : ''}
              </option>
            ))}
          </select>

          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="">All Teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || `${t.firstName || ''} ${t.lastName || ''}`}
              </option>
            ))}
          </select>
        </div>

        {/* Day Filter Tabs */}
        <div className="w-full md:w-auto flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
          <button
            onClick={() => setSelectedViewDay('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedViewDay === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Days
          </button>
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedViewDay(d)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedViewDay === d ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Timetable Weekly Matrix / Cards */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {displayedDays.map((day) => {
            const daySessions = sessions.filter((s) => s.dayOfWeek === day);

            return (
              <div key={day} className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 tracking-wide uppercase">{day}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      {daySessions.length} Sessions
                    </span>
                  </div>

                  <button
                    onClick={() => openCreateModal(day)}
                    className="text-xs font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slot</span>
                  </button>
                </div>

                {daySessions.length === 0 ? (
                  <div className="p-6 rounded-3xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No classes scheduled for {day.toLowerCase()}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {daySessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-3 relative group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-slate-900 text-[#FFD978]">
                              {sess.startTime} - {sess.endTime}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sess.classType === 'ONLINE'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : sess.classType === 'HYBRID'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {sess.classType}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              onClick={() => openEditModal(sess)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(sess.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-base font-black text-slate-900">{sess.subject?.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <span className="font-bold text-slate-800">
                              {sess.class?.name} {sess.class?.section ? `(${sess.class?.section})` : ''}
                            </span>
                            {sess.room && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {sess.room}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium truncate max-w-[140px]">
                            {sess.teacher
                              ? sess.teacher.name || `${sess.teacher.firstName || ''} ${sess.teacher.lastName || ''}`
                              : 'No Teacher'}
                          </span>

                          {sess.meetingUrl ? (
                            <a
                              href={sess.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Join Online</span>
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </a>
                          ) : sess.classType === 'ONLINE' && !hasZoomFeature ? (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1 font-semibold">
                              <Lock className="w-3 h-3" /> Plan Upgrade Needed
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Timetable Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {editingSession ? 'Edit Timetable Session' : 'New Timetable Session'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Class / Batch</label>
                  <select
                    required
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Subject</label>
                  <select
                    required
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Teacher</label>
                  <select
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="">No Assigned Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || `${t.firstName || ''} ${t.lastName || ''}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Day of Week</label>
                  <select
                    required
                    value={formData.dayOfWeek}
                    onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Start Time (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">End Time (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Class Type</label>
                  <select
                    value={formData.classType}
                    onChange={(e) => setFormData({ ...formData, classType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="PHYSICAL">PHYSICAL CLASSROOM</option>
                    <option value="ONLINE">ONLINE MEETING (Zoom/Meet)</option>
                    <option value="HYBRID">HYBRID (Physical + Live Stream)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Room / Hall</label>
                  <input
                    type="text"
                    placeholder="e.g. Lab 02, Hall A"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Online Class Settings */}
              {(formData.classType === 'ONLINE' || formData.classType === 'HYBRID') && (
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                      <Video className="w-4 h-4" />
                      <span>Online Class Meeting Link</span>
                    </div>

                    {!hasZoomFeature && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        Requires ZOOM_CLASSES feature
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Meeting URL (HTTPS only)
                    </label>
                    <input
                      type="url"
                      placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                      value={formData.meetingUrl}
                      onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                      disabled={!hasZoomFeature}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-white disabled:bg-slate-100 disabled:opacity-60"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Meeting ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 849 2039 1029"
                        value={formData.meetingId}
                        onChange={(e) => setFormData({ ...formData, meetingId: e.target.value })}
                        disabled={!hasZoomFeature}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Passcode (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 123456"
                        value={formData.meetingPassword}
                        onChange={(e) => setFormData({ ...formData, meetingPassword: e.target.value })}
                        disabled={!hasZoomFeature}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Notes / Instructions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bring lab coat, prepare chapter 4 notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
                  {submitting ? 'Checking Conflicts...' : editingSession ? 'Update Session' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
