import prisma from '../config/prisma.js';

/**
 * Helper to compute date range boundaries based on filter period
 */
export const getDateRange = (period = 'this_month', customStart = null, customEnd = null) => {
  const now = new Date();
  let startDate = null;
  let endDate = null;

  switch (period) {
    case 'this_month': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'last_month': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'last_3_months': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'last_6_months': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'this_year': {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      if (customStart) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
    }
    case 'all_time':
    default: {
      startDate = null;
      endDate = null;
      break;
    }
  }

  return { startDate, endDate };
};

/**
 * Format month label helper
 */
const formatMonthKey = (date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * Safe percentage difference calculation
 */
const calculatePercentChange = (current, previous) => {
  const curr = parseFloat(current) || 0;
  const prev = parseFloat(previous) || 0;

  if (prev === 0) {
    if (curr === 0) return 0;
    return 100; // 100% growth from 0 baseline
  }
  const change = ((curr - prev) / prev) * 100;
  return Math.round(change * 10) / 10;
};

/**
 * Authoritative Invoice & Collection Analytics Engine
 */
export const getInvoiceAnalytics = async ({
  instituteId,
  period = 'this_month',
  startDate = null,
  endDate = null,
  classId = null,
}) => {
  if (!instituteId) {
    throw new Error('Tenant isolation error: instituteId is required.');
  }

  const { startDate: rangeStart, endDate: rangeEnd } = getDateRange(period, startDate, endDate);
  const now = new Date();

  // 1. Base Query Filters
  const invoiceWhere = {
    instituteId: parseInt(instituteId, 10),
    ...(classId ? { classId: parseInt(classId, 10) } : {}),
  };

  const invoiceDateFilter = {};
  if (rangeStart) invoiceDateFilter.gte = rangeStart;
  if (rangeEnd) invoiceDateFilter.lte = rangeEnd;
  if (Object.keys(invoiceDateFilter).length > 0) {
    invoiceWhere.createdAt = invoiceDateFilter;
  }

  // Payments / Transactions Where Filter
  const transactionWhere = {
    instituteId: parseInt(instituteId, 10),
    status: 'VERIFIED',
    ...(classId ? { student: { classId: parseInt(classId, 10) } } : {}),
  };

  const transactionDateFilter = {};
  if (rangeStart) transactionDateFilter.gte = rangeStart;
  if (rangeEnd) transactionDateFilter.lte = rangeEnd;
  if (Object.keys(transactionDateFilter).length > 0) {
    transactionWhere.paymentDate = transactionDateFilter;
  }

  // 2. Fetch Invoices in Period (with student, class, and transactions)
  const [invoicesInPeriod, allInstituteInvoices, transactionsInPeriod, recentTransactions, instituteSetting] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        student: { select: { id: true, name: true, admissionNumber: true, rollNo: true, classId: true } },
        class: { select: { id: true, name: true } },
        transactions: {
          where: { status: 'VERIFIED' },
          select: { id: true, amount: true, paymentDate: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // Fetch all active invoices for institute to calculate accurate overall debtors
    prisma.invoice.findMany({
      where: {
        instituteId: parseInt(instituteId, 10),
        ...(classId ? { classId: parseInt(classId, 10) } : {}),
      },
      include: {
        student: { select: { id: true, name: true, admissionNumber: true, rollNo: true, classId: true, class: { select: { name: true } } } },
        class: { select: { id: true, name: true } },
        transactions: {
          where: { status: 'VERIFIED' },
          select: { id: true, amount: true, paymentDate: true, status: true },
        },
      },
    }),
    prisma.transaction.findMany({
      where: transactionWhere,
      include: {
        student: { select: { id: true, name: true, admissionNumber: true } },
        invoice: { select: { id: true, invoiceNumber: true, title: true, totalAmount: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.transaction.findMany({
      where: {
        instituteId: parseInt(instituteId, 10),
      },
      include: {
        student: { select: { id: true, name: true, admissionNumber: true, rollNo: true } },
        invoice: { select: { id: true, invoiceNumber: true, title: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: 'desc' },
      take: 15,
    }),
    prisma.setting.findFirst({
      where: { instituteId: parseInt(instituteId, 10) },
      select: { currencySymbol: true },
    }),
  ]);

  // 3. Compute Summary Metrics for the Selected Period
  let totalInvoiced = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;

  let paidAmountTotal = 0;
  let partialOutstandingTotal = 0;
  let unpaidAmountTotal = 0;
  let overdueAmountTotal = 0;
  let periodOutstanding = 0;

  invoicesInPeriod.forEach((inv) => {
    const invTotal = parseFloat(inv.totalAmount) || 0;
    totalInvoiced += invTotal;

    // Sum of verified transactions for this specific invoice
    const invVerifiedPaid = inv.transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const balance = Math.max(invTotal - invVerifiedPaid, 0);
    const isPastDue = new Date(inv.dueDate) < now;

    periodOutstanding += balance;

    if (balance <= 0) {
      paidCount++;
      paidAmountTotal += invTotal;
    } else if (isPastDue) {
      overdueCount++;
      overdueAmountTotal += balance;
    } else if (invVerifiedPaid > 0) {
      partialCount++;
      partialOutstandingTotal += balance;
    } else {
      unpaidCount++;
      unpaidAmountTotal += invTotal;
    }
  });

  // Total Collected in Selected Period (Uses payment.paymentDate semantics)
  const totalCollected = transactionsInPeriod.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  // Collection Rate % = (totalCollected / totalInvoiced) * 100 (Safe calculation)
  const collectionRate = totalInvoiced > 0
    ? Math.round((totalCollected / totalInvoiced) * 1000) / 10
    : (totalCollected > 0 ? 100 : 0);

  // 4. Month-over-Month Comparison Metrics
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const curMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [curMonthInvoices, prevMonthInvoices, curMonthTxs, prevMonthTxs] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        instituteId: parseInt(instituteId, 10),
        createdAt: { gte: curMonthStart, lte: curMonthEnd },
      },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        instituteId: parseInt(instituteId, 10),
        createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { totalAmount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        instituteId: parseInt(instituteId, 10),
        status: 'VERIFIED',
        paymentDate: { gte: curMonthStart, lte: curMonthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        instituteId: parseInt(instituteId, 10),
        status: 'VERIFIED',
        paymentDate: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const thisMonthInvoiced = curMonthInvoices._sum.totalAmount || 0;
  const lastMonthInvoiced = prevMonthInvoices._sum.totalAmount || 0;
  const thisMonthCollected = curMonthTxs._sum.amount || 0;
  const lastMonthCollected = prevMonthTxs._sum.amount || 0;

  const invoicedChange = calculatePercentChange(thisMonthInvoiced, lastMonthInvoiced);
  const collectedChange = calculatePercentChange(thisMonthCollected, lastMonthCollected);

  // 5. Monthly Trend Breakdown (Rolling last 6 months or 12 months)
  const monthlyTrendMap = new Map();
  const trendMonthsCount = 6;

  for (let i = trendMonthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = formatMonthKey(d);
    monthlyTrendMap.set(key, {
      month: key,
      monthDate: d,
      invoiced: 0,
      collected: 0,
      outstanding: 0,
      collectionRate: 0,
    });
  }

  // Populate invoiced from all institute invoices
  allInstituteInvoices.forEach((inv) => {
    const invDate = new Date(inv.createdAt);
    const key = formatMonthKey(invDate);
    if (monthlyTrendMap.has(key)) {
      const entry = monthlyTrendMap.get(key);
      entry.invoiced += parseFloat(inv.totalAmount) || 0;
    }
  });

  // Populate collected from verified transactions
  const allVerifiedTransactions = await prisma.transaction.findMany({
    where: {
      instituteId: parseInt(instituteId, 10),
      status: 'VERIFIED',
      paymentDate: {
        gte: new Date(now.getFullYear(), now.getMonth() - (trendMonthsCount - 1), 1),
      },
    },
    select: { amount: true, paymentDate: true },
  });

  allVerifiedTransactions.forEach((tx) => {
    const txDate = new Date(tx.paymentDate);
    const key = formatMonthKey(txDate);
    if (monthlyTrendMap.has(key)) {
      const entry = monthlyTrendMap.get(key);
      entry.collected += parseFloat(tx.amount) || 0;
    }
  });

  const monthlyTrend = Array.from(monthlyTrendMap.values()).map((m) => {
    const invoiced = Math.round(m.invoiced * 100) / 100;
    const collected = Math.round(m.collected * 100) / 100;
    const outstanding = Math.max(Math.round((invoiced - collected) * 100) / 100, 0);
    const rate = invoiced > 0 ? Math.round((collected / invoiced) * 1000) / 10 : (collected > 0 ? 100 : 0);
    return {
      month: m.month,
      invoiced,
      collected,
      outstanding,
      collectionRate: rate,
    };
  });

  // 6. Status Breakdown Structure
  const statusBreakdown = [
    {
      status: 'PAID',
      label: 'Paid',
      count: paidCount,
      amount: Math.round(paidAmountTotal * 100) / 100,
      color: '#10B981', // Emerald
    },
    {
      status: 'PARTIALLY_PAID',
      label: 'Partially Paid',
      count: partialCount,
      amount: Math.round(partialOutstandingTotal * 100) / 100,
      color: '#3B82F6', // Blue
    },
    {
      status: 'UNPAID',
      label: 'Unpaid',
      count: unpaidCount,
      amount: Math.round(unpaidAmountTotal * 100) / 100,
      color: '#F59E0B', // Amber
    },
    {
      status: 'OVERDUE',
      label: 'Overdue',
      count: overdueCount,
      amount: Math.round(overdueAmountTotal * 100) / 100,
      color: '#EF4444', // Rose
    },
  ];

  // 7. Top Outstanding Students / Debtors
  const studentOutstandingMap = new Map();

  allInstituteInvoices.forEach((inv) => {
    const invTotal = parseFloat(inv.totalAmount) || 0;
    const invVerifiedPaid = inv.transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const balance = Math.max(invTotal - invVerifiedPaid, 0);

    if (balance > 0 && inv.student) {
      const sId = inv.student.id;
      if (!studentOutstandingMap.has(sId)) {
        studentOutstandingMap.set(sId, {
          studentId: sId,
          studentName: inv.student.name,
          admissionNumber: inv.student.admissionNumber || inv.student.rollNo || '-',
          className: inv.class?.name || inv.student.class?.name || 'Unassigned',
          invoiceCount: 0,
          totalOutstanding: 0,
          oldestDueDate: inv.dueDate,
        });
      }

      const debtor = studentOutstandingMap.get(sId);
      debtor.invoiceCount += 1;
      debtor.totalOutstanding += balance;
      if (new Date(inv.dueDate) < new Date(debtor.oldestDueDate)) {
        debtor.oldestDueDate = inv.dueDate;
      }
    }
  });

  const topOutstandingStudents = Array.from(studentOutstandingMap.values())
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .slice(0, 10)
    .map((s) => ({
      ...s,
      totalOutstanding: Math.round(s.totalOutstanding * 100) / 100,
    }));

  const currencySymbol = instituteSetting?.currencySymbol || '$';

  return {
    summary: {
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      outstanding: Math.round(periodOutstanding * 100) / 100,
      overdue: Math.round(overdueAmountTotal * 100) / 100,
      collectionRate,
      totalInvoices: invoicesInPeriod.length,
      paidCount,
      partialCount,
      unpaidCount,
      overdueCount,
      currencySymbol,
    },
    comparison: {
      currentMonth: {
        invoiced: Math.round(thisMonthInvoiced * 100) / 100,
        collected: Math.round(thisMonthCollected * 100) / 100,
      },
      previousMonth: {
        invoiced: Math.round(lastMonthInvoiced * 100) / 100,
        collected: Math.round(lastMonthCollected * 100) / 100,
      },
      invoicedChange,
      collectedChange,
    },
    monthlyTrend,
    statusBreakdown,
    recentPayments: recentTransactions.map((tx) => ({
      id: tx.id,
      transactionNumber: tx.transactionNumber,
      studentName: tx.student?.name || 'Student',
      admissionNumber: tx.student?.admissionNumber || tx.student?.rollNo || '-',
      invoiceNumber: tx.invoice?.invoiceNumber || '-',
      invoiceTitle: tx.invoice?.title || '-',
      paymentMethod: tx.paymentMethod?.name || 'Direct / Cash',
      amount: parseFloat(tx.amount) || 0,
      paymentDate: tx.paymentDate,
      status: tx.status,
      remarks: tx.remarks || '',
    })),
    topOutstandingStudents,
  };
};

/**
 * Authoritative Payment Recorder: Creates Transaction and Updates Invoice State Atomically
 */
export const recordInvoicePayment = async ({
  instituteId,
  invoiceId,
  amount,
  paymentMethodId = null,
  paymentMethodName = null,
  paymentDate = new Date(),
  receiptFile = null,
  remarks = null,
  verifiedById = null,
}) => {
  if (!instituteId) throw new Error('Tenant isolation error: instituteId is required.');
  if (!invoiceId) throw new Error('Invoice ID is required.');
  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error('A valid positive payment amount is required.');
  }

  // Find invoice scoped strictly to current institute
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: parseInt(invoiceId, 10),
      instituteId: parseInt(instituteId, 10),
    },
    include: {
      student: true,
      transactions: {
        where: { status: 'VERIFIED' },
      },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found within your institute.');
  }

  // Optional: Resolve PaymentMethod if provided or create if custom name
  let resolvedMethodId = paymentMethodId ? parseInt(paymentMethodId, 10) : null;
  if (!resolvedMethodId && paymentMethodName) {
    let pm = await prisma.paymentMethod.findFirst({
      where: {
        instituteId: parseInt(instituteId, 10),
        name: { equals: paymentMethodName.trim() },
      },
    });
    if (!pm) {
      pm = await prisma.paymentMethod.create({
        data: {
          instituteId: parseInt(instituteId, 10),
          name: paymentMethodName.trim(),
          isActive: true,
        },
      });
    }
    resolvedMethodId = pm.id;
  }

  // Generate unique transaction reference
  const uniqueSuffix = `${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const transactionNumber = `REC-${uniqueSuffix}`;

  // Execute in single ACID Transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Verified Transaction
    const newTransaction = await tx.transaction.create({
      data: {
        instituteId: parseInt(instituteId, 10),
        transactionNumber,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        paymentMethodId: resolvedMethodId,
        amount: paymentAmount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        receiptFile: receiptFile || null,
        status: 'VERIFIED',
        verifiedById: verifiedById ? parseInt(verifiedById, 10) : null,
        remarks: remarks || null,
      },
      include: {
        paymentMethod: true,
        student: true,
        invoice: true,
      },
    });

    // 2. Compute Total Verified Payments for Invoice
    const currentPaidSum = invoice.transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const newTotalPaid = currentPaidSum + paymentAmount;
    const invTotal = parseFloat(invoice.totalAmount) || 0;

    // 3. Determine Updated Invoice Status
    let newStatus = 'UNPAID';
    if (newTotalPaid >= invTotal) {
      newStatus = 'PAID';
    } else if (newTotalPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    // 4. Update Invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newTotalPaid,
        status: newStatus,
      },
      include: {
        student: true,
        transactions: true,
        items: true,
      },
    });

    return { transaction: newTransaction, invoice: updatedInvoice };
  });

  return result;
};

/**
 * Verify or Reject a Pending Transaction
 */
export const updateTransactionStatus = async ({
  instituteId,
  transactionId,
  status, // 'VERIFIED' or 'REJECTED'
  verifiedById = null,
  remarks = null,
}) => {
  if (!['VERIFIED', 'REJECTED'].includes(status)) {
    throw new Error('Status must be either VERIFIED or REJECTED.');
  }

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: parseInt(transactionId, 10),
      instituteId: parseInt(instituteId, 10),
    },
    include: { invoice: true },
  });

  if (!transaction) {
    throw new Error('Transaction record not found in your institute.');
  }

  return await prisma.$transaction(async (tx) => {
    const updatedTx = await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status,
        verifiedById: verifiedById ? parseInt(verifiedById, 10) : null,
        remarks: remarks || transaction.remarks,
      },
    });

    // Recalculate invoice verified payments
    const allVerified = await tx.transaction.findMany({
      where: {
        invoiceId: transaction.invoiceId,
        status: 'VERIFIED',
      },
    });

    const totalVerifiedPaid = allVerified.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const invTotal = parseFloat(transaction.invoice.totalAmount) || 0;

    let newStatus = 'UNPAID';
    if (totalVerifiedPaid >= invTotal) {
      newStatus = 'PAID';
    } else if (totalVerifiedPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    } else if (new Date(transaction.invoice.dueDate) < new Date()) {
      newStatus = 'OVERDUE';
    }

    await tx.invoice.update({
      where: { id: transaction.invoiceId },
      data: {
        paidAmount: totalVerifiedPaid,
        status: newStatus,
      },
    });

    return updatedTx;
  });
};
