import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import { X, Building2, AlertCircle, Check } from 'lucide-react';

export default function BankAccountModal({ isOpen, onClose, onSaved, accountToEdit }) {
  const [formData, setFormData] = useState({
    bankName: '',
    branchName: '',
    accountHolderName: '',
    accountNumber: '',
    instructions: '',
    displayOrder: 0,
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (accountToEdit) {
      setFormData({
        bankName: accountToEdit.bankName || '',
        branchName: accountToEdit.branchName || '',
        accountHolderName: accountToEdit.accountHolderName || '',
        accountNumber: accountToEdit.accountNumber || '',
        instructions: accountToEdit.instructions || '',
        displayOrder: accountToEdit.displayOrder || 0,
        isActive: accountToEdit.isActive !== undefined ? accountToEdit.isActive : true,
      });
    } else {
      setFormData({
        bankName: '',
        branchName: '',
        accountHolderName: 'EduNexa Technologies (Pvt) Ltd',
        accountNumber: '',
        instructions: 'Please include your Institute Code as the transfer remark.',
        displayOrder: 0,
        isActive: true,
      });
    }
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bankName.trim() || !formData.accountHolderName.trim() || !formData.accountNumber.trim()) {
      setError('Bank name, account holder name, and account number are required.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const url = accountToEdit
        ? `/super-admin/bank-accounts/${accountToEdit.id}`
        : '/super-admin/bank-accounts';

      const method = accountToEdit ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.success) {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save bank account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {accountToEdit ? 'Edit Platform Bank Account' : 'Add Platform Bank Account'}
              </h3>
              <p className="text-xs text-slate-400">
                Official deposit details displayed to institutes during checkout
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Bank Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Commercial Bank of Ceylon"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Branch Name
              </label>
              <input
                type="text"
                placeholder="e.g. Colombo Super Branch"
                value={formData.branchName}
                onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Account Holder Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EduNexa Technologies (Pvt) Ltd"
              value={formData.accountHolderName}
              onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Account Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 8004592019"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Transfer Instructions / Remarks
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Include your Institute Code in the deposit slip remark."
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
            />
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-slate-900 focus:ring-[#FFD978]"
            />
            <div>
              <span className="text-xs font-bold text-slate-900">Active Status</span>
              <p className="text-[11px] text-slate-400">Available to institutes during subscription checkout</p>
            </div>
          </label>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
            >
              {loading ? 'Saving...' : accountToEdit ? 'Update Account' : 'Add Bank Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
