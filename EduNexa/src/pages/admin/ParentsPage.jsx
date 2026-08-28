import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import {
  Users,
  Plus,
  Search,
  UserPlus,
  X,
  Check,
  Mail,
  Phone,
  GraduationCap,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  Edit2,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export default function ParentsPage() {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedParentForLink, setSelectedParentForLink] = useState(null);
  const [editingParent, setEditingParent] = useState(null);

  // Register Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    occupation: '',
    address: '',
    studentId: '',
    relationship: 'Parent',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Link Student Form State
  const [linkData, setLinkData] = useState({
    studentId: '',
    relationship: 'Parent',
  });
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  const fetchParents = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/parents?search=${encodeURIComponent(search)}`);
      if (res.success) setParents(res.data || []);
    } catch (err) {
      console.error('Fetch parents error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiRequest('/students');
      if (res.success) setStudents(res.data || []);
    } catch (err) {
      console.error('Fetch students error:', err);
    }
  };

  useEffect(() => {
    fetchParents();
    fetchStudents();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchParents();
  };

  const handleCreateParent = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError('Parent name and email are required.');
      return;
    }

    try {
      setFormLoading(true);
      setFormError('');
      const res = await apiRequest('/parents', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setIsRegisterModalOpen(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          phone: '',
          occupation: '',
          address: '',
          studentId: '',
          relationship: 'Parent',
        });
        fetchParents();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to register parent account.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateParent = async (e) => {
    e.preventDefault();
    if (!editingParent) return;

    try {
      setFormLoading(true);
      setFormError('');
      const res = await apiRequest(`/parents/${editingParent.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingParent.name,
          phone: editingParent.phone,
          occupation: editingParent.occupation,
          address: editingParent.address,
        }),
      });

      if (res.success) {
        setEditingParent(null);
        fetchParents();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to update parent profile.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (parent) => {
    const newStatus = !parent.user?.isActive;
    try {
      const res = await apiRequest(`/parents/${parent.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (res.success) fetchParents();
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!selectedParentForLink || !linkData.studentId) {
      setLinkError('Please select a student to link.');
      return;
    }

    try {
      setLinkLoading(true);
      setLinkError('');
      const res = await apiRequest(`/parents/${selectedParentForLink.id}/link-student`, {
        method: 'POST',
        body: JSON.stringify(linkData),
      });

      if (res.success) {
        setIsLinkModalOpen(false);
        setSelectedParentForLink(null);
        setLinkData({ studentId: '', relationship: 'Parent' });
        fetchParents();
      }
    } catch (err) {
      setLinkError(err.message || 'Failed to link student.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlinkStudent = async (parentId, studentId) => {
    if (!window.confirm('Are you sure you want to unlink this student from parent profile?')) return;
    try {
      const res = await apiRequest(`/parents/${parentId}/unlink-student/${studentId}`, {
        method: 'DELETE',
      });
      if (res.success) fetchParents();
    } catch (err) {
      console.error('Unlink student error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Parent Management</h2>
          <p className="text-sm text-slate-500">Manage parent guardian accounts and link them to enrolled students</p>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setIsRegisterModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4 text-[#FFD978]" />
          <span>Register Parent</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by parent name, email, phone, student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
          />
        </form>
        <span className="text-xs text-slate-500 font-semibold px-2 sm:px-4 self-start sm:self-auto">
          Total: {parents.length} Parents Registered
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : parents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-slate-700">No parent guardian accounts found</p>
            <p className="text-xs text-slate-400 mt-1">Register a new parent account to populate this directory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-6">Parent Guardian</th>
                  <th className="py-3 px-6">Contact Info</th>
                  <th className="py-3 px-6">Linked Students</th>
                  <th className="py-3 px-6">Account Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {parents.map((p) => {
                  const isActive = p.user?.isActive !== false;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-900 flex items-center justify-center font-bold text-xs">
                            {p.name?.slice(0, 2).toUpperCase() || 'PR'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{p.name || `${p.firstName || ''} ${p.lastName || ''}`}</p>
                            <p className="text-xs text-slate-400">{p.occupation || 'Parent / Guardian'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.user?.email}</span>
                        </div>
                        {p.phone && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{p.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {p.students && p.students.length > 0 ? (
                            p.students.map((ps) => (
                              <span
                                key={ps.id || ps.studentId}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200"
                              >
                                <GraduationCap className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>{ps.student?.name}</span>
                                {ps.student?.admissionNumber && (
                                  <span className="text-[10px] font-mono text-blue-700 bg-blue-100/70 px-1 rounded">
                                    {ps.student.admissionNumber}
                                  </span>
                                )}
                                <button
                                  onClick={() => handleUnlinkStudent(p.id, ps.studentId)}
                                  title="Unlink student"
                                  className="ml-1 text-blue-400 hover:text-rose-600 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No linked students</span>
                          )}

                          <button
                            onClick={() => {
                              setSelectedParentForLink(p);
                              setLinkError('');
                              setIsLinkModalOpen(true);
                            }}
                            title="Link a student to this parent"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span>+ Link Student</span>
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleToggleStatus(p)}
                          title="Click to toggle parent active status"
                          className="cursor-pointer"
                        >
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100 transition-colors">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 hover:bg-rose-100 transition-colors">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Inactive</span>
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setEditingParent({
                              id: p.id,
                              name: p.name || '',
                              phone: p.phone || '',
                              occupation: p.occupation || '',
                              address: p.address || '',
                            });
                            setFormError('');
                          }}
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Edit parent details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Parent Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Register Parent / Guardian</h3>
                  <p className="text-xs text-slate-400">Scoped strictly to your institute</p>
                </div>
              </div>
              <button onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateParent} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Morgan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="parent@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="password"
                    placeholder="Parent123!"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+94 77 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation</label>
                  <input
                    type="text"
                    placeholder="e.g. Engineer / Accountant"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Link to Student (Optional)</label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                >
                  <option value="">Select Student to Link...</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.admissionNumber ? `(${st.admissionNumber})` : ''} {st.class ? `- ${st.class.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
                >
                  {formLoading ? 'Registering...' : 'Register Parent Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Parent Modal */}
      {editingParent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold">Edit Parent Profile</h3>
              <button onClick={() => setEditingParent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateParent} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingParent.name}
                  onChange={(e) => setEditingParent({ ...editingParent, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editingParent.phone}
                  onChange={(e) => setEditingParent({ ...editingParent, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation</label>
                <input
                  type="text"
                  value={editingParent.occupation}
                  onChange={(e) => setEditingParent({ ...editingParent, occupation: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingParent(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Student Modal */}
      {isLinkModalOpen && selectedParentForLink && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold">Link Student to Parent</h3>
                <p className="text-xs text-slate-400">Parent: {selectedParentForLink.name}</p>
              </div>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLinkStudent} className="p-6 space-y-4">
              {linkError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{linkError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Student *</label>
                <select
                  required
                  value={linkData.studentId}
                  onChange={(e) => setLinkData({ ...linkData, studentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                >
                  <option value="">Select Enrolled Student...</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.admissionNumber ? `(${st.admissionNumber})` : ''} {st.class ? `- ${st.class.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                <select
                  value={linkData.relationship}
                  onChange={(e) => setLinkData({ ...linkData, relationship: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                >
                  <option value="Parent">Parent</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkLoading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
                >
                  {linkLoading ? 'Linking...' : 'Link Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
