import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { Users, Search, Filter, Shield, Building, GraduationCap, CheckCircle2, XCircle } from 'lucide-react';

export default function PlatformUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = `?search=${encodeURIComponent(search)}`;
      if (roleFilter !== 'all') query += `&role=${roleFilter}`;

      const res = await apiRequest(`/super-admin/users${query}`);
      if (res.success) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFD978] text-amber-950 border border-amber-300">SUPER ADMIN</span>;
      case 'ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">INSTITUTE ADMIN</span>;
      case 'TEACHER':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">TEACHER</span>;
      case 'STUDENT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">STUDENT</span>;
      case 'PARENT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">PARENT</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Platform Users Directory</h2>
        <p className="text-sm text-slate-500">Cross-tenant platform user audit and role allocation</p>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search email or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
          />
        </form>

        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                roleFilter === r
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h4 className="text-base font-bold text-slate-700">No users found</h4>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-6">User Account</th>
                  <th className="py-3 px-6">Role</th>
                  <th className="py-3 px-6">Institute Scoped</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-bold text-slate-900">{u.email}</p>
                        <p className="text-xs text-slate-400 font-mono">@{u.username}</p>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {getRoleBadge(u.role)}
                    </td>

                    <td className="py-4 px-6">
                      {u.institute ? (
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{u.institute.name}</p>
                            <p className="text-[11px] font-mono text-slate-400">{u.institute.code}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 italic">
                          Global Platform (None)
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold ${u.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {u.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right text-xs text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
