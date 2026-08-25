import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import InstituteModal from './InstituteModal';
import {
  Building2,
  Search,
  Plus,
  Edit2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Filter,
  Phone,
  Mail,
  MapPin,
  Building,
} from 'lucide-react';

export default function InstitutesList() {
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstitute, setEditingInstitute] = useState(null);

  const fetchInstitutes = async () => {
    try {
      setLoading(true);
      let query = `?search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') query += `&status=${statusFilter}`;

      const res = await apiRequest(`/super-admin/institutes${query}`);
      if (res.success) {
        setInstitutes(res.data);
      }
    } catch (err) {
      console.error('Error fetching institutes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutes();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInstitutes();
  };

  const handleToggleStatus = async (inst) => {
    try {
      const nextStatus = !inst.isActive;
      await apiRequest(`/super-admin/institutes/${inst.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      fetchInstitutes();
    } catch (err) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const handleOpenEdit = (inst) => {
    setEditingInstitute(inst);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingInstitute(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Institutes Management</h2>
          <p className="text-sm text-slate-500">Provision, configure, and monitor multi-tenant institute environments</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 text-[#FFD978]" />
          <span>Provision Institute</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code, slug, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {['all', 'active', 'inactive'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Institutes Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : institutes.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h4 className="text-base font-bold text-slate-700">No institutes found</h4>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or provision a new institute.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-6">Institute Profile</th>
                  <th className="py-3 px-6">Tenant Identifiers</th>
                  <th className="py-3 px-6">Tenant Admin</th>
                  <th className="py-3 px-6">Stats Scoped</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {institutes.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                          {inst.logo ? (
                            <img
                              src={inst.logo}
                              alt={inst.name}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextSibling) {
                                  e.currentTarget.nextSibling.style.display = 'flex';
                                }
                              }}
                              className="w-full h-full object-contain bg-white"
                            />
                          ) : null}
                          <span className={`w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 text-[#FFD978] items-center justify-center font-black ${inst.logo ? 'hidden' : 'flex'}`}>
                            {inst.name ? inst.name.slice(0, 2).toUpperCase() : 'IN'}
                          </span>
                        </div>
                        <div>
                          <Link
                            to={`/super-admin/institutes/${inst.id}`}
                            className="font-bold text-slate-900 hover:text-amber-700 transition-colors"
                          >
                            {inst.name}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {inst.email && <span>{inst.email}</span>}
                            {inst.phone && <span>• {inst.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex flex-col font-mono text-xs">
                        <span className="font-bold text-slate-800">{inst.code}</span>
                        <span className="text-[11px] text-slate-400">/{inst.slug}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {inst.admin ? (
                        <div className="text-xs">
                          <p className="font-semibold text-slate-800">{inst.admin.email}</p>
                          <p className="text-[11px] text-slate-400">Username: {inst.admin.username}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No admin assigned</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 font-medium">
                          {inst.stats.students} Students
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-slate-100 font-medium">
                          {inst.stats.teachers} Teachers
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleStatus(inst)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                          inst.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${inst.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {inst.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(inst)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/super-admin/institutes/${inst.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InstituteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchInstitutes}
        instituteToEdit={editingInstitute}
      />
    </div>
  );
}
