import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import InstituteBrandingHeader from '../../components/common/InstituteBrandingHeader';
import {
  AnalyticsCard,
  ResponsiveBarChart,
  ResponsiveAreaChart,
  ResponsiveDonutChart,
  ChartSkeleton,
} from '../../components/charts';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  Check,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  RefreshCw,
  User,
  GraduationCap,
  Percent,
  Layers,
  ChevronDown,
} from 'lucide-react';

const PERIOD_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
  { value: 'all_time', label: 'All Time' },
];

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Invoices' },
  { id: 'PAID', label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'PARTIALLY_PAID', label: 'Partially Paid', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'UNPAID', label: 'Unpaid / Pending', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'OVERDUE', label: 'Overdue', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

export default function InvoicesPage() {
  const { institute } = useAuth();

  // Primary State
  const [invoices, setInvoices] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Filters & Period State
  const [period, setPeriod] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);

  // Form States
  const [createForm, setCreateForm] = useState({
    studentId: '',
    title: '',
    totalAmount: '',
    dueDate: '',
    description: 'Term Academic & Tuition Fee',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethodId: '',
    paymentMethodName: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Fetch Analytics
  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setError('');
      let queryUrl = `/fees/analytics?period=${period}`;
      if (period === 'custom') {
        if (customStartDate) queryUrl += `&startDate=${customStartDate}`;
        if (customEndDate) queryUrl += `&endDate=${customEndDate}`;
      }
      if (selectedClassFilter) {
        queryUrl += `&classId=${selectedClassFilter}`;
      }

      const res = await apiRequest(queryUrl);
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to load invoice analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch Invoices & Base Metadata
  const fetchInvoicesAndMetadata = async () => {
    try {
      setLoading(true);
      let invUrl = `/fees/invoices?period=${period}`;
      if (period === 'custom') {
        if (customStartDate) invUrl += `&startDate=${customStartDate}`;
        if (customEndDate) invUrl += `&endDate=${customEndDate}`;
      }
      if (selectedClassFilter) invUrl += `&classId=${selectedClassFilter}`;
      if (searchQuery) invUrl += `&search=${encodeURIComponent(searchQuery)}`;
      if (selectedStatusFilter !== 'ALL') invUrl += `&status=${selectedStatusFilter}`;

      const [invRes, stuRes, clsRes, pmRes] = await Promise.all([
        apiRequest(invUrl),
        apiRequest('/students'),
        apiRequest('/academic/classes').catch(() => ({ success: false, data: [] })),
        apiRequest('/fees/payment-methods').catch(() => ({ success: false, data: [] })),
      ]);

      if (invRes.success) setInvoices(invRes.data);
      if (stuRes.success) setStudents(stuRes.data);
      if (clsRes.success) setClasses(clsRes.data || []);
      if (pmRes.success) setPaymentMethods(pmRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Load and on Period/Filter change
  useEffect(() => {
    fetchAnalytics();
    fetchInvoicesAndMetadata();
  }, [period, customStartDate, customEndDate, selectedClassFilter, selectedStatusFilter]);

  // Debounced search trigger for invoices list
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInvoicesAndMetadata();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Refresh All Data
  const handleRefresh = () => {
    fetchAnalytics();
    fetchInvoicesAndMetadata();
  };

  // Handle Create Fee Invoice
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.studentId || !createForm.title || !createForm.totalAmount) {
      setCreateError('Please fill all required fields.');
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError('');
      const res = await apiRequest('/fees/invoices', {
        method: 'POST',
        body: JSON.stringify({
          studentId: createForm.studentId,
          title: createForm.title,
          totalAmount: createForm.totalAmount,
          dueDate: createForm.dueDate,
          items: [
            { description: createForm.description || 'Academic Fee', amount: createForm.totalAmount },
          ],
        }),
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        setCreateForm({
          studentId: '',
          title: '',
          totalAmount: '',
          dueDate: '',
          description: 'Term Academic & Tuition Fee',
        });
        handleRefresh();
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create invoice.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Record Payment on Invoice
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    const amountNum = parseFloat(paymentForm.amount);
    if (!amountNum || amountNum <= 0) {
      setPaymentError('Please enter a valid payment amount.');
      return;
    }

    try {
      setPaymentLoading(true);
      setPaymentError('');
      const res = await apiRequest(`/fees/invoices/${paymentModalInvoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountNum,
          paymentMethodId: paymentForm.paymentMethodId || undefined,
          paymentMethodName: paymentForm.paymentMethodName || 'Cash',
          paymentDate: paymentForm.paymentDate,
          remarks: paymentForm.remarks,
        }),
      });

      if (res.success) {
        setPaymentModalInvoice(null);
        setPaymentForm({
          amount: '',
          paymentMethodId: '',
          paymentMethodName: 'Cash',
          paymentDate: new Date().toISOString().split('T')[0],
          remarks: '',
        });
        handleRefresh();
      }
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Export Financial Summary to CSV
  const handleExportCSV = () => {
    if (!analytics || !invoices) return;
    const summary = analytics.summary || {};
    const currency = summary.currencySymbol || '$';

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'EDUNEXA FINANCIAL INVOICE & COLLECTION SUMMARY REPORT\r\n';
    csvContent += `Institute,${institute?.name || 'My Institute'}\r\n`;
    csvContent += `Period,${period.toUpperCase()}\r\n`;
    csvContent += `Generated At,${new Date().toLocaleString()}\r\n\r\n`;

    csvContent += 'KEY PERFORMANCE INDICATORS\r\n';
    csvContent += `Total Invoiced,${currency} ${summary.totalInvoiced || 0}\r\n`;
    csvContent += `Total Collected,${currency} ${summary.totalCollected || 0}\r\n`;
    csvContent += `Outstanding Amount,${currency} ${summary.outstanding || 0}\r\n`;
    csvContent += `Overdue Amount,${currency} ${summary.overdue || 0}\r\n`;
    csvContent += `Collection Rate,${summary.collectionRate || 0}%\r\n`;
    csvContent += `Total Invoices Count,${summary.totalInvoices || 0}\r\n`;
    csvContent += `Paid Invoices Count,${summary.paidCount || 0}\r\n`;
    csvContent += `Partially Paid Count,${summary.partialCount || 0}\r\n`;
    csvContent += `Unpaid Count,${summary.unpaidCount || 0}\r\n`;
    csvContent += `Overdue Count,${summary.overdueCount || 0}\r\n\r\n`;

    csvContent += 'INVOICES LIST\r\n';
    csvContent += 'Invoice Number,Title,Student Name,Admission No,Class,Total Amount,Paid Amount,Balance,Due Date,Status\r\n';

    invoices.forEach((inv) => {
      const invNum = `"${inv.invoiceNumber || ''}"`;
      const title = `"${inv.title || ''}"`;
      const sName = `"${inv.student?.name || ''}"`;
      const adm = `"${inv.student?.admissionNumber || inv.student?.rollNo || ''}"`;
      const cls = `"${inv.class?.name || ''}"`;
      const total = inv.totalAmount || 0;
      const paid = inv.paidAmount || 0;
      const bal = inv.balance || 0;
      const due = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '';
      const st = `"${inv.computedStatus || inv.status}"`;

      csvContent += `${invNum},${title},${sName},${adm},${cls},${total},${paid},${bal},${due},${st}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Invoice_Financial_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = analytics?.summary || {};
  const comparison = analytics?.comparison || {};
  const currency = summary.currencySymbol || '$';

  // Format currency value helper
  const formatMoney = (val) => {
    const num = parseFloat(val) || 0;
    return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Prepare dual-series monthly trend data for recharts
  const trendChartData = useMemo(() => {
    if (!analytics?.monthlyTrend) return [];
    return analytics.monthlyTrend.map((m) => ({
      name: m.month,
      Invoiced: m.invoiced,
      Collected: m.collected,
      Outstanding: m.outstanding,
    }));
  }, [analytics]);

  // Donut chart status breakdown data
  const donutChartData = useMemo(() => {
    if (!analytics?.statusBreakdown) return [];
    return analytics.statusBreakdown
      .filter((s) => s.count > 0 || s.amount > 0)
      .map((s) => ({
        name: s.label,
        value: s.amount,
        count: s.count,
        fill: s.color,
        unit: currency,
      }));
  }, [analytics, currency]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#FFD978]/30 text-slate-900 border border-[#FFD978]/60 rounded-full">
              Real-Time MySQL Finance
            </span>
            <span className="text-xs text-slate-400 font-mono">Tenant Scoped</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Invoices & Collections Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor institutional fee collections, paid vs outstanding balances, and debtor analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-xs transition-all active:scale-95"
            title="Download CSV Summary"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export Summary</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#FFD978]" />
            <span>Create Fee Invoice</span>
          </button>
        </div>
      </div>

      {/* Period Filter & Comparison Toolbar */}
      <div className="glass-card p-4 rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-2xl border border-slate-200/60">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600">Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#FFD978]"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#FFD978]"
              />
            </div>
          )}

          {classes.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-2xl border border-slate-200/60">
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-600">Class:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[140px]"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Month-over-Month Comparison Badges */}
        {comparison && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-400 font-medium">Invoiced vs Last Month:</span>
              <span className={`font-black flex items-center gap-0.5 ${
                comparison.invoicedChange >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}>
                {comparison.invoicedChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 inline" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 inline" />
                )}
                {comparison.invoicedChange > 0 ? `+${comparison.invoicedChange}%` : `${comparison.invoicedChange}%`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-slate-400 font-medium">Collected vs Last Month:</span>
              <span className={`font-black flex items-center gap-0.5 ${
                comparison.collectedChange >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}>
                {comparison.collectedChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 inline" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 inline" />
                )}
                {comparison.collectedChange > 0 ? `+${comparison.collectedChange}%` : `${comparison.collectedChange}%`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error state if analytics failed */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Unable to load invoice analytics: {error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* 10 AUTHORITATIVE KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Total Invoiced */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Invoiced</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {analyticsLoading ? '...' : formatMoney(summary.totalInvoiced)}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Billed in selected period</p>
        </div>

        {/* 2. Total Collected */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden border-emerald-200/60 bg-emerald-50/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Collected</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
                {analyticsLoading ? '...' : formatMoney(summary.totalCollected)}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-600/90 mt-2 font-medium">Verified payments in period</p>
        </div>

        {/* 3. Outstanding / Unpaid */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden border-amber-200/60 bg-amber-50/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Outstanding</p>
              <h3 className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
                {analyticsLoading ? '...' : formatMoney(summary.outstanding)}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-amber-700/90 mt-2 font-medium">Remaining period balance</p>
        </div>

        {/* 4. Overdue Amount */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden border-rose-200/60 bg-rose-50/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Overdue Amount</p>
              <h3 className="text-xl sm:text-2xl font-black text-rose-950 mt-1">
                {analyticsLoading ? '...' : formatMoney(summary.overdue)}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-rose-600/90 mt-2 font-medium">Past invoice due date</p>
        </div>

        {/* 5. Collection Rate */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden bg-slate-900 text-white col-span-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Collection Rate</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#FFD978] mt-1">
                {analyticsLoading ? '...' : `${summary.collectionRate || 0}%`}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#FFD978]/20 text-[#FFD978] flex items-center justify-center font-bold">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-[#FFD978] h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(summary.collectionRate || 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Invoice Counts Secondary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Invoices</span>
            <p className="text-lg font-black text-slate-900">{summary.totalInvoices || 0}</p>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">100%</span>
        </div>

        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between border-emerald-100">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-700">Paid Invoices</span>
            <p className="text-lg font-black text-emerald-900">{summary.paidCount || 0}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {summary.totalInvoices > 0 ? Math.round((summary.paidCount / summary.totalInvoices) * 100) : 0}%
          </span>
        </div>

        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between border-blue-100">
          <div>
            <span className="text-[10px] font-bold uppercase text-blue-700">Partially Paid</span>
            <p className="text-lg font-black text-blue-900">{summary.partialCount || 0}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            {summary.totalInvoices > 0 ? Math.round((summary.partialCount / summary.totalInvoices) * 100) : 0}%
          </span>
        </div>

        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between border-amber-100">
          <div>
            <span className="text-[10px] font-bold uppercase text-amber-700">Unpaid / Pending</span>
            <p className="text-lg font-black text-amber-900">{summary.unpaidCount || 0}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {summary.totalInvoices > 0 ? Math.round((summary.unpaidCount / summary.totalInvoices) * 100) : 0}%
          </span>
        </div>

        <div className="glass-card p-3.5 rounded-2xl flex items-center justify-between border-rose-100 col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] font-bold uppercase text-rose-700">Overdue Invoices</span>
            <p className="text-lg font-black text-rose-900">{summary.overdueCount || 0}</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
            {summary.totalInvoices > 0 ? Math.round((summary.overdueCount / summary.totalInvoices) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Visual Charts & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dual Series Chart: Invoiced vs Collected */}
        <div className="lg:col-span-2 glass-card p-5 sm:p-6 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Invoiced vs Collected</h3>
              <p className="text-xs text-slate-400 mt-0.5">Authoritative 6-month historical billing & collection trend</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-900 inline-block" />
                <span className="text-slate-600">Invoiced</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#FFD978] inline-block" />
                <span className="text-slate-600">Collected</span>
              </div>
            </div>
          </div>

          <div className="pt-4 h-[280px]">
            {analyticsLoading ? (
              <ChartSkeleton height={260} />
            ) : trendChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No monthly billing records available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val) => [`${currency} ${Number(val).toLocaleString()}`, '']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                  />
                  <Bar dataKey="Invoiced" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Collected" fill="#FFD978" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Invoice Status Distribution Donut & Details */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Invoice Status Breakdown</h3>
            <p className="text-xs text-slate-400 mt-0.5">Distribution of current invoice amounts</p>
          </div>

          <div className="py-2 h-[200px]">
            {analyticsLoading ? (
              <ChartSkeleton height={190} />
            ) : donutChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No active invoice records.
              </div>
            ) : (
              <ResponsiveDonutChart data={donutChartData} height={190} innerRadius={45} outerRadius={70} showLegend={false} />
            )}
          </div>

          {/* Status Breakdown Mini Rows */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {analytics?.statusBreakdown?.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">({item.count})</span>
                </div>
                <span className="font-black text-slate-900">{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Collection Summary Table */}
      <div className="glass-card rounded-3xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Monthly Collection Overview</h3>
            <p className="text-xs text-slate-400 mt-0.5">Authoritative chronological breakdown of invoicing and collection performance</p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">6-Month Window</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-6">Month</th>
                <th className="py-3.5 px-6 text-right">Invoiced</th>
                <th className="py-3.5 px-6 text-right">Collected</th>
                <th className="py-3.5 px-6 text-right">Outstanding</th>
                <th className="py-3.5 px-6 text-right">Collection Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics?.monthlyTrend?.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-bold text-slate-900">{row.month}</td>
                  <td className="py-3.5 px-6 text-right font-medium text-slate-700">{formatMoney(row.invoiced)}</td>
                  <td className="py-3.5 px-6 text-right font-bold text-emerald-700">{formatMoney(row.collected)}</td>
                  <td className="py-3.5 px-6 text-right font-medium text-amber-700">{formatMoney(row.outstanding)}</td>
                  <td className="py-3.5 px-6 text-right">
                    <span className={`inline-flex items-center font-bold px-2.5 py-0.5 rounded-full text-xs ${
                      row.collectionRate >= 80
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : row.collectionRate >= 50
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {row.collectionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Layout: Recent Collections & Top Outstanding Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Collections Table */}
        <div className="glass-card rounded-3xl overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Collections</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real verified transaction records</p>
            </div>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>

          <div className="overflow-x-auto flex-1">
            {!analytics?.recentPayments || analytics.recentPayments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No recent payment transactions recorded.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Receipt / Date</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.recentPayments.slice(0, 7).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900">{p.transactionNumber}</span>
                        <p className="text-[10px] text-slate-400">{new Date(p.paymentDate).toLocaleDateString()}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{p.studentName}</span>
                        <p className="text-[10px] text-slate-400">Ref: {p.invoiceNumber}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium text-[10px]">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700">
                        {formatMoney(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Outstanding Students / Debtors */}
        <div className="glass-card rounded-3xl overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Highest Outstanding Balances</h3>
              <p className="text-xs text-slate-400 mt-0.5">Students with highest pending fee balances</p>
            </div>
            <User className="w-4 h-4 text-slate-400" />
          </div>

          <div className="overflow-x-auto flex-1">
            {!analytics?.topOutstandingStudents || analytics.topOutstandingStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No students with outstanding balances.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Invoices</th>
                    <th className="py-3 px-4 text-right">Total Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.topOutstandingStudents.slice(0, 7).map((s) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{s.studentName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{s.admissionNumber}</p>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {s.className}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-bold text-[10px]">
                          {s.invoiceCount} unpaid
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700">
                        {formatMoney(s.totalOutstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR FOR INVOICES LIST */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Institutional Invoices</h3>
            <p className="text-xs text-slate-500">Filter, search, record payments, and print official invoice documents</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student, adm no, invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD978] w-64 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStatusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Invoices List Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700">No invoice records are available for this period.</p>
              <p className="text-xs text-slate-400 mt-1">Adjust your filters or issue a new fee invoice.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-6">Invoice No & Title</th>
                    <th className="py-3 px-6">Student</th>
                    <th className="py-3 px-6">Total Amount</th>
                    <th className="py-3 px-6">Paid / Balance</th>
                    <th className="py-3 px-6">Due Date</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900">{inv.title}</p>
                        <span className="font-mono text-xs text-slate-400">{inv.invoiceNumber}</span>
                      </td>

                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-800">{inv.student?.name || 'Student'}</p>
                        <p className="text-xs text-slate-400 font-mono">{inv.student?.admissionNumber || inv.student?.rollNo || '-'}</p>
                      </td>

                      <td className="py-4 px-6 font-bold text-slate-900">
                        {formatMoney(inv.totalAmount)}
                      </td>

                      <td className="py-4 px-6">
                        <p className="text-xs font-bold text-emerald-700">Paid: {formatMoney(inv.paidAmount || 0)}</p>
                        <p className="text-xs font-semibold text-slate-500">Bal: {formatMoney(inv.balance || 0)}</p>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-500">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>

                      <td className="py-4 px-6">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          (inv.computedStatus || inv.status) === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : (inv.computedStatus || inv.status) === 'PARTIALLY_PAID'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : (inv.computedStatus || inv.status) === 'OVERDUE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {inv.computedStatus || inv.status}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                        {(inv.balance > 0 || (inv.computedStatus || inv.status) !== 'PAID') && (
                          <button
                            onClick={() => {
                              setPaymentModalInvoice(inv);
                              setPaymentForm({
                                amount: inv.balance ? inv.balance.toString() : '',
                                paymentMethodId: paymentMethods[0]?.id || '',
                                paymentMethodName: paymentMethods[0]?.name || 'Cash',
                                paymentDate: new Date().toISOString().split('T')[0],
                                remarks: '',
                              });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Record Payment</span>
                          </button>
                        )}

                        <button
                          onClick={() => setPreviewInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View / Print</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE INVOICE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD978] text-slate-900 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Issue Fee Invoice</h3>
                  <p className="text-xs text-slate-400">Generate a billing invoice for student</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Student *</label>
                <select
                  required
                  value={createForm.studentId}
                  onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                >
                  <option value="">Choose Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNumber || s.rollNo || `ID #${s.id}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Term 1 Tuition & Lab Fee"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="250.00"
                    value={createForm.totalAmount}
                    onChange={(e) => setCreateForm({ ...createForm, totalAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Description</label>
                <input
                  type="text"
                  placeholder="e.g. Term Academic & Tuition Fee"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD978] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
                >
                  {createLoading ? 'Generating...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-400 text-slate-900 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Record Invoice Payment</h3>
                  <p className="text-xs text-emerald-200">Invoice: {paymentModalInvoice.invoiceNumber}</p>
                </div>
              </div>
              <button onClick={() => setPaymentModalInvoice(null)} className="text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Invoice Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{paymentModalInvoice.student?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Invoice Amount:</span>
                  <span className="font-bold text-slate-900">{formatMoney(paymentModalInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Currently Paid:</span>
                  <span className="font-bold text-emerald-700">{formatMoney(paymentModalInvoice.paidAmount || 0)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span className="text-slate-700">Remaining Balance:</span>
                  <span className="text-amber-800">{formatMoney(paymentModalInvoice.balance || 0)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount ({currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 5000.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  {paymentMethods.length > 0 ? (
                    <select
                      value={paymentForm.paymentMethodId}
                      onChange={(e) => {
                        const mId = e.target.value;
                        const mObj = paymentMethods.find((p) => p.id.toString() === mId);
                        setPaymentForm({
                          ...paymentForm,
                          paymentMethodId: mId,
                          paymentMethodName: mObj ? mObj.name : 'Cash',
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    >
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. Cash, Bank Deposit, Card"
                      value={paymentForm.paymentMethodName}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethodName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="Optional receipt notes or bank ref"
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
                >
                  {paymentLoading ? 'Recording...' : 'Record Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE INVOICE / OFFICIAL REPORT MODAL */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Dynamic Institute Branding Header */}
            <div className="p-5 sm:p-8 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between pb-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Official Institutional Billing Document
                </span>
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="p-2 text-slate-400 hover:text-slate-900 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <InstituteBrandingHeader
                institute={previewInvoice.institute || institute}
                variant="document"
                showPlatformBadge={true}
                showSignatures={true}
              />

              <div className="mt-4 flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                  <h3 className="text-xl font-black text-slate-900">OFFICIAL FEE INVOICE</h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">Ref: {previewInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                    (previewInvoice.computedStatus || previewInvoice.status) === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : (previewInvoice.computedStatus || previewInvoice.status) === 'PARTIALLY_PAID'
                      ? 'bg-blue-100 text-blue-800'
                      : (previewInvoice.computedStatus || previewInvoice.status) === 'OVERDUE'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {previewInvoice.computedStatus || previewInvoice.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill Details */}
            <div className="p-5 sm:p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Billed Student</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{previewInvoice.student?.name}</p>
                  <p className="text-slate-500 font-mono">Adm: {previewInvoice.student?.admissionNumber || previewInvoice.student?.rollNo || '-'}</p>
                </div>
                <div className="sm:text-right">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Issue / Due Date</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">Due: {new Date(previewInvoice.dueDate).toLocaleDateString()}</p>
                  <p className="text-slate-500">Issued: {new Date(previewInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewInvoice.items && previewInvoice.items.length > 0 ? (
                      previewInvoice.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 px-4 font-medium text-slate-800">{item.description}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">{formatMoney(item.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-800">{previewInvoice.title}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">{formatMoney(previewInvoice.totalAmount)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                    <tr>
                      <td className="py-2.5 px-4 text-slate-700">Total Invoiced Amount</td>
                      <td className="py-2.5 px-4 text-right text-base font-black text-slate-900">{formatMoney(previewInvoice.totalAmount)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-emerald-700">Paid to Date</td>
                      <td className="py-2 px-4 text-right font-bold text-emerald-700">{formatMoney(previewInvoice.paidAmount || 0)}</td>
                    </tr>
                    <tr className="border-t border-slate-200">
                      <td className="py-2.5 px-4 text-slate-900">Remaining Balance Due</td>
                      <td className="py-2.5 px-4 text-right text-lg font-black text-slate-900">{formatMoney(previewInvoice.balance || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Transactions History on Invoice */}
              {previewInvoice.transactions && previewInvoice.transactions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment Transactions</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase">
                        <tr>
                          <th className="p-2.5">Receipt No</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Method</th>
                          <th className="p-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewInvoice.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{tx.transactionNumber}</td>
                            <td className="p-2.5 text-slate-500">{new Date(tx.paymentDate).toLocaleDateString()}</td>
                            <td className="p-2.5 text-slate-600">{tx.paymentMethod?.name || 'Direct'}</td>
                            <td className="p-2.5 text-right font-black text-emerald-700">{formatMoney(tx.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 flex items-center justify-between">
                <span>Verified by EduNexa Multi-Institute SaaS Gateway</span>
                <span className="font-mono text-[10px]">AUTH-VERIFIED</span>
              </div>
            </div>

            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs"
              >
                <Printer className="w-4 h-4 text-[#FFD978]" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
