import prisma from '../config/prisma.js';
import {
  getInvoiceAnalytics,
  recordInvoicePayment,
  updateTransactionStatus,
  getDateRange,
} from '../services/invoiceAnalytics.service.js';

/**
 * List Invoices with Search, Status, Class, and Period Filters
 */
export const getInvoices = async (req, res) => {
  try {
    const { search, status, classId, period, startDate, endDate } = req.query;

    const where = {
      instituteId: req.instituteId,
    };

    // Class filter
    if (classId) {
      where.classId = parseInt(classId, 10);
    }

    // Date range filter
    if (period && period !== 'all_time') {
      const { startDate: rStart, endDate: rEnd } = getDateRange(period, startDate, endDate);
      const dateFilter = {};
      if (rStart) dateFilter.gte = rStart;
      if (rEnd) dateFilter.lte = rEnd;
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }
    }

    // Search by student name, admission number, or invoice number
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q } },
        { title: { contains: q } },
        {
          student: {
            OR: [
              { name: { contains: q } },
              { admissionNumber: { contains: q } },
              { rollNo: { contains: q } },
            ],
          },
        },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        student: true,
        class: true,
        items: true,
        transactions: {
          include: {
            paymentMethod: true,
          },
          orderBy: { paymentDate: 'desc' },
        },
        institute: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    // Dynamically calculate balances and enforce overdue if past due date
    const enhancedInvoices = invoices.map((inv) => {
      const verifiedPaid = inv.transactions
        .filter((t) => t.status === 'VERIFIED')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      const total = parseFloat(inv.totalAmount) || 0;
      const balance = Math.max(total - verifiedPaid, 0);
      const isPastDue = new Date(inv.dueDate) < now;

      let effectiveStatus = inv.status;
      if (balance <= 0) {
        effectiveStatus = 'PAID';
      } else if (isPastDue) {
        effectiveStatus = 'OVERDUE';
      } else if (verifiedPaid > 0) {
        effectiveStatus = 'PARTIALLY_PAID';
      } else {
        effectiveStatus = 'UNPAID';
      }

      return {
        ...inv,
        paidAmount: verifiedPaid,
        balance,
        computedStatus: effectiveStatus,
      };
    });

    // Optional status filter
    const filteredInvoices = status && status !== 'ALL'
      ? enhancedInvoices.filter((inv) => inv.computedStatus === status || inv.status === status)
      : enhancedInvoices;

    return res.status(200).json({ success: true, data: filteredInvoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Single Invoice Detail
 */
export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: parseInt(id, 10),
        instituteId: req.instituteId,
      },
      include: {
        student: true,
        class: true,
        items: true,
        transactions: {
          include: {
            paymentMethod: true,
            verifiedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { paymentDate: 'desc' },
        },
        institute: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const verifiedPaid = invoice.transactions
      .filter((t) => t.status === 'VERIFIED')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const total = parseFloat(invoice.totalAmount) || 0;
    const balance = Math.max(total - verifiedPaid, 0);

    return res.status(200).json({
      success: true,
      data: {
        ...invoice,
        paidAmount: verifiedPaid,
        balance,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create Fee Invoice
 */
export const createInvoice = async (req, res) => {
  try {
    const { studentId, title, totalAmount, dueDate, items } = req.body;
    if (!studentId || !title || !totalAmount) {
      return res.status(400).json({ success: false, message: 'Student ID, title, and total amount are required.' });
    }

    const student = await prisma.student.findFirst({
      where: { id: parseInt(studentId, 10), instituteId: req.instituteId },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in your institute.' });
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const newInvoice = await prisma.invoice.create({
      data: {
        instituteId: req.instituteId,
        invoiceNumber,
        studentId: student.id,
        classId: student.classId,
        title,
        totalAmount: parseFloat(totalAmount),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'UNPAID',
        items: items && items.length > 0 ? {
          create: items.map(item => ({
            description: item.description,
            amount: parseFloat(item.amount),
          })),
        } : undefined,
      },
      include: {
        student: true,
        items: true,
        institute: true,
      },
    });

    return res.status(201).json({ success: true, message: 'Invoice generated successfully.', data: newInvoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Real MySQL Financial Analytics for Invoices & Collections
 */
export const getAnalytics = async (req, res) => {
  try {
    const { period, startDate, endDate, classId } = req.query;

    const analytics = await getInvoiceAnalytics({
      instituteId: req.instituteId,
      period,
      startDate,
      endDate,
      classId,
    });

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record a Payment against an Invoice
 */
export const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethodId, paymentMethodName, paymentDate, receiptFile, remarks } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    const result = await recordInvoicePayment({
      instituteId: req.instituteId,
      invoiceId: id,
      amount,
      paymentMethodId,
      paymentMethodName,
      paymentDate,
      receiptFile,
      remarks,
      verifiedById: req.user?.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded and invoice balance updated successfully.',
      data: result,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Verify a Pending Transaction
 */
export const verifyTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { remarks } = req.body;

    const updated = await updateTransactionStatus({
      instituteId: req.instituteId,
      transactionId,
      status: 'VERIFIED',
      verifiedById: req.user?.id,
      remarks,
    });

    return res.status(200).json({
      success: true,
      message: 'Transaction approved and verified.',
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Reject a Pending Transaction
 */
export const rejectTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { remarks } = req.body;

    const updated = await updateTransactionStatus({
      instituteId: req.instituteId,
      transactionId,
      status: 'REJECTED',
      verifiedById: req.user?.id,
      remarks,
    });

    return res.status(200).json({
      success: true,
      message: 'Transaction rejected.',
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * List Payment Methods for Institute
 */
export const getPaymentMethods = async (req, res) => {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: {
        instituteId: req.instituteId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ success: true, data: methods });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
