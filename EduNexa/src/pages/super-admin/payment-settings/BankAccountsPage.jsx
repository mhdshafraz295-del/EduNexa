import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import BankAccountModal from './BankAccountModal';
import {
  Building2,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  CreditCard,
  Layers,
  ArrowUpDown,
} from 'lucide-react';

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccountToEdit, setSelectedAccountToEdit] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/super-admin/bank-accounts');
      if (res.success) {
        setAccounts(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleToggleStatus = async (acc) => {
    try {
      const nextStatus = !acc.isActive;
      const res = await apiRequest(`/super-admin/bank-accounts/${acc.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      if (res.success) {
        fetchAccounts();
      }
    } catch (err) {
      alert(err.message || 'Failed to update bank account status.');
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900">Platform Bank Accounts</h2>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-[#FFD978] px-2.5 py-0.5 rounded-full">
              Payment Gateway
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage official deposit accounts and instructions presented to institutes for bank transfers
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedAccountToEdit(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-[#FFD978]" />
          <span>Add Bank Account</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 flex justify-center bg-white rounded-3xl border border-slate-200">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-200">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h4 className="text-base font-bold text-slate-800">No bank accounts configured</h4>
            <p className="text-xs text-slate-400 mt-1">Add a bank account so institutes can complete manual transfers.</p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className={`bg-white rounded-3xl border-2 p-6 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                acc.isActive ? 'border-slate-200/80' : 'border-slate-100 opacity-60 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    acc.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${acc.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {acc.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Order: #{acc.displayOrder}</span>
                </div>

                <h3 className="text-lg font-black text-slate-900">{acc.bankName}</h3>
                {acc.branchName && (
                  <p className="text-xs text-slate-500 font-semibold">{acc.branchName}</p>
                )}

                <div className="my-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Account Name</span>
                    <p className="text-xs font-bold text-slate-800">{acc.accountHolderName}</p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Account Number</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-base font-mono font-black text-slate-900">{acc.accountNumber}</p>
                      <button
                        onClick={() => handleCopy(acc.accountNumber, acc.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
                        title="Copy Account Number"
                      >
                        {copiedId === acc.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {acc.instructions && (
                  <p className="text-xs text-slate-500 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    "{acc.instructions}"
                  </p>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleToggleStatus(acc)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    acc.isActive ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {acc.isActive ? 'Deactivate' : 'Activate'}
                </button>

                <button
                  onClick={() => {
                    setSelectedAccountToEdit(acc);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <BankAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchAccounts}
        accountToEdit={selectedAccountToEdit}
      />
    </div>
  );
}
